// apps/api/src/modules/accounting/services/journal-manual-import.service.ts
//
// CRIADO 03/09/2026 (Etapa 3 - historico por partida / importacao manual).
// Formato de arquivo dedicado, DIFERENTE do journal-importer.service.ts
// existente (que agrupa por lote|data|historico ja vindo pronto no arquivo).
// Aqui o NrLancto vem sempre vazio - a LEDGR gera a referencia
// (MANUAL-{ano}-{seq}) e agrupa automaticamente por acumulacao ate D=C
// bater, dentro da MESMA data. Nao reaproveita a logica de agrupamento do
// importador antigo de proposito: mudar aquela logica alteraria o
// comportamento de quem ja usa o formato antigo hoje.
//
// Layout esperado (pipe-delimitado):
//   Linha 1 (cabecalho): CNPJ|Tipo
//   Linhas seguintes:    Data|NrLancto|ContaDebito|ContaCredito|Historico|HP|Complemento|Valor
//     - Data: DDMMAAAA (sem separador)
//     - NrLancto: sempre vazio, ignorado na leitura (LEDGR atribui)
//     - ContaDebito/ContaCredito: uma das duas (partida simples fecha na
//       propria linha) ou so uma (partida dobrada - acumula ate D=C bater,
//       mesma data obrigatoria dentro do mesmo grupo)
//     - HP e Complemento: ignorados por ora (Historico Padrao - pendencia
//       registrada em LEDGR-contexto.md, tabela ainda nao existe)
//     - Valor: formato pt-BR (1.234,56 ou 1234,56)

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/client';

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

export interface ManualImportIssue {
  severity: 'error' | 'warning';
  ref: string;
  lineNum?: number;
  reason: string;
}

interface RawManualLine {
  lineNum: number;
  date: Date;
  dateStr: string;   // YYYY-MM-DD
  dateBR: string;    // DD/MM/YYYY
  contaDebito: string;
  contaCredito: string;
  historico: string;
  valor: Decimal;
}

interface ParsedManualItem {
  code: string;
  type: 'DEBIT' | 'CREDIT';
  value: Decimal;
  description: string;
}

interface ParsedManualEntry {
  date: Date;
  dateBR: string;
  items: ParsedManualItem[];
  descriptions: string[];
  lineNums: number[];
}

export interface ManualPreviewEntry {
  index: number; date: string; description: string;
  itemCount: number; debitTotal: string; creditTotal: string; balanced: boolean;
}

export interface ManualImportPreviewResult {
  entries: ManualPreviewEntry[]; issues: ManualImportIssue[]; hasErrors: boolean;
  totalEntries: number; totalLines: number;
}

export interface ManualImportLoteResumo {
  numero: number; ano: number; nomeArquivo: string | null;
  dataInicial: string; dataFinal: string;
  quantidadeLancamentos: number; totalDebito: string; totalCredito: string;
}

export interface ManualImportResult {
  inserted: number;
  errors: Array<{ ref: string; reason: string }>;
  issues: ManualImportIssue[];
  lotes: ManualImportLoteResumo[];
}

// ─────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────

function parseDecimalBR(raw: string): Decimal | null {
  const cleaned = raw.trim().replace(/\./g, '').replace(',', '.');
  if (!cleaned) return null;
  try { return new Decimal(cleaned); } catch { return null; }
}

