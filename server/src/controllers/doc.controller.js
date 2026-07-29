const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

// GET /projects/:projectId/docs
exports.listDocs = async (req, res) => {
  const { projectId } = req.params;
  try {
    const result = await db.query(
      `SELECT d.id, d.title, d.updated_at, u.full_name as updated_by_name
       FROM project_docs d
       LEFT JOIN users u ON u.id = d.updated_by
       WHERE d.project_id = $1 AND d.deleted_at IS NULL
       ORDER BY d.updated_at DESC`,
      [projectId]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List docs error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /projects/:projectId/docs/:docId
exports.getDoc = async (req, res) => {
  const { projectId, docId } = req.params;
  try {
    const result = await db.query(
      `SELECT d.id, d.title, d.content, d.created_at, d.updated_at,
              c.full_name as created_by_name, u.full_name as updated_by_name
       FROM project_docs d
       LEFT JOIN users c ON c.id = d.created_by
       LEFT JOIN users u ON u.id = d.updated_by
       WHERE d.id = $1 AND d.project_id = $2 AND d.deleted_at IS NULL`,
      [docId, projectId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Doc not found' });
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Get doc error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /projects/:projectId/docs
exports.createDoc = async (req, res) => {
  const { projectId } = req.params;
  const { title, content } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });

  try {
    const result = await db.query(
      `INSERT INTO project_docs (id, project_id, created_by, updated_by, title, content)
       VALUES ($1, $2, $3, $3, $4, $5)
       RETURNING id, title, content, created_at, updated_at`,
      [uuidv4(), projectId, req.user.id, title.trim(), content || '']
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create doc error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PATCH /projects/:projectId/docs/:docId
exports.updateDoc = async (req, res) => {
  const { projectId, docId } = req.params;
  const { title, content } = req.body;

  const updates = [];
  const params = [];
  let idx = 1;
  if (title !== undefined) { updates.push(`title = $${idx++}`); params.push(title.trim()); }
  if (content !== undefined) { updates.push(`content = $${idx++}`); params.push(content); }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

  updates.push(`updated_by = $${idx++}`);
  params.push(req.user.id);
  updates.push(`updated_at = NOW()`);

  try {
    const result = await db.query(
      `UPDATE project_docs SET ${updates.join(', ')}
       WHERE id = $${idx} AND project_id = $${idx + 1} AND deleted_at IS NULL
       RETURNING id, title, content, updated_at`,
      [...params, docId, projectId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Doc not found' });
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Update doc error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /projects/:projectId/docs/:docId
exports.deleteDoc = async (req, res) => {
  const { projectId, docId } = req.params;
  try {
    const result = await db.query(
      `UPDATE project_docs SET deleted_at = NOW()
       WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [docId, projectId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Doc not found' });
    return res.status(200).json({ message: 'Doc deleted' });
  } catch (err) {
    console.error('Delete doc error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
