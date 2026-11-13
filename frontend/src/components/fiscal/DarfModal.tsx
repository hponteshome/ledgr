// frontend/src/components/fiscal/DarfModal.tsx
// Modal de DARFs: calcula multa de mora e juros Selic para a data de pagamento, grava o lote (tax_darfs),
// imprime / baixa PDF e registra o pagamento. Padrao visual dos modais do Financeiro (APPayModal).
import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { SmartDateInput } from '../SmartDateInput';

const FIN = '#1A4A3A';
const FIN_ACCENT = '#3DAA7A';
const FIN_LIGHT = '#E8F5EE';

export interface DarfItem {
  codigo: string;
  descricao: string;
  periodoApuracao: string; // AAAA-MM-DD
  vencimento: string;      // AAAA-MM-DD
  principal: number;
  referencia?: string;
}
interface Props {
  onClose: () => void;
  titulo?: string;
  subtitulo?: string;
  itensIniciais?: DarfItem[];
  origem?: 'ESTUDO_REGIME' | 'APURACAO' | 'MANUAL';
  origemId?: string | null;
  abaInicial?: 'GERAR' | 'GERADOS';
  quotaOpcaoPresumido?: boolean; // 1a quota do IRPJ 2089 com multa de mora: formaliza a opcao pelo Presumido
}

const n2 = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseBR = (v: string) => { const x = parseFloat(String(v ?? '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')); return isNaN(x) ? 0 : x; };
const dBR = (iso?: string | null) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '-');
const hoje = () => new Date().toISOString().slice(0, 10);
const val = (v: any) => (typeof v === 'string' ? v : v?.target?.value ?? '');
const MODO_LBL: Record<string, string> = { PADRAO: 'Padrão', SICALC: 'Sicalc (0,33%/dia, máx 20%)', DENUNCIA: 'Denúncia espontânea (sem multa)', SEM: 'Sem multa' };

