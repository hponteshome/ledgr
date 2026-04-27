// apps/api/src/modules/accounting/services/accounting-mask.service.ts

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface MaskConfig {
  id: string;
  mask: string;           // ex: "1.1.1.2.3"
  levels: number[];       // ex: [1, 1, 1, 2, 3]
  totalLevels: number;    // ex: 5
  validFrom: Date;
  validTo: Date | null;
}

export interface CreateMaskDto {
  mask: string;
  validFrom: Date;
  validTo?: Date;
}

// ─── Helpers de máscara ───────────────────────────────────────────────────────

/**
 * Parseia "1.1.1.2.3" → [1, 1, 1, 2, 3]
 */
export function parseMask(mask: string): number[] {
  const parts = mask.split('.');
  const levels = parts.map(p => {
    const n = parseInt(p, 10);
    if (isNaN(n) || n < 1 || n > 9) {
      throw new BadRequestException(
        `Máscara inválida: "${mask}". Cada nível deve ser um número entre 1 e 9.`
      );
    }
    return n;
  });
  if (levels.length < 1 || levels.length > 8) {
    throw new BadRequestException(
      `Máscara inválida: deve ter entre 1 e 8 níveis.`
    );
  }
  return levels;
}

/**
 * Valida se um código segue a máscara.
 * Ex: código "1.1.02.001", máscara [1,1,2,3] → válido
 *     código "1.1.2.001",  máscara [1,1,2,3] → inválido (nível 3 deve ter 2 dígitos)
 */
export function validateCodeAgainstMask(code: string, levels: number[]): void {
  const parts = code.split('.');

  if (parts.length > levels.length) {
    throw new BadRequestException(
      `Código "${code}" excede o número máximo de níveis (${levels.length}) definido na máscara.`
    );
  }

  for (let i = 0; i < parts.length; i++) {
    const expectedDigits = levels[i];
    const part = parts[i];

    if (part.length !== expectedDigits) {
      throw new BadRequestException(
        `Código "${code}" inválido: nível ${i + 1} deve ter ${expectedDigits} dígito(s), ` +
        `mas "${part}" tem ${part.length}.`
      );
    }

    if (!/^\d+$/.test(part)) {
      throw new BadRequestException(
        `Código "${code}" inválido: nível ${i + 1} deve conter apenas dígitos.`
      );
    }
  }
}

/**
 * Calcula o nível de um código baseado na máscara.
 * Ex: "1.1.02" com máscara [1,1,2,3] → nível 3
 */
export function getLevelFromCode(code: string): number {
  return code.split('.').length;
}

/**
 * Sugere o próximo código disponível para um filho do pai dado.
 * Ex: pai "1.1", filhos existentes ["1.1.01","1.1.02"], máscara nível 3 = 2 dígitos
 *     → sugere "1.1.03"
 */
