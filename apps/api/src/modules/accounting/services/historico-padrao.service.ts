// apps/api/src/modules/accounting/services/historico-padrao.service.ts
// CRIADO (09/09/2026): manutencao manual do catalogo Historico Padrao
// (model HistoricoPadrao, criado em 03/09/2026 na Rota B do historico por
// partida). Ate aqui, o catalogo so era alimentado automaticamente pelo
// upsert dentro de EcdLancamentosImportService.registrar() a partir do
// registro 0400 do SPED. Nao havia tela pra cadastrar/editar/desativar um
// historico a mao - necessario pro modal de Importacao Manual (que aceita
// HP como identificador) e para lancamentos avulsos criados direto no sistema.
import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface CreateHistoricoPadraoDto {
  code: string;
  description: string;
}

export interface UpdateHistoricoPadraoDto {
  code?: string;
  description?: string;
}

@Injectable()
export class HistoricoPadraoService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, includeInactive = false) {
    return this.prisma.historicoPadrao.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { code: 'asc' },
    });
  }

  async create(companyId: string, dto: CreateHistoricoPadraoDto) {
    const code = dto.code?.trim();
    const description = dto.description?.trim();
    if (!code || !description) {
      throw new BadRequestException('Código e descrição são obrigatórios.');
    }

    const existente = await this.prisma.historicoPadrao.findFirst({
      where: { companyId, code, deletedAt: null },
    });
    if (existente) {
      throw new ConflictException(`Já existe um histórico padrão com o código "${code}" nesta empresa.`);
    }

    return this.prisma.historicoPadrao.create({
      data: { companyId, code, description, isActive: true },
    });
  }

  async update(companyId: string, id: string, dto: UpdateHistoricoPadraoDto) {
    const atual = await this.prisma.historicoPadrao.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!atual) {
      throw new NotFoundException('Histórico padrão não encontrado.');
    }

    const data: Record<string, string> = {};

    if (dto.code !== undefined) {
      const code = dto.code.trim();
      if (!code) throw new BadRequestException('Código não pode ficar vazio.');
      if (code !== atual.code) {
        const duplicado = await this.prisma.historicoPadrao.findFirst({
          where: { companyId, code, deletedAt: null, id: { not: id } },
        });
        if (duplicado) {
          throw new ConflictException(`Já existe um histórico padrão com o código "${code}" nesta empresa.`);
        }
      }
      data.code = code;
    }

    if (dto.description !== undefined) {
      const description = dto.description.trim();
      if (!description) throw new BadRequestException('Descrição não pode ficar vazia.');
      data.description = description;
    }

    return this.prisma.historicoPadrao.update({ where: { id }, data });
  }

  async toggleActive(companyId: string, id: string, isActive: boolean) {
    const atual = await this.prisma.historicoPadrao.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!atual) {
      throw new NotFoundException('Histórico padrão não encontrado.');
    }
    return this.prisma.historicoPadrao.update({ where: { id }, data: { isActive } });
  }
}
