const config = require('../config');
const { verifyAccessToken } = require('../lib/security');

const rolePermissions = {
  admin: [
    'users:read',
    'users:write',
    'audit:read',
    'settings:read',
    'settings:write',
    'patients:read',
    'patients:write',
    'notes:read',
    'notes:write',
    'profile:read',
    'profile:write'
  ],
  doctor: [
    'patients:read',
    'patients:write',
    'notes:read',
    'notes:write',
    'profile:read',
    'profile:write',
    'settings:read'
  ],
  staff: [
    'patients:read',
    'patients:write',
    'notes:read',
    'profile:read',
    'profile:write',
    'settings:read'
  ]
};

function getPermissions(role) {
  return rolePermissions[role] || [];
}

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null;
    const token = bearerToken || req.cookies?.[config.cookieNameAccess];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const payload = verifyAccessToken(token);
    req.user = {
      id: Number(payload.sub),
      username: payload.username,
      role: payload.role,
      status: payload.status,
      fullName: payload.name,
      permissions: getPermissions(payload.role)
    };
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }
    return next();
  };
}

function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies?.[config.cookieNameCsrf];
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }

  return next();
}

module.exports = {
  authMiddleware,
  requirePermission,
  requireCsrf,
  getPermissions
};
