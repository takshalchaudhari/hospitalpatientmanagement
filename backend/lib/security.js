const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function randomToken(size = 48) {
  return crypto.randomBytes(size).toString('hex');
}

function createAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      username: user.username,
      role: user.role,
      status: user.status,
      name: user.full_name
    },
    config.accessTokenSecret,
    { expiresIn: `${config.accessTokenTtlMinutes}m` }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.accessTokenSecret);
}

function cookieOptions(maxAgeMs, httpOnly) {
  return {
    httpOnly,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeMs
  };
}

module.exports = {
  hashToken,
  randomToken,
  createAccessToken,
  verifyAccessToken,
  cookieOptions
};
