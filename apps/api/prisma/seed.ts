import { PrismaClient, ProjectStatus, Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { assertSeedAllowed, buildUserSeedUpsert } from '../src/common/seed-guards';

const prisma = new PrismaClient();

const seedUsers: Array<{
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
}> = [
  {
    email: 'admin@musterbau.example',
    password: 'Admin123!',
    firstName: 'Anna',
    lastName: 'Administrator',
    role: Role.ADMIN,
  },
  {
    email: 'management@musterbau.example',
    password: 'Manager123!',
    firstName: 'Markus',
    lastName: 'Management',
    role: Role.MANAGEMENT,
  },
  {
    email: 'accounting@musterbau.example',
    password: 'Accounting123!',
    firstName: 'Clara',
    lastName: 'Accounting',
    role: Role.ACCOUNTING,
  },
  {
    email: 'pm@musterbau.example',
    password: 'Project123!',
    firstName: 'Peter',
    lastName: 'Site Manager',
    role: Role.PROJECT_MANAGER,
  },
  {
    email: 'viewer@musterbau.example',
    password: 'Viewer123!',
    firstName: 'Vera',
    lastName: 'Viewer',
    role: Role.VIEWER,
  },
];

async function main() {
  assertSeedAllowed(process.env);

  for (const user of seedUsers) {
    const passwordHash = await argon2.hash(user.password);
    const upsert = buildUserSeedUpsert({
      email: user.email,
      passwordHash,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: UserStatus.ACTIVE,
    });
    await prisma.user.upsert({
      where: upsert.where,
      update: {
        firstName: upsert.update.firstName,
        lastName: upsert.update.lastName,
        role: user.role,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      create: {
        email: upsert.create.email,
        passwordHash: upsert.create.passwordHash,
        firstName: upsert.create.firstName,
        lastName: upsert.create.lastName,
        role: user.role,
        status: UserStatus.ACTIVE,
      },
    });
  }

  const companySettingsData = {
    companyName: 'Sample Construction Ltd',
    legalName: 'Sample Construction Limited',
    street: '12 Construction Street',
    postalCode: '80331',
    city: 'Munich',
    country: 'DE',
    vatId: 'DE123456789',
    taxNumber: '143/123/12345',
    iban: 'DE89370400440532013000',
    bic: 'COBADEFFXXX',
    defaultCurrency: 'EUR',
    defaultVatRate: 19.0,
    invoicePrefix: 'INV',
  };

  const existingSettings = await prisma.companySettings.findFirst();
  if (!existingSettings) {
    await prisma.companySettings.create({
      data: companySettingsData,
    });
  } else {
    await prisma.companySettings.update({
      where: { id: existingSettings.id },
      data: companySettingsData,
    });
  }

  const pm = await prisma.user.findUnique({
    where: { email: 'pm@musterbau.example' },
  });

  const customers = [
    {
      companyName: 'Munich Municipal Utilities AG',
      previousNames: ['Stadtwerke München AG'],
      contactPerson: 'Dr. Helga Weber',
      email: 'einkauf@stadtwerke-muenchen.example',
      phone: '+49 89 123456',
      street: '2 Emmy Noether Street',
      postalCode: '80992',
      city: 'Munich',
      vatId: 'DE111222333',
    },
    {
      companyName: 'Bavarian Housing Ltd',
      previousNames: ['Bayerische Wohnbau GmbH'],
      contactPerson: 'Thomas Keller',
      email: 'projekte@bay-wohnbau.example',
      phone: '+49 89 654321',
      street: '88 Leopold Street',
      postalCode: '80802',
      city: 'Munich',
      vatId: 'DE444555666',
    },
    {
      companyName: 'Alpine View Properties KG',
      previousNames: ['Alpenblick Immobilien KG'],
      contactPerson: 'Sabine Hofer',
      email: 'kontakt@alpenblick.example',
      phone: '+49 89 998877',
      street: '10 Theresienhoehe',
      postalCode: '80339',
      city: 'Munich',
      vatId: 'DE777888999',
    },
  ];

  const customerIds: string[] = [];
  for (const customer of customers) {
    const { previousNames, ...customerData } = customer;
    const existing = await prisma.customer.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { companyName: customerData.companyName },
          ...previousNames.map((name) => ({ companyName: name })),
        ],
      },
    });
    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: { ...customerData, deletedAt: null },
      });
      customerIds.push(existing.id);
      continue;
    }
    const created = await prisma.customer.create({ data: customerData });
    customerIds.push(created.id);
  }

  const projects = [
    {
      projectNumber: 'P-2026-001',
      name: 'Giesing North Residential Complex',
      description:
        'New construction of 48 residential units including underground parking.',
      customerId: customerIds[1],
      customerContact: 'Thomas Keller',
      projectManagerId: pm?.id,
      siteStreet: '120 Tegernseer Land Street',
      sitePostalCode: '81539',
      siteCity: 'Munich',
      startDate: new Date('2026-02-01'),
      expectedCompletionDate: new Date('2027-06-30'),
      status: ProjectStatus.ACTIVE,
      contractValue: '4850000.0000',
      initialBudget: '3920000.0000',
      currentBudget: '4050000.0000',
      progressPercent: 28,
    },
    {
      projectNumber: 'P-2026-002',
      name: 'Aubing Substation Renovation',
      description: 'Renovation and expansion of the operations buildings.',
      customerId: customerIds[0],
      customerContact: 'Dr. Helga Weber',
      projectManagerId: pm?.id,
      siteStreet: '250 Lake Constance Street',
      sitePostalCode: '81249',
      siteCity: 'Munich',
      startDate: new Date('2026-01-15'),
      expectedCompletionDate: new Date('2026-11-30'),
      status: ProjectStatus.ACTIVE,
      contractValue: '1250000.0000',
      initialBudget: '980000.0000',
      currentBudget: '980000.0000',
      progressPercent: 45,
    },
    {
      projectNumber: 'P-2026-003',
      name: 'Sendling Office Campus',
      description: 'Planning phase for office and commercial space.',
      customerId: customerIds[2],
      customerContact: 'Sabine Hofer',
      projectManagerId: pm?.id,
      siteStreet: '50 Plinganser Street',
      sitePostalCode: '81369',
      siteCity: 'Munich',
      startDate: new Date('2026-04-01'),
      expectedCompletionDate: new Date('2028-03-31'),
      status: ProjectStatus.PLANNING,
      contractValue: '7200000.0000',
      initialBudget: '6100000.0000',
      currentBudget: '6100000.0000',
      progressPercent: 5,
    },
  ];

  for (const project of projects) {
    await prisma.project.upsert({
      where: { projectNumber: project.projectNumber },
      update: {
        ...project,
        deletedAt: null,
      },
      create: project,
    });
  }

  const project1 = await prisma.project.findUniqueOrThrow({
    where: { projectNumber: 'P-2026-001' },
  });
  const project2 = await prisma.project.findUniqueOrThrow({
    where: { projectNumber: 'P-2026-002' },
  });

  const suppliers = [
    {
      companyName: 'Bavaria Building Materials Ltd',
      previousNames: ['Bayern Baustoffe GmbH'],
      contactPerson: 'Klaus Meier',
      email: 'verkauf@bayern-baustoffe.example',
      phone: '+49 89 111222',
      city: 'Munich',
      vatId: 'DE998877665',
      iban: 'DE12500105170648489890',
      paymentTerms: '30 days net',
    },
    {
      companyName: 'Alpine Electrical AG',
      previousNames: ['Alpen Elektro AG'],
      contactPerson: 'Julia Braun',
      email: 'office@alpen-elektro.example',
      phone: '+49 89 333444',
      city: 'Munich',
      vatId: 'DE112233445',
      paymentTerms: '14 days net',
    },
  ];

  const supplierIds: string[] = [];
  for (const supplier of suppliers) {
    const { previousNames, ...supplierData } = supplier;
    const existing = await prisma.supplier.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { companyName: supplierData.companyName },
          ...previousNames.map((name) => ({ companyName: name })),
        ],
      },
    });
    if (existing) {
      await prisma.supplier.update({
        where: { id: existing.id },
        data: { ...supplierData, deletedAt: null },
      });
      supplierIds.push(existing.id);
      continue;
    }
    const created = await prisma.supplier.create({ data: supplierData });
    supplierIds.push(created.id);
  }

  const budgetLines = [
    {
      projectId: project1.id,
      category: 'MATERIALS' as const,
      plannedAmount: '1600000',
      committedAmount: '120000',
      actualAmount: '380000',
    },
    {
      projectId: project1.id,
      category: 'LABOR' as const,
      plannedAmount: '1100000',
      committedAmount: '80000',
      actualAmount: '290000',
    },
    {
      projectId: project1.id,
      category: 'SUBCONTRACTORS' as const,
      plannedAmount: '900000',
      committedAmount: '150000',
      actualAmount: '210000',
    },
    {
      projectId: project1.id,
      category: 'EQUIPMENT' as const,
      plannedAmount: '250000',
      committedAmount: '40000',
      actualAmount: '65000',
    },
    {
      projectId: project1.id,
      category: 'OTHER' as const,
      plannedAmount: '200000',
      committedAmount: '10000',
      actualAmount: '25000',
    },
  ];

  for (const line of budgetLines) {
    await prisma.budgetLine.upsert({
      where: {
        projectId_category: {
          projectId: line.projectId,
          category: line.category,
        },
      },
      update: line,
      create: line,
    });
  }

  await prisma.expense.upsert({
    where: { expenseNumber: 'EXP-2026-0001' },
    update: {
      description: 'Concrete and reinforcing steel delivery 1',
    },
    create: {
      expenseNumber: 'EXP-2026-0001',
      projectId: project1.id,
      category: 'MATERIALS',
      supplierId: supplierIds[0],
      description: 'Concrete and reinforcing steel delivery 1',
      invoiceNumber: 'BB-45821',
      invoiceDate: new Date('2026-03-10'),
      dueDate: new Date('2026-04-09'),
      netAmount: '84033.61',
      taxRate: '19',
      taxAmount: '15966.39',
      grossAmount: '100000.00',
      paidAmount: '100000.00',
      status: 'PAID',
      paymentDate: new Date('2026-04-05'),
      paymentMethod: 'BANK_TRANSFER',
    },
  });

  await prisma.expense.upsert({
    where: { expenseNumber: 'EXP-2026-0002' },
    update: {
      description: 'Crane deployment March',
    },
    create: {
      expenseNumber: 'EXP-2026-0002',
      projectId: project1.id,
      category: 'EQUIPMENT',
      supplierId: supplierIds[0],
      description: 'Crane deployment March',
      invoiceNumber: 'BB-45910',
      invoiceDate: new Date('2026-03-28'),
      dueDate: new Date('2026-04-27'),
      netAmount: '21008.40',
      taxRate: '19',
      taxAmount: '3991.60',
      grossAmount: '25000.00',
      paidAmount: '0',
      status: 'APPROVED',
    },
  });

  await prisma.expense.upsert({
    where: { expenseNumber: 'EXP-2026-0003' },
    update: {
      description: 'Cables and switchgear',
    },
    create: {
      expenseNumber: 'EXP-2026-0003',
      projectId: project2.id,
      category: 'MATERIALS',
      supplierId: supplierIds[1],
      description: 'Cables and switchgear',
      invoiceDate: new Date('2026-02-20'),
      dueDate: new Date('2026-03-20'),
      netAmount: '42016.81',
      taxRate: '19',
      taxAmount: '7983.19',
      grossAmount: '50000.00',
      paidAmount: '20000.00',
      status: 'PARTIALLY_PAID',
    },
  });

  const customerInvoice = await prisma.invoice.upsert({
    where: { invoiceNumber: 'RE-2026-0001' },
    update: {
      paymentTerms: '30 days net',
    },
    create: {
      invoiceNumber: 'RE-2026-0001',
      type: 'CUSTOMER',
      projectId: project1.id,
      customerId: project1.customerId,
      issueDate: new Date('2026-03-15'),
      dueDate: new Date('2026-04-14'),
      netAmount: '210084.03',
      taxRate: '19',
      taxAmount: '39915.97',
      grossAmount: '250000.00',
      paidAmount: '150000.00',
      status: 'PARTIALLY_PAID',
      paymentTerms: '30 days net',
      items: {
        create: [
          {
            description: 'Progress invoice shell construction 1',
            quantity: '1',
            unitPrice: '210084.03',
            netAmount: '210084.03',
            sortOrder: 0,
          },
        ],
      },
    },
  });

  await prisma.invoiceItem.updateMany({
    where: { invoiceId: customerInvoice.id },
    data: { description: 'Progress invoice shell construction 1' },
  });

  await prisma.invoice.upsert({
    where: { invoiceNumber: 'RE-2026-0002' },
    update: {
      paymentTerms: '30 days net',
    },
    create: {
      invoiceNumber: 'RE-2026-0002',
      type: 'CUSTOMER',
      projectId: project1.id,
      customerId: project1.customerId,
      issueDate: new Date('2026-04-01'),
      dueDate: new Date('2026-05-01'),
      netAmount: '84033.61',
      taxRate: '19',
      taxAmount: '15966.39',
      grossAmount: '100000.00',
      paidAmount: '0',
      status: 'OPEN',
      paymentTerms: '30 days net',
    },
  });

  await prisma.invoice.upsert({
    where: { invoiceNumber: 'ER-2026-0001' },
    update: {
      paymentTerms: '14 days net',
    },
    create: {
      invoiceNumber: 'ER-2026-0001',
      type: 'SUPPLIER',
      projectId: project1.id,
      supplierId: supplierIds[1],
      issueDate: new Date('2026-03-05'),
      dueDate: new Date('2026-04-04'),
      netAmount: '50420.17',
      taxRate: '19',
      taxAmount: '9579.83',
      grossAmount: '60000.00',
      paidAmount: '60000.00',
      status: 'PAID',
      paymentTerms: '14 days net',
    },
  });

  const supplierOpen = await prisma.invoice.upsert({
    where: { invoiceNumber: 'ER-2026-0002' },
    update: {
      paymentTerms: '30 days net',
    },
    create: {
      invoiceNumber: 'ER-2026-0002',
      type: 'SUPPLIER',
      projectId: project1.id,
      supplierId: supplierIds[0],
      issueDate: new Date('2026-03-20'),
      dueDate: new Date('2026-04-19'),
      netAmount: '33613.45',
      taxRate: '19',
      taxAmount: '6386.55',
      grossAmount: '40000.00',
      paidAmount: '0',
      status: 'OPEN',
      paymentTerms: '30 days net',
    },
  });

  const existingPay = await prisma.payment.findFirst({
    where: { paymentNumber: 'PAY-2026-0001' },
  });
  if (!existingPay) {
    await prisma.payment.create({
      data: {
        paymentNumber: 'PAY-2026-0001',
        invoiceId: customerInvoice.id,
        projectId: project1.id,
        paymentDate: new Date('2026-03-28'),
        amount: '150000.00',
        type: 'INCOMING',
        method: 'BANK_TRANSFER',
        reference: 'Progress payment 1 Giesing residential complex',
        bankReference: 'SEPA-20260328-001',
      },
    });
  } else {
    await prisma.payment.update({
      where: { id: existingPay.id },
      data: {
        reference: 'Progress payment 1 Giesing residential complex',
      },
    });
  }

  const existingPayOut = await prisma.payment.findFirst({
    where: { paymentNumber: 'PAY-2026-0002' },
  });
  if (!existingPayOut) {
    const paidSupplier = await prisma.invoice.findUnique({
      where: { invoiceNumber: 'ER-2026-0001' },
    });
    if (paidSupplier) {
      await prisma.payment.create({
        data: {
          paymentNumber: 'PAY-2026-0002',
          invoiceId: paidSupplier.id,
          projectId: project1.id,
          paymentDate: new Date('2026-03-18'),
          amount: '60000.00',
          type: 'OUTGOING',
          method: 'BANK_TRANSFER',
          reference: 'Electrical subcontractor',
        },
      });
    }
  } else {
    await prisma.payment.update({
      where: { id: existingPayOut.id },
      data: { reference: 'Electrical subcontractor' },
    });
  }

  void supplierOpen;

  const subcontractorsSeed = [
    {
      companyName: 'Munich Electrical Engineering Ltd',
      previousNames: ['München Elektro Technik GmbH'],
      contactPerson: 'Andreas Volt',
      trade: 'ELECTRICAL' as const,
      email: 'info@muc-elektro.example',
      phone: '+49 89 555111',
      city: 'Munich',
      vatId: 'DE556677889',
      contractValue: '420000.0000',
    },
    {
      companyName: 'Isar Plumbing Partners KG',
      previousNames: ['Isar Sanitär Partner KG'],
      contactPerson: 'Lena Rohr',
      trade: 'PLUMBING' as const,
      email: 'buero@isar-sanitaer.example',
      phone: '+49 89 555222',
      city: 'Munich',
      vatId: 'DE667788990',
      contractValue: '280000.0000',
    },
    {
      companyName: 'Alpine Roofing AG',
      previousNames: ['Alpen Dachbau AG'],
      contactPerson: 'Franz Ziegel',
      trade: 'ROOFING' as const,
      email: 'projekte@alpen-dach.example',
      city: 'Rosenheim',
      contractValue: '190000.0000',
    },
  ];

  const subIds: string[] = [];
  for (const sub of subcontractorsSeed) {
    const { previousNames, ...subData } = sub;
    const existing = await prisma.subcontractor.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { companyName: subData.companyName },
          ...previousNames.map((name) => ({ companyName: name })),
        ],
      },
    });
    if (existing) {
      subIds.push(existing.id);
      await prisma.subcontractor.update({
        where: { id: existing.id },
        data: { ...subData, deletedAt: null },
      });
      continue;
    }
    const created = await prisma.subcontractor.create({ data: subData });
    subIds.push(created.id);
  }

  await prisma.projectSubcontractor.upsert({
    where: {
      projectId_subcontractorId: {
        projectId: project1.id,
        subcontractorId: subIds[0],
      },
    },
    update: {
      contractValue: '350000.0000',
      notes: 'Residential complex electrical installation',
    },
    create: {
      projectId: project1.id,
      subcontractorId: subIds[0],
      contractValue: '350000.0000',
      notes: 'Residential complex electrical installation',
    },
  });

  await prisma.projectSubcontractor.upsert({
    where: {
      projectId_subcontractorId: {
        projectId: project1.id,
        subcontractorId: subIds[1],
      },
    },
    update: {
      contractValue: '180000.0000',
      notes: 'Plumbing and heating',
    },
    create: {
      projectId: project1.id,
      subcontractorId: subIds[1],
      contractValue: '180000.0000',
      notes: 'Plumbing and heating',
    },
  });

  await prisma.projectSubcontractor.upsert({
    where: {
      projectId_subcontractorId: {
        projectId: project2.id,
        subcontractorId: subIds[0],
      },
    },
    update: {
      contractValue: '95000.0000',
      notes: 'Substation electrical',
    },
    create: {
      projectId: project2.id,
      subcontractorId: subIds[0],
      contractValue: '95000.0000',
      notes: 'Substation electrical',
    },
  });

  await prisma.invoice.upsert({
    where: { invoiceNumber: 'ER-2026-0010' },
    update: {
      paymentTerms: '30 days net',
      notes: 'Electrical progress payment',
    },
    create: {
      invoiceNumber: 'ER-2026-0010',
      type: 'SUPPLIER',
      projectId: project1.id,
      subcontractorId: subIds[0],
      issueDate: new Date('2026-03-25'),
      dueDate: new Date('2026-04-24'),
      netAmount: '42016.81',
      taxRate: '19',
      taxAmount: '7983.19',
      grossAmount: '50000.00',
      paidAmount: '0',
      status: 'OPEN',
      paymentTerms: '30 days net',
      notes: 'Electrical progress payment',
    },
  });

  const admin = await prisma.user.findUnique({
    where: { email: 'admin@musterbau.example' },
  });
  const uploaderId = admin?.id ?? pm?.id;
  if (uploaderId) {
    const docTitle = 'Construction Contract (Draft)';
    const docFileName = 'Contract-Giesing.txt';
    const docDescription = 'Seed document for demo';
    const content =
      'Sample Construction Ltd — Construction contract Giesing North Residential Complex (seed document).\n';

    const existingDoc = await prisma.document.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { originalFileName: docFileName },
          { originalFileName: 'Bauvertrag-Giesing.txt' },
        ],
      },
    });
    if (!existingDoc) {
      const uploadRoot = resolve(process.env.UPLOAD_DIR ?? 'uploads');
      const year = '2026';
      const month = '09';
      const storageKey = `${year}/${month}/${randomUUID()}.txt`;
      const absoluteDir = join(uploadRoot, year, month);
      await mkdir(absoluteDir, { recursive: true });
      await writeFile(join(uploadRoot, storageKey), content, 'utf8');

      await prisma.document.create({
        data: {
          title: docTitle,
          originalFileName: docFileName,
          storageKey,
          mimeType: 'text/plain',
          sizeBytes: Buffer.byteLength(content, 'utf8'),
          category: 'CONTRACT',
          description: docDescription,
          projectId: project1.id,
          uploadedById: uploaderId,
        },
      });
    } else {
      await prisma.document.update({
        where: { id: existingDoc.id },
        data: {
          title: docTitle,
          originalFileName: docFileName,
          description: docDescription,
          deletedAt: null,
        },
      });
    }
  }

  if (pm?.id) {
    const existingNote = await prisma.notification.findFirst({
      where: {
        userId: pm.id,
        type: 'system.welcome',
      },
    });
    if (existingNote) {
      await prisma.notification.update({
        where: { id: existingNote.id },
        data: {
          title: 'Welcome to FBM Counter',
          message:
            'Notifications appear here for approved expenses, overdue invoices, and new documents.',
          link: '/projects',
        },
      });
    } else {
      await prisma.notification.create({
        data: {
          userId: pm.id,
          title: 'Welcome to FBM Counter',
          message:
            'Notifications appear here for approved expenses, overdue invoices, and new documents.',
          type: 'system.welcome',
          link: '/projects',
        },
      });
    }
  }

  if (admin?.id) {
    const existingAdminNote = await prisma.notification.findFirst({
      where: {
        userId: admin.id,
        type: 'system.welcome',
      },
    });
    if (existingAdminNote) {
      await prisma.notification.update({
        where: { id: existingAdminNote.id },
        data: {
          title: 'Notifications enabled',
          message: 'The bell in the header shows unread notifications.',
          link: '/notifications',
        },
      });
    } else {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          title: 'Notifications enabled',
          message: 'The bell in the header shows unread notifications.',
          type: 'system.welcome',
          link: '/notifications',
        },
      });
    }
  }

  console.log('Seed completed.');
  if ((process.env.NODE_ENV ?? 'development').toLowerCase() !== 'production') {
    console.log('Demo users (password shown once for local development):');
    for (const user of seedUsers) {
      console.log(`  ${user.role.padEnd(16)} ${user.email} / ${user.password}`);
    }
  } else {
    console.log(
      'Production seed finished. Demo passwords were applied only for newly created users.',
    );
  }
  console.log(`Customers: ${customerIds.length}, Projects: ${projects.length}`);
  console.log(
    `Suppliers: ${supplierIds.length}, Subcontractors: ${subIds.length}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
