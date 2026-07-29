const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../middleware/auth');
const { requireProjectMember } = require('../middleware/projectAccess');
const {
  listSprints,
  createSprint,
  startSprint,
  completeSprint,
  listSprintTickets,
  addTicketToSprint,
  removeTicketFromSprint,
} = require('../controllers/sprint.controller');

router.use(auth);
router.use(requireProjectMember);

router.get('/', listSprints);
router.post('/', createSprint);
router.patch('/:sprintId/start', startSprint);
router.patch('/:sprintId/complete', completeSprint);
router.get('/:sprintId/tickets', listSprintTickets);
router.post('/:sprintId/tickets', addTicketToSprint);
router.delete('/:sprintId/tickets/:ticketId', removeTicketFromSprint);

module.exports = router;
