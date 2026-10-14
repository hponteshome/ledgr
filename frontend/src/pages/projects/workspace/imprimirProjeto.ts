// frontend/src/pages/projects/workspace/imprimirProjeto.ts
// Impressao das telas do projeto (14/10/2026): usada pelo botao flutuante global (usePrintHandler) com o helper
// compartilhado imprimirRelatorio. Copia o que esta na tela (titulos e tabelas, com os filtros aplicados), sem botoes,
// campos, filtros e cores; select vira o texto escolhido; elementos marcados com data-noprint ficam fora.
import { imprimirRelatorio } from '../../../utils/imprimirRelatorio';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS = '<style>.proj div { margin: 2px 0; } .proj table { margin: 6px 0 14px; } .proj td, .proj th { vertical-align: top; }'
  + ' .proj caption { text-align: left; font-weight: 600; font-size: 10px; padding: 4px 0; }</style>';

function limpar(raiz: HTMLElement): string {
  const c = raiz.cloneNode(true) as HTMLElement;
  // o clone nao guarda a opcao escolhida: le do original, na mesma ordem
  const originais = Array.from(raiz.querySelectorAll('select'));
  Array.from(c.querySelectorAll('select')).forEach((s, i) => {
    const o = originais[i];
    const span = document.createElement('span');
    span.textContent = o && o.selectedIndex >= 0 ? o.options[o.selectedIndex].text : '';
    s.replaceWith(span);
  });
  c.querySelectorAll('[data-noprint], button, input, textarea, svg').forEach((e) => e.remove());
  c.querySelectorAll<HTMLElement>('*').forEach((e) => {
    const alinhar = e.style.textAlign;
    const peso = e.style.fontWeight;
    e.removeAttribute('style');
    e.removeAttribute('title');
    if (alinhar === 'right') e.classList.add('num');
    if (peso === 'bold' || Number(peso) >= 600) e.setAttribute('style', 'font-weight: 600');
  });
  return c.innerHTML;
}

export function tabelaResumo(linhas: [string, string][]): string {
  return '<table><tbody>' + linhas.map(([r, v]) => `<tr><td>${esc(r)}</td><td class="num" style="font-weight: 600">${esc(v)}</td></tr>`).join('') + '</tbody></table>';
}

export interface ImprimirProjetoOpcoes {
  projetoNome?: string;
  titulo: string;
  subtitulo?: string;
  periodo?: string;
  raiz: HTMLElement | null;
  antesHtml?: string;
  larguraTotal?: boolean;
}

export function imprimirProjeto(o: ImprimirProjetoOpcoes): void {
  if (!o.raiz) return;
  imprimirRelatorio({
    titulo: o.titulo, subtitulo: o.subtitulo, periodo: o.periodo, empresaNome: o.projetoNome || 'Projeto', empresaCnpj: '',
    corpoHtml: CSS + '<div class="proj">' + (o.antesHtml || '') + limpar(o.raiz) + '</div>', larguraTotal: o.larguraTotal,
  });
}
