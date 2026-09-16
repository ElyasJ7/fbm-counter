import { PrismaClient, ProjectStatus, Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

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
    lastName: 'Leitung',
    role: Role.MANAGEMENT,
  },
  {
    email: 'accounting@musterbau.example',
    password: 'Accounting123!',
    firstName: 'Clara',
    lastName: 'Buchhaltung',
    role: Role.ACCOUNTING,
  },
  {
    email: 'pm@musterbau.example',
    password: 'Project123!',
    firstName: 'Peter',
    lastName: 'Bauleiter',
    role: Role.PROJECT_MANAGER,
  },
  {
    email: 'viewer@musterbau.example',
    password: 'Viewer123!',
    firstName: 'Vera',
    lastName: 'Einsicht',
    role: Role.VIEWER,
  },
];

async function main() {
  for (const user of seedUsers) {
    const passwordHash = await argon2.hash(user.password);
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        passwordHash,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      create: {
        email: user.email,
        passwordHash,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: UserStatus.ACTIVE,
      },
    });
  }

  const existingSettings = await prisma.companySettings.findFirst();
  if (!existingSettings) {
    await prisma.companySettings.create({
      data: {
        companyName: 'Muster Bau GmbH',
        legalName: 'Muster Bau Gesellschaft mit beschränkter Haftung',
        street: 'Baustraße 12',
        postalCode: '80331',
        city: 'München',
        country: 'DE',
        vatId: 'DE123456789',
        taxNumber: '143/123/12345',
        iban: 'DE89370400440532013000',
        bic: 'COBADEFFXXX',
        defaultCurrency: 'EUR',
        defaultVatRate: 19.0,
        invoicePrefix: 'RE',
      },
    });
  }

  const pm = await prisma.user.findUnique({
    where: { email: 'pm@musterbau.example' },
  });

  const customers = [
    {
      companyName: 'Stadtwerke München AG',
      contactPerson: 'Dr. Helga Weber',
      email: 'einkauf@stadtwerke-muenchen.example',
      phone: '+49 89 123456',
      street: 'Emmy-Noether-Straße 2',
      postalCode: '80992',
      city: 'München',
      vatId: 'DE111222333',
    },
    {
      companyName: 'Bayerische Wohnbau GmbH',
      contactPerson: 'Thomas Keller',
      email: 'projekte@bay-wohnbau.example',
      phone: '+49 89 654321',
      street: 'Leopoldstraße 88',
      postalCode: '80802',
      city: 'München',
      vatId: 'DE444555666',
    },
    {
      companyName: 'Alpenblick Immobilien KG',
      contactPerson: 'Sabine Hofer',
      email: 'kontakt@alpenblick.example',
      phone: '+49 89 998877',
      street: 'Theresienhöhe 10',
      postalCode: '80339',
      city: 'München',
      vatId: 'DE777888999',
    },
  ];

  const customerIds: string[] = [];
  for (const customer of customers) {
    const existing = await prisma.customer.findFirst({
      where: { companyName: customer.companyName, deletedAt: null },
    });
    if (existing) {
      customerIds.push(existing.id);
      continue;
    }
    const created = await prisma.customer.create({ data: customer });
    customerIds.push(created.id);
  }

  const projects = [
    {
      projectNumber: 'P-2026-001',
      name: 'Wohnanlage Giesing Nord',
      description: 'Neubau von 48 Wohneinheiten inkl. Tiefgarage.',
      customerId: customerIds[1],
      customerContact: 'Thomas Keller',
      projectManagerId: pm?.id,
      siteStreet: 'Tegernseer Landstraße 120',
      sitePostalCode: '81539',
      siteCity: 'München',
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
      name: 'Umspannwerk Aubing Sanierung',
      description: 'Sanierung und Erweiterung der Betriebsgebäude.',
      customerId: customerIds[0],
      customerContact: 'Dr. Helga Weber',
      projectManagerId: pm?.id,
      siteStreet: 'Bodenseestraße 250',
      sitePostalCode: '81249',
      siteCity: 'München',
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
      name: 'Bürocampus Sendling',
      description: 'Planungsphase für Büro- und Gewerbefläche.',
      customerId: customerIds[2],
      customerContact: 'Sabine Hofer',
      projectManagerId: pm?.id,
      siteStreet: 'Plinganserstraße 50',
      sitePostalCode: '81369',
      siteCity: 'München',
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
      companyName: 'Bayern Baustoffe GmbH',
      contactPerson: 'Klaus Meier',
      email: 'verkauf@bayern-baustoffe.example',
      phone: '+49 89 111222',
      city: 'München',
      vatId: 'DE998877665',
      iban: 'DE12500105170648489890',
      paymentTerms: '30 Tage netto',
    },
    {
      companyName: 'Alpen Elektro AG',
      contactPerson: 'Julia Braun',
      email: 'office@alpen-elektro.example',
      phone: '+49 89 333444',
      city: 'München',
      vatId: 'DE112233445',
      paymentTerms: '14 Tage netto',
    },
  ];

  const supplierIds: string[] = [];
  for (const supplier of suppliers) {
    const existing = await prisma.supplier.findFirst({
      where: { companyName: supplier.companyName, deletedAt: null },
    });
    if (existing) {
      supplierIds.push(existing.id);
      continue;
    }
    const created = await prisma.supplier.create({ data: supplier });
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
    update: {},
    create: {
      expenseNumber: 'EXP-2026-0001',
      projectId: project1.id,
      category: 'MATERIALS',
      supplierId: supplierIds[0],
      description: 'Beton und Bewehrungsstahl Lieferung 1',
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
    update: {},
    create: {
      expenseNumber: 'EXP-2026-0002',
      projectId: project1.id,
      category: 'EQUIPMENT',
      supplierId: supplierIds[0],
      description: 'Kraneinsatz März',
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
    update: {},
    create: {
      expenseNumber: 'EXP-2026-0003',
      projectId: project2.id,
      category: 'MATERIALS',
      supplierId: supplierIds[1],
      description: 'Kabel und Schaltanlagen',
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
    update: {},
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
      paymentTerms: '30 Tage netto',
      items: {
        create: [
          {
            description: 'Abschlagsrechnung Rohbau 1',
            quantity: '1',
            unitPrice: '210084.03',
            netAmount: '210084.03',
            sortOrder: 0,
          },
        ],
      },
    },
  });

  await prisma.invoice.upsert({
    where: { invoiceNumber: 'RE-2026-0002' },
    update: {},
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
      paymentTerms: '30 Tage netto',
    },
  });

  await prisma.invoice.upsert({
    where: { invoiceNumber: 'ER-2026-0001' },
    update: {},
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
      paymentTerms: '14 Tage netto',
    },
  });

  const supplierOpen = await prisma.invoice.upsert({
    where: { invoiceNumber: 'ER-2026-0002' },
    update: {},
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
      paymentTerms: '30 Tage netto',
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
        reference: 'Abschlag 1 Wohnanlage Giesing',
        bankReference: 'SEPA-20260328-001',
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
          reference: 'Elektro Subunternehmer',
        },
      });
    }
  }

  void supplierOpen;

  const subcontractorsSeed = [
    {
      companyName: 'München Elektro Technik GmbH',
      contactPerson: 'Andreas Volt',
      trade: 'ELECTRICAL' as const,
      email: 'info@muc-elektro.example',
      phone: '+49 89 555111',
      city: 'München',
      vatId: 'DE556677889',
      contractValue: '420000.0000',
    },
    {
      companyName: 'Isar Sanitär Partner KG',
      contactPerson: 'Lena Rohr',
      trade: 'PLUMBING' as const,
      email: 'buero@isar-sanitaer.example',
      phone: '+49 89 555222',
      city: 'München',
      vatId: 'DE667788990',
      contractValue: '280000.0000',
    },
    {
      companyName: 'Alpen Dachbau AG',
      contactPerson: 'Franz Ziegel',
      trade: 'ROOFING' as const,
      email: 'projekte@alpen-dach.example',
      city: 'Rosenheim',
      contractValue: '190000.0000',
    },
  ];

  const subIds: string[] = [];
  for (const sub of subcontractorsSeed) {
    const existing = await prisma.subcontractor.findFirst({
      where: { companyName: sub.companyName, deletedAt: null },
    });
    if (existing) {
      subIds.push(existing.id);
      await prisma.subcontractor.update({
        where: { id: existing.id },
        data: { ...sub, deletedAt: null },
      });
      continue;
    }
    const created = await prisma.subcontractor.create({ data: sub });
    subIds.push(created.id);
  }

  await prisma.projectSubcontractor.upsert({
    where: {
      projectId_subcontractorId: {
        projectId: project1.id,
        subcontractorId: subIds[0],
      },
    },
    update: { contractValue: '350000.0000' },
    create: {
      projectId: project1.id,
      subcontractorId: subIds[0],
      contractValue: '350000.0000',
      notes: 'Elektroinstallation Wohnanlage',
    },
  });

  await prisma.projectSubcontractor.upsert({
    where: {
      projectId_subcontractorId: {
        projectId: project1.id,
        subcontractorId: subIds[1],
      },
    },
    update: { contractValue: '180000.0000' },
    create: {
      projectId: project1.id,
      subcontractorId: subIds[1],
      contractValue: '180000.0000',
      notes: 'Sanitär und Heizung',
    },
  });

  await prisma.projectSubcontractor.upsert({
    where: {
      projectId_subcontractorId: {
        projectId: project2.id,
        subcontractorId: subIds[0],
      },
    },
    update: { contractValue: '95000.0000' },
    create: {
      projectId: project2.id,
      subcontractorId: subIds[0],
      contractValue: '95000.0000',
      notes: 'Umspannwerk Elektro',
    },
  });

  await prisma.invoice.upsert({
    where: { invoiceNumber: 'ER-2026-0010' },
    update: {},
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
      paymentTerms: '30 Tage netto',
      notes: 'Abschlag Elektro',
    },
  });

  console.log('Seed completed.');
  console.log('Demo users (password shown once for local development):');
  for (const user of seedUsers) {
    console.log(`  ${user.role.padEnd(16)} ${user.email} / ${user.password}`);
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
