const test = require('node:test');
const assert = require('node:assert/strict');

const { ensurePasswordPolicy, ensureRole } = require('../lib/validation');
const { getPermissions } = require('../middleware/auth');

test('password policy accepts strong passwords', () => {
  assert.doesNotThrow(() => ensurePasswordPolicy('Hospital#2026'));
});

test('password policy rejects short passwords', () => {
  assert.throws(() => ensurePasswordPolicy('short1!'));
});

test('role normalization accepts valid roles', () => {
  assert.equal(ensureRole('Doctor'), 'doctor');
  assert.equal(ensureRole('admin'), 'admin');
});

test('permissions differ by role', () => {
  assert.ok(getPermissions('admin').includes('users:write'));
  assert.ok(getPermissions('doctor').includes('notes:write'));
  assert.ok(!getPermissions('staff').includes('users:write'));
});
