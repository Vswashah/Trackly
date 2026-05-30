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

exports.inviteMember = async (req, res) => {
  const { projectId } = req.params
  const { email, role = 'member' } = req.body

  if (!email) return res.status(400).json({ error: 'email is required' })

  try {
    // Find user by email
    const userRes = await db.query(
      `SELECT id, full_name, email FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase().trim()]
    )

    if (!userRes.rows.length) {
      return res.status(404).json({ error: 'No user found with that email. They need to register first.' })
    }

    const invitee = userRes.rows[0]

    // Check if already a member
    const existing = await db.query(
      `SELECT id FROM map_project_members 
       WHERE project_id = $1 AND user_id = $2 AND is_active = true`,
      [projectId, invitee.id]
    )

    if (existing.rows.length) {
      return res.status(409).json({ error: 'User is already a member of this project' })
    }

    // Add member
    await db.query(
      `INSERT INTO map_project_members (id, project_id, user_id, role_id, joined_at)
       VALUES ($1, $2, $3, (SELECT id FROM mst_roles WHERE code = $4), NOW())`,
      [uuidv4(), projectId, invitee.id, role]
    )

    return res.status(201).json({
      message: `${invitee.full_name} added to project`,
      user: { id: invitee.id, full_name: invitee.full_name, email: invitee.email, role }
    })
  } catch (err) {
    console.error('Invite member error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

exports.listMembers = async (req, res) => {
  const { projectId } = req.params

  try {
    const result = await db.query(
      `SELECT u.id, u.full_name, u.email, u.avatar_url,
              r.code as role, mpm.joined_at
       FROM map_project_members mpm
       JOIN users u ON u.id = mpm.user_id
       JOIN mst_roles r ON r.id = mpm.role_id
       WHERE mpm.project_id = $1 AND mpm.is_active = true
       ORDER BY mpm.joined_at ASC`,
      [projectId]
    )
    return res.status(200).json(result.rows)
  } catch (err) {
    console.error('List members error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}