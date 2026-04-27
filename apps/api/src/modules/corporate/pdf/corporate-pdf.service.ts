// apps/api/src/modules/corporate/pdf/corporate-pdf.service.ts
import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as crypto from 'crypto';
import { ShareholdersService } from '../shareholders/shareholders.service';
import { TransfersService } from '../transfers/transfers.service';

@Injectable()
export class CorporatePdfService {
  constructor(
    private shareholdersService: ShareholdersService,
    private transfersService: TransfersService,
  ) {}

  async generateShareRegisterPdf(companyId: string, company: any): Promise<{ buffer: Buffer; hash: string }> {
    const [records, summary] = await Promise.all([
      this.shareholdersService.findAll(companyId, { active: true }),
      this.shareholdersService.getCapitalSummary(companyId),
    ]);
    const recordsWithDetail = await Promise.all(
      records.map(async (r: any) => {
        const detail = await this.shareholdersService.findOne(companyId, r.id);
        return { ...r, transfersAsFrom: detail.transfersAsFrom || [], transfersAsTo: detail.transfersAsTo || [] };
      })
    );
    const html = this.buildShareRegisterHtml(company, recordsWithDetail, summary);
    return this.renderPdf(html);
  }

  async generateTransferRegisterPdf(companyId: string, company: any, year?: number): Promise<{ buffer: Buffer; hash: string }> {
    const transfers = await this.transfersService.findAll(companyId, { year });
    const html = this.buildTransferRegisterHtml(company, transfers, year);
    return this.renderPdf(html);
  }

