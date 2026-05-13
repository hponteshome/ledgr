import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AccountingConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(companyId: string) {
    return this.prisma.companyAccountingConfig.findUnique({
      where: { companyId },
    });
  }

  async upsertConfig(companyId: string, createdById: string, dto: any) {
    return this.prisma.companyAccountingConfig.upsert({
      where: { companyId },
      create: { companyId, createdById, ...dto },
      update: { ...dto },
    });
  }
}
