// apps/api/src/modules/sped/ecd/services/ecd-exporter.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';

export interface EcdExportOptions {
  companyId: string;
  periodStart: Date;
  periodEnd: Date;
  bookNumber?: string;
  bookNature?: string;
  bookType?: 'G' | 'R' | 'B';
  layoutVersion?: string;
}

@Injectable()
export class EcdExporterService {
  private readonly logger = new Logger(EcdExporterService.name);
  constructor(private prisma: PrismaService) {}

  async export(options: EcdExportOptions): Promise<Buffer> {
    const {
      companyId, periodStart, periodEnd,
      bookNumber = '1', bookNature = 'DIARIO E BALANCETES',
      bookType = 'G', layoutVersion = '9.00',
    } = options;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { taxId: true, legalName: true, state: true, city: true },
    });
    if (!company) throw new Error('Empresa nao encontrada.');

    const cnpj  = company.taxId.replace(/\D/g, '');
    const dtIni = this.fmtDate(periodStart);
    const dtFin = this.fmtDate(periodEnd);

    // Plano de contas
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
    });
    const codeById    = new Map(accounts.map(a => [a.id, a.code]));
    const analyticIds = new Set(accounts.filter(a => a.isAnalytic).map(a => a.id));
    const accountById = new Map(accounts.map(a => [a.id, a]));

    // Lancamentos do periodo
    const entries = await this.prisma.journalEntry.findMany({
      where: { companyId, date: { gte: periodStart, lte: periodEnd }, deletedAt: null },
      include: { items: { include: { account: { select: { code: true } } } } },
      orderBy: { date: 'asc' },
    });

    // Saldo inicial: exclusivamente do account_balance (ECD anterior)
    const i155Rows = await this.prisma.accountBalance.findMany({
      where: { companyId, referenceDate: { lt: new Date(periodStart) } },
      orderBy: { referenceDate: 'desc' },
    });
    const saldoIni = new Map<string, number>();
    for (const row of i155Rows) {
      if (!saldoIni.has(row.accountId) && analyticIds.has(row.accountId))
        saldoIni.set(row.accountId, Number(row.balance));
    }

    // Movimentos do periodo por mes e conta (apenas analiticas)
    const periodItems = await this.prisma.journalEntryItem.findMany({
      where: { journalEntry: { companyId, date: { gte: periodStart, lte: periodEnd }, deletedAt: null } },
      select: { accountId: true, type: true, value: true, journalEntry: { select: { date: true } } },
    });
    const byMonthAcc = new Map<string, Map<string, { deb: number; cre: number }>>();
    for (const item of periodItems) {
      if (!analyticIds.has(item.accountId)) continue;
      const d   = item.journalEntry.date instanceof Date ? item.journalEntry.date : new Date(item.journalEntry.date);
      const key = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
      if (!byMonthAcc.has(key)) byMonthAcc.set(key, new Map());
      const accMap = byMonthAcc.get(key)!;
      if (!accMap.has(item.accountId)) accMap.set(item.accountId, { deb: 0, cre: 0 });
      const mv = accMap.get(item.accountId)!;
      if (item.type === 'DEBIT') mv.deb += Number(item.value);
      else                       mv.cre += Number(item.value);
    }

    // Movimentos totais do periodo (para BP e DRE)
    const allPeriodItems = await this.prisma.journalEntryItem.findMany({
      where: { journalEntry: { companyId, date: { gte: periodStart, lte: periodEnd }, deletedAt: null } },
      select: { accountId: true, type: true, value: true },
    });

    // Saldo final por conta analitica (para BP)
    const saldoFinalMap = new Map<string, number>(saldoIni);
    for (const item of allPeriodItems) {
      if (!analyticIds.has(item.accountId)) continue;
      const cur = saldoFinalMap.get(item.accountId) ?? 0;
      saldoFinalMap.set(item.accountId, cur + (item.type === 'DEBIT' ? 1 : -1) * Number(item.value));
    }

    // Rollup bottom-up para sinteticas
    const rollupMap = new Map<string, number>(saldoFinalMap);
    const idToCode  = new Map(accounts.map(a => [a.id, a.code]));
    const sorted    = [...accounts].sort((a, b) => idToCode.get(b.id)!.localeCompare(idToCode.get(a.id)!));
    for (const acc of sorted) {
      if (!acc.parentId) continue;
      const child = rollupMap.get(acc.id) ?? 0;
      rollupMap.set(acc.parentId, (rollupMap.get(acc.parentId) ?? 0) + child);
    }

    // Movimentos de resultado do periodo por conta (para DRE)
    const dreMap = new Map<string, { deb: number; cre: number }>();
    for (const item of allPeriodItems) {
      const acc = accountById.get(item.accountId);
      if (!acc || !['REVENUE', 'EXPENSE'].includes(acc.type.toString())) continue;
      if (!dreMap.has(item.accountId)) dreMap.set(item.accountId, { deb: 0, cre: 0 });
      const mv = dreMap.get(item.accountId)!;
      if (item.type === 'DEBIT') mv.deb += Number(item.value);
      else                       mv.cre += Number(item.value);
    }
    // Rollup DRE para sinteticas
    const dreRollup = new Map<string, { deb: number; cre: number }>(dreMap);
    for (const acc of sorted) {
      if (!acc.parentId) continue;
      if (!['REVENUE', 'EXPENSE'].includes(acc.type.toString())) continue;
      const child  = dreRollup.get(acc.id) ?? { deb: 0, cre: 0 };
      const parent = dreRollup.get(acc.parentId) ?? { deb: 0, cre: 0 };
      dreRollup.set(acc.parentId, { deb: parent.deb + child.deb, cre: parent.cre + child.cre });
    }

    const months = this.monthRange(periodStart, periodEnd);
    const lines: string[] = [];
    const add = (l: string) => lines.push(l);
    const P = '|';

    // BLOCO 0
    add('|0000|LECD|'+dtIni+'|'+dtFin+'|'+company.legalName+'|'+cnpj+'|'+company.state+'|||||0|0|0||0|0||N|N|0|0||');
    add(P+'0001'+P+'0'+P);
    add(P+'0007'+P+cnpj+P+P);
    const idx0990 = lines.length;
    add(P+'0990'+P+'PLACEHOLDER'+P);

    // BLOCO C (vazio)
    add(P+'C001'+P+'1'+P);
    add(P+'C990'+P+'2'+P);

    // BLOCO I
    add(P+'I001'+P+'0'+P);
    add(P+'I010'+P+bookType+P+layoutVersion+P);
    add(P+'I030'+P+dtIni+P+bookNumber+P+bookNature.toUpperCase()+P+'0'+P+company.legalName+P+P+cnpj+P+P+P+company.city+P+dtFin+P);

    // I050 — plano de contas
    for (const acc of accounts) {
      const dtAlt      = this.fmtDate(acc.createdAt);
      const natCode    = this.typeToNat(acc.type.toString());
      const indCta     = acc.isAnalytic ? 'A' : 'S';
      const parentCode = acc.parentId ? (codeById.get(acc.parentId) ?? '') : '';
      add(P+'I050'+P+dtAlt+P+natCode+P+indCta+P+acc.level+P+acc.code+P+parentCode+P+acc.name+P);
    }

    // I150/I155
    const saldoCorrente = new Map<string, number>(saldoIni);
    for (const { year, month, firstDay, lastDay } of months) {
      const monthKey = year + '-' + String(month).padStart(2, '0');
      const accMap   = byMonthAcc.get(monthKey);
      const contasDoMes = new Set<string>([
        ...Array.from(saldoCorrente.entries()).filter(([, v]) => v !== 0).map(([k]) => k),
        ...(accMap ? Array.from(accMap.keys()) : []),
      ]);
      if (accMap) {
        for (const [aid, mv] of accMap) {
          if (!contasDoMes.has(aid)) saldoCorrente.set(aid, (saldoCorrente.get(aid) ?? 0) + mv.deb - mv.cre);
        }
      }
      if (contasDoMes.size === 0) continue;
      add(P+'I150'+P+this.fmtDate(firstDay)+P+this.fmtDate(lastDay)+P);
      const sortedContas = Array.from(contasDoMes).sort((a, b) => (codeById.get(a) ?? '').localeCompare(codeById.get(b) ?? ''));
      for (const aid of sortedContas) {
        const mv     = accMap?.get(aid) ?? { deb: 0, cre: 0 };
        const sldIni = saldoCorrente.get(aid) ?? 0;
        const sldFin = sldIni + mv.deb - mv.cre;
        saldoCorrente.set(aid, sldFin);
        const cod   = codeById.get(aid) ?? '';
        const dcIni = sldIni >= 0 ? 'D' : 'C';
        const dcFin = sldFin >= 0 ? 'D' : 'C';
        add(P+'I155'+P+cod+P+P+this.fmtDec(Math.abs(sldIni))+P+dcIni+P+this.fmtDec(mv.deb)+P+this.fmtDec(mv.cre)+P+this.fmtDec(Math.abs(sldFin))+P+dcFin+P);
      }
    }

    // I200/I250
    let lctoNum = 1;
    for (const entry of entries) {
      if (!entry.items.length) continue;
      const totalDeb = entry.items.filter(i => i.type === 'DEBIT').reduce((s, i) => s + Number(i.value), 0);
      const numLcto  = String(lctoNum++).padStart(6, '0');
      const hist     = (entry.description || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9 \-]/g, ' ')
        .replace(/\s+/g, ' ').trim().substring(0, 40);
      const dt = entry.date instanceof Date ? entry.date : new Date(entry.date);
      add(P+'I200'+P+numLcto+P+this.fmtDate(dt)+P+this.fmtDec(totalDeb)+P+'N'+P+P);
      for (const item of entry.items) {
        const sign = item.type === 'DEBIT' ? 'D' : 'C';
        add(P+'I250'+P+item.account.code+P+P+this.fmtDec(Number(item.value))+P+sign+P+P+P+hist+P+P);
      }
    }

    const idxI001   = lines.findIndex(l => l === P+'I001'+P+'0'+P);
    const blocoIQtd = lines.length - idxI001;
    add(P+'I990'+P+(blocoIQtd + 1)+P);

    // ── BLOCO J ──────────────────────────────────────────────────────────
    add(P+'J001'+P+'0'+P);

    // J005 — identificacao do BP e DRE
    // |J005|DT_INI|DT_FIN|MOEDA|ESCALA_MON|IND_ESC|NOME_AUDITOR|NR_CRC_AUDITOR|CNPJ_AUDITOR|
    add(P+'J005'+P+dtIni+P+dtFin+P+'BRL'+P+'1'+P+'1'+P+P+P+P);

    // J100 — Balanco Patrimonial (contas ASSET, LIABILITY, EQUITY)
    // |J100|COD_CTA|DESC_CTA|COD_CTA_SUPERIOR|COD_NAT|IND_CTA|NÍVEL|VL_CTA_FIN|IND_DC_FIN|
    const bpTypes = new Set(['ASSET', 'LIABILITY', 'EQUITY']);
    for (const acc of accounts) {
      if (!bpTypes.has(acc.type.toString())) continue;
      const saldo      = rollupMap.get(acc.id) ?? 0;
      if (saldo === 0 && !acc.isAnalytic) continue; // omitir sinteticas zeradas
      const parentCode = acc.parentId ? (codeById.get(acc.parentId) ?? '') : '';
      const natCode    = this.typeToNat(acc.type.toString());
      const indCta     = acc.isAnalytic ? 'A' : 'S';
      const dc         = saldo >= 0 ? 'D' : 'C';
      add(P+'J100'+P+acc.code+P+acc.name+P+parentCode+P+natCode+P+indCta+P+acc.level+P+this.fmtDec(Math.abs(saldo))+P+dc+P);
    }

    // J150 — totais do BP por nivel (linhas de nivel 1)
    // |J150|COD_AGL|DESC_AGL|VL_CTA|IND_DC|
    const nivel1Bp = accounts.filter(a => a.level === 1 && bpTypes.has(a.type.toString()));
    for (const acc of nivel1Bp) {
      const saldo = rollupMap.get(acc.id) ?? 0;
      const dc    = saldo >= 0 ? 'D' : 'C';
      add(P+'J150'+P+acc.code+P+acc.name+P+this.fmtDec(Math.abs(saldo))+P+dc+P);
    }

    // J210 — DRE (contas REVENUE, EXPENSE)
    // |J210|COD_CTA|DESC_CTA|COD_CTA_SUPERIOR|COD_NAT|IND_CTA|NÍVEL|VL_CTA_FIN|IND_DC_FIN|
    const dreTypes = new Set(['REVENUE', 'EXPENSE']);
    for (const acc of accounts) {
      if (!dreTypes.has(acc.type.toString())) continue;
      const mv    = dreRollup.get(acc.id) ?? { deb: 0, cre: 0 };
      const saldo = mv.cre - mv.deb; // receita positiva = credito; despesa positiva = debito
      if (saldo === 0 && !acc.isAnalytic) continue;
      const parentCode = acc.parentId ? (codeById.get(acc.parentId) ?? '') : '';
      const natCode    = this.typeToNat(acc.type.toString());
      const indCta     = acc.isAnalytic ? 'A' : 'S';
      const dc         = saldo >= 0 ? 'C' : 'D';
      add(P+'J210'+P+acc.code+P+acc.name+P+parentCode+P+natCode+P+indCta+P+acc.level+P+this.fmtDec(Math.abs(saldo))+P+dc+P);
    }

    // J215 — totais DRE por nivel 1
    // |J215|COD_AGL|DESC_AGL|VL_CTA|IND_DC|
    const nivel1Dre = accounts.filter(a => a.level === 1 && dreTypes.has(a.type.toString()));
    for (const acc of nivel1Dre) {
      const mv    = dreRollup.get(acc.id) ?? { deb: 0, cre: 0 };
      const saldo = mv.cre - mv.deb;
      const dc    = saldo >= 0 ? 'C' : 'D';
      add(P+'J215'+P+acc.code+P+acc.name+P+this.fmtDec(Math.abs(saldo))+P+dc+P);
    }

    // J900 — encerramento bloco J
    const idxJ001   = lines.findIndex(l => l === P+'J001'+P+'0'+P);
    const blocoJQtd = lines.length - idxJ001;
    add(P+'J900'+P+(blocoJQtd + 1)+P);

    // BLOCO K (vazio)
    add(P+'K001'+P+'1'+P);
    add(P+'K990'+P+'2'+P);

    // BLOCO 9
    add(P+'9001'+P+'0'+P);
    const regCount = new Map<string, number>();
    for (const line of lines) {
      const reg = line.split(P)[1]?.toUpperCase();
      if (reg) regCount.set(reg, (regCount.get(reg) ?? 0) + 1);
    }
    regCount.set('9001', 1);
    regCount.set('9900', regCount.size + 1);
    regCount.set('9990', 1);
    regCount.set('9999', 1);
    for (const [reg, count] of Array.from(regCount.entries()).sort()) {
      add(P+'9900'+P+reg+P+count+P);
    }
    const idx9001 = lines.findIndex(l => l === P+'9001'+P+'0'+P);
    add(P+'9990'+P+(lines.length - idx9001 + 1)+P);
    add(P+'9999'+P+(lines.length + 1)+P);

    const idxC001 = lines.findIndex(l => l === P+'C001'+P+'1'+P);
    lines[idx0990] = P+'0990'+P+idxC001+P;

    const content = lines.join('\r\n') + '\r\n';
    this.logger.log('ECD: ' + lines.length + ' linhas | ' + accounts.length + ' contas | ' + entries.length + ' lancamentos');
    return Buffer.from(content, 'latin1');
  }

  private fmtDate(date: Date | string): string {
    const d  = date instanceof Date ? date : new Date(date);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return dd + mm + String(d.getUTCFullYear());
  }

  private fmtDec(v: number): string {
    return Math.abs(v).toFixed(2).replace('.', ',');
  }

  private typeToNat(type: string): string {
    switch (type) {
      case 'ASSET':     return '01';
      case 'LIABILITY': return '02';
      case 'EQUITY':    return '03';
      case 'REVENUE':   return '04';
      case 'EXPENSE':   return '05';
      default:          return '09';
    }
  }

  private monthRange(start: Date, end: Date) {
    const result = [];
    let y = start.getUTCFullYear(), m = start.getUTCMonth() + 1;
    const ey = end.getUTCFullYear(), em = end.getUTCMonth() + 1;
    while (y < ey || (y === ey && m <= em)) {
      result.push({ year: y, month: m, firstDay: new Date(Date.UTC(y, m - 1, 1)), lastDay: new Date(Date.UTC(y, m, 0)) });
      m++; if (m > 12) { m = 1; y++; }
    }
    return result;
  }
}
