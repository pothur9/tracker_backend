const dayjs = require('dayjs');
const { upsert, find } = require('../config/db');

function requestOtp(phone, code, ttlSeconds = 300) {
  const expiresAt = dayjs().add(ttlSeconds, 'second').toISOString();
  return upsert('otps', (o) => o.phone === phone, {
    phone,
    code,
    expiresAt,
    verified: false,
  });
}

function verifyOtp(phone, code) {
  const rec = find('otps', (o) => o.phone === phone);
  if (!rec) return false;
  if (rec.verified) return true;
  if (dayjs(rec.expiresAt).isBefore(dayjs())) return false;
  if (rec.code !== code) return false;
  upsert('otps', (o) => o.phone === phone, { ...rec, verified: true });
  return true;
}

function isVerified(phone) {
  const rec = find('otps', (o) => o.phone === phone);
  return !!(rec && rec.verified);
}

module.exports = { requestOtp, verifyOtp, isVerified };
