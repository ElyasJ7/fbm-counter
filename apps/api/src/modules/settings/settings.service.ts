import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { APP_COMPANY_PLACEHOLDER, DEFAULT_CURRENCY } from '@fbm/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(settings: {
    id: string;
    companyName: string;
    legalName: string | null;
    street: string | null;
    postalCode: string | null;
    city: string | null;
    country: string;
    vatId: string | null;
    taxNumber: string | null;
    iban: string | null;
    bic: string | null;
    defaultCurrency: string;
    defaultVatRate: Prisma.Decimal;
    invoicePrefix: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: settings.id,
      companyName: settings.companyName,
      legalName: settings.legalName,
      street: settings.street,
      postalCode: settings.postalCode,
      city: settings.city,
      country: settings.country,
      vatId: settings.vatId,
      taxNumber: settings.taxNumber,
      iban: settings.iban,
      bic: settings.bic,
      defaultCurrency: settings.defaultCurrency,
      defaultVatRate: settings.defaultVatRate.toString(),
      invoicePrefix: settings.invoicePrefix,
      createdAt: settings.createdAt.toISOString(),
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  private async ensureSettings() {
    const existing = await this.prisma.companySettings.findFirst();
    if (existing) return existing;

    return this.prisma.companySettings.create({
      data: {
        companyName: APP_COMPANY_PLACEHOLDER,
        country: 'DE',
        defaultCurrency: DEFAULT_CURRENCY,
        defaultVatRate: 19,
        invoicePrefix: 'RE',
      },
    });
  }

  async get() {
    const settings = await this.ensureSettings();
    return this.serialize(settings);
  }

  async update(dto: UpdateSettingsDto, actorId: string) {
    const existing = await this.ensureSettings();

    return this.prisma.$transaction(async (tx) => {
      const settings = await tx.companySettings.update({
        where: { id: existing.id },
        data: {
          companyName: dto.companyName?.trim(),
          legalName:
            dto.legalName === undefined
              ? undefined
              : dto.legalName.trim() || null,
          street:
            dto.street === undefined ? undefined : dto.street.trim() || null,
          postalCode:
            dto.postalCode === undefined
              ? undefined
              : dto.postalCode.trim() || null,
          city: dto.city === undefined ? undefined : dto.city.trim() || null,
          country: dto.country?.trim().toUpperCase(),
          vatId: dto.vatId === undefined ? undefined : dto.vatId.trim() || null,
          taxNumber:
            dto.taxNumber === undefined
              ? undefined
              : dto.taxNumber.trim() || null,
          iban: dto.iban === undefined ? undefined : dto.iban.trim() || null,
          bic: dto.bic === undefined ? undefined : dto.bic.trim() || null,
          defaultCurrency: dto.defaultCurrency?.trim().toUpperCase(),
          defaultVatRate: dto.defaultVatRate,
          invoicePrefix: dto.invoicePrefix?.trim().toUpperCase(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SETTINGS_UPDATED',
          entityType: 'CompanySettings',
          entityId: settings.id,
          previousValue: {
            companyName: existing.companyName,
            defaultVatRate: existing.defaultVatRate.toString(),
            invoicePrefix: existing.invoicePrefix,
            defaultCurrency: existing.defaultCurrency,
          },
          newValue: {
            companyName: settings.companyName,
            defaultVatRate: settings.defaultVatRate.toString(),
            invoicePrefix: settings.invoicePrefix,
            defaultCurrency: settings.defaultCurrency,
          },
        },
      });

      return this.serialize(settings);
    });
  }
}
