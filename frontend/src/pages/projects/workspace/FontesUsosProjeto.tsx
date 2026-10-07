// frontend/src/pages/projects/workspace/FontesUsosProjeto.tsx
// Fontes e usos pelo PEPS (07/10/2026), so o Master: de onde veio o dinheiro de cada aplicacao, simulando a conta inteira
// da recebedora financeira (primeiro a entrar, primeiro a sair). O calculo e refeito pela API a cada consulta.
import React, { useEffect, useState } from 'react';
import api from '../../../services/api';
import { cardSt, thSt, tdSt, erroSt, secTitle, tituloSt, subtituloSt, fmtBRL, fmtData } from './projetoTema';
import { inputModal, erroApi } from './ModalProjeto';
import { useOrdenacao, ThOrdenavel } from '../ordenacao';

const COR: Record<string, string> = { SALDO_ANTERIOR: '#6B7280', APORTE_ANCORA: '#134E4A', DEVOLUCAO_CUSTODIA: '#B45309', CREDITO_DESVINCULADO: '#7C3AED', OUTRA_ENTRADA: '#2563EB', NAO_IDENTIFICADA: '#A32D2D' };
const CURTO: Record<string, string> = { SALDO_ANTERIOR: 'Saldo anterior', APORTE_ANCORA: 'Âncora', DEVOLUCAO_CUSTODIA: 'Custódia', CREDITO_DESVINCULADO: 'Desvinculados', OUTRA_ENTRADA: 'Outras entradas', NAO_IDENTIFICADA: 'Não identificada' };
const chip = (o: string, v: number) => <span key={o} style={{ fontSize: 11, borderRadius: 999, padding: '1px 7px', marginRight: 4, background: COR[o] + '1A', color: COR[o], whiteSpace: 'nowrap', display: 'inline-block', marginBottom: 2 }}>{CURTO[o] || o}: {fmtBRL(v)}</span>;
const dir: React.CSSProperties = { ...thSt, textAlign: 'right' };
const num: React.CSSProperties = { ...tdSt, textAlign: 'right', whiteSpace: 'nowrap' };

export default function FontesUsosProjeto({ projetoId }: { projetoId: string }) {
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  useEffect(() => {
    setCarregando(true); setErro('');
    const q = new URLSearchParams(); if (de) q.set('de', de); if (ate) q.set('ate', ate);
    api.get(`/projects-relatorios/projetos/${projetoId}/fontes-usos?${q.toString()}`)
      .then((r) => setD(r.data)).catch((e) => setErro(erroApi(e, 'Falha ao calcular as fontes e usos.'))).finally(() => setCarregando(false));
  }, [projetoId, de, ate]);
  const br = (x: string) => x.split('-').reverse().join('/');
  const periodo = de && ate ? `de ${br(de)} a ${br(ate)}` : ate ? `até ${br(ate)}` : de ? `desde ${br(de)}` : 'até hoje';
  const anoAtual = String(new Date().getFullYear());
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={tituloSt}>Fontes e usos dos recursos</div>
        <div style={subtituloSt}>De onde veio o dinheiro de cada aplicação · método PEPS (primeiro a entrar, primeiro a sair) sobre a conta inteira da recebedora financeira · estornos bancários excluídos</div>
      </div>
      <div style={{ ...cardSt, padding: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 13, color: '#134E4A' }}>Período: {periodo}</b>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#6B7280' }}>De</span>
        <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={{ ...inputModal, width: 150, padding: '5px 8px' }} />
        <span style={{ fontSize: 12, color: '#6B7280' }}>Até</span>
        <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={{ ...inputModal, width: 150, padding: '5px 8px' }} />
        {([['Até 31/12/2025', '', '2025-12-31'], ['Ano atual', anoAtual + '-01-01', ''], ['Tudo', '', '']] as [string, string, string][]).map(([rot, x, y]) => (
          <button key={rot} onClick={() => { setDe(x); setAte(y); }} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 7, cursor: 'pointer', border: '0.5px solid #E5E7EB', background: de === x && ate === y ? '#134E4A' : '#fff', color: de === x && ate === y ? '#fff' : '#134E4A' }}>{rot}</button>
        ))}
        {carregando && <span style={{ fontSize: 12, color: '#6B7280' }}>Calculando...</span>}
      </div>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      {d && (<>
        <div style={{ ...cardSt, overflowX: 'auto' }}>
          <div style={{ ...secTitle, padding: '12px 14px 0' }}>Quadro de fontes e usos · {periodo}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={thSt}>Origem \ uso</th>{d.colunas.map((c: string) => <th key={c} style={dir}>{c}</th>)}<th style={dir}>Total</th></tr></thead>
            <tbody>{d.matriz.map((l: any) => (
              <tr key={l.origem}><td style={{ ...tdSt, fontWeight: 600, color: COR[l.origem] }}>{l.nome}</td>
                {d.colunas.map((c: string) => <td key={c} style={num}>{l.valores[c] ? fmtBRL(l.valores[c]) : '-'}</td>)}
                <td style={{ ...num, fontWeight: 700 }}>{fmtBRL(l.total)}</td></tr>))}</tbody>
            <tfoot><tr style={{ borderTop: '1.5px solid #134E4A' }}><td style={{ ...tdSt, fontWeight: 700 }}>Total</td>
              {d.colunas.map((c: string) => <td key={c} style={{ ...num, fontWeight: 700 }}>{fmtBRL(d.totaisColunas[c] || 0)}</td>)}
              <td style={{ ...num, fontWeight: 700 }}>{fmtBRL(d.totalGeral)}</td></tr></tfoot>
          </table>
        </div>
        <div style={{ ...cardSt, overflowX: 'auto' }}>
          <div style={{ ...secTitle, padding: '12px 14px 0' }}>Origens</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={thSt}>Origem</th><th style={dir}>Entrou até {ate ? br(ate) : 'hoje'}</th><th style={dir}>Usado em aplicações ({periodo})</th><th style={dir}>Outras saídas ({periodo})</th><th style={dir}>Ainda na conta</th></tr></thead>
            <tbody>{d.matriz.map((l: any) => (
              <tr key={l.origem}><td style={{ ...tdSt, fontWeight: 600, color: COR[l.origem] }}>{l.nome}</td><td style={num}>{l.origem === 'NAO_IDENTIFICADA' ? '-' : fmtBRL(l.entrou)}</td>
                <td style={num}>{fmtBRL(l.usadoAplicacoes)}</td><td style={num}>{fmtBRL(l.usadoOutros)}</td><td style={num}>{l.origem === 'NAO_IDENTIFICADA' ? '-' : fmtBRL(l.saldoNaConta)}</td></tr>))}</tbody>
          </table>
        </div>
        <div style={{ ...cardSt, overflowX: 'auto' }}>
          <div style={{ ...secTitle, padding: '12px 14px 0' }}>Destino dos aportes do Cliente Âncora (até {ate ? br(ate) : 'hoje'})</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={thSt}>Nº</th><th style={thSt}>Data</th><th style={dir}>Valor</th><th style={thSt}>Pagou</th><th style={dir}>Ainda na conta</th></tr></thead>
            <tbody>{d.aportes.map((a: any) => (
              <tr key={a.numero}><td style={tdSt}>{a.numero}</td><td style={tdSt}>{fmtData(a.data)}</td><td style={{ ...num, fontWeight: 600 }}>{fmtBRL(a.valor)}</td>
                <td style={{ ...tdSt, fontSize: 12 }}>{a.destinos.length ? a.destinos.map((x: any) => `${x.destino}: ${fmtBRL(x.valor)}`).join(' · ') : '-'}</td>
                <td style={num}>{fmtBRL(a.restante)}</td></tr>))}</tbody>
          </table>
        </div>
        <TabelaAplicacoes itens={d.aplicacoes} periodo={periodo} />
      </>)}
    </div>
  );
}

