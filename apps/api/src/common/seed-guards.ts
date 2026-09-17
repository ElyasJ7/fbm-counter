/**
 * Production-safe seed guards.
 * Demo seed must never run in production without an explicit override.
 */
export function assertSeedAllowed(env: NodeJS.ProcessEnv = process.env): void {
  const nodeEnv = (env.NODE_ENV ?? 'development').toLowerCase();
  const allowSeed = (env.ALLOW_SEED ?? '').toLowerCase() === 'true';

  if (nodeEnv === 'production' && !allowSeed) {
    throw new Error(
      'Refusing to seed: NODE_ENV=production requires ALLOW_SEED=true. ' +
        'Never seed production with demo passwords unless explicitly approved.',
    );
  }
}

/**
 * Build Prisma upsert payloads that never overwrite an existing password hash.
 */
export function buildUserSeedUpsert(input: {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
}) {
  return {
    where: { email: input.email },
    update: {
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      status: input.status,
      deletedAt: null,
      // passwordHash intentionally omitted — preserve existing credentials
    },
    create: {
      email: input.email,
      passwordHash: input.passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      status: input.status,
    },
  };
}
