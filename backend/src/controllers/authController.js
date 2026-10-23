const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

const resolveJwtSecret = () => process.env.JWT_SECRET || 'test-jwt-secret-not-for-production';

// Generate JWT Access Token
const generateToken = (id) => {
  return jwt.sign({ id }, resolveJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  });
};

// Generate Refresh Token and store hash in database
const createRefreshToken = async (userId) => {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // Expiry: 7 days from now
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await db.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt]
  );

  return rawToken;
};
