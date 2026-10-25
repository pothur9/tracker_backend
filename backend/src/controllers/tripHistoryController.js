let MTripHistory;
try {
  MTripHistory = require('../models/mongoose/TripHistory');
} catch {}
let MDriver;
try {
  MDriver = require('../models/mongoose/Driver');
} catch {}

// Get all trips for the authenticated driver
async function getDriverTrips(req, res) {
  try {
    if (!MTripHistory) {
      return res.status(503).json({ error: 'Trip history not available' });
    }

    const { id } = req.user; // driver id
    const { limit = 50, skip = 0 } = req.query;

    const trips = await MTripHistory.find({ driverId: id })
      .sort({ startTime: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .select('-locations') // Exclude locations array for list view (can be large)
      .lean();

    const total = await MTripHistory.countDocuments({ driverId: id });

    return res.json({
      trips,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
    });
  } catch (e) {
    console.error('[TripHistory] Error getting driver trips:', e);
    return res.status(500).json({ error: 'Failed to get trip history' });
  }
}

// Get a specific trip with all locations (for viewing on map)
async function getTripById(req, res) {
  try {
    if (!MTripHistory) {
      return res.status(503).json({ error: 'Trip history not available' });
    }

    const { id } = req.user; // driver id
    const { tripId } = req.params;

    const trip = await MTripHistory.findOne({
      _id: tripId,
      driverId: id, // Ensure driver can only access their own trips
    }).lean();

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    return res.json({ trip });
  } catch (e) {
    console.error('[TripHistory] Error getting trip:', e);
    return res.status(500).json({ error: 'Failed to get trip' });
  }
}

// Get trips by bus number (public endpoint for viewing on map)
async function getTripsByBusNumber(req, res) {
  try {
    if (!MTripHistory) {
      return res.status(503).json({ error: 'Trip history not available' });
    }

    const { busNumber } = req.query;
    if (!busNumber || typeof busNumber !== 'string') {
      return res.status(400).json({ error: 'busNumber is required' });
    }

    const { limit = 50, skip = 0, includeLocations = false } = req.query;

    const query = MTripHistory.find({ busNumber, status: 'completed' })
      .sort({ startTime: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    // Optionally exclude locations to reduce payload size
    if (includeLocations !== 'true') {
      query.select('-locations');
    }

    const trips = await query.lean();
    const total = await MTripHistory.countDocuments({ busNumber, status: 'completed' });

    return res.json({
      trips,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
    });
  } catch (e) {
    console.error('[TripHistory] Error getting trips by bus number:', e);
    return res.status(500).json({ error: 'Failed to get trips' });
  }
}

// Get a specific trip by tripId with all locations (public endpoint for map viewing)
async function getTripByIdPublic(req, res) {
  try {
    if (!MTripHistory) {
      return res.status(503).json({ error: 'Trip history not available' });
    }

    const { tripId } = req.params;

    const trip = await MTripHistory.findOne({
      _id: tripId,
      status: 'completed', // Only allow viewing completed trips
    }).lean();

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    return res.json({ trip });
  } catch (e) {
    console.error('[TripHistory] Error getting trip:', e);
    return res.status(500).json({ error: 'Failed to get trip' });
  }
}

// Get latest path (trip) per driver for a school (active trips preferred)
async function getDriversPathsBySchoolName(req, res) {
  try {
    if (!MTripHistory || !MDriver) {
      return res.status(503).json({ error: 'Trip history not available' });
    }

    const { schoolName, includeLocations = 'true' } = req.query;
    if (!schoolName || typeof schoolName !== 'string') {
      return res.status(400).json({ error: 'schoolName is required' });
    }

    // Case-insensitive exact match on schoolName
    const regex = new RegExp(`^${schoolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const driverIds = await MDriver.find({ schoolName: regex }).distinct('_id');
    if (!driverIds || driverIds.length === 0) {
      return res.json({ trips: [], total: 0 });
    }

    const pipeline = [
      { $match: { driverId: { $in: driverIds } } },
      { $addFields: { statusWeight: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } } },
      { $sort: { statusWeight: -1, startTime: -1 } },
      { $group: { _id: '$driverId', trip: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$trip' } },
      // Join driver and school info
      { $lookup: { from: 'drivers', localField: 'driverId', foreignField: '_id', as: 'driver' } },
      { $unwind: { path: '$driver', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'schools', localField: 'driver.schoolId', foreignField: '_id', as: 'school' } },
      { $unwind: { path: '$school', preserveNullAndEmptyArrays: true } },
      { $project: Object.assign(
        {
          driverId: 1,
          busNumber: 1,
          startTime: 1,
          endTime: 1,
          status: 1,
          startLocation: 1,
          endLocation: 1,
          createdAt: 1,
          updatedAt: 1,
          driver: {
            _id: '$driver._id',
            name: '$driver.name',
            phone: '$driver.phone',
            busNumber: '$driver.busNumber',
            schoolName: '$driver.schoolName',
            schoolId: '$driver.schoolId',
          },
          school: {
            _id: '$school._id',
            schoolName: '$school.schoolName',
            schoolAddress: '$school.schoolAddress',
            location: '$school.location',
            phone: '$school.phone',
            logoUrl: '$school.logoUrl',
          },
        },
        includeLocations === 'true' ? { locations: 1 } : {}
      ) },
    ];

    const trips = await MTripHistory.aggregate(pipeline);
    return res.json({ trips, total: trips.length });
  } catch (e) {
    console.error('[TripHistory] Error getting drivers paths by school:', e);
    return res.status(500).json({ error: 'Failed to get drivers paths' });
  }
}

// Get full trip history for all drivers in a school (paginated)
async function getSchoolTripsBySchoolName(req, res) {
  try {
    if (!MTripHistory || !MDriver) {
      return res.status(503).json({ error: 'Trip history not available' });
    }

    const { schoolName, status = 'all', limit = 50, skip = 0, includeLocations = 'false' } = req.query;
    if (!schoolName || typeof schoolName !== 'string') {
      return res.status(400).json({ error: 'schoolName is required' });
    }

    const regex = new RegExp(`^${schoolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const driverIds = await MDriver.find({ schoolName: regex }).distinct('_id');
    if (!driverIds || driverIds.length === 0) {
      return res.json({ trips: [], total: 0, limit: parseInt(limit), skip: parseInt(skip) });
    }

    const filter = { driverId: { $in: driverIds } };
    if (status === 'active') filter.status = 'active';
    else if (status === 'completed') filter.status = 'completed';

    const projFields = Object.assign(
      {
        driverId: 1,
        busNumber: 1,
        startTime: 1,
        endTime: 1,
        status: 1,
        startLocation: 1,
        endLocation: 1,
        createdAt: 1,
        updatedAt: 1,
        driver: {
          _id: '$driver._id',
          name: '$driver.name',
          phone: '$driver.phone',
          busNumber: '$driver.busNumber',
          schoolName: '$driver.schoolName',
          schoolId: '$driver.schoolId',
        },
        school: {
          _id: '$school._id',
          schoolName: '$school.schoolName',
          schoolAddress: '$school.schoolAddress',
          location: '$school.location',
          phone: '$school.phone',
          logoUrl: '$school.logoUrl',
        },
      },
      includeLocations === 'true' ? { locations: 1 } : {}
    );

    const trips = await MTripHistory.aggregate([
      { $match: filter },
      { $sort: { startTime: -1 } },
      { $skip: parseInt(skip) },
      { $limit: parseInt(limit) },
      { $lookup: { from: 'drivers', localField: 'driverId', foreignField: '_id', as: 'driver' } },
      { $unwind: { path: '$driver', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'schools', localField: 'driver.schoolId', foreignField: '_id', as: 'school' } },
      { $unwind: { path: '$school', preserveNullAndEmptyArrays: true } },
      { $project: projFields },
    ]);

    const total = await MTripHistory.countDocuments(filter);

    return res.json({ trips, total, limit: parseInt(limit), skip: parseInt(skip) });
  } catch (e) {
    console.error('[TripHistory] Error getting school trips history:', e);
    return res.status(500).json({ error: 'Failed to get school trips history' });
  }
}

// Admin: Get driver route history for a specific date
async function getDriverRouteHistoryByDate(req, res) {
  try {
    if (!MTripHistory || !MDriver) {
      return res.status(503).json({ error: 'Trip history not available' });
    }

    const { driverId } = req.params;
    const { date } = req.query; // Expected format: YYYY-MM-DD

    if (!driverId) {
      return res.status(400).json({ error: 'driverId is required' });
    }

    // Get driver info
    const driver = await MDriver.findById(driverId).lean();
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Build date filter
    let dateFilter = {};
    if (date) {
      // Parse date and create start/end of day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      dateFilter = {
        startTime: { $gte: startOfDay, $lte: endOfDay }
      };
    }

    // Query trips for this driver on the specified date
    const trips = await MTripHistory.find({
      driverId: driverId,
      ...dateFilter
    })
      .sort({ startTime: -1 })
      .lean();

    // Calculate summary statistics
    const summary = {
      totalTrips: trips.length,
      totalLocations: trips.reduce((sum, trip) => sum + (trip.locations?.length || 0), 0),
      completedTrips: trips.filter(t => t.status === 'completed').length,
      activeTrips: trips.filter(t => t.status === 'active').length,
    };

    return res.json({
      driver: {
        _id: driver._id,
        name: driver.name,
        phone: driver.phone,
        busNumber: driver.busNumber,
        schoolName: driver.schoolName,
      },
      date: date || 'all',
      trips,
      summary
    });
  } catch (e) {
    console.error('[TripHistory] Error getting driver route history by date:', e);
    return res.status(500).json({ error: 'Failed to get driver route history' });
  }
}

// Admin: Get all drivers route history for a school on a specific date
async function getSchoolRouteHistoryByDate(req, res) {
  try {
    if (!MTripHistory || !MDriver) {
      return res.status(503).json({ error: 'Trip history not available' });
    }

    const { schoolId } = req.params;
    const { date } = req.query; // Expected format: YYYY-MM-DD

    if (!schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }

    // Get all drivers for this school
    const drivers = await MDriver.find({ schoolId }).lean();
    if (!drivers || drivers.length === 0) {
      return res.json({ drivers: [], date: date || 'all', trips: [], summary: { totalTrips: 0, totalLocations: 0 } });
    }

    const driverIds = drivers.map(d => d._id);

    // Build date filter
    let dateFilter = {};
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      dateFilter = {
        startTime: { $gte: startOfDay, $lte: endOfDay }
      };
    }

    // Query trips for all drivers on the specified date
    const trips = await MTripHistory.find({
      driverId: { $in: driverIds },
      ...dateFilter
    })
      .sort({ startTime: -1 })
      .lean();

    // Group trips by driver
    const tripsByDriver = {};
    for (const driver of drivers) {
      tripsByDriver[driver._id.toString()] = {
        driver: {
          _id: driver._id,
          name: driver.name,
          phone: driver.phone,
          busNumber: driver.busNumber,
        },
        trips: []
      };
    }

    for (const trip of trips) {
      const dId = trip.driverId.toString();
      if (tripsByDriver[dId]) {
        tripsByDriver[dId].trips.push(trip);
      }
    }

    // Calculate summary
    const summary = {
      totalDrivers: drivers.length,
      driversWithTrips: Object.values(tripsByDriver).filter(d => d.trips.length > 0).length,
      totalTrips: trips.length,
      totalLocations: trips.reduce((sum, trip) => sum + (trip.locations?.length || 0), 0),
    };

    return res.json({
      date: date || 'all',
      drivers: Object.values(tripsByDriver),
      summary
    });
  } catch (e) {
    console.error('[TripHistory] Error getting school route history by date:', e);
    return res.status(500).json({ error: 'Failed to get school route history' });
  }
}

module.exports = {
  getDriverTrips,
  getTripById,
  getTripsByBusNumber,
  getTripByIdPublic,
  getDriversPathsBySchoolName,
  getSchoolTripsBySchoolName,
  getDriverRouteHistoryByDate,
  getSchoolRouteHistoryByDate,
};

