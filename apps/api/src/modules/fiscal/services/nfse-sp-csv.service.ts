// apps/api/src/modules/fiscal/services/nfse-sp-csv.service.ts
// Parser e importador do CSV exportado pelo portal PMSP (NFS-e Emitidas/Recebidas)
// Formato: separador ; | encoding Windows-1252 | ~130+ colunas
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IntegrationService } from '../../finance/integration.service';

export interface NfseSpCsvRow {
  numero:        string;
  dataEmissao:   Date;
  situacao:      string; // T=Tributada, C=Cancelada
  prestadorCnpj: string;
  prestadorNome: string;
  tomadorCnpj:   string;
  tomadorNome:   string;
  valorServicos: number;
  valorDeducoes: number;
  codServico:    string;
  aliquota:      number;
  issDevido:     number;
  issRetido:     boolean;
  pis:           number;
  cofins:        number;
  ir:            number;
  csll:          number;
  inss:          number;
  discriminacao: string;
  mode:          'PRESTADOR' | 'TOMADOR';
}

function parseBRL(v: string): number {
  if (!v || v.trim() === '') return 0;
  return parseFloat(v.replace(/\./g,'').replace(',','.')) || 0;
}

function parseDate(v: string): Date {
  // "04/02/2026 12:18:20"
  const m = v.trim().match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return new Date();
  return new Date(Number(m[3]), Number(m[2])-1, Number(m[1]));
}

@Injectable()
export class NfseSpCsvService {
  constructor(private prisma: PrismaService, private integration: IntegrationService) {}

  // Detectar encoding e converter para UTF-8
  private decode(buffer: Buffer): string {
    // Tentar UTF-8 primeiro, fallback para latin1/win-1252
    try {
      const txt = buffer.toString('utf-8');
      if (txt.includes('Nş') || txt.includes('\uFFFD')) throw new Error('not utf8');
      return txt;
    } catch {
      return buffer.toString('latin1');
    }
  }

  parseCsv(buffer: Buffer, companyCnpj: string): NfseSpCsvRow[] {
    const text  = this.decode(buffer);
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const rows: NfseSpCsvRow[] = [];

    for (const line of lines) {
      const cols = line.split(';');
      // Linha de dados tem tipo "2" na col 0
      if (cols[0]?.trim() !== '2') continue;

      const numero        = cols[1]?.trim() || '';
      const dataEmissao   = parseDate(cols[2] || '');
      const situacao      = cols[22]?.trim() || 'T'; // T=Tributada C=Cancelada
      const prestadorCnpj = (cols[10]?.trim() || '').replace(/\D/g,'');
      const prestadorNome = cols[11]?.trim() || '';
      const tomadorCnpj   = (cols[33]?.trim() || '').replace(/\D/g,'');
      const tomadorNome   = cols[36]?.trim() || '';
      const valorServicos = parseBRL(cols[26] || '');
      const valorDeducoes = parseBRL(cols[27] || '');
      const codServico    = cols[28]?.trim() || '';
      const aliquota      = parseBRL(cols[29] || '');
      const issDevido     = parseBRL(cols[30] || '');
      const issRetidoStr  = cols[32]?.trim() || 'N';
      const issRetido     = issRetidoStr === 'S';
      const pis           = parseBRL(cols[55] || '');
      const cofins        = parseBRL(cols[56] || '');
      const ir            = parseBRL(cols[58] || '');
      const csll          = parseBRL(cols[60] || '0');
      const inss          = parseBRL(cols[61] || '0');
      // Discriminacao e ultima coluna (pode ter ; internos)
      const discriminacao = cols.slice(cols.length-1).join(';').trim();

      const cnpjClean = companyCnpj.replace(/\D/g,'');
      const mode: 'PRESTADOR' | 'TOMADOR' = prestadorCnpj === cnpjClean ? 'PRESTADOR' : 'TOMADOR';

      if (!numero) continue;
      rows.push({
        numero, dataEmissao, situacao, prestadorCnpj, prestadorNome,
        tomadorCnpj, tomadorNome, valorServicos, valorDeducoes,
        codServico, aliquota, issDevido, issRetido,
        pis, cofins, ir, csll, inss, discriminacao, mode,
      });
    }
    return rows;
  }

