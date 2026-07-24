const db = require('../config/db');

// GET /team/members — everyone who shares at least one project with the caller
exports.listTeamMembers = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.full_name, u.email, u.avatar_url, u.last_login_at,
              json_agg(json_build_object('id', p.id, 'name', p.name, 'role', r.code)
                ORDER BY p.name) as projects
       FROM map_project_members mpm
       JOIN projects p ON p.id = mpm.project_id AND p.deleted_at IS NULL
       JOIN users u ON u.id = mpm.user_id AND u.deleted_at IS NULL
       LEFT JOIN mst_roles r ON r.id = mpm.role_id
       WHERE mpm.is_active = true
         AND mpm.project_id IN (
           SELECT project_id FROM map_project_members
           WHERE user_id = $1 AND is_active = true
         )
       GROUP BY u.id
       ORDER BY u.full_name ASC`,
      [req.user.id]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List team members error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
