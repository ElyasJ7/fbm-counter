import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getLoginFieldDefaults } from './login-defaults.ts';

describe('getLoginFieldDefaults', () => {
  it('returns empty fields for production builds', () => {
    const defaults = getLoginFieldDefaults(false);
    assert.equal(defaults.email, '');
    assert.equal(defaults.password, '');
  });

  it('does not hardcode demo credentials in source path for production', () => {
    const prod = getLoginFieldDefaults(false);
    assert.deepEqual(prod, { email: '', password: '' });
    // Development mode may read VITE_DEMO_LOGIN_* from Vite; under node tests
    // those env keys are absent, so fields stay empty strings.
    const dev = getLoginFieldDefaults(true);
    assert.equal(typeof dev.email, 'string');
    assert.equal(typeof dev.password, 'string');
  });
});
