const express = require('express');
const { all, get, run } = require('../db');
const { authMiddleware, requireCsrf } = require('../middleware/auth');
const { auditLog } = require('../lib/audit');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  const user = await get(
    'SELECT id, username, full_name, email, role, status, must_change_password, last_login_at FROM users WHERE id = ?',
    [req.user.id]
  );
  const preferences = await all(
    `SELECT setting_key, setting_value
     FROM system_settings
     WHERE setting_key IN ('hospitalName', 'timezone', 'sessionTimeoutMinutes')`
  );
  return res.json({
    profile: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      status: user.status,
      mustChangePassword: Boolean(user.must_change_password),
      lastLoginAt: user.last_login_at
    },
    environment: Object.fromEntries(preferences.map((item) => [item.setting_key, JSON.parse(item.setting_value)]))
  });
});

router.put('/', requireCsrf, async (req, res) => {
  await run(
    `UPDATE users
     SET full_name = ?, email = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      String(req.body?.fullName || '').trim() || req.user.fullName,
      req.body?.email ? String(req.body.email).trim() : null,
      req.user.id
    ]
  );
  await auditLog({
    actorUserId: req.user.id,
    action: 'profile.update',
    targetType: 'user',
    targetId: String(req.user.id),
    ipAddress: req.ip
  });
  const updated = await get(
    'SELECT id, username, full_name, email, role, status, must_change_password, last_login_at FROM users WHERE id = ?',
    [req.user.id]
  );
  return res.json({ profile: updated });
});

module.exports = router;
