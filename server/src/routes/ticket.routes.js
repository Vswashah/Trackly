const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../middleware/auth');
const {
  createTicket,
  listTickets,
  getTicket,
  updateTicket,
  deleteTicket,
} = require('../controllers/ticket.controller');

router.use(auth); // all ticket routes require auth

router.post('/', createTicket);
router.get('/', listTickets);
router.get('/:ticketKey', getTicket);
router.patch('/:ticketKey', updateTicket);
router.delete('/:ticketKey', deleteTicket);

module.exports = router;