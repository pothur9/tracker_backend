const { validationResult } = require('express-validator');
const { createSchool, findSchoolByPhone } = require('../models/schoolModel');
let MSchool;
try {
  MSchool = require('../models/mongoose/School');
} catch {}
let MUser, MDriver;
try {
  MUser = require('../models/mongoose/User');
  MDriver = require('../models/mongoose/Driver');
} catch {}
const { hashPassword, comparePassword } = require('../utils/crypto');
const { signToken } = require('../utils/token');

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
}

async function schoolSignup(req, res) {
  const err = handleValidation(req, res); if (err) return;
  const { schoolName, schoolAddress, coordinates, phone, password, logoUrl } = req.body;

  // coordinates expected as { lat: number, lng: number }
  if (!coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
    return res.status(400).json({ error: 'coordinates must be an object { lat, lng }' });
  }

  if (process.env.MONGODB_URI && MSchool) {
    const existing = await MSchool.findOne({ phone });
    if (existing) return res.status(400).json({ error: 'School already exists' });
    const passwordHash = await hashPassword(password);
    const doc = await MSchool.create({
      schoolName,
      schoolAddress,
      location: { type: 'Point', coordinates: [coordinates.lng, coordinates.lat] },
      logoUrl,
      phone,
      passwordHash,
      role: 'school',
    });
    const token = signToken({ id: doc.id, role: 'school' });
    return res.status(201).json({
      token,
      school: {
        id: doc.id,
        schoolName: doc.schoolName,
        schoolAddress: doc.schoolAddress,
        coordinates: { lat: coordinates.lat, lng: coordinates.lng },
        logoUrl: doc.logoUrl,
        phone: doc.phone,
      },
    });
  } else {
    const existing = findSchoolByPhone(phone);
    if (existing) return res.status(400).json({ error: 'School already exists' });
    const passwordHash = await hashPassword(password);
    const school = createSchool({
      schoolName,
      schoolAddress,
      coordinates, // keep as { lat, lng }
      logoUrl,
      phone,
      passwordHash,
      role: 'school',
    });
    const token = signToken({ id: school.id, role: 'school' });
    return res.status(201).json({
      token,
      school: {
        id: school.id,
        schoolName: school.schoolName,
        schoolAddress: school.schoolAddress,
        coordinates: school.coordinates,
        logoUrl: school.logoUrl,
        phone: school.phone,
      },
    });
  }
}

