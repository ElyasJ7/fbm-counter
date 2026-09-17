import { assertSeedAllowed, buildUserSeedUpsert } from './seed-guards';

describe('seed guards', () => {
  it('aborts in production without ALLOW_SEED=true', () => {
    expect(() =>
      assertSeedAllowed({ NODE_ENV: 'production', ALLOW_SEED: undefined }),
    ).toThrow(/ALLOW_SEED=true/);
  });

  it('allows production when ALLOW_SEED=true', () => {
    expect(() =>
      assertSeedAllowed({ NODE_ENV: 'production', ALLOW_SEED: 'true' }),
    ).not.toThrow();
  });

  it('allows development by default', () => {
    expect(() => assertSeedAllowed({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('does not overwrite passwordHash on update', () => {
    const payload = buildUserSeedUpsert({
      email: 'admin@example.com',
      passwordHash: 'new-hash',
      firstName: 'Anna',
      lastName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    expect(payload.update).not.toHaveProperty('passwordHash');
    expect(payload.create.passwordHash).toBe('new-hash');
  });
});
