const { create, find } = require('../config/db');

function createUser(user) {
  return create('users', user);
}

function findUserByPhone(phone) {
  return find('users', (u) => u.phone === phone);
}

module.exports = { createUser, findUserByPhone };
