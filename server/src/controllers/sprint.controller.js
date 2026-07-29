const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

// GET /projects/:projectId/sprints
exports.listSprints = async (req, res) => {
  const { projectId } = req.params;
  try {
    const result = await db.query(
      `SELECT s.id, s.name, s.goal, s.status, s.start_date, s.end_date,
              s.completed_at, s.created_at,
              COUNT(mst.ticket_id) as ticket_count
       FROM sprints s
       LEFT JOIN map_sprint_tickets mst ON mst.sprint_id = s.id
       WHERE s.project_id = $1
       GROUP BY s.id
       ORDER BY s.created_at DESC`,
      [projectId]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List sprints error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /projects/:projectId/sprints
exports.createSprint = async (req, res) => {
  const { projectId } = req.params;
  const { name, goal, start_date, end_date } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  try {
    const result = await db.query(
      `INSERT INTO sprints (id, project_id, created_by, name, goal, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, goal, status, start_date, end_date, created_at`,
      [uuidv4(), projectId, req.user.id, name.trim(), goal || null, start_date || null, end_date || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create sprint error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PATCH /projects/:projectId/sprints/:sprintId/start
exports.startSprint = async (req, res) => {
  const { projectId, sprintId } = req.params;
  try {
    const result = await db.query(
      `UPDATE sprints SET status = 'active', updated_at = NOW()
       WHERE id = $1 AND project_id = $2 AND status = 'planned'
       RETURNING id, name, status`,
      [sprintId, projectId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Sprint not found or not in planned state' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This project already has an active sprint' });
    }
    console.error('Start sprint error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PATCH /projects/:projectId/sprints/:sprintId/complete
exports.completeSprint = async (req, res) => {
  const { projectId, sprintId } = req.params;
  try {
    const result = await db.query(
      `UPDATE sprints SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND project_id = $2 AND status = 'active'
       RETURNING id, name, status`,
      [sprintId, projectId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Sprint not found or not active' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Complete sprint error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /projects/:projectId/sprints/:sprintId/tickets
exports.listSprintTickets = async (req, res) => {
  const { sprintId } = req.params;
  try {
    const result = await db.query(
      `SELECT t.id, t.ticket_key, t.title, t.due_date,
              s.code as status, p.code as priority, ty.code as type,
              u.full_name as assignee_name
       FROM map_sprint_tickets mst
       JOIN tickets t ON t.id = mst.ticket_id AND t.is_deleted = false
       LEFT JOIN mst_ticket_status s ON s.id = t.status_id
       LEFT JOIN mst_ticket_priority p ON p.id = t.priority_id
       LEFT JOIN mst_ticket_type ty ON ty.id = t.type_id
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE mst.sprint_id = $1
       ORDER BY mst.position ASC, mst.added_at ASC`,
      [sprintId]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List sprint tickets error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /projects/:projectId/sprints/:sprintId/tickets  { ticket_id }
exports.addTicketToSprint = async (req, res) => {
  const { sprintId } = req.params;
  const { ticket_id } = req.body;
  if (!ticket_id) return res.status(400).json({ error: 'ticket_id is required' });

  try {
    await db.query(
      `INSERT INTO map_sprint_tickets (id, sprint_id, ticket_id, added_by)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [uuidv4(), sprintId, ticket_id, req.user.id]
    );
    return res.status(201).json({ message: 'Ticket added to sprint' });
  } catch (err) {
    console.error('Add ticket to sprint error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /projects/:projectId/sprints/:sprintId/tickets/:ticketId
exports.removeTicketFromSprint = async (req, res) => {
  const { sprintId, ticketId } = req.params;
  try {
    await db.query(
      `DELETE FROM map_sprint_tickets WHERE sprint_id = $1 AND ticket_id = $2`,
      [sprintId, ticketId]
    );
    return res.status(200).json({ message: 'Ticket removed from sprint' });
  } catch (err) {
    console.error('Remove ticket from sprint error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
