const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { listTeamMembers } = require('../controllers/team.controller');

router.use(auth);

router.get('/members', listTeamMembers);

module.exports = router;
