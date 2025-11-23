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

module.exports = {
  getDriverTrips,
  getTripById,
  getTripsByBusNumber,
  getTripByIdPublic,
  getDriversPathsBySchoolName,
  getSchoolTripsBySchoolName,
};

