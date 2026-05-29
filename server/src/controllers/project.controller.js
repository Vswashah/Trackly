const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

exports.listProjects = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.id, p.name, p.slug, p.color_hex, p.is_archived,
              COUNT(t.id) as ticket_count
       FROM projects p
       JOIN map_project_members mpm ON mpm.project_id = p.id
       LEFT JOIN tickets t ON t.project_id = p.id AND t.is_deleted = false
       WHERE mpm.user_id = $1
         AND p.deleted_at IS NULL
         AND p.is_archived = false
       GROUP BY p.id
       ORDER BY p.created_at ASC`,
      [req.user.id]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List projects error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.createProject = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      + '-' + Date.now().toString(36)

    const projectId = uuidv4()

    await db.query(
      `INSERT INTO projects (id, owner_id, name, slug, visibility_id)
       VALUES ($1, $2, $3, $4, (SELECT id FROM mst_visibility WHERE code = 'private'))`,
      [projectId, req.user.id, name.trim(), slug]
    )

    await db.query(
      `INSERT INTO map_project_members (id, project_id, user_id, role_id, joined_at)
       VALUES ($1, $2, $3, (SELECT id FROM mst_roles WHERE code = 'project_owner'), NOW())`,
      [uuidv4(), projectId, req.user.id]
    )

    const result = await db.query(
      `SELECT id, name, slug, color_hex FROM projects WHERE id = $1`,
      [projectId]
    )

    return res.status(201).json(result.rows[0])
  } catch (err) {
    console.error('Create project error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}