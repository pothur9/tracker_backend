const express = require('express');
const authRoutes = require('./authRoutes');
const locationRoutes = require('./locationRoutes');
const configRoutes = require('./configRoutes');
const schoolRoutes = require('./schoolRoutes');
const directionsRoutes = require('./directionsRoutes');
const driverRoutes = require('./driverRoutes');
const adminRoutes = require('./adminRoutes');
const tripHistoryRoutes = require('./tripHistoryRoutes');
const testRoutes = require('./testRoutes');
const paymentRoutes = require('./paymentRoutes');
const agentRoutes = require('./agentRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/location', locationRoutes);
router.use('/config', configRoutes);
router.use('/school', schoolRoutes);
router.use('/directions', directionsRoutes);
router.use('/driver', driverRoutes);
router.use('/admin', adminRoutes);
router.use('/trips', tripHistoryRoutes);
router.use('/test', testRoutes);
router.use('/payment', paymentRoutes);
router.use('/admin/agents', agentRoutes);

module.exports = router;
