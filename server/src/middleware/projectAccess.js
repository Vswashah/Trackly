const db = require('../config/db');

// Requires req.params.projectId; blocks unless the caller is an active member of that project.
exports.requireProjectMember = async (req, res, next) => {
  const { projectId } = req.params;
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });

  try {
    const result = await db.query(
      `SELECT 1 FROM map_project_members WHERE project_id = $1 AND user_id = $2 AND is_active = true`,
      [projectId, req.user.id]
    );
    if (!result.rows.length) {
      return res.status(403).json({ error: 'You are not a member of this project' });
    }
    next();
  } catch (err) {
    console.error('Project access check error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Requires req.body.project_id; used by routes that take the project as a body field, not a URL param.
exports.requireProjectMemberFromBody = async (req, res, next) => {
  const { project_id } = req.body;
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });

  try {
    const result = await db.query(
      `SELECT 1 FROM map_project_members WHERE project_id = $1 AND user_id = $2 AND is_active = true`,
      [project_id, req.user.id]
    );
    if (!result.rows.length) {
      return res.status(403).json({ error: 'You are not a member of this project' });
    }
    next();
  } catch (err) {
    console.error('Project access check error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Resolves req.params.ticketId as a ticket_key (e.g. "TRK-001") to its project, then checks membership.
// Used by the AI routes, which confusingly name the ticket_key param ":ticketId".
exports.requireTicketKeyAccess = async (req, res, next) => {
  const ticketKey = req.params.ticketId;
  if (!ticketKey) return res.status(400).json({ error: 'ticketId is required' });

  try {
    const ticketRes = await db.query(
      `SELECT project_id FROM tickets WHERE ticket_key = $1 AND is_deleted = false`,
      [ticketKey]
    );
    if (!ticketRes.rows.length) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const memberRes = await db.query(
      `SELECT 1 FROM map_project_members WHERE project_id = $1 AND user_id = $2 AND is_active = true`,
      [ticketRes.rows[0].project_id, req.user.id]
    );
    if (!memberRes.rows.length) {
      return res.status(403).json({ error: 'You are not a member of this project' });
    }
    next();
  } catch (err) {
    console.error('Ticket access check error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Resolves req.params.ticketId (uuid) to its project, then applies the same membership check.
// Used by routes mounted under /tickets/:ticketId/... where projectId isn't in the URL.
exports.requireTicketAccess = async (req, res, next) => {
  const { ticketId } = req.params;
  if (!ticketId) return res.status(400).json({ error: 'ticketId is required' });

  try {
    const ticketRes = await db.query(
      `SELECT project_id FROM tickets WHERE id = $1 AND is_deleted = false`,
      [ticketId]
    );
    if (!ticketRes.rows.length) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const memberRes = await db.query(
      `SELECT 1 FROM map_project_members WHERE project_id = $1 AND user_id = $2 AND is_active = true`,
      [ticketRes.rows[0].project_id, req.user.id]
    );
    if (!memberRes.rows.length) {
      return res.status(403).json({ error: 'You are not a member of this project' });
    }
    req.projectId = ticketRes.rows[0].project_id;
    next();
  } catch (err) {
    console.error('Ticket access check error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
