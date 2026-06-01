// apps/api/src/modules/hr/services/guias.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import * as puppeteer from 'puppeteer';

function fmtBRL(v: number) { return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtCPF(v: string) { return (v||'').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'); }
function fmtCNPJ(v: string) { return (v||'').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'); }
function fmtComp(c: string) { const [y,m]=c.split('-'); return m+'/'+y; }

function vencGPS(competencia: string): string {
  const [y, m] = competencia.split('-').map(Number);
  const next = m === 12 ? new Date(y + 1, 0, 20) : new Date(y, m, 20);
  return next.toLocaleDateString('pt-BR');
}

async function renderPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    return Buffer.from(await page.pdf({ format: 'A4', printBackground: true }));
  } finally {
    await browser.close();
  }
}
function htmlRecibo(d: any): string {
  const prov: Array<{l:string;v:number}> = [{ l: 'Salario Base', v: Number(d.salarioBase) }];
  if (Number(d.vrHorasExtrasFifty)      > 0) prov.push({ l: 'Horas Extras 50%',          v: Number(d.vrHorasExtrasFifty) });
  if (Number(d.vrHorasExtrasHundred)    > 0) prov.push({ l: 'Horas Extras 100%',         v: Number(d.vrHorasExtrasHundred) });
  if (Number(d.adicionalNoturno)        > 0) prov.push({ l: 'Adicional Noturno',          v: Number(d.adicionalNoturno) });
  if (Number(d.adicionalPericulosidade) > 0) prov.push({ l: 'Adicional Periculosidade',   v: Number(d.adicionalPericulosidade) });
  if (Number(d.adicionalInsalubridade)  > 0) prov.push({ l: 'Adicional Insalubridade',    v: Number(d.adicionalInsalubridade) });
  if (Number(d.ferias)                  > 0) prov.push({ l: 'Ferias',                     v: Number(d.ferias) });
  if (Number(d.tercoFerias)             > 0) prov.push({ l: '1/3 Ferias',                 v: Number(d.tercoFerias) });
  if (Number(d.decimoTerceiro)          > 0) prov.push({ l: '13 Salario',                 v: Number(d.decimoTerceiro) });
  if (Number(d.outrosProventos)         > 0) prov.push({ l: 'Outros Proventos',            v: Number(d.outrosProventos) });
  if (Number(d.vrValeTransporte)        > 0) prov.push({ l: 'Vale Transporte',             v: Number(d.vrValeTransporte) });
  if (Number(d.vrValeRefeicao)          > 0) prov.push({ l: 'Vale Refeicao',               v: Number(d.vrValeRefeicao) });
  if (Number(d.vrValeAlimentacao)       > 0) prov.push({ l: 'Vale Alimentacao',            v: Number(d.vrValeAlimentacao) });
  const desc: Array<{l:string;v:number}> = [];
  if (Number(d.valorInss)        > 0) desc.push({ l: 'INSS Empregado',        v: Number(d.valorInss) });
  if (Number(d.valorIrrf)        > 0) desc.push({ l: 'IRRF',                  v: Number(d.valorIrrf) });
  if (Number(d.valorSindical)    > 0) desc.push({ l: 'Contribuicao Sindical', v: Number(d.valorSindical) });
  if (Number(d.vrPlanoSaude)     > 0) desc.push({ l: 'Plano de Saude',        v: Number(d.vrPlanoSaude) });
  if (Number(d.vrPlanoOdonto)    > 0) desc.push({ l: 'Plano Odonto',          v: Number(d.vrPlanoOdonto) });
  if (Number(d.vrSeguroVida)     > 0) desc.push({ l: 'Seguro de Vida',        v: Number(d.vrSeguroVida) });
  if (Number(d.adiantamento)     > 0) desc.push({ l: 'Adiantamento',          v: Number(d.adiantamento) });
  if (Number(d.vrOutrosDescontos)> 0) desc.push({ l: 'Outros Descontos',      v: Number(d.vrOutrosDescontos) });
  const maxRows = Math.max(prov.length, desc.length);
  let rows = '';
  for (let i = 0; i < maxRows; i++) {
    const p = prov[i]; const dc = desc[i];
    rows += '<tr><td class=desc>' + (p?p.l:'') + '</td><td class=val>' + (p?'R$ '+fmtBRL(p.v):'') +
            '</td><td class=desc2>' + (dc?dc.l:'') + '</td><td class=valr>' + (dc?'R$ '+fmtBRL(dc.v):'') + '</td></tr>';
  }
  const css = '<style>*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif;font-size:11px}' +
    'body{background:#fff;padding:16px}.recibo{border:1.5px solid #000;width:720px;margin:0 auto}' +
    '.hdr{background:#111;color:#fff;padding:10px 14px;display:flex;justify-content:space-between;align-items:center}' +
    '.hdr h1{font-size:13px;font-weight:bold}.comp{font-size:16px;font-weight:bold}' +
    '.info{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #000}' +
    '.ib{padding:8px 12px;border-right:1px solid #ddd}.ib:last-child{border-right:none}' +
    '.ib label{font-size:8px;text-transform:uppercase;color:#777;display:block;margin-bottom:3px}' +
    '.ib span{font-size:11px;font-weight:bold}' +
    'table{width:100%;border-collapse:collapse}' +
    'thead tr{background:#F9FAFB}thead th{padding:6px 10px;font-size:9px;text-transform:uppercase;color:#555;border-bottom:1px solid #ddd;text-align:left}' +
    'thead th.r{text-align:right}tbody tr:nth-child(even){background:#FAFAFA}' +
    'td.desc{padding:5px 10px;color:#333}td.desc2{padding:5px 10px;color:#333;border-left:1.5px solid #000}' +
    'td.val{padding:5px 10px;text-align:right;font-weight:500;color:#15803D;white-space:nowrap}' +
    'td.valr{padding:5px 10px;text-align:right;font-weight:500;color:#B91C1C;white-space:nowrap}' +
    '.tots{display:grid;grid-template-columns:1fr 1fr 1fr;background:#F0F0F0;border-top:1.5px solid #000}' +
    '.tb{padding:8px 12px;border-right:1px solid #ccc}.tb:last-child{border-right:none}' +
    '.tb label{font-size:8px;text-transform:uppercase;color:#777;display:block;margin-bottom:2px}' +
    '.tb span{font-size:14px;font-weight:bold}.tb span.g{color:#15803D}' +
    '.assin{display:grid;grid-template-columns:1fr 1fr;padding:16px 12px;gap:20px;border-top:1px solid #ddd}' +
    '.aln{border-top:1px solid #999;text-align:center;padding-top:4px;font-size:9px;color:#555;margin-top:24px}' +
    '.foot{padding:6px 10px;font-size:8px;color:#888;text-align:center;border-top:1px solid #ddd}</style>';
  const hoje = new Date().toLocaleDateString('pt-BR');
  return '<!DOCTYPE html><html><head><meta charset=utf-8>' + css + '</head><body>' +
    '<div class=recibo>' +
    '<div class=hdr><div><h1>' + d.empresa + '</h1><div style=font-size:9px>CNPJ: ' + fmtCNPJ(d.cnpjEmpresa) + '</div></div>' +
    '<div style=text-align:right><div style=font-size:9px>RECIBO DE PAGAMENTO</div><div class=comp>' + fmtComp(d.competencia) + '</div></div></div>' +
    '<div class=info>' +
    '<div class=ib><label>Funcionario</label><span>' + d.nomeFunc + '</span></div>' +
    '<div class=ib><label>CPF</label><span>' + fmtCPF(d.cpfFunc) + '</span></div>' +
    '<div class=ib><label>Cargo / Funcao</label><span>' + (d.cargo||'-') + '</span></div>' +
    '<div class=ib><label>Data Admissao</label><span>' + (d.admissao||'-') + '</span></div>' +
    '<div class=ib><label>Tipo Contrato</label><span>' + d.tipoContrato + '</span></div>' +
    '<div class=ib><label>Dias Trabalhados</label><span>' + d.diasTrabalhados + '</span></div>' +
    '</div>' +
    '<table><thead><tr><th>Proventos</th><th class=r>Valor</th><th>Descontos</th><th class=r>Valor</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table>' +
    '<div class=tots>' +
    '<div class=tb><label>Total Proventos</label><span>R$ ' + fmtBRL(Number(d.totalBruto)) + '</span></div>' +
    '<div class=tb><label>Total Descontos</label><span>R$ ' + fmtBRL(Number(d.totalDescontos)) + '</span></div>' +
    '<div class=tb><label>Salario Liquido</label><span class=g>R$ ' + fmtBRL(Number(d.totalLiquido)) + '</span></div>' +
    '</div>' +
    '<div class=assin>' +
    '<div><div class=aln>Assinatura do Funcionario</div><div style=font-size:9px;color:#555;text-align:center;margin-top:4px>' + d.nomeFunc + '</div></div>' +
    '<div><div class=aln>Assinatura do Empregador</div><div style=font-size:9px;color:#555;text-align:center;margin-top:4px>' + d.empresa + '</div></div>' +
    '</div>' +
    '<div class=foot>Recibo gerado pelo LEDGR - ' + hoje + ' | Declaro ter recebido a importancia acima discriminada.</div>' +
    '</div></body></html>';
}

function htmlGPSFolha(d: any): string {
  const css = '<style>*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif}body{background:#fff;padding:20px}' +
    '.guia{border:2px solid #000;width:720px;margin:0 auto 20px}.hdr{background:#1a1a6e;color:#fff;padding:8px 12px;display:flex;justify-content:space-between;align-items:center}' +
    '.hdr h1{font-size:14px;font-weight:bold}.cod{font-size:20px;font-weight:bold}' +
    '.sec{border-bottom:1px solid #000;padding:8px 12px}' +
    '.row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.row4{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px}' +
    '.f label{font-size:9px;text-transform:uppercase;color:#555;display:block;margin-bottom:2px}.f span{font-size:12px;font-weight:bold}' +
    '.tot{background:#f0f0f0;padding:8px 12px;display:flex;justify-content:space-between;align-items:center}' +
    '.tot label{font-size:10px;text-transform:uppercase;color:#555}.tot span{font-size:18px;font-weight:bold;color:#1a1a6e}' +
    '.foot{padding:6px 10px;font-size:9px;color:#555;text-align:center;border-top:1px solid #ddd}' +
    'table{width:100%;border-collapse:collapse;font-size:11px}th{background:#F9FAFB;padding:5px 8px;text-align:left;border-bottom:1px solid #ddd;font-size:9px;text-transform:uppercase;color:#555}' +
    'td{padding:5px 8px;border-bottom:1px solid #F5F5F5}</style>';
  const linhasHtml = d.linhas.map((l: any) =>
    '<tr><td>' + l.nome + '</td><td>' + fmtCPF(l.cpf) + '</td><td>R$ ' + fmtBRL(l.salarioBase) + '</td>' +
    '<td>R$ ' + fmtBRL(l.inssEmp) + '</td><td>R$ ' + fmtBRL(l.inssPat) + '</td><td>R$ ' + fmtBRL(l.rat) + '</td><td>R$ ' + fmtBRL(l.terc) + '</td></tr>'
  ).join('');
  return '<!DOCTYPE html><html><head><meta charset=utf-8>' + css + '</head><body><div class=guia>' +
    '<div class=hdr><div><h1>GPS - GUIA DA PREVIDENCIA SOCIAL</h1><div style=font-size:10px>Folha de Pagamento CLT - Empregados</div></div><div class=cod>Cod. 2100</div></div>' +
    '<div class=sec><div class=row>' +
    '<div class=f><label>CNPJ do Empregador</label><span>' + fmtCNPJ(d.cnpj) + '</span></div>' +
    '<div class=f><label>Razao Social</label><span>' + d.empresa + '</span></div>' +
    '<div class=f><label>Competencia</label><span>' + fmtComp(d.competencia) + '</span></div>' +
    '</div></div><div class=sec><div class=row4>' +
    '<div class=f><label>INSS Empregado</label><span>R$ ' + fmtBRL(d.inssEmpregado) + '</span></div>' +
    '<div class=f><label>INSS Patronal 20%</label><span>R$ ' + fmtBRL(d.inssPatronal) + '</span></div>' +
    '<div class=f><label>RAT Ajustado</label><span>R$ ' + fmtBRL(d.rat) + '</span></div>' +
    '<div class=f><label>Outras Entidades</label><span>R$ ' + fmtBRL(d.terceiros) + '</span></div>' +
    '</div></div><div class=sec><table><thead><tr><th>Funcionario</th><th>CPF</th><th>Salario Base</th><th>INSS Emp.</th><th>INSS Pat.</th><th>RAT</th><th>Terceiros</th></tr></thead>' +
    '<tbody>' + linhasHtml + '</tbody></table></div>' +
    '<div class=tot><div><label>Vencimento</label><div style=font-size:13px;font-weight:bold;margin-top:2px>' + d.vencimento + '</div></div>' +
    '<div style=text-align:right><label>Total GPS a Recolher</label><div><span>R$ ' + fmtBRL(d.totalGPS) + '</span></div></div></div>' +
    '<div class=foot>Guia gerada pelo LEDGR - Uso interno. Verificar valores antes do pagamento.</div>' +
    '</div></body></html>';
}

function htmlDARFFolha(d: any): string {
  if (d.totalIrrf <= 0) return '';
  const css = '<style>*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif}body{background:#fff;padding:20px}' +
    '.guia{border:2px solid #000;width:720px;margin:0 auto}.hdr{background:#006633;color:#fff;padding:8px 12px;display:flex;justify-content:space-between;align-items:center}' +
    '.hdr h1{font-size:14px;font-weight:bold}.cod{font-size:20px;font-weight:bold}' +
    '.sec{border-bottom:1px solid #000;padding:6px 10px}.row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:4px}' +
    '.f label{font-size:9px;text-transform:uppercase;color:#555;display:block}.f span{font-size:12px;font-weight:bold}' +
    '.tot{background:#f0f0f0;padding:8px 10px;display:flex;justify-content:space-between}' +
    '.tot label{font-size:10px;text-transform:uppercase}.tot span{font-size:18px;font-weight:bold;color:#006633}' +
    '.foot{padding:6px 10px;font-size:9px;color:#555;text-align:center}' +
    'table{width:100%;border-collapse:collapse;font-size:11px}th{background:#F9FAFB;padding:5px 8px;text-align:left;border-bottom:1px solid #ddd;font-size:9px;text-transform:uppercase;color:#555}' +
    'td{padding:5px 8px;border-bottom:1px solid #F5F5F5}</style>';
  const linhasHtml = d.linhas.filter((l:any)=>l.irrf>0).map((l:any) =>
    '<tr><td>' + l.nome + '</td><td>' + fmtCPF(l.cpf) + '</td><td>R$ ' + fmtBRL(l.baseIrrf) + '</td>' +
    '<td>' + (Number(l.aliqIrrf)*100).toFixed(0) + '%</td><td>R$ ' + fmtBRL(l.irrf) + '</td></tr>'
  ).join('');
  return '<!DOCTYPE html><html><head><meta charset=utf-8>' + css + '</head><body><div class=guia>' +
    '<div class=hdr><div><h1>DARF - DOCUMENTO DE ARRECADACAO DE RECEITAS FEDERAIS</h1><div style=font-size:10px>IRRF - Rendimentos do Trabalho</div></div><div class=cod>0561</div></div>' +
    '<div class=sec><div class=row>' +
    '<div class=f><label>CNPJ Responsavel</label><span>' + fmtCNPJ(d.cnpj) + '</span></div>' +
    '<div class=f><label>Nome Empresarial</label><span>' + d.empresa + '</span></div>' +
    '<div class=f><label>Periodo de Apuracao</label><span>' + fmtComp(d.competencia) + '</span></div>' +
    '</div></div><div class=sec><div class=row>' +
    '<div class=f><label>Codigo Receita</label><span>0561</span></div>' +
    '<div class=f><label>Natureza</label><span>IRRF Rendimentos do Trabalho</span></div>' +
    '<div class=f><label>Nr Funcionarios c/ Retencao</label><span>' + d.numFuncsIrrf + '</span></div>' +
    '</div><div style=margin-top:8px><div class=row>' +
    '<div class=f><label>Valor Principal</label><span>R$ ' + fmtBRL(d.totalIrrf) + '</span></div>' +
    '<div class=f><label>Multa</label><span>R$ 0,00</span></div>' +
    '<div class=f><label>Juros / Encargos</label><span>R$ 0,00</span></div>' +
    '</div></div></div><div class=sec><table><thead><tr><th>Funcionario</th><th>CPF</th><th>Base IRRF</th><th>Aliq.</th><th>IRRF Retido</th></tr></thead>' +
    '<tbody>' + linhasHtml + '</tbody></table></div>' +
    '<div class=tot><div><label>Vencimento</label><div style=font-size:13px;font-weight:bold>' + d.vencimento + '</div></div>' +
    '<div style=text-align:right><label>Valor Total</label><span>R$ ' + fmtBRL(d.totalIrrf) + '</span></div></div>' +
    '<div class=foot>Guia gerada pelo LEDGR - Uso interno. Verificar valores antes do pagamento.</div>' +
    '</div></body></html>';
}

@Injectable()
export class GuiasService {
  constructor(private readonly prisma: PrismaService) {}

  async gerarReciboHtml(companyId: string, folhaId: string, funcionarioId: string): Promise<{ html: string }> {
    const ff = await this.prisma.folhaFuncionario.findFirstOrThrow({
      where: { id: funcionarioId, folhaId, companyId },
      include: { employee: { select: { fullName: true, taxId: true, role: true } }, folha: true },
    }) as any;
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const d = { ...ff, empresa: company.legalName, cnpjEmpresa: company.taxId,
      nomeFunc: ff.employee.fullName, cpfFunc: ff.employee.taxId, cargo: ff.employee.role,
      admissao: null, competencia: ff.folha.competencia };
    return { html: htmlRecibo(d) };
  }

  async gerarGpsHtml(companyId: string, folhaId: string): Promise<{ html: string }> {
    const folha = await this.prisma.folhaMensal.findFirstOrThrow({
      where: { id: folhaId, companyId },
      include: { funcionarios: { where: { tipoContrato: { in: ['CLT', 'TEMPORARIO'] } }, include: { employee: { select: { fullName: true, taxId: true } } } } },
    });
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    let ie = 0, ip = 0, rat = 0, terc = 0;
    const linhas = folha.funcionarios.map(f => {
      const a=Number(f.valorInss), b=Number(f.valorInssEmpregador), c=Number(f.valorRat), t=Number(f.valorTerceiros);
      ie+=a; ip+=b; rat+=c; terc+=t;
      return { nome: f.employee.fullName, cpf: f.employee.taxId, salarioBase: Number(f.salarioBase), inssEmp:a, inssPat:b, rat:c, terc:t };
    });
    const d = { cnpj: company.taxId, empresa: company.legalName, competencia: folha.competencia,
      inssEmpregado:ie, inssPatronal:ip, rat, terceiros:terc, totalGPS:ie+ip+rat+terc,
      vencimento: vencGPS(folha.competencia), linhas };
    return { html: htmlGPSFolha(d) };
  }

  async gerarDarfHtml(companyId: string, folhaId: string): Promise<{ html: string }> {
    const folha = await this.prisma.folhaMensal.findFirstOrThrow({
      where: { id: folhaId, companyId },
      include: { funcionarios: { include: { employee: { select: { fullName: true, taxId: true } } } } },
    });
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const linhas = folha.funcionarios.map(f => ({
      nome: f.employee.fullName, cpf: f.employee.taxId,
      baseIrrf: Number(f.baseIrrf), aliqIrrf: Number(f.aliqIrrf), irrf: Number(f.valorIrrf),
    }));
    const totalIrrf = linhas.reduce((s,l)=>s+l.irrf,0);
    if (totalIrrf <= 0) throw new Error('Nenhum IRRF retido nesta folha.');
    const d = { cnpj: company.taxId, empresa: company.legalName, competencia: folha.competencia,
      totalIrrf, numFuncsIrrf: linhas.filter(l=>l.irrf>0).length, vencimento: vencGPS(folha.competencia), linhas };
    return { html: htmlDARFFolha(d) };
  }

  async gerarReciboPdf(companyId: string, folhaId: string, funcionarioId: string): Promise<{ pdf: Buffer; filename: string }> {
    const ff = await this.prisma.folhaFuncionario.findFirstOrThrow({
      where: { id: funcionarioId, folhaId, companyId },
      include: {
        employee: { select: { fullName: true, taxId: true, role: true } },
        folha: true,
      },
    }) as any;
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const d = {
      ...ff,
      empresa: company.legalName, cnpjEmpresa: company.taxId,
      nomeFunc: ff.employee.fullName, cpfFunc: ff.employee.taxId, cargo: ff.employee.role,
      admissao: null,
      competencia: ff.folha.competencia,
    };
    const pdf = await renderPdf(htmlRecibo(d));
    const slug = (ff.employee.fullName||'func').toLowerCase().replace(/\s+/g, '_').slice(0, 30);
    return { pdf, filename: 'recibo_' + ff.folha.competencia.replace('-','_') + '_' + slug + '.pdf' };
  }

  async gerarGpsFolhaPdf(companyId: string, folhaId: string): Promise<{ pdf: Buffer; filename: string }> {
    const folha = await this.prisma.folhaMensal.findFirstOrThrow({
      where: { id: folhaId, companyId },
      include: {
        funcionarios: {
          where: { tipoContrato: { in: ['CLT', 'TEMPORARIO'] } },
          include: { employee: { select: { fullName: true, taxId: true } } },
        },
      },
    });
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    let ie = 0, ip = 0, rat = 0, terc = 0;
    const linhas = folha.funcionarios.map(f => {
      const a=Number(f.valorInss), b=Number(f.valorInssEmpregador), c=Number(f.valorRat), t=Number(f.valorTerceiros);
      ie+=a; ip+=b; rat+=c; terc+=t;
      return { nome: f.employee.fullName, cpf: f.employee.taxId, salarioBase: Number(f.salarioBase), inssEmp:a, inssPat:b, rat:c, terc:t };
    });
    const d = { cnpj: company.taxId, empresa: company.legalName, competencia: folha.competencia,
      inssEmpregado:ie, inssPatronal:ip, rat, terceiros:terc, totalGPS:ie+ip+rat+terc,
      vencimento: vencGPS(folha.competencia), linhas };
    const pdf = await renderPdf(htmlGPSFolha(d));
    return { pdf, filename: 'GPS_' + folha.competencia.replace('-','_') + '.pdf' };
  }

  async gerarDarfFolhaPdf(companyId: string, folhaId: string): Promise<{ pdf: Buffer; filename: string }> {
    const folha = await this.prisma.folhaMensal.findFirstOrThrow({
      where: { id: folhaId, companyId },
      include: { funcionarios: { include: { employee: { select: { fullName: true, taxId: true } } } } },
    });
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const linhas = folha.funcionarios.map(f => ({
      nome: f.employee.fullName, cpf: f.employee.taxId,
      baseIrrf: Number(f.baseIrrf), aliqIrrf: Number(f.aliqIrrf), irrf: Number(f.valorIrrf),
    }));
    const totalIrrf = linhas.reduce((s,l)=>s+l.irrf,0);
    if (totalIrrf <= 0) throw new Error('Nenhum IRRF retido nesta folha.');
    const d = { cnpj: company.taxId, empresa: company.legalName, competencia: folha.competencia,
      totalIrrf, numFuncsIrrf: linhas.filter(l=>l.irrf>0).length, vencimento: vencGPS(folha.competencia), linhas };
    const pdf = await renderPdf(htmlDARFFolha(d));
    return { pdf, filename: 'DARF_IRRF_' + folha.competencia.replace('-','_') + '.pdf' };
  }

  async gerarGuias(companyId: string, calculoId: string): Promise<any> {
    const calculo = await this.prisma.proLaboreCalculo.findFirst({
      where: { id: calculoId, companyId },
      include: { config: { include: { person: true } }, company: true },
    });
    if (!calculo) throw new Error('Calculo nao encontrado');
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    return { dados: {
      cpf: calculo.config.person.cpf, nome: calculo.config.person.fullName,
      cnpj: company!.taxId, empresa: company!.legalName, competencia: calculo.competencia,
      inssDiretor: Number(calculo.inssDiretor), inssEmpresa: Number(calculo.inssEmpresa),
      totalGPS: Number(calculo.inssDiretor)+Number(calculo.inssEmpresa),
      irrf: Number(calculo.irrf), vencimento: vencGPS(calculo.competencia),
    }};
  }

  async gerarGuiasLote(companyId: string, competencia: string): Promise<Buffer> {
    const calculos = await this.prisma.proLaboreCalculo.findMany({
      where: { companyId, competencia },
      include: { config: { include: { person: true } }, company: true },
    });
    if (!calculos.length) throw new Error('Nenhum calculo encontrado.');
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    let html = '<!DOCTYPE html><html><head><meta charset=utf-8></head><body>';
    for (const c of calculos) {
      const tot = Number(c.inssDiretor)+Number(c.inssEmpresa);
      html += '<p>' + c.config.person.fullName + ' GPS R$ ' + fmtBRL(tot) + '</p>';
    }
    html += '</body></html>';
    return renderPdf(html);
  }
}
