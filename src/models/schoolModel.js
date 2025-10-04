const { create, find } = require('../config/db');

function createSchool(school) {
  return create('schools', school);
}

function findSchoolByPhone(phone) {
  return find('schools', (s) => s.phone === phone);
}

// New helpers for admin
const { readDb, writeDb, filter } = require('../config/db');

function findSchoolById(id) {
  const db = readDb();
  return (db.schools || []).find((s) => String(s.id) === String(id)) || null;
}

function listSchools() {
  return filter('schools', () => true);
}

function deleteSchoolById(id) {
  const db = readDb();
  const before = db.schools.length;
  db.schools = db.schools.filter((s) => String(s.id) !== String(id));
  const removed = before !== db.schools.length;
  if (removed) writeDb(db);
  return removed;
}

module.exports = { createSchool, findSchoolByPhone, findSchoolById, listSchools, deleteSchoolById };
