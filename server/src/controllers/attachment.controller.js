const { v4: uuidv4 } = require('uuid');
const { Readable } = require('stream');
const db = require('../config/db');
const cloudinary = require('../config/cloudinary');

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const uploadToCloudinary = (buffer, filename) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'trackly-attachments', resource_type: 'auto', filename_override: filename, use_filename: true },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    Readable.from(buffer).pipe(stream);
  });

// POST /tickets/:ticketId/attachments  (multipart/form-data, field name "file")
exports.uploadAttachment = async (req, res) => {
  const { ticketId } = req.params;

  if (!req.file) return res.status(400).json({ error: 'file is required' });
  if (req.file.size > MAX_SIZE_BYTES) {
    return res.status(413).json({ error: 'File exceeds the 10MB limit' });
  }
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    return res.status(503).json({ error: 'File storage is not configured yet' });
  }

  try {
    const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);

    const attachRes = await db.query(
      `INSERT INTO attachments (id, ticket_id, uploaded_by, file_name, file_type, file_size_bytes, storage_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, file_name, file_type, file_size_bytes, storage_url, created_at`,
      [uuidv4(), ticketId, req.user.id, req.file.originalname, req.file.mimetype, req.file.size, result.secure_url]
    );

    return res.status(201).json(attachRes.rows[0]);
  } catch (err) {
    console.error('Upload attachment error:', err);
    return res.status(502).json({ error: 'Upload failed', detail: err.message });
  }
};

// GET /tickets/:ticketId/attachments
exports.listAttachments = async (req, res) => {
  const { ticketId } = req.params;
  try {
    const result = await db.query(
      `SELECT a.id, a.file_name, a.file_type, a.file_size_bytes, a.storage_url, a.created_at,
              u.full_name as uploaded_by_name
       FROM attachments a
       LEFT JOIN users u ON u.id = a.uploaded_by
       WHERE a.ticket_id = $1 AND a.deleted_at IS NULL
       ORDER BY a.created_at DESC`,
      [ticketId]
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('List attachments error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /tickets/:ticketId/attachments/:attachmentId
exports.deleteAttachment = async (req, res) => {
  const { ticketId, attachmentId } = req.params;
  try {
    const result = await db.query(
      `UPDATE attachments SET deleted_at = NOW()
       WHERE id = $1 AND ticket_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [attachmentId, ticketId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Attachment not found' });
    return res.status(200).json({ message: 'Attachment deleted' });
  } catch (err) {
    console.error('Delete attachment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
