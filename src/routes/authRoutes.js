const express = require('express');
const auth = require('../middleware/auth');
const {
  requestUserOtp,
  verifyUserOtp,
  userSignup,
  userLogin,
  requestDriverOtp,
  verifyDriverOtp,
  driverSignup,
  driverLogin,
  getMe,
  setFcmToken,
  setStopIndex,
  checkUserExists,
  checkDriverExists,
} = require('../controllers/authController');
const {
  userSignupValidator,
  userLoginValidator,
  driverSignupValidator,
  driverLoginValidator,
  otpRequestValidator,
  otpVerifyValidator,
} = require('../validators/authValidators');
const { body } = require('express-validator');
const { validationResult } = require('express-validator');

const router = express.Router();

function validate(rules) {
  return [
    ...rules,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      next();
    },
  ];
}

// User OTP
router.post('/user/otp/request', otpRequestValidator, requestUserOtp);
router.post('/user/otp/verify', otpVerifyValidator, verifyUserOtp);

// User auth
router.get('/user/check/:phone', checkUserExists);
router.post('/user/signup', userSignupValidator, userSignup);
router.post('/user/login', userLoginValidator, userLogin);

// Driver OTP
router.post('/driver/otp/request', otpRequestValidator, requestDriverOtp);
router.post('/driver/otp/verify', otpVerifyValidator, verifyDriverOtp);

// Driver auth
router.get('/driver/check/:phone', checkDriverExists);
router.post('/driver/signup', driverSignupValidator, driverSignup);
router.post('/driver/login', driverLoginValidator, driverLogin);

// Profile for current token (user or driver)
router.get('/me', auth(), getMe);

// User: set FCM token for notifications
router.post(
  '/user/fcm',
  auth('user'),
  validate([body('fcmToken').isString().notEmpty()]),
  setFcmToken
);

// User: set stop index along the route
router.post(
  '/user/stop-index',
  auth('user'),
  validate([body('stopIndex').isInt({ min: 0 })]),
  setStopIndex
);

module.exports = router;
