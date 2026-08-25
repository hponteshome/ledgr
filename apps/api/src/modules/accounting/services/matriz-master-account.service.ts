// apps/api/src/modules/accounting/services/matriz-master-account.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class MatrizMasterAccountService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.matrizMasterAccount.findMany({
      where: { deletedAt: null },
      orderBy: { code: 'asc' },
    });
  }

  async create(userId: string, dto: {
    code: string; reducedCode?: string; name: string; level: number;
    type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
    nature: 'DEBIT' | 'CREDIT'; isAnalytic: boolean; bloco: string; parentId?: string;
  }) {
    const existing = await this.prisma.matrizMasterAccount.findFirst({
      where: { code: dto.code, deletedAt: null },
    });
    if (existing) {
      throw new BadRequestException(`Já existe uma conta ativa com o código ${dto.code}.`);
    }
    return this.prisma.matrizMasterAccount.create({
      data: {
        code: dto.code,
        reducedCode: dto.reducedCode || null,
        name: dto.name,
        level: dto.level,
        type: dto.type,
        nature: dto.nature,
        isAnalytic: dto.isAnalytic,
        bloco: dto.bloco || 'NUCLEO',
        parentId: dto.parentId || null,
        createdById: userId,
      },
    });
  }

  async update(userId: string, id: string, dto: {
    name?: string; reducedCode?: string; isAnalytic?: boolean; bloco?: string; parentId?: string | null;
  }) {
    const acc = await this.prisma.matrizMasterAccount.findFirst({ where: { id, deletedAt: null } });
    if (!acc) throw new BadRequestException('Conta não encontrada.');
    return this.prisma.matrizMasterAccount.update({
      where: { id },
      data: {
        name: dto.name ?? acc.name,
        reducedCode: dto.reducedCode !== undefined ? dto.reducedCode || null : acc.reducedCode,
        isAnalytic: dto.isAnalytic ?? acc.isAnalytic,
        bloco: dto.bloco ?? acc.bloco,
        parentId: dto.parentId !== undefined ? dto.parentId : acc.parentId,
        updatedById: userId,
      },
    });
  }

  // Desativa (nao apaga) - contas ja em uso por alguma empresa continuam
  // intactas; so deixa de aparecer como opcao para novos imports.
  async deactivate(userId: string, id: string) {
    const acc = await this.prisma.matrizMasterAccount.findFirst({ where: { id, deletedAt: null } });
    if (!acc) throw new BadRequestException('Conta não encontrada.');
    const temFilhoAtivo = await this.prisma.matrizMasterAccount.findFirst({
      where: { parentId: id, deletedAt: null },
    });
    if (temFilhoAtivo) {
      throw new BadRequestException('Esta conta tem subcontas ativas - desative as subcontas primeiro.');
    }
    return this.prisma.matrizMasterAccount.update({
      where: { id },
      data: { isActive: false, updatedById: userId },
    });
  }

  async reactivate(userId: string, id: string) {
    return this.prisma.matrizMasterAccount.update({
      where: { id },
      data: { isActive: true, updatedById: userId },
    });
  }
}
