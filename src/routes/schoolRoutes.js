const express = require('express');
const { schoolSignup, schoolLogin, listSchools, listSchoolsWithStats, mapSchoolToUser, mapSchoolToDriver, listDriversBySchool, schoolOverview, schoolOverviewById, countStudentsByBusBySchoolName, busStatsBySchoolName, updateSchool } = require('../controllers/schoolController');
const { schoolSignupValidator, schoolLoginValidator, mapSchoolValidator } = require('../validators/schoolValidators');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/signup', schoolSignupValidator, schoolSignup);
router.post('/login', schoolLoginValidator, schoolLogin);

// School password reset - verify phone and set new password
router.post('/reset-password', async (req, res) => {
  const { phone, newPassword } = req.body;
  
  if (!phone || !newPassword) {
    return res.status(400).json({ error: 'Phone and new password are required' });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  try {
    const MSchool = require('../models/mongoose/School');
    const { hashPassword } = require('../utils/crypto');
    
    if (process.env.MONGODB_URI && MSchool) {
      const school = await MSchool.findOne({ phone });
      if (!school) {
        return res.status(404).json({ error: 'No school found with this phone number' });
      }
      
      const passwordHash = await hashPassword(newPassword);
      school.passwordHash = passwordHash;
      await school.save();
      
      return res.json({ 
        success: true, 
        message: 'Password reset successfully. You can now login with your new password.',
        schoolName: school.schoolName
      });
    } else {
      const { findSchoolByPhone } = require('../models/schoolModel');
      const { readDb, writeDb } = require('../config/db');
      
      const school = findSchoolByPhone(phone);
      if (!school) {
        return res.status(404).json({ error: 'No school found with this phone number' });
      }
      
      const passwordHash = await hashPassword(newPassword);
      const db = readDb();
      const idx = db.schools.findIndex(s => s.phone === phone);
      if (idx !== -1) {
        db.schools[idx].passwordHash = passwordHash;
        writeDb(db);
      }
      
      return res.json({ 
        success: true, 
        message: 'Password reset successfully',
        schoolName: school.schoolName
      });
    }
  } catch (error) {
    console.error('[School Reset Password] Error:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});


router.get('/', listSchools);

// Public: List all schools with totals of drivers and students
router.get('/stats', listSchoolsWithStats);


router.get('/by-name/:schoolName/bus/:busNumber/students/count', countStudentsByBusBySchoolName);

// Public: Bus stats (total buses and students per bus) by schoolName
router.get('/by-name/:schoolName/bus-stats', busStatsBySchoolName);

// Map a school to the authenticated user
router.post('/map/user', auth('user'), mapSchoolValidator, mapSchoolToUser);

// Map a school to the authenticated driver
router.post('/map/driver', auth('driver'), mapSchoolValidator, mapSchoolToDriver);

// List drivers for a given school (bus numbers)
router.get('/:schoolId/drivers', listDriversBySchool);

// School overview for authenticated school
router.get('/overview', auth('school'), schoolOverview);

// Public: school overview by id (no token)
router.get('/:schoolId/overview', schoolOverviewById);

// Update school information
router.put('/:schoolId', updateSchool);

// School: get their own driver locations (live tracking)
router.get('/drivers/locations', auth('school'), async (req, res) => {
  const schoolId = req.user.id;
  if (!schoolId) return res.status(400).json({ error: 'Invalid school context' });
  
  try {
    const MDriver = require('../models/mongoose/Driver');
    const MLocation = require('../models/mongoose/Location');
    const MSchool = require('../models/mongoose/School');

    const drivers = await MDriver.find({ schoolId }).lean();
    if (!drivers || drivers.length === 0) {
      return res.json({ schoolId, drivers: [], schoolLocation: null });
    }

    const driverLocations = await Promise.all(
      drivers.map(async (driver) => {
        const location = await MLocation.findOne({ driverId: String(driver._id) })
          .sort({ updatedAtIso: -1 })
          .lean();

        return {
          driverId: String(driver._id),
          name: driver.name,
          phone: driver.phone,
          busNumber: driver.busNumber,
          isSharingLocation: driver.isSharingLocation,
          currentStopIndex: driver.currentStopIndex,
          stops: driver.stops || [],
          location: location ? {
            lat: location.lat,
            lng: location.lng,
            updatedAt: location.updatedAtIso,
          } : null,
        };
      })
    );

    const school = await MSchool.findById(schoolId).lean();
    const schoolLocation = school && school.location && Array.isArray(school.location.coordinates)
      ? { lat: school.location.coordinates[1], lng: school.location.coordinates[0] }
      : null;

    return res.json({
      schoolId,
      schoolLocation,
      drivers: driverLocations,
    });
  } catch (error) {
    console.error('[schoolDriverLocations] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch driver locations' });
  }
});

// School: get their own route history by date
router.get('/route-history', auth('school'), async (req, res) => {
  const schoolId = req.user.id;
  const { date } = req.query; // Expected format: YYYY-MM-DD
  
  if (!schoolId) return res.status(400).json({ error: 'Invalid school context' });
  
  try {
    const MTripHistory = require('../models/mongoose/TripHistory');
    const MDriver = require('../models/mongoose/Driver');
    
    if (!MTripHistory || !MDriver) {
      return res.status(503).json({ error: 'Trip history not available' });
    }

    // Get all drivers for this school
    const drivers = await MDriver.find({ schoolId }).lean();
    
    // Build date filter
    let dateFilter = {};
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      dateFilter = { startTime: { $gte: startOfDay, $lte: endOfDay } };
    }

    // Get trips for each driver
    const driversWithTrips = await Promise.all(
      drivers.map(async (driver) => {
        const trips = await MTripHistory.find({
          driverId: driver._id,
          ...dateFilter
        }).sort({ startTime: -1 }).lean();

        return {
          driver: {
            _id: driver._id,
            name: driver.name,
            phone: driver.phone,
            busNumber: driver.busNumber,
          },
          trips,
          tripCount: trips.length,
          locationCount: trips.reduce((sum, t) => sum + (t.locations?.length || 0), 0),
        };
      })
    );

    // Summary statistics
    const summary = {
      totalDrivers: drivers.length,
      driversWithTrips: driversWithTrips.filter(d => d.tripCount > 0).length,
      totalTrips: driversWithTrips.reduce((sum, d) => sum + d.tripCount, 0),
      totalLocations: driversWithTrips.reduce((sum, d) => sum + d.locationCount, 0),
    };

    return res.json({
      date: date || 'all',
      drivers: driversWithTrips,
      summary,
    });
  } catch (error) {
    console.error('[School Route History] Error:', error);
    return res.status(500).json({ error: 'Failed to get route history' });
  }
});

module.exports = router;
