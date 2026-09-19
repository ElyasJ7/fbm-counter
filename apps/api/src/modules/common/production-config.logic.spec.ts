import { validateProductionEnv } from './production-config.logic';

describe('validateProductionEnv', () => {
  it('requires DATABASE_URL always', () => {
    const result = validateProductionEnv({
      NODE_ENV: 'development',
      JWT_ACCESS_SECRET: 'x'.repeat(32),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/DATABASE_URL/);
  });

  it('rejects weak JWT secrets in production', () => {
    const result = validateProductionEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      JWT_ACCESS_SECRET: 'change-me-access-secret-min-32-chars-long',
      CORS_ORIGIN: 'https://app.example.com',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/development\/default/);
  });

  it('accepts strong production config', () => {
    const result = validateProductionEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://u:p@db:5432/db',
      JWT_ACCESS_SECRET: 'a'.repeat(40),
      CORS_ORIGIN: 'https://app.example.com',
      COOKIE_SAME_SITE: 'lax',
      STORAGE_DRIVER: 'local',
      TRUST_PROXY: 'true',
    });
    expect(result).toEqual({ ok: true, warnings: [] });
  });

  it('blocks SameSite=none in production', () => {
    const result = validateProductionEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://u:p@db:5432/db',
      JWT_ACCESS_SECRET: 'a'.repeat(40),
      CORS_ORIGIN: 'https://app.example.com',
      COOKIE_SAME_SITE: 'none',
    });
    expect(result.ok).toBe(false);
  });
});
