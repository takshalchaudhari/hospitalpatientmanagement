function badRequest(message, details) {
  const error = new Error(message);
  error.statusCode = 400;
  error.details = details;
  return error;
}

function ensurePasswordPolicy(password) {
  if (typeof password !== 'string' || password.length < 12) {
    throw badRequest('Password must be at least 12 characters long');
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (!hasUpper || !hasLower || !hasNumber || !hasSymbol) {
    throw badRequest('Password must include upper, lower, number, and symbol characters');
  }
}

function ensureRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (!['admin', 'doctor', 'staff'].includes(normalized)) {
    throw badRequest('Role must be admin, doctor, or staff');
  }
  return normalized;
}

function ensureStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!['active', 'disabled', 'must_change_password'].includes(normalized)) {
    throw badRequest('Status must be active, disabled, or must_change_password');
  }
  return normalized;
}

function ensureRequiredFields(values) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || String(value).trim() === '') {
      throw badRequest(`${key} is required`);
    }
  }
}

module.exports = {
  badRequest,
  ensurePasswordPolicy,
  ensureRole,
  ensureStatus,
  ensureRequiredFields
};
