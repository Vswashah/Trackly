const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../middleware/auth');
const { requireProjectMember } = require('../middleware/projectAccess');
const { listLabels, createLabel, deleteLabel } = require('../controllers/label.controller');

router.use(auth);
router.use(requireProjectMember);

router.get('/', listLabels);
router.post('/', createLabel);
router.delete('/:labelId', deleteLabel);

module.exports = router;
