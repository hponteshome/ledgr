// frontend/src/utils/imprimirRelatorio.ts
// CRIADO 31/08/2026: helper compartilhado de impressao/PDF - meio-termo entre
// modal 100% generico (nao serve bem pra relatorios com formato muito
// diferente entre si) e um modal especifico do zero por tela (duplica a
// parte comum - cabecalho formal, CNPJ, pagina/data/hora - em cada tela nova).
// Cuida so da parte COMUM (cabecalho, estilo de impressao, disparo do
// window.print()) - cada tela fornece seu proprio corpo HTML (tabela),
// mesmo padrao ja usado em DiarioGeralPage.tsx/RazaoAnaliticoPage.tsx antes
// desta extracao.
export interface ImprimirRelatorioOptions {
  titulo: string;
  subtitulo?: string;
  empresaNome: string;
  empresaCnpj: string;
  periodo?: string;
  corpoHtml: string;
  rodapeHtml?: string;
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
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; margin: 24px; }
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
  </style></head><body>
    <div class="cabecalho">
      <div class="empresa">
        <div class="nome">${opts.empresaNome}</div>
        <div class="cnpj">CNPJ: ${cnpj}</div>
      </div>
      <div class="meta">
        <div>Data: ${hoje}</div>
        <div>Hora: ${hora}</div>
      </div>
    </div>
    <h1>${opts.titulo}</h1>
    ${opts.subtitulo ? `<div class="subtitulo">${opts.subtitulo}</div>` : ''}
    ${opts.periodo ? `<div class="periodo">Período: ${opts.periodo}</div>` : ''}
    ${opts.corpoHtml}
    ${opts.rodapeHtml ? `<div class="rodape">${opts.rodapeHtml}</div>` : ''}
    <script>window.onload = function() { window.print(); };<\/script>
  </body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
