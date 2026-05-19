const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

// ── helpers ───────────────────────────────────────────────────────

const generateTicketKey = async (projectId) => {
  const res = await db.query(
    `SELECT COUNT(*) FROM tickets WHERE project_id = $1`,
    [projectId]
  );
  const count = parseInt(res.rows[0].count) + 1;
  const prefixRes = await db.query(
    `SELECT slug FROM projects WHERE id = $1`, [projectId]
  );
  const slug = prefixRes.rows[0]?.slug || 'TRK';
  const prefix = slug.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'TRK';
  return `${prefix}-${String(count).padStart(3, '0')}`;
};

const getStatusId = async (code) => {
  const res = await db.query(
    `SELECT id FROM mst_ticket_status WHERE code = $1`, [code]
  );
  return res.rows[0]?.id;
};

const getPriorityId = async (code) => {
  const res = await db.query(
    `SELECT id FROM mst_ticket_priority WHERE code = $1`, [code]
  );
  return res.rows[0]?.id;
};

const getTypeId = async (code) => {
  const res = await db.query(
    `SELECT id FROM mst_ticket_type WHERE code = $1`, [code]
  );
  return res.rows[0]?.id;
};

// ── POST /projects/:projectId/tickets ─────────────────────────────
exports.createTicket = async (req, res) => {
  const { projectId } = req.params;
  const { title, description, priority, type, assignee_id, sprint_id, label_ids, due_date, estimate_points } = req.body;

  if (!title) return res.status(400).json({ error: 'title is required' });

  try {
    // Verify project exists
    const projectRes = await db.query(
      `SELECT id FROM projects WHERE id = $1 AND deleted_at IS NULL`, [projectId]
    );
    if (!projectRes.rows.length) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get IDs from master tables
    const statusId  = await getStatusId('open');
    const priorityId = priority ? await getPriorityId(priority) : await getPriorityId('p2');
    const typeId    = type ? await getTypeId(type) : await getTypeId('task');
    const ticketKey = await generateTicketKey(projectId);

    // Insert ticket
    const ticketRes = await db.query(
  `INSERT INTO tickets
    (id, project_id, status_id, priority_id, type_id, reporter_id, assignee_id,
     parent_id, ticket_key, title, description, due_date, estimate_points)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
   RETURNING *`,
  [
    uuidv4(), projectId, statusId, priorityId, typeId,
    req.user.id, assignee_id || null,
    req.body.parent_id || null, ticketKey, title,
    description || null, due_date || null, estimate_points || null
  ]
);

// Add to sprint via junction table if sprint_id provided
if (sprint_id) {
  await db.query(
    `INSERT INTO map_sprint_tickets (id, sprint_id, ticket_id, added_by)
     VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
    [uuidv4(), sprint_id, ticket.id, req.user.id]
  );
}
    const ticket = ticketRes.rows[0];

    // Add labels if provided
    if (label_ids?.length) {
      for (const labelId of label_ids) {
        await db.query(
          `INSERT INTO map_ticket_labels (id, ticket_id, label_id, assigned_by)
           VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
          [uuidv4(), ticket.id, labelId, req.user.id]
        );
      }
    }

    // Auto-add reporter as watcher
    await db.query(
      `INSERT INTO map_ticket_watchers (id, ticket_id, user_id)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [uuidv4(), ticket.id, req.user.id]
    );

    // Queue embedding job for AI features
    await db.query(
      `INSERT INTO embedding_jobs (id, ticket_id, status)
       VALUES ($1, $2, 'pending')`,
      [uuidv4(), ticket.id]
    );

    // Write to ticket history
    await db.query(
      `INSERT INTO ticket_history (id, ticket_id, actor_id, change_type_id, field_name, new_value)
       VALUES ($1, $2, $3,
         (SELECT id FROM mst_change_type WHERE code = 'field_change'),
         'created', $4)`,
      [uuidv4(), ticket.id, req.user.id, ticketKey]
    );

    return res.status(201).json({
      id: ticket.id,
      ticket_key: ticket.ticket_key,
      title: ticket.title,
      status: 'open',
      priority: priority || 'p2',
      type: type || 'task',
      project_id: ticket.project_id,
      reporter_id: ticket.reporter_id,
      assignee_id: ticket.assignee_id,
      created_at: ticket.created_at,
    });
  } catch (err) {
    console.error('Create ticket error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /projects/:projectId/tickets ──────────────────────────────
exports.listTickets = async (req, res) => {
  const { projectId } = req.params;
  const { status, priority, assignee_id, sprint_id, search, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let conditions = [`t.project_id = $1`, `t.is_deleted = false`];
    let params = [projectId];
    let idx = 2;

    if (status) {
      conditions.push(`s.code = $${idx++}`);
      params.push(status);
    }
    if (priority) {
      conditions.push(`p.code = $${idx++}`);
      params.push(priority);
    }
    if (assignee_id) {
      conditions.push(`t.assignee_id = $${idx++}`);
      params.push(assignee_id);
    }
    if (sprint_id) {
      conditions.push(`t.sprint_id = $${idx++}`);
      params.push(sprint_id);
    }
    if (search) {
      conditions.push(`(t.title ILIKE $${idx} OR t.description ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.join(' AND ');

    const countRes = await db.query(
      `SELECT COUNT(*) FROM tickets t
       LEFT JOIN mst_ticket_status s ON s.id = t.status_id
       LEFT JOIN mst_ticket_priority p ON p.id = t.priority_id
       WHERE ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count);

    const ticketsRes = await db.query(
      `SELECT t.id, t.ticket_key, t.title, t.description,
              t.assignee_id, t.reporter_id, t.position,
              t.due_date, t.created_at, t.updated_at,
              s.code as status, s.color_hex as status_color,
              p.code as priority, p.color_hex as priority_color,
              ty.code as type, ty.icon as type_icon,
              u.full_name as assignee_name, u.avatar_url as assignee_avatar
       FROM tickets t
       LEFT JOIN mst_ticket_status s ON s.id = t.status_id
       LEFT JOIN mst_ticket_priority p ON p.id = t.priority_id
       LEFT JOIN mst_ticket_type ty ON ty.id = t.type_id
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE ${where}
       ORDER BY t.position ASC, t.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    return res.status(200).json({
      tickets: ticketsRes.rows,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('List tickets error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /projects/:projectId/tickets/:ticketKey ───────────────────
exports.getTicket = async (req, res) => {
  const { ticketKey } = req.params;

  try {
    const ticketRes = await db.query(
      `SELECT t.*,
              s.code as status, s.color_hex as status_color,
              p.code as priority, p.color_hex as priority_color,
              ty.code as type, ty.icon as type_icon,
              r.full_name as reporter_name, r.avatar_url as reporter_avatar,
              a.full_name as assignee_name, a.avatar_url as assignee_avatar,
              (t.embedding IS NOT NULL) as has_embedding
       FROM tickets t
       LEFT JOIN mst_ticket_status s ON s.id = t.status_id
       LEFT JOIN mst_ticket_priority p ON p.id = t.priority_id
       LEFT JOIN mst_ticket_type ty ON ty.id = t.type_id
       LEFT JOIN users r ON r.id = t.reporter_id
       LEFT JOIN users a ON a.id = t.assignee_id
       WHERE t.ticket_key = $1 AND t.is_deleted = false`,
      [ticketKey]
    );

    if (!ticketRes.rows.length) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const ticket = ticketRes.rows[0];

    // Get labels
    const labelsRes = await db.query(
      `SELECT l.id, l.name, l.color_hex
       FROM labels l
       JOIN map_ticket_labels mtl ON mtl.label_id = l.id
       WHERE mtl.ticket_id = $1`,
      [ticket.id]
    );

    // Get comments
    const commentsRes = await db.query(
      `SELECT c.id, c.body, c.is_edited, c.created_at,
              u.full_name as author_name, u.avatar_url as author_avatar
       FROM comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.ticket_id = $1 AND c.is_deleted = false
       ORDER BY c.created_at ASC`,
      [ticket.id]
    );

    // Get recent history
    const historyRes = await db.query(
      `SELECT th.field_name, th.old_value, th.new_value, th.changed_at,
              ct.code as change_type,
              u.full_name as actor_name
       FROM ticket_history th
       LEFT JOIN mst_change_type ct ON ct.id = th.change_type_id
       LEFT JOIN users u ON u.id = th.actor_id
       WHERE th.ticket_id = $1
       ORDER BY th.changed_at DESC
       LIMIT 20`,
      [ticket.id]
    );

    return res.status(200).json({
      ...ticket,
      labels: labelsRes.rows,
      comments: commentsRes.rows,
      history: historyRes.rows,
    });
  } catch (err) {
    console.error('Get ticket error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── PATCH /projects/:projectId/tickets/:ticketKey ─────────────────
exports.updateTicket = async (req, res) => {
  const { ticketKey } = req.params;
  const { title, description, priority, status, assignee_id, position, due_date, estimate_points } = req.body;

  try {
    const ticketRes = await db.query(
      `SELECT t.*, s.code as status_code, p.code as priority_code
       FROM tickets t
       LEFT JOIN mst_ticket_status s ON s.id = t.status_id
       LEFT JOIN mst_ticket_priority p ON p.id = t.priority_id
       WHERE t.ticket_key = $1 AND t.is_deleted = false`,
      [ticketKey]
    );
    if (!ticketRes.rows.length) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const ticket = ticketRes.rows[0];

    // Build update fields dynamically
    const updates = [];
    const params = [];
    let idx = 1;

    const addUpdate = async (field, value) => {
      updates.push(`${field} = $${idx++}`);
      params.push(value);
    };

    if (title !== undefined)        await addUpdate('title', title);
    if (description !== undefined)  await addUpdate('description', description);
    if (position !== undefined)     await addUpdate('position', position);
    if (due_date !== undefined)     await addUpdate('due_date', due_date);
    if (estimate_points !== undefined) await addUpdate('estimate_points', estimate_points);
    if (assignee_id !== undefined)  await addUpdate('assignee_id', assignee_id);

    if (status !== undefined) {
      const statusId = await getStatusId(status);
      if (!statusId) return res.status(400).json({ error: 'Invalid status' });
      await addUpdate('status_id', statusId);
      if (['done', 'cancelled'].includes(status)) {
        await addUpdate('resolved_at', new Date());
      }
    }

    if (priority !== undefined) {
      const priorityId = await getPriorityId(priority);
      if (!priorityId) return res.status(400).json({ error: 'Invalid priority' });
      await addUpdate('priority_id', priorityId);
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);

    const updateRes = await db.query(
      `UPDATE tickets SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      [...params, ticket.id]
    );

    // Log to ticket history
    const changedFields = Object.keys(req.body);
    for (const field of changedFields) {
      await db.query(
        `INSERT INTO ticket_history
          (id, ticket_id, actor_id, change_type_id, field_name, old_value, new_value)
         VALUES ($1, $2, $3,
           (SELECT id FROM mst_change_type WHERE code = 'field_change'),
           $4, $5, $6)`,
        [uuidv4(), ticket.id, req.user.id, field,
         String(ticket[field] || ''), String(req.body[field] || '')]
      );
    }

    // Re-queue embedding if content changed
    if (title || description) {
      await db.query(
        `INSERT INTO embedding_jobs (id, ticket_id, status)
         VALUES ($1, $2, 'pending')
         ON CONFLICT DO NOTHING`,
        [uuidv4(), ticket.id]
      );
    }

    return res.status(200).json(updateRes.rows[0]);
  } catch (err) {
    console.error('Update ticket error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ── DELETE /projects/:projectId/tickets/:ticketKey ────────────────
exports.deleteTicket = async (req, res) => {
  const { ticketKey } = req.params;

  try {
    const ticketRes = await db.query(
      `SELECT id, reporter_id FROM tickets WHERE ticket_key = $1 AND is_deleted = false`,
      [ticketKey]
    );
    if (!ticketRes.rows.length) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const ticket = ticketRes.rows[0];

    await db.query(
      `UPDATE tickets SET is_deleted = true, deleted_at = NOW() WHERE id = $1`,
      [ticket.id]
    );

    return res.status(200).json({ message: 'Ticket deleted' });
  } catch (err) {
    console.error('Delete ticket error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};