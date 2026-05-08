// ============================================================
// LEDGR — frontend/src/pages/finance/BankImportPage.tsx
// Design: Clean Minimalista · Accent Azul céu #0369A1
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';

interface Account { id: string; code: string; name: string; reducedCode?: string; }
function AccountPicker({ label, value, onChange, accounts, placeholder }: {
  label: string; value: string; onChange: (id: string) => void; accounts: Account[]; placeholder?: string;
}) {
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const safe = Array.isArray(accounts) ? accounts : [];
  const selected = safe.find(a => a.id === value);
  const display = selected ? (selected.reducedCode ?? selected.code) + ' — ' + selected.name : '';
  const qNorm = q.replace(/\./g, '');
  const filtered = qNorm.length >= 1
    ? safe.filter(a => a.code.replace(/\./g,'').includes(qNorm) || a.name.toLowerCase().includes(q.toLowerCase())).slice(0, 12)
    : [];
  return (
    <div style={{ position: 'relative' }}>
      {label && <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 3, fontWeight: 500 }}>{label}</div>}
      <input style={{ width: '100%', boxSizing: 'border-box' as const, border: `0.5px solid ${value ? '#86EFAC' : '#E5E7EB'}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, outline: 'none', background: '#fff' }}
        value={open ? q : display} placeholder={placeholder ?? 'Cód. ou nome...'}
        onFocus={() => { setOpen(true); setQ(''); }}
        onBlur={() => setTimeout(() => setOpen(false), 250)}
        onChange={e => setQ(e.target.value)} />
      {value && !open && <button onClick={() => onChange('')} style={{ position: 'absolute', right: 6, top: label ? 24 : 6, background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 12 }}>x</button>}
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
import { useBankImport } from './hooks/useBankImport';
import {
  TransactionGroup, BankStatementSummary, UploadResult,
  BANK_NAME, BANK_COLOR, SUGGESTION_SOURCE_LABEL,
} from './types/bank-import';

// ── Design tokens (igual ao FinancePage) ─────────────────────
const T = {
  accent: '#0369A1',
  accentSurf: '#F0F9FF',
  accentText: '#075985',
  border: '#E5E7EB',
  surface: '#F9FAFB',
  text: '#111111',
  textMuted: '#6B7280',
  textHint: '#9CA3AF',
  success: '#15803D',
  successSurf: '#F0FDF4',
  danger: '#B91C1C',
  dangerSurf: '#FEF2F2',
  warning: '#854D0E',
  warnSurf: '#FEFCE8',
};

// ── Helpers ───────────────────────────────────────────────────
function fmtBRL(v: string | number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}
function getActiveCompany(): { id: string; name: string; taxId?: string } | null {
  try {
    const raw = localStorage.getItem('@ledgr:activeCompany');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ── Componentes locais ────────────────────────────────────────
function Pill({ label, type }: { label: string; type: 'success' | 'danger' | 'warning' | 'info' | 'neutral' }) {
  const map = {
    success: { bg: T.successSurf, color: T.success },
    danger: { bg: T.dangerSurf, color: T.danger },
    warning: { bg: T.warnSurf, color: T.warning },
    info: { bg: T.accentSurf, color: T.accentText },
    neutral: { bg: T.surface, color: T.textMuted },
  };
  const s = map[type];
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 9px', borderRadius: 20,
      background: s.bg, color: s.color, border: `0.5px solid ${T.border}`,
      display: 'inline-block',
    }}>{label}</span>
  );
}

function SuggestionBadge({ source, confidence }: { source: string; confidence: number }) {
  const map: Record<string, { bg: string; color: string }> = {
    LEARNED: { bg: '#EFF6FF', color: '#1D4ED8' },
    FUZZY: { bg: T.warnSurf, color: T.warning },
    FIXED: { bg: T.successSurf, color: T.success },
  };
  const s = map[source] ?? { bg: T.surface, color: T.textHint };
  return (
    <span style={{
      fontSize: 9, fontWeight: 600, padding: '1px 7px', borderRadius: 20,
      background: s.bg, color: s.color,
    }}>
      {SUGGESTION_SOURCE_LABEL[source as keyof typeof SUGGESTION_SOURCE_LABEL]} {confidence}%
    </span>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: '#fff', border: `0.5px solid ${T.border}`,
      borderRadius: 10, padding: '12px 16px', flex: 1,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: T.textHint, textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 500, color: color ?? T.text }}>
        {value}
      </div>
    </div>
  );
}

// ── Steps ─────────────────────────────────────────────────────
type Step = 'list' | 'upload' | 'confirm-upload' | 'classify' | 'done';

export default function BankImportPage() {
  const { listStatements, uploadFile, getGroups, classifyGroup, postStatement, loading, error } =
    useBankImport();

  const [step, setStep] = useState<Step>('list');
  const [statements, setStatements] = useState<BankStatementSummary[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadRes, setUploadRes] = useState<UploadResult | null>(null);
  const [groups, setGroups] = useState<TransactionGroup[]>([]);
  const [drafts, setDrafts] = useState<Record<string, {
    accountId: string; counterAccountId: string; memo: string;
  }>>({});
  const [postResult, setPostResult] = useState<any>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeCompany = getActiveCompany();

  const loadStatements = () => listStatements().then(setStatements).catch(() => { });
  useEffect(() => { if (step === 'list') loadStatements(); }, [step]);
  useEffect(() => {
    api.get('/chart-of-accounts', { params: { limit: 500 } })
      .then(r => { const raw = r.data; setAccounts(Array.isArray(raw) ? raw : raw?.items ?? []); })
      .catch(() => {});
  }, []);

  const initGroups = (grps: TransactionGroup[]) => {
    const init: typeof drafts = {};
    grps.forEach(g => {
      init[g.groupKey] = {
        accountId: g.suggestedAccountId ?? '',
        counterAccountId: '',
        memo: g.memo ?? g.description,
      };
    });
    setDrafts(init);
    setGroups(grps);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setStep('confirm-upload');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleConfirmUpload = async () => {
    if (!pendingFile) return;
    try {
      const res = await uploadFile(pendingFile);
      setUploadRes(res);
      const grps = await getGroups(res.statementId);
      initGroups(grps);
      setStep('classify');
    } catch { }
  };

  const updateDraft = (groupKey: string, field: string, val: string) =>
    setDrafts(d => ({ ...d, [groupKey]: { ...d[groupKey], [field]: val } }));

  const handlePost = async () => {
    if (!uploadRes) return;
    const groupsPayload = groups.map(g => ({
      groupKey: g.groupKey,
      accountId: drafts[g.groupKey]?.accountId ?? '',
      counterAccountId: drafts[g.groupKey]?.counterAccountId ?? '',
      memo: drafts[g.groupKey]?.memo ?? g.description,
    }));
    try {
      const res = await postStatement(uploadRes.statementId, groupsPayload);
      setPostResult(res);
      setStep('done');
    } catch { }
  };

  const resetToList = () => {
    setStep('list'); setUploadRes(null); setGroups([]);
    setDrafts({}); setPostResult(null); setPendingFile(null);
  };

  const totalClassified = groups.filter(g =>
    drafts[g.groupKey]?.accountId && drafts[g.groupKey]?.counterAccountId
  ).length;
  const canPost = totalClassified === groups.length && groups.length > 0;

  return (
    <div style={{ fontFamily: 'system-ui, Arial, sans-serif', maxWidth: 1060, margin: '0 auto', padding: '24px 20px' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
              background: T.accentSurf, color: T.accentText, border: `0.5px solid #BAE6FD`,
            }}>◆ Financeiro</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 500, color: T.text }}>
            Importação de Extrato Bancário
          </div>
          <div style={{ fontSize: 12, color: T.textHint, marginTop: 3 }}>
            Itaú · Bradesco · Banco do Brasil · Santander · OFX · CSV
          </div>
        </div>
        {step === 'list' && (
          <button onClick={() => setStep('upload')} style={{
            background: T.accent, color: '#fff', border: 'none',
            borderRadius: 8, padding: '9px 18px',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>+ Importar Extrato</button>
        )}
      </div>

      {/* ── Erro global ────────────────────────────────────── */}
      {error && (
        <div style={{
          background: T.dangerSurf, color: T.danger,
          border: `0.5px solid #FECACA`,
          borderRadius: 10, padding: '10px 14px',
          fontSize: 13, marginBottom: 16,
        }}>⚠ {error}</div>
      )}

      {/* ══ LIST ══════════════════════════════════════════════ */}
      {step === 'list' && (
        <div>
          {loading && (
            <div style={{ textAlign: 'center', padding: 48, color: T.textHint, fontSize: 13 }}>
              Carregando...
            </div>
          )}
          {!loading && statements.length === 0 && (
            <div style={{
              background: '#fff', border: `0.5px solid ${T.border}`,
              borderRadius: 12, padding: '64px 40px', textAlign: 'center',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: T.accentSurf, margin: '0 auto 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24,
              }}>🏦</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: T.text, marginBottom: 6 }}>
                Nenhum extrato importado ainda
              </div>
              <div style={{ fontSize: 13, color: T.textHint, marginBottom: 20 }}>
                Importe extratos do Itaú, Bradesco, Banco do Brasil, OFX ou CSV
              </div>
              <button onClick={() => setStep('upload')} style={{
                background: T.accent, color: '#fff', border: 'none',
                borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}>Importar primeiro extrato</button>
            </div>
          )}
          {!loading && statements.length > 0 && (
            <div style={{ background: '#fff', border: `0.5px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: T.surface }}>
                    {['Banco', 'Agência / Conta', 'Período', 'Lançamentos', 'Débitos', 'Créditos', 'Importado', ''].map(h => (
                      <th key={h} style={{
                        padding: '10px 14px', textAlign: 'left',
                        fontSize: 11, fontWeight: 600, color: T.textHint,
                        textTransform: 'uppercase', letterSpacing: '.3px',
                        borderBottom: `0.5px solid ${T.border}`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statements.map(s => (
                    <tr key={s.id} style={{ borderBottom: `0.5px solid ${T.surface}` }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = T.surface}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = '#fff'}
                    >
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: BANK_COLOR[s.bankCode], flexShrink: 0 }} />
                          <span style={{ color: T.text }}>{BANK_NAME[s.bankCode]}</span>
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: T.textMuted }}>
                        {s.agency ? `Ag. ${s.agency} · ` : ''}{s.account ? `CC ${s.account}` : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: T.textMuted }}>
                        {fmtDate(s.periodFrom)} → {fmtDate(s.periodTo)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: T.text }}>{s._count.transactions}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: T.danger }}>{fmtBRL(s.totalDebits)}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: T.success }}>{fmtBRL(s.totalCredits)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: T.textHint }}>{fmtDate(s.createdAt)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <button onClick={async () => {
                          const grps = await getGroups(s.id);
                          setUploadRes({ statementId: s.id, bankName: s.bankName, bankCode: s.bankCode, totalLines: s.totalLines, totalDebits: Number(s.totalDebits), totalCredits: Number(s.totalCredits), periodFrom: s.periodFrom, periodTo: s.periodTo });
                          initGroups(grps);
                          setStep('classify');
                        }} style={{
                          fontSize: 12, padding: '5px 12px',
                          border: `0.5px solid ${T.border}`, borderRadius: 6,
                          color: T.accent, background: '#fff', cursor: 'pointer',
                          fontWeight: 500,
                        }}>Abrir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ UPLOAD ════════════════════════════════════════════ */}
      {step === 'upload' && (
        <div>
          <input ref={fileRef} type="file" accept=".xls,.xlsx,.ofx,.ofc,.csv"
            style={{ display: 'none' }} onChange={handleFileChange} />

          {/* Empresa ativa */}
          <div style={{
            background: T.accentSurf, border: `0.5px solid #BAE6FD`,
            borderRadius: 10, padding: '10px 16px', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
          }}>
            <span style={{ fontSize: 15 }}>🏢</span>
            <span style={{ color: T.accentText }}>
              Importando para: <strong>{activeCompany?.name ?? '—'}</strong>
              {activeCompany?.taxId && <span style={{ color: T.textHint, fontSize: 12, marginLeft: 6 }}>{activeCompany.taxId}</span>}
            </span>
          </div>

          {/* Drop zone */}
          <div
            onClick={() => !loading && fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = T.accent; (e.currentTarget as HTMLDivElement).style.background = T.accentSurf; }}
            onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.border; (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}
            onDrop={e => {
              e.preventDefault();
              (e.currentTarget as HTMLDivElement).style.borderColor = T.border;
              (e.currentTarget as HTMLDivElement).style.background = '#fff';
              const file = e.dataTransfer.files[0];
              if (!file) return;
              setPendingFile(file);
              setStep('confirm-upload');
            }}
            style={{
              border: `1.5px dashed ${T.border}`, borderRadius: 12,
              padding: '56px 40px', textAlign: 'center',
              cursor: loading ? 'wait' : 'pointer',
              background: '#fff', transition: 'all .15s',
            }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: T.text, marginBottom: 5 }}>
              {loading ? 'Processando...' : 'Clique ou arraste o arquivo aqui'}
            </div>
            <div style={{ fontSize: 12, color: T.textHint }}>
              Itaú XLS · Bradesco XLS · Banco do Brasil XLS · OFX · CSV
            </div>
          </div>

          <button onClick={() => setStep('list')} style={{
            marginTop: 12, background: 'transparent',
            border: `0.5px solid ${T.border}`, borderRadius: 8,
            padding: '7px 16px', fontSize: 12, color: T.textMuted, cursor: 'pointer',
          }}>Cancelar</button>
        </div>
      )}

      {/* ══ CONFIRM UPLOAD ════════════════════════════════════ */}
      {step === 'confirm-upload' && pendingFile && (
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{
            background: '#fff', border: `0.5px solid ${T.border}`,
            borderRadius: 14, overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              background: '#FFFBEB', borderBottom: `0.5px solid #FDE68A`,
              padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#78350F' }}>Confirme antes de importar</div>
                <div style={{ fontSize: 12, color: '#92400E', marginTop: 1 }}>Verifique empresa e arquivo</div>
              </div>
            </div>

            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Empresa */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.textHint, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Empresa destino</div>
                <div style={{
                  background: T.successSurf, border: `0.5px solid #BBF7D0`,
                  borderRadius: 10, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 18 }}>🏢</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#14532D' }}>{activeCompany?.name ?? '—'}</div>
                    {activeCompany?.taxId && <div style={{ fontSize: 12, color: T.success, marginTop: 1 }}>CNPJ: {activeCompany.taxId}</div>}
                  </div>
                  <span style={{ marginLeft: 'auto', color: T.success, fontSize: 16 }}>✓</span>
                </div>
              </div>

              {/* Arquivo */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.textHint, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Arquivo selecionado</div>
                <div style={{
                  background: T.surface, border: `0.5px solid ${T.border}`,
                  borderRadius: 10, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 18 }}>📄</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{pendingFile.name}</div>
                    <div style={{ fontSize: 11, color: T.textHint, marginTop: 1 }}>
                      {(pendingFile.size / 1024).toFixed(1)} KB · {pendingFile.name.split('.').pop()?.toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Aviso */}
              <div style={{
                background: '#FFF7ED', border: `0.5px solid #FED7AA`,
                borderRadius: 10, padding: '10px 14px',
                fontSize: 12, color: '#7C2D12',
                display: 'flex', gap: 8,
              }}>
                <span style={{ flexShrink: 0 }}>💡</span>
                <span>Se a empresa estiver errada, cancele e troque no seletor do topo antes de importar.</span>
              </div>
            </div>

            {/* Ações */}
            <div style={{
              padding: '12px 20px', borderTop: `0.5px solid ${T.border}`,
              display: 'flex', justifyContent: 'space-between', background: T.surface,
            }}>
              <button onClick={() => { setPendingFile(null); setStep('upload'); }} style={{
                background: '#fff', border: `0.5px solid ${T.border}`,
                borderRadius: 8, padding: '8px 16px', fontSize: 13, color: T.textMuted, cursor: 'pointer',
              }}>← Cancelar</button>
              <button onClick={handleConfirmUpload} disabled={loading} style={{
                background: loading ? T.textHint : T.accent,
                color: '#fff', border: 'none', borderRadius: 8,
                padding: '9px 22px', fontSize: 13, fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}>
                {loading ? 'Processando...' : '✓ Confirmar e Importar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ CLASSIFY ══════════════════════════════════════════ */}
      {step === 'classify' && uploadRes && (
        <div>
          {/* Banner empresa + banco */}
          <div style={{
            background: T.accentSurf, border: `0.5px solid #BAE6FD`,
            borderRadius: 10, padding: '10px 16px', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 12, fontSize: 13,
            flexWrap: 'wrap',
          }}>
            <span style={{ color: T.accentText, fontWeight: 500 }}>{activeCompany?.name}</span>
            {activeCompany?.taxId && <span style={{ color: T.textHint, fontSize: 12 }}>{activeCompany.taxId}</span>}
            <span style={{ color: T.border }}>|</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: BANK_COLOR[uploadRes.bankCode] }} />
              <span style={{ fontWeight: 500, color: T.text }}>{BANK_NAME[uploadRes.bankCode]}</span>
            </span>
            {(uploadRes as any).agency && <><span style={{ color: T.border }}>·</span><span style={{ fontFamily: 'monospace', fontSize: 12, color: T.textMuted }}>Ag. {(uploadRes as any).agency}</span></>}
            {(uploadRes as any).account && <><span style={{ color: T.border }}>·</span><span style={{ fontFamily: 'monospace', fontSize: 12, color: T.textMuted }}>CC {(uploadRes as any).account}</span></>}
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8, marginBottom: 14 }}>
            <KpiCard label="Período" value={`${fmtDate(uploadRes.periodFrom)} → ${fmtDate(uploadRes.periodTo)}`} />
            <KpiCard label="Lançamentos" value={String(uploadRes.totalLines)} />
            <KpiCard label="Débitos" value={fmtBRL(uploadRes.totalDebits)} color={T.danger} />
            <KpiCard label="Créditos" value={fmtBRL(uploadRes.totalCredits)} color={T.success} />
            <KpiCard label="Grupos" value={String(groups.length)} />
            <KpiCard label="Classificados" value={`${totalClassified}/${groups.length}`} color={canPost ? T.success : T.text} />
          </div>

          {/* Progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 3, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', background: T.accent, borderRadius: 2,
                width: `${groups.length > 0 ? (totalClassified / groups.length) * 100 : 0}%`,
                transition: 'width .3s',
              }} />
            </div>
            <span style={{ fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap' }}>
              {totalClassified} / {groups.length} grupos
            </span>
            {canPost && <span style={{ fontSize: 12, color: T.success, fontWeight: 500 }}>✓ pronto</span>}
          </div>

          {/* Grupos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {groups.map(g => {
              const draft = drafts[g.groupKey] ?? { accountId: '', counterAccountId: '', memo: g.description };
              const ok = !!(draft.accountId && draft.counterAccountId);
              return (
                <div key={g.groupKey} style={{
                  background: '#fff',
                  border: `0.5px solid ${ok ? '#BBF7D0' : T.border}`,
                  borderLeft: `3px solid ${g.type === 'DEBIT' ? '#FCA5A5' : '#86EFAC'}`,
                  borderRadius: 10, padding: '12px 14px',
                  transition: 'border-color .15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                        <Pill
                          label={g.type === 'DEBIT' ? 'Débito' : 'Crédito'}
                          type={g.type === 'DEBIT' ? 'danger' : 'success'}
                        />
                        <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{g.description}</span>
                        <span style={{ fontSize: 11, color: T.textHint }}>({g.count}x)</span>
                        {g.suggestionSource && (
                          <SuggestionBadge source={g.suggestionSource} confidence={g.suggestionConfidence ?? 0} />
                        )}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: g.type === 'DEBIT' ? T.danger : T.success }}>
                        {fmtBRL(g.totalAmount)}
                      </div>
                      <div style={{ fontSize: 11, color: T.textHint, marginTop: 2 }}>
                        {g.transactions[0] && fmtDate(g.transactions[0].transactionDate)}
                        {g.transactions.length > 1 && ` → ${fmtDate(g.transactions[g.transactions.length - 1].transactionDate)}`}
                      </div>
                    </div>

                    {/* Campos */}
                    <div style={{ display: 'grid', gridTemplateColumns: '200px 160px 1fr', gap: 8, alignItems: 'end', flexShrink: 0 }}>
                      <AccountPicker
                        label="Conta contábil *"
                        value={draft.accountId}
                        onChange={id => updateDraft(g.groupKey, 'accountId', id)}
                        accounts={accounts}
                        placeholder="Cód. ou nome..."
                      />
                      <AccountPicker
                        label="Cta. bancária *"
                        value={draft.counterAccountId}
                        onChange={id => updateDraft(g.groupKey, 'counterAccountId', id)}
                        accounts={accounts}
                        placeholder="Cód. ou nome..."
                      />
                      <div>
                        <div style={{ fontSize: 10, color: T.textHint, marginBottom: 3, fontWeight: 500 }}>Histórico</div>
                        <input
                          style={{ width: '100%', boxSizing: 'border-box' as const, border: `0.5px solid ${T.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, outline: 'none', color: T.text, background: '#fff' }}
                          placeholder=""
                          value={draft.memo}
                          onChange={e => updateDraft(g.groupKey, 'memo', e.target.value)}
                        />
                      </div>
                    </div>

                    {ok && <span style={{ fontSize: 16, color: T.success, flexShrink: 0 }}>✓</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <button onClick={resetToList} style={{
              background: '#fff', border: `0.5px solid ${T.border}`,
              borderRadius: 8, padding: '8px 16px', fontSize: 13, color: T.textMuted, cursor: 'pointer',
            }}>← Voltar</button>
            <button onClick={handlePost} disabled={!canPost || loading} style={{
              background: canPost && !loading ? T.accent : T.textHint,
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 22px', fontSize: 13, fontWeight: 500,
              cursor: canPost && !loading ? 'pointer' : 'not-allowed',
              transition: 'background .15s',
            }}>
              {loading ? 'Lançando...' : `✓ Confirmar e Gerar ${groups.length} Lançamentos`}
            </button>
          </div>
        </div>
      )}

      {/* ══ DONE ══════════════════════════════════════════════ */}
      {step === 'done' && postResult && (
        <div style={{
          background: '#fff', border: `0.5px solid ${T.border}`,
          borderRadius: 14, padding: '56px 40px', textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: T.successSurf, margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
          }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 500, color: T.text, marginBottom: 6 }}>
            {postResult.posted} lançamentos gerados com sucesso
          </div>
          {postResult.errors?.length > 0 && (
            <div style={{ color: T.danger, fontSize: 13, marginBottom: 8 }}>
              {postResult.errors.length} erro(s) — verifique o log da API.
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24 }}>
            <button onClick={resetToList} style={{
              background: T.accent, color: '#fff', border: 'none',
              borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>Ver todos os extratos</button>
            <button onClick={() => { setStep('upload'); setUploadRes(null); setGroups([]); }} style={{
              background: '#fff', border: `0.5px solid ${T.border}`,
              color: T.textMuted, borderRadius: 8,
              padding: '9px 20px', fontSize: 13, cursor: 'pointer',
            }}>Importar outro extrato</button>
          </div>
        </div>
      )}

      {/* Input oculto */}
      <input ref={fileRef} type="file" accept=".xls,.xlsx,.ofx,.ofc,.csv"
        style={{ display: 'none' }} onChange={handleFileChange} />
    </div>
  );
}