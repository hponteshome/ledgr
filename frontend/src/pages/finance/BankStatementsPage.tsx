// frontend/src/pages/finance/BankStatementsPage.tsx
// EXTBB-10B (23/11/2026) - Extratos e Conciliacao: 1 Importar - 2 Classificar - 3 Contabilizar.
// Um destino por linha (lancamento direto, ja contabilizado, ignorar); 1 lancamento por linha pelo servico
// oficial da Contabil (trava de competencia fechada). Codigos de conta exibidos com a mascara da empresa.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FiUpload, FiTrash2, FiEye, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import Swal from 'sweetalert2';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { AccountPicker, PickerAccount } from '../../components/finance/AccountPicker';
import { InvestRedemptionModal } from '../../components/finance/InvestRedemptionModal'; // EXTINV-02
import { useSidebarPermissions } from '../../contexts/SidebarPermissionsContext';
import { DEFAULT_LEVELS, formatAccountCode, parseMaskLevels } from '../../utils/accountMask';

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';
const FIN = '#1A4A3A';
const FIN_ACCENT = '#3DAA7A';
const FIN_LIGHT = '#E8F5EE';

type Acc = { id: string; code: string; reducedCode?: string | null; name: string };
type Entry = { id: string; date: string; description: string; sourceModule: string; reference?: string | null };
interface Line {
  id: string; lineNo: number | null; date: string; type: 'DEBIT' | 'CREDIT'; amount: number; balance: number | null;
  description: string; bankRef: string | null; bankHistCode: string | null; counterpartyName: string | null; counterpartyDoc: string | null;
  status: string; destination: string | null; ignoreReason: string | null; memo: string | null;
  account: Acc | null;
  suggestion: { account: Acc | null; source: string | null; confidence: number | null; memo: string | null } | null;
  journalEntry: Entry | null; possibleMatch: Entry | null;
  // EXTINV-02: resgate de investimento
  invest?: { investmentId: string; cdb: string | null; tipo: string | null; split: any; eventId: string | null } | null;
  investHint?: { investmentId: string | null; cdb: string | null; porDocumento: boolean } | null;
}
interface StatementInfo {
  id: string; fileName: string; layout: string | null; status: string; bankName: string; agency: string | null; account: string | null;
  periodFrom: string; periodTo: string; openingBalance: number | null; closingBalance: number | null;
  bankAccount: { id: string; nickname: string | null; ledgerAccount: Acc | null; investmentAccount: Acc | null } | null;
}
interface Preview {
  counts: { gerar: number; investir?: number; conciliar: number; ignorar: number; pendentes: number; total: number };
  entries: { lineId: string; lineNo: number | null; date: string; description: string; value: number; debit: Acc | null; credit: Acc | null;
    partidas?: { tipo: 'D' | 'C'; conta: Acc | null; valor: number }[]; resgate?: any }[]; // EXTINV-02
  saldo: { ate: string; contabilAntes: number | null; efeito: number; contabilDepois: number | null; extratoFinal: number | null; diferenca: number | null };
  avisos: string[];
}
type Filtro = 'pendentes' | 'sugeridas' | 'encontradas' | 'definidas' | 'finalizadas' | 'todas';

const TRAVADAS = ['POSTED', 'RECONCILED'];
const FINAIS = ['POSTED', 'RECONCILED', 'IGNORED'];
const STATUS_EXTRATO: Record<string, string> = { IMPORTED: 'Importado', IN_PROGRESS: 'Em andamento', COMPLETED: 'Concluído', CANCELED: 'Cancelado' };
const ORIGEM: Record<string, string> = { DOCUMENT: 'Documento', AUTO_INVEST: 'Aplicação automática', LEARNED: 'Aprendido', FIXED: 'Regra fixa', FUZZY: 'Similar' };

