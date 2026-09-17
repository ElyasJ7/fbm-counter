import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(rawQuery: string) {
    const query = rawQuery?.trim() ?? '';
    if (query.length < 2) {
      throw new BadRequestException('Query must be at least 2 characters');
    }

    const contains = { contains: query, mode: 'insensitive' as const };
    const take = 8;

    const [
      projects,
      invoices,
      customers,
      suppliers,
      subcontractors,
      documents,
      expenses,
    ] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: contains },
            { projectNumber: contains },
            { customer: { companyName: contains } },
          ],
        },
        take,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          projectNumber: true,
          customer: { select: { companyName: true } },
        },
      }),
      this.prisma.invoice.findMany({
        where: {
          deletedAt: null,
          OR: [{ invoiceNumber: contains }, { notes: contains }],
        },
        take,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          invoiceNumber: true,
          type: true,
          projectId: true,
          customer: { select: { companyName: true } },
          supplier: { select: { companyName: true } },
        },
      }),
      this.prisma.customer.findMany({
        where: {
          deletedAt: null,
          OR: [
            { companyName: contains },
            { contactPerson: contains },
            { email: contains },
            { city: contains },
          ],
        },
        take,
        orderBy: { companyName: 'asc' },
        select: { id: true, companyName: true, city: true },
      }),
      this.prisma.supplier.findMany({
        where: {
          deletedAt: null,
          OR: [
            { companyName: contains },
            { contactPerson: contains },
            { email: contains },
            { city: contains },
          ],
        },
        take,
        orderBy: { companyName: 'asc' },
        select: { id: true, companyName: true, city: true },
      }),
      this.prisma.subcontractor.findMany({
        where: {
          deletedAt: null,
          OR: [
            { companyName: contains },
            { contactPerson: contains },
            { email: contains },
            { city: contains },
          ],
        },
        take,
        orderBy: { companyName: 'asc' },
        select: { id: true, companyName: true, trade: true },
      }),
      this.prisma.document.findMany({
        where: {
          deletedAt: null,
          OR: [
            { title: contains },
            { originalFileName: contains },
            { description: contains },
          ],
        },
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          originalFileName: true,
          projectId: true,
        },
      }),
      this.prisma.expense.findMany({
        where: {
          deletedAt: null,
          OR: [
            { expenseNumber: contains },
            { description: contains },
            { invoiceNumber: contains },
          ],
        },
        take,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          expenseNumber: true,
          description: true,
          projectId: true,
        },
      }),
    ]);

    return {
      query,
      results: [
        ...projects.map((row) => ({
          type: 'project' as const,
          id: row.id,
          title: `${row.projectNumber} — ${row.name}`,
          subtitle: row.customer.companyName,
          link: `/projects/${row.id}`,
        })),
        ...invoices.map((row) => ({
          type: 'invoice' as const,
          id: row.id,
          title: row.invoiceNumber,
          subtitle:
            row.customer?.companyName ?? row.supplier?.companyName ?? row.type,
          link: row.projectId
            ? `/projects/${row.projectId}?tab=invoices`
            : '/invoices',
        })),
        ...customers.map((row) => ({
          type: 'customer' as const,
          id: row.id,
          title: row.companyName,
          subtitle: row.city,
          link: '/customers',
        })),
        ...suppliers.map((row) => ({
          type: 'supplier' as const,
          id: row.id,
          title: row.companyName,
          subtitle: row.city,
          link: `/suppliers/${row.id}`,
        })),
        ...subcontractors.map((row) => ({
          type: 'subcontractor' as const,
          id: row.id,
          title: row.companyName,
          subtitle: row.trade,
          link: `/subcontractors/${row.id}`,
        })),
        ...documents.map((row) => ({
          type: 'document' as const,
          id: row.id,
          title: row.title || row.originalFileName,
          subtitle: row.originalFileName,
          link: row.projectId
            ? `/projects/${row.projectId}?tab=documents`
            : '/documents',
        })),
        ...expenses.map((row) => ({
          type: 'expense' as const,
          id: row.id,
          title: row.expenseNumber,
          subtitle: row.description,
          link: row.projectId
            ? `/projects/${row.projectId}?tab=expenses`
            : '/expenses',
        })),
      ],
    };
  }
}
