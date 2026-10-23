const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

const JWT_SECRET = () => process.env.JWT_SECRET || 'test-jwt-secret-not-for-production';

const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  });
};

const createRefreshToken = async (userId) => {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await db.query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [
    userId,
    tokenHash,
    expiresAt
  ]);

  return rawToken;
};