const brl = (v?: number | null) => (v == null ? '-' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const dmy = (s?: string | null) => {
  if (!s) return '-';
  const d = s.slice(0, 10).split('-');
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : s;
};
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('@ledgr:token') ?? '';
  let co: any = null;
  try { co = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? 'null'); } catch { co = null; }
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(co?.id ? { 'x-company-id': co.id } : {}) };
}
const msgErro = (e: any, padrao: string) => {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : (m ?? padrao);
};
const grupoDe = (l: Line) =>
  `${l.type === 'DEBIT' ? 'D' : 'C'} | ${(l.bankHistCode ? l.bankHistCode + ' ' : '')}${l.description.replace(/\d{5,}/g, '').replace(/\d{2}\/\d{2} \d{2}:\d{2}/g, '').replace(/^\d{3}-/, '').replace(/\s+/g, ' ').trim().slice(0, 48)}`;

const card: React.CSSProperties = { background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10 };
const btn = (primary = false, disabled = false): React.CSSProperties => ({
  background: primary ? FIN : '#fff', color: primary ? '#fff' : '#374151', border: primary ? 'none' : '0.5px solid #D1D5DB',
  borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  display: 'inline-flex', alignItems: 'center', gap: 6,
});
const th: React.CSSProperties = { padding: '8px 10px', fontSize: 11, fontWeight: 700, color: FIN, textAlign: 'left', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '7px 10px', fontSize: 12, color: '#111827', verticalAlign: 'top' };
const chip = (bg: string, color: string): React.CSSProperties => ({ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: bg, color, display: 'inline-block', whiteSpace: 'nowrap' });
const inputSt: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '0.5px solid #D1D5DB', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none', background: '#fff' };