async function schoolLogin(req, res) {
  const err = handleValidation(req, res); if (err) return;
  const { phone, password } = req.body;
  if (process.env.MONGODB_URI && MSchool) {
    const school = await MSchool.findOne({ phone });
    if (!school) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await comparePassword(password, school.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const token = signToken({ id: school.id, role: 'school' });
    return res.json({
      token,
      school: {
        id: school.id,
        schoolName: school.schoolName,
        schoolAddress: school.schoolAddress,
        // convert to { lat, lng } if possible
        coordinates: school.location && Array.isArray(school.location.coordinates)
          ? { lat: school.location.coordinates[1], lng: school.location.coordinates[0] }
          : undefined,
        logoUrl: school.logoUrl,
        phone: school.phone,
      },
    });
  } else {
    const school = findSchoolByPhone(phone);
    if (!school) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await comparePassword(password, school.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const token = signToken({ id: school.id, role: 'school' });
    return res.json({
      token,
      school: {
        id: school.id,
        schoolName: school.schoolName,
        schoolAddress: school.schoolAddress,
        coordinates: school.coordinates,
        logoUrl: school.logoUrl,
        phone: school.phone,
      },
    });
  }
}

module.exports = { schoolSignup, schoolLogin };

// New: list and mapping endpoints

async function listSchools(req, res) {
  if (process.env.MONGODB_URI && MSchool) {
    const docs = await MSchool.find({}, 'schoolName schoolAddress location logoUrl').lean();
    return res.json(
      docs.map((d) => ({
        id: String(d._id),
        schoolName: d.schoolName,
        schoolAddress: d.schoolAddress,
        coordinates: d.location && Array.isArray(d.location.coordinates)
          ? { lat: d.location.coordinates[1], lng: d.location.coordinates[0] }
          : undefined,
        logoUrl: d.logoUrl,
      }))
    );
  } else {
    const { readDb } = require('../config/db');
    const db = readDb();
    const schools = db.schools || [];
    return res.json(
      schools.map((s) => ({
        id: s.id,
        schoolName: s.schoolName,
        schoolAddress: s.schoolAddress,
        coordinates: s.coordinates,
        logoUrl: s.logoUrl,
      }))
    );
  }
}

// Public: list all schools with totals of drivers and students
async function listSchoolsWithStats(req, res) {
  if (process.env.MONGODB_URI && MSchool) {
    const docs = await MSchool.find({}, 'schoolName schoolAddress location logoUrl phone').lean();
    const results = await Promise.all(
      docs.map(async (d) => {
        const [driverCount, studentCount] = await Promise.all([
          MDriver ? MDriver.countDocuments({ schoolId: d._id }) : Promise.resolve(0),
          MUser ? MUser.countDocuments({ schoolId: d._id }) : Promise.resolve(0),
        ]);
        return {
          id: String(d._id),
          schoolName: d.schoolName,
          schoolAddress: d.schoolAddress,
          coordinates: d.location && Array.isArray(d.location.coordinates)
            ? { lat: d.location.coordinates[1], lng: d.location.coordinates[0] }
            : undefined,
          logoUrl: d.logoUrl,
          phone: d.phone,
          totals: { drivers: driverCount, students: studentCount },
        };
      })
    );
    return res.json(results);
  } else {
    const { readDb } = require('../config/db');
    const db = readDb();
    const schools = db.schools || [];
    const drivers = db.drivers || [];
    const users = db.users || [];
    const results = schools.map((s) => {
      const driverCount = drivers.filter((d) => String(d.schoolId) === String(s.id)).length;
      const studentCount = users.filter((u) => String(u.schoolId) === String(s.id)).length;
      return {
        id: s.id,
        schoolName: s.schoolName,
        schoolAddress: s.schoolAddress,
        coordinates: s.coordinates,
        logoUrl: s.logoUrl,
        phone: s.phone,
        totals: { drivers: driverCount, students: studentCount },
      };
    });
    return res.json(results);
  }
}

async function mapSchoolToUser(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { schoolId } = req.body;

  if (process.env.MONGODB_URI && MSchool && MUser) {
    const school = await MSchool.findById(schoolId);
    if (!school) return res.status(404).json({ error: 'School not found' });
    const user = await MUser.findByIdAndUpdate(
      req.user.id,
      { schoolId: school._id, schoolName: school.schoolName },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ ok: true, school: { id: String(school._id), schoolName: school.schoolName } });
  } else {
    const { readDb, writeDb } = require('../config/db');
    const db = readDb();
    const school = (db.schools || []).find((s) => s.id === schoolId);
    if (!school) return res.status(404).json({ error: 'School not found' });
    const idx = db.users.findIndex((u) => u.id === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    db.users[idx] = { ...db.users[idx], schoolId: school.id, schoolName: school.schoolName };
    writeDb(db);
    return res.json({ ok: true, school: { id: school.id, schoolName: school.schoolName } });
  }
}

async function mapSchoolToDriver(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { schoolId } = req.body;

  if (process.env.MONGODB_URI && MSchool && MDriver) {
    const school = await MSchool.findById(schoolId);
    if (!school) return res.status(404).json({ error: 'School not found' });
    const driver = await MDriver.findByIdAndUpdate(
      req.user.id,
      { schoolId: school._id, schoolName: school.schoolName },
      { new: true }
    );
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    return res.json({ ok: true, school: { id: String(school._id), schoolName: school.schoolName } });
  } else {
    const { readDb, writeDb } = require('../config/db');
    const db = readDb();
    const school = (db.schools || []).find((s) => s.id === schoolId);
    if (!school) return res.status(404).json({ error: 'School not found' });
    const idx = db.drivers.findIndex((d) => d.id === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'Driver not found' });
    db.drivers[idx] = { ...db.drivers[idx], schoolId: school.id, schoolName: school.schoolName };
    writeDb(db);
    return res.json({ ok: true, school: { id: school.id, schoolName: school.schoolName } });
  }
}

module.exports.listSchools = listSchools;
module.exports.mapSchoolToUser = mapSchoolToUser;
module.exports.mapSchoolToDriver = mapSchoolToDriver;
module.exports.listSchoolsWithStats = listSchoolsWithStats;

// List drivers by school (for showing available bus numbers)
async function listDriversBySchool(req, res) {
  const { schoolId } = req.params;
  if (!schoolId) return res.status(400).json({ error: 'schoolId required' });

  if (process.env.MONGODB_URI && MDriver) {
    let query = { schoolId };
    // If schoolId isn't a valid ObjectId, try matching on stringified _id
    try {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(schoolId)) {
        query = { schoolId };
      }
    } catch {}
    const drivers = await MDriver.find(query, 'busNumber name phone schoolId').lean();
    return res.json(drivers.map((d) => ({
      id: String(d._id),
      busNumber: d.busNumber,
      name: d.name,
      phone: d.phone,
      schoolId: d.schoolId ? String(d.schoolId) : undefined,
    })));
  } else {
    const { readDb } = require('../config/db');
    const db = readDb();
    const list = (db.drivers || []).filter((d) => String(d.schoolId) === String(schoolId));
    return res.json(list.map((d) => ({ id: d.id, busNumber: d.busNumber, name: d.name, phone: d.phone, schoolId: d.schoolId })));
  }
}

