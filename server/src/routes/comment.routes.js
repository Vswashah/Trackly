const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../middleware/auth');
const {
  createComment,
  listComments,
  updateComment,
  deleteComment,
} = require('../controllers/comment.controller');

router.use(auth);

router.post('/', createComment);
router.get('/', listComments);
router.patch('/:commentId', updateComment);
router.delete('/:commentId', deleteComment);

module.exports = router;