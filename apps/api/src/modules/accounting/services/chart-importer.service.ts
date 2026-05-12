import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { AccountNature, AccountType } from '@prisma/client';

export interface ParsedAccount {
  code: string; reducedCode: string | null; name: string; level: number;
  nature: AccountNature; type: AccountType; spedCode: string | null; isAnalytic: boolean;
}

export interface StructureError   { lineNum: number; content: string; reason: string; severity: 'error'; }
export interface StructureWarning { lineNum: number; content: string; reason: string; severity: 'warning'; }
export type StructureIssue = StructureError | StructureWarning;

export interface PreviewResult {
  rows: ParsedAccount[];
  issues: StructureIssue[];
  hasErrors: boolean;
}

export interface ImportResult {
  inserted: number;
  errors: Array<{ code: string; name: string; reason: string }>;
  issues: StructureIssue[];
}

function inferType(code: string): AccountType {
  if (code[0] === '1') return AccountType.ASSET;
  if (code[0] === '2') return code.startsWith('23') ? AccountType.EQUITY : AccountType.LIABILITY;
  if (code[0] === '3') return AccountType.REVENUE;
  return AccountType.EXPENSE;
}

function findParentCode(code: string, codeSet: Set<string>): string | null {
  for (let len = code.length - 1; len >= 1; len--) {
    const candidate = code.slice(0, len);
    if (codeSet.has(candidate)) return candidate;
  }
  return null;
}

interface ParseError { isError: true; content: string; reason: string; }

function parseLine(line: string): ParsedAccount | ParseError | null {
  if (line.trim().length === 0) return null;
  if (line.length < 134) return { isError: true, content: line.slice(0, 30).trim(), reason: `Linha curta demais (${line.length} chars, mínimo 134)` };

  const code       = line.slice(0, 20).trim();
  const reducedRaw = line.slice(20, 27).trim();
  const name       = line.slice(27, 117).trim();
  const levelRaw   = line.slice(127, 132).trim();
  const natureChar = line.slice(133, 134).trim();

  if (!code)       return { isError: true, content: line.slice(0, 30).trim(), reason: 'Código ausente (col 0-19)' };
  if (!name)       return { isError: true, content: code, reason: 'Nome ausente (col 27-116)' };
  if (!levelRaw)   return { isError: true, content: code, reason: 'Nível ausente (col 127-131)' };
  if (!natureChar) return { isError: true, content: code, reason: 'Natureza D/C ausente (col 133)' };

  const level = parseInt(levelRaw[0], 10);
  if (isNaN(level)) return { isError: true, content: code, reason: `Nível inválido: "${levelRaw[0]}"` };

  const nature: AccountNature = natureChar.toUpperCase() === 'D' ? AccountNature.DEBIT : AccountNature.CREDIT;
  const isAnalytic = level === 6;
  const reducedCode = isAnalytic && reducedRaw && reducedRaw !== '0000000' ? reducedRaw : null;

  const parts   = line.trimEnd().split(/\s{2,}/);
  const spedRaw = parts[parts.length - 1].trim();
  const spedCode = /^\d+(\.\d+)+$/.test(spedRaw) ? spedRaw : null;

  return { code, reducedCode, name, level, nature, type: inferType(code), spedCode, isAnalytic };
}

function normalizeLines(content: string): string[] {
  return content.split('\n').map(l => l.replace(/\r$/, ''));
}

function parseAll(content: string): { accounts: ParsedAccount[]; issues: StructureIssue[]; hasErrors: boolean } {
  const accounts: ParsedAccount[] = [];
  const issues: StructureIssue[]  = [];
  const seenCodes = new Map<string, number>();
  const lines = normalizeLines(content);

  for (let i = 0; i < lines.length; i++) {
    const result = parseLine(lines[i]);
    if (!result) continue;

    if ('isError' in result) {
      issues.push({ lineNum: i + 1, content: result.content, reason: result.reason, severity: 'error' });
      continue;
    }

    // Duplicata no arquivo = erro estrutural
    if (seenCodes.has(result.code)) {
      issues.push({ lineNum: i + 1, content: result.code, reason: `Código duplicado no arquivo (primeira ocorrência: linha ${seenCodes.get(result.code)})`, severity: 'error' });
      continue;
    }
    seenCodes.set(result.code, i + 1);

    // Analítica sem spedCode = aviso
    if (result.isAnalytic && !result.spedCode) {
      issues.push({ lineNum: i + 1, content: result.code, reason: 'Conta analítica sem código SPED', severity: 'warning' });
    }

    accounts.push(result);
  }

  const hasErrors = issues.some(i => i.severity === 'error');
  return { accounts, issues, hasErrors };
}

@Injectable()
export class ChartImporterService {
  private readonly logger = new Logger(ChartImporterService.name);
  constructor(private readonly prisma: PrismaService) {}

  preview(content: string, maxLines = 8): PreviewResult {
    const { accounts, issues, hasErrors } = parseAll(content);
    return { rows: accounts.slice(0, maxLines), issues, hasErrors };
  }

  async import(companyId: string, content: string, createdById: string): Promise<ImportResult> {
    const { accounts, issues, hasErrors } = parseAll(content);

    if (hasErrors)
      throw new BadRequestException(`Arquivo contém ${issues.filter(i => i.severity === 'error').length} erro(s) estrutural(is). Corrija o arquivo antes de importar.`);

    if (accounts.length === 0)
      throw new BadRequestException('Nenhuma conta válida encontrada no arquivo.');

    this.logger.log(`[ChartImporter] ${accounts.length} contas | empresa ${companyId}`);

    const result: ImportResult = { inserted: 0, errors: [], issues };
    const codeSet  = new Set(accounts.map(a => a.code));
    const codeToId = new Map<string, string>();

    // Apaga plano existente
    try {
      await this.prisma.chartOfAccounts.deleteMany({ where: { companyId } });
    } catch {
      throw new BadRequestException('Existem lançamentos vinculados ao plano atual. Exclua-os antes de reimportar.');
    }

    // Insere em ordem de nível — sem transação global para evitar cascata de abort
    const sorted = [...accounts].sort((a, b) => a.level - b.level);

    for (const acc of sorted) {
      const parentCode = findParentCode(acc.code, codeSet);
      const parentId   = parentCode ? (codeToId.get(parentCode) ?? null) : null;
      try {
        const created = await this.prisma.chartOfAccounts.create({
          data: { companyId, code: acc.code, name: acc.name, level: acc.level,
                  type: acc.type, nature: acc.nature, isAnalytic: acc.isAnalytic,
                  parentId, spedCode: acc.spedCode, reducedCode: acc.reducedCode, createdById },
        });
        codeToId.set(acc.code, created.id);
        result.inserted++;
      } catch (e) {
        result.errors.push({ code: acc.code, name: acc.name, reason: e.message });
      }
    }

    this.logger.log(`[ChartImporter] inseridas: ${result.inserted} | erros: ${result.errors.length}`);
    return result;
  }
}