module.exports.listDriversBySchool = listDriversBySchool;

// Overview for a logged-in school: list drivers (buses) and students under it
async function schoolOverview(req, res) {
  const schoolId = req.user.id;
  if (!schoolId) return res.status(400).json({ error: 'Invalid school context' });

  if (process.env.MONGODB_URI && MSchool) {
    // Fetch school document
    const school = await MSchool.findById(schoolId).lean();
    if (!school) return res.status(404).json({ error: 'School not found' });

    let drivers = [];
    let students = [];
    if (MDriver) {
      drivers = await MDriver.find({ schoolId }, 'busNumber name phone').lean();
    }
    if (MUser) {
      students = await MUser.find({ schoolId }, 'name phone class section busNumber gender fatherName').lean();
    }

    return res.json({
      school: {
        id: String(school._id),
        schoolName: school.schoolName,
        schoolAddress: school.schoolAddress,
        coordinates: school.location && Array.isArray(school.location.coordinates)
          ? { lat: school.location.coordinates[1], lng: school.location.coordinates[0] }
          : undefined,
        logoUrl: school.logoUrl,
        phone: school.phone,
      },
      drivers: drivers.map((d) => ({ id: String(d._id), busNumber: d.busNumber, name: d.name, phone: d.phone })),
      students: students.map((u) => ({ id: String(u._id), name: u.name, phone: u.phone, class: u.class, section: u.section, busNumber: u.busNumber, gender: u.gender, fatherName: u.fatherName })),
    });
  } else {
    const { readDb } = require('../config/db');
    const db = readDb();
    const school = (db.schools || []).find((s) => String(s.id) === String(schoolId));
    if (!school) return res.status(404).json({ error: 'School not found' });
    const drivers = (db.drivers || []).filter((d) => String(d.schoolId) === String(schoolId));
    const students = (db.users || []).filter((u) => String(u.schoolId) === String(schoolId));
    return res.json({
      school: {
        id: school.id,
        schoolName: school.schoolName,
        schoolAddress: school.schoolAddress,
        coordinates: school.coordinates,
        logoUrl: school.logoUrl,
        phone: school.phone,
      },
      drivers: drivers.map((d) => ({ id: d.id, busNumber: d.busNumber, name: d.name, phone: d.phone })),
      students: students.map((u) => ({ id: u.id, name: u.name, phone: u.phone, class: u.class, section: u.section, busNumber: u.busNumber, gender: u.gender, fatherName: u.fatherName })),
    });
  }
}

