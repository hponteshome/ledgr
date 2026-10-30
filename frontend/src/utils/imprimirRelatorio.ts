// frontend/src/utils/imprimirRelatorio.ts
// CRIADO 31/08/2026: helper compartilhado de impressao/PDF - meio-termo entre
// modal 100% generico (nao serve bem pra relatorios com formato muito
// diferente entre si) e um modal especifico do zero por tela (duplica a
// parte comum - cabecalho formal, CNPJ, pagina/data/hora - em cada tela nova).
// Cuida so da parte COMUM (cabecalho, estilo de impressao, disparo do
// window.print()) - cada tela fornece seu proprio corpo HTML (tabela),
// mesmo padrao ja usado em DiarioGeralPage.tsx/RazaoAnaliticoPage.tsx antes
// desta extracao.
import api from '../services/api';

export interface ImprimirRelatorioOptions {
  titulo: string;
  subtitulo?: string;
  empresaNome: string;
  empresaCnpj: string;
  periodo?: string;
  corpoHtml: string;
  rodapeHtml?: string;
  // NOVO 12/09/2026: quando true, a previa NAO fica limitada a largura de uma
  // folha A4 (21cm) - usa a largura total da janela. Para relatorios com
  // muitas colunas dinamicas (ex: Comparativo de Saldos). Default false
  // preserva 100% o comportamento atual de todas as telas existentes.
  larguraTotal?: boolean;
  // NOVO 30/10/2026: bloco de assinaturas (HTML pronto, ver montarAssinaturasHtml).
  // Quando informado, a barra de opcoes da janela mostra o check "Com assinaturas".
  assinaturasHtml?: string;
}

const fmtCnpj = (cnpj: string) => {
  const d = (cnpj || '').replace(/\D/g, '');
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : cnpj;
};