const Label = ({ children }: { children: React.ReactNode }) => <span style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>{children}</span>;
const inputSt: React.CSSProperties = { height: 32, border: '1px solid #D1D5DB', borderRadius: 6, padding: '0 8px', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff' };
const th: React.CSSProperties = { background: '#F9FAFB', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #E5E7EB', color: '#6B7280', whiteSpace: 'nowrap' };
const thR: React.CSSProperties = { ...th, textAlign: 'right' };
const td: React.CSSProperties = { padding: '5px 8px', fontSize: 12, borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' };
const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const sec: React.CSSProperties = { borderLeft: '3px solid ' + FIN_ACCENT, paddingLeft: 12, marginBottom: 14 };
const btn = (bg: string, fg = bg === '#fff' ? '#111827' : '#fff'): React.CSSProperties => ({ height: 32, border: bg === '#fff' ? '1px solid #D1D5DB' : 'none', borderRadius: 6, padding: '0 14px', fontSize: 12, cursor: 'pointer', background: bg, color: fg, fontWeight: 500 });

function Num({ value, onChange, width = 100 }: { value: number; onChange: (v: number) => void; width?: number }) {
  const [t, setT] = useState<string | null>(null);
  return <input style={{ ...inputSt, height: 28, width, textAlign: 'right' }} value={t ?? n2(value)} onFocus={() => setT(value ? n2(value) : '')} onChange={(e) => setT(e.target.value)} onBlur={() => { onChange(parseBR(t ?? '')); setT(null); }} />;
}

type Linha = DarfItem & { incluir: boolean; multaModo: string; manual?: boolean };

export function DarfModal({ onClose, titulo, subtitulo, itensIniciais, origem = 'MANUAL', origemId = null, abaInicial, quotaOpcaoPresumido = false }: Props) {
  const [aba, setAba] = useState<'GERAR' | 'GERADOS'>(abaInicial ?? (itensIniciais?.length ? 'GERAR' : 'GERADOS'));
  const [dataPag, setDataPag] = useState(hoje());
  const [modoPadrao, setModoPadrao] = useState('DENUNCIA');
  const [ajustar, setAjustar] = useState(true);
  const idxQuota = (() => { const l = itensIniciais ?? []; let k = -1; l.forEach((it, j) => { if (it.codigo === '2089' && Number(it.principal) > 0 && (k < 0 || it.periodoApuracao < l[k].periodoApuracao)) k = j; }); return k; })();
  const [quotaOpcao, setQuotaOpcao] = useState(quotaOpcaoPresumido && idxQuota >= 0);
  const [linhas, setLinhas] = useState<Linha[]>((itensIniciais ?? []).map((i, j) => ({ ...i, incluir: true, multaModo: quotaOpcaoPresumido && j === idxQuota ? 'SICALC' : 'PADRAO' })));
  const [calc, setCalc] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // aba Gerados
  const [ano, setAno] = useState<string>(itensIniciais?.[0]?.periodoApuracao?.slice(0, 4) ?? String(new Date().getFullYear()));
  const [status, setStatus] = useState('');
  const [gerados, setGerados] = useState<any[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pag, setPag] = useState<any>(null);

  const payload = () => ({
    dataPagamento: dataPag, multaModo: modoPadrao, ajustarVencimento: ajustar, origem, origemId,
    itens: linhas.filter((l) => l.incluir).map((l) => ({ ...l, multaModo: l.multaModo === 'PADRAO' ? undefined : l.multaModo })),
  });

  async function calcular() {
    setBusy(true); setErro(null); setOk(null);
    try { const { data } = await api.post('/darfs/calcular', payload()); setCalc(data); }
    catch (e: any) { setErro(e?.response?.data?.message ?? 'Erro no cálculo'); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (linhas.length) calcular(); /* eslint-disable-next-line */ }, []);

  async function gravar() {
    setBusy(true); setErro(null); setOk(null);
    try {
      const { data } = await api.post('/darfs', payload());
      setOk(data.gravados + ' DARF(s) gravado(s)' + (data.ignorados ? ' - ' + data.ignorados + ' ignorado(s) com erro' : '') + '. Selecionados na aba DARFs gerados para impressão.');
      const l = await carregarGerados();
      setSel(new Set(l.filter((g: any) => g.lote_id === data.loteId).map((g: any) => g.id)));
      setAba('GERADOS');
    } catch (e: any) { setErro(e?.response?.data?.message ?? 'Erro ao gravar'); }
    finally { setBusy(false); }
  }

  async function carregarGerados(): Promise<any[]> {
    try {
      const { data } = await api.get('/darfs', { params: { ano: ano || undefined, status: status || undefined } });
      setGerados(data ?? []); return data ?? [];
    } catch (e: any) { setErro(e?.response?.data?.message ?? 'Erro ao listar DARFs'); return []; }
  }
  useEffect(() => { if (aba === 'GERADOS') carregarGerados(); /* eslint-disable-next-line */ }, [aba, ano, status]);

  async function imprimir() {
    if (!sel.size) return;
    setBusy(true); setErro(null);
    try {
      const { data } = await api.post('/darfs/html', { ids: [...sel] });
      const w = window.open('', '_blank');
      if (!w) { setErro('O navegador bloqueou a janela de impressão'); return; }
      w.document.open(); w.document.write(data.html); w.document.close();
      setTimeout(() => { w.focus(); w.print(); }, 400);
    } catch (e: any) { setErro(e?.response?.data?.message ?? 'Erro ao gerar a impressão'); }
    finally { setBusy(false); }
  }
  async function baixarPdf() {
    if (!sel.size) return;
    setBusy(true); setErro(null);
    try {
      const { data } = await api.post('/darfs/pdf', { ids: [...sel] }, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = 'DARFs_' + (ano || 'selecionados') + '.pdf'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch { setErro('Erro ao gerar o PDF'); }
    finally { setBusy(false); }
  }
  async function cancelar(id: string) {
    if (!window.confirm('Cancelar este DARF? Ele continua no histórico com a situação CANCELADO.')) return;
    try { await api.delete('/darfs/' + id); await carregarGerados(); }
    catch (e: any) { setErro(e?.response?.data?.message ?? 'Erro ao cancelar'); }
  }
  async function salvarPagamento() {
    try {
      await api.post('/darfs/' + pag.id + '/pagamento', { pagoEm: pag.pagoEm, valorPago: pag.valorPago, numeroDocumento: pag.numeroDocumento });
      setPag(null); await carregarGerados();
    } catch (e: any) { setPag({ ...pag, erro: e?.response?.data?.message ?? 'Erro ao registrar o pagamento' }); }
  }

  const setL = (i: number, p: Partial<Linha>) => { setLinhas(linhas.map((l, k) => (k === i ? { ...l, ...p } : l))); setCalc(null); };
  const calcDe = (i: number) => {
    if (!calc) return null;
    const pos = linhas.slice(0, i).filter((l) => l.incluir).length;
    return linhas[i].incluir ? calc.itens[pos] : null;
  };
  const totSel = gerados.filter((g) => sel.has(g.id)).reduce((s, g) => s + Number(g.total || 0), 0);
  const anos: string[] = []; for (let a = new Date().getFullYear(); a >= 2013; a--) anos.push(String(a));
  const corStatus: Record<string, string> = { GERADO: '#2563EB', PAGO: '#16A34A', CANCELADO: '#9CA3AF' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div style={{ width: 'min(1600px, 98vw)', maxHeight: '92vh', background: '#fff', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 40px rgba(0,0,0,.25)' }}>
        <div style={{ background: FIN, color: '#fff', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{titulo ?? 'DARFs - geração e impressão'}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>{subtitulo ?? 'Multa de mora e juros Selic calculados para a data de pagamento'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 6, padding: '10px 18px 0', borderBottom: '1px solid #E5E7EB' }}>
          {(['GERAR', 'GERADOS'] as const).map((a) => (
            <button key={a} onClick={() => setAba(a)} style={{ border: 'none', background: 'none', padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontWeight: aba === a ? 600 : 400, color: aba === a ? FIN : '#6B7280', borderBottom: aba === a ? '2px solid ' + FIN_ACCENT : '2px solid transparent' }}>
              {a === 'GERAR' ? 'Gerar' : 'DARFs gerados'}
            </button>))}
        </div>

        <div style={{ padding: 18, overflow: 'auto', flex: 1 }}>
          {erro && <div style={{ background: '#FCEBEB', color: '#991B1B', borderRadius: 6, padding: '8px 10px', fontSize: 12, marginBottom: 12 }}>{erro}</div>}
          {ok && <div style={{ background: FIN_LIGHT, color: FIN, borderRadius: 6, padding: '8px 10px', fontSize: 12, marginBottom: 12 }}>{ok}</div>}

          {aba === 'GERAR' && <>
            <div style={sec}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div><Label>Data de pagamento</Label><SmartDateInput value={dataPag} onChange={(v: any) => { setDataPag(val(v)); setCalc(null); }} /></div>
                <div><Label>Multa de mora (padrão)</Label>
                  <select style={{ ...inputSt, width: 260 }} value={modoPadrao} onChange={(e) => { setModoPadrao(e.target.value); setCalc(null); }}>
                    <option value="DENUNCIA">{MODO_LBL.DENUNCIA}</option><option value="SICALC">{MODO_LBL.SICALC}</option><option value="SEM">{MODO_LBL.SEM}</option>
                  </select></div>
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, height: 32 }}>
                  <input type="checkbox" checked={ajustar} onChange={(e) => { setAjustar(e.target.checked); setCalc(null); }} /> Vencimento em dia não útil antecipa para o dia útil anterior
                </label>
                {idxQuota >= 0 && <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, height: 32, color: '#92400E' }}>
                  <input type="checkbox" checked={quotaOpcao} onChange={(e) => { const v = e.target.checked; setQuotaOpcao(v); setL(idxQuota, { multaModo: v ? 'SICALC' : 'PADRAO' }); }} />
                  1ª quota do IRPJ (2089 - {dBR(itensIniciais?.[idxQuota]?.periodoApuracao)}) com multa de mora: formaliza a opção pelo Lucro Presumido
                </label>}
              </div>
            </div>
            <div style={sec}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}><input type="checkbox" title="Marcar / desmarcar todos" checked={linhas.length > 0 && linhas.every((l) => l.incluir)} onChange={(e) => { setLinhas(linhas.map((l) => ({ ...l, incluir: e.target.checked }))); setCalc(null); }} /></th><th style={th}>Código</th><th style={th}>Descrição</th><th style={th}>Período apuração</th><th style={th}>Vencimento</th>
                  <th style={thR}>Principal</th><th style={th}>Multa de mora</th><th style={thR}>Multa</th><th style={thR}>Selic</th><th style={thR}>Juros</th><th style={thR}>Total</th><th style={th}></th>
                </tr></thead>
                <tbody>{linhas.map((l, i) => {
                  const c = calcDe(i);
                  return (
                    <tr key={i} style={{ opacity: l.incluir ? 1 : 0.45 }}>
                      <td style={td}><input type="checkbox" checked={l.incluir} onChange={(e) => setL(i, { incluir: e.target.checked })} /></td>
                      <td style={td}>{l.manual ? <input style={{ ...inputSt, height: 28, width: 64 }} value={l.codigo} onChange={(e) => setL(i, { codigo: e.target.value })} /> : <><b style={{ fontFamily: 'monospace' }}>{l.codigo}</b>{quotaOpcao && i === idxQuota ? <div style={{ fontSize: 9, color: '#92400E', fontWeight: 600 }}>opção Presumido</div> : null}</>}</td>
                      <td style={td}>{l.manual ? <input style={{ ...inputSt, height: 28, width: 200 }} value={l.descricao} onChange={(e) => setL(i, { descricao: e.target.value })} /> : l.descricao}</td>
                      <td style={td}>{l.manual ? <SmartDateInput value={l.periodoApuracao} onChange={(v: any) => setL(i, { periodoApuracao: val(v) })} /> : dBR(l.periodoApuracao)}</td>
                      <td style={td}>{l.manual ? <SmartDateInput value={l.vencimento} onChange={(v: any) => setL(i, { vencimento: val(v) })} /> : <>{dBR(c?.vencimento ?? l.vencimento)}{c && c.vencimento !== l.vencimento ? <div style={{ fontSize: 10, color: '#6B7280' }}>informado {dBR(l.vencimento)}</div> : null}</>}</td>
                      <td style={tdR}>{l.manual ? <Num value={l.principal} onChange={(v) => setL(i, { principal: v })} /> : n2(l.principal)}</td>
                      <td style={td}><select style={{ ...inputSt, height: 28, fontSize: 12 }} value={l.multaModo} onChange={(e) => setL(i, { multaModo: e.target.value })}>
                        {['PADRAO', 'DENUNCIA', 'SICALC', 'SEM'].map((m) => <option key={m} value={m}>{m === 'PADRAO' ? 'Padrão (' + (modoPadrao === 'SICALC' ? 'Sicalc' : modoPadrao === 'DENUNCIA' ? 'denúncia' : 'sem') + ')' : MODO_LBL[m]}</option>)}</select></td>
                      <td style={tdR}>{c ? n2(c.multa) : '-'}</td>
                      <td style={tdR}>{c ? n2(c.selicPct) + '%' : '-'}</td>
                      <td style={tdR}>{c ? n2(c.juros) : '-'}</td>
                      <td style={tdR}><b>{c ? n2(c.total) : '-'}</b>{c?.erros?.length ? <div style={{ fontSize: 10, color: '#B91C1C', whiteSpace: 'normal' }}>{c.erros.join('; ')}</div> : null}</td>
                      <td style={td}>{l.manual && <button style={{ ...btn('#fff', '#B91C1C'), height: 26 }} onClick={() => { setLinhas(linhas.filter((_, k) => k !== i)); setCalc(null); }}>Remover</button>}</td>
                    </tr>);
                })}
                  {calc && <tr style={{ background: FIN_LIGHT, fontWeight: 600 }}>
                    <td style={td} colSpan={5}>Total ({calc.itens.filter((x: any) => !x.erros.length).length} DARFs) - pagamento em {dBR(calc.dataPagamento)}</td>
                    <td style={tdR}>{n2(calc.totais.principal)}</td><td style={td}></td><td style={tdR}>{n2(calc.totais.multa)}</td><td style={td}></td>
                    <td style={tdR}>{n2(calc.totais.juros)}</td><td style={tdR}>{n2(calc.totais.total)}</td><td style={td}></td></tr>}
                  {!linhas.length && <tr><td style={td} colSpan={12}>Nenhum DARF. Use "Adicionar DARF" para incluir manualmente.</td></tr>}
                </tbody>
              </table>
              <button style={{ ...btn('#fff', FIN), marginTop: 10 }} onClick={() => { setLinhas([...linhas, { codigo: '', descricao: '', periodoApuracao: '', vencimento: '', principal: 0, incluir: true, multaModo: 'PADRAO', manual: true }]); setCalc(null); }}>+ Adicionar DARF</button>
            </div>
            {calc?.alertas?.length > 0 && <ul style={{ fontSize: 11, color: '#6B7280', paddingLeft: 18, margin: 0 }}>{calc.alertas.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>}
          </>}

          {aba === 'GERADOS' && <>
            <div style={{ ...sec, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div><Label>Ano do período de apuração</Label><select style={{ ...inputSt, width: 110 }} value={ano} onChange={(e) => setAno(e.target.value)}><option value="">Todos</option>{anos.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
              <div><Label>Situação</Label><select style={{ ...inputSt, width: 140 }} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todas</option><option value="GERADO">Gerado</option><option value="PAGO">Pago</option><option value="CANCELADO">Cancelado</option></select></div>
              <div style={{ marginLeft: 'auto', fontSize: 12 }}>{sel.size} selecionado(s) - total <b>{n2(totSel)}</b></div>
              <button style={btn('#fff', FIN)} disabled={!sel.size || busy} onClick={imprimir}>Imprimir</button>
              <button style={btn(FIN)} disabled={!sel.size || busy} onClick={baixarPdf}>Baixar PDF</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}><input type="checkbox" checked={gerados.length > 0 && gerados.every((g) => sel.has(g.id))} onChange={(e) => setSel(e.target.checked ? new Set(gerados.filter((g) => g.status !== 'CANCELADO').map((g) => g.id)) : new Set())} /></th>
                <th style={th}>Código</th><th style={{ ...th, width: 260 }}>Descrição</th><th style={th}>Período</th><th style={th}>Vencimento</th><th style={th}>Pagto previsto</th>
                <th style={thR}>Principal</th><th style={thR}>Multa</th><th style={thR}>Juros</th><th style={thR}>Total</th><th style={th}>Situação</th><th style={{ ...th, position: 'sticky', right: 0, zIndex: 1, boxShadow: '-6px 0 6px -6px rgba(0,0,0,.15)' }}>Ações</th>
              </tr></thead>
              <tbody>{gerados.map((g) => (
                <tr key={g.id} style={{ opacity: g.status === 'CANCELADO' ? 0.5 : 1 }}>
                  <td style={td}><input type="checkbox" checked={sel.has(g.id)} disabled={g.status === 'CANCELADO'} onChange={(e) => { const s = new Set(sel); e.target.checked ? s.add(g.id) : s.delete(g.id); setSel(s); }} /></td>
                  <td style={{ ...td, fontFamily: 'monospace' }}>{g.codigo}</td><td style={{ ...td, whiteSpace: 'normal', maxWidth: 260, minWidth: 160 }} title={g.descricao}><div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3 }}>{g.descricao}</div></td><td style={td}>{dBR(g.periodo_apuracao)}</td><td style={td}>{dBR(g.vencimento)}</td><td style={td}>{dBR(g.data_pagamento_prevista)}</td>
                  <td style={tdR}>{n2(g.principal)}</td><td style={tdR} title={g.multa_modo}>{n2(g.multa)}</td><td style={tdR}>{n2(g.juros)}</td><td style={tdR}><b>{n2(g.total)}</b></td>
                  <td style={td}><span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: corStatus[g.status] + '22', color: corStatus[g.status] }}>{g.status}</span>
                    {g.status === 'PAGO' && <div style={{ fontSize: 10, color: '#6B7280', whiteSpace: 'normal', maxWidth: 240, wordBreak: 'break-all' }}>{dBR(g.pago_em)} - {n2(g.valor_pago)}{g.numero_documento ? ' - ' + g.numero_documento : ''}</div>}</td>
                  <td style={{ ...td, position: 'sticky', right: 0, background: '#fff', boxShadow: '-6px 0 6px -6px rgba(0,0,0,.15)' }}>{g.status === 'GERADO' && <>
                    <button style={{ ...btn('#fff', FIN), height: 26 }} onClick={() => setPag({ id: g.id, desc: g.codigo + ' ' + g.descricao, pagoEm: hoje(), valorPago: g.total, numeroDocumento: '' })}>Pago</button>{' '}
                    <button style={{ ...btn('#fff', '#B91C1C'), height: 26 }} onClick={() => cancelar(g.id)}>Cancelar</button></>}</td>
                </tr>))}
                {!gerados.length && <tr><td style={td} colSpan={12}>Nenhum DARF gerado com esses filtros.</td></tr>}
              </tbody>
            </table>
            {pag && <div style={{ ...sec, marginTop: 14, background: '#FAFAFA', padding: 12, borderRadius: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Registrar pagamento - {pag.desc}</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div><Label>Data do pagamento</Label><SmartDateInput value={pag.pagoEm} onChange={(v: any) => setPag({ ...pag, pagoEm: val(v) })} /></div>
                <div><Label>Valor pago</Label><Num value={pag.valorPago} onChange={(v) => setPag({ ...pag, valorPago: v })} width={120} /></div>
                <div><Label>Nº do DARF / autenticação</Label><input style={{ ...inputSt, width: 220 }} value={pag.numeroDocumento} onChange={(e) => setPag({ ...pag, numeroDocumento: e.target.value })} /></div>
                <button style={btn('#fff')} onClick={() => setPag(null)}>Cancelar</button>
                <button style={btn(FIN_ACCENT)} onClick={salvarPagamento}>Registrar</button>
              </div>
              {pag.erro && <div style={{ background: '#FCEBEB', color: '#991B1B', borderRadius: 6, padding: '6px 10px', fontSize: 12, marginTop: 8 }}>{pag.erro}</div>}
            </div>}
          </>}
        </div>

        <div style={{ background: '#FAFAFA', padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #E5E7EB' }}>
          <button style={btn('#fff')} onClick={onClose}>Fechar</button>
          {aba === 'GERAR' && <>
            <button style={btn('#fff', FIN)} disabled={busy || !linhas.length} onClick={calcular}>{busy ? 'Calculando...' : 'Calcular'}</button>
            <button style={btn(FIN_ACCENT)} disabled={busy || !calc} onClick={gravar}>Gerar e gravar DARFs</button>
          </>}
        </div>
      </div>
    </div>
  );
}

export default DarfModal;
