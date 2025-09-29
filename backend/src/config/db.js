const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');
const config = require('./env');

const DB_PATH = path.resolve(process.cwd(), config.dbPath);
const DB_DIR = path.dirname(DB_PATH);

function ensureDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const initial = { users: [], drivers: [], schools: [], otps: [], locations: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
  }
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// Helpers
function create(collection, item) {
  const db = readDb();
  const id = item.id || nanoid();
  db[collection].push({ ...item, id });
  writeDb(db);
  return { ...item, id };
}

function update(collection, predicate, updater) {
  const db = readDb();
  const list = db[collection];
  const idx = list.findIndex(predicate);
  if (idx === -1) return null;
  const updated = { ...list[idx], ...updater(list[idx]) };
  list[idx] = updated;
  writeDb(db);
  return updated;
}

function find(collection, predicate) {
  const db = readDb();
  return db[collection].find(predicate) || null;
}

function filter(collection, predicate) {
  const db = readDb();
  return db[collection].filter(predicate);
}

function upsert(collection, predicate, item) {
  const found = find(collection, predicate);
  if (found) {
    return update(collection, predicate, () => item);
  }
  return create(collection, item);
}

module.exports = {
  readDb,
  writeDb,
  create,
  update,
  find,
  filter,
  upsert,
};