export function imprimirRelatorio(opts: ImprimirRelatorioOptions): void {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const hora = new Date().toLocaleTimeString('pt-BR');
  const cnpj = fmtCnpj(opts.empresaCnpj);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${opts.titulo}</title><style>
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; margin: 0; background: #78716c; }
    .pagina { max-width: ${opts.larguraTotal ? 'none' : '21cm'}; margin: ${opts.larguraTotal ? '24px' : '24px auto'}; padding: 24px; background: #fff; box-shadow: ${opts.larguraTotal ? 'none' : '0 2px 12px rgba(0,0,0,0.15)'}; box-sizing: border-box; }
    @media print { body { background: #fff; } .pagina { max-width: none; margin: 0; padding: 12px; box-shadow: none; } }
    .cabecalho { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 16px; }
    .cabecalho .empresa { font-size: 13px; }
    .cabecalho .empresa .nome { font-weight: bold; font-size: 14px; }
    .cabecalho .empresa .cnpj { font-family: monospace; color: #444; margin-top: 2px; }
    .cabecalho .meta { text-align: right; font-size: 11px; color: #444; }
    h1 { font-size: 16px; text-align: center; margin: 4px 0; }
    .subtitulo { text-align: center; font-size: 12px; color: #555; margin-bottom: 4px; }
    .periodo { text-align: center; font-size: 11px; color: #777; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; text-transform: uppercase; font-size: 10px; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .total { font-weight: bold; background: #f9f9f9; }
    .rodape { margin-top: 30px; font-size: 11px; color: #444; white-space: pre-line; border-top: 1px solid #ccc; padding-top: 12px; }
    @media print { body { margin: 12px; } }
  </style></head><body>${opcoesImpressaoHtml(!!opts.assinaturasHtml)}<div class="pagina">
    <div class="cabecalho">
      <div class="empresa">
        <div class="nome">${opts.empresaNome}</div>
        ${cnpj ? `<div class="cnpj">CNPJ: ${cnpj}</div>` : ''}
      </div>
      <div class="meta opt-datahora">
        <div>Data: ${hoje}</div>
        <div>Hora: ${hora}</div>
      </div>
    </div>
    <h1>${opts.titulo}</h1>
    ${opts.subtitulo ? `<div class="subtitulo">${opts.subtitulo}</div>` : ''}
    ${opts.periodo ? `<div class="periodo">Período: ${opts.periodo}</div>` : ''}
    ${opts.corpoHtml}
    ${opts.rodapeHtml ? `<div class="rodape">${opts.rodapeHtml}</div>` : ''}
    ${opts.assinaturasHtml || ''}
    </div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

// ============================================================================
// NOVO 30/10/2026: barra de opcoes da janela de impressao (nao sai no papel).
// - "Data e hora": mostra/oculta os elementos com a classe opt-datahora.
// - "Com assinaturas" (so quando a tela fornece o bloco): mostra/oculta .assinaturas.
// A janela nao imprime mais sozinha: o usuario ajusta e clica em "Imprimir".
// As escolhas ficam no localStorage (mesma origem do sistema) e voltam marcadas.
// Usado pelo helper acima e pelas telas que montam o proprio HTML (DRE, BP,
// Diario, Razao): basta inserir logo depois de <body>.
// ============================================================================
const LS_DATA_HORA = 'ledgr.print.dataHora';
const LS_ASSINATURAS = 'ledgr.print.assinaturas';

export function opcoesImpressaoHtml(comAssinaturas = false): string {
  return '<style>' +
    '.barra-opcoes{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:18px;padding:10px 16px;background:#1f2937;color:#fff;font-family:Arial,sans-serif;font-size:13px}' +
    '.barra-opcoes label{display:flex;align-items:center;gap:6px;cursor:pointer}' +
    '.barra-opcoes button{margin-left:auto;padding:6px 18px;border:none;border-radius:6px;background:#fff;color:#111;font-weight:600;cursor:pointer}' +
    '.assinaturas{page-break-inside:avoid;break-inside:avoid}' +
    '@media print{.barra-opcoes{display:none !important}}' +
    '</style>' +
    '<div class="barra-opcoes">' +
    '<label><input type="checkbox" id="optDataHora"/> Data e hora</label>' +
    (comAssinaturas ? '<label><input type="checkbox" id="optAssinaturas"/> Com assinaturas</label>' : '') +
    '<button type="button" onclick="window.print()">Imprimir</button>' +
    '</div>' +
    '<script>(function(){' +
    'function ler(k,d){try{var v=window.localStorage.getItem(k);return v===null?d:v==="1";}catch(e){return d;}}' +
    'function gravar(k,v){try{window.localStorage.setItem(k,v?"1":"0");}catch(e){}}' +
    'function aplicar(){var dh=document.getElementById("optDataHora");var as=document.getElementById("optAssinaturas");' +
    'Array.prototype.forEach.call(document.querySelectorAll(".opt-datahora"),function(el){el.style.visibility=(dh&&!dh.checked)?"hidden":"";});' +
    'Array.prototype.forEach.call(document.querySelectorAll(".assinaturas"),function(el){el.style.display=(as&&as.checked)?"":"none";});}' +
    'window.addEventListener("load",function(){var dh=document.getElementById("optDataHora");var as=document.getElementById("optAssinaturas");' +
    'if(dh){dh.checked=ler("' + LS_DATA_HORA + '",true);dh.onchange=function(){gravar("' + LS_DATA_HORA + '",dh.checked);aplicar();};}' +
    'if(as){as.checked=ler("' + LS_ASSINATURAS + '",true);as.onchange=function(){gravar("' + LS_ASSINATURAS + '",as.checked);aplicar();};}' +
    'aplicar();});' +
    '})();<\/script>';
}

// Signatarios: os mesmos do J930 da ECD - vinculos PF da empresa com assinaEcd
// (exceto o papel contador) e o contador da aba Contabil (company_accounting_configs).
export interface SignatarioRelatorio { nome: string; qualificacao: string; documento: string; }

const QUALIFICACAO_POR_PAPEL: Record<string, string> = {
  diretor_presidente: 'Diretor Presidente', diretor_vice_presidente: 'Diretor Vice-Presidente',
  diretor_financeiro: 'Diretor Financeiro', diretor_operacional: 'Diretor Operacional',
  procurador: 'Procurador', socio: 'Sócio', acionista: 'Acionista',
  representante_legal: 'Representante Legal', secretario: 'Secretário', responsavel_tecnico: 'Responsável Técnico',
};

const fmtCpf = (v: string) => {
  const d = (v || '').replace(/\D/g, '');
  return d.length === 11 ? d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9) : v;
};

export async function buscarSignatarios(companyId: string): Promise<SignatarioRelatorio[]> {
  const lista: SignatarioRelatorio[] = [];
  const [links, cfg] = await Promise.all([
    api.get('/persons/links/company/' + companyId).then(r => r.data || []).catch(() => []),
    api.get('/accounting/config', { headers: { 'x-company-id': companyId } }).then(r => r.data).catch(() => null),
  ]);
  for (const l of links as any[]) {
    const papel = String(l.role || '').toLowerCase();
    if (!l.assinaEcd || papel === 'contador') continue;
    lista.push({
      nome: l.person?.fullName || '',
      qualificacao: QUALIFICACAO_POR_PAPEL[papel] || 'Administrador',
      documento: l.person?.cpf ? 'CPF ' + fmtCpf(l.person.cpf) : '',
    });
  }
  if (cfg?.accountantName) {
    const crc = cfg.accountantCrc ? 'CRC ' + (cfg.accountantCrcState ? cfg.accountantCrcState + '-' : '') + cfg.accountantCrc : '';
    const cpf = cfg.accountantCpf ? 'CPF ' + fmtCpf(cfg.accountantCpf) : '';
    lista.push({ nome: cfg.accountantName, qualificacao: 'Contador', documento: [crc, cpf].filter(Boolean).join(' · ') });
  }
  return lista;
}

export async function montarAssinaturasHtml(companyId: string): Promise<string> {
  let lista: SignatarioRelatorio[] = [];
  try { lista = await buscarSignatarios(companyId); } catch { lista = []; }
  if (!lista.length) {
    // Sem cadastro: linhas em branco para assinatura manual.
    lista = [{ nome: '', qualificacao: 'Responsável legal', documento: '' }, { nome: '', qualificacao: 'Contador', documento: 'CRC' }];
  }
  const caixa = (s: SignatarioRelatorio) =>
    '<div style="width:240px;text-align:center;font-size:9pt">' +
    '<div style="border-top:1px solid #000;margin-bottom:3px">&nbsp;</div>' +
    (s.nome ? '<div style="font-weight:700">' + s.nome + '</div>' : '') +
    '<div>' + s.qualificacao + '</div>' +
    (s.documento ? '<div style="color:#444">' + s.documento + '</div>' : '') +
    '</div>';
  return '<div class="assinaturas" style="margin-top:56px;display:flex;flex-wrap:wrap;justify-content:space-around;gap:48px 24px">' +
    lista.map(caixa).join('') + '</div>';
}
