const dayjs = require('dayjs');
const { updateDriverLocation, getLatestByBusNumber } = require('../models/locationModel');
let MLocation;
try {
  MLocation = require('../models/mongoose/Location');
} catch {}
let MTripHistory;
try {
  MTripHistory = require('../models/mongoose/TripHistory');
} catch {}
let MUser;
try {
  MUser = require('../models/mongoose/User');
} catch {}
let MDriver;
try {
  MDriver = require('../models/mongoose/Driver');
} catch {}
let MSchool;
try {
  MSchool = require('../models/mongoose/School');
} catch {}
const { sendToTokens } = require('../services/push');

const sseClients = new Map();

// Helper function to calculate distance between two GPS coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

function addSseClient(busNumber, res) {
  if (!sseClients.has(busNumber)) sseClients.set(busNumber, new Set());
  sseClients.get(busNumber).add(res);
}

function removeSseClient(busNumber, res) {
  const set = sseClients.get(busNumber);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) sseClients.delete(busNumber);
}

function broadcast(busNumber, payload) {
  const set = sseClients.get(busNumber);
  if (!set) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    res.write(data);
  }
}

async function driverUpdateLocation(req, res) {
  const { id } = req.user; // driver id
  const { lat, lng, busNumber } = req.body;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'lat and lng must be numbers' });
  }
  let updatedAtIso = dayjs().toISOString();
  const timestamp = new Date();
  
  if (process.env.MONGODB_URI && MLocation) {
    await MLocation.findOneAndUpdate(
      { driverId: id },
      { driverId: id, busNumber, lat, lng, updatedAtIso },
      { upsert: true }
    );
  } else {
    const record = updateDriverLocation(id, busNumber, lat, lng);
    updatedAtIso = record.updatedAt;
  }

  // Save location to active trip history
  if (MTripHistory) {
    try {
      const activeTrip = await MTripHistory.findOne({
        driverId: id,
        status: 'active',
      }).sort({ startTime: -1 });

      if (activeTrip) {
        // Add location to trip
        activeTrip.locations.push({
          lat,
          lng,
          timestamp,
        });

        // Set start location if this is the first location
        if (activeTrip.locations.length === 1) {
          activeTrip.startLocation = { lat, lng };
        }

        await activeTrip.save();

        // If this was the first location of the active trip, broadcast a start notification
        if (activeTrip.locations.length === 1 && MUser) {
          try {
            let schoolFilter = {};
            if (MDriver) {
              const driverDoc = await MDriver.findById(id).lean();
              if (driverDoc?.schoolId) schoolFilter.schoolId = driverDoc.schoolId;
              else if (driverDoc?.schoolName) schoolFilter.schoolName = driverDoc.schoolName;
            }
            const query = {
              busNumber,
              role: 'user',
              fcmTokens: { $exists: true, $ne: [] },
              ...schoolFilter,
            };
            const students = await MUser.find(query, 'fcmTokens').lean();
            const tokens = students.flatMap(s => s.fcmTokens || []).filter(Boolean);
            console.log('[push] driver_on_the_way (driverUpdateLocation:first_location): tokens found =', tokens.length);
            if (tokens.length) {
              const result = await sendToTokens({
                title: `Driver is on the way`,
                body: `Bus ${busNumber} has started the trip.`,
                data: {
                  busNumber,
                  event: 'driver_on_the_way',
                },
                tokens,
              });
              console.log('[push] driver_on_the_way (driverUpdateLocation:first_location): success sent =', result?.success);
              if (Array.isArray(result?.invalidTokens) && result.invalidTokens.length && MUser) {
                try { await MUser.updateMany({}, { $pull: { fcmTokens: { $in: result.invalidTokens } } }) } catch {}
              }
            }
          } catch (e) {
            // Non-fatal
          }
        }
      }
    } catch (e) {
      // Non-fatal error - log but don't fail the request
      console.error('[TripHistory] Error saving location to trip:', e);
    }
  }

  // Check if bus has reached school (proximity-based detection)
  if (MDriver && MSchool && MUser) {
    try {
      const driver = await MDriver.findById(id).lean();
      if (driver?.schoolId) {
        const school = await MSchool.findById(driver.schoolId).lean();
        if (school?.location?.coordinates) {
          // Calculate distance using Haversine formula
          const schoolLng = school.location.coordinates[0];
          const schoolLat = school.location.coordinates[1];
          const distance = calculateDistance(lat, lng, schoolLat, schoolLng);
          
          // If within 100 meters of school
          if (distance <= 100) {
            // Check if we already sent notification for this trip
            const activeTrip = await MTripHistory.findOne({
              driverId: id,
              status: 'active',
            }).sort({ startTime: -1 });

            if (activeTrip && !activeTrip.schoolArrivalNotificationSent) {
              // Mark as sent to avoid duplicate notifications
              activeTrip.schoolArrivalNotificationSent = true;
              await activeTrip.save();

              // Send notification
              const query = {
                busNumber,
                role: 'user',
                fcmTokens: { $exists: true, $ne: [] },
              };
              const students = await MUser.find(query, 'fcmTokens').lean();
              const tokens = students.flatMap(s => s.fcmTokens || []).filter(Boolean);
              console.log('[push] bus_reached_school (proximity): tokens found =', tokens.length);
              
              if (tokens.length) {
                const result = await sendToTokens({
                  title: `Bus has reached school`,
                  body: `Bus ${busNumber} has arrived at ${school.schoolName}.`,
                  data: {
                    busNumber,
                    schoolId: String(driver.schoolId),
                    event: 'bus_reached_school',
                  },
                  tokens,
                });
                console.log('[push] bus_reached_school (proximity): success sent =', result?.success, 'failure =', result?.failure);
                if (Array.isArray(result?.invalidTokens) && result.invalidTokens.length) {
                  try { await MUser.updateMany({}, { $pull: { fcmTokens: { $in: result.invalidTokens } } }) } catch {}
                }
              }
            }
          }
        }
      }
    } catch (e) {
      // Non-fatal
      console.error('[SchoolProximity] Error checking school proximity:', e);
    }
  }

  // Broadcast to SSE clients
  broadcast(busNumber, { lat, lng, updatedAt: updatedAtIso, busNumber });
  return res.json({ ok: true, updatedAt: updatedAtIso });
}

async function userGetLatestLocation(req, res) {
  const { busNumber } = req.query;
  if (!busNumber) return res.status(400).json({ error: 'busNumber required' });
  if (process.env.MONGODB_URI && MLocation) {
    const latest = await MLocation.findOne({ busNumber }).sort({ updatedAtIso: -1 }).lean();
    if (!latest) return res.status(404).json({ error: 'No location yet' });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ lat: latest.lat, lng: latest.lng, updatedAt: latest.updatedAtIso, busNumber: latest.busNumber });
  } else {
    const latest = getLatestByBusNumber(busNumber);
    if (!latest) return res.status(404).json({ error: 'No location yet' });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ lat: latest.lat, lng: latest.lng, updatedAt: latest.updatedAt, busNumber });
  }
}

async function userSubscribeLocationSSE(req, res) {
  const { busNumber } = req.query;
  if (!busNumber) return res.status(400).json({ error: 'busNumber required' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.write(`event: ping\n`);
  res.write(`data: ${JSON.stringify({ t: dayjs().toISOString() })}\n\n`);

  addSseClient(busNumber, res);

  req.on('close', () => {
    removeSseClient(busNumber, res);
  });
}

module.exports = { driverUpdateLocation, userGetLatestLocation, userSubscribeLocationSSE };
