const { validationResult } = require('express-validator');

let MAgent;
try {
  MAgent = require('../models/mongoose/Agent');
} catch {}

// Create a new agent
async function createAgent(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  
  const { name, phone, email } = req.body;
  
  if (!MAgent) {
    return res.status(500).json({ error: 'Agent model not available' });
  }
  
  try {
    const existing = await MAgent.findOne({ phone });
    if (existing) return res.status(400).json({ error: 'Agent with this phone already exists' });
    
    const doc = await MAgent.create({ name, phone, email });
    return res.status(201).json({
      id: String(doc._id),
      name: doc.name,
      phone: doc.phone,
      email: doc.email,
      createdAt: doc.createdAt,
    });
  } catch (error) {
    console.error('[createAgent] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// List all agents
async function listAgents(req, res) {
  if (!MAgent) {
    return res.status(500).json({ error: 'Agent model not available' });
  }
  
  try {
    const docs = await MAgent.find({}).lean();
    return res.json(
      docs.map((d) => ({
        id: String(d._id),
        name: d.name,
        phone: d.phone,
        email: d.email,
        createdAt: d.createdAt,
      }))
    );
  } catch (error) {
    console.error('[listAgents] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Delete an agent by ID
async function deleteAgent(req, res) {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'id required' });
  
  if (!MAgent) {
    return res.status(500).json({ error: 'Agent model not available' });
  }
  
  try {
    const result = await MAgent.findByIdAndDelete(id);
    return res.json({ ok: !!result });
  } catch (error) {
    console.error('[deleteAgent] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Update an agent by ID
async function updateAgent(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'id required' });
  
  const { name, phone, email } = req.body;
  
  if (!MAgent) {
    return res.status(500).json({ error: 'Agent model not available' });
  }
  
  try {
    const update = {};
    if (name) update.name = name;
    if (phone) update.phone = phone;
    if (email !== undefined) update.email = email;
    
    const doc = await MAgent.findByIdAndUpdate(id, update, { new: true });
    if (!doc) return res.status(404).json({ error: 'Agent not found' });
    
    return res.json({
      id: String(doc._id),
      name: doc.name,
      phone: doc.phone,
      email: doc.email,
      updatedAt: doc.updatedAt,
    });
  } catch (error) {
    console.error('[updateAgent] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = { createAgent, listAgents, deleteAgent, updateAgent };
