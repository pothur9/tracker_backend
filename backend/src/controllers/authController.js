const { validationResult } = require('express-validator');
// Fallback JSON models
const { requestOtp, verifyOtp, isVerified } = require('../models/otpModel');
const { createUser, findUserByPhone } = require('../models/userModel');
const { createDriver, findDriverByPhone } = require('../models/driverModel');
// Mongoose models (optional)
let MUser, MDriver, MOtp;
try {
  MUser = require('../models/mongoose/User');
  MDriver = require('../models/mongoose/Driver');
  MOtp = require('../models/mongoose/Otp');
} catch {}
const { hashPassword, comparePassword } = require('../utils/crypto');
const { signToken } = require('../utils/token');

// Fake SMS sender (logs to console). Replace with real provider later.
async function sendOtpSms(phone, code) {
  console.log(`[OTP] Sending OTP ${code} to ${phone}`);
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Shared helpers
function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
}

// User flows
async function requestUserOtp(req, res) {
  const err = handleValidation(req, res); if (err) return;
  const { phone } = req.body;
  const code = generateOtp();
  if (process.env.MONGODB_URI && MOtp) {
    const expiresAt = new Date(Date.now() + 300 * 1000);
    await MOtp.findOneAndUpdate(
      { phone },
      { phone, code, expiresAt, verified: false },
      { upsert: true }
    );
  } else {
    requestOtp(phone, code, 300);
  }
  await sendOtpSms(phone, code);
  return res.json({ ok: true });
}

async function verifyUserOtp(req, res) {
  const err = handleValidation(req, res); if (err) return;
  const { phone, code } = req.body;
  let ok = false;
  if (process.env.MONGODB_URI && MOtp) {
    const rec = await MOtp.findOne({ phone });
    if (rec && rec.expiresAt > new Date() && rec.code === code) {
      rec.verified = true;
      await rec.save();
      ok = true;
    }
  } else {
    ok = verifyOtp(phone, code);
  }
  return res.json({ verified: ok });
}

async function userSignup(req, res) {
  const err = handleValidation(req, res); if (err) return;
  const { city, schoolName, name, fatherName, gender, phone, busNumber, class: className, section, password, fcmToken } = req.body;
  if (process.env.MONGODB_URI && MUser && MOtp) {
    const otp = await MOtp.findOne({ phone });
    if (!otp || !otp.verified) return res.status(400).json({ error: 'Phone not OTP verified' });
    const existing = await MUser.findOne({ phone });
    if (existing) return res.status(400).json({ error: 'User already exists' });
    const passwordHash = await hashPassword(password);
    const doc = await MUser.create({ city, schoolName, name, fatherName, gender, phone, busNumber, class: className, section, passwordHash, role: 'user', fcmToken });
    const token = signToken({ id: doc.id, role: 'user' });
    return res.status(201).json({ token, user: { id: doc.id, city, schoolName, name, fatherName, gender, phone, busNumber, class: className, section } });
  } else {
    if (!isVerified(phone)) return res.status(400).json({ error: 'Phone not OTP verified' });
    const existing = findUserByPhone(phone);
    if (existing) return res.status(400).json({ error: 'User already exists' });
    const passwordHash = await hashPassword(password);
    const user = createUser({ city, schoolName, name, fatherName, gender, phone, busNumber, class: className, section, passwordHash, role: 'user', fcmToken });
    const token = signToken({ id: user.id, role: 'user' });
    return res.status(201).json({ token, user: { id: user.id, city, schoolName, name, fatherName, gender, phone, busNumber, class: className, section } });
  }
}

