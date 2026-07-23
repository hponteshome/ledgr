// apps/api/src/modules/hr/services/trct-pdf.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import * as puppeteer from 'puppeteer';

const fmt     = (v: any) => Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCnpj = (v: string) => (v??'').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const fmtCpf  = (v: string) => (v??'').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
const fmtPis  = (v: string) => (v??'').replace(/^(\d{3})(\d{5})(\d{2})(\d)$/, '$1.$2.$3-$4');
const digits  = (v: string) => (v??'').replace(/\D/g,'');
const fmtDate = (v: any): string => {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
};
const br = (s: string|null|undefined) => s ?? '';

const MOTIVO_DESC: Record<string,string> = {
  SEM_JUSTA_CAUSA: 'Despedida sem justa causa, pelo empregador',
  JUSTA_CAUSA: 'Dispensa por justa causa',
  PEDIDO_DEMISSAO: 'Pedido de demissao',
  TERMINO_CONTRATO_DETERMINADO: 'Termino do contrato por prazo determinado',
  RESCISAO_INDIRETA: 'Rescisao indireta (falta grave do empregador)',
  ACORDO_484A: 'Acordo entre empregado e empregador (art. 484-A CLT)',
  APOSENTADORIA: 'Aposentadoria',
  FALECIMENTO: 'Falecimento',
  OUTROS: 'Outros',
};
const MOTIVO_COD: Record<string,string> = {
  SEM_JUSTA_CAUSA:'SJ2', JUSTA_CAUSA:'SJ3', PEDIDO_DEMISSAO:'SJ1',
  TERMINO_CONTRATO_DETERMINADO:'TS', RESCISAO_INDIRETA:'SJ8',
  ACORDO_484A:'SJ9', APOSENTADORIA:'AP', FALECIMENTO:'FA', OUTROS:'OU',
};
const AVISO_DESC: Record<string,string> = {
  INDENIZADO:'Indenizado', TRABALHADO:'Trabalhado', TRABALHADO_PARCIAL:'Misto (parcial trabalhado + indenizado)',
  DISPENSADO:'Dispensado pelo empregador', NAO_CUMPRIDO:'Nao cumprido', NAO_SE_APLICA:'Nao se aplica',
};

// Tabela Seguro-Desemprego 2026 (Portaria MTE, vigencia 11/01/2026)
function calcSD(salMedio: number, meses: number) {
  let val: number;
  if      (salMedio <= 2222.17) val = salMedio * 0.80;
  else if (salMedio <= 3703.99) val = 1777.74 + (salMedio - 2222.17) * 0.50;
  else                          val = 2518.65;
  val = Math.max(val, 1621.00);
  val = Math.round(val * 100) / 100;
  const parc = meses >= 24 ? 5 : meses >= 12 ? 4 : 3;
  return { val, parc, total: Math.round(val * parc * 100) / 100 };
}

