import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { roleHasPermission } from './index';

describe('roleHasPermission', () => {
  it('grants ADMIN every permission checked', () => {
    assert.equal(roleHasPermission('ADMIN', 'users:write'), true);
    assert.equal(roleHasPermission('ADMIN', 'invoices:write'), true);
    assert.equal(roleHasPermission('ADMIN', 'settings:write'), true);
  });

  it('denies VIEWER write permissions', () => {
    assert.equal(roleHasPermission('VIEWER', 'invoices:write'), false);
    assert.equal(roleHasPermission('VIEWER', 'users:write'), false);
    assert.equal(roleHasPermission('VIEWER', 'projects:write'), false);
  });

  it('allows VIEWER read permissions', () => {
    assert.equal(roleHasPermission('VIEWER', 'invoices:read'), true);
    assert.equal(roleHasPermission('VIEWER', 'projects:read'), true);
  });

  it('keeps users:write admin-only', () => {
    assert.equal(roleHasPermission('MANAGEMENT', 'users:write'), false);
    assert.equal(roleHasPermission('ACCOUNTING', 'users:write'), false);
    assert.equal(roleHasPermission('PROJECT_MANAGER', 'users:write'), false);
  });
});
