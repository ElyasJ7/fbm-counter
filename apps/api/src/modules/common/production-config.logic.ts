const WEAK_SECRET_FRAGMENTS = [
  'change-me',
  'changeme',
  'secret-min-32',
  'dev-secret',
  'test-secret',
  'ci-access-secret',
  'ci-refresh-secret',
];

export type ProductionEnvMap = Record<string, string | undefined>;

export type ProductionConfigResult =
  { ok: true; warnings: string[] } | { ok: false; error: string };

/**
 * Pure production env validation (no Nest imports — unit-testable under Jest CJS).
 */
export function validateProductionEnv(
  env: ProductionEnvMap,
): ProductionConfigResult {
  const nodeEnv = (env.NODE_ENV ?? 'development').toLowerCase();
  const isProd = nodeEnv === 'production';
  const warnings: string[] = [];

  if (!env.DATABASE_URL?.trim()) {
    return { ok: false, error: 'DATABASE_URL is required' };
  }

  const accessSecret = env.JWT_ACCESS_SECRET ?? '';
  if (accessSecret.length < 32) {
    return {
      ok: false,
      error: 'JWT_ACCESS_SECRET must be at least 32 characters',
    };
  }

  if (!isProd) {
    return { ok: true, warnings };
  }

  const weak = WEAK_SECRET_FRAGMENTS.some((frag) =>
    accessSecret.toLowerCase().includes(frag),
  );
  if (weak) {
    return {
      ok: false,
      error:
        'JWT_ACCESS_SECRET appears to be a development/default value — refuse to start in production',
    };
  }

  const cors = env.CORS_ORIGIN ?? '';
  if (!cors.trim() || cors.includes('localhost')) {
    return {
      ok: false,
      error:
        'Production CORS_ORIGIN must be set to public web origin(s), not localhost',
    };
  }

  if ((env.ALLOW_SEED ?? '').toLowerCase() === 'true') {
    warnings.push('ALLOW_SEED=true in production');
  }

  if (env.COOKIE_SECURE === 'false') {
    return {
      ok: false,
      error:
        'COOKIE_SECURE=false is not allowed in production (Secure cookies required)',
    };
  }

  const sameSite = (env.COOKIE_SAME_SITE ?? 'lax').toLowerCase();
  if (sameSite === 'none') {
    return {
      ok: false,
      error:
        'COOKIE_SAME_SITE=none is blocked until CSRF tokens are implemented',
    };
  }

  const storageDriver = (env.STORAGE_DRIVER ?? 'local').toLowerCase();
  if (storageDriver === 's3') {
    if (!env.S3_BUCKET?.trim()) {
      return { ok: false, error: 'STORAGE_DRIVER=s3 requires S3_BUCKET' };
    }
    const hasEndpoint = Boolean(env.S3_ENDPOINT);
    if (hasEndpoint && (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY)) {
      return {
        ok: false,
        error:
          'S3_ENDPOINT deployments require S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY',
      };
    }
    if (
      env.S3_ACCESS_KEY_ID === 'minioadmin' ||
      env.S3_SECRET_ACCESS_KEY === 'minioadmin' ||
      env.S3_ACCESS_KEY_ID === 'minio' ||
      env.S3_SECRET_ACCESS_KEY === 'minio123'
    ) {
      return {
        ok: false,
        error: 'Default MinIO credentials are not allowed in production',
      };
    }
  }

  return { ok: true, warnings };
}
