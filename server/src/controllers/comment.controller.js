const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

// POST /tickets/:ticketId/comments
exports.createComment = async (req, res) => {
  const { ticketId } = req.params;
  const { body, parent_id } = req.body;

  if (!body) return res.status(400).json({ error: 'body is required' });

  try {
    // Verify ticket exists
    const ticketRes = await db.query(
      `SELECT id, ticket_key FROM tickets WHERE id = $1 AND is_deleted = false`,
      [ticketId]
    );
    if (!ticketRes.rows.length) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Insert comment
    const commentRes = await db.query(
      `INSERT INTO comments (id, ticket_id, author_id, parent_id, body)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [uuidv4(), ticketId, req.user.id, parent_id || null, body]
    );
    const comment = commentRes.rows[0];

    // Get author info
    const authorRes = await db.query(
      `SELECT full_name, avatar_url FROM users WHERE id = $1`,
      [req.user.id]
    );

    // Write to ticket history
    await db.query(
      `INSERT INTO ticket_history
        (id, ticket_id, actor_id, change_type_id, field_name, new_value)
       VALUES ($1, $2, $3,
         (SELECT id FROM mst_change_type WHERE code = 'comment_added'),
         'comment', $4)`,
      [uuidv4(), ticketId, req.user.id, body.slice(0, 100)]
    );

    // Notify all watchers except the commenter
    const watchersRes = await db.query(
      `SELECT user_id FROM map_ticket_watchers
       WHERE ticket_id = $1 AND user_id != $2`,
      [ticketId, req.user.id]
    );

    for (const watcher of watchersRes.rows) {
      await db.query(
        `INSERT INTO notifications
          (id, user_id, ticket_id, notif_type_id, actor_id, payload)
         VALUES ($1, $2, $3,
           (SELECT id FROM mst_notification_type WHERE code = 'commented'),
           $4, $5)`,
        [
          uuidv4(), watcher.user_id, ticketId, req.user.id,
          JSON.stringify({
            ticket_key: ticketRes.rows[0].ticket_key,
            comment_preview: body.slice(0, 80)
          })
        ]
      );
    }

    return res.status(201).json({
      id: comment.id,
      body: comment.body,
      parent_id: comment.parent_id,
      is_edited: false,
      created_at: comment.created_at,
      author: {
        id: req.user.id,
        full_name: authorRes.rows[0]?.full_name,
        avatar_url: authorRes.rows[0]?.avatar_url,
      },
    });
  } catch (err) {
    console.error('Create comment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /tickets/:ticketId/comments
exports.listComments = async (req, res) => {
  const { ticketId } = req.params;

  try {
    const commentsRes = await db.query(
      `SELECT c.id, c.body, c.parent_id, c.is_edited,
              c.created_at, c.updated_at,
              u.id as author_id, u.full_name as author_name,
              u.avatar_url as author_avatar
       FROM comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.ticket_id = $1 AND c.is_deleted = false
       ORDER BY c.created_at ASC`,
      [ticketId]
    );

    // Build threaded structure
    const topLevel = [];
    const map = {};

    commentsRes.rows.forEach(c => {
      map[c.id] = { ...c, replies: [] };
    });

    commentsRes.rows.forEach(c => {
      if (c.parent_id && map[c.parent_id]) {
        map[c.parent_id].replies.push(map[c.id]);
      } else {
        topLevel.push(map[c.id]);
      }
    });

    return res.status(200).json(topLevel);
  } catch (err) {
    console.error('List comments error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PATCH /tickets/:ticketId/comments/:commentId
exports.updateComment = async (req, res) => {
  const { commentId } = req.params;
  const { body } = req.body;

  if (!body) return res.status(400).json({ error: 'body is required' });

  try {
    const commentRes = await db.query(
      `SELECT id, author_id FROM comments WHERE id = $1 AND is_deleted = false`,
      [commentId]
    );
    if (!commentRes.rows.length) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Only author can edit
    if (commentRes.rows[0].author_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own comments' });
    }

    const updated = await db.query(
      `UPDATE comments
       SET body = $1, is_edited = true, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [body, commentId]
    );

    return res.status(200).json({
      id: updated.rows[0].id,
      body: updated.rows[0].body,
      is_edited: true,
      updated_at: updated.rows[0].updated_at,
    });
  } catch (err) {
    console.error('Update comment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /tickets/:ticketId/comments/:commentId
exports.deleteComment = async (req, res) => {
  const { commentId } = req.params;

  try {
    const commentRes = await db.query(
      `SELECT id, author_id FROM comments WHERE id = $1 AND is_deleted = false`,
      [commentId]
    );
    if (!commentRes.rows.length) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (commentRes.rows[0].author_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    await db.query(
      `UPDATE comments
       SET is_deleted = true, deleted_at = NOW()
       WHERE id = $1`,
      [commentId]
    );

    return res.status(200).json({ message: 'Comment deleted' });
  } catch (err) {
    console.error('Delete comment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};