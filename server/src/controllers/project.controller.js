const db = require('../config/db');

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