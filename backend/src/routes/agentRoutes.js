const express = require('express');
const auth = require('../middleware/auth');
const { createAgent, listAgents, deleteAgent, updateAgent } = require('../controllers/agentController');
const { agentCreateValidator, agentUpdateValidator } = require('../validators/agentValidators');

const router = express.Router();

// Agent management (admin only)
router.post('/', auth('admin'), agentCreateValidator, createAgent);
router.get('/', auth('admin'), listAgents);
router.delete('/:id', auth('admin'), deleteAgent);
router.patch('/:id', auth('admin'), agentUpdateValidator, updateAgent);

module.exports = router;
