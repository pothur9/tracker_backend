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

// Public: Update school district (temporary endpoint for data migration)
router.patch('/schools/:id/district', async (req, res) => {
  const { id } = req.params;
  const { district } = req.body;
  
  if (!id || !district) {
    return res.status(400).json({ error: 'id and district required' });
  }
  
  try {
    const MSchool = require('../models/mongoose/School');
    const doc = await MSchool.findByIdAndUpdate(
      id, 
      { district }, 
      { new: true }
    );
    
    if (!doc) {
      return res.status(404).json({ error: 'School not found' });
    }
    
    return res.json({
      success: true,
      school: {
        id: String(doc._id),
        schoolName: doc.schoolName,
        district: doc.district
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