export function suggestNextCode(
  parentCode: string,
  existingChildren: string[],
  childDigits: number,
): string {
  const childCodes = existingChildren
    .map(c => {
      const parts = c.split('.');
      return parseInt(parts[parts.length - 1], 10);
    })
    .filter(n => !isNaN(n));

  const maxExisting = childCodes.length > 0 ? Math.max(...childCodes) : 0;
  const next = maxExisting + 1;
  const padded = String(next).padStart(childDigits, '0');
  return `${parentCode}.${padded}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AccountingMaskService {
  constructor(private prisma: PrismaService) {}

  // ── Obter config vigente ────────────────────────────────────────────────────

  async getActiveMask(companyId: string, date?: Date): Promise<MaskConfig> {
    const refDate = date ?? new Date();

    const config = await this.prisma.companyAccountingConfig.findFirst({
      where: {
        companyId,
        validFrom: { lte: refDate },
        OR: [
          { validTo: null },
          { validTo: { gte: refDate } },
        ],
      },
      orderBy: { validFrom: 'desc' },
    });

    if (!config) {
      // Retorna padrão SPED se não houver config cadastrada
      const defaultMask = '1.1.1.2.3';
      const levels = parseMask(defaultMask);
      return {
        id: 'default',
        mask: defaultMask,
        levels,
        totalLevels: levels.length,
        validFrom: new Date('2000-01-01'),
        validTo: null,
      };
    }

    const levels = parseMask(config.mask);
    return {
      id: config.id,
      mask: config.mask,
      levels,
      totalLevels: levels.length,
      validFrom: config.validFrom,
      validTo: config.validTo,
    };
  }

  // ── Listar histórico de máscaras ────────────────────────────────────────────

  async listMasks(companyId: string) {
    return this.prisma.companyAccountingConfig.findMany({
      where: { companyId },
      orderBy: { validFrom: 'desc' },
    });
  }

  // ── Criar nova máscara ──────────────────────────────────────────────────────

  async createMask(companyId: string, userId: string, dto: CreateMaskDto) {
    // Validar formato da máscara
    const levels = parseMask(dto.mask);

    // Verificar sobreposição de períodos
    const overlap = await this.prisma.companyAccountingConfig.findFirst({
      where: {
        companyId,
        validFrom: { lte: dto.validTo ?? new Date('9999-12-31') },
        OR: [
          { validTo: null },
          { validTo: { gte: dto.validFrom } },
        ],
      },
    });

    if (overlap) {
      throw new BadRequestException(
        `Já existe uma máscara ativa no período informado (vigência: ${
          overlap.validFrom.toLocaleDateString('pt-BR')
        } → ${overlap.validTo?.toLocaleDateString('pt-BR') ?? 'indefinido'}).`
      );
    }

    return this.prisma.companyAccountingConfig.create({
      data: {
        companyId,
        mask: dto.mask,
        validFrom: dto.validFrom,
        validTo: dto.validTo ?? null,
        createdById: userId,
      },
    });
  }

  // ── Atualizar vigência ──────────────────────────────────────────────────────

  async closeMask(companyId: string, configId: string, validTo: Date) {
    const config = await this.prisma.companyAccountingConfig.findFirst({
      where: { id: configId, companyId },
    });
    if (!config) throw new NotFoundException('Configuração não encontrada.');

    return this.prisma.companyAccountingConfig.update({
      where: { id: configId },
      data: { validTo },
    });
  }

  // ── Validar código contra máscara vigente ───────────────────────────────────

  async validateCode(companyId: string, code: string, date?: Date): Promise<void> {
    const maskConfig = await this.getActiveMask(companyId, date);
    validateCodeAgainstMask(code, maskConfig.levels);
  }

  // ── Sugerir próximo código para filho ───────────────────────────────────────

  async suggestChildCode(companyId: string, parentId: string): Promise<{
    suggested: string;
    level: number;
    digits: number;
    maskConfig: MaskConfig;
  }> {
    const parent = await this.prisma.chartOfAccounts.findFirst({
      where: { id: parentId, companyId },
      include: {
        children: { select: { code: true } },
      },
    });

    if (!parent) throw new NotFoundException('Conta pai não encontrada.');

    const maskConfig = await this.getActiveMask(companyId);
    const childLevel = parent.level + 1;

    if (childLevel > maskConfig.totalLevels) {
      throw new BadRequestException(
        `A conta pai está no nível máximo (${maskConfig.totalLevels}) definido pela máscara. ` +
        `Não é possível criar subcontas.`
      );
    }

    const childDigits = maskConfig.levels[childLevel - 1];
    const existingChildCodes = parent.children.map(c => c.code);
    const suggested = suggestNextCode(parent.code, existingChildCodes, childDigits);

    return {
      suggested,
      level: childLevel,
      digits: childDigits,
      maskConfig,
    };
  }

  // ── Verificar consistência de todo o plano ──────────────────────────────────

  async auditPlan(companyId: string): Promise<{
    total: number;
    valid: number;
    invalid: Array<{ code: string; name: string; issue: string }>;
  }> {
    const maskConfig = await this.getActiveMask(companyId);
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, deletedAt: null },
      select: { code: true, name: true, level: true },
      orderBy: { code: 'asc' },
    });

    const invalid: Array<{ code: string; name: string; issue: string }> = [];

    for (const account of accounts) {
      try {
        validateCodeAgainstMask(account.code, maskConfig.levels);

        // Verificar se o nível calculado bate com o campo level
        const calculatedLevel = getLevelFromCode(account.code);
        if (calculatedLevel !== account.level) {
          invalid.push({
            code: account.code,
            name: account.name,
            issue: `Nível armazenado (${account.level}) diverge do calculado pelo código (${calculatedLevel})`,
          });
        }
      } catch (e: any) {
        invalid.push({
          code: account.code,
          name: account.name,
          issue: e.message,
        });
      }
    }

    return {
      total: accounts.length,
      valid: accounts.length - invalid.length,
      invalid,
    };
  }
}