  async preview(buffer: Buffer, companyId: string) {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const cnpj    = company.taxId ?? '';
    const rows    = this.parseCsv(buffer, cnpj);

    const items = await Promise.all(rows.map(async r => {
      const dup = await this.prisma.fiscalDocument.findFirst({
        where: { companyId, documentNumber: r.numero,
          issuerCnpj: r.mode === 'TOMADOR' ? r.prestadorCnpj : r.tomadorCnpj },
      });
      return { ...r, duplicate: !!dup };
    }));

    const ok        = items.filter(i => !i.duplicate && i.situacao !== 'C').length;
    const canceled  = items.filter(i => i.situacao === 'C').length;
    const dups      = items.filter(i => i.duplicate).length;
    const totalVal  = items.filter(i => !i.duplicate && i.situacao !== 'C').reduce((s,i) => s+i.valorServicos,0);
    const totalIss  = items.filter(i => !i.duplicate && i.situacao !== 'C').reduce((s,i) => s+i.issDevido,0);
    const totalIr   = items.filter(i => !i.duplicate && i.situacao !== 'C').reduce((s,i) => s+i.ir,0);

    return { total: items.length, ok, canceled, duplicates: dups,
      totalValorServicos: totalVal, totalIss, totalIr, items,
      company: { id: company.id, cnpj, name: company.legalName } };
  }

  async importar(buffer: Buffer, companyId: string, userId: string, skipDuplicates = true) {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const cnpj    = company.taxId ?? '';
    const rows    = this.parseCsv(buffer, cnpj);
    const created: string[] = [], skipped: string[] = [], errors: string[] = [];

    for (const r of rows) {
      try {
        if (r.situacao === 'C') { skipped.push(r.numero + ' (cancelada)'); continue; }
        const issuerCnpj = r.mode === 'TOMADOR' ? r.prestadorCnpj : r.tomadorCnpj;
        const dup = await this.prisma.fiscalDocument.findFirst({
          where: { companyId, documentNumber: r.numero, issuerCnpj },
        });
        if (dup) { if (skipDuplicates) { skipped.push(r.numero + ' (dup)'); continue; } }

        await this.prisma.fiscalDocument.create({ data: {
          companyId,
          documentType:   'NFSE' as any,
          documentNumber: r.numero,
          issuerCnpj:     r.prestadorCnpj,
          issuerName:     r.prestadorNome,
          issueDate:      r.dataEmissao,
          dueDate:        r.dataEmissao,
          competenceMonth: r.dataEmissao.toISOString().slice(0,7),
          grossAmount:    r.valorServicos,
          netAmount:      r.valorServicos - r.ir - r.pis - r.cofins - r.csll - r.inss,
          issAmount:      r.issDevido,
          irAmount:       r.ir,
          pisAmount:      r.pis,
          cofinsAmount:   r.cofins,
          csllAmount:     r.csll,
          inssAmount:     r.inss,
          notes:          r.discriminacao.slice(0, 500),
          createdById:    userId,
        }});
        // Integrar: gera AP (tomador) ou AR (prestador) + JournalEntry
        try {
          const doc = await this.prisma.fiscalDocument.findUniqueOrThrow({ where: { id: (await this.prisma.fiscalDocument.findFirstOrThrow({ where: { companyId, documentNumber: r.numero, issuerCnpj: r.prestadorCnpj }, orderBy: { createdAt: 'desc' } })).id } });
          await this.integration.runIntegration(doc, companyId, userId);
        } catch(ie: any) { /* integracao falhou mas nota foi salva */ }
        created.push(r.numero);
      } catch(e: any) {
        errors.push(r.numero + ': ' + e.message);
      }
    }
    return { created: created.length, skipped: skipped.length, errors,
      total: rows.length };
  }
}
