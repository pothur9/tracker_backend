const dayjs = require('dayjs');
// Fallback JSON models
const { updateDriverLocation, getLatestByBusNumber } = require('../models/locationModel');
// Optional Mongoose model
let MLocation;
try {
  MLocation = require('../models/mongoose/Location');
} catch {}

// In-memory SSE clients grouped by busNumber
const sseClients = new Map(); // busNumber => Set(res)

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
