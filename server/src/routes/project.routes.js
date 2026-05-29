const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { listProjects, createProject } = require('../controllers/project.controller');

router.use(auth);
router.get('/', listProjects);
router.post('/', createProject);

module.exports = router;