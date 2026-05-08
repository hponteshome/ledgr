// frontend/src/pages/hr/ProLabore.tsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const fmtBRL = (v: any) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCPF = (v: string) => v?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') ?? '';

// ── AccountPicker (reutilizado) ───────────────────────────────────────────────
interface Account { id: string; code: string; name: string; reducedCode?: string; }
function AccountPicker({ label, value, onChange, accounts }: {
  label: string; value: string; onChange: (id: string) => void; accounts: Account[];
}) {
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const safe = Array.isArray(accounts) ? accounts : [];
  const selected = safe.find(a => a.id === value);
  const display = selected ? (selected.reducedCode ?? selected.code) + ' — ' + selected.name : '';
  const qNorm = q.replace(/\./g, '');
  const filtered = qNorm.length >= 1
    ? safe.filter(a => a.code.includes(qNorm) || (a.reducedCode ?? '').replace(/\./g,'').includes(qNorm) || a.name.toLowerCase().includes(q.toLowerCase())).slice(0, 12)
    : [];
  return (
    <div style={{ position: 'relative' }}>
      <label style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.3px', color: '#6B7280', display: 'block', marginBottom: 3 }}>{label}</label>
      <input style={{ height: 32, border: '0.5px solid #E5E7EB', borderRadius: 6, padding: '0 9px', fontSize: 12, width: '100%', boxSizing: 'border-box' as const }}
        value={open ? q : display} placeholder="Codigo ou nome..."
        onFocus={() => { setOpen(true); setQ(''); }}
        onBlur={() => setTimeout(() => setOpen(false), 250)}
        onChange={e => setQ(e.target.value)} />
      {value && !open && <button onClick={() => onChange('')} style={{ position: 'absolute', right: 6, top: 22, background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 13 }}>x</button>}
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 999, background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 6, width: '100%', maxHeight: 200, overflowY: 'auto' as const, boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}>
          {filtered.map(a => (
            <div key={a.id} onMouseDown={() => { onChange(a.id); setOpen(false); setQ(''); }}
              style={{ padding: '7px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '0.5px solid #F5F5F5' }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#F0F9FF'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = '#fff'}>
              <span style={{ fontWeight: 500, color: '#1D4ED8' }}>{a.reducedCode ?? a.code}</span>
              <span style={{ color: '#6B7280', marginLeft: 8 }}>{a.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Person { id: string; cpf: string; fullName: string; }
interface Config {
  id: string; personId: string; cargo: string; valorBruto: number;
  competenciaIni: string; competenciaFim?: string; ativo: boolean;
  documentoId?: string; person: Person;
  contaDespesaId?: string; contaPassivoId?: string;
  contaInssEmpId?: string; contaInssDir?: string;
  contaIrrfId?: string; contaInssRecolherId?: string; contaIrrfRecolherId?: string;
  calculos: any[];
}
interface Calculo {
  id: string; competencia: string; valorBruto: number;
  inssEmpresa: number; inssDiretor: number; baseIrrf: number;
  irrf: number; aliqIrrf: number; valorLiquido: number;
  journalEntryId?: string; config: { person: Person };
}
interface Previa {
  valorBruto: number; inssDiretor: number; inssEmpresa: number;
  baseIrrf: number; irrf: number; aliqIrrf: number; valorLiquido: number;
  abaixoMinimo: boolean; minimoLegal: number;
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const S = {
  page:  { padding: 24, background: '#F9FAFB', minHeight: '100vh' },
  card:  { background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: '16px 20px', marginBottom: 16 },
  badge: { display: 'inline-flex' as const, alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: '#ECFEFF', color: '#0891B2' },
  h1:    { fontSize: 18, fontWeight: 500, color: '#111' },
  secTit:{ fontSize: 11, fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '.3px', marginBottom: 12 },
  input: { height: 32, border: '0.5px solid #E5E7EB', borderRadius: 6, padding: '0 9px', fontSize: 12, width: '100%', boxSizing: 'border-box' as const },
  btn:   { height: 30, border: '0.5px solid #D1D5DB', borderRadius: 6, padding: '0 14px', fontSize: 12, cursor: 'pointer', background: '#fff', color: '#374151' },
  btnP:  { height: 30, border: 'none', borderRadius: 6, padding: '0 14px', fontSize: 12, cursor: 'pointer', background: '#111', color: '#fff' },
  th:    { background: '#F9FAFB', color: '#6B7280', fontSize: 10, textTransform: 'uppercase' as const, padding: '8px 12px', borderBottom: '0.5px solid #E5E7EB', textAlign: 'right' as const },
  thL:   { background: '#F9FAFB', color: '#6B7280', fontSize: 10, textTransform: 'uppercase' as const, padding: '8px 12px', borderBottom: '0.5px solid #E5E7EB', textAlign: 'left' as const },
  td:    { padding: '8px 12px', borderBottom: '0.5px solid #F5F5F5', fontSize: 12, color: '#374151', textAlign: 'right' as const },
  tdL:   { padding: '8px 12px', borderBottom: '0.5px solid #F5F5F5', fontSize: 12, color: '#374151', textAlign: 'left' as const },
};

// ── Modal Config ──────────────────────────────────────────────────────────────
function ConfigModal({ config, persons, accounts, onClose, onSaved }: {
  config?: Config; persons: Person[]; accounts: Account[]; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!config;
  const [form, setForm] = useState({
    personId:           config?.personId ?? '',
    cargo:              config?.cargo ?? 'Diretor',
    valorBruto:         String(config?.valorBruto ?? ''),
    competenciaIni:     config?.competenciaIni ?? '',
    competenciaFim:     config?.competenciaFim ?? '',
    documentoId:        config?.documentoId ?? '',
    contaDespesaId:     config?.contaDespesaId ?? '',
    contaPassivoId:     config?.contaPassivoId ?? '',
    contaInssEmpId:     config?.contaInssEmpId ?? '',
    contaInssDir:       config?.contaInssDir ?? '',
    contaIrrfId:        config?.contaIrrfId ?? '',
    contaInssRecolherId:config?.contaInssRecolherId ?? '',
    contaIrrfRecolherId:config?.contaIrrfRecolherId ?? '',
    ativo:              config?.ativo ?? true,
  });
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [docs, setDocs] = useState<{id:string;title:string;date:string}[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/documents', { params: { limit: 50, status: 'ASSINADO,REGISTRADO' } })
      .then(r => { const raw = r.data; setDocs(Array.isArray(raw) ? raw : raw?.items ?? raw?.data ?? []); })
      .catch(() => {});
  }, []);
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    const v = parseFloat(form.valorBruto);
    if (v >= 100) {
      api.get('/hr/pro-labore/previa', { params: { valorBruto: v } })
        .then(r => setPrevia(r.data)).catch(() => {});
    }
  }, [form.valorBruto]);

  const save = async () => {
    setSaving(true); setErr('');
    try {
      const dto = { ...form, valorBruto: parseFloat(form.valorBruto) || 0 };
      if (isEdit) await api.put('/hr/pro-labore/configs/' + config!.id, dto);
      else await api.post('/hr/pro-labore/configs', dto);
      onSaved();
    } catch (e: any) { setErr(e?.response?.data?.message ?? 'Erro ao salvar'); }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' as const }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>{isEdit ? 'Editar Configuração' : 'Nova Configuração de Pró-labore'}</span>
          <button style={{ ...S.btn, padding: '0 8px' }} onClick={onClose}>x</button>
        </div>
        {err && <div style={{ background: '#FEF2F2', border: '0.5px solid #FCA5A5', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#B91C1C', marginBottom: 12 }}>{err}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.3px', color: '#6B7280', display: 'block', marginBottom: 3 }}>Diretor / Sócio-administrador *</label>
            <select style={S.input} value={form.personId} onChange={e => set('personId', e.target.value)}>
              <option value="">Selecione...</option>
              {persons.map(p => <option key={p.id} value={p.id}>{p.fullName} — {fmtCPF(p.cpf)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.3px', color: '#6B7280', display: 'block', marginBottom: 3 }}>Cargo</label>
            <input style={S.input} value={form.cargo} onChange={e => set('cargo', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.3px', color: '#6B7280', display: 'block', marginBottom: 3 }}>Valor Bruto Mensal (R$) *</label>
            <input style={S.input} type="number" min={0} step={100} value={form.valorBruto} onChange={e => set('valorBruto', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.3px', color: '#6B7280', display: 'block', marginBottom: 3 }}>Competência Inicial (AAAA-MM) *</label>
            <input style={S.input} type="month" value={form.competenciaIni} onChange={e => set('competenciaIni', e.target.value)} disabled={isEdit} />
          </div>
          <div>
            <label style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.3px', color: '#6B7280', display: 'block', marginBottom: 3 }}>Competência Final (opcional)</label>
            <input style={S.input} type="month" value={form.competenciaFim} onChange={e => set('competenciaFim', e.target.value)} />
          </div>

          {previa && (
            <div style={{ gridColumn: '1/-1', background: previa.abaixoMinimo ? '#FEF2F2' : '#F0FDF4', border: `0.5px solid ${previa.abaixoMinimo ? '#FCA5A5' : '#86EFAC'}`, borderRadius: 8, padding: '10px 14px' }}>
              {previa.abaixoMinimo && <div style={{ fontSize: 12, color: '#B91C1C', fontWeight: 500, marginBottom: 6 }}>⚠️ Valor abaixo do mínimo legal (R$ {fmtBRL(previa.minimoLegal)})</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, fontSize: 12 }}>
                <div><div style={{ color: '#6B7280', fontSize: 10 }}>INSS Diretor (11%)</div><div style={{ fontWeight: 500, color: '#DC2626' }}>-R$ {fmtBRL(previa.inssDiretor)}</div></div>
                <div><div style={{ color: '#6B7280', fontSize: 10 }}>INSS Empresa (20%)</div><div style={{ fontWeight: 500, color: '#DC2626' }}>R$ {fmtBRL(previa.inssEmpresa)}</div></div>
                <div><div style={{ color: '#6B7280', fontSize: 10 }}>IRRF ({(previa.aliqIrrf * 100).toFixed(1)}%)</div><div style={{ fontWeight: 500, color: '#DC2626' }}>-R$ {fmtBRL(previa.irrf)}</div></div>
                <div><div style={{ color: '#6B7280', fontSize: 10 }}>Líquido</div><div style={{ fontWeight: 500, color: '#15803D' }}>R$ {fmtBRL(previa.valorLiquido)}</div></div>
              </div>
            </div>
          )}

          {/* Contas Contabeis */}
          <div style={{ gridColumn: '1/-1', borderTop: '0.5px solid #E5E7EB', paddingTop: 12, marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '.3px', marginBottom: 10 }}>Contas Contábeis</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <AccountPicker label="Despesa Pró-labore (D)" value={form.contaDespesaId} onChange={v => set('contaDespesaId', v)} accounts={accounts} />
              <AccountPicker label="Pró-labore a Pagar (C)" value={form.contaPassivoId} onChange={v => set('contaPassivoId', v)} accounts={accounts} />
              <AccountPicker label="Despesa INSS Patronal (D)" value={form.contaInssEmpId} onChange={v => set('contaInssEmpId', v)} accounts={accounts} />
              <AccountPicker label="INSS a Recolher (C)" value={form.contaInssRecolherId} onChange={v => set('contaInssRecolherId', v)} accounts={accounts} />
              <AccountPicker label="IRRF Retido (D)" value={form.contaIrrfId} onChange={v => set('contaIrrfId', v)} accounts={accounts} />
              <AccountPicker label="IRRF a Recolher (C)" value={form.contaIrrfRecolherId} onChange={v => set('contaIrrfRecolherId', v)} accounts={accounts} />
            </div>
          </div>

          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.3px', color: '#6B7280', display: 'block', marginBottom: 3 }}>Ata de Reunião vinculada</label>
            <select style={S.input} value={form.documentoId} onChange={e => set('documentoId', e.target.value)}>
              <option value="">— Nenhuma ata vinculada —</option>
              {docs.map(d => <option key={d.id} value={d.id}>{new Date(d.date).toLocaleDateString('pt-BR')} — {d.title}</option>)}
            </select>
          </div>
          {!form.documentoId && (
            <div style={{ gridColumn: '1/-1', background: '#FEFCE8', border: '0.5px solid #FEF08A', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#854D0E' }}>
              ⚠️ Nenhuma ata de reunião vinculada. O valor do pró-labore deve ser deliberado em reunião/assembleia.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={S.btn} onClick={onClose}>Cancelar</button>
          <button style={S.btnP} onClick={save} disabled={saving}>{saving ? 'Salvando...' : (isEdit ? 'Salvar alterações' : 'Criar configuração')}</button>
        </div>
      </div>
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────
export default function ProLaborePage() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [calculos, setCalculos] = useState<Calculo[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tab, setTab] = useState<'configs'|'calculos'>('configs');
  const [showModal, setShowModal] = useState(false);
  const [editConfig, setEditConfig] = useState<Config | null>(null);
  const [bulkComp, setBulkComp] = useState('');
  const [bulkCompFim, setBulkCompFim] = useState('');
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [jLoading, setJLoading] = useState(false);
  const [showRetro, setShowRetro] = useState(false);
  const [guiasCalculo, setGuiasCalculo] = useState<any>(null);
  const [guiasData, setGuiasData] = useState<any>(null);
  const [guiasLoading, setGuiasLoading] = useState(false);
  const [retroFrom, setRetroFrom] = useState('');
  const [retroTo, setRetroTo] = useState('');
  const [retroLoading, setRetroLoading] = useState(false);

  const loadJournalEntries = async () => {
    setJLoading(true);
    try {
      const r = await api.get('/accounting/journal', { params: { search: 'Pro-labore', sources: 'HR', limit: 100 } });
      const raw = r.data;
      const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.entries) ? raw.entries : [];
      setJournalEntries(arr);
    } catch { setJournalEntries([]); }
    setJLoading(false);
  };
  const [bulkJournal, setBulkJournal] = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const [cfgR, calcR, pR, accR] = await Promise.all([
        api.get('/hr/pro-labore/configs'),
        api.get('/hr/pro-labore/calculos'),
        api.get('/persons'),
        api.get('/chart-of-accounts', { params: { limit: 500 } }),
      ]);
      setConfigs(cfgR.data ?? []);
      setCalculos(calcR.data ?? []);
      const pRaw = pR.data; setPersons(Array.isArray(pRaw) ? pRaw : pRaw?.data ?? pRaw?.items ?? []);
      const aRaw = accR.data; setAccounts(Array.isArray(aRaw) ? aRaw : aRaw?.items ?? aRaw?.data ?? []);
    } catch { setMsg('Erro ao carregar dados'); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'calculos') loadJournalEntries(); }, [tab]);

  const gerarEmLote = async () => {
    if (!bulkComp) { alert('Informe a competência'); return; }
    setBulkLoading(true);
    try {
      const results = [];
      for (const cfg of configs.filter(c => c.ativo)) {
        try {
          const r = await api.post('/hr/pro-labore/calculos', { configId: cfg.id, competencia: bulkComp, gerarLancamento: bulkJournal });
          results.push({ nome: cfg.person.fullName, ok: true, liquido: r.data.calculo.valorLiquido });
        } catch (e: any) { results.push({ nome: cfg.person.fullName, ok: false, err: e?.response?.data?.message }); }
      }
      const ok = results.filter(r => r.ok).length;
      const fail = results.filter(r => !r.ok).length;
      alert(`${ok} calculado(s) com sucesso${fail ? ` · ${fail} erro(s)` : ''}.`);
      load();
    } catch { alert('Erro ao gerar'); }
    setBulkLoading(false);
  };

  const tabStyle = (t: string) => ({ height: 30, border: `0.5px solid ${tab===t?'#111':'#D1D5DB'}`, borderRadius: 6, padding: '0 14px', fontSize: 12, cursor: 'pointer', background: tab===t?'#111':'#fff', color: tab===t?'#fff':'#374151' });

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={S.badge}>◆ RH</span>
        <span style={S.h1}>Pró-labore de Diretoria</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button style={tabStyle('configs')} onClick={() => setTab('configs')}>Configurações</button>
          <button style={tabStyle('calculos')} onClick={() => setTab('calculos')}>Cálculos</button>
        </div>
      </div>

      {msg && <div style={{ background: '#FEF2F2', border: '0.5px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#B91C1C', marginBottom: 16 }}>{msg}</div>}

      {tab === 'configs' && (
        <>
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ ...S.secTit, margin: 0 }}>Diretores configurados</p>
              <button style={S.btnP} onClick={() => { setEditConfig(null); setShowModal(true); }}>+ Nova configuração</button>
            </div>
            {configs.length === 0 ? (
              <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Nenhuma configuração cadastrada.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={S.thL}>Diretor</th>
                  <th style={S.thL}>Cargo</th>
                  <th style={S.th}>Bruto</th>
                  <th style={S.th}>INSS Dir.</th>
                  <th style={S.th}>IRRF</th>
                  <th style={S.th}>Líquido</th>
                  <th style={S.thL}>Vigência</th>
                  <th style={S.thL}>Ata</th>
                  <th style={S.th}>Status</th>
                  <th style={S.th}></th>
                </tr></thead>
                <tbody>
                  {configs.map(cfg => {
                    const bruto = Number(cfg.valorBruto);
                    const inssDir = Math.min(bruto, 8157.41) * 0.11;
                    const baseIrrf = bruto - inssDir;
                    const irpf = [
                      { ate: 2428.80, aliq: 0, ded: 0 },
                      { ate: 2826.65, aliq: 0.075, ded: 182.16 },
                      { ate: 3751.05, aliq: 0.15, ded: 394.16 },
                      { ate: 4664.68, aliq: 0.225, ded: 675.49 },
                      { ate: Infinity, aliq: 0.275, ded: 908.73 },
                    ];
                    const faixa = irpf.find(f => baseIrrf <= f.ate)!;
                    const irrf = Math.max(0, baseIrrf * faixa.aliq - faixa.ded);
                    const liq = bruto - inssDir - irrf;
                    return (
                      <tr key={cfg.id}>
                        <td style={S.tdL}><div style={{ fontWeight: 500 }}>{cfg.person.fullName}</div><div style={{ fontSize: 10, color: '#9CA3AF' }}>{fmtCPF(cfg.person.cpf)}</div></td>
                        <td style={S.tdL}>{cfg.cargo}</td>
                        <td style={S.td}>R$ {fmtBRL(bruto)}</td>
                        <td style={{ ...S.td, color: '#DC2626' }}>R$ {fmtBRL(inssDir)}</td>
                        <td style={{ ...S.td, color: '#DC2626' }}>R$ {fmtBRL(irrf)}</td>
                        <td style={{ ...S.td, color: '#15803D', fontWeight: 500 }}>R$ {fmtBRL(liq)}</td>
                        <td style={S.tdL}>{cfg.competenciaIni}{cfg.competenciaFim ? ` → ${cfg.competenciaFim}` : ' →'}</td>
                        <td style={S.tdL}>{cfg.documentoId ? <span style={{ color: '#15803D' }}>✓ Vinculada</span> : <span style={{ color: '#B45309' }}>⚠️ Pendente</span>}</td>
                        <td style={S.td}><span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: cfg.ativo ? '#F0FDF4' : '#F9FAFB', color: cfg.ativo ? '#15803D' : '#6B7280' }}>{cfg.ativo ? 'Ativo' : 'Inativo'}</span></td>
                        <td style={S.td}><button style={{ ...S.btn, fontSize: 11 }} onClick={() => { setEditConfig(cfg); setShowModal(true); }}>Editar</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'calculos' && (
        <>
          <div style={S.card}>
            <p style={{ ...S.secTit, margin: 0, marginBottom: 12 }}>Gerar cálculo mensal em lote</p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' as const }}>
              <div>
                <label style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.3px', color: '#6B7280', display: 'block', marginBottom: 3 }}>Competência inicial</label>
                <input style={{ ...S.input, width: 160 }} type="month" value={bulkComp} onChange={e => setBulkComp(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.3px', color: '#6B7280', display: 'block', marginBottom: 3 }}>Competência final</label>
                <input style={{ ...S.input, width: 160 }} type="month" value={bulkCompFim} onChange={e => setBulkCompFim(e.target.value)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
                <input type="checkbox" id="bulkJ" checked={bulkJournal} onChange={e => setBulkJournal(e.target.checked)} />
                <label htmlFor="bulkJ" style={{ fontSize: 13, cursor: 'pointer' }}>Gerar lançamento contábil</label>
              </div>
              <button style={S.btnP} onClick={gerarEmLote} disabled={bulkLoading}>{bulkLoading ? 'Calculando...' : 'Calcular e lançar'}</button>
              <button style={{ ...S.btn, background: '#1a1a6e', color: '#fff', border: 'none' }} onClick={async () => {
                if (!bulkComp) { alert('Informe a competência inicial'); return; }
                try {
                  const r = await api.get('/hr/pro-labore/guias/lote', { params: { competencia: bulkComp }, responseType: 'blob' });
                  const url = URL.createObjectURL(r.data);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'Guias-' + bulkComp + '.pdf';
                  a.click(); URL.revokeObjectURL(url);
                } catch { alert('Erro ao gerar guias em lote'); }
              }}>GPS/DARF Lote</button>
            </div>
          </div>

          <div style={S.card}>
            <p style={{ ...S.secTit, margin: 0, marginBottom: 12 }}>Histórico de cálculos</p>
            {calculos.length === 0 ? (
              <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Nenhum cálculo registrado.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={S.thL}>Competência</th>
                  <th style={S.thL}>Diretor</th>
                  <th style={S.th}>Bruto</th>
                  <th style={S.th}>INSS Emp.</th>
                  <th style={S.th}>INSS Dir.</th>
                  <th style={S.th}>IRRF</th>
                  <th style={S.th}>Líquido</th>
                  <th style={S.th}>Lançamento</th>
                  <th style={S.th}>Guias</th>
                </tr></thead>
                <tbody>
                  {calculos.map(c => (
                    <tr key={c.id}>
                      <td style={{ ...S.tdL, fontWeight: 500 }}>{c.competencia}</td>
                      <td style={S.tdL}>{c.config?.person?.fullName}</td>
                      <td style={S.td}>R$ {fmtBRL(c.valorBruto)}</td>
                      <td style={{ ...S.td, color: '#DC2626' }}>R$ {fmtBRL(c.inssEmpresa)}</td>
                      <td style={{ ...S.td, color: '#DC2626' }}>R$ {fmtBRL(c.inssDiretor)}</td>
                      <td style={{ ...S.td, color: '#DC2626' }}>R$ {fmtBRL(c.irrf)}</td>
                      <td style={{ ...S.td, color: '#15803D', fontWeight: 500 }}>R$ {fmtBRL(c.valorLiquido)}</td>
                      <td style={S.td}>{c.journalEntryId ? <span style={{ color: '#15803D' }}>✓</span> : <span style={{ color: '#9CA3AF' }}>—</span>}</td>
                      <td style={S.td}>
                        <button style={{ ...S.btn, fontSize: 11 }} onClick={async () => {
                          setGuiasLoading(true); setGuiasCalculo(c);
                          try { const r = await api.get('/hr/pro-labore/calculos/' + c.id + '/guias'); setGuiasData(r.data); }
                          catch { alert('Erro ao carregar guias'); }
                          setGuiasLoading(false);
                        }}>GPS/DARF</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ ...S.secTit, margin: 0 }}>Lancamentos contabeis gerados</p>
              <button style={S.btn} onClick={loadJournalEntries} disabled={jLoading}>{jLoading ? '...' : 'Atualizar'}</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button style={{ ...S.btn, background: '#374151', color: '#fff', border: 'none' }} onClick={() => setShowRetro(true)}>Gerar retroativos</button>
              <button style={S.btn} onClick={loadJournalEntries} disabled={jLoading}>{jLoading ? '...' : 'Atualizar'}</button>
            </div>
            {journalEntries.length === 0
              ? <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Nenhum lancamento encontrado.</p>
              : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={S.thL}>Data</th>
                    <th style={S.thL}>Descricao</th>
                    <th style={S.th}>Debitos</th>
                    <th style={S.th}>Creditos</th>
                  </tr></thead>
                  <tbody>
                    {journalEntries.map((je: any) => {
                      const deb = (je.items ?? []).filter((i: any) => i.type === 'DEBIT').reduce((s: number, i: any) => s + parseFloat(i.value), 0);
                      const cred = (je.items ?? []).filter((i: any) => i.type === 'CREDIT').reduce((s: number, i: any) => s + parseFloat(i.value), 0);
                      return (
                        <tr key={je.id}>
                          <td style={S.tdL}>{new Date(je.date).toLocaleDateString('pt-BR')}</td>
                          <td style={{ ...S.tdL, maxWidth: 300, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>{je.description}</td>
                          <td style={S.td}>R$ {fmtBRL(deb)}</td>
                          <td style={S.td}>R$ {fmtBRL(cred)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
            }
          </div>
        </>
      )}


      {guiasData && guiasCalculo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => e.target === e.currentTarget && setGuiasData(null)}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 780, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 500 }}>Guias de Recolhimento - {guiasCalculo.competencia}</span>
              <button style={{ ...S.btn, padding: "0 8px" }} onClick={() => setGuiasData(null)}>x</button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#1a1a6e" }}>GPS - Guia da Previdencia Social</span>
                <button style={{ ...S.btnP, fontSize: 12 }} onClick={async () => {
                  const r = await api.get('/hr/pro-labore/calculos/' + guiasCalculo.id + '/guias/gps.pdf', { responseType: 'blob' });
                  const url = URL.createObjectURL(r.data);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'GPS-' + guiasCalculo.competencia + '.pdf';
                  a.click(); URL.revokeObjectURL(url);
                }}>Download GPS PDF</button>
              </div>
              <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)" }}>
                  <div style={{ padding: "10px 14px", borderRight: "1px solid #E5E7EB", borderBottom: "1px solid #E5E7EB" }}>
                    <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase" }}>CPF</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{guiasData.dados.cpf}</div>
                  </div>
                  <div style={{ padding: "10px 14px", borderRight: "1px solid #E5E7EB", borderBottom: "1px solid #E5E7EB" }}>
                    <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase" }}>Nome</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{guiasData.dados.nome}</div>
                  </div>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid #E5E7EB" }}>
                    <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase" }}>Competencia</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{guiasData.dados.competencia}</div>
                  </div>
                  <div style={{ padding: "10px 14px", borderRight: "1px solid #E5E7EB" }}>
                    <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase" }}>INSS Diretor 11%</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#DC2626" }}>R$ {fmtBRL(guiasData.dados.inssDiretor)}</div>
                  </div>
                  <div style={{ padding: "10px 14px", borderRight: "1px solid #E5E7EB" }}>
                    <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase" }}>INSS Patronal 20%</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#DC2626" }}>R$ {fmtBRL(guiasData.dados.inssEmpresa)}</div>
                  </div>
                  <div style={{ padding: "10px 14px", background: "#F0F9FF" }}>
                    <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase" }}>Total GPS</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a6e" }}>R$ {fmtBRL(guiasData.dados.totalGPS)}</div>
                  </div>
                </div>
                <div style={{ padding: "8px 14px", background: "#F9FAFB", fontSize: 11, color: "#6B7280" }}>
                  Vencimento: <strong>{guiasData.dados.vencimento}</strong> - Codigo: <strong>1007</strong> - Contribuinte Individual
                </div>
              </div>
            </div>
            {guiasData.dados.irrf > 0 ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#006633" }}>DARF - IRRF Codigo 0561</span>
                  <button style={{ ...S.btnP, background: "#006633", fontSize: 12 }} onClick={async () => {
                    const r = await api.get('/hr/pro-labore/calculos/' + guiasCalculo.id + '/guias/darf.pdf', { responseType: 'blob' });
                    const url = URL.createObjectURL(r.data);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'DARF-' + guiasCalculo.competencia + '.pdf';
                    a.click(); URL.revokeObjectURL(url);
                  }}>Download DARF PDF</button>
                </div>
                <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)" }}>
                    <div style={{ padding: "10px 14px", borderRight: "1px solid #E5E7EB", borderBottom: "1px solid #E5E7EB" }}>
                      <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase" }}>CNPJ</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{guiasData.dados.cnpj}</div>
                    </div>
                    <div style={{ padding: "10px 14px", borderRight: "1px solid #E5E7EB", borderBottom: "1px solid #E5E7EB" }}>
                      <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase" }}>Codigo Receita</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>0561 - Rendimentos do Trabalho</div>
                    </div>
                    <div style={{ padding: "10px 14px", borderBottom: "1px solid #E5E7EB" }}>
                      <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase" }}>Periodo</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{guiasData.dados.competencia}</div>
                    </div>
                    <div style={{ padding: "10px 14px", gridColumn: "1/3", borderRight: "1px solid #E5E7EB" }}>
                      <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase" }}>Beneficiario</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{guiasData.dados.nome} - {guiasData.dados.cpf}</div>
                    </div>
                    <div style={{ padding: "10px 14px", background: "#F0FDF4" }}>
                      <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase" }}>Valor IRRF</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#006633" }}>R$ {fmtBRL(guiasData.dados.irrf)}</div>
                    </div>
                  </div>
                  <div style={{ padding: "8px 14px", background: "#F9FAFB", fontSize: 11, color: "#6B7280" }}>
                    Vencimento: <strong>{guiasData.dados.vencimentoDARF}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background: "#F0FDF4", border: "0.5px solid #86EFAC", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#15803D" }}>
                IRRF = R$ 0,00 - Nao ha DARF a recolher.
              </div>
            )}
          </div>
        </div>
      )}

      {showRetro && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowRetro(false)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 15, fontWeight: 500 }}>Gerar Lancamentos Retroativos</span>
              <button style={{ ...S.btn, padding: '0 8px' }} onClick={() => setShowRetro(false)}>x</button>
            </div>
            <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
              Gera lancamentos contabeis para calculos ja realizados que ainda nao possuem lancamento. Deixe em branco para processar todos os periodos.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.3px', color: '#6B7280', display: 'block', marginBottom: 3 }}>Competencia inicial</label>
                <input style={S.input} type='month' value={retroFrom} onChange={e => setRetroFrom(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.3px', color: '#6B7280', display: 'block', marginBottom: 3 }}>Competencia final</label>
                <input style={S.input} type='month' value={retroTo} onChange={e => setRetroTo(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={S.btn} onClick={() => setShowRetro(false)}>Cancelar</button>
              <button style={{ ...S.btnP, background: '#374151' }} disabled={retroLoading} onClick={async () => {
                setRetroLoading(true);
                try {
                  const r = await api.post('/hr/pro-labore/calculos/retroativos', {
                    competenceFrom: retroFrom || undefined,
                    competenceTo:   retroTo   || undefined,
                  });
                  const ok = r.data.results.filter((x: any) => x.success).length;
                  alert(r.data.total + ' encontrado(s) · ' + ok + ' lancamento(s) gerado(s).');
                  setShowRetro(false); loadJournalEntries();
                } catch (e: any) { alert('Erro: ' + (e?.response?.data?.message ?? e.message)); }
                setRetroLoading(false);
              }}>{retroLoading ? 'Processando...' : 'Gerar lancamentos'}</button>
            </div>
          </div>
        </div>
      )}

      {(showModal || editConfig) && (
        <ConfigModal
          config={editConfig ?? undefined}
          persons={persons}
          accounts={accounts}
          onClose={() => { setShowModal(false); setEditConfig(null); }}
          onSaved={() => { setShowModal(false); setEditConfig(null); load(); }}
        />
      )}
    </div>
  );
}