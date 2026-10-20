// frontend/src/pages/projects/workspace/DemonstrativoTermoVal.tsx
// Demonstrativo do Termo VAL (20/10/2026) - Anexo I do Doc. 21. So pagamentos a credores do Anexo V com classificacao
// confirmada, um por linha. Datas fixas para todos os documentos: Bloco 1 de 01/11/2025 a 20/07/2026 (principal) e
// Bloco 2 de 21/07/2026 a 30/09/2026 (complementar). Texto do credor revisado linha a linha; copiar a tabela para o Word.
import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import { thSt, tdSt, erroSt, fmtBRL, fmtData, PROJ } from './projetoTema';
import { ModalProjeto, BotaoSec, Secao, Campo, inputModal, erroApi } from './ModalProjeto';

const num: React.CSSProperties = { ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
const dir: React.CSSProperties = { ...thSt, textAlign: 'right' };
const painel: React.CSSProperties = { background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: 14 };
const botaoPri: React.CSSProperties = { background: PROJ, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const mini: React.CSSProperties = { padding: '2px 8px', fontSize: 11, border: '0.5px solid #D1D5DB', borderRadius: 6, background: '#fff', color: '#134E4A', cursor: 'pointer', whiteSpace: 'nowrap' };
const okBt: React.CSSProperties = { padding: '2px 8px', fontSize: 11, border: '0.5px solid #16A34A', borderRadius: 6, background: '#F0FDF4', color: '#166534', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' };
const aRevisar: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FEF3C7', borderRadius: 8, padding: '1px 6px', marginLeft: 6, whiteSpace: 'nowrap' };

interface Bloco { codigo: string; rotulo: string; de: string; ate: string; pagamentos: number; qtdPagamentos: number; transferencias: number; qtdTransferencias: number; }
interface Linha {
  id: string; custodia: boolean; bloco: string; data: string; valor: number; natureza: string; codigo: string; itemId: string; itemOrdem: number | null; itemCredor: string;
  texto: string | null; sugestao: string; comprovante: string; lancamento: string; anotacao: string | null; custodiaNome: string | null;
  extrato: { data: string | null; valor: number | null; lancamento: string; partes: number } | null;
}
interface Dados {
  blocos: Bloco[]; linhas: Linha[]; porItem: { ordem: number; credor: string; B1: number; B2: number; total: number; qtd: number }[];
  pendentes: { id: string; data: string; valor: number; natureza: string; lancamento: string; descricao: string; situacao: string; sugestaoItem: string }[];
  naturezas: { codigo: string; nome: string }[]; itens: { id: string; ordem: number; credor: string }[];
}
type Parte = { valor: string; naturezaCodigo: string; destino: string; texto: string };

// Valor por extenso (reais), para os itens 2 e 3 do termo.
function extenso(v: number): string {
  const U = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const ate999 = (n: number): string => {
    if (n === 0) return ''; if (n === 100) return 'cem';
    const p: string[] = []; const c = Math.floor(n / 100); const r = n % 100;
    if (c) p.push(C[c]);
    if (r) p.push(r < 20 ? U[r] : (r % 10 ? `${D[Math.floor(r / 10)]} e ${U[r % 10]}` : D[Math.floor(r / 10)]));
    return p.join(' e ');
  };
  const total = Math.round(v * 100); const inteiro = Math.floor(total / 100); const cent = total % 100;
  const grupos = [Math.floor(inteiro / 1e9) % 1000, Math.floor(inteiro / 1e6) % 1000, Math.floor(inteiro / 1e3) % 1000, inteiro % 1000];
  const nomes = [['bilhão', 'bilhões'], ['milhão', 'milhões'], ['mil', 'mil'], ['', '']];
  const partes: { txt: string; n: number }[] = [];
  grupos.forEach((g, i) => {
    if (!g) return;
    const t = i === 2 && g === 1 ? 'mil' : `${ate999(g)}${nomes[i][0] ? ' ' + nomes[i][g === 1 ? 0 : 1] : ''}`;
    partes.push({ txt: t, n: g });
  });
  let s = '';
  partes.forEach((p, i) => {
    if (i === 0) { s = p.txt; return; }
    const ultimo = i === partes.length - 1;
    s += ultimo && (p.n < 100 || p.n % 100 === 0) ? ' e ' + p.txt : ', ' + p.txt;
  });
  let reais = '';
  if (inteiro) reais = s + (inteiro % 1000000 === 0 && inteiro >= 1000000 ? ' de reais' : inteiro === 1 ? ' real' : ' reais');
  const cts = cent ? `${ate999(cent)} ${cent === 1 ? 'centavo' : 'centavos'}` : '';
  return [reais, cts].filter(Boolean).join(' e ');
}
const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const htmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function DemonstrativoTermoVal({ projetoId }: { projetoId: string }) {
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [aberta, setAberta] = useState<string | null>(null);
  const [editando, setEditando] = useState<Linha | null>(null);
  const [trocando, setTrocando] = useState<Linha | null>(null);
  const [dividindo, setDividindo] = useState<Linha | null>(null);
  const [aceitando, setAceitando] = useState<string | null>(null);

  const carregar = () => {
    setErro('');
    api.get(`/projects-relatorios/projetos/${projetoId}/demonstrativo-val`).then((r: any) => setD(r.data)).catch((e: any) => setErro(erroApi(e, 'Falha ao carregar o demonstrativo.')));
  };
  useEffect(() => { carregar(); }, [projetoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const blocos = d?.blocos || [];
  const linhas = d?.linhas || [];
  const semTexto = linhas.filter((l) => !l.texto).length;
  const totPag = blocos.reduce((s, b) => s + Math.round(b.pagamentos * 100), 0) / 100;
  const totTr = blocos.reduce((s, b) => s + Math.round(b.transferencias * 100), 0) / 100;
  const numero = useMemo(() => new Map(linhas.map((l, i) => [l.id, i + 1])), [linhas]);
  const rotItem = (l: { itemOrdem: number | null; itemCredor: string }) => (l.itemOrdem != null ? `${l.itemOrdem} - ${l.itemCredor}` : l.itemCredor);
  const periodo = (b: Bloco) => `${fmtData(b.de)} a ${fmtData(b.ate)}`;
  // OK: aceita a sugestao como texto final da linha (grava em proj_demonstrativo_textos, com historico).
  const aceitar = async (l: Linha) => {
    setErro(''); setAceitando(l.id);
    try {
      await api.post(`/projects-relatorios/projetos/${projetoId}/demonstrativo-val/texto`, { id: l.id, custodia: l.custodia, texto: l.sugestao.trim() });
      setAviso(`Linha ${numero.get(l.id)} conferida: texto aceito.`); carregar();
    } catch (e) { setErro(erroApi(e, 'Falha ao aceitar o texto.')); } finally { setAceitando(null); }
  };

  const copiarHtml = async (html: string, texto: string, ok: string) => {
    try {
      const CI: any = (window as any).ClipboardItem;
      if (CI && navigator.clipboard?.write) {
        await navigator.clipboard.write([new CI({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([texto], { type: 'text/plain' }) })]);
      } else {
        const div = document.createElement('div'); div.innerHTML = html; div.style.position = 'fixed'; div.style.left = '-9999px'; document.body.appendChild(div);
        const r = document.createRange(); r.selectNodeContents(div); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r);
        document.execCommand('copy'); s?.removeAllRanges(); div.remove();
      }
      setAviso(ok);
    } catch { setErro('Não foi possível copiar. Selecione a tabela e copie manualmente.'); }
  };

  const copiarTabela = () => {
    const st = 'border:1px solid #808080;padding:2px 4px;font-family:Times New Roman;font-size:8pt;vertical-align:top';
    const th = `${st};background:#D9E2F3;font-weight:bold`;
    const linhaHtml = (l: Linha) => `<tr><td style="${st};text-align:right">${numero.get(l.id)}</td><td style="${st}">${fmtData(l.data)}</td><td style="${st}">${htmlEsc(l.texto || l.sugestao)}</td><td style="${st}">${htmlEsc(rotItem(l))}</td><td style="${st};text-align:right">${brl(l.valor)}</td><td style="${st}">${htmlEsc(l.comprovante)}</td></tr>`;
    const sub = (rot: string, v: number, fundo: string) => `<tr><td style="${st};background:${fundo}" colspan="4"><b>${htmlEsc(rot)}</b></td><td style="${st};background:${fundo};text-align:right"><b>${brl(v)}</b></td><td style="${st};background:${fundo}"></td></tr>`;
    let html = `<table style="border-collapse:collapse;width:100%"><tr><td style="${th}">N.º</td><td style="${th}">Data</td><td style="${th}">Credor / obrigação</td><td style="${th}">Item do Anexo V</td><td style="${th};text-align:right">Valor pago (R$)</td><td style="${th}">Comprovante</td></tr>`;
    let txt = 'N.º\tData\tCredor / obrigação\tItem do Anexo V\tValor pago (R$)\tComprovante\n';
    for (const b of blocos) {
      html += `<tr><td style="${st};background:#EEF2F7" colspan="6"><b>${htmlEsc(b.rotulo)} - de ${periodo(b)}</b></td></tr>`;
      for (const l of linhas.filter((x) => x.bloco === b.codigo)) { html += linhaHtml(l); txt += `${numero.get(l.id)}\t${fmtData(l.data)}\t${l.texto || l.sugestao}\t${rotItem(l)}\t${brl(l.valor)}\t${l.comprovante}\n`; }
      html += sub(`Subtotal do ${b.rotulo} (${periodo(b)})`, b.pagamentos, '#F2F2F2');
      txt += `\t\tSubtotal do ${b.rotulo} (${periodo(b)})\t\t${brl(b.pagamentos)}\t\n`;
    }
    html += sub('Total', totPag, '#E7E6E6') + '</table>';
    txt += `\t\tTotal\t\t${brl(totPag)}\t\n`;
    copiarHtml(html, txt, semTexto ? `Tabela copiada. Atenção: ${semTexto} linha(s) ainda com texto sugerido (a revisar).` : 'Tabela copiada: cole no Word.');
  };

  const copiarTextos = () => {
    const [b1, b2] = blocos;
    if (!b1 || !b2) return;
    const v = (x: number) => `R$ ${brl(x)} (${extenso(x)})`;
    const t2 = `2. Transferências. A VAL transferiu, por conta da F5 Participações S/A (F5), para a tesouraria única das sociedades do grupo hoteleiro (Sunrise Hotel & Resorts Holding Ltda., Hotelsys Gestão Hoteleira Ltda. e Sunsys Hotel e Resort Ltda.), o montante de ${v(b1.transferencias)} de ${periodo(b1)} e de ${v(b2.transferencias)} de ${periodo(b2)}, no total de ${v(totTr)}.`;
    const t3 = `3. Utilização. Com esses recursos foram pagas as obrigações do passivo assumido pela Real Mouchão no contrato de 31 de outubro de 2025 (Anexo V desse contrato) identificadas no demonstrativo anexo (Anexo I), no montante de ${v(b1.pagamentos)} de ${periodo(b1)} e de ${v(b2.pagamentos)} de ${periodo(b2)}, no total de ${v(totPag)}. O demonstrativo indica, pagamento a pagamento, a data, o valor, o credor e o comprovante.`;
    const html = `<p style="font-family:Times New Roman;font-size:12pt;text-align:justify">${htmlEsc(t2)}</p><p style="font-family:Times New Roman;font-size:12pt;text-align:justify">${htmlEsc(t3)}</p>`;
    copiarHtml(html, `${t2}\n\n${t3}`, 'Textos dos itens 2 e 3 copiados.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      {aviso && <div style={{ fontSize: 12, background: '#F0FDF4', border: '0.5px solid #BBF7D0', borderRadius: 8, padding: '6px 12px', display: 'flex' }}><span style={{ flex: 1 }}>{aviso}</span><span style={{ cursor: 'pointer' }} onClick={() => setAviso('')}>×</span></div>}
      {!d && !erro && <div style={{ color: '#6B7280' }}>Carregando...</div>}
      {d && (<>
        <div style={{ ...painel, fontSize: 12, color: '#374151' }}>
          Anexo I do Termo da VAL (Doc. 21): só pagamentos a credores do Anexo V com classificação confirmada, um por linha. Datas fixas para todos os documentos:
          <b> Bloco 1</b> de {blocos[0] && periodo(blocos[0])} (principal) e <b>Bloco 2</b> de {blocos[1] && periodo(blocos[1])} (complementar). Salários, benefícios, contabilidade, reembolsos e bloqueios ficam fora: marque-os fora do Anexo V.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {blocos.map((b) => (
            <div key={b.codigo} style={{ ...painel, borderTop: `3px solid ${PROJ}` }}>
              <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>{b.rotulo} · {periodo(b)}</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Transferências da VAL: <b>{fmtBRL(b.transferencias)}</b> <span style={{ color: '#6B7280' }}>({b.qtdTransferencias})</span></div>
              <div style={{ fontSize: 12, marginTop: 2 }}>Pagamentos do Anexo V: <b>{fmtBRL(b.pagamentos)}</b> <span style={{ color: '#6B7280' }}>({b.qtdPagamentos})</span></div>
            </div>))}
          <div style={{ ...painel, borderTop: '3px solid #134E4A', background: '#F0FDFA' }}>
            <div style={{ fontSize: 11, color: '#134E4A', fontWeight: 700, textTransform: 'uppercase' }}>Total dos 2 blocos</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Transferências da VAL: <b>{fmtBRL(totTr)}</b></div>
            <div style={{ fontSize: 12, marginTop: 2 }}>Pagamentos do Anexo V: <b>{fmtBRL(totPag)}</b></div>
          </div>
          <div style={{ ...painel, borderTop: `3px solid ${semTexto || d.pendentes.length ? '#D97706' : '#166534'}` }}>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Antes de assinar</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>{semTexto ? <b style={{ color: '#92400E' }}>{semTexto} linha(s) com texto a revisar</b> : 'Todos os textos revisados'}</div>
            <div style={{ fontSize: 12, marginTop: 2 }}>{d.pendentes.length ? <b style={{ color: '#92400E' }}>{d.pendentes.length} pagamento(s) do período sem classificação confirmada</b> : 'Nenhum pagamento pendente de classificação'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#6B7280' }}>{linhas.length} pagamento(s) · clique na linha para ver o extrato e a anotação</span>
          <span style={{ flex: 1 }} />
          <BotaoSec onClick={copiarTextos}>Copiar itens 2 e 3 do termo</BotaoSec>
          <button type="button" style={botaoPri} onClick={copiarTabela}>Copiar tabela (Anexo I)</button>
        </div>

        <div style={{ ...painel, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead><tr><th style={thSt}>N.º</th><th style={thSt}>Data</th><th style={thSt}>Credor / obrigação</th><th style={thSt}>Item do Anexo V</th><th style={dir}>Valor pago</th><th style={thSt}>Comprovante</th><th style={thSt}></th></tr></thead>
            <tbody>
              {blocos.map((b) => (
                <React.Fragment key={b.codigo}>
                  <tr><td colSpan={7} style={{ ...tdSt, background: '#EEF2F7', fontWeight: 700, fontSize: 12 }}>{b.rotulo} - de {periodo(b)}</td></tr>
                  {linhas.filter((l) => l.bloco === b.codigo).map((l) => (
                    <React.Fragment key={l.id}>
                      <tr onClick={() => setAberta(aberta === l.id ? null : l.id)} style={{ cursor: 'pointer', background: aberta === l.id ? '#F0FDFA' : undefined }}>
                        <td style={tdSt}>{numero.get(l.id)}</td>
                        <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>{fmtData(l.data)}</td>
                        <td style={{ ...tdSt, maxWidth: 420, fontSize: 12 }}>{l.texto || <span style={{ color: '#6B7280' }}>{l.sugestao}</span>}{!l.texto && <span style={aRevisar}>a revisar</span>}</td>
                        <td style={{ ...tdSt, fontSize: 12 }}>{rotItem(l)}</td>
                        <td style={num}>{fmtBRL(l.valor)}</td>
                        <td style={{ ...tdSt, fontSize: 12 }}>{l.comprovante}</td>
                        <td style={{ ...tdSt, whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                          {!l.texto && <><button type="button" style={{ ...okBt, opacity: aceitando ? 0.5 : 1 }} disabled={!!aceitando || l.sugestao.trim().length < 3} title="Texto conferido: aceitar a sugestao como texto final" onClick={() => aceitar(l)}>{aceitando === l.id ? '...' : '✓ OK'}</button>{' '}</>}
                          <button type="button" style={mini} onClick={() => setEditando(l)}>Texto</button>{' '}
                          <button type="button" style={mini} onClick={() => setTrocando(l)}>Item</button>{' '}
                          {!l.custodia && <button type="button" style={mini} onClick={() => setDividindo(l)}>Dividir</button>}
                        </td>
                      </tr>
                      {aberta === l.id && (
                        <tr><td colSpan={7} style={{ ...tdSt, background: '#F9FAFB', fontSize: 12, color: '#374151' }}>
                          {l.extrato ? <div><b>Extrato:</b> {fmtData(l.extrato.data)} · {fmtBRL(l.extrato.valor)} · {l.extrato.lancamento}{l.extrato.partes > 1 && <span style={{ color: '#1E40AF' }}> · débito dividido em {l.extrato.partes} partes</span>}</div>
                            : <div><b>Custódia:</b> {l.custodiaNome || '-'} · pagamento direto validado</div>}
                          <div><b>Natureza:</b> {l.natureza}</div>
                          {l.anotacao && <div><b>Anotação da planilha (apoio):</b> {l.anotacao}</div>}
                          {l.texto && <div><b>Sugestão automática:</b> {l.sugestao}</div>}
                        </td></tr>)}
                    </React.Fragment>))}
                  <tr><td colSpan={4} style={{ ...tdSt, fontWeight: 700, background: '#F2F2F2' }}>Subtotal do {b.rotulo} ({periodo(b)})</td><td style={{ ...num, fontWeight: 700, background: '#F2F2F2' }}>{fmtBRL(b.pagamentos)}</td><td colSpan={2} style={{ ...tdSt, background: '#F2F2F2' }} /></tr>
                </React.Fragment>))}
              <tr><td colSpan={4} style={{ ...tdSt, fontWeight: 700, background: '#E7E6E6' }}>Total</td><td style={{ ...num, fontWeight: 700, background: '#E7E6E6' }}>{fmtBRL(totPag)}</td><td colSpan={2} style={{ ...tdSt, background: '#E7E6E6' }} /></tr>
            </tbody>
          </table>
        </div>

        <div style={painel}>
          <div style={{ fontSize: 12, fontWeight: 700, color: PROJ, marginBottom: 8 }}>Resumo por item do Anexo V</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={thSt}>Item</th><th style={dir}>Bloco 1</th><th style={dir}>Bloco 2</th><th style={dir}>Total</th><th style={dir}>Pagamentos</th></tr></thead>
            <tbody>{d.porItem.map((p) => (<tr key={p.ordem}><td style={tdSt}>{p.ordem} - {p.credor}</td><td style={num}>{fmtBRL(p.B1)}</td><td style={num}>{fmtBRL(p.B2)}</td><td style={{ ...num, fontWeight: 600 }}>{fmtBRL(p.total)}</td><td style={num}>{p.qtd}</td></tr>))}</tbody>
          </table>
        </div>

        {d.pendentes.length > 0 && (
          <div style={{ ...painel, borderLeft: '3px solid #D97706' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 8 }}>Pagamentos do período sem classificação confirmada (classifique na aba Classificação)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={thSt}>Data</th><th style={thSt}>Natureza</th><th style={thSt}>Lançamento</th><th style={dir}>Valor</th><th style={thSt}>Sugestão</th></tr></thead>
              <tbody>{d.pendentes.map((p) => (<tr key={p.id}><td style={tdSt}>{fmtData(p.data)}</td><td style={{ ...tdSt, fontSize: 12 }}>{p.natureza}</td><td style={{ ...tdSt, fontSize: 12 }}>{p.lancamento}{p.descricao && <div style={{ color: '#6B7280' }}>{p.descricao}</div>}</td><td style={num}>{fmtBRL(p.valor)}</td><td style={{ ...tdSt, fontSize: 12 }}>{p.sugestaoItem || '-'}</td></tr>))}</tbody>
            </table>
          </div>)}
      </>)}

      {editando && <TextoModal projetoId={projetoId} linha={editando} onClose={() => setEditando(null)} onFeito={() => { setEditando(null); setAviso('Texto gravado.'); carregar(); }} />}
      {trocando && d && <ItemModal projetoId={projetoId} linha={trocando} itens={d.itens} onClose={() => setTrocando(null)} onFeito={() => { setTrocando(null); setAviso('Classificação alterada.'); carregar(); }} />}
      {dividindo && d && <DividirModal projetoId={projetoId} linha={dividindo} itens={d.itens} naturezas={d.naturezas} onClose={() => setDividindo(null)} onFeito={(n) => { setDividindo(null); setAviso(`Pagamento dividido em ${n} partes.`); carregar(); }} />}
    </div>
  );
}

function rodape(onClose: () => void, ok: boolean, enviando: boolean, rotulo: string, acao: () => void) {
  return (<><span style={{ flex: 1 }} /><BotaoSec onClick={onClose}>Cancelar</BotaoSec>
    <button type="button" disabled={!ok || enviando} onClick={acao} style={{ ...botaoPri, opacity: ok && !enviando ? 1 : 0.5 }}>{enviando ? 'Aguarde...' : rotulo}</button></>);
}

function TextoModal({ projetoId, linha, onClose, onFeito }: { projetoId: string; linha: Linha; onClose: () => void; onFeito: () => void }) {
  const [texto, setTexto] = useState(linha.texto || linha.sugestao);
  const [erro, setErro] = useState(''); const [enviando, setEnviando] = useState(false);
  const ok = texto.trim().length >= 3;
  const gravar = async () => {
    setErro(''); setEnviando(true);
    try { await api.post(`/projects-relatorios/projetos/${projetoId}/demonstrativo-val/texto`, { id: linha.id, custodia: linha.custodia, texto: texto.trim() }); onFeito(); }
    catch (e) { setErro(erroApi(e, 'Falha ao gravar o texto.')); } finally { setEnviando(false); }
  };
  return (
    <ModalProjeto titulo="Credor / obrigação no termo" subtitulo={`${fmtData(linha.data)} · ${fmtBRL(linha.valor)} · item ${linha.itemOrdem ?? '-'} - ${linha.itemCredor}`} largura={620} onClose={onClose} rodape={rodape(onClose, ok, enviando, 'Gravar texto', gravar)}>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      <Secao titulo="APOIO (NÃO VAI PARA O TERMO)">
        <div style={{ fontSize: 12, color: '#374151' }}>{linha.extrato ? `Extrato: ${fmtData(linha.extrato.data)} · ${fmtBRL(linha.extrato.valor)} · ${linha.extrato.lancamento}` : `Custódia: ${linha.custodiaNome || '-'}`}</div>
        {linha.anotacao && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Anotação: {linha.anotacao}</div>}
      </Secao>
      <Secao titulo="TEXTO DO TERMO *">
        <textarea autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} style={{ ...inputModal, resize: 'vertical' }} placeholder="Ex.: Acordo trabalhista - Processo Gilson Honório Menezes (parcela 1/2)" />
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>O texto anterior fica no histórico; só o novo vale.</div>
      </Secao>
    </ModalProjeto>);
}

function ItemModal({ projetoId, linha, itens, onClose, onFeito }: { projetoId: string; linha: Linha; itens: Dados['itens']; onClose: () => void; onFeito: () => void }) {
  const [destino, setDestino] = useState(linha.itemId);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState(''); const [enviando, setEnviando] = useState(false);
  const ok = !!destino && destino !== linha.itemId && motivo.trim().length >= 10;
  const gravar = async () => {
    setErro(''); setEnviando(true);
    try {
      await api.post(`/projects-relatorios/projetos/${projetoId}/demonstrativo-val/item`, { id: linha.id, custodia: linha.custodia, fora: destino === 'FORA', itemId: destino === 'FORA' ? null : destino, motivo: motivo.trim() });
      onFeito();
    } catch (e) { setErro(erroApi(e, 'Falha ao reclassificar.')); } finally { setEnviando(false); }
  };
  return (
    <ModalProjeto titulo="Item do Anexo V" subtitulo={`${fmtData(linha.data)} · ${fmtBRL(linha.valor)} · ${linha.texto || linha.sugestao}`} largura={560} onClose={onClose} rodape={rodape(onClose, ok, enviando, 'Gravar', gravar)}>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      <Secao titulo="CLASSIFICAÇÃO">
        <select value={destino} onChange={(e) => setDestino(e.target.value)} style={inputModal}>
          <option value="FORA">Fora do Anexo V (sai do demonstrativo)</option>
          {itens.map((i) => <option key={i.id} value={i.id}>{i.ordem}. {i.credor}</option>)}
        </select>
      </Secao>
      <Secao titulo="MOTIVO *">
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} style={{ ...inputModal, resize: 'vertical' }} placeholder="Mínimo de 10 caracteres. A classificação anterior fica no histórico." />
      </Secao>
    </ModalProjeto>);
}

function DividirModal({ projetoId, linha, itens, naturezas, onClose, onFeito }: { projetoId: string; linha: Linha; itens: Dados['itens']; naturezas: Dados['naturezas']; onClose: () => void; onFeito: (n: number) => void }) {
  const nova = (): Parte => ({ valor: '', naturezaCodigo: linha.codigo, destino: linha.itemId, texto: '' });
  const [partes, setPartes] = useState<Parte[]>([{ ...nova(), texto: linha.texto || '' }, { ...nova(), destino: 'FORA', naturezaCodigo: 'MANUTENCAO_OPERACAO' }]);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState(''); const [enviando, setEnviando] = useState(false);
  const centavos = (s: string) => Math.round(Number(String(s).replace(/\./g, '').replace(',', '.')) * 100) || 0;
  const soma = partes.reduce((s, p) => s + centavos(p.valor), 0);
  const total = Math.round(linha.valor * 100);
  const ok = partes.length >= 2 && soma === total && partes.every((p) => centavos(p.valor) > 0 && p.naturezaCodigo && p.destino) && motivo.trim().length >= 10;
  const muda = (i: number, k: keyof Parte, v: string) => setPartes((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const gravar = async () => {
    setErro(''); setEnviando(true);
    try {
      const r: any = await api.post(`/projects-relatorios/projetos/${projetoId}/demonstrativo-val/dividir`, {
        aplicacaoId: linha.id, motivo: motivo.trim(),
        partes: partes.map((p) => ({ valor: centavos(p.valor) / 100, naturezaCodigo: p.naturezaCodigo, fora: p.destino === 'FORA', itemId: p.destino === 'FORA' ? null : p.destino, texto: p.texto.trim() })),
      });
      onFeito((r?.data?.partes || []).length || partes.length);
    } catch (e) { setErro(erroApi(e, 'Falha ao dividir.')); } finally { setEnviando(false); }
  };
  return (
    <ModalProjeto titulo="Dividir pagamento" subtitulo={`${fmtData(linha.data)} · ${fmtBRL(linha.valor)} · ${linha.extrato?.lancamento || ''}`} largura={760} onClose={onClose} rodape={rodape(onClose, ok, enviando, 'Dividir', gravar)}>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      {linha.anotacao && <Secao titulo="ANOTAÇÃO DA PLANILHA (APOIO)"><div style={{ fontSize: 12 }}>{linha.anotacao}</div></Secao>}
      <Secao titulo="PARTES (UMA POR PAGAMENTO)">
        {partes.map((p, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr', gap: 8, marginBottom: 10, paddingBottom: 10, borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
            <Campo rotulo="Valor (R$)"><input value={p.valor} onChange={(e) => muda(i, 'valor', e.target.value)} style={inputModal} placeholder="0,00" /></Campo>
            <Campo rotulo="Natureza"><select value={p.naturezaCodigo} onChange={(e) => muda(i, 'naturezaCodigo', e.target.value)} style={inputModal}>{naturezas.map((n) => <option key={n.codigo} value={n.codigo}>{n.nome}</option>)}</select></Campo>
            <Campo rotulo="Item do Anexo V"><select value={p.destino} onChange={(e) => muda(i, 'destino', e.target.value)} style={inputModal}><option value="FORA">Fora do Anexo V</option>{itens.map((it) => <option key={it.id} value={it.id}>{it.ordem}. {it.credor}</option>)}</select></Campo>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
              <input value={p.texto} onChange={(e) => muda(i, 'texto', e.target.value)} style={inputModal} placeholder="Credor / obrigação desta parte (texto do termo)" />
              {partes.length > 2 && <BotaoSec onClick={() => setPartes((ps) => ps.filter((_, j) => j !== i))}>Remover</BotaoSec>}
            </div>
          </div>))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BotaoSec onClick={() => setPartes((ps) => [...ps, nova()])}>+ Parte</BotaoSec>
          <span style={{ fontSize: 12, color: soma === total ? '#166534' : '#A32D2D' }}>Partes: {fmtBRL(soma / 100)} de {fmtBRL(total / 100)}{soma !== total ? ` · faltam ${fmtBRL((total - soma) / 100)}` : ' · fecha'}</span>
        </div>
      </Secao>
      <Secao titulo="MOTIVO *">
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} style={{ ...inputModal, resize: 'vertical' }} placeholder="Ex.: débito único com 4 pagamentos: 140 mil Escandinavos (1/10), Visão Contábil, Teixeira e Dr. Fernando Galvão" />
      </Secao>
    </ModalProjeto>);
}
