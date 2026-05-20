// apps/api/src/modules/hr/informe-pdf.service.ts
import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

const fmt = (v: any) => Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCnpj = (v: string) => v?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') ?? '';
const fmtCpf  = (v: string) => v?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') ?? '';
const fmtCep  = (v: string) => v?.replace(/(\d{5})(\d{3})/, '$1-$2') ?? '';
const fmtDate = (v: any) => v ? new Date(v).toLocaleDateString('pt-BR') : '';

@Injectable()
export class InformePdfService {
  async generate(inf: any): Promise<Buffer> {
    const c = inf.company;
    const p = inf.person;
    const anoExercicio = inf.anoCalendario + 1;

    const enderecoPJ = [c.street, c.number, c.complement, c.neighborhood, c.city, c.state].filter(Boolean).join(', ');
    const enderecoPF = [p.street, p.number, p.complement, p.neighborhood, p.city, p.state].filter(Boolean).join(', ');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 8.5pt; color: #000; background: #fff; padding: 15mm 15mm 10mm 15mm; }
  .header-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  .header-left { width: 60%; vertical-align: top; padding: 4px 8px; }
  .header-right { width: 40%; vertical-align: top; text-align: right; padding: 4px 8px; border-left: 1px solid #000; }
  .header-left .ministerio { font-size: 9pt; font-weight: bold; }
  .header-left .sub { font-size: 8pt; }
  .header-right .titulo { font-size: 9pt; font-weight: bold; }
  .header-right .ano { font-size: 8.5pt; }
  .aviso { font-size: 7.5pt; margin: 6px 0; line-height: 1.4; border: 1px solid #000; padding: 4px; }
  .section { margin-top: 6px; }
  .section-title { font-weight: bold; font-size: 8.5pt; background: #fff; border-top: 1px solid #000; border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px 4px; }
  .field-table { width: 100%; border-collapse: collapse; }
  .field-table td { border: 1px solid #000; padding: 2px 4px; font-size: 8pt; }
  .field-label { font-size: 7pt; color: #333; display: block; }
  .field-value { font-size: 8.5pt; }
  .valor-table { width: 100%; border-collapse: collapse; }
  .valor-table td { border: 1px solid #000; padding: 2px 4px; font-size: 8pt; }
  .valor-table td.desc { width: 75%; }
  .valor-table td.val  { width: 25%; text-align: right; font-family: 'Courier New', monospace; }
  .valores-header { background: #fff; }
  .rodape { margin-top: 8px; font-size: 7pt; }
  .logo { width: 45px; height: 45px; margin-right: 8px; float: left; }
  .header-inner { display: flex; align-items: flex-start; }
  table.outer { width: 100%; border-collapse: collapse; border: 1px solid #000; }
  table.outer td { border: 1px solid #000; padding: 2px 4px; }
</style>
</head>
<body>

<!-- CABEÇALHO -->
<table style="width:100%;border-collapse:collapse;border:1px solid #000;">
  <tr>
    <td style="width:55%;padding:4px 8px;border-right:1px solid #000;vertical-align:top;">
      <div style="display:flex;align-items:center;">
        <div>
          <div style="font-size:9pt;font-weight:bold;">${c.legalName}</div>
          <div style="font-size:8pt;">CNPJ: ${fmtCnpj(c.taxId)}</div>
                    <div style="font-size:8pt;">Exercício de ${anoExercicio}</div>
        </div>
      </div>
    </td>
    <td style="width:45%;padding:4px 8px;vertical-align:top;text-align:right;">
      <div style="font-size:9pt;font-weight:bold;">Comprovante de Rendimentos Pagos e de</div>
      <div style="font-size:9pt;font-weight:bold;">Imposto sobre a Renda Retido na Fonte</div>
      <div style="font-size:8.5pt;margin-top:4px;">Ano-calendário de ${inf.anoCalendario}</div>
    </td>
  </tr>
</table>

<!-- AVISO -->
<div style="font-size:7.5pt;padding:4px;border:1px solid #000;border-top:none;line-height:1.4;">
  Verifique as condições e o prazo para a apresentação da Declaração do Imposto sobre a Renda da Pessoa Física para este ano-calendário no sítio
  da Secretaria Especial da Receita Federal do Brasil na Internet, no endereço &lt;https://www.gov.br/receitafederal/pt-br&gt;.
</div>

<!-- FONTE PAGADORA -->
<div style="margin-top:4px;">
  <div style="font-weight:bold;font-size:8.5pt;padding:2px 4px;border:1px solid #000;border-bottom:none;">1. Fonte Pagadora Pessoa Jurídica</div>
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="width:35%;border:1px solid #000;padding:2px 4px;">
        <span style="font-size:7pt;display:block;">CNPJ</span>
        <span style="font-size:8.5pt;">${fmtCnpj(c.taxId)}</span>
      </td>
      <td style="width:65%;border:1px solid #000;border-left:none;padding:2px 4px;">
        <span style="font-size:7pt;display:block;">Nome Empresarial</span>
        <span style="font-size:8.5pt;">${c.legalName}</span>
      </td>
    </tr>
  </table>
</div>

<!-- BENEFICIÁRIO -->
<div style="margin-top:4px;">
  <div style="font-weight:bold;font-size:8.5pt;padding:2px 4px;border:1px solid #000;border-bottom:none;">2. Pessoa Física Beneficiária dos Rendimentos</div>
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="width:35%;border:1px solid #000;padding:2px 4px;">
        <span style="font-size:7pt;display:block;">CPF</span>
        <span style="font-size:8.5pt;">${fmtCpf(p.cpf)}</span>
      </td>
      <td style="width:65%;border:1px solid #000;border-left:none;padding:2px 4px;">
        <span style="font-size:7pt;display:block;">Nome Completo</span>
        <span style="font-size:8.5pt;">${p.fullName}</span>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="border:1px solid #000;border-top:none;padding:2px 4px;">
        <span style="font-size:7pt;display:block;">Natureza do Rendimento</span>
        <span style="font-size:8.5pt;">${inf.naturezaRendimento}</span>
      </td>
    </tr>
  </table>
</div>

<!-- QUADRO 3 -->
<div style="margin-top:4px;">
  <div style="font-weight:bold;font-size:8.5pt;padding:2px 4px;border:1px solid #000;border-bottom:none;display:flex;justify-content:space-between;">
    <span>3. Rendimentos Tributáveis, Deduções e Imposto sobre a Renda Retido da Fonte</span>
    <span style="font-weight:normal;font-style:italic;">Valores em reais</span>
  </div>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="width:75%;border:1px solid #000;padding:2px 4px;">1. Total dos rendimentos (inclusive férias)</td><td style="width:25%;border:1px solid #000;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q3TotalRendimentos)}</td></tr>
    <tr><td style="border:1px solid #000;border-top:none;padding:2px 4px;">2. Contribuição previdenciária oficial</td><td style="border:1px solid #000;border-top:none;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q3ContribPrevidenciaria)}</td></tr>
    <tr><td style="border:1px solid #000;border-top:none;padding:2px 4px;">3. Contribuição a entidades de previdência complementar, pública ou privada, e a fundos de aposentadoria programada individual (Fapi)(preencher também o quadro 7)</td><td style="border:1px solid #000;border-top:none;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q3ContribPrevidCompl)}</td></tr>
    <tr><td style="border:1px solid #000;border-top:none;padding:2px 4px;">4. Pensão alimentícia (preencher também o quadro 7)</td><td style="border:1px solid #000;border-top:none;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q3PensaoAlimenticia)}</td></tr>
    <tr><td style="border:1px solid #000;border-top:none;padding:2px 4px;">5. Imposto sobre a renda retido na fonte</td><td style="border:1px solid #000;border-top:none;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q3Irrf)}</td></tr>
  </table>
</div>

<!-- QUADRO 4 -->
<div style="margin-top:4px;">
  <div style="font-weight:bold;font-size:8.5pt;padding:2px 4px;border:1px solid #000;border-bottom:none;display:flex;justify-content:space-between;">
    <span>4. Rendimentos Isentos e Não Tributáveis</span>
    <span style="font-weight:normal;font-style:italic;">Valores em reais</span>
  </div>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="width:75%;border:1px solid #000;padding:2px 4px;">1. Parcela isenta dos proventos de aposentadoria, reserva remunerada, reforma e pensão (65 anos ou mais), exceto a parcela isenta do 13º (décimo terceiro) salário</td><td style="width:25%;border:1px solid #000;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q4ParcelaIsentaAposent)}</td></tr>
    <tr><td style="border:1px solid #000;border-top:none;padding:2px 4px;">2. Parcela isenta do 13º salário de aposentadoria, reserva remunerada, reforma e pensão (65 anos ou mais)</td><td style="border:1px solid #000;border-top:none;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q4ParcelaIsenta13)}</td></tr>
    <tr><td style="border:1px solid #000;border-top:none;padding:2px 4px;">3. Diárias e ajuda de custo</td><td style="border:1px solid #000;border-top:none;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q4DiariasAjudaCusto)}</td></tr>
    <tr><td style="border:1px solid #000;border-top:none;padding:2px 4px;">4. Pensão e proventos de aposentadoria ou reforma por moléstia grave; proventos de aposentadoria ou reforma por acidente em serviço</td><td style="border:1px solid #000;border-top:none;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q4PensaoMolestia)}</td></tr>
    <tr><td style="border:1px solid #000;border-top:none;padding:2px 4px;">5. Lucros e dividendos, apurados a partir de 1996, pagos por pessoa jurídica (lucro real, presumido ou arbitrado)</td><td style="border:1px solid #000;border-top:none;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q4LucrosDividendos)}</td></tr>
    <tr><td style="border:1px solid #000;border-top:none;padding:2px 4px;">6. Valores pagos ao titular ou sócio da microempresa ou empresa de pequeno porte, exceto pro labore, aluguéis ou serviços prestados</td><td style="border:1px solid #000;border-top:none;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q4ValoresMEI)}</td></tr>
    <tr><td style="border:1px solid #000;border-top:none;padding:2px 4px;">7. Indenizações por rescisão de contrato de trabalho, inclusive a título de PDV e por acidente de trabalho</td><td style="border:1px solid #000;border-top:none;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q4IndenizacaoRescisao)}</td></tr>
    <tr><td style="border:1px solid #000;border-top:none;padding:2px 4px;">8. Juros de mora recebidos, devidos pelo atraso no pagamento de remuneração por exercício de emprego, cargo ou função</td><td style="border:1px solid #000;border-top:none;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q4JurosMora)}</td></tr>
    <tr><td style="border:1px solid #000;border-top:none;padding:2px 4px;">9. Outros:</td><td style="border:1px solid #000;border-top:none;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q4Outros)}</td></tr>
  </table>
</div>

<!-- QUADRO 5 -->
<div style="margin-top:4px;">
  <div style="font-weight:bold;font-size:8.5pt;padding:2px 4px;border:1px solid #000;border-bottom:none;display:flex;justify-content:space-between;">
    <span>5. Rendimentos Sujeitos à Tributação Exclusiva (rendimento líquido)</span>
    <span style="font-weight:normal;font-style:italic;">Valores em reais</span>
  </div>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="width:75%;border:1px solid #000;padding:2px 4px;">1. Décimo terceiro salário</td><td style="width:25%;border:1px solid #000;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q5DecimoTerceiro)}</td></tr>
    <tr><td style="border:1px solid #000;border-top:none;padding:2px 4px;">2. Imposto sobre a renda retido na fonte sobre 13º salário</td><td style="border:1px solid #000;border-top:none;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q5IrrfDecimoTerceiro)}</td></tr>
    <tr><td style="border:1px solid #000;border-top:none;padding:2px 4px;">3. Outros</td><td style="border:1px solid #000;border-top:none;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q5Outros)}</td></tr>
  </table>
</div>

<!-- QUADRO 6 -->
<div style="margin-top:4px;">
  <div style="font-weight:bold;font-size:8.5pt;padding:2px 4px;border:1px solid #000;border-bottom:none;">
    6. Rendimentos Recebidos Acumuladamente - Art. 12-A da Lei nº 7.713, de 1988 (sujeitos à tributação exclusiva)
  </div>
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="width:60%;border:1px solid #000;padding:2px 4px;">6.1 Número do processo: ${inf.q6NumeroProcesso ?? ''}</td>
      <td style="width:25%;border:1px solid #000;border-left:none;padding:2px 4px;">Quantidade de meses</td>
      <td style="width:15%;border:1px solid #000;border-left:none;padding:2px 4px;text-align:right;">${fmt(inf.q6QtdMeses)}</td>
    </tr>
    <tr>
      <td colspan="2" style="border:1px solid #000;border-top:none;padding:2px 4px;">Natureza do rendimento: ${inf.q6NaturezaRendimento ?? ''}</td>
      <td style="border:1px solid #000;border-top:none;border-left:none;padding:2px 4px;text-align:right;font-style:italic;">Valores em reais</td>
    </tr>
    <tr><td colspan="2" style="border:1px solid #000;border-top:none;padding:2px 4px;">1. Total dos rendimentos tributáveis (inclusive férias e décimo terceiro salário)</td><td style="border:1px solid #000;border-top:none;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q6TotalRendimentos)}</td></tr>
    <tr><td colspan="2" style="border:1px solid #000;border-top:none;padding:2px 4px;">2. Exclusão: Despesas com a ação judicial</td><td style="border:1px solid #000;border-top:none;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q6ExclusaoDespesas)}</td></tr>
    <tr><td colspan="2" style="border:1px solid #000;border-top:none;padding:2px 4px;">3. Dedução: Contribuição previdenciária oficial</td><td style="border:1px solid #000;border-top:none;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q6ContribPrevidenciaria)}</td></tr>
    <tr><td colspan="2" style="border:1px solid #000;border-top:none;padding:2px 4px;">4. Dedução: Pensão alimentícia (preencher também o quadro 7)</td><td style="border:1px solid #000;border-top:none;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q6PensaoAlimenticia)}</td></tr>
    <tr><td colspan="2" style="border:1px solid #000;border-top:none;padding:2px 4px;">5. Imposto sobre a renda retido na fonte (IRRF)</td><td style="border:1px solid #000;border-top:none;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q6Irrf)}</td></tr>
    <tr><td colspan="2" style="border:1px solid #000;border-top:none;padding:2px 4px;">6. Rendimentos isentos de pensão, proventos de aposentadoria ou reforma por moléstia grave ou aposentadoria ou reforma por acidente em serviço</td><td style="border:1px solid #000;border-top:none;border-left:none;padding:2px 4px;text-align:right;font-family:monospace;">${fmt(inf.q6RendIsentoMolestia)}</td></tr>
  </table>
</div>

<!-- QUADRO 7 -->
<div style="margin-top:4px;">
  <div style="font-weight:bold;font-size:8.5pt;padding:2px 4px;border:1px solid #000;border-bottom:none;">7. Informações Complementares</div>
  <div style="border:1px solid #000;padding:4px;min-height:24px;font-size:8pt;">${inf.q7InformacoesCompl ?? ''}</div>
</div>

<!-- QUADRO 8 -->
<div style="margin-top:4px;">
  <div style="font-weight:bold;font-size:8.5pt;padding:2px 4px;border:1px solid #000;border-bottom:none;">8. Responsável pelas Informações</div>
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="width:50%;border:1px solid #000;padding:2px 4px;">
        <span style="font-size:7pt;display:block;">Nome</span>
        <span style="font-size:8.5pt;">${inf.q8NomeResponsavel ?? ''}</span>
      </td>
      <td style="width:25%;border:1px solid #000;border-left:none;padding:2px 4px;">
        <span style="font-size:7pt;display:block;">Data</span>
        <span style="font-size:8.5pt;">${fmtDate(inf.q8DataAssinatura)}</span>
      </td>
      <td style="width:25%;border:1px solid #000;border-left:none;padding:2px 4px;">
        <span style="font-size:7pt;display:block;">Assinatura</span>
        <span style="font-size:8.5pt;">&nbsp;</span>
      </td>
    </tr>
  </table>
</div>

      <div style="margin-top:6px;font-size:7.5pt;">Gerado na Plataforma LEDGR - Aprovado pela Instrução Normativa RFB nº 2.060, de 13 de dezembro de 2021.</div>
<div style="text-align:right;font-size:7.5pt;margin-top:2px;">Pág. 1</div>

</body>
</html>`;

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const buffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
    await browser.close();
    return Buffer.from(buffer);
  }
}

