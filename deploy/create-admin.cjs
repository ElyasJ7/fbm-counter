/**
 * Create/update first ADMIN inside the API container (no demo seed).
 * Env: DATABASE_URL, ADMIN_EMAIL (or STAGING_ADMIN_EMAIL),
 *      ADMIN_PASSWORD (or STAGING_ADMIN_PASSWORD) — random if unset.
 */
const { randomBytes } = require('crypto');
const argon2 = require('argon2');
const { PrismaClient, Role, UserStatus } = require('@prisma/client');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const email = (
  process.env.ADMIN_EMAIL ||
  process.env.STAGING_ADMIN_EMAIL ||
  ''
)
  .trim()
  .toLowerCase();
if (!email) {
  console.error('ADMIN_EMAIL (or STAGING_ADMIN_EMAIL) is required');
  process.exit(1);
}

const password =
  (process.env.ADMIN_PASSWORD || process.env.STAGING_ADMIN_PASSWORD || '').trim() ||
  randomBytes(18).toString('base64url');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash(password);
  const existing = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        firstName: existing.firstName || 'Admin',
        lastName: existing.lastName || 'User',
      },
    });
    console.log(`Updated existing admin: ${email}`);
  } else {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        firstName: 'Admin',
        lastName: 'User',
      },
    });
    console.log(`Created admin: ${email}`);
  }

  const settings = await prisma.companySettings.findFirst();
  if (!settings) {
    await prisma.companySettings.create({
      data: {
        companyName: 'FBM Counter',
        legalName: 'FBM Counter',
        street: null,
        postalCode: null,
        city: null,
        country: 'AF',
        defaultCurrency: 'AFN',
        defaultDisplayCurrency: 'AFN',
        timezone: 'Asia/Kabul',
        defaultVatRate: 0,
        invoicePrefix: 'INV',
      },
    });
    console.log(
      'Created company settings defaults (AFN / Asia/Kabul). Adjust in Settings UI if needed.',
    );
  } else {
    console.log(
      'Company settings already present — left unchanged (configure AFN/Asia/Kabul in Settings if desired).',
    );
  }

  console.log('Password (store securely, shown once):');
  console.log(password);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
