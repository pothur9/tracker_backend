const { create, find } = require('../config/db');

function createDriver(driver) {
  return create('drivers', driver);
}

function findDriverByPhone(phone) {
  return find('drivers', (d) => d.phone === phone);
}

module.exports = { createDriver, findDriverByPhone };
