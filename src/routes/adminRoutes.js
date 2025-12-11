const express = require('express');
const auth = require('../middleware/auth');
const { adminLogin, adminCreateSchool, adminListSchools, adminDeleteSchool, adminListSchoolsFull, adminUpdateSchool, adminCountStudentsByBus, adminGetSchoolDriverLocations } = require('../controllers/adminController');
const { adminLoginValidator, adminCreateSchoolValidator, adminUpdateSchoolValidator } = require('../validators/adminValidators');

const router = express.Router();

// Admin login -> returns token with role 'admin'
router.post('/login', adminLoginValidator, adminLogin);

// Admin school management
router.post('/schools', auth('admin'), adminCreateSchoolValidator, adminCreateSchool);
router.get('/schools', auth('admin'), adminListSchools);
router.delete('/schools/:id', auth('admin'), adminDeleteSchool);

// Admin: full school data (public)
router.get('/schools/full', adminListSchoolsFull);

// Admin: update school (excluding phone)
router.patch('/schools/:id', auth('admin'), adminUpdateSchoolValidator, adminUpdateSchool);

// Admin: count students under a particular bus for a given school (public)
router.get('/schools/:id/buses/:busNumber/students/count', adminCountStudentsByBus);

// Admin: get all driver locations for a particular school
router.get('/schools/:schoolId/drivers/locations', auth('admin'), adminGetSchoolDriverLocations);

module.exports = router;
