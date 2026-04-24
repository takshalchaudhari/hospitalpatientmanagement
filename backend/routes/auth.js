const express = require('express');
const bcrypt = require('bcrypt');
const { all, get, run } = require('../db');
const config = require('../config');
const { auditLog } = require('../lib/audit');
const { createAccessToken, randomToken, hashToken, cookieOptions } = require('../lib/security');
const { authMiddleware, requireCsrf } = require('../middleware/auth');
const { ensurePasswordPolicy, badRequest } = require('../lib/validation');

const router = express.Router();

function sessionExpiry() {
  return new Date(Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
}

function serializeUser(user) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    status: user.status,
    mustChangePassword: Boolean(user.must_change_password),
    lastLoginAt: user.last_login_at
  };
}

async function createSession(res, user, req) {
  const accessToken = createAccessToken(user);
  const refreshToken = randomToken(48);
  const csrfToken = randomToken(24);

  await run(
    `INSERT INTO refresh_sessions (user_id, token_hash, csrf_token, user_agent, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      hashToken(refreshToken),
      csrfToken,
      req.headers['user-agent'] || null,
      req.ip,
      sessionExpiry().toISOString()
    ]
  );

  res.cookie(
    config.cookieNameAccess,
    accessToken,
    cookieOptions(config.accessTokenTtlMinutes * 60 * 1000, true)
  );
  res.cookie(
    config.cookieNameRefresh,
    refreshToken,
    cookieOptions(config.refreshTokenTtlDays * 24 * 60 * 60 * 1000, true)
  );
  res.cookie(
    config.cookieNameCsrf,
    csrfToken,
    cookieOptions(config.refreshTokenTtlDays * 24 * 60 * 60 * 1000, false)
  );

  return csrfToken;
}

async function revokeRefreshSession(refreshToken) {
  if (!refreshToken) {
    return;
  }
  await run(
    'UPDATE refresh_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ? AND revoked_at IS NULL',
    [hashToken(refreshToken)]
  );
}

function clearAuthCookies(res) {
  res.clearCookie(config.cookieNameAccess, { path: '/' });
  res.clearCookie(config.cookieNameRefresh, { path: '/' });
  res.clearCookie(config.cookieNameCsrf, { path: '/' });
}

const authLimiterMemory = new Map();

function authGuard(req, res, next) {
  const key = `${req.ip}:${String(req.body?.username || '').toLowerCase()}`;
  const record = authLimiterMemory.get(key) || { count: 0, until: 0 };

  if (record.until > Date.now()) {
    return res.status(429).json({ message: 'Too many login attempts. Try again later.' });
  }

  req.authAttemptKey = key;
  return next();
}

async function failAttempt(key) {
  const existing = authLimiterMemory.get(key) || { count: 0, until: 0 };
  const count = existing.count + 1;
  const until = count >= config.authMaxAttempts
    ? Date.now() + config.authLockWindowMinutes * 60 * 1000
    : 0;
  authLimiterMemory.set(key, { count, until });
}

function clearAttempts(key) {
  authLimiterMemory.delete(key);
}

router.post('/login', authGuard, async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (!username || !password) {
      throw badRequest('Username and password are required');
    }

    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      await failAttempt(req.authAttemptKey);
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({ message: 'Your account is disabled. Contact an administrator.' });
    }

    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      return res.status(423).json({ message: 'Account temporarily locked. Try again later.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      const lockedUntil = attempts >= config.authMaxAttempts
        ? new Date(Date.now() + config.authLockWindowMinutes * 60 * 1000).toISOString()
        : null;

      await run(
        'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
        [attempts, lockedUntil, user.id]
      );
      await failAttempt(req.authAttemptKey);
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    await run(
      `UPDATE users
       SET failed_login_attempts = 0, locked_until = NULL, last_login_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [user.id]
    );
    clearAttempts(req.authAttemptKey);

    const refreshedUser = await get('SELECT * FROM users WHERE id = ?', [user.id]);
    await createSession(res, refreshedUser, req);
    await auditLog({
      actorUserId: user.id,
      action: 'auth.login',
      targetType: 'user',
      targetId: String(user.id),
      ipAddress: req.ip
    });

    return res.json({
      user: serializeUser(refreshedUser)
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Unable to sign in' });
  }
});

router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.[config.cookieNameRefresh];
  if (!refreshToken) {
    clearAuthCookies(res);
    return res.status(401).json({ message: 'Refresh token missing' });
  }

  const session = await get(
    `SELECT rs.*, u.username, u.full_name, u.email, u.role, u.status, u.must_change_password, u.last_login_at
     FROM refresh_sessions rs
     JOIN users u ON u.id = rs.user_id
     WHERE rs.token_hash = ? AND rs.revoked_at IS NULL`,
    [hashToken(refreshToken)]
  );

  if (!session || new Date(session.expires_at).getTime() < Date.now() || session.status === 'disabled') {
    clearAuthCookies(res);
    return res.status(401).json({ message: 'Refresh token invalid' });
  }

  await run('UPDATE refresh_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?', [session.id]);
  const user = {
    id: session.user_id,
    username: session.username,
    full_name: session.full_name,
    email: session.email,
    role: session.role,
    status: session.status,
    must_change_password: session.must_change_password,
    last_login_at: session.last_login_at
  };
  await createSession(res, user, req);
  return res.json({ user: serializeUser(user) });
});

router.post('/logout', async (req, res) => {
  await revokeRefreshSession(req.cookies?.[config.cookieNameRefresh]);
  clearAuthCookies(res);
  return res.json({ message: 'Signed out' });
});

router.post('/logout-all', authMiddleware, requireCsrf, async (req, res) => {
  await run('UPDATE refresh_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL', [req.user.id]);
  clearAuthCookies(res);
  await auditLog({
    actorUserId: req.user.id,
    action: 'auth.logout_all',
    targetType: 'user',
    targetId: String(req.user.id),
    ipAddress: req.ip
  });
  return res.json({ message: 'All sessions revoked' });
});

router.get('/me', authMiddleware, async (req, res) => {
  const user = await get(
    'SELECT id, username, full_name, email, role, status, must_change_password, last_login_at FROM users WHERE id = ?',
    [req.user.id]
  );
  return res.json({ user: serializeUser(user) });
});

router.post('/change-password', authMiddleware, requireCsrf, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const nextPassword = String(req.body?.nextPassword || '');
    if (!currentPassword || !nextPassword) {
      throw badRequest('Current password and new password are required');
    }
    ensurePasswordPolicy(nextPassword);

    const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const passwordMatches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(nextPassword, config.bcryptRounds);
    await run(
      `UPDATE users
       SET password_hash = ?, must_change_password = 0, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [passwordHash, req.user.id]
    );
    await run('UPDATE refresh_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL', [req.user.id]);
    await auditLog({
      actorUserId: req.user.id,
      action: 'auth.change_password',
      targetType: 'user',
      targetId: String(req.user.id),
      ipAddress: req.ip
    });
    clearAuthCookies(res);
    return res.json({ message: 'Password updated. Please sign in again.' });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Unable to change password' });
  }
});

router.get('/sessions', authMiddleware, async (req, res) => {
  const sessions = await all(
    `SELECT id, ip_address, user_agent, expires_at, created_at
     FROM refresh_sessions
     WHERE user_id = ? AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    [req.user.id]
  );
  return res.json({ sessions });
});

module.exports = router;