async function userLogin(req, res) {
  const err = handleValidation(req, res); if (err) return;
  const { phone, password, fcmToken } = req.body;
  if (process.env.MONGODB_URI && MUser) {
    let user = await MUser.findOne({ phone });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    if (typeof fcmToken === 'string' && fcmToken) {
      user.fcmToken = fcmToken;
      await user.save();
    }
    const token = signToken({ id: user.id, role: 'user' });
    return res.json({ token, user: { id: user.id, city: user.city, schoolName: user.schoolName, name: user.name, fatherName: user.fatherName, gender: user.gender, phone: user.phone, busNumber: user.busNumber, class: user.class, section: user.section } });
  } else {
    const user = findUserByPhone(phone);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    // Persist fcmToken in fallback JSON store if provided
    if (typeof fcmToken === 'string' && fcmToken) {
      const { readDb, writeDb } = require('../config/db');
      const db = readDb();
      const idx = db.users.findIndex((u) => u.id === user.id);
      if (idx !== -1) {
        db.users[idx] = { ...db.users[idx], fcmToken };
        writeDb(db);
      }
    }
    const token = signToken({ id: user.id, role: 'user' });
    return res.json({ token, user: { id: user.id, city: user.city, schoolName: user.schoolName, name: user.name, fatherName: user.fatherName, gender: user.gender, phone: user.phone, busNumber: user.busNumber, class: user.class, section: user.section } });
  }
}

// Driver flows
async function requestDriverOtp(req, res) {
  const err = handleValidation(req, res); if (err) return;
  const { phone } = req.body;
  const code = generateOtp();
  if (process.env.MONGODB_URI && MOtp) {
    const expiresAt = new Date(Date.now() + 300 * 1000);
    await MOtp.findOneAndUpdate(
      { phone },
      { phone, code, expiresAt, verified: false },
      { upsert: true }
    );
  } else {
    requestOtp(phone, code, 300);
  }
  await sendOtpSms(phone, code);
  return res.json({ ok: true });
}

async function verifyDriverOtp(req, res) {
  const err = handleValidation(req, res); if (err) return;
  const { phone, code } = req.body;
  let ok = false;
  if (process.env.MONGODB_URI && MOtp) {
    const rec = await MOtp.findOne({ phone });
    if (rec && rec.expiresAt > new Date() && rec.code === code) {
      rec.verified = true;
      await rec.save();
      ok = true;
    }
  } else {
    ok = verifyOtp(phone, code);
  }
  return res.json({ verified: ok });
}

async function driverSignup(req, res) {
  const err = handleValidation(req, res); if (err) return;
  const { schoolName, schoolCity, name, phone, busNumber, password } = req.body;
  if (process.env.MONGODB_URI && MDriver && MOtp) {
    const otp = await MOtp.findOne({ phone });
    if (!otp || !otp.verified) return res.status(400).json({ error: 'Phone not OTP verified' });
    const existing = await MDriver.findOne({ phone });
    if (existing) return res.status(400).json({ error: 'Driver already exists' });
    const passwordHash = await hashPassword(password);
    const doc = await MDriver.create({ schoolName, schoolCity, name, phone, busNumber, passwordHash, role: 'driver' });
    const token = signToken({ id: doc.id, role: 'driver' });
    return res.status(201).json({ token, driver: { id: doc.id, schoolName, schoolCity, name, phone, busNumber } });
  } else {
    if (!isVerified(phone)) return res.status(400).json({ error: 'Phone not OTP verified' });
    const existing = findDriverByPhone(phone);
    if (existing) return res.status(400).json({ error: 'Driver already exists' });
    const passwordHash = await hashPassword(password);
    const driver = createDriver({ schoolName, schoolCity, name, phone, busNumber, passwordHash, role: 'driver' });
    const token = signToken({ id: driver.id, role: 'driver' });
    return res.status(201).json({ token, driver: { id: driver.id, schoolName, schoolCity, name, phone, busNumber } });
  }
}

