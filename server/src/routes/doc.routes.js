const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../middleware/auth');
const { requireProjectMember } = require('../middleware/projectAccess');
const { listDocs, getDoc, createDoc, updateDoc, deleteDoc } = require('../controllers/doc.controller');

router.use(auth);
router.use(requireProjectMember);

router.get('/', listDocs);
router.post('/', createDoc);
router.get('/:docId', getDoc);
router.patch('/:docId', updateDoc);
router.delete('/:docId', deleteDoc);

module.exports = router;
