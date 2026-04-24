const express = require('express');
const bcrypt = require('bcrypt');
const { all, get, run } = require('../db');
const config = require('../config');
const { authMiddleware, requireCsrf, requirePermission } = require('../middleware/auth');
const { auditLog } = require('../lib/audit');
const { ensurePasswordPolicy, ensureRole, ensureStatus, ensureRequiredFields, badRequest } = require('../lib/validation');

const router = express.Router();

router.use(authMiddleware, requireCsrf, requirePermission('users:read'));

router.get('/users', async (req, res) => {
  const users = await all(
    `SELECT id, username, full_name, email, role, status, must_change_password, last_login_at, created_at
     FROM users
     ORDER BY created_at DESC`
  );
  return res.json({ users });
});

router.post('/users', requirePermission('users:write'), async (req, res) => {
  try {
    ensureRequiredFields({
      username: req.body?.username,
      fullName: req.body?.fullName,
      password: req.body?.password,
      role: req.body?.role
    });
    ensurePasswordPolicy(req.body.password);

    const role = ensureRole(req.body.role);
    const passwordHash = await bcrypt.hash(req.body.password, config.bcryptRounds);
    const result = await run(
      `INSERT INTO users
        (username, full_name, email, password_hash, role, status, must_change_password, created_by)
       VALUES (?, ?, ?, ?, ?, 'must_change_password', 1, ?)`,
      [
        String(req.body.username).trim(),
        String(req.body.fullName).trim(),
        req.body.email ? String(req.body.email).trim() : null,
        passwordHash,
        role,
        req.user.id
      ]
    );
    const user = await get(
      'SELECT id, username, full_name, email, role, status, must_change_password, last_login_at, created_at FROM users WHERE id = ?',
      [result.lastID]
    );
    await auditLog({
      actorUserId: req.user.id,
      action: 'users.create',
      targetType: 'user',
      targetId: String(result.lastID),
      details: { username: user.username, role: user.role },
      ipAddress: req.ip
    });
    return res.status(201).json({ user });
  } catch (error) {
    const status = error.statusCode || (String(error.message).includes('UNIQUE') ? 409 : 500);
    return res.status(status).json({
      message: status === 409 ? 'Username already exists' : (error.message || 'Unable to create user')
    });
  }
});

router.patch('/users/:id', requirePermission('users:write'), async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(userId)) {
      throw badRequest('Valid user id is required');
    }

    const existing = await get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!existing) {
      return res.status(404).json({ message: 'User not found' });
    }

    const role = req.body.role ? ensureRole(req.body.role) : existing.role;
    const status = req.body.status ? ensureStatus(req.body.status) : existing.status;
    await run(
      `UPDATE users
       SET full_name = ?, email = ?, role = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        String(req.body.fullName || existing.full_name).trim(),
        req.body.email !== undefined ? (req.body.email ? String(req.body.email).trim() : null) : existing.email,
        role,
        status,
        userId
      ]
    );

    if (status === 'disabled') {
      await run('UPDATE refresh_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL', [userId]);
    }

    const user = await get(
      'SELECT id, username, full_name, email, role, status, must_change_password, last_login_at, created_at FROM users WHERE id = ?',
      [userId]
    );
    await auditLog({
      actorUserId: req.user.id,
      action: 'users.update',
      targetType: 'user',
      targetId: String(userId),
      details: { role: user.role, status: user.status },
      ipAddress: req.ip
    });
    return res.json({ user });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Unable to update user' });
  }
});

router.post('/users/:id/reset-password', requirePermission('users:write'), async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(userId)) {
      throw badRequest('Valid user id is required');
    }
    ensurePasswordPolicy(req.body?.password);
    const passwordHash = await bcrypt.hash(req.body.password, config.bcryptRounds);

    await run(
      `UPDATE users
       SET password_hash = ?, must_change_password = 1, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [passwordHash, userId]
    );
    await run('UPDATE refresh_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL', [userId]);
    await auditLog({
      actorUserId: req.user.id,
      action: 'users.reset_password',
      targetType: 'user',
      targetId: String(userId),
      ipAddress: req.ip
    });
    return res.json({ message: 'Password reset successfully' });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Unable to reset password' });
  }
});

router.get('/audit-logs', requirePermission('audit:read'), async (req, res) => {
  const rows = await all(
    `SELECT al.id, al.action, al.target_type, al.target_id, al.details_json, al.ip_address, al.created_at,
            u.username AS actor_username
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.actor_user_id
     ORDER BY al.created_at DESC
     LIMIT 200`
  );
  return res.json({
    logs: rows.map((row) => ({
      ...row,
      details: row.details_json ? JSON.parse(row.details_json) : null
    }))
  });
});

router.get('/system-settings', requirePermission('settings:read'), async (req, res) => {
  const rows = await all('SELECT setting_key, setting_value, updated_at FROM system_settings ORDER BY setting_key ASC');
  const settings = {};
  for (const row of rows) {
    settings[row.setting_key] = JSON.parse(row.setting_value);
  }
  return res.json({ settings });
});

router.put('/system-settings', requirePermission('settings:write'), async (req, res) => {
  const settings = req.body?.settings || {};
  for (const [key, value] of Object.entries(settings)) {
    await run(
      `INSERT INTO system_settings (setting_key, setting_value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(setting_key)
       DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP`,
      [key, JSON.stringify(value)]
    );
  }
  await auditLog({
    actorUserId: req.user.id,
    action: 'settings.update',
    targetType: 'system_settings',
    details: settings,
    ipAddress: req.ip
  });
  return res.json({ message: 'Settings updated' });
});

module.exports = router;