const COLS: Record<string, (x: any) => any> = { data: (x) => x.data, natureza: (x) => x.natureza, valor: (x) => x.valor, ancora: (x) => x.ancora, lancamento: (x) => x.lancamento };

function TabelaAplicacoes({ itens, periodo }: { itens: any[]; periodo: string }) {
  const { ordenada, ord, alternar } = useOrdenacao(itens, COLS, { col: 'data', dir: 'asc' });
  const th = (col: string, rot: string, st: React.CSSProperties = thSt) => <ThOrdenavel col={col} rotulo={rot} ord={ord} alternar={alternar} style={st} />;
  const total = itens.reduce((s, x) => s + x.valor, 0); const anc = itens.reduce((s, x) => s + x.ancora, 0);
  return (
    <div style={{ ...cardSt, overflowX: 'auto' }}>
      <div style={{ ...secTitle, padding: '12px 14px 0' }}>Aplicações e a origem de cada uma · {periodo}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{th('data', 'Data')}{th('natureza', 'Natureza')}{th('valor', 'Valor', dir)}{th('ancora', 'Do Âncora', dir)}<th style={thSt}>Composição da origem</th>{th('lancamento', 'Lançamento do extrato')}</tr></thead>
        <tbody>{ordenada.map((x) => (
          <tr key={x.id}><td style={tdSt}>{fmtData(x.data)}</td><td style={tdSt}>{x.natureza}</td><td style={{ ...num, fontWeight: 600 }}>{fmtBRL(x.valor)}</td>
            <td style={num}>{fmtBRL(x.ancora)}</td><td style={tdSt}>{x.composicao.map((c: any) => chip(c.origem, c.valor))}</td><td style={{ ...tdSt, fontSize: 12 }}>{x.lancamento}</td></tr>))}</tbody>
        <tfoot><tr style={{ borderTop: '1.5px solid #134E4A' }}><td colSpan={2} style={{ ...tdSt, fontWeight: 700 }}>{itens.length} aplicação(ões)</td>
          <td style={{ ...num, fontWeight: 700 }}>{fmtBRL(total)}</td><td style={{ ...num, fontWeight: 700 }}>{fmtBRL(anc)}</td><td colSpan={2} style={tdSt}></td></tr></tfoot>
      </table>
    </div>
  );
}
