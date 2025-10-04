const express = require('express');
const authRoutes = require('./authRoutes');
const locationRoutes = require('./locationRoutes');
const configRoutes = require('./configRoutes');
const schoolRoutes = require('./schoolRoutes');
const directionsRoutes = require('./directionsRoutes');
const driverRoutes = require('./driverRoutes');
const adminRoutes = require('./adminRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/location', locationRoutes);
router.use('/config', configRoutes);
router.use('/school', schoolRoutes);
router.use('/directions', directionsRoutes);
router.use('/driver', driverRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