module.exports.schoolOverview = schoolOverview;

// Public: Overview by schoolId (no token)
async function schoolOverviewById(req, res) {
  const schoolId = req.params.schoolId;
  if (!schoolId) return res.status(400).json({ error: 'schoolId required' });

  if (process.env.MONGODB_URI && MSchool) {
    const school = await MSchool.findById(schoolId).lean();
    if (!school) return res.status(404).json({ error: 'School not found' });
    let drivers = [];
    let students = [];
    if (MDriver) drivers = await MDriver.find({ schoolId }, 'busNumber name phone').lean();
    if (MUser) students = await MUser.find({ schoolId }, 'name phone class section busNumber gender fatherName').lean();
    return res.json({
      school: {
        id: String(school._id),
        schoolName: school.schoolName,
        schoolAddress: school.schoolAddress,
        coordinates: school.location && Array.isArray(school.location.coordinates)
          ? { lat: school.location.coordinates[1], lng: school.location.coordinates[0] }
          : undefined,
        logoUrl: school.logoUrl,
        phone: school.phone,
      },
      drivers: drivers.map((d) => ({ id: String(d._id), busNumber: d.busNumber, name: d.name, phone: d.phone })),
      students: students.map((u) => ({ id: String(u._id), name: u.name, phone: u.phone, class: u.class, section: u.section, busNumber: u.busNumber, gender: u.gender, fatherName: u.fatherName })),
    });
  } else {
    const { readDb } = require('../config/db');
    const db = readDb();
    const school = (db.schools || []).find((s) => String(s.id) === String(schoolId));
    if (!school) return res.status(404).json({ error: 'School not found' });
    const drivers = (db.drivers || []).filter((d) => String(d.schoolId) === String(schoolId));
    const students = (db.users || []).filter((u) => String(u.schoolId) === String(schoolId));
    return res.json({
      school: {
        id: school.id,
        schoolName: school.schoolName,
        schoolAddress: school.schoolAddress,
        coordinates: school.coordinates,
        logoUrl: school.logoUrl,
        phone: school.phone,
      },
      drivers: drivers.map((d) => ({ id: d.id, busNumber: d.busNumber, name: d.name, phone: d.phone })),
      students: students.map((u) => ({ id: u.id, name: u.name, phone: u.phone, class: u.class, section: u.section, busNumber: u.busNumber, gender: u.gender, fatherName: u.fatherName })),
    });
  }
}

module.exports.schoolOverviewById = schoolOverviewById;

// Public: count students under a particular bus for a given school
async function countStudentsByBusPublic(req, res) {
  const { schoolId, busNumber } = req.params;
  if (!schoolId || !busNumber) return res.status(400).json({ error: 'schoolId and busNumber required' });

  if (process.env.MONGODB_URI && MUser) {
    try {
      const count = await MUser.countDocuments({ schoolId, busNumber });
      return res.json({ schoolId: String(schoolId), busNumber: String(busNumber), count });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to count students' });
    }
  } else {
    const { readDb } = require('../config/db');
    const db = readDb();
    const count = (db.users || []).filter((u) => String(u.schoolId) === String(schoolId) && String(u.busNumber) === String(busNumber)).length;
    return res.json({ schoolId: String(schoolId), busNumber: String(busNumber), count });
  }
}

module.exports.countStudentsByBusPublic = countStudentsByBusPublic;