  private async renderPdf(html: string): Promise<{ buffer: Buffer; hash: string }> {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '15mm', right: '12mm', bottom: '15mm', left: '12mm' },
    });
    await browser.close();
    const buffer = Buffer.from(pdfBuffer);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    return { buffer, hash };
  }

  private fmt(v: any): string {
    return Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  private fmtDate(d: any): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('pt-BR');
  }
  private fmtCPFCNPJ(v: string): string {
    if (!v) return '';
    const c = v.replace(/\D/g, '');
    if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return v;
  }
  private reasonLabel(r: string): string {
    const map: Record<string, string> = {
      COMPRA_VENDA: 'Compra e Venda', DOACAO: 'Doação', HERANCA: 'Herança',
      INTEGRALIZACAO: 'Integralização', REDUCAO_CAPITAL: 'Red. Capital',
      AMORTIZACAO: 'Amortização', CISAO: 'Cisão', INCORPORACAO: 'Incorporação',
    };
    return map[r] ?? r;
  }

  private buildMovsTable(record: any): string {
    const totalEmitidas = Number(record.quantity)
      + (record.transfersAsFrom || []).reduce((s: number, t: any) => s + Number(t.quantity), 0);
    const movs: any[] = [
      {
        date: record.subscriptionDate ? new Date(record.subscriptionDate) : record.integralizationDate ? new Date(record.integralizationDate) : null,
        hist: record.notes || 'Lançamento Inicial dos Registros',
        entrada: totalEmitidas, saida: 0,
      },
      ...(record.transfersAsFrom || []).map((t: any) => ({
        date: new Date(t.transferDate),
        hist: 'Alienação → ' + (t.toRecord?.holderName ?? ''),
        entrada: 0, saida: Number(t.quantity),
      })),
      ...(record.transfersAsTo || []).map((t: any) => ({
        date: new Date(t.transferDate),
        hist: 'Recebimento ← ' + (t.fromRecord?.holderName ?? ''),
        entrada: Number(t.quantity), saida: 0,
      })),
    ].sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
    let saldo = 0;
    const rows = movs.map((m, mi) => {
      saldo += m.entrada - m.saida;
      return `<tr>
        <td class="center mono">${String(mi + 1).padStart(3, '0')}</td>
        <td class="center">${m.date ? m.date.toLocaleDateString('pt-BR') : '—'}</td>
        <td>${m.hist}</td>
        <td class="right mono">${m.entrada > 0 ? this.fmt(m.entrada) : '—'}</td>
        <td class="right mono">${m.saida > 0 ? this.fmt(m.saida) : '—'}</td>
        <td class="right mono bold">${this.fmt(saldo)}</td>
      </tr>`;
    }).join('');
    return `<table class="movs-table">
      <thead><tr>
        <th class="center" style="width:36px">Nº</th>
        <th class="center" style="width:70px">Data</th>
        <th>Histórico da Movimentação</th>
        <th class="right" style="width:90px">Entrada</th>
        <th class="right" style="width:90px">Saída</th>
        <th class="right" style="width:90px">Saldo</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="saldo-row">
        <td colspan="5" class="right"><strong>Saldo Atual</strong></td>
        <td class="right mono bold">${this.fmt(record.quantity)}</td>
      </tr></tfoot>
    </table>`;
  }

  private buildAverbacoes(record: any): string {
    const fromAverb = (record.transfersAsFrom || []).filter((t: any) => t.averbacaoDate);
    const toAverb = (record.transfersAsTo || []).filter((t: any) => t.averbacaoDate);
    if (!fromAverb.length && !toAverb.length && !record.hasEncumbrance) {
      return `<div class="averb-empty">Nenhuma averbação registrada.</div>`;
    }
    const items = [
      ...fromAverb.map((t: any) => `<tr><td>${this.fmtDate(t.averbacaoDate)}</td><td>Alienação (Compra e Venda)</td><td>${t.toRecord?.holderName ?? ''}</td><td>${t.notaryOffice ?? '—'}</td></tr>`),
      ...toAverb.map((t: any) => `<tr><td>${this.fmtDate(t.averbacaoDate)}</td><td>Aquisição (Compra e Venda)</td><td>${t.fromRecord?.holderName ?? ''}</td><td>${t.notaryOffice ?? '—'}</td></tr>`),
      record.hasEncumbrance ? `<tr><td>—</td><td>Gravame / Ônus</td><td colspan="2">Ver observações</td></tr>` : '',
    ].join('');
    return `<table class="averb-table">
      <thead><tr>
        <th style="width:80px">Data</th>
        <th>Tipo de Averbação</th>
        <th>Contraparte</th>
        <th>Cartório / Referência</th>
      </tr></thead>
      <tbody>${items}</tbody>
    </table>`;
  }

  private buildShareRegisterHtml(company: any, records: any[], summary: any): string {
    const entryType = records[0]?.entryType ?? 'SA';
    const isSA = entryType !== 'LTDA';
    const tipoLivro = isSA ? 'Ações Nominativas' : 'Quotas';
    const baseLegal = isSA ? 'Lei 6.404/76, Art. 31 e 100' : 'Código Civil, Art. 1.053 e 1.057';
    const now = new Date();
    const emissao = now.toLocaleDateString('pt-BR');
    const hora = now.toLocaleTimeString('pt-BR');

    const holderBlocks = records.map((r, i) => `
    <div class="holder-block ${i > 0 ? 'page-break' : ''}">
      <div class="holder-header">
        <div class="holder-seq">${String(i + 1).padStart(3, '0')}</div>
        <div class="holder-info">
          <div class="holder-name">${r.holderName}</div>
          <div class="holder-meta">
            ${r.holderType === 'PJ' ? 'CNPJ' : 'CPF'}: ${this.fmtCPFCNPJ(r.holderTaxId)}
            &nbsp;·&nbsp; Tipo: ${r.shareType === 'QUOTA' ? 'Quota' : r.shareType === 'ORDINARIA' ? 'Ação Ordinária (ON)' : 'Ação Preferencial (PN)'}
            ${r.series ? `&nbsp;·&nbsp; Série: ${r.series}` : ''}
            &nbsp;·&nbsp; Participação: ${this.fmt(r.percentOwned)}%
          </div>
        </div>
        <div class="holder-saldo">
          <div class="saldo-label">Saldo Atual</div>
          <div class="saldo-value">${this.fmt(r.quantity)}</div>
          <div class="saldo-sub">R$ ${this.fmt(r.totalValue)}</div>
        </div>
      </div>
      <div class="holder-data-grid">
        <div class="data-item"><span class="data-label">Vl. Nominal</span><span class="data-value">R$ ${this.fmt(r.nominalValue)}</span></div>
        <div class="data-item"><span class="data-label">Integralizado</span><span class="data-value">${r.isFullyPaid ? 'Sim (100%)' : 'Parcial'}</span></div>
        <div class="data-item"><span class="data-label">Dt. Subscrição</span><span class="data-value">${this.fmtDate(r.subscriptionDate)}</span></div>
        <div class="data-item"><span class="data-label">Dt. Integralização</span><span class="data-value">${this.fmtDate(r.integralizationDate)}</span></div>
        <div class="data-item"><span class="data-label">Nº Certificado</span><span class="data-value">${r.certificateNumber ?? '—'}</span></div>
        <div class="data-item"><span class="data-label">Gravame / Ônus</span><span class="data-value ${r.hasEncumbrance ? 'warn' : ''}">${r.hasEncumbrance ? '⚠ Sim' : 'Não'}</span></div>
      </div>
      <div class="section-label">Das Ações — Integralização e Operações</div>
      ${this.buildMovsTable(r)}
      <div class="section-label">Das Averbações</div>
      ${this.buildAverbacoes(r)}
      ${r.notes ? `<div class="section-label">Observações</div><div class="obs-box">${r.notes}</div>` : ''}
    </div>`).join('');

    const resumoRows = records.map((r, i) => `
    <tr>
      <td class="center">${i + 1}</td>
      <td><strong>${r.holderName}</strong><br><span style="font-size:7.5pt;color:#666;font-family:'Courier New',monospace">${this.fmtCPFCNPJ(r.holderTaxId)}</span></td>
      <td class="center">${r.shareType === 'QUOTA' ? 'Quota' : r.shareType === 'ORDINARIA' ? 'ON' : 'PN'}${r.series ? '–' + r.series : ''}</td>
      <td class="right mono">${this.fmt(r.quantity)}</td>
      <td class="right">R$ ${this.fmt(r.nominalValue)}</td>
      <td class="right"><strong>R$ ${this.fmt(r.totalValue)}</strong></td>
      <td class="center">${this.fmt(r.percentOwned)}%</td>
      <td class="center">${r.isFullyPaid ? '✓' : 'Parcial'}</td>
      <td class="center">${this.fmtDate(r.integralizationDate)}</td>
      <td class="center">${r.hasEncumbrance ? '⚠ Sim' : 'Não'}</td>
    </tr>`).join('');

    const totalMovs = records.reduce((s: number, r: any) =>
      s + (r.transfersAsFrom?.length || 0) + (r.transfersAsTo?.length || 0), 0);

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Livro de Registro de ${tipoLivro}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Times New Roman',serif; font-size:9.5pt; color:#111; background:#fff; }
.cover { text-align:center; padding:50px 0 30px; border-bottom:2pt solid #000; margin-bottom:24px; }
.cover .logo { font-size:7.5pt; letter-spacing:2px; text-transform:uppercase; color:#555; margin-bottom:10px; }
.cover h1 { font-size:17pt; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px; }
.cover h2 { font-size:10.5pt; font-weight:normal; margin-top:6px; color:#333; }
.cover .company { margin-top:18px; font-size:11pt; font-weight:bold; }
.cover .cnpj { font-size:9pt; color:#444; margin-top:3px; }
.cover .meta { margin-top:10px; font-size:8.5pt; color:#555; }
.termo { border:0.5pt solid #ccc; padding:14px 18px; margin-bottom:24px; font-size:8.5pt; line-height:1.6; }
.termo h3 { font-size:9pt; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; border-bottom:0.5pt solid #ccc; padding-bottom:4px; }
.summary-box { display:flex; gap:0; border:1pt solid #000; margin-bottom:24px; }
.summary-item { flex:1; padding:10px 14px; border-right:0.5pt solid #ccc; }
.summary-item:last-child { border-right:none; }
.summary-label { font-size:7pt; text-transform:uppercase; letter-spacing:0.5px; color:#555; }
.summary-value { font-size:13pt; font-weight:bold; margin-top:2px; }
.resumo-table { width:100%; border-collapse:collapse; font-size:8.5pt; margin-bottom:24px; }
.resumo-table th { background:#000; color:#fff; padding:6px 8px; font-size:7.5pt; text-transform:uppercase; text-align:left; }
.resumo-table th.center, .resumo-table td.center { text-align:center; }
.resumo-table th.right, .resumo-table td.right { text-align:right; }
.resumo-table td { padding:5px 8px; border-bottom:0.5pt solid #ddd; }
.resumo-table tr:nth-child(even) td { background:#fafafa; }
.resumo-table .totals td { background:#f0f0f0; font-weight:bold; border-top:1pt solid #000; }
.holder-block { margin-bottom:30px; border:0.5pt solid #ccc; }
.page-break { page-break-before:always; }
.holder-header { display:flex; align-items:flex-start; gap:12px; background:#111; color:#fff; padding:10px 14px; }
.holder-seq { font-size:14pt; font-weight:bold; font-family:'Courier New',monospace; min-width:40px; }
.holder-info { flex:1; }
.holder-name { font-size:11pt; font-weight:bold; }
.holder-meta { font-size:8pt; margin-top:3px; color:#ccc; }
.holder-saldo { text-align:right; }
.saldo-label { font-size:7pt; text-transform:uppercase; color:#aaa; }
.saldo-value { font-size:14pt; font-weight:bold; }
.saldo-sub { font-size:8pt; color:#ccc; }
.holder-data-grid { display:grid; grid-template-columns:repeat(6,1fr); border-bottom:0.5pt solid #ddd; }
.data-item { padding:8px 10px; border-right:0.5pt solid #eee; }
.data-item:last-child { border-right:none; }
.data-label { font-size:7pt; text-transform:uppercase; color:#777; display:block; }
.data-value { font-size:9pt; font-weight:bold; display:block; margin-top:2px; }
.data-value.warn { color:#b91c1c; }
.section-label { font-size:7.5pt; text-transform:uppercase; letter-spacing:0.5px; color:#fff; background:#444; padding:4px 10px; }
.movs-table { width:100%; border-collapse:collapse; font-size:8pt; }
.movs-table th { background:#f5f5f5; color:#333; padding:5px 6px; text-align:left; font-size:7pt; text-transform:uppercase; border-bottom:1pt solid #ccc; }
.movs-table th.center,.movs-table td.center { text-align:center; }
.movs-table th.right,.movs-table td.right { text-align:right; }
.movs-table td { padding:4px 6px; border-bottom:0.5pt solid #eee; }
.movs-table tr:nth-child(even) td { background:#fafafa; }
.saldo-row td { background:#f0f0f0; border-top:1pt solid #999; font-size:8.5pt; padding:5px 6px; }
.mono { font-family:'Courier New',monospace; }
.bold { font-weight:bold; }
.averb-table { width:100%; border-collapse:collapse; font-size:8pt; }
.averb-table th { background:#f5f5f5; color:#333; padding:5px 6px; font-size:7pt; text-transform:uppercase; border-bottom:1pt solid #ccc; text-align:left; }
.averb-table td { padding:4px 6px; border-bottom:0.5pt solid #eee; }
.averb-empty { padding:6px 10px; font-size:8pt; color:#888; font-style:italic; }
.obs-box { padding:8px 10px; font-size:8.5pt; font-style:italic; color:#444; background:#fffbe6; border-left:2pt solid #d97706; }
.legal-note { margin-top:20px; font-size:8pt; color:#444; border-top:0.5pt solid #ccc; padding-top:10px; line-height:1.5; }
.signatures { margin-top:40px; display:flex; gap:50px; }
.sig-line { flex:1; border-top:0.5pt solid #000; padding-top:5px; text-align:center; font-size:8pt; line-height:1.6; }
.footer { margin-top:16px; font-size:7pt; color:#888; text-align:center; border-top:0.5pt solid #ddd; padding-top:6px; }
@page { size:A4 landscape; margin:12mm 15mm; }
</style>
</head>
<body>

<div class="cover">
  <div class="logo">◆ LEDGR — Sistema de Gestão Contábil e Societária</div>
  <h1>Livro de Registro de ${tipoLivro}</h1>
  <h2>${baseLegal}</h2>
  <div class="company">${company.legalName}</div>
  <div class="cnpj">CNPJ: ${company.taxId}</div>
  <div class="meta">Data de Emissão: ${emissao} &nbsp;|&nbsp; Hora: ${hora}</div>
</div>

<div class="termo">
  <h3>Termo de Abertura</h3>
  Aos ${now.getDate()} dias do mês de ${now.toLocaleString('pt-BR', { month: 'long' })} de ${now.getFullYear()},
  procede-se à abertura do presente Livro de Registro de ${tipoLivro} da empresa
  <strong>${company.legalName}</strong>, inscrita no CNPJ sob o nº <strong>${company.taxId}</strong>,
  mantido em conformidade com ${baseLegal} e autenticado eletronicamente conforme
  IN DREI nº 82/2021, alterada pela IN DREI nº 79/2022.
  O presente livro contém o registro de <strong>${records.length}</strong> titular(es) e
  <strong>${totalMovs}</strong> movimentação(ões).
</div>

<div class="summary-box">
  <div class="summary-item"><div class="summary-label">Total de Titulares</div><div class="summary-value">${summary.holdersCount}</div></div>
  <div class="summary-item"><div class="summary-label">Total de ${tipoLivro}</div><div class="summary-value">${this.fmt(summary.totalShares)}</div></div>
  <div class="summary-item"><div class="summary-label">Capital Social Total</div><div class="summary-value">R$ ${this.fmt(summary.totalCapital)}</div></div>
  <div class="summary-item"><div class="summary-label">Data de Emissão</div><div class="summary-value" style="font-size:10pt">${emissao}</div></div>
</div>

<table class="resumo-table">
  <thead>
    <tr>
      <th style="width:30px">#</th>
      <th>Titular / CPF-CNPJ</th>
      <th class="center" style="width:60px">Tipo</th>
      <th class="right" style="width:90px">Quantidade</th>
      <th class="right" style="width:80px">Vl. Nominal</th>
      <th class="right" style="width:100px">Total (R$)</th>
      <th class="center" style="width:55px">%</th>
      <th class="center" style="width:55px">Integraliz.</th>
      <th class="center" style="width:75px">Dt. Integr.</th>
      <th class="center" style="width:50px">Gravame</th>
    </tr>
  </thead>
  <tbody>${resumoRows}</tbody>
  <tfoot>
    <tr class="totals">
      <td colspan="3"><strong>TOTAL GERAL</strong></td>
      <td class="right mono"><strong>${this.fmt(summary.totalShares)}</strong></td>
      <td></td>
      <td class="right"><strong>R$ ${this.fmt(summary.totalCapital)}</strong></td>
      <td class="center"><strong>100%</strong></td>
      <td colspan="3"></td>
    </tr>
  </tfoot>
</table>

${holderBlocks}

<div class="legal-note">
  <strong>Nota Legal:</strong> Este livro é mantido em conformidade com ${baseLegal},
  e autenticado perante a JUCESP conforme IN DREI nº 82/2021, alterada pela IN DREI nº 79/2022.
  O modelo de livro utilizado é de livre formatação, conforme §2º do art. 18 da IN DREI nº 82/2021.
  A autenticidade deste documento pode ser verificada pelo hash SHA-256 registrado no sistema LEDGR.
</div>

<div class="signatures">
  <div class="sig-line">________________________________<br>Diretor / Sócio Administrador<br>CPF: ___________________</div>
  <div class="sig-line">________________________________<br>Contador Responsável<br>CRC: ___________________</div>
  <div class="sig-line">________________________________<br>Testemunha<br>CPF: ___________________</div>
</div>

<div class="footer">
  Gerado automaticamente pelo LEDGR em ${now.toISOString()} &nbsp;·&nbsp; Documento sujeito a assinatura digital ICP-Brasil
</div>

</body>
</html>`;
  }

  private buildTransferRegisterHtml(company: any, transfers: any[], year?: number): string {
    const entryType = transfers[0]?.entryType ?? 'SA';
    const isSA = entryType !== 'LTDA';
    const now = new Date();
    let seq = 0;
    const rows = transfers.map(t => {
      seq++;
      return `
      <tr class="${seq % 2 === 0 ? 'even' : 'odd'}">
        <td class="center">${seq}</td>
        <td class="center">${this.fmtDate(t.transferDate)}</td>
        <td><strong>${t.fromRecord.holderName}</strong><br><span class="taxid">${this.fmtCPFCNPJ(t.fromRecord.holderTaxId)}</span></td>
        <td><strong>${t.toRecord.holderName}</strong><br><span class="taxid">${this.fmtCPFCNPJ(t.toRecord.holderTaxId)}</span></td>
        <td class="center">${t.shareType === 'QUOTA' ? 'Quota' : t.shareType === 'ORDINARIA' ? 'ON' : 'PN'}${t.series ? '–' + t.series : ''}</td>
        <td class="right">${this.fmt(t.quantity)}</td>
        <td class="right">R$ ${this.fmt(t.nominalValue)}</td>
        <td class="right">R$ ${this.fmt(t.transferValue)}</td>
        <td class="center">${this.reasonLabel(t.reason)}</td>
        <td class="center">${t.instrumentType ?? '—'}</td>
        <td class="center ${t.averbacaoDate ? 'averbado' : 'pendente'}">${t.averbacaoDate ? '✓ ' + this.fmtDate(t.averbacaoDate) : 'Pendente'}</td>
      </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Livro de Transferência</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Times New Roman',serif; font-size:10pt; color:#111; background:#fff; }
.cover { text-align:center; padding:50px 0 30px; border-bottom:2pt solid #000; margin-bottom:24px; }
.cover .logo { font-size:8pt; letter-spacing:2px; text-transform:uppercase; color:#555; margin-bottom:10px; }
.cover h1 { font-size:17pt; font-weight:bold; text-transform:uppercase; }
.cover h2 { font-size:11pt; font-weight:normal; margin-top:6px; }
.cover .company { margin-top:16px; font-size:11pt; }
.cover .meta { font-size:8.5pt; color:#555; margin-top:8px; }
table { width:100%; border-collapse:collapse; font-size:8pt; }
th { background:#111; color:#fff; padding:5px; font-size:7.5pt; text-transform:uppercase; text-align:left; }
th.center, td.center { text-align:center; }
th.right, td.right { text-align:right; }
td { padding:5px; border-bottom:0.5pt solid #e0e0e0; vertical-align:top; }
tr.even td { background:#fafafa; }
.taxid { font-size:7.5pt; color:#666; font-family:'Courier New',monospace; }
.averbado { color:#166534; font-weight:bold; }
.pendente { color:#92400e; }
.totals-row td { background:#f0f0f0; font-weight:bold; border-top:1pt solid #000; }
.legal-note { margin-top:20px; font-size:8pt; color:#444; border-top:0.5pt solid #ccc; padding-top:10px; }
.signatures { margin-top:40px; display:flex; gap:50px; }
.sig-line { flex:1; border-top:0.5pt solid #000; padding-top:5px; text-align:center; font-size:8pt; line-height:1.6; }
.footer { margin-top:16px; font-size:7pt; color:#888; text-align:center; border-top:0.5pt solid #ddd; padding-top:6px; }
@page { size:A4 landscape; margin:12mm 15mm; }
</style>
</head>
<body>

<div class="cover">
  <div class="logo">◆ LEDGR — Sistema de Gestão Contábil e Societária</div>
  <h1>Livro de Transferência de ${isSA ? 'Ações' : 'Quotas'}</h1>
  <h2>${isSA ? 'Lei 6.404/76, Art. 36' : 'Código Civil, Art. 1.057'} ${year ? '· Exercício ' + year : ''}</h2>
  <div class="company"><strong>${company.legalName}</strong><br>CNPJ: ${company.taxId}</div>
  <div class="meta">Total de transferências: ${transfers.length} &nbsp;|&nbsp; Emitido em: ${now.toLocaleDateString('pt-BR')}</div>
</div>

<table>
  <thead>
    <tr>
      <th class="center" style="width:28px">Nº</th>
      <th class="center" style="width:65px">Data</th>
      <th style="width:18%">Cedente / CPF-CNPJ</th>
      <th style="width:18%">Cessionário / CPF-CNPJ</th>
      <th class="center" style="width:50px">Tipo</th>
      <th class="right" style="width:70px">Quantidade</th>
      <th class="right" style="width:70px">Vl. Nominal</th>
      <th class="right" style="width:80px">Vl. Cessão</th>
      <th class="center" style="width:80px">Motivo</th>
      <th class="center" style="width:90px">Instrumento</th>
      <th class="center" style="width:75px">Averbação</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
  <tfoot>
    <tr class="totals-row">
      <td colspan="5"><strong>TOTAL (${transfers.length} transferências)</strong></td>
      <td class="right"><strong>${this.fmt(transfers.reduce((s, t) => s + Number(t.quantity), 0))}</strong></td>
      <td></td>
      <td class="right"><strong>R$ ${this.fmt(transfers.reduce((s, t) => s + Number(t.transferValue), 0))}</strong></td>
      <td colspan="3"></td>
    </tr>
  </tfoot>
</table>

<div class="legal-note">
  <strong>Nota Legal:</strong> Livro mantido conforme ${isSA ? 'Lei 6.404/76, art. 36 e IN DREI nº 82/2021' : 'Código Civil, art. 1.057'}.
  A autenticidade deste documento pode ser verificada pelo hash SHA-256 registrado no sistema LEDGR.
</div>

<div class="signatures">
  <div class="sig-line">________________________________<br>Diretor / Sócio Administrador<br>CPF: ___________________</div>
  <div class="sig-line">________________________________<br>Contador Responsável<br>CRC: ___________________</div>
  <div class="sig-line">________________________________<br>Testemunha<br>CPF: ___________________</div>
</div>

<div class="footer">
  Gerado automaticamente pelo LEDGR em ${now.toISOString()} &nbsp;·&nbsp; Documento sujeito a assinatura digital ICP-Brasil
</div>

</body>
</html>`;
  }
}
