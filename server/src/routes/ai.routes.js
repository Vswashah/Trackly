const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireProjectMemberFromBody, requireTicketKeyAccess } = require('../middleware/projectAccess');
const {
  findSimilar,
  getHints,
  summarize,
  suggestPriority,
  submitFeedback,
  chat,
} = require('../ai/ai.controller');

router.use(auth);

router.post('/similar', requireProjectMemberFromBody, findSimilar);
router.get('/hints/:ticketId', requireTicketKeyAccess, getHints);
router.post('/summarize/:ticketId', requireTicketKeyAccess, summarize);
router.post('/suggest-priority', suggestPriority);
router.post('/feedback/:interactionId', submitFeedback);
router.post('/chat', requireProjectMemberFromBody, chat);

module.exports = router;