// Public: count students by bus using schoolName (no token)
async function countStudentsByBusBySchoolName(req, res) {
  const { schoolName, busNumber } = req.params;
  if (!schoolName || !busNumber) return res.status(400).json({ error: 'schoolName and busNumber required' });

  if (process.env.MONGODB_URI && MSchool && MUser) {
    // Case-insensitive exact match on schoolName
    const school = await MSchool.findOne({ schoolName: new RegExp(`^${schoolName}$`, 'i') }).lean();
    if (!school) return res.status(404).json({ error: 'School not found' });
    const count = await MUser.countDocuments({ schoolId: school._id, busNumber });
    return res.json({ schoolId: String(school._id), schoolName: school.schoolName, busNumber: String(busNumber), count });
  } else {
    const { readDb } = require('../config/db');
    const db = readDb();
    const school = (db.schools || []).find((s) => String(s.schoolName).toLowerCase() === String(schoolName).toLowerCase());
    if (!school) return res.status(404).json({ error: 'School not found' });
    const count = (db.users || []).filter((u) => String(u.schoolId) === String(school.id) && String(u.busNumber) === String(busNumber)).length;
    return res.json({ schoolId: String(school.id), schoolName: school.schoolName, busNumber: String(busNumber), count });
  }
}

module.exports.countStudentsByBusBySchoolName = countStudentsByBusBySchoolName;

// Public: get total buses and number of students under each bus by schoolName
async function busStatsBySchoolName(req, res) {
  const { schoolName } = req.params;
  if (!schoolName) return res.status(400).json({ error: 'schoolName required' });

  if (process.env.MONGODB_URI && MSchool) {
    // Find school by name (case-insensitive)
    const school = await MSchool.findOne({ schoolName: new RegExp(`^${schoolName}$`, 'i') }).lean();
    if (!school) return res.status(404).json({ error: 'School not found' });

    let busNumbers = [];
    if (typeof MDriver !== 'undefined' && MDriver) {
      const drivers = await MDriver.find({ schoolId: school._id }, 'busNumber').lean();
      const set = new Set(drivers.map((d) => d.busNumber));
      busNumbers = Array.from(set);
    }

    // Fallback: derive from students' bus numbers if no drivers
    if ((!busNumbers || busNumbers.length === 0) && typeof MUser !== 'undefined' && MUser) {
      const agg = await MUser.aggregate([
        { $match: { schoolId: school._id } },
        { $group: { _id: '$busNumber', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);
      const perBus = agg.map((a) => ({ busNumber: a._id, students: a.count }));
      return res.json({
        school: { id: String(school._id), schoolName: school.schoolName },
        totalBuses: perBus.length,
        buses: perBus,
      });
    }

    if (typeof MUser !== 'undefined' && MUser) {
      const counts = await Promise.all(
        busNumbers.map(async (bus) => {
          const c = await MUser.countDocuments({ schoolId: school._id, busNumber: bus });
          return { busNumber: bus, students: c };
        })
      );
      return res.json({
        school: { id: String(school._id), schoolName: school.schoolName },
        totalBuses: busNumbers.length,
        buses: counts.sort((a, b) => ('' + a.busNumber).localeCompare('' + b.busNumber)),
      });
    }

    return res.json({
      school: { id: String(school._id), schoolName: school.schoolName },
      totalBuses: busNumbers.length,
      buses: busNumbers.map((b) => ({ busNumber: b, students: 0 })),
    });
  } else {
    const { readDb } = require('../config/db');
    const db = readDb();
    const schools = db.schools || [];
    const drivers = db.drivers || [];
    const users = db.users || [];
    const school = schools.find((s) => String(s.schoolName).toLowerCase() === String(schoolName).toLowerCase());
    if (!school) return res.status(404).json({ error: 'School not found' });

    let busNumbers = Array.from(new Set(drivers.filter((d) => String(d.schoolId) === String(school.id)).map((d) => d.busNumber)));
    if (busNumbers.length === 0) {
      busNumbers = Array.from(new Set(users.filter((u) => String(u.schoolId) === String(school.id)).map((u) => u.busNumber)));
    }
    const counts = busNumbers
      .map((bus) => ({
        busNumber: bus,
        students: users.filter((u) => String(u.schoolId) === String(school.id) && String(u.busNumber) === String(bus)).length,
      }))
      .sort((a, b) => ('' + a.busNumber).localeCompare('' + b.busNumber));

    return res.json({
      school: { id: String(school.id), schoolName: school.schoolName },
      totalBuses: busNumbers.length,
      buses: counts,
    });
  }
}

module.exports.busStatsBySchoolName = busStatsBySchoolName;