export default function BankStatementsPage() {
  const { canEdit } = useSidebarPermissions();
  const podeEditar = canEdit('/app/finance/bank-import');
  const [levels, setLevels] = useState<number[]>(DEFAULT_LEVELS);
  const [accounts, setAccounts] = useState<PickerAccount[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [statements, setStatements] = useState<any[]>([]);
  const [current, setCurrent] = useState<string | null>(null);

  // etapa 1
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<{ name: string; ok: boolean; msg: string }[]>([]);
  // etapa 2
  const [info, setInfo] = useState<StatementInfo | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('pendentes');
  const [agrupar, setAgrupar] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [accountId, setAccountId] = useState('');
  const [memo, setMemo] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  // etapa 3
  const [preview, setPreview] = useState<Preview | null>(null);
  const [resgateLinha, setResgateLinha] = useState<string | null>(null); // EXTINV-02

  const fmtAcc = (a?: Acc | null) => (a ? `${formatAccountCode(a.code, levels)}${a.reducedCode ? ` (${a.reducedCode})` : ''} - ${a.name}` : '-');

  const loadStatements = async () => {
    try { const r = await api.get('/bank-import/statements'); setStatements(Array.isArray(r.data) ? r.data : []); }
    catch (e: any) { toast.error(msgErro(e, 'Falha ao carregar os extratos.')); }
  };
  const loadLines = async (id: string) => {
    try {
      const r = await api.get(`/bank-import/statements/${id}/lines`);
      setInfo(r.data?.statement ?? null);
      setLines(Array.isArray(r.data?.lines) ? r.data.lines : []);
    } catch (e: any) { toast.error(msgErro(e, 'Falha ao carregar as linhas.')); }
  };
  const loadPreview = async (id: string) => {
    try { const r = await api.get(`/bank-import/statements/${id}/preview`); setPreview(r.data); }
    catch (e: any) { toast.error(msgErro(e, 'Falha ao montar a prévia.')); }
  };

  useEffect(() => {
    api.get('/accounting/mask')
      .then(r => { const d: any = r.data; setLevels(Array.isArray(d?.levels) && d.levels.length ? d.levels : parseMaskLevels(d?.mask)); })
      .catch(() => undefined);
    api.get('/bank-accounts/ledger-options').then(r => setAccounts(Array.isArray(r.data) ? r.data : [])).catch(() => setAccounts([]));
    loadStatements();
  }, []);

  const abrir = async (id: string) => {
    setCurrent(id); setSelected(new Set()); setFiltro('pendentes'); setPreview(null);
    await loadLines(id);
    setStep(2);
  };

  // ── Etapa 1: importar ──────────────────────────────────────────────────────
  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    const out: { name: string; ok: boolean; msg: string }[] = [];
    for (const f of list) {
      try {
        const form = new FormData();
        form.append('file', f);
        const res = await fetch(`${API}/bank-import/upload`, { method: 'POST', headers: authHeaders(), body: form });
        const data: any = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(Array.isArray(data?.message) ? data.message.join(', ') : (data?.message ?? `Erro ${res.status}`));
        out.push({ name: f.name, ok: true, msg: `${data.totalLines} linha(s) importada(s)${data.duplicates ? ` - ${data.duplicates} já existente(s) descartada(s)` : ''}${data.bankAccountName ? ` - ${data.bankAccountName}` : ''}` });
      } catch (e: any) {
        out.push({ name: f.name, ok: false, msg: e?.message ?? 'Falha ao importar.' });
      }
    }
    setResults(out);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    loadStatements();
  };

  const excluir = async (s: any) => {
    const ok = await Swal.fire({
      title: 'Excluir extrato?', text: `${s.fileName} - as linhas saem da conciliação (lançamentos gerados bloqueiam a exclusão).`,
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Excluir', cancelButtonText: 'Cancelar', confirmButtonColor: '#A32D2D',
    });
    if (!ok.isConfirmed) return;
    try { await api.delete(`/bank-import/statements/${s.id}`); toast.success('Extrato excluído.'); loadStatements(); }
    catch (e: any) { toast.error(msgErro(e, 'Falha ao excluir.')); }
  };

  // ── Etapa 2: classificar ───────────────────────────────────────────────────
  const visiveis = useMemo(() => lines.filter(l => {
    const pend = !FINAIS.includes(l.status) && l.status !== 'CLASSIFIED';
    switch (filtro) {
      case 'pendentes': return pend;
      case 'sugeridas': return pend && !!l.suggestion?.account;
      case 'encontradas': return pend && !!l.possibleMatch;
      case 'definidas': return l.status === 'CLASSIFIED';
      case 'finalizadas': return FINAIS.includes(l.status);
      default: return true;
    }
  }), [lines, filtro]);

  const grupos = useMemo(() => {
    const m = new Map<string, Line[]>();
    for (const l of visiveis) { const k = grupoDe(l); m.set(k, [...(m.get(k) ?? []), l]); }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [visiveis]);

  const contagem = (f: Filtro) => lines.filter(l => {
    const pend = !FINAIS.includes(l.status) && l.status !== 'CLASSIFIED';
    if (f === 'pendentes') return pend;
    if (f === 'sugeridas') return pend && !!l.suggestion?.account;
    if (f === 'encontradas') return pend && !!l.possibleMatch;
    if (f === 'definidas') return l.status === 'CLASSIFIED';
    if (f === 'finalizadas') return FINAIS.includes(l.status);
    return true;
  }).length;

  const selecionaveis = (ls: Line[]) => ls.filter(l => !TRAVADAS.includes(l.status));
  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleMuitas = (ls: Line[]) => setSelected(prev => {
    const ids = selecionaveis(ls).map(l => l.id);
    const todas = ids.length > 0 && ids.every(i => prev.has(i));
    const n = new Set(prev);
    ids.forEach(i => (todas ? n.delete(i) : n.add(i)));
    return n;
  });
  const selIds = () => lines.filter(l => selected.has(l.id) && !TRAVADAS.includes(l.status)).map(l => l.id);

  const patch = async (ids: string[], body: any, okMsg: string) => {
    if (!current) return false;
    if (!ids.length) { toast.error('Selecione ao menos uma linha.'); return false; }
    setBusy(true);
    try {
      await api.patch(`/bank-import/statements/${current}/lines`, { ids, ...body });
      toast.success(okMsg);
      return true;
    } catch (e: any) {
      toast.error(msgErro(e, 'Falha ao aplicar.'));
      return false;
    } finally { setBusy(false); }
  };
  const depois = async () => { setSelected(new Set()); if (current) await loadLines(current); };

  const aceitarSugestoes = async () => {
    const porConta = new Map<string, string[]>();
    lines.filter(l => selected.has(l.id) && !TRAVADAS.includes(l.status) && l.suggestion?.account)
      .forEach(l => { const a = l.suggestion!.account!.id; porConta.set(a, [...(porConta.get(a) ?? []), l.id]); });
    if (!porConta.size) { toast.error('Nenhuma linha selecionada tem conta sugerida.'); return; }
    for (const [acc, ids] of porConta) await patch(ids, { destination: 'DIRECT_ENTRY', accountId: acc }, `${ids.length} linha(s): sugestão aceita.`);
    await depois();
  };
  const lancarEm = async () => {
    if (!accountId) { toast.error('Escolha a conta de contrapartida.'); return; }
    if (await patch(selIds(), { destination: 'DIRECT_ENTRY', accountId, memo: memo.trim() || undefined, remember }, 'Destino aplicado.')) await depois();
  };
  const jaContabilizado = async () => {
    if (await patch(selIds(), { destination: 'ALREADY_POSTED' }, 'Linha(s) vinculada(s) ao lançamento existente.')) await depois();
  };
  const ignorar = async () => {
    const ids = selIds();
    if (!ids.length) { toast.error('Selecione ao menos uma linha.'); return; }
    const r = await Swal.fire({
      title: 'Ignorar linha(s)?', input: 'text', inputLabel: 'Motivo (obrigatório)',
      inputPlaceholder: 'Ex.: contabilizado na ECD 2025 de forma agrupada',
      showCancelButton: true, confirmButtonText: 'Ignorar', cancelButtonText: 'Cancelar', confirmButtonColor: FIN,
      inputValidator: v => (!v || !v.trim() ? 'Informe o motivo.' : undefined),
    });
    if (!r.isConfirmed) return;
    if (await patch(ids, { destination: 'IGNORE', ignoreReason: String(r.value).trim() }, 'Linha(s) marcada(s) para ignorar.')) await depois();
  };
  const voltarPendente = async () => {
    if (await patch(selIds(), { destination: null }, 'Linha(s) de volta a pendente.')) await depois();
  };

  // EXTINV-02: resgate de investimento (uma linha de entrada por vez)
  const resgateInvestimento = () => {
    const sel = lines.filter(l => selected.has(l.id) && !TRAVADAS.includes(l.status));
    if (sel.length !== 1) { toast.error('Selecione uma linha de resgate por vez.'); return; }
    if (sel[0].type !== 'CREDIT') { toast.error('Resgate de investimento só para entradas no extrato.'); return; }
    setResgateLinha(sel[0].id);
  };

  // ── Etapa 3: contabilizar ──────────────────────────────────────────────────
  const irEtapa3 = async () => { if (!current) return; await loadPreview(current); setStep(3); };
  const gerar = async () => {
    if (!current || !preview) return;
    const c = preview.counts;
    const ok = await Swal.fire({
      title: 'Gerar lançamentos?',
      html: `${c.gerar} lançamento(s) novo(s), ${c.conciliar} vínculo(s) com lançamento existente e ${c.ignorar} linha(s) ignorada(s).`,
      icon: 'question', showCancelButton: true, confirmButtonText: 'Gerar', cancelButtonText: 'Cancelar', confirmButtonColor: FIN,
    });
    if (!ok.isConfirmed) return;
    setBusy(true);
    try {
      const r = await api.post(`/bank-import/statements/${current}/post`);
      const d: any = r.data;
      if (d.errors?.length) toast.error(`${d.errors.length} linha(s) com erro: ${d.errors[0].error}`);
      toast.success(`${d.posted} lançamento(s) gerado(s), ${d.reconciled} conciliado(s), ${d.ignored} ignorado(s).`);
      await loadPreview(current);
      await loadLines(current);
      loadStatements();
    } catch (e: any) {
      toast.error(msgErro(e, 'Falha ao gerar os lançamentos.'));
    } finally { setBusy(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const etapas: [1 | 2 | 3, string][] = [[1, 'Importar'], [2, 'Classificar'], [3, 'Contabilizar']];
  const destinoCell = (l: Line) => {
    if (l.status === 'POSTED') return <span style={chip('#F0FDF4', '#15803D')}>Lançado</span>;
    if (l.status === 'RECONCILED') return <span style={chip('#EFF6FF', '#1D4ED8')}>Conciliado</span>;
    if (l.status === 'IGNORED') return <span style={chip('#F3F4F6', '#6B7280')} title={l.ignoreReason ?? ''}>Ignorado</span>;
    if (l.status === 'CLASSIFIED') {
      if (l.destination === 'DIRECT_ENTRY') return <span><span style={chip(FIN_LIGHT, FIN)}>Lançar</span> <span style={{ fontSize: 11 }}>{fmtAcc(l.account)}</span></span>;
      if (l.destination === 'ALREADY_POSTED') return <span style={chip('#EFF6FF', '#1D4ED8')}>Já contabilizado</span>;
      if (l.destination === 'INVEST_REDEMPTION') return <span><span style={chip('#F5F3FF', '#6D28D9')}>Resgate</span> <span style={{ fontSize: 11 }}>{l.invest?.tipo ?? ''} {l.invest?.cdb ?? ''} · principal {brl(l.invest?.split?.principal)} · rend. {brl(l.invest?.split?.rendimentoBruto)} · IR {brl(l.invest?.split?.ir)}</span></span>;
      if (l.destination === 'IGNORE') return <span style={chip('#F3F4F6', '#6B7280')} title={l.ignoreReason ?? ''}>Ignorar</span>;
    }
    return (
      <span>
        <span style={chip('#FEFCE8', '#854D0E')}>Pendente</span>
        {l.possibleMatch && <span style={{ ...chip('#EFF6FF', '#1D4ED8'), marginLeft: 4 }} title={`${dmy(l.possibleMatch.date)} - ${l.possibleMatch.description}`}>lançamento existente encontrado</span>}
        {l.investHint && <span style={{ ...chip('#F5F3FF', '#6D28D9'), marginLeft: 4 }}>{l.investHint.porDocumento ? `resgate de ${l.investHint.cdb}` : 'resgate de aplicação'}</span>}
      </span>
    );
  };
  const sugestaoCell = (l: Line) => {
    const s = l.suggestion;
    if (!s) return <span style={{ color: '#9CA3AF' }}>-</span>;
    return (
      <span>
        {s.account ? <span style={{ fontSize: 11 }}>{fmtAcc(s.account)}</span> : <span style={{ fontSize: 11, color: '#6B7280' }}>{s.memo ?? 'sem conta'}</span>}
        {s.source && <span style={{ ...chip('#F9FAFB', '#4B5563'), marginLeft: 4 }}>{ORIGEM[s.source] ?? s.source}{s.confidence ? ` ${s.confidence}%` : ''}</span>}
      </span>
    );
  };
  const linhaRow = (l: Line) => {
    const trav = TRAVADAS.includes(l.status);
    return (
      <tr key={l.id} style={{ borderTop: '0.5px solid #F0F0F0', background: selected.has(l.id) ? '#F0FDF4' : '#fff' }}>
        <td style={td}><input type="checkbox" disabled={trav || !podeEditar} checked={selected.has(l.id)} onChange={() => toggle(l.id)} /></td>
        <td style={{ ...td, color: '#9CA3AF' }}>{l.lineNo ?? '-'}</td>
        <td style={{ ...td, whiteSpace: 'nowrap' }}>{dmy(l.date)}</td>
        <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap', color: l.type === 'DEBIT' ? '#A32D2D' : '#15803D', fontWeight: 600 }}>{l.type === 'DEBIT' ? '-' : '+'}{brl(l.amount)}</td>
        <td style={td}>
          <div>{l.description}</div>
          {(l.counterpartyDoc || l.bankRef) && <div style={{ fontSize: 10, color: '#9CA3AF' }}>{l.counterpartyDoc ? `CPF/CNPJ ${l.counterpartyDoc} ` : ''}{l.bankRef ? `doc ${l.bankRef}` : ''}</div>}
        </td>
        <td style={td}>{sugestaoCell(l)}</td>
        <td style={td}>{destinoCell(l)}</td>
      </tr>
    );
  };
  const cabecalhoLinhas = (ls: Line[]) => {
    const sel = selecionaveis(ls);
    return (
      <tr style={{ background: FIN_LIGHT }}>
        <th style={th}><input type="checkbox" disabled={!podeEditar || !sel.length} checked={sel.length > 0 && sel.every(l => selected.has(l.id))} onChange={() => toggleMuitas(ls)} /></th>
        <th style={th}>Nº</th><th style={th}>Data</th><th style={{ ...th, textAlign: 'right' }}>Valor</th>
        <th style={th}>Histórico do banco</th><th style={th}>Sugestão</th><th style={th}>Destino</th>
      </tr>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: FIN }}>Extratos e Conciliação</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Importar o extrato, definir um destino por linha e gerar os lançamentos (1 por linha)</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {etapas.map(([n, label]) => (
            <button key={n} disabled={n > 1 && !current} onClick={() => (n === 3 ? irEtapa3() : n === 2 && current ? abrir(current) : setStep(1))}
              style={{ ...btn(step === n, n > 1 && !current), borderRadius: 20 }}>{n}. {label}</button>
          ))}
        </div>
      </div>

      {step === 1 && (
        <>
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); if (podeEditar && !uploading) uploadFiles(e.dataTransfer.files); }}
            style={{ ...card, borderStyle: 'dashed', borderWidth: 1, borderColor: FIN_ACCENT, background: FIN_LIGHT, padding: 22, textAlign: 'center', marginBottom: 14 }}>
            <FiUpload size={22} color={FIN} />
            <div style={{ fontSize: 13, color: FIN, fontWeight: 600, marginTop: 6 }}>Arraste os extratos aqui ou</div>
            <button disabled={!podeEditar || uploading} onClick={() => fileRef.current?.click()} style={{ ...btn(true, !podeEditar || uploading), marginTop: 8 }}>
              {uploading ? 'Importando...' : 'Escolher arquivos'}
            </button>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6 }}>PDF do Banco do Brasil, XLS, OFX ou CSV - vários de uma vez. Arquivo e linhas já importados são recusados.</div>
            <input ref={fileRef} type="file" multiple accept=".pdf,.xls,.xlsx,.ofx,.ofc,.csv" style={{ display: 'none' }}
              onChange={e => e.target.files && uploadFiles(e.target.files)} />
          </div>
          {results.length > 0 && (
            <div style={{ ...card, padding: 12, marginBottom: 14 }}>
              {results.map((r, i) => (
                <div key={i} style={{ fontSize: 12, padding: '3px 0', color: r.ok ? '#15803D' : '#A32D2D', display: 'flex', gap: 6, alignItems: 'center' }}>
                  {r.ok ? <FiCheckCircle size={13} /> : <FiAlertCircle size={13} />} <b>{r.name}</b> - {r.msg}
                </div>
              ))}
            </div>
          )}
          <div style={{ ...card, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: FIN_LIGHT }}>
                  {['Arquivo', 'Banco / conta', 'Período', 'Linhas', 'Saldo inicial', 'Saldo final', 'Situação', 'Ações'].map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {statements.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: '#9CA3AF', padding: 20 }}>Nenhum extrato importado para esta empresa.</td></tr>}
                {statements.map(s => (
                  <tr key={s.id} style={{ borderTop: '0.5px solid #F0F0F0' }}>
                    <td style={td}>{s.fileName}<div style={{ fontSize: 10, color: '#9CA3AF' }}>{s.layout ?? s.fileFormat}</div></td>
                    <td style={td}>{s.bankName}{s.agency ? ` - ag. ${s.agency}` : ''}{s.account ? ` c/c ${s.account}` : ''}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{dmy(s.periodFrom)} a {dmy(s.periodTo)}</td>
                    <td style={td}>{s._count?.transactions ?? s.totalLines}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{brl(s.openingBalance != null ? Number(s.openingBalance) : null)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{brl(s.closingBalance != null ? Number(s.closingBalance) : null)}</td>
                    <td style={td}><span style={chip(s.status === 'COMPLETED' ? '#F0FDF4' : '#FEFCE8', s.status === 'COMPLETED' ? '#15803D' : '#854D0E')}>{STATUS_EXTRATO[s.status] ?? s.status}</span></td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <button title="Abrir" onClick={() => abrir(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: FIN }}><FiEye size={16} /></button>
                      <button title="Excluir" disabled={!podeEditar} onClick={() => excluir(s)} style={{ background: 'none', border: 'none', cursor: podeEditar ? 'pointer' : 'not-allowed', color: '#A32D2D', opacity: podeEditar ? 1 : 0.4 }}><FiTrash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {step === 2 && info && (
        <>
          <div style={{ ...card, padding: '10px 14px', marginBottom: 10, display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12 }}>
            <div><b>{info.fileName}</b><div style={{ color: '#6B7280' }}>{dmy(info.periodFrom)} a {dmy(info.periodTo)} - {STATUS_EXTRATO[info.status] ?? info.status}</div></div>
            <div>Conta: <b>{info.bankAccount?.nickname ?? `${info.bankName} ${info.agency ?? ''} ${info.account ?? ''}`}</b><div style={{ color: '#6B7280' }}>Contábil: {fmtAcc(info.bankAccount?.ledgerAccount)}</div></div>
            <div>Saldo inicial <b>{brl(info.openingBalance)}</b><div>Saldo final <b>{brl(info.closingBalance)}</b></div></div>
          </div>

          <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,.06)', ...card, padding: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
              {(['pendentes', 'sugeridas', 'encontradas', 'definidas', 'finalizadas', 'todas'] as Filtro[]).map(f => (
                <button key={f} onClick={() => setFiltro(f)} style={{ ...btn(filtro === f), borderRadius: 20, padding: '4px 10px' }}>
                  {{ pendentes: 'Pendentes', sugeridas: 'Com sugestão', encontradas: 'Lançamento existente', definidas: 'Com destino', finalizadas: 'Finalizadas', todas: 'Todas' }[f]} ({contagem(f)})
                </button>
              ))}
              <label style={{ fontSize: 12, marginLeft: 8, display: 'flex', gap: 4, alignItems: 'center' }}>
                <input type="checkbox" checked={agrupar} onChange={e => setAgrupar(e.target.checked)} /> Agrupar por padrão
              </label>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6B7280' }}>{selIds().length} selecionada(s)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr auto', gap: 8, alignItems: 'end' }}>
              <div>
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 3 }}>Lançar em (contrapartida)</div>
                <AccountPicker value={accountId} onChange={setAccountId} accounts={accounts} disabled={!podeEditar} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 3 }}>Histórico (opcional - padrão: o do banco)</div>
                <input style={inputSt} disabled={!podeEditar} value={memo} onChange={e => setMemo(e.target.value)} placeholder="Ex.: Mútuo concedido KPL" />
              </div>
              <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center', paddingBottom: 8 }}>
                <input type="checkbox" checked={remember} disabled={!podeEditar} onChange={e => setRemember(e.target.checked)} /> Lembrar regra
              </label>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <button disabled={!podeEditar || busy} onClick={aceitarSugestoes} style={btn(false, !podeEditar || busy)}>Aceitar sugestões</button>
              <button disabled={!podeEditar || busy} onClick={lancarEm} style={btn(true, !podeEditar || busy)}>Lançar na conta escolhida</button>
              <button disabled={!podeEditar || busy} onClick={jaContabilizado} style={btn(false, !podeEditar || busy)}>Já contabilizado</button>
              <button disabled={!podeEditar || busy} onClick={ignorar} style={btn(false, !podeEditar || busy)}>Ignorar...</button>
              <button disabled={!podeEditar || busy} onClick={resgateInvestimento} style={btn(false, !podeEditar || busy)}>Resgate de investimento...</button>
              <button disabled={!podeEditar || busy} onClick={voltarPendente} style={btn(false, !podeEditar || busy)}>Voltar a pendente</button>
              <button onClick={irEtapa3} style={{ ...btn(true), marginLeft: 'auto' }}>Ir para Contabilizar</button>
            </div>
          </div>

          <div style={{ ...card, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>{cabecalhoLinhas(visiveis)}</thead>
              <tbody>
                {visiveis.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#9CA3AF', padding: 20 }}>Nenhuma linha neste filtro.</td></tr>}
                {!agrupar && visiveis.map(linhaRow)}
                {agrupar && grupos.map(([k, ls]) => (
                  <React.Fragment key={k}>
                    <tr style={{ background: '#F9FAFB', borderTop: '0.5px solid #E5E7EB' }}>
                      <td style={td}><input type="checkbox" disabled={!podeEditar || !selecionaveis(ls).length} checked={selecionaveis(ls).length > 0 && selecionaveis(ls).every(l => selected.has(l.id))} onChange={() => toggleMuitas(ls)} /></td>
                      <td colSpan={6} style={{ ...td, fontWeight: 600, color: FIN }}>{k} - {ls.length} linha(s) - {brl(ls.reduce((s, l) => s + l.amount, 0))}</td>
                    </tr>
                    {ls.map(linhaRow)}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {step === 3 && preview && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
            {[['Lançamentos novos', preview.counts.gerar], ['Vínculos com lançamento existente', preview.counts.conciliar], ['Ignoradas', preview.counts.ignorar], ['Sem destino', preview.counts.pendentes]].map(([l, v]) => (
              <div key={String(l)} style={{ ...card, padding: 12 }}><div style={{ fontSize: 11, color: '#6B7280' }}>{l}</div><div style={{ fontSize: 20, fontWeight: 600, color: FIN }}>{v}</div></div>
            ))}
          </div>
          <div style={{ ...card, padding: 12, marginBottom: 10, borderLeft: `3px solid ${preview.saldo.diferenca === 0 ? FIN_ACCENT : '#A32D2D'}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: FIN, marginBottom: 6 }}>CONFERÊNCIA DE SALDO EM {dmy(preview.saldo.ate)} - {fmtAcc(info?.bankAccount?.ledgerAccount)}</div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', fontSize: 12 }}>
              <div>Contábil antes<br /><b>{brl(preview.saldo.contabilAntes)}</b></div>
              <div>Efeito dos lançamentos<br /><b>{brl(preview.saldo.efeito)}</b></div>
              <div>Contábil depois<br /><b>{brl(preview.saldo.contabilDepois)}</b></div>
              <div>Saldo do extrato<br /><b>{brl(preview.saldo.extratoFinal)}</b></div>
              <div>Diferença<br /><b style={{ color: preview.saldo.diferenca === 0 ? '#15803D' : '#A32D2D' }}>{brl(preview.saldo.diferenca)}</b></div>
            </div>
          </div>
          {preview.avisos.length > 0 && (
            <div style={{ background: '#FEFCE8', color: '#854D0E', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 10 }}>
              {preview.avisos.map((a, i) => <div key={i}><FiAlertCircle size={12} /> {a}</div>)}
            </div>
          )}
          <div style={{ ...card, overflow: 'hidden', marginBottom: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: FIN_LIGHT }}>{['Nº', 'Data', 'Débito', 'Crédito', 'Valor', 'Histórico'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {preview.entries.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#9CA3AF', padding: 16 }}>Nenhum lançamento a gerar.</td></tr>}
                {preview.entries.map(e => (
                  <tr key={e.lineId} style={{ borderTop: '0.5px solid #F0F0F0' }}>
                    <td style={{ ...td, color: '#9CA3AF' }}>{e.lineNo ?? '-'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{dmy(e.date)}</td>
                    <td style={td}>{e.partidas ? e.partidas.filter(p => p.tipo === 'D').map((p, i) => <div key={i}>{fmtAcc(p.conta)} <span style={{ color: '#6B7280' }}>{brl(p.valor)}</span></div>) : fmtAcc(e.debit)}</td>
                    <td style={td}>{e.partidas ? e.partidas.filter(p => p.tipo === 'C').map((p, i) => <div key={i}>{fmtAcc(p.conta)} <span style={{ color: '#6B7280' }}>{brl(p.valor)}</span></div>) : fmtAcc(e.credit)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{brl(e.value)}</td>
                    <td style={td}>{e.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => current && abrir(current)} style={btn()}>Voltar a Classificar</button>
            <button disabled={!podeEditar || busy || (preview.counts.gerar + preview.counts.conciliar + preview.counts.ignorar) === 0} onClick={gerar}
              style={btn(true, !podeEditar || busy || (preview.counts.gerar + preview.counts.conciliar + preview.counts.ignorar) === 0)}>
              {busy ? 'Gerando...' : 'Gerar lançamentos'}
            </button>
          </div>
        </>
      )}

      {/* EXTINV-02: resgate de investimento */}
      {resgateLinha && current && (
        <InvestRedemptionModal statementId={current} lineId={resgateLinha}
          onClose={() => setResgateLinha(null)}
          onSaved={async () => { setResgateLinha(null); toast.success('Resgate definido para a linha.'); await depois(); }} />
      )}
    </div>
  );
}
