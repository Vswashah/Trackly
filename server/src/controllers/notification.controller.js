const db = require('../config/db');

// GET /notifications
exports.listNotifications = async (req, res) => {
  const { page = 1, limit = 20, unread_only } = req.query;
  const offset = (page - 1) * limit;

  try {
    const conditions = [`n.user_id = $1`];
    const params = [req.user.id];
    if (unread_only === 'true') {
      conditions.push(`n.is_read = false`);
    }
    const where = conditions.join(' AND ');

    const countRes = await db.query(
      `SELECT COUNT(*) FROM notifications n WHERE ${where}`,
      params
    );

    const result = await db.query(
      `SELECT n.id, n.is_read, n.payload, n.read_at, n.created_at,
              nt.code as type, nt.template,
              t.ticket_key, t.project_id,
              a.id as actor_id, a.full_name as actor_name, a.avatar_url as actor_avatar
       FROM notifications n
       LEFT JOIN mst_notification_type nt ON nt.id = n.notif_type_id
       LEFT JOIN tickets t ON t.id = n.ticket_id
       LEFT JOIN users a ON a.id = n.actor_id
       WHERE ${where}
       ORDER BY n.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return res.status(200).json({
      notifications: result.rows,
      total: parseInt(countRes.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countRes.rows[0].count) / limit),
    });
  } catch (err) {
    console.error('List notifications error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /notifications/unread-count
exports.getUnreadCount = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );
    return res.status(200).json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    console.error('Unread count error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PATCH /notifications/:notificationId/read
exports.markRead = async (req, res) => {
  const { notificationId } = req.params;

  try {
    const result = await db.query(
      `UPDATE notifications SET is_read = true, read_at = NOW()
       WHERE id = $1 AND user_id = $2 RETURNING id`,
      [notificationId, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Notification not found' });
    return res.status(200).json({ message: 'Marked as read' });
  } catch (err) {
    console.error('Mark read error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PATCH /notifications/read-all
exports.markAllRead = async (req, res) => {
  try {
    await db.query(
      `UPDATE notifications SET is_read = true, read_at = NOW()
       WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );
    return res.status(200).json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all read error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
