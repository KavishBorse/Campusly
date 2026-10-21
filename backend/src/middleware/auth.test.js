import assert from 'node:assert/strict';
import test from 'node:test';
import { enforcePasswordChange, requireRole } from './auth.js';

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('role middleware rejects users outside the allowed roles', () => {
  const res = responseRecorder();
  let continued = false;

  requireRole('admin')({ user: { role: 'student' } }, res, () => { continued = true; });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'FORBIDDEN');
  assert.equal(continued, false);
});

test('role middleware allows a matching role', () => {
  const res = responseRecorder();
  let continued = false;

  requireRole('admin')({ user: { role: 'admin' } }, res, () => { continued = true; });

  assert.equal(res.statusCode, 200);
  assert.equal(continued, true);
});

test('first-login gate blocks application routes until password change', () => {
  const res = responseRecorder();
  let continued = false;

  enforcePasswordChange(
    { user: { mustChangePassword: true }, method: 'GET', path: '/admin/overview' },
    res,
    () => { continued = true; },
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'PASSWORD_CHANGE_REQUIRED');
  assert.equal(continued, false);
});

test('first-login gate permits session lookup, password update, and logout', () => {
  for (const [method, path] of [
    ['GET', '/auth/me'],
    ['PATCH', '/auth/password'],
    ['POST', '/auth/logout'],
  ]) {
    const res = responseRecorder();
    let continued = false;
    enforcePasswordChange(
      { user: { mustChangePassword: true }, method, path },
      res,
      () => { continued = true; },
    );
    assert.equal(continued, true, `${method} ${path} should remain available`);
  }
});

test('first-login gate does not block users with an established password', () => {
  const res = responseRecorder();
  let continued = false;

  enforcePasswordChange(
    { user: { mustChangePassword: false }, method: 'GET', path: '/admin/overview' },
    res,
    () => { continued = true; },
  );

  assert.equal(continued, true);
});
