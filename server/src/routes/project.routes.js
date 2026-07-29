const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireProjectMember } = require('../middleware/projectAccess');
const { listProjects, createProject, inviteMember, listMembers } = require('../controllers/project.controller');
router.use(auth);
router.get('/', listProjects);
router.post('/', createProject);
router.post('/:projectId/invite', requireProjectMember, inviteMember);
router.get('/:projectId/members', requireProjectMember, listMembers);

module.exports = router;