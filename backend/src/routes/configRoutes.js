const express = require('express');
const { getMapsConfig } = require('../controllers/configController');

const router = express.Router();

router.get('/maps-key', getMapsConfig);

module.exports = router;
