const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { listProjects, createProject, inviteMember, listMembers } = require('../controllers/project.controller');
router.use(auth);
router.get('/', listProjects);
router.post('/', createProject);
router.post('/:projectId/invite', inviteMember);
router.get('/:projectId/members', listMembers);

module.exports = router;