function parseManualFile(content: string): {
  companyTaxId: string; tipo: string; entries: ParsedManualEntry[]; issues: ManualImportIssue[];
} {
  const lines = content.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim().length > 0);
  const issues: ManualImportIssue[] = [];

  if (lines.length === 0) {
    issues.push({ severity: 'error', ref: '?', reason: 'Arquivo vazio.' });
    return { companyTaxId: '', tipo: '', entries: [], issues };
  }

  // ── Linha 1: cabecalho CNPJ|Tipo ──────────────────────────────
  const headerParts = lines[0].split('|');
  const companyTaxId = (headerParts[0] || '').replace(/\D/g, '');
  const tipo = (headerParts[1] || '').trim() || 'Manual';

  if (companyTaxId.length !== 14) {
    issues.push({ severity: 'error', ref: '?', lineNum: 1, reason: `CNPJ inválido no cabeçalho: "${headerParts[0] || ''}" (esperado 14 dígitos)` });
  }

  const rawLines: RawManualLine[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('|');
    if (parts.length < 8) {
      issues.push({ severity: 'error', ref: '?', lineNum: i + 1, reason: `Linha com ${parts.length} campos (esperado 8: Data|NrLancto|Debito|Credito|Historico|HP|Complemento|Valor)` });
      continue;
    }

    const [rawDate, , contaDebitoRaw, contaCreditoRaw, rawHistorico, , , rawValor] = parts;
    const d = rawDate.trim();

    if (!/^\d{8}$/.test(d)) {
      issues.push({ severity: 'error', ref: '?', lineNum: i + 1, reason: `Data inválida: "${rawDate}" (esperado DDMMAAAA)` });
      continue;
    }
    const day = parseInt(d.slice(0, 2), 10);
    const month = parseInt(d.slice(2, 4), 10);
    const year = parseInt(d.slice(4, 8), 10);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (isNaN(date.getTime())) {
      issues.push({ severity: 'error', ref: '?', lineNum: i + 1, reason: `Data inválida: "${rawDate}"` });
      continue;
    }
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dateBR  = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;

    const contaDebito  = contaDebitoRaw.trim();
    const contaCredito = contaCreditoRaw.trim();
    const historico    = rawHistorico.trim();

    const valor = parseDecimalBR(rawValor);
    if (valor === null) {
      issues.push({ severity: 'error', ref: '?', lineNum: i + 1, reason: `Valor inválido: "${rawValor}"` });
      continue;
    }
    if (valor.lessThanOrEqualTo(0)) {
      issues.push({ severity: 'error', ref: '?', lineNum: i + 1, reason: `Valor deve ser maior que zero: "${rawValor}"` });
      continue;
    }
    if (!contaDebito && !contaCredito) {
      issues.push({ severity: 'error', ref: '?', lineNum: i + 1, reason: 'Linha sem conta de débito nem de crédito.' });
      continue;
    }
    if (contaDebito && contaCredito && contaDebito === contaCredito) {
      issues.push({ severity: 'error', ref: '?', lineNum: i + 1, reason: `Conta de débito e crédito iguais: "${contaDebito}"` });
      continue;
    }
    if (!historico) {
      issues.push({ severity: 'warning', ref: '?', lineNum: i + 1, reason: 'Linha sem histórico.' });
    }

    rawLines.push({ lineNum: i + 1, date, dateStr, dateBR, contaDebito, contaCredito, historico, valor });
  }

  // ── Agrupamento: partida simples fecha sozinha; partida dobrada
  //    acumula (mesma data obrigatoria) ate debito = credito ──────
  const entries: ParsedManualEntry[] = [];
  let openGroup: {
    dateStr: string; dateBR: string; items: ParsedManualItem[];
    descriptions: string[]; lineNums: number[]; runDebit: Decimal; runCredit: Decimal;
  } | null = null;

  const closeGroupIfBalanced = () => {
    if (openGroup && openGroup.runDebit.greaterThan(0) && openGroup.runDebit.equals(openGroup.runCredit)) {
      entries.push({
        date: new Date(`${openGroup.dateStr}T00:00:00.000Z`),
        dateBR: openGroup.dateBR,
        items: openGroup.items,
        descriptions: [...new Set(openGroup.descriptions)],
        lineNums: openGroup.lineNums,
      });
      openGroup = null;
    }
  };

  for (const l of rawLines) {
    const isSimples = !!l.contaDebito && !!l.contaCredito;

    if (isSimples) {
      entries.push({
        date: l.date,
        dateBR: l.dateBR,
        items: [
          { code: l.contaDebito,  type: 'DEBIT',  value: l.valor, description: l.historico },
          { code: l.contaCredito, type: 'CREDIT', value: l.valor, description: l.historico },
        ],
        descriptions: [l.historico],
        lineNums: [l.lineNum],
      });
      continue;
    }

    if (openGroup && (openGroup as any).dateStr !== l.dateStr) {
      issues.push({
        severity: 'error', ref: `grupo linha ${(openGroup as any).lineNums[0]}`, lineNum: l.lineNum,
        reason: `Data divergente dentro do mesmo grupo de partida dobrada: grupo em ${(openGroup as any).dateBR}, linha com ${l.dateBR}.`,
      });
      continue;
    }

    if (!openGroup) {
      openGroup = { dateStr: l.dateStr, dateBR: l.dateBR, items: [], descriptions: [], lineNums: [], runDebit: new Decimal(0), runCredit: new Decimal(0) };
    }

    if (l.contaDebito) {
      openGroup.items.push({ code: l.contaDebito, type: 'DEBIT', value: l.valor, description: l.historico });
      openGroup.runDebit = openGroup.runDebit.add(l.valor);
    } else {
      openGroup.items.push({ code: l.contaCredito, type: 'CREDIT', value: l.valor, description: l.historico });
      openGroup.runCredit = openGroup.runCredit.add(l.valor);
    }
    openGroup.descriptions.push(l.historico);
    openGroup.lineNums.push(l.lineNum);

    closeGroupIfBalanced();
  }

  if (openGroup) {
    const g = openGroup as any;
    issues.push({
      severity: 'error', ref: `grupo linha ${g.lineNums[0]}`,
      reason: `Grupo de partida dobrada não fechou: débito ${g.runDebit.toFixed(2)} ≠ crédito ${g.runCredit.toFixed(2)}.`,
    });
  }

  return { companyTaxId, tipo, entries, issues };
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

