const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} = require('../controllers/notification.controller');

router.use(auth);

router.get('/', listNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllRead);
router.patch('/:notificationId/read', markRead);

module.exports = router;
