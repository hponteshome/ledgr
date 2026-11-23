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
// CODPURO-02 (23/11/2026): codigo de conta e SEMPRE puro (so digitos). A mascara define
// apenas o tamanho de cada nivel e e aplicada so na exibicao/digitacao.
// Mascara aceita nos dois formatos: "0.0.0.00.00.0000" (tamanho = quantidade de zeros)
// ou "1.1.1.2.2.4" (tamanho = numero). Padrao LEDGR: 1-1-1-2-2-4 (codigos de 1, 2, 3, 5, 7 e 11 digitos).

export const DEFAULT_MASK = '0.0.0.00.00.0000';

/** "0.0.0.00.00.0000" ou "1.1.1.2.2.4" -> [1, 1, 1, 2, 2, 4] */
export function parseMask(mask: string): number[] {
  const parts = mask.split('.');
  const levels = parts.map(p => {
    const n = /^0+$/.test(p) ? p.length : parseInt(p, 10);
    if (isNaN(n) || n < 1 || n > 9) {
      throw new BadRequestException(
        `Máscara inválida: "${mask}". Cada nível deve ter de 1 a 9 dígitos (ex.: 0.0.0.00.00.0000).`
      );
    }
    return n;
  });
  if (levels.length < 1 || levels.length > 8) {
    throw new BadRequestException(`Máscara inválida: deve ter entre 1 e 8 níveis.`);
  }
  return levels;
}

/** Tamanhos acumulados: [1,1,1,2,2,4] -> [1,2,3,5,7,11] */
export function cumulativeLengths(levels: number[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const l of levels) { acc += l; out.push(acc); }
  return out;
}

/** Valida codigo PURO contra a mascara: so digitos e comprimento de algum nivel. */
export function validateCodeAgainstMask(code: string, levels: number[]): void {
  if (!/^\d+$/.test(code)) {
    throw new BadRequestException(
      `Código "${code}" inválido: use só dígitos, sem máscara (a máscara é aplicada na exibição).`
    );
  }
  const lens = cumulativeLengths(levels);
  if (!lens.includes(code.length)) {
    throw new BadRequestException(
      `Código "${code}" inválido: ${code.length} dígito(s) não corresponde a nenhum nível da máscara (válidos: ${lens.join(', ')}).`
    );
  }
}

/** Nivel pelo comprimento do codigo puro (0 = comprimento fora da mascara). */
export function getLevelFromCode(code: string, levels: number[] = parseMask(DEFAULT_MASK)): number {
  return cumulativeLengths(levels).indexOf(code.length) + 1;
}

/** Exibicao: "11104040001" com [1,1,1,2,2,4] -> "1.1.1.04.04.0001" */
export function formatCodeWithMask(code: string, levels: number[] = parseMask(DEFAULT_MASK)): string {
  const parts: string[] = [];
  let cur = 0;
  for (const l of levels) {
    const chunk = code.slice(cur, cur + l);
    if (!chunk) break;
    parts.push(chunk);
    cur += l;
  }
  if (cur < code.length) parts.push(code.slice(cur));
  return parts.join('.');
}

/** Proximo codigo filho: pai "11104" + filhos ["1110401","1110402"], 2 digitos -> "1110403" */
export function suggestNextCode(
  parentCode: string,
  existingChildren: string[],
  childDigits: number,
): string {
  const nums = existingChildren
    .filter(c => c.startsWith(parentCode) && c.length === parentCode.length + childDigits)
    .map(c => parseInt(c.slice(parentCode.length), 10))
    .filter(n => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${parentCode}${String(next).padStart(childDigits, '0')}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AccountingMaskService {
  constructor(private prisma: PrismaService) {}

  // ── Obter config vigente ────────────────────────────────────────────────────

  async getActiveMask(companyId: string, date?: Date): Promise<MaskConfig> {
    const refDate = date ?? new Date();

    const config = await this.prisma.companyMaskConfig.findFirst({
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
      const defaultMask = DEFAULT_MASK; // CODPURO-02: padrao LEDGR (1-2-3-5-7-11 digitos)
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
    return this.prisma.companyMaskConfig.findMany({
      where: { companyId },
      orderBy: { validFrom: 'desc' },
    });
  }

  // ── Criar nova máscara ──────────────────────────────────────────────────────

  async createMask(companyId: string, userId: string, dto: CreateMaskDto) {
    // Validar formato da máscara
    const levels = parseMask(dto.mask);

    // Verificar sobreposição de períodos
    const overlap = await this.prisma.companyMaskConfig.findFirst({
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

    return this.prisma.companyMaskConfig.create({
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
    const config = await this.prisma.companyMaskConfig.findFirst({
      where: { id: configId, companyId },
    });
    if (!config) throw new NotFoundException('Configuração não encontrada.');

    return this.prisma.companyMaskConfig.update({
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
        const calculatedLevel = getLevelFromCode(account.code, maskConfig.levels); // CODPURO-02
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

