const Driver = require('../models/mongoose/Driver')
const auth = require('../middleware/auth')
let MUser
try {
  MUser = require('../models/mongoose/User')
} catch {}
const { sendToTokens } = require('../services/push')

async function getSharingStatus(req, res) {
  try {
    const { id } = req.user
    const driver = await Driver.findById(id).lean()
    if (!driver) return res.status(404).json({ error: 'Driver not found' })
    return res.json({ isSharing: !!driver.isSharingLocation })
  } catch (e) {
    return res.status(500).json({ error: 'Failed to get sharing status' })
  }
}

async function setSharingStatus(req, res) {
  try {
    const { id } = req.user
    const { isSharing } = req.body
    if (typeof isSharing !== 'boolean') return res.status(400).json({ error: 'isSharing must be boolean' })
    const before = await Driver.findById(id)
    if (!before) return res.status(404).json({ error: 'Driver not found' })
    const wasSharing = !!before.isSharingLocation

    before.isSharingLocation = isSharing
    await before.save()
    const driver = before.toObject()

    // If transitioning from OFF -> ON, send a "bus started" message to students at first stop
    if (!wasSharing && isSharing && MUser) {
      try {
        const query = {
          busNumber: driver.busNumber,
          fcmToken: { $exists: true, $ne: null },
          role: 'user',
          stopIndex: 0,
        }
        if (driver.schoolId) {
          query.schoolId = driver.schoolId
        } else if (driver.schoolName) {
          query.schoolName = driver.schoolName
        }
        const students = await MUser.find(query, 'fcmToken').lean()
        const tokens = (students || []).map(s => s.fcmToken).filter(Boolean)
        console.log('[push] bus_started (setSharingStatus): tokens found =', tokens.length)
        if (tokens.length) {
          const result = await sendToTokens({
            title: `Bus ${driver.busNumber} has started`,
            body: `Your bus has started from the first stop.`,
            data: {
              busNumber: driver.busNumber,
              schoolId: String(driver.schoolId || ''),
              event: 'bus_started',
              startStopIndex: '0',
            },
            tokens,
          })
          console.log('[push] bus_started (setSharingStatus): success sent =', result?.success)
        }
      } catch (e) {
        // non-fatal
      }
    }

    return res.json({ ok: true, isSharing: !!driver.isSharingLocation })
  } catch (e) {
    return res.status(500).json({ error: 'Failed to set sharing status' })
  }
}

// Add a stop to the driver's route
async function addStop(req, res) {
  try {
    const { id } = req.user
    const { lat, lng, name, order } = req.body
    if (typeof lat !== 'number' || typeof lng !== 'number') return res.status(400).json({ error: 'lat,lng required' })
    const driver = await Driver.findById(id)
    if (!driver) return res.status(404).json({ error: 'Driver not found' })
    const nextOrder = Number.isInteger(order) ? order : (Array.isArray(driver.stops) ? driver.stops.length : 0)
    const stop = { lat, lng, name, order: nextOrder }
    driver.stops = [...(driver.stops || []), stop]
    // keep stops sorted by order
    driver.stops.sort((a, b) => a.order - b.order)
    await driver.save()
    return res.status(201).json({ ok: true, stop })
  } catch (e) {
    return res.status(500).json({ error: 'Failed to add stop' })
  }
}

// List stops
async function listStops(req, res) {
  try {
    const { id } = req.user
    const driver = await Driver.findById(id).lean()
    if (!driver) return res.status(404).json({ error: 'Driver not found' })
    const stops = (driver.stops || []).slice().sort((a, b) => a.order - b.order)
    return res.json({ stops, currentStopIndex: driver.currentStopIndex ?? -1 })
  } catch (e) {
    return res.status(500).json({ error: 'Failed to list stops' })
  }
}

