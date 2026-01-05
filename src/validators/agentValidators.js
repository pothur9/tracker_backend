const { body } = require('express-validator');

const agentCreateValidator = [
  body('name').isString().notEmpty().withMessage('name is required'),
  body('phone').isString().trim().isLength({ min: 8 }).withMessage('phone is required (min 8 chars)'),
  body('email').optional().isEmail().withMessage('email must be valid'),
];

const agentUpdateValidator = [
  body('name').optional().isString().notEmpty(),
  body('phone').optional().isString().trim().isLength({ min: 8 }),
  body('email').optional().isEmail(),
];

module.exports = { agentCreateValidator, agentUpdateValidator };
