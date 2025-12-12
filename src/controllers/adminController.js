const { validationResult } = require('express-validator');
const config = require('../config/env');
const { signToken } = require('../utils/token');
const { hashPassword } = require('../utils/crypto');
const {
  createSchool,
  findSchoolByPhone,
  listSchools: listSchoolsModel,
  deleteSchoolById,
} = require('../models/schoolModel');

let MSchool;
try {
  MSchool = require('../models/mongoose/School');
} catch {}
let MUser;
try {
  MUser = require('../models/mongoose/User');
} catch {}
let MDriver;
try {
  MDriver = require('../models/mongoose/Driver');
} catch {}
let MLocation;
try {
  MLocation = require('../models/mongoose/Location');
} catch {}

// Admin login using env credentials
async function adminLogin(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email, password } = req.body;
  if (email !== config.adminEmail || password !== config.adminPassword) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }
  const token = signToken({ id: 'admin', role: 'admin' });
  return res.json({ token });
}

// Admin: create school (no OTP)
async function adminCreateSchool(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { schoolName, schoolAddress, coordinates, phone, password, logoUrl } = req.body;

  if (process.env.MONGODB_URI && MSchool) {
    const existing = await MSchool.findOne({ phone });
    if (existing) return res.status(400).json({ error: 'School already exists' });
    const passwordHash = await hashPassword(password);
    const doc = await MSchool.create({
      schoolName,
      schoolAddress,
      location: coordinates ? { type: 'Point', coordinates: [coordinates.lng, coordinates.lat] } : undefined,
      logoUrl,
      phone,
      passwordHash,
      role: 'school',
    });
    return res.status(201).json({
      id: String(doc._id),
      schoolName: doc.schoolName,
      schoolAddress: doc.schoolAddress,
      coordinates: coordinates || (doc.location ? { lat: doc.location.coordinates[1], lng: doc.location.coordinates[0] } : undefined),
      logoUrl: doc.logoUrl,
      phone: doc.phone,
    });
  } else {
    const existing = findSchoolByPhone(phone);
    if (existing) return res.status(400).json({ error: 'School already exists' });
    const passwordHash = await hashPassword(password);
    const school = createSchool({ schoolName, schoolAddress, coordinates, logoUrl, phone, passwordHash, role: 'school' });
    return res.status(201).json({
      id: school.id,
      schoolName: school.schoolName,
      schoolAddress: school.schoolAddress,
      coordinates: school.coordinates,
      logoUrl: school.logoUrl,
      phone: school.phone,
    });
  }
}

// Admin: list all schools
async function adminListSchools(req, res) {
  const { district } = req.query; // Support filtering by district
  
  if (process.env.MONGODB_URI && MSchool) {
    const query = district ? { district } : {};
    const docs = await MSchool.find(query, 'schoolName schoolAddress district location logoUrl phone').lean();
    return res.json(
      docs.map((d) => ({
        id: String(d._id),
        schoolName: d.schoolName,
        schoolAddress: d.schoolAddress,
        district: d.district,
        coordinates: d.location && Array.isArray(d.location.coordinates)
          ? { lat: d.location.coordinates[1], lng: d.location.coordinates[0] }
          : undefined,
        logoUrl: d.logoUrl,
        phone: d.phone,
      }))
    );
  } else {
    const list = listSchoolsModel();
    const filtered = district ? list.filter(s => s.district === district) : list;
    return res.json(filtered.map((s) => ({ id: s.id, schoolName: s.schoolName, schoolAddress: s.schoolAddress, district: s.district, coordinates: s.coordinates, logoUrl: s.logoUrl, phone: s.phone })));
  }
}

// Admin: delete a school by id
async function adminDeleteSchool(req, res) {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'id required' });

  if (process.env.MONGODB_URI && MSchool) {
    const result = await MSchool.findByIdAndDelete(id);
    return res.json({ ok: !!result });
  } else {
    const ok = deleteSchoolById(id);
    return res.json({ ok });
  }
}

// Admin: list all schools with full data
async function adminListSchoolsFull(req, res) {
  if (process.env.MONGODB_URI && MSchool) {
    const docs = await MSchool.find({}).lean();
    return res.json(
      docs.map((d) => ({
        id: String(d._id),
        schoolName: d.schoolName,
        schoolAddress: d.schoolAddress,
        coordinates: d.location && Array.isArray(d.location.coordinates)
          ? { lat: d.location.coordinates[1], lng: d.location.coordinates[0] }
          : undefined,
        logoUrl: d.logoUrl,
        phone: d.phone,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }))
    );
  } else {
    const { readDb } = require('../config/db');
    const db = readDb();
    return res.json((db.schools || []).map((s) => ({
      id: s.id,
      schoolName: s.schoolName,
      schoolAddress: s.schoolAddress,
      coordinates: s.coordinates,
      logoUrl: s.logoUrl,
      phone: s.phone,
    })));
  }
}

