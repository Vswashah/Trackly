const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

// GET /projects/:projectId/labels
exports.listLabels = async (req, res) => {
  const { projectId } = req.params;
  try {
    const result = await db.query(
      `SELECT id, name, color_hex, description
       FROM labels
       WHERE project_id = $1 AND deleted_at IS NULL AND is_active = true
       ORDER BY name ASC`,
      [projectId]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List labels error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /projects/:projectId/labels
exports.createLabel = async (req, res) => {
  const { projectId } = req.params;
  const { name, color_hex, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  try {
    const result = await db.query(
      `INSERT INTO labels (id, project_id, created_by, name, color_hex, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, color_hex, description`,
      [uuidv4(), projectId, req.user.id, name.trim(), color_hex || '#6B7280', description || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A label with that name already exists in this project' });
    }
    console.error('Create label error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /projects/:projectId/labels/:labelId
exports.deleteLabel = async (req, res) => {
  const { projectId, labelId } = req.params;
  try {
    const result = await db.query(
      `UPDATE labels SET deleted_at = NOW(), is_active = false
       WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [labelId, projectId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Label not found' });
    return res.status(200).json({ message: 'Label deleted' });
  } catch (err) {
    console.error('Delete label error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /projects/:projectId/tickets/:ticketKey/labels  { label_id }
exports.addLabelToTicket = async (req, res) => {
  const { ticketKey } = req.params;
  const { label_id } = req.body;
  if (!label_id) return res.status(400).json({ error: 'label_id is required' });

  try {
    const ticketRes = await db.query(
      `SELECT id FROM tickets WHERE ticket_key = $1 AND is_deleted = false`,
      [ticketKey]
    );
    if (!ticketRes.rows.length) return res.status(404).json({ error: 'Ticket not found' });

    await db.query(
      `INSERT INTO map_ticket_labels (id, ticket_id, label_id, assigned_by)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [uuidv4(), ticketRes.rows[0].id, label_id, req.user.id]
    );
    return res.status(201).json({ message: 'Label added' });
  } catch (err) {
    console.error('Add label to ticket error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /projects/:projectId/tickets/:ticketKey/labels/:labelId
exports.removeLabelFromTicket = async (req, res) => {
  const { ticketKey, labelId } = req.params;

  try {
    const ticketRes = await db.query(
      `SELECT id FROM tickets WHERE ticket_key = $1 AND is_deleted = false`,
      [ticketKey]
    );
    if (!ticketRes.rows.length) return res.status(404).json({ error: 'Ticket not found' });

    await db.query(
      `DELETE FROM map_ticket_labels WHERE ticket_id = $1 AND label_id = $2`,
      [ticketRes.rows[0].id, labelId]
    );
    return res.status(200).json({ message: 'Label removed' });
  } catch (err) {
    console.error('Remove label from ticket error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