@Injectable()
export class JournalManualImportService {
  private readonly logger = new Logger(JournalManualImportService.name);
  constructor(private readonly prisma: PrismaService) {}

  // NOVO (10/09/2026): resolve identificador de conta por CONTAGEM DE
  // DIGITOS, nao mais por "OR: [code, reducedCode]" (causava colisao real -
  // codigo nativo ECD curto tipo "2101" e reduced_code Matriz "2101"
  // apontam pra contas DIFERENTES, e o OR sem filtro de origin escolhia a
  // errada). Regra: 11 digitos = codigo completo (Matriz, nivel 6, sempre
  // analitico); qualquer outro tamanho = codigo reduzido, buscado so em
  // origin=MATRIZ (nunca cai no code curto nativo). Exige a MESMA regra em
  // todo o arquivo - mistura de completo e reduzido no mesmo arquivo e erro.
  private classifyCodeUsage(allCodes: string[]): 'full' | 'reduced' | 'mixed' {
    const hasFull    = allCodes.some(c => c.length === 11);
    const hasReduced = allCodes.some(c => c.length !== 11);
    if (hasFull && hasReduced) return 'mixed';
    return hasFull ? 'full' : 'reduced';
  }

  private async resolveAccountCodes(companyId: string, allCodes: string[]) {
    const mode = this.classifyCodeUsage(allCodes);
    if (mode === 'mixed') {
      throw new BadRequestException(
        'O arquivo mistura código completo (11 dígitos) e código reduzido na mesma coluna de conta. ' +
        'Use um único padrão em todo o arquivo: ou sempre código completo, ou sempre código reduzido.'
      );
    }

    const found = mode === 'full'
      ? await this.prisma.chartOfAccounts.findMany({
          where: { companyId, code: { in: allCodes } },
          select: { id: true, code: true, reducedCode: true, isAnalytic: true },
        })
      : await this.prisma.chartOfAccounts.findMany({
          where: { companyId, origin: 'MATRIZ' as any, reducedCode: { in: allCodes } },
          select: { id: true, code: true, reducedCode: true, isAnalytic: true },
        });

    const codeToAccount = new Map<string, { id: string; code: string; reducedCode: string | null; isAnalytic: boolean }>();
    for (const a of found) {
      const key = mode === 'full' ? a.code : (a.reducedCode as string);
      codeToAccount.set(key, a);
    }
    return { mode, codeToAccount };
  }

