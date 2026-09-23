/**
 * Create a one-off staging admin (no demo seed).
 * Usage:
 *   node --import tsx scripts/create-staging-admin.mjs
 * Env:
 *   DATABASE_URL (required)
 *   STAGING_ADMIN_EMAIL (default admin@staging.local)
 *   STAGING_ADMIN_PASSWORD (random if unset — printed once)
 */
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaClient, Role, UserStatus } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const email = (process.env.STAGING_ADMIN_EMAIL ?? 'admin@staging.local')
  .trim()
  .toLowerCase();
const password =
  process.env.STAGING_ADMIN_PASSWORD?.trim() ||
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
        firstName: existing.firstName || 'Staging',
        lastName: existing.lastName || 'Admin',
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
        firstName: 'Staging',
        lastName: 'Admin',
      },
    });
    console.log(`Created staging admin: ${email}`);
  }

  const settings = await prisma.companySettings.findFirst();
  if (!settings) {
    await prisma.companySettings.create({
      data: {
        companyName: 'FBM Staging',
        legalName: 'FBM Staging Ltd',
        street: '1 Staging Street',
        postalCode: '00000',
        city: 'Staging',
        country: 'AF',
        defaultCurrency: 'AFN',
        defaultDisplayCurrency: 'AFN',
        timezone: 'Asia/Kabul',
        defaultVatRate: 0,
        invoicePrefix: 'STG',
      },
    });
    console.log('Created company settings for staging');
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
