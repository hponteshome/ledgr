// apps/api/src/modules/hr/services/guias.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import * as puppeteer from 'puppeteer';

function fmtBRL(v: number) { return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 }); }
function fmtCPF(v: string) { return v?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') ?? v; }
function fmtCNPJ(v: string) { return v?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') ?? v; }

// Vencimento GPS: dia 20 do mes seguinte (ou proximo dia util — simplificado)
function vencimentoGPS(competencia: string): string {
  const [y, m] = competencia.split('-').map(Number);
  const next = m === 12 ? new Date(y + 1, 0, 20) : new Date(y, m, 20);
  return next.toLocaleDateString('pt-BR');
}

// Vencimento DARF IRRF: ultimo dia util do mes seguinte (simplificado: dia 20)
function vencimentoDARF(competencia: string): string {
  return vencimentoGPS(competencia);
}

function htmlGPS(data: any): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }
  body { background: #fff; padding: 20px; }
  .guia { border: 2px solid #000; width: 720px; margin: 0 auto; }
  .header { background: #1a1a6e; color: #fff; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 14px; font-weight: bold; }
  .header .codigo { font-size: 20px; font-weight: bold; }
  .secao { border-bottom: 1px solid #000; padding: 6px 10px; display: grid; gap: 4px; }
  .row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .field label { font-size: 9px; text-transform: uppercase; color: #555; display: block; }
  .field span { font-size: 12px; font-weight: bold; }
  .total { background: #f0f0f0; padding: 8px 10px; display: flex; justify-content: space-between; }
  .total label { font-size: 10px; text-transform: uppercase; }
  .total span { font-size: 18px; font-weight: bold; color: #1a1a6e; }
  .footer { padding: 6px 10px; font-size: 9px; color: #555; text-align: center; }
  .barcode { text-align: center; padding: 8px; font-family: monospace; font-size: 13px; letter-spacing: 3px; border-top: 1px solid #000; }
</style>
</head><body>
<div class="guia">
  <div class="header">
    <div>
      <h1>GPS — GUIA DA PREVIDÊNCIA SOCIAL</h1>
      <div style="font-size:10px">Ministério da Previdência Social / DATAPREV</div>
    </div>
    <div class="codigo">Cód. 1007</div>
  </div>
  <div class="secao">
    <div class="row">
      <div class="field"><label>Identificador (CPF)</label><span>${fmtCPF(data.cpf)}</span></div>
      <div class="field"><label>Nome / Razão Social</label><span>${data.nome}</span></div>
      <div class="field"><label>Competência</label><span>${data.competencia}</span></div>
    </div>
  </div>
  <div class="secao">
    <div class="row">
      <div class="field"><label>INSS Diretor (11%)</label><span>R$ ${fmtBRL(data.inssDiretor)}</span></div>
      <div class="field"><label>INSS Patronal (20%)</label><span>R$ ${fmtBRL(data.inssEmpresa)}</span></div>
      <div class="field"><label>Outras Entidades</label><span>R$ 0,00</span></div>
    </div>
  </div>
  <div class="total">
    <div><label>Vencimento</label><div style="font-size:13px;font-weight:bold">${data.vencimento}</div></div>
    <div style="text-align:right"><label>Total a Recolher</label><span>R$ ${fmtBRL(data.totalGPS)}</span></div>
  </div>
  <div class="barcode">${data.codigoBarras ?? '000 0 00000 0 00000000000 0 00000000000 0'}</div>
  <div class="footer">Guia gerada pelo LEDGR — Uso interno. Verificar valores antes do pagamento.</div>
</div>
</body></html>`;
}

function htmlDARF(data: any): string {
  if (data.irrf <= 0) return '';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }
  body { background: #fff; padding: 20px; }
  .guia { border: 2px solid #000; width: 720px; margin: 0 auto; }
  .header { background: #006633; color: #fff; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 14px; font-weight: bold; }
  .header .codigo { font-size: 20px; font-weight: bold; }
  .secao { border-bottom: 1px solid #000; padding: 6px 10px; }
  .row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 4px; }
  .field label { font-size: 9px; text-transform: uppercase; color: #555; display: block; }
  .field span { font-size: 12px; font-weight: bold; }
  .total { background: #f0f0f0; padding: 8px 10px; display: flex; justify-content: space-between; }
  .total label { font-size: 10px; text-transform: uppercase; }
  .total span { font-size: 18px; font-weight: bold; color: #006633; }
  .footer { padding: 6px 10px; font-size: 9px; color: #555; text-align: center; }
</style>
</head><body>
<div class="guia">
  <div class="header">
    <div>
      <h1>DARF — DOCUMENTO DE ARRECADAÇÃO DE RECEITAS FEDERAIS</h1>
      <div style="font-size:10px">Receita Federal do Brasil</div>
    </div>
    <div class="codigo">0561</div>
  </div>
  <div class="secao">
    <div class="row">
      <div class="field"><label>CNPJ Responsável</label><span>${fmtCNPJ(data.cnpj)}</span></div>
      <div class="field"><label>Nome Empresarial</label><span>${data.empresa}</span></div>
      <div class="field"><label>Período de Apuração</label><span>${data.competencia}</span></div>
    </div>
  </div>
  <div class="secao">
    <div class="row">
      <div class="field"><label>Código Receita</label><span>0561</span></div>
      <div class="field"><label>Natureza</label><span>IRRF — Rendimentos do Trabalho</span></div>
      <div class="field"><label>Nº Referência</label><span>${data.cpf.replace(/\D/g,'')}</span></div>
    </div>
    <div class="row" style="margin-top:8px">
      <div class="field"><label>Valor Principal</label><span>R$ ${fmtBRL(data.irrf)}</span></div>
      <div class="field"><label>Multa</label><span>R$ 0,00</span></div>
      <div class="field"><label>Juros / Encargos</label><span>R$ 0,00</span></div>
    </div>
  </div>
  <div class="total">
    <div><label>Vencimento</label><div style="font-size:13px;font-weight:bold">${data.vencimento}</div></div>
    <div style="text-align:right"><label>Valor Total</label><span>R$ ${fmtBRL(data.irrf)}</span></div>
  </div>
  <div class="footer">Guia gerada pelo LEDGR — Uso interno. Verificar valores antes do pagamento.</div>
</div>
</body></html>`;
}

@Injectable()
export class GuiasService {
  constructor(private readonly prisma: PrismaService) {}

  async gerarGuias(companyId: string, calculoId: string): Promise<{ gpsHtml: string; darfHtml: string; gpsPdf?: Buffer; darfPdf?: Buffer; dados: any }> {
    const calculo = await this.prisma.proLaboreCalculo.findFirst({
      where: { id: calculoId, companyId },
      include: { config: { include: { person: true } }, company: true },
    });
    if (!calculo) throw new Error('Calculo nao encontrado');

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });

    const dados = {
      cpf:        calculo.config.person.cpf,
      nome:       calculo.config.person.fullName,
      cnpj:       company!.taxId,
      empresa:    company!.legalName,
      competencia: calculo.competencia,
      inssDiretor: Number(calculo.inssDiretor),
      inssEmpresa: Number(calculo.inssEmpresa),
      totalGPS:   Number(calculo.inssDiretor) + Number(calculo.inssEmpresa),
      irrf:       Number(calculo.irrf),
      vencimento: vencimentoGPS(calculo.competencia),
      vencimentoDARF: vencimentoDARF(calculo.competencia),
    };

    const gpsHtml  = htmlGPS(dados);
    const darfHtml = htmlDARF(dados);

    // Gerar PDFs via Puppeteer
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    let gpsPdf: Buffer | undefined;
    let darfPdf: Buffer | undefined;

    try {
      const page = await browser.newPage();
      await page.setContent(gpsHtml, { waitUntil: 'networkidle0' });
      gpsPdf = Buffer.from(await page.pdf({ format: 'A4', printBackground: true }));

      if (dados.irrf > 0) {
        await page.setContent(darfHtml, { waitUntil: 'networkidle0' });
        darfPdf = Buffer.from(await page.pdf({ format: 'A4', printBackground: true }));
      }
    } finally {
      await browser.close();
    }

    return { gpsHtml, darfHtml, gpsPdf, darfPdf, dados };
  }
}