@Injectable()
export class TrctPdfService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Busca dados ───────────────────────────────────────────────────────────────
  private async getData(companyId: string, employeeId: string) {
    const company = await this.prisma.company.findFirstOrThrow({ where: { id: companyId } });
    const emp     = await this.prisma.employee.findFirstOrThrow({ where: { id: employeeId, companyId, deletedAt: null } });
    const term    = await this.prisma.employeeTermination.findFirst({
      where: { companyId, employeeId, status: { not: 'CANCELADA' }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!term) throw new NotFoundException('Nenhuma rescisao confirmada. Confirme o TRCT antes de gerar o documento.');

    const mesesTrabalhados = (() => {
      const ini = new Date(emp.hireDate);
      const fim = new Date(term.dataAfastamento);
      return (fim.getUTCFullYear() - ini.getUTCFullYear()) * 12 + (fim.getUTCMonth() - ini.getUTCMonth());
    })();
    const salMedio = Number(emp.salary);
    const sd = calcSD(salMedio, mesesTrabalhados);

    return { company, emp, term, sd, mesesTrabalhados };
  }

  // ── CSS compartilhado ─────────────────────────────────────────────────────────
  private css(): string {
    return `
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: Arial, sans-serif; font-size:8pt; color:#000; background:#fff; padding:10mm; }
      table { border-collapse:collapse; width:100%; }
      td, th { font-size:7.5pt; }
      .b { font-weight:bold; }
      .c { text-align:center; }
      .r { text-align:right; }
      .lbl { font-size:6.5pt; color:#444; display:block; }
      .val { font-size:8pt; font-weight:bold; }
      .sec { border:1px solid #000; margin-bottom:3px; }
      .sec-hd { background:#d0d0d0; font-weight:bold; padding:2px 4px; font-size:8pt; border-bottom:1px solid #000; }
      .frow { display:flex; border-bottom:1px solid #ccc; }
      .frow:last-child { border-bottom:none; }
      .fc { padding:2px 4px; border-right:1px solid #ccc; flex:1; }
      .fc:last-child { border-right:none; }
      .mono { font-family:'Courier New',monospace; }
      .rub td { border:1px solid #000; padding:1px 4px; }
      .rub td.n { width:36px; text-align:center; }
      .rub td.v { width:90px; text-align:right; font-family:monospace; }
      .rub tr.tot td { background:#e8e8e8; font-weight:bold; }
      .sig { border-top:1px solid #000; margin-top:6mm; padding-top:2px; font-size:7pt; text-align:center; }
      @media print { body { padding:8mm; } }
    `;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TRCT HTML
  // ════════════════════════════════════════════════════════════════════════════
  async generateTRCTHtml(companyId: string, employeeId: string): Promise<string> {
    const { company, emp, term } = await this.getData(companyId, employeeId);
    const cnpj = digits(company.taxId);
    const cpf  = digits(emp.taxId);
    const pis  = digits(emp.pisNumber ?? '');

    const avDias = Number(term.diasAvisoPrevio) || 0;
    const avInd  = Number(term.diasAvisoIndenizados) || 0;
    const avTrab = Number(term.diasAvisoTrabalhados) || 0;
    const avLabel = avInd > 0
      ? `${avDias}d total (${avTrab}d trabalhados + ${avInd}d indenizados)`
      : avDias > 0 ? `${avDias} dias` : '';

    // Rubrics
    const r50 = Number(term.saldoSalarioValor);
    const r63 = Number(term.decimoTerceiroValor);
    const r65 = Number(term.feriasPropValor);
    const r66 = Number(term.feriasVencidasValor);
    const r68 = Number(term.feriasPropTerco) + Number(term.feriasVencidasTerco);
    const r69 = Number(term.avisoPrevioValor);
    const totalBruto = Number(term.totalProventos);

    // Calcular deducoes separadas
    const inssRemun = Number(term.baseInss) > 0
      ? Math.round((Number(term.valorInss) * Number(term.saldoSalarioValor) / (Number(term.baseInss)||1)) * 100) / 100
      : Number(term.valorInss);
    const inss13   = Number(term.valorInss) - inssRemun;
    const irrfRemun = Number(term.valorIrrf);
    const totalDeduc = Number(term.totalDescontos);
    const liquido    = Number(term.totalLiquido);

    // FGTS
    const fgtsMes   = Number(term.fgtsSobreVerbas);
    const saldoFgts = Number(term.saldoFgtsContaInformado);
    const multa     = Number(term.multaFgtsValor);
    const multaPerc = Number(term.multaFgtsPercentual) * 100;

    const today = new Date();
    const todayStr = fmtDate(today);

    return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<style>${this.css()}</style>
</head><body>

<!-- CABECALHO -->
<table style="border:1.5px solid #000; margin-bottom:3px;">
  <tr>
    <td style="width:50%; padding:4px 8px; border-right:1px solid #000; vertical-align:middle;">
      <div class="b" style="font-size:9pt;">MINISTERIO DO TRABALHO E EMPREGO</div>
      <div style="font-size:7.5pt;">Secretaria de Relacoes do Trabalho - SRT</div>
    </td>
    <td style="text-align:center; padding:4px 8px; vertical-align:middle;">
      <div class="b" style="font-size:11pt;">TERMO DE RESCISAO DO CONTRATO DE TRABALHO</div>
      <div style="font-size:7.5pt;">Portaria MTE n&ordm; 1.057/2012 | Gerado pelo LEDGR em ${todayStr}</div>
    </td>
  </tr>
</table>

<!-- DADOS DO EMPREGADOR -->
<div class="sec">
  <div class="sec-hd">IDENTIFICACAO DO EMPREGADOR</div>
  <div class="frow">
    <div class="fc" style="flex:2"><span class="lbl">Razao Social</span><span class="val">${br(company.legalName ?? (company as any).tradeName)}</span></div>
    <div class="fc"><span class="lbl">CNPJ</span><span class="val">${fmtCnpj(cnpj)}</span></div>
    <div class="fc"><span class="lbl">FPAS</span><span class="val">515</span></div>
  </div>
  <div class="frow">
    <div class="fc" style="flex:3"><span class="lbl">Endereco</span><span class="val">${[company.street, company.number, company.complement, company.neighborhood].filter(Boolean).join(', ')}</span></div>
    <div class="fc"><span class="lbl">Municipio/UF</span><span class="val">${br(company.city)}/${br(company.state)}</span></div>
    <div class="fc"><span class="lbl">CEP</span><span class="val">${br(company.zipCode)}</span></div>
  </div>
</div>

<!-- DADOS DO TRABALHADOR -->
<div class="sec">
  <div class="sec-hd">IDENTIFICACAO DO TRABALHADOR</div>
  <div class="frow">
    <div class="fc"><span class="lbl">10 - PIS/PASEP</span><span class="val">${fmtPis(pis)}</span></div>
    <div class="fc" style="flex:3"><span class="lbl">11 - Nome</span><span class="val">${br(emp.fullName)}</span></div>
    <div class="fc"><span class="lbl">Codigo</span><span class="val">1</span></div>
  </div>
  <div class="frow">
    <div class="fc" style="flex:3"><span class="lbl">12 - Endereco</span><span class="val">${[emp.street, emp.number, emp.complement].filter(Boolean).join(', ')}</span></div>
    <div class="fc"><span class="lbl">Bairro</span><span class="val">${br(emp.neighborhood)}</span></div>
  </div>
  <div class="frow">
    <div class="fc"><span class="lbl">14 - Municipio</span><span class="val">${br(emp.city)}</span></div>
    <div class="fc"><span class="lbl">15 - UF</span><span class="val">${br(emp.addressState)}</span></div>
    <div class="fc"><span class="lbl">16 - CEP</span><span class="val">${br(emp.zipCode)}</span></div>
    <div class="fc"><span class="lbl">17 - CTPS (n&ordm;, serie, UF)</span><span class="val">${br(emp.ctpsNumber)} S:${br(emp.ctpsSeries)}</span></div>
    <div class="fc"><span class="lbl">18 - CPF</span><span class="val">${fmtCpf(cpf)}</span></div>
  </div>
  <div class="frow">
    <div class="fc"><span class="lbl">19 - Data Nascimento</span><span class="val">${fmtDate(emp.birthDate)}</span></div>
    <div class="fc" style="flex:3"><span class="lbl">20 - Nome da Mae</span><span class="val">${br(emp.motherName)}</span></div>
  </div>
</div>

<!-- DADOS DO CONTRATO -->
<div class="sec">
  <div class="sec-hd">DADOS DO CONTRATO</div>
  <div class="frow">
    <div class="fc" style="flex:2"><span class="lbl">21 - Tipo de Contrato</span><span class="val">1 - Contrato de trabalho por prazo indeterminado</span></div>
    <div class="fc" style="flex:3"><span class="lbl">22 - Causa do Afastamento</span><span class="val">${MOTIVO_DESC[term.motivo] ?? term.motivo}</span></div>
  </div>
  <div class="frow">
    <div class="fc"><span class="lbl">23 - Remuneracao Mes Anterior</span><span class="val mono">R$ ${fmt(term.salarioBase)}</span></div>
    <div class="fc"><span class="lbl">24 - Data de Admissao</span><span class="val">${fmtDate(term.admissaoData)}</span></div>
    <div class="fc"><span class="lbl">25 - Data do Aviso Previo</span><span class="val">${fmtDate(term.dataAviso)}</span></div>
    <div class="fc"><span class="lbl">26 - Data de Afastamento</span><span class="val">${fmtDate(term.dataAfastamento)}</span></div>
    <div class="fc"><span class="lbl">27 - Cod. Afastamento</span><span class="val">${MOTIVO_COD[term.motivo] ?? '??'}</span></div>
  </div>
  <div class="frow">
    <div class="fc"><span class="lbl">28 - Pensao Alim. (%) TRCT</span><span class="val">0,00</span></div>
    <div class="fc"><span class="lbl">29 - Pensao Alim. (%) FGTS</span><span class="val">0,00</span></div>
    <div class="fc"><span class="lbl">30 - Categoria do Trabalhador</span><span class="val">1 - Empregado</span></div>
    <div class="fc"><span class="lbl">Aviso Previo</span><span class="val">${AVISO_DESC[term.tipoAvisoPrevio] ?? ''} ${avLabel}</span></div>
  </div>
  <div class="frow">
    <div class="fc" style="flex:2"><span class="lbl">31 - Codigo Sindical</span><span class="val">${br((company as any).codigoSindical)}</span></div>
    <div class="fc" style="flex:3"><span class="lbl">32 - CNPJ e Nome da Entidade Sindical Laboral</span><span class="val">&nbsp;</span></div>
  </div>
</div>

<!-- VERBAS RESCISORIAS -->
<div class="sec">
  <div class="sec-hd">DISCRIMINACAO DAS VERBAS RESCISORIAS</div>
  <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0; padding:4px;">
    <div style="font-size:7pt; font-weight:bold; border-bottom:1px solid #000; padding:2px;">Rubrica / Descricao</div>
    <div style="font-size:7pt; font-weight:bold; border-bottom:1px solid #000; padding:2px; border-left:1px solid #ccc;">Rubrica / Descricao</div>
    <div style="font-size:7pt; font-weight:bold; border-bottom:1px solid #000; padding:2px; border-left:1px solid #ccc;">Rubrica / Descricao</div>
  </div>
  <table class="rub">
    <colgroup><col style="width:36px"/><col/><col style="width:110px"/><col style="width:36px"/><col/><col style="width:110px"/><col style="width:36px"/><col/><col style="width:110px"/></colgroup>
    <tbody>
${[
  [50,`Saldo de ${Number(term.saldoSalarioDias)}/dias salario (liq. 0/faltas e DSR)`, r50,
   51,'Comissoes', 0,
   52,'Gratificacoes', 0],
  [53,'Adicional de insalubridade', 0,
   54,'Adicional de periculosidade', 0,
   55,'Adicional noturno', 0],
  [56,'Horas extras', 0,
   57,'Gorjetas', 0,
   58,'Descanso semanal remunerado (DSR)', 0],
  [59,'Reflexo do DSR sobre salario variavel', 0,
   60,'Multa Art. 477, par. 8 CLT', 0,
   62,'Salario-Familia', 0],
  [63,`13 salario proporcional ${Number(term.decimoTerceiroMeses)}/12 avos`, r63,
   64,'13 salario exercicios anteriores', 0,
   65,`Ferias proporcionais ${Number(term.feriasPropMeses)}/12 avos`, r65],
  [66,'Ferias vencidas', r66,
   68,'Terco constitucional de ferias', r68,
   69,`Aviso previo indenizado ${avInd} dias`, r69],
  [70,'13 salario (aviso previo indenizado)', 0,
   71,'Ferias (aviso previo indenizado)', 0,
   99,'Ajuste do saldo devedor', 0],
].map(row => `      <tr>
        <td class="n">${row[0]}</td><td>${row[1]}</td><td class="v">R$ ${fmt(row[2])}</td>
        <td class="n">${row[3]}</td><td>${row[4]}</td><td class="v">R$ ${fmt(row[5])}</td>
        <td class="n">${row[6]}</td><td>${row[7]}</td><td class="v">R$ ${fmt(row[8])}</td>
      </tr>`).join('\n')}
      <tr class="tot">
        <td colspan="6" style="text-align:right; padding:2px 8px; font-size:8pt;">TOTAL BRUTO</td>
        <td colspan="3" style="text-align:right; padding:2px 8px; font-size:8.5pt;" class="mono">R$ ${fmt(totalBruto)}</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- DEDUCOES -->
<div class="sec">
  <div class="sec-hd">DEDUCOES</div>
  <table class="rub">
    <colgroup><col style="width:36px"/><col/><col style="width:110px"/><col style="width:36px"/><col/><col style="width:110px"/><col style="width:36px"/><col/><col style="width:110px"/></colgroup>
    <tbody>
      <tr>
        <td class="n">100</td><td>Pensao alimenticia</td><td class="v">R$ 0,00</td>
        <td class="n">101</td><td>Adiantamento salarial</td><td class="v">R$ 0,00</td>
        <td class="n">102</td><td>Adiantamento de 13 salario</td><td class="v">R$ 0,00</td>
      </tr>
      <tr>
        <td class="n">103</td><td>Aviso previo indenizado dias</td><td class="v">R$ 0,00</td>
        <td class="n">112.1</td><td>Previdencia social (remuneracao)</td><td class="v">R$ ${fmt(inssRemun)}</td>
        <td class="n">112.2</td><td>Previdencia social - 13 salario</td><td class="v">R$ ${fmt(inss13)}</td>
      </tr>
      <tr>
        <td class="n">114.1</td><td>IRRF</td><td class="v">R$ ${fmt(irrfRemun)}</td>
        <td class="n">114.2</td><td>IRRF sobre 13 salario</td><td class="v">R$ 0,00</td>
        <td class="n"></td><td></td><td class="v"></td>
      </tr>
      <tr class="tot">
        <td colspan="6" style="text-align:right; padding:2px 8px; font-size:8pt;">TOTAL DEDUCOES</td>
        <td colspan="3" style="text-align:right; padding:2px 8px; font-size:8.5pt;" class="mono">R$ ${fmt(totalDeduc)}</td>
      </tr>
      <tr style="background:#fff; border-top:2px solid #000;">
        <td colspan="6" style="text-align:right; padding:3px 8px; font-size:9pt; font-weight:bold;">VALOR LIQUIDO</td>
        <td colspan="3" style="text-align:right; padding:3px 8px; font-size:10pt; font-weight:bold;" class="mono">R$ ${fmt(liquido)}</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- FGTS -->
<div class="sec" style="margin-bottom:6px;">
  <div class="sec-hd">FGTS (INFORMATIVO)</div>
  <table style="width:100%;">
    <tr>
      <td style="padding:3px 6px; border-right:1px solid #ccc; width:20%;"><span class="lbl">Base calculo FGTS</span><span class="val mono">R$ ${fmt(Number(term.baseFgtsMes))}</span></td>
      <td style="padding:3px 6px; border-right:1px solid #ccc; width:15%;"><span class="lbl">Deposito mes (8%)</span><span class="val mono">R$ ${fmt(fgtsMes)}</span></td>
      <td style="padding:3px 6px; border-right:1px solid #ccc; width:20%;"><span class="lbl">Saldo conta vinculada (informado)</span><span class="val mono">R$ ${fmt(saldoFgts)}</span></td>
      <td style="padding:3px 6px; border-right:1px solid #ccc; width:15%;"><span class="lbl">Multa ${multaPerc.toFixed(0)}%</span><span class="val mono">${saldoFgts > 0 ? 'R$ ' + fmt(multa) : 'Informar saldo'}</span></td>
      <td style="padding:3px 6px; width:30%;"><span class="lbl">Obs: Deposito e multa via GRRF - FGTS Digital</span><span class="val">&nbsp;</span></td>
    </tr>
  </table>
</div>

<!-- ASSINATURAS -->
<table style="width:100%; margin-top:8mm;">
  <tr>
    <td style="width:33%; text-align:center; padding:2px 8px;">
      <div style="border-top:1px solid #000; padding-top:3px; font-size:7.5pt;">
        ${br(company.city)}, ${todayStr}<br>
        <span class="b">Assinatura e Carimbo do Empregador</span>
      </div>
    </td>
    <td style="width:33%; text-align:center; padding:2px 8px;">
      <div style="border-top:1px solid #000; padding-top:3px; font-size:7.5pt;">
        Assinatura do Empregado<br>
        <span class="b">${br(emp.fullName)}</span><br>
        CPF: ${fmtCpf(cpf)}
      </div>
    </td>
    <td style="width:33%; text-align:center; padding:2px 8px;">
      <div style="border-top:1px solid #000; padding-top:3px; font-size:7.5pt;">
        Homologacao (quando obrigatoria)<br>
        <span class="b">Orgao / Sindicato</span>
      </div>
    </td>
  </tr>
</table>

<div style="margin-top:6px; font-size:6.5pt; color:#666; border-top:1px solid #ccc; padding-top:3px;">
  Documento gerado pelo sistema LEDGR em ${todayStr} | Rescisao: ${MOTIVO_DESC[term.motivo]} | Aviso: ${AVISO_DESC[term.tipoAvisoPrevio] ?? ''} ${avLabel} | Projecao fim: ${fmtDate(term.dataProjecaoFim)}
</div>
</body></html>`;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SEGURO-DESEMPREGO HTML (CD + SD)
  // ════════════════════════════════════════════════════════════════════════════
  async generateSDHtml(companyId: string, employeeId: string): Promise<string> {
    const { company, emp, term, sd, mesesTrabalhados } = await this.getData(companyId, employeeId);
    const cnpj = digits(company.taxId);
    const cpf  = digits(emp.taxId);
    const today = new Date();
    const todayStr = fmtDate(today);
    const salMedio = Number(emp.salary);
    const elegivel = ['SEM_JUSTA_CAUSA','RESCISAO_INDIRETA'].includes(term.motivo);

    return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<style>${this.css()}
  .page2 { page-break-before:always; margin-top:0; }
  .alert { background:#FEF3C7; border:1px solid #F59E0B; padding:6px 10px; font-size:8pt; margin-bottom:6px; border-radius:4px; }
  .ineligivel { background:#FEE2E2; border:1px solid #DC2626; padding:6px 10px; font-size:9pt; margin-bottom:6px; border-radius:4px; font-weight:bold; }
</style>
</head><body>

<!-- ─────────── PAGINA 1: COMUNICACAO DE DISPENSA ─────────── -->
<table style="border:1.5px solid #000; margin-bottom:3px;">
  <tr>
    <td style="width:50%; padding:4px 8px; border-right:1px solid #000;">
      <div class="b" style="font-size:9pt;">MINISTERIO DO TRABALHO E EMPREGO</div>
      <div style="font-size:7.5pt;">Programa do Seguro-Desemprego</div>
    </td>
    <td style="text-align:center; padding:4px 8px;">
      <div class="b" style="font-size:10.5pt;">COMUNICACAO DE DISPENSA</div>
      <div style="font-size:7.5pt;">Lei n&ordm; 7.998/1990 | Resolucao CODEFAT n&ordm; 957/2022</div>
    </td>
  </tr>
</table>

${!elegivel ? `<div class="ineligivel">ATENCAO: Motivo "${MOTIVO_DESC[term.motivo]}" NAO da direito ao Seguro-Desemprego. Este documento e gerado apenas para referencia.</div>` : ''}

<!-- EMPREGADOR -->
<div class="sec">
  <div class="sec-hd">DADOS DO EMPREGADOR (Preenchido pelo Empregador)</div>
  <div class="frow">
    <div class="fc" style="flex:3"><span class="lbl">Razao Social</span><span class="val">${br(company.legalName ?? (company as any).tradeName)}</span></div>
    <div class="fc"><span class="lbl">CNPJ</span><span class="val">${fmtCnpj(cnpj)}</span></div>
  </div>
  <div class="frow">
    <div class="fc" style="flex:3"><span class="lbl">Endereco</span><span class="val">${[company.street, company.number, company.city, company.state].filter(Boolean).join(', ')}</span></div>
    <div class="fc"><span class="lbl">CEP</span><span class="val">${br(company.zipCode)}</span></div>
  </div>
</div>

<!-- TRABALHADOR -->
<div class="sec">
  <div class="sec-hd">DADOS DO TRABALHADOR</div>
  <div class="frow">
    <div class="fc" style="flex:3"><span class="lbl">Nome Completo</span><span class="val">${br(emp.fullName)}</span></div>
    <div class="fc"><span class="lbl">CPF</span><span class="val">${fmtCpf(cpf)}</span></div>
    <div class="fc"><span class="lbl">PIS/PASEP</span><span class="val">${fmtPis(digits(emp.pisNumber ?? ''))}</span></div>
  </div>
  <div class="frow">
    <div class="fc"><span class="lbl">Data de Nascimento</span><span class="val">${fmtDate(emp.birthDate)}</span></div>
    <div class="fc"><span class="lbl">CTPS / Serie</span><span class="val">${br(emp.ctpsNumber)} / ${br(emp.ctpsSeries)}</span></div>
    <div class="fc"><span class="lbl">Data de Admissao</span><span class="val">${fmtDate(term.admissaoData)}</span></div>
    <div class="fc"><span class="lbl">Data de Dispensa</span><span class="val">${fmtDate(term.dataAfastamento)}</span></div>
    <div class="fc"><span class="lbl">Meses Trabalhados</span><span class="val">${mesesTrabalhados} meses</span></div>
  </div>
  <div class="frow">
    <div class="fc" style="flex:2"><span class="lbl">Funcao/Cargo</span><span class="val">${br(emp.role)}</span></div>
    <div class="fc" style="flex:3"><span class="lbl">Motivo da Dispensa</span><span class="val">${MOTIVO_DESC[term.motivo] ?? term.motivo}</span></div>
  </div>
</div>

<!-- REMUNERACOES -->
<div class="sec">
  <div class="sec-hd">REMUNERACOES DOS ULTIMOS 3 MESES ANTERIORES A DISPENSA</div>
  <table class="rub" style="width:50%;">
    <tr><th class="c">Competencia</th><th class="c">Salario Bruto (R$)</th></tr>
    <tr><td class="c">${String(new Date(term.dataAfastamento).getUTCMonth() + 1).padStart(2,'0')}/${new Date(term.dataAfastamento).getUTCFullYear() - (new Date(term.dataAfastamento).getUTCMonth() < 2 ? 1 : 0)}</td><td class="v">R$ ${fmt(salMedio)}</td></tr>
    <tr><td class="c">Mes anterior</td><td class="v">R$ ${fmt(salMedio)}</td></tr>
    <tr><td class="c">2 meses antes</td><td class="v">R$ ${fmt(salMedio)}</td></tr>
    <tr class="tot"><td class="c">Media</td><td class="v">R$ ${fmt(salMedio)}</td></tr>
  </table>
  <div style="padding:3px 4px; font-size:7pt; color:#555;">Obs: Valores baseados no salario base cadastrado. Ajuste se houver variacoes de comissoes ou hora-extras.</div>
</div>

<!-- DECLARACAO EMPREGADOR -->
<div style="margin-top:5mm; font-size:7.5pt; line-height:1.5;">
  <p>Declaro, para os fins do Programa do Seguro-Desemprego, que o(a) empregado(a) acima identificado(a) foi dispensado(a) sem justa causa na data informada, que nao possui beneficio de aposentadoria por tempo de servico ou de valor igual ou superior a um salario minimo, e que as informacoes acima sao verdadeiras.</p>
</div>
<div style="margin-top:10mm; display:flex; justify-content:space-between;">
  <div style="text-align:center; width:45%;">
    <div style="border-top:1px solid #000; padding-top:2px; font-size:7.5pt;">
      ${br(company.city)}, ${todayStr}<br>
      <span class="b">Assinatura e Carimbo do Empregador</span>
    </div>
  </div>
  <div style="text-align:center; width:45%;">
    <div style="border-top:1px solid #000; padding-top:2px; font-size:7.5pt;">
      Assinatura do Empregado<br>
      <span class="b">${br(emp.fullName)}</span>
    </div>
  </div>
</div>

<!-- ─────────── PAGINA 2: CALCULO DO BENEFICIO ─────────── -->
<div class="page2">
<table style="border:1.5px solid #000; margin-bottom:3px;">
  <tr>
    <td style="width:50%; padding:4px 8px; border-right:1px solid #000;">
      <div class="b" style="font-size:9pt;">MINISTERIO DO TRABALHO E EMPREGO</div>
    </td>
    <td style="text-align:center; padding:4px 8px;">
      <div class="b" style="font-size:10.5pt;">CALCULO DO BENEFICIO — SEGURO-DESEMPREGO 2026</div>
    </td>
  </tr>
</table>

<div class="alert">
  Tabela vigente desde 11/01/2026 (Resolucao CODEFAT). O trabalhador deve requerer o beneficio no portal gov.br/seguro-desemprego ou no SINE.
</div>

<div class="sec">
  <div class="sec-hd">CALCULO DAS PARCELAS</div>
  <table class="rub" style="width:70%;">
    <tr class="tot"><td colspan="2">Trabalhador</td></tr>
    <tr><td style="padding:3px 6px; width:50%;">Nome</td><td class="b" style="padding:3px 6px;">${br(emp.fullName)}</td></tr>
    <tr><td style="padding:3px 6px;">CPF</td><td style="padding:3px 6px;" class="mono">${fmtCpf(cpf)}</td></tr>
    <tr><td style="padding:3px 6px;">Data Dispensa</td><td style="padding:3px 6px;">${fmtDate(term.dataAfastamento)}</td></tr>
    <tr><td style="padding:3px 6px;">Meses trabalhados</td><td style="padding:3px 6px;">${mesesTrabalhados} meses</td></tr>
    <tr class="tot"><td colspan="2">Calculo</td></tr>
    <tr><td style="padding:3px 6px;">Media salarial (3 meses)</td><td class="v" style="padding:3px 6px;">R$ ${fmt(salMedio)}</td></tr>
    <tr><td style="padding:3px 6px;">Faixa aplicavel</td><td style="padding:3px 6px;">${salMedio > 3703.99 ? 'Acima de R$ 3.703,99 → teto' : salMedio > 2222.17 ? 'R$ 2.222,18 a R$ 3.703,99 → 50% do excedente + R$ 1.777,74' : 'Ate R$ 2.222,17 → 80% do salario medio'}</td></tr>
    <tr><td style="padding:3px 6px;">Valor de cada parcela</td><td class="v b" style="padding:3px 6px; font-size:9.5pt; color:#15803D;">R$ ${fmt(sd.val)}</td></tr>
    <tr><td style="padding:3px 6px;">Numero de parcelas</td><td class="b" style="padding:3px 6px; font-size:9.5pt;">${sd.parc} parcelas</td></tr>
    <tr class="tot"><td style="padding:3px 6px;">Total estimado do beneficio</td><td class="v" style="padding:3px 6px; font-size:10pt;">R$ ${fmt(sd.total)}</td></tr>
  </table>
</div>

<div class="sec" style="margin-top:6px;">
  <div class="sec-hd">REGRAS 2026 (Tabela MTE — Portaria vigente 11/01/2026)</div>
  <table class="rub" style="width:80%;">
    <tr><th>Salario Medio (3 meses)</th><th>Calculo da Parcela</th></tr>
    <tr><td>Ate R$ 2.222,17</td><td>Salario medio x 80%</td></tr>
    <tr><td>De R$ 2.222,18 a R$ 3.703,99</td><td>R$ 1.777,74 + (excedente x 50%)</td></tr>
    <tr><td>Acima de R$ 3.703,99</td><td>Teto: R$ 2.518,65 (fixo)</td></tr>
    <tr class="tot"><td>Minimo</td><td>R$ 1.621,00 (salario minimo 2026)</td></tr>
  </table>
  <div style="padding:4px; font-size:7pt; color:#555;">
    Parcelas: ate 11 meses trabalhados = 3 parcelas | 12-23 meses = 4 parcelas | 24+ meses = 5 parcelas (1&ordm; requerimento).
  </div>
</div>

<div style="margin-top:5mm; font-size:7.5pt; line-height:1.6; border:1px solid #ccc; padding:6px;">
  <strong>COMO REQUERER:</strong><br>
  1. Acesse gov.br/seguro-desemprego ou baixe o app Carteira de Trabalho Digital<br>
  2. Aguarde de 7 a 120 dias apos a data de dispensa para requerer<br>
  3. Tenha em maos: CPF, PIS, CTPS, Termo de Rescisao e Comunicacao de Dispensa<br>
  4. O beneficio e pago pela Caixa Economica Federal (conta poupanca social ou conta Caixa Tem)
</div>
</div>

<div style="margin-top:4px; font-size:6.5pt; color:#888;">Gerado pelo LEDGR em ${todayStr} | Valores estimados. Sujeito a confirmacao pelo MTE.</div>
</body></html>`;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PDF via Puppeteer
  // ════════════════════════════════════════════════════════════════════════════
  async generateTRCTPdf(companyId: string, employeeId: string): Promise<Buffer> {
    const html = await this.generateTRCTHtml(companyId, employeeId);
    return this.htmlToPdf(html);
  }

  async generateSDPdf(companyId: string, employeeId: string): Promise<Buffer> {
    const html = await this.generateSDHtml(companyId, employeeId);
    return this.htmlToPdf(html, true);
  }

  private async htmlToPdf(html: string, landscape = false): Promise<Buffer> {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        landscape,
        printBackground: true,
        margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
