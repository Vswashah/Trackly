const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  findSimilar,
  getHints,
  summarize,
  suggestPriority,
  submitFeedback,
} = require('../ai/ai.controller');

router.use(auth);

router.post('/similar', findSimilar);
router.get('/hints/:ticketId', getHints);
router.post('/summarize/:ticketId', summarize);
router.post('/suggest-priority', suggestPriority);
router.post('/feedback/:interactionId', submitFeedback);

module.exports = router;