  private async validateCompanyTaxId(companyId: string, fileTaxId: string, issues: ManualImportIssue[]) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { taxId: true, legalName: true } });
    if (!company) {
      issues.push({ severity: 'error', ref: '?', reason: 'Empresa não encontrada.' });
      return;
    }
    const storedDigits = (company.taxId || '').replace(/\D/g, '');
    if (fileTaxId && storedDigits && fileTaxId !== storedDigits) {
      issues.push({
        severity: 'error', ref: '?', lineNum: 1,
        reason: `CNPJ do arquivo (${fileTaxId}) não corresponde à empresa ativa "${company.legalName}" (${storedDigits}).`,
      });
    }
  }

  async preview(content: string, companyId: string): Promise<ManualImportPreviewResult> {
    const { companyTaxId, entries, issues } = parseManualFile(content);
    await this.validateCompanyTaxId(companyId, companyTaxId, issues);

    // CORRIGIDO (10/09/2026): resolucao por contagem de digitos, ver
    // classifyCodeUsage/resolveAccountCodes - elimina a colisao entre codigo
    // nativo ECD curto e reduced_code Matriz do mesmo numero.
    const allCodes = [...new Set(entries.flatMap(e => e.items.map(i => i.code)))];
    let codeToAccount: Map<string, { id: string; code: string; reducedCode: string | null; isAnalytic: boolean }>;
    try {
      ({ codeToAccount } = await this.resolveAccountCodes(companyId, allCodes));
    } catch (e: any) {
      issues.push({ severity: 'error', ref: '?', reason: e.message });
      codeToAccount = new Map();
    }

    entries.forEach((entry, idx) => {
      entry.items.forEach((item, itemIdx) => {
        const acc = codeToAccount.get(item.code);
        if (!acc) {
          issues.push({ severity: 'error', ref: `lançamento ${idx + 1}`, lineNum: entry.lineNums[itemIdx], reason: `Conta ${item.code} não cadastrada no plano de contas.` });
        } else if (!acc.isAnalytic) {
          issues.push({ severity: 'warning', ref: `lançamento ${idx + 1}`, lineNum: entry.lineNums[itemIdx], reason: `Conta ${item.code} é sintética.` });
        }
      });
    });

    const hasErrors = issues.some(i => i.severity === 'error');

    const previewEntries: ManualPreviewEntry[] = entries.slice(0, 20).map((e, idx) => {
      const totalDebit  = e.items.filter(i => i.type === 'DEBIT').reduce((s, i) => s.add(i.value), new Decimal(0));
      const totalCredit = e.items.filter(i => i.type === 'CREDIT').reduce((s, i) => s.add(i.value), new Decimal(0));
      return {
        index: idx + 1,
        date: e.date.toISOString().slice(0, 10),
        description: e.descriptions.join('; '),
        itemCount: e.items.length,
        debitTotal: totalDebit.toFixed(2),
        creditTotal: totalCredit.toFixed(2),
        balanced: totalDebit.equals(totalCredit),
      };
    });

    return {
      entries: previewEntries, issues, hasErrors,
      totalEntries: entries.length,
      totalLines: entries.reduce((s, e) => s + e.items.length, 0),
    };
  }

  // NOVO (10/09/2026): cria/reutiliza um ImportLote por ano tocado pelo
  // arquivo, com numero sequencial atomico (pg_advisory_xact_lock evita
  // duas importacoes simultaneas da mesma empresa duplicarem o numero -
  // a trava e liberada automaticamente ao fim da transacao). Precisa
  // constar no Livro Diario/Razao (requisito do usuario).
  private async getOrCreateLoteForYear(
    tx: any, companyId: string, ano: number, tipo: string, nomeArquivo: string | undefined, createdById: string,
  ) {
    // Trava por empresa (hashtext do UUID) - serializa so quem disputa a
    // MESMA empresa; outras empresas importam em paralelo sem bloqueio.
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('${companyId}'))`);

    const maxRow: { numero: number | null }[] = await tx.$queryRawUnsafe(
      `SELECT MAX(numero)::int AS numero FROM import_lotes WHERE company_id = '${companyId}'::uuid AND ano = ${ano}`,
    );
    const nextNumero = (maxRow[0]?.numero ?? 0) + 1;

    // CORRIGIDO (10/09/2026): retorna o lote inteiro (nao so o id) - o
    // caller precisa de lote.numero pra montar a capa de lote na resposta.
    return tx.importLote.create({
      data: {
        companyId, ano, numero: nextNumero,
        nomeArquivo: nomeArquivo || null,
        tipo,
        createdById,
      },
    });
  }

  // NOVO (10/09/2026): checa se o mesmo nome de arquivo ja foi importado
  // pra essa empresa antes - achado real de duplicacao (usuario confirmou
  // 3 clicks em "Confirmar Importacao" durante o teste, sem nenhum aviso,
  // gerando 3x os lancamentos). Retorna a lista de lotes conflitantes; o
  // caller (controller) so segue com a gravacao se overrideDuplicate=true.
  async checkDuplicateFile(companyId: string, fileName: string | undefined) {
    if (!fileName) return [];
    return this.prisma.importLote.findMany({
      where: { companyId, nomeArquivo: fileName, deletedAt: null },
      select: { id: true, ano: true, numero: true, createdAt: true, quantidadeLancamentos: true },
      orderBy: [{ ano: 'desc' }, { numero: 'desc' }],
    });
  }

  // Remove (hard delete) um lote e todos os lancamentos/itens vinculados a
  // ele - usado quando o usuario confirma "sobrepor" um arquivo ja importado.
  private async hardDeleteLote(loteId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.journalEntryItem.deleteMany({
        where: { journalEntry: { importLoteId: loteId } },
      });
      await tx.journalEntry.deleteMany({ where: { importLoteId: loteId } });
      await tx.importLote.delete({ where: { id: loteId } });
    });
  }

  async import(content: string, companyId: string, createdById: string, fileName?: string, overrideDuplicate = false): Promise<ManualImportResult> {
    const { companyTaxId, entries, issues } = parseManualFile(content);
    await this.validateCompanyTaxId(companyId, companyTaxId, issues);

    if (issues.some(i => i.severity === 'error')) {
      throw new BadRequestException('Arquivo contém erros. Corrija antes de importar.');
    }

    const duplicates = await this.checkDuplicateFile(companyId, fileName);
    if (duplicates.length > 0 && !overrideDuplicate) {
      throw new BadRequestException({
        message: `O arquivo "${fileName}" já foi importado anteriormente (lote(s) ${duplicates.map(d => `${d.numero}/${d.ano}`).join(', ')}). Confirme se deseja sobrepor.`,
        duplicateLotes: duplicates,
      });
    }
    if (duplicates.length > 0 && overrideDuplicate) {
      for (const d of duplicates) await this.hardDeleteLote(d.id);
    }

    // CORRIGIDO (10/09/2026): mesmo resolver por digitos do preview() -
    // ver classifyCodeUsage/resolveAccountCodes.
    const allCodes = [...new Set(entries.flatMap(e => e.items.map(i => i.code)))];
    const { codeToAccount } = await this.resolveAccountCodes(companyId, allCodes);
    const codeToId = new Map<string, string>();
    for (const [key, acc] of codeToAccount) codeToId.set(key, acc.id);
    const missingCodes = allCodes.filter(c => !codeToId.has(c));
    if (missingCodes.length > 0) {
      throw new BadRequestException(`Contas não encontradas: ${missingCodes.join(', ')}`);
    }

    // Numeracao sequencial MANUAL-{ano}-{seq}, continua de onde parou por ano
    const seqByYear = new Map<number, number>();
    const getNextRef = async (year: number): Promise<string> => {
      if (!seqByYear.has(year)) {
        const prefix = `MANUAL-${year}-`;
        const last = await this.prisma.journalEntry.findFirst({
          where: { companyId, reference: { startsWith: prefix } },
          orderBy: { reference: 'desc' },
          select: { reference: true },
        });
        const lastSeq = last?.reference ? (parseInt(last.reference.replace(prefix, ''), 10) || 0) : 0;
        seqByYear.set(year, lastSeq);
      }
      const next = (seqByYear.get(year) as number) + 1;
      seqByYear.set(year, next);
      return `MANUAL-${year}-${String(next).padStart(4, '0')}`;
    };

    const result: ManualImportResult = { inserted: 0, errors: [], issues, lotes: [] };
    const loteIdByYear = new Map<number, string>();
    const loteStats = new Map<string, { numero: number; ano: number; count: number; debit: Decimal; credit: Decimal; minDate: Date; maxDate: Date }>();

    // CORRIGIDO (10/09/2026): a transacao interativa do Prisma tem timeout
    // padrao de 5000ms - com centenas de lancamentos, o processo inteiro
    // passa disso e a transacao expira, desfazendo TUDO (regressao: antes
    // cada lancamento falhava/tinha sucesso independente, via try/catch
    // por item). A trava atomica (pg_advisory_xact_lock) so precisa
    // proteger a CRIACAO DO LOTE em si (rapida, um insert so) - roda numa
    // transacao curta e separada; o loop de criacao dos lancamentos volta
    // a rodar FORA de transacao, como era antes desta feature.
    for (const entry of entries) {
      const year = entry.date.getUTCFullYear();
      const reference = await getNextRef(year);

      if (!loteIdByYear.has(year)) {
        const lote = await this.prisma.$transaction(
          (tx) => this.getOrCreateLoteForYear(tx, companyId, year, 'MANUAL', fileName, createdById),
        );
        loteIdByYear.set(year, lote.id);
        loteStats.set(lote.id, { numero: lote.numero, ano: year, count: 0, debit: new Decimal(0), credit: new Decimal(0), minDate: entry.date, maxDate: entry.date });
      }
      const loteId = loteIdByYear.get(year)!;

      try {
        await this.prisma.journalEntry.create({
          data: {
            companyId,
            date: entry.date,
            description: entry.descriptions.join('; '),
            reference,
            sourceModule: 'ACCOUNTING',
            createdById,
            importLoteId: loteId,
            items: {
              create: entry.items.map(i => ({
                accountId: codeToId.get(i.code)!,
                type: i.type,
                value: i.value.toNumber(),
                description: i.description || null,
              })),
            },
          },
        });
        result.inserted++;

        const stats = loteStats.get(loteId)!;
        stats.count++;
        if (entry.date < stats.minDate) stats.minDate = entry.date;
        if (entry.date > stats.maxDate) stats.maxDate = entry.date;
        for (const i of entry.items) {
          if (i.type === 'DEBIT') stats.debit = stats.debit.add(i.value);
          else stats.credit = stats.credit.add(i.value);
        }
      } catch (e: any) {
        result.errors.push({ ref: reference, reason: e.message });
      }
    }

    // Atualiza os totais agregados de cada lote tocado pelo arquivo e monta
    // a "capa" (resumo) retornada pra tela de sucesso.
    for (const [loteId, stats] of loteStats) {
      await this.prisma.importLote.update({
        where: { id: loteId },
        data: {
          quantidadeLancamentos: stats.count,
          totalDebito: stats.debit.toNumber(),
          totalCredito: stats.credit.toNumber(),
        },
      });
      result.lotes.push({
        numero: stats.numero,
        ano: stats.ano,
        nomeArquivo: fileName || null,
        dataInicial: stats.minDate.toISOString().slice(0, 10),
        dataFinal: stats.maxDate.toISOString().slice(0, 10),
        quantidadeLancamentos: stats.count,
        totalDebito: stats.debit.toFixed(2),
        totalCredito: stats.credit.toFixed(2),
      });
    }

    this.logger.log(`[JournalManualImport] inseridos: ${result.inserted} | erros: ${result.errors.length}`);
    return result;
  }
}