// Admin: update a school (exclude phone from being updated)
async function adminUpdateSchool(req, res) {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'id required' });
  const { schoolName, schoolAddress, district, coordinates, logoUrl } = req.body || {};
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'phone')) {
    return res.status(400).json({ error: 'phone cannot be updated' });
  }

  if (process.env.MONGODB_URI && MSchool) {
    const update = {};
    if (typeof schoolName === 'string') update.schoolName = schoolName;
    if (typeof schoolAddress === 'string') update.schoolAddress = schoolAddress;
    if (typeof district === 'string') update.district = district;
    if (logoUrl !== undefined) update.logoUrl = logoUrl;
    if (coordinates && typeof coordinates.lat === 'number' && typeof coordinates.lng === 'number') {
      update.location = { type: 'Point', coordinates: [coordinates.lng, coordinates.lat] };
    }
    const doc = await MSchool.findByIdAndUpdate(id, update, { new: true });
    if (!doc) return res.status(404).json({ error: 'School not found' });
    return res.json({
      id: String(doc._id),
      schoolName: doc.schoolName,
      schoolAddress: doc.schoolAddress,
      district: doc.district,
      coordinates: doc.location && Array.isArray(doc.location.coordinates)
        ? { lat: doc.location.coordinates[1], lng: doc.location.coordinates[0] }
        : undefined,
      logoUrl: doc.logoUrl,
      phone: doc.phone,
      updatedAt: doc.updatedAt,
    });
  } else {
    const { readDb, writeDb } = require('../config/db');
    const db = readDb();
    const idx = (db.schools || []).findIndex((s) => String(s.id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'School not found' });
    const prev = db.schools[idx];
    const next = { ...prev };
    if (typeof schoolName === 'string') next.schoolName = schoolName;
    if (typeof schoolAddress === 'string') next.schoolAddress = schoolAddress;
    if (logoUrl !== undefined) next.logoUrl = logoUrl;
    if (coordinates && typeof coordinates.lat === 'number' && typeof coordinates.lng === 'number') {
      next.coordinates = { lat: coordinates.lat, lng: coordinates.lng };
    }
    db.schools[idx] = next;
    writeDb(db);
    return res.json({
      id: next.id,
      schoolName: next.schoolName,
      schoolAddress: next.schoolAddress,
      coordinates: next.coordinates,
      logoUrl: next.logoUrl,
      phone: next.phone,
    });
  }
}

// Admin: count students under a particular bus for a given school
async function adminCountStudentsByBus(req, res) {
  const { id, busNumber } = req.params;
  if (!id || !busNumber) return res.status(400).json({ error: 'id and busNumber required' });

  if (process.env.MONGODB_URI && MUser) {
    const count = await MUser.countDocuments({ schoolId: id, busNumber });
    return res.json({ schoolId: id, busNumber, count });
  } else {
    const { readDb } = require('../config/db');
    const db = readDb();
    const count = (db.users || []).filter((u) => String(u.schoolId) === String(id) && String(u.busNumber) === String(busNumber)).length;
    return res.json({ schoolId: id, busNumber, count });
  }
}

// Admin: get all driver locations for a particular school
async function adminGetSchoolDriverLocations(req, res) {
  const { schoolId } = req.params;
  if (!schoolId) return res.status(400).json({ error: 'schoolId required' });

  if (process.env.MONGODB_URI && MDriver && MLocation) {
    try {
      // Find all drivers for this school
      const drivers = await MDriver.find({ schoolId }).lean();
      
      if (!drivers || drivers.length === 0) {
        return res.json({ schoolId, drivers: [] });
      }

      // Get latest location for each driver
      const driverLocations = await Promise.all(
        drivers.map(async (driver) => {
          const location = await MLocation.findOne({ driverId: String(driver._id) })
            .sort({ updatedAtIso: -1 })
            .lean();

          return {
            driverId: String(driver._id),
            name: driver.name,
            phone: driver.phone,
            busNumber: driver.busNumber,
            isSharingLocation: driver.isSharingLocation,
            currentStopIndex: driver.currentStopIndex,
            stops: driver.stops || [],
            location: location ? {
              lat: location.lat,
              lng: location.lng,
              updatedAt: location.updatedAtIso,
            } : null,
          };
        })
      );

      // Fetch school location
      const school = await MSchool.findById(schoolId).lean();
      const schoolLocation = school && school.location && Array.isArray(school.location.coordinates)
        ? { lat: school.location.coordinates[1], lng: school.location.coordinates[0] }
        : null;

      return res.json({
        schoolId,
        schoolLocation,
        drivers: driverLocations,
      });
    } catch (error) {
      console.error('[adminGetSchoolDriverLocations] Error:', error);
      return res.status(500).json({ error: 'Failed to fetch driver locations' });
    }
  } else {
    // Fallback for non-MongoDB setup
    const { readDb } = require('../config/db');
    const db = readDb();
    const drivers = (db.drivers || []).filter((d) => String(d.schoolId) === String(schoolId));
    
    const driverLocations = drivers.map((driver) => {
      const location = (db.locations || [])
        .filter((loc) => String(loc.driverId) === String(driver.id))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];

      return {
        driverId: driver.id,
        name: driver.name,
        phone: driver.phone,
        busNumber: driver.busNumber,
        isSharingLocation: driver.isSharingLocation,
        currentStopIndex: driver.currentStopIndex,
        stops: driver.stops || [],
        location: location ? {
          lat: location.lat,
          lng: location.lng,
          updatedAt: location.updatedAt,
        } : null,
      };
    });

      // Fetch school location from fallback DB
      const school = (db.schools || []).find(s => String(s.id) === String(schoolId));
      const schoolLocation = school && school.coordinates
        ? { lat: school.coordinates.lat, lng: school.coordinates.lng }
        : null;

      return res.json({
        schoolId,
        schoolLocation,
        drivers: driverLocations,
      });
  }
}

module.exports = { adminLogin, adminCreateSchool, adminListSchools, adminDeleteSchool, adminListSchoolsFull, adminUpdateSchool, adminCountStudentsByBus, adminGetSchoolDriverLocations };
