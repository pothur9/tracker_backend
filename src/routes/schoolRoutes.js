const express = require('express');
const { schoolSignup, schoolLogin, listSchools, listSchoolsWithStats, mapSchoolToUser, mapSchoolToDriver, listDriversBySchool, schoolOverview, schoolOverviewById, countStudentsByBusBySchoolName, busStatsBySchoolName } = require('../controllers/schoolController');
const { schoolSignupValidator, schoolLoginValidator, mapSchoolValidator } = require('../validators/schoolValidators');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/signup', schoolSignupValidator, schoolSignup);
router.post('/login', schoolLoginValidator, schoolLogin);


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

module.exports = router;