// Mark arrival at a stop and notify next two stops' users
async function arriveAtStop(req, res) {
  try {
    const { id } = req.user
    const { stopIndex } = req.body // 0-based index along route
    if (!Number.isInteger(stopIndex)) return res.status(400).json({ error: 'stopIndex must be integer' })
    const driver = await Driver.findById(id)
    if (!driver) return res.status(404).json({ error: 'Driver not found' })
    const stops = driver.stops || []
    if (stopIndex < 0 || stopIndex >= stops.length) return res.status(400).json({ error: 'Invalid stopIndex' })
    if (driver.currentStopIndex != null && stopIndex < driver.currentStopIndex) {
      return res.status(400).json({ error: 'Cannot move backwards' })
    }
    driver.currentStopIndex = stopIndex
    await driver.save()

    // If the driver reached the first stop, broadcast "bus started" to all students under this school & driver
    if (stopIndex === 0 && MUser) {
      try {
        const query = {
          busNumber: driver.busNumber,
          fcmToken: { $exists: true, $ne: null },
          role: 'user',
        }
        if (driver.schoolId) {
          query.schoolId = driver.schoolId
        } else if (driver.schoolName) {
          query.schoolName = driver.schoolName
        }
        const students = await MUser.find(query, 'fcmToken').lean()
        const tokens = (students || []).map(s => s.fcmToken).filter(Boolean)
        if (tokens.length) {
          await sendToTokens({
            title: `Bus ${driver.busNumber} has started`,
            body: `Your bus has started from the first stop.`,
            data: {
              busNumber: driver.busNumber,
              schoolId: String(driver.schoolId || ''),
              event: 'bus_started',
              startStopIndex: '0',
            },
            tokens,
          })
        }
      } catch (e) {
        // Non-fatal: continue
      }
    }

    // Notify users for next two stops (stopIndex+1 and stopIndex+2)
    if (MUser) {
      const targetIndexes = [stopIndex + 1, stopIndex + 2]
      const users = await MUser.find({
        busNumber: driver.busNumber,
        stopIndex: { $in: targetIndexes },
        fcmToken: { $exists: true, $ne: null },
      }, 'fcmToken stopIndex name').lean()
      const tokens = users.map(u => u.fcmToken).filter(Boolean)
      console.log('[push] on_the_way (arriveAtStop): tokens found =', tokens.length)
      if (tokens.length) {
        const stop = stops[stopIndex]
        const result = await sendToTokens({
          title: `Bus ${driver.busNumber} is on the way`,
          body: `Bus reached stop #${stopIndex + 1}${stop?.name ? ' (' + stop.name + ')' : ''}. Get ready!`,
          data: {
            busNumber: driver.busNumber,
            reachedStopIndex: String(stopIndex),
          },
          tokens,
        })
        console.log('[push] on_the_way (arriveAtStop): success sent =', result?.success)
      }
    }

    return res.json({ ok: true, currentStopIndex: driver.currentStopIndex })
  } catch (e) {
    return res.status(500).json({ error: 'Failed to mark arrival' })
  }
}

// Public: list stops for a given bus number (students use this)
async function listStopsByBusNumber(req, res) {
  try {
    const { busNumber } = req.query
    if (!busNumber || typeof busNumber !== 'string') {
      return res.status(400).json({ error: 'busNumber is required' })
    }
    const driver = await Driver.findOne({ busNumber }).lean()
    if (!driver) return res.status(404).json({ error: 'Driver not found' })
    // Only expose when driver is sharing
    if (!driver.isSharingLocation) return res.status(403).json({ error: 'Driver is offline' })
    const stops = (driver.stops || []).slice().sort((a, b) => a.order - b.order)
    return res.json({ stops, currentStopIndex: driver.currentStopIndex ?? -1 })
  } catch (e) {
    return res.status(500).json({ error: 'Failed to list stops' })
  }
}

module.exports = { getSharingStatus, setSharingStatus }
module.exports.addStop = addStop
module.exports.listStops = listStops
module.exports.arriveAtStop = arriveAtStop
module.exports.listStopsByBusNumber = listStopsByBusNumber

