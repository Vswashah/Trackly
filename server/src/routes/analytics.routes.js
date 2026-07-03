const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../middleware/auth');
const { getAnalytics } = require('../controllers/analytics.controller');

router.use(auth);

router.get('/', getAnalytics);

module.exports = router;
