const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../middleware/auth');
const { requireProjectMember } = require('../middleware/projectAccess');
const {
  createTicket,
  listTickets,
  getTicket,
  updateTicket,
  deleteTicket,
  revertHistoryEntry,
} = require('../controllers/ticket.controller');
const { addLabelToTicket, removeLabelFromTicket } = require('../controllers/label.controller');

router.use(auth); // all ticket routes require auth
router.use(requireProjectMember); // ...and membership in the project

router.post('/', createTicket);
router.get('/', listTickets);
router.get('/:ticketKey', getTicket);
router.patch('/:ticketKey', updateTicket);
router.delete('/:ticketKey', deleteTicket);
router.post('/:ticketKey/labels', addLabelToTicket);
router.delete('/:ticketKey/labels/:labelId', removeLabelFromTicket);
router.patch('/:ticketKey/history/:historyId/revert', revertHistoryEntry);

module.exports = router;