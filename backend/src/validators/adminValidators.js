const { body } = require('express-validator');

const adminLoginValidator = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isString().isLength({ min: 6 }).withMessage('password length >= 6'),
];

const adminCreateSchoolValidator = [
  body('schoolName').isString().notEmpty(),
  body('schoolAddress').isString().notEmpty(),
  body('coordinates').optional().isObject(),
  body('coordinates.lat').optional().isFloat({ min: -90, max: 90 }),
  body('coordinates.lng').optional().isFloat({ min: -180, max: 180 }),
  body('logoUrl').optional().isURL().withMessage('logoUrl must be a valid URL'),
  body('phone').isString().trim().isLength({ min: 8 }).withMessage('phone required'),
  body('password').isString().isLength({ min: 6 }).withMessage('password length >= 6'),
];

const adminUpdateSchoolValidator = [
  body('schoolName').optional().isString(),
  body('schoolAddress').optional().isString(),
  body('coordinates').optional().isObject(),
  body('coordinates.lat').optional().isFloat({ min: -90, max: 90 }),
  body('coordinates.lng').optional().isFloat({ min: -180, max: 180 }),
  body('logoUrl').optional().isURL(),
  body('phone').not().exists().withMessage('phone cannot be updated'),
];

const adminCountStudentsByBusValidator = [
  body('busNumber').optional().isString().notEmpty(),
];

module.exports = { adminLoginValidator, adminCreateSchoolValidator, adminUpdateSchoolValidator, adminCountStudentsByBusValidator };
