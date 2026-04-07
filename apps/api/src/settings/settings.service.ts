import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@esp/database";
import type { GlobalSettingsDto } from "@esp/shared-types";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaClient) {}

  async get(): Promise<GlobalSettingsDto> {
    const settings = await this.prisma.globalSettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: {
        addressLine1: "",
        addressLine2: "",
        website: "",
        logoUrl: "",
        badgeUrl: "",
      },
    });
    return {
      addressLine1: settings.addressLine1,
      addressLine2: settings.addressLine2,
      website: settings.website,
      logoUrl: settings.logoUrl,
      badgeUrl: settings.badgeUrl,
    };
  }

  async update(dto: GlobalSettingsDto): Promise<GlobalSettingsDto> {
    const settings = await this.prisma.globalSettings.upsert({
      where: { id: "singleton" },
      update: {
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        website: dto.website,
        logoUrl: dto.logoUrl,
        badgeUrl: dto.badgeUrl,
      },
      create: {
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        website: dto.website,
        logoUrl: dto.logoUrl,
        badgeUrl: dto.badgeUrl,
      },
    });
    return {
      addressLine1: settings.addressLine1,
      addressLine2: settings.addressLine2,
      website: settings.website,
      logoUrl: settings.logoUrl,
      badgeUrl: settings.badgeUrl,
    };
  }
}
