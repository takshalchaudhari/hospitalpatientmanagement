const { run } = require('../db');

async function auditLog({ actorUserId = null, action, targetType, targetId = null, details = null, ipAddress = null }) {
  await run(
    `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, details_json, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      actorUserId,
      action,
      targetType,
      targetId,
      details ? JSON.stringify(details) : null,
      ipAddress
    ]
  );
}

module.exports = {
  auditLog
};
