const db = require('../config/db');

// GET /projects/:projectId/analytics
exports.getAnalytics = async (req, res) => {
  const { projectId } = req.params;

  try {
    // Opened per week (last ~12 weeks)
    const openedRes = await db.query(
      `SELECT date_trunc('week', t.created_at) AS week, COUNT(*)::int AS opened
       FROM tickets t
       WHERE t.project_id = $1
         AND t.is_deleted = false
         AND t.created_at >= date_trunc('week', NOW()) - INTERVAL '11 weeks'
       GROUP BY week
       ORDER BY week ASC`,
      [projectId]
    );

    // Closed per week (last ~12 weeks)
    const closedRes = await db.query(
      `SELECT date_trunc('week', t.resolved_at) AS week, COUNT(*)::int AS closed
       FROM tickets t
       WHERE t.project_id = $1
         AND t.is_deleted = false
         AND t.resolved_at IS NOT NULL
         AND t.resolved_at >= date_trunc('week', NOW()) - INTERVAL '11 weeks'
       GROUP BY week
       ORDER BY week ASC`,
      [projectId]
    );

    // Merge opened/closed into a single weekly series
    const weekMap = new Map();
    for (const row of openedRes.rows) {
      const week = row.week.toISOString().slice(0, 10);
      weekMap.set(week, { week, opened: row.opened, closed: 0 });
    }
    for (const row of closedRes.rows) {
      const week = row.week.toISOString().slice(0, 10);
      const entry = weekMap.get(week) || { week, opened: 0, closed: 0 };
      entry.closed = row.closed;
      weekMap.set(week, entry);
    }
    const opened_vs_closed = Array.from(weekMap.values()).sort((a, b) =>
      a.week.localeCompare(b.week)
    );

    // Priority breakdown
    const priorityRes = await db.query(
      `SELECT p.code AS priority, COUNT(*)::int AS count
       FROM tickets t
       JOIN mst_ticket_priority p ON p.id = t.priority_id
       WHERE t.project_id = $1 AND t.is_deleted = false
       GROUP BY p.code
       ORDER BY p.code ASC`,
      [projectId]
    );

    // Average resolution time by priority (hours)
    const avgRes = await db.query(
      `SELECT p.code AS priority,
              ROUND(AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600)::numeric, 1) AS avg_hours
       FROM tickets t
       JOIN mst_ticket_priority p ON p.id = t.priority_id
       WHERE t.project_id = $1
         AND t.is_deleted = false
         AND t.resolved_at IS NOT NULL
       GROUP BY p.code
       ORDER BY p.code ASC`,
      [projectId]
    );

    // Top assignees by closed tickets
    const assigneeRes = await db.query(
      `SELECT u.full_name AS assignee_name, COUNT(*)::int AS closed_count
       FROM tickets t
       JOIN mst_ticket_status s ON s.id = t.status_id
       JOIN users u ON u.id = t.assignee_id
       WHERE t.project_id = $1
         AND t.is_deleted = false
         AND (s.is_terminal = true OR s.code IN ('done', 'cancelled'))
       GROUP BY u.full_name
       ORDER BY closed_count DESC
       LIMIT 5`,
      [projectId]
    );

    return res.status(200).json({
      opened_vs_closed,
      priority_breakdown: priorityRes.rows,
      avg_resolution_by_priority: avgRes.rows.map((r) => ({
        priority: r.priority,
        avg_hours: parseFloat(r.avg_hours),
      })),
      top_assignees: assigneeRes.rows,
    });
  } catch (err) {
    console.error('Get analytics error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
