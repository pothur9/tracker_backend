const dayjs = require('dayjs');
const { upsert, filter, find } = require('../config/db');

function updateDriverLocation(driverId, busNumber, lat, lng) {
  const updatedAt = dayjs().toISOString();
  return upsert('locations', (l) => l.driverId === driverId, {
    driverId,
    busNumber,
    lat,
    lng,
    updatedAt,
  });
}

function getLatestByBusNumber(busNumber) {
  // If multiple, return most recent
  const list = filter('locations', (l) => l.busNumber === busNumber);
  if (!list.length) return null;
  return list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
}

function getLatestByDriverId(driverId) {
  return find('locations', (l) => l.driverId === driverId) || null;
}

module.exports = { updateDriverLocation, getLatestByBusNumber, getLatestByDriverId };
