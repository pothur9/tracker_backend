const Driver = require('../models/mongoose/Driver')
const auth = require('../middleware/auth')
let MUser
try {
  MUser = require('../models/mongoose/User')
} catch {}
let MTripHistory
try {
  MTripHistory = require('../models/mongoose/TripHistory')
} catch {}
const { sendToTokens } = require('../services/push')
const dayjs = require('dayjs')

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

    // Handle trip history: create new trip when sharing starts, complete trip when sharing stops
    if (MTripHistory) {
      if (!wasSharing && isSharing) {
        // Starting a new trip - create trip record
        const newTrip = new MTripHistory({
          driverId: id,
          busNumber: driver.busNumber,
          startTime: new Date(),
          status: 'active',
          locations: [],
        })
        await newTrip.save()
        console.log(`[TripHistory] Created new active trip for driver ${id}, bus ${driver.busNumber}`)
      } else if (wasSharing && !isSharing) {
        // Ending trip - mark as completed
        const activeTrip = await MTripHistory.findOne({
          driverId: id,
          status: 'active',
        }).sort({ startTime: -1 })
        
        if (activeTrip) {
          activeTrip.status = 'completed'
          activeTrip.endTime = new Date()
          // Set end location if we have locations
          if (activeTrip.locations && activeTrip.locations.length > 0) {
            const lastLocation = activeTrip.locations[activeTrip.locations.length - 1]
            activeTrip.endLocation = {
              lat: lastLocation.lat,
              lng: lastLocation.lng,
            }
          }
          await activeTrip.save()
          console.log(`[TripHistory] Completed trip ${activeTrip._id} for driver ${id}`)
        }
      }
    }

    // If transitioning from OFF -> ON, send a "bus started" message to students at first stop
    if (!wasSharing && isSharing && MUser) {
      try {
        const query = {
          busNumber: driver.busNumber,
          fcmTokens: { $exists: true, $ne: [] },
          role: 'user',
        }
        const students = await MUser.find(query, 'fcmTokens').lean()
        const tokens = students.flatMap(s => s.fcmTokens || []).filter(Boolean)
        console.log('[push] driver_on_the_way (setSharingStatus): tokens found =', tokens.length)
        if (tokens.length) {
          const result = await sendToTokens({
            title: `Driver is on the way`,
            body: `Bus ${driver.busNumber} has started the trip.`,
            data: {
              busNumber: driver.busNumber,
              schoolId: String(driver.schoolId || ''),
              event: 'driver_on_the_way',
            },
            tokens,
          })
          console.log('[push] driver_on_the_way (setSharingStatus): success sent =', result?.success, 'failure =', result?.failure)
          if (Array.isArray(result?.invalidTokens) && result.invalidTokens.length && MUser) {
            try { await MUser.updateMany({}, { $pull: { fcmTokens: { $in: result.invalidTokens } } }) } catch {}
          }
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
          fcmTokens: { $exists: true, $ne: [] },
          role: 'user',
        }
        if (driver.schoolId) {
          query.schoolId = driver.schoolId
        } else if (driver.schoolName) {
          query.schoolName = driver.schoolName
        }
        const students = await MUser.find(query, 'fcmTokens').lean()
        const tokens = students.flatMap(s => s.fcmTokens || []).filter(Boolean)
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
          if (Array.isArray(result?.invalidTokens) && result.invalidTokens.length && MUser) {
            try { await MUser.updateMany({}, { $pull: { fcmTokens: { $in: result.invalidTokens } } }) } catch {}
          }
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
        fcmTokens: { $exists: true, $ne: [] },
      }, 'fcmTokens stopIndex name').lean()
      const tokens = users.flatMap(u => u.fcmTokens || []).filter(Boolean)
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
        if (Array.isArray(result?.invalidTokens) && result.invalidTokens.length && MUser) {
          try { await MUser.updateMany({}, { $pull: { fcmTokens: { $in: result.invalidTokens } } }) } catch {}
        }
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
    if (!driver.isSharingLocation) return res.status(403).json({ error: 'Driver is offline' })
    const stops = (driver.stops || []).slice().sort((a, b) => a.order - b.order)
    return res.json({ stops, currentStopIndex: driver.currentStopIndex ?? -1 })
  } catch (e) {
    return res.status(500).json({ error: 'Failed to list stops' })
  }
}

async function notifyUsersNow(req, res) {
try {
  const { id } = req.user
  const driver = await Driver.findById(id).lean()
  if (!driver) return res.status(404).json({ error: 'Driver not found' })
  if (!MUser) return res.status(400).json({ error: 'Push unavailable' })
  const query = {
    busNumber: driver.busNumber,
    fcmTokens: { $exists: true, $ne: [] },
    role: 'user',
  }
  const students = await MUser.find(query, 'fcmTokens').lean()
  const tokens = students.flatMap(s => s.fcmTokens || []).filter(Boolean)
  if (tokens.length) {
    const result = await sendToTokens({
      title: `Driver is on the way`,
      body: `Bus ${driver.busNumber} has started the trip.`,
      data: {
        busNumber: driver.busNumber,
        schoolId: String(driver.schoolId || ''),
        event: 'driver_on_the_way',
      },
      tokens,
    })
    if (Array.isArray(result?.invalidTokens) && result.invalidTokens.length && MUser) {
      try { await MUser.updateMany({}, { $pull: { fcmTokens: { $in: result.invalidTokens } } }) } catch {}
    }
    return res.json({ ok: true, sent: result?.success || 0, failure: result?.failure || 0 })
  }
  return res.json({ ok: true, sent: 0 })
} catch (e) {
  return res.status(500).json({ error: 'Failed to notify users' })
}
}

module.exports = { getSharingStatus, setSharingStatus }
module.exports.addStop = addStop
module.exports.listStops = listStops
module.exports.arriveAtStop = arriveAtStop
module.exports.listStopsByBusNumber = listStopsByBusNumber
module.exports.notifyUsersNow = notifyUsersNow
