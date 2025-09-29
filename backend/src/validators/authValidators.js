const { body } = require('express-validator');

const phoneRule = body('phone').isString().trim().isLength({ min: 8 }).withMessage('phone required');
const passwordRule = body('password').isString().isLength({ min: 6 }).withMessage('password length >= 6');

// User signup validators
const userSignupValidator = [
  body('city').isString().notEmpty(),
  body('schoolName').isString().notEmpty(),
  body('name').isString().notEmpty(),
  body('fatherName').isString().notEmpty(),
  body('gender').isString().notEmpty(),
  phoneRule,
  body('busNumber').isString().notEmpty(),
  body('class').isString().notEmpty(),
  body('section').isString().notEmpty(),
  passwordRule,
];

const userLoginValidator = [phoneRule, passwordRule];

// Driver signup validators
const driverSignupValidator = [
  body('schoolName').isString().notEmpty(),
  body('schoolCity').isString().notEmpty(),
  body('name').isString().notEmpty(),
  phoneRule,
  body('busNumber').isString().notEmpty(),
  passwordRule,
];

const driverLoginValidator = [phoneRule, passwordRule];

const otpRequestValidator = [phoneRule];
const otpVerifyValidator = [phoneRule, body('code').isString().isLength({ min: 4 })];

module.exports = {
  userSignupValidator,
  userLoginValidator,
  driverSignupValidator,
  driverLoginValidator,
  otpRequestValidator,
  otpVerifyValidator,
};
