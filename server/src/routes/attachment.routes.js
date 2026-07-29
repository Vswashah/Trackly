const express = require('express');
const multer = require('multer');
const router = express.Router({ mergeParams: true });
const auth = require('../middleware/auth');
const { requireTicketAccess } = require('../middleware/projectAccess');
const { uploadAttachment, listAttachments, deleteAttachment } = require('../controllers/attachment.controller');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(auth);
router.use(requireTicketAccess);

router.get('/', listAttachments);
router.post('/', upload.single('file'), uploadAttachment);
router.delete('/:attachmentId', deleteAttachment);

module.exports = router;