async function driverLogin(req, res) {
  const err = handleValidation(req, res); if (err) return;
  const { phone, password } = req.body;
  if (process.env.MONGODB_URI && MDriver) {
    const driver = await MDriver.findOne({ phone });
    if (!driver) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await comparePassword(password, driver.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const token = signToken({ id: driver.id, role: 'driver' });
    return res.json({ token, driver: { id: driver.id, schoolName: driver.schoolName, schoolCity: driver.schoolCity, name: driver.name, phone: driver.phone, busNumber: driver.busNumber } });
  } else {
    const driver = findDriverByPhone(phone);
    if (!driver) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await comparePassword(password, driver.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const token = signToken({ id: driver.id, role: 'driver' });
    return res.json({ token, driver: { id: driver.id, schoolName: driver.schoolName, schoolCity: driver.schoolCity, name: driver.name, phone: driver.phone, busNumber: driver.busNumber } });
  }
}

// Get profile for current token
async function getMe(req, res) {
  const role = req.user.role;
  const id = req.user.id;
  if (process.env.MONGODB_URI && MUser && MDriver) {
    if (role === 'user') {
      const user = await MUser.findById(id);
      if (!user) return res.status(404).json({ error: 'Not found' });
      const { city, schoolName, name, fatherName, gender, phone, busNumber } = user;
      return res.json({ id, city, schoolName, name, fatherName, gender, phone, busNumber, class: user.class, section: user.section, role });
    }
    if (role === 'driver') {
      const driver = await MDriver.findById(id);
      if (!driver) return res.status(404).json({ error: 'Not found' });
      const { schoolName, schoolCity, name, phone, busNumber } = driver;
      return res.json({ id, schoolName, schoolCity, name, phone, busNumber, role });
    }
  } else {
    if (role === 'user') {
      const { readDb } = require('../config/db');
      const db = readDb();
      const user = db.users.find((u) => u.id === id);
      if (!user) return res.status(404).json({ error: 'Not found' });
      const { city, schoolName, name, fatherName, gender, phone, busNumber } = user;
      return res.json({ id, city, schoolName, name, fatherName, gender, phone, busNumber, class: user.class, section: user.section, role });
    }
    if (role === 'driver') {
      const { readDb } = require('../config/db');
      const db = readDb();
      const driver = db.drivers.find((d) => d.id === id);
      if (!driver) return res.status(404).json({ error: 'Not found' });
      const { schoolName, schoolCity, name, phone, busNumber } = driver;
      return res.json({ id, schoolName, schoolCity, name, phone, busNumber, role });
    }
  }
  return res.status(400).json({ error: 'Unknown role' });
}

// Update current user's FCM token
async function setFcmToken(req, res) {
  try {
    const { id, role } = req.user
    const { fcmToken } = req.body
    if (typeof fcmToken !== 'string' || !fcmToken) return res.status(400).json({ error: 'fcmToken required' })
    if (process.env.MONGODB_URI && MUser && role === 'user') {
      const user = await MUser.findByIdAndUpdate(id, { $set: { fcmToken } }, { new: true }).lean()
      if (!user) return res.status(404).json({ error: 'User not found' })
      return res.json({ ok: true })
    }
    return res.status(400).json({ error: 'Unsupported environment' })
  } catch (e) {
    return res.status(500).json({ error: 'Failed to set FCM token' })
  }
}

// Update current user's stop index along the route
async function setStopIndex(req, res) {
  try {
    const { id, role } = req.user
    const { stopIndex } = req.body
    if (!Number.isInteger(stopIndex) || stopIndex < 0) return res.status(400).json({ error: 'stopIndex must be non-negative integer' })
    if (process.env.MONGODB_URI && MUser && role === 'user') {
      const user = await MUser.findByIdAndUpdate(id, { $set: { stopIndex } }, { new: true }).lean()
      if (!user) return res.status(404).json({ error: 'User not found' })
      return res.json({ ok: true, stopIndex: user.stopIndex })
    }
    return res.status(400).json({ error: 'Unsupported environment' })
  } catch (e) {
    return res.status(500).json({ error: 'Failed to set stop index' })
  }
}

module.exports = {
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
};
