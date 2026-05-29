const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { listProjects } = require('../controllers/project.controller');

router.use(auth);
router.get('/', listProjects);

module.exports = router;