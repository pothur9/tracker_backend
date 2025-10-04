const { body } = require('express-validator');

const phoneRule = body('phone').isString().trim().isLength({ min: 8 }).withMessage('phone required');
const passwordRule = body('password').isString().isLength({ min: 6 }).withMessage('password length >= 6');

const schoolSignupValidator = [
  body('schoolName').isString().notEmpty(),
  body('schoolAddress').isString().notEmpty(),
  body('coordinates').isObject(),
  body('coordinates.lat').isFloat({ min: -90, max: 90 }),
  body('coordinates.lng').isFloat({ min: -180, max: 180 }),
  body('logoUrl').optional().isURL().withMessage('logoUrl must be a valid URL'),
  phoneRule,
  passwordRule,
];

const schoolLoginValidator = [phoneRule, passwordRule];

const mapSchoolValidator = [body('schoolId').isString().notEmpty()];

module.exports = { schoolSignupValidator, schoolLoginValidator, mapSchoolValidator };
