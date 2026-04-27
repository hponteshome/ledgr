// frontend/src/pages/accounting/DiarioGeralPage.tsx

import React, { useState, useCallback } from 'react';
import { FiSearch, FiLoader, FiAlertCircle } from 'react-icons/fi';
import api from '../../services/api';
import { useCompany } from '../../contexts/CompanyContext';
import { ReportToolbar } from '../../components/accounting/ReportToolbar';

// ── Tipos ──────────────────────────────────────────────────────
interface Account { id: string; code: string; name: string; }
interface JournalItem { accountId: string; account?: Account; value: number; type: 'DEBIT' | 'CREDIT'; }
interface JournalEntry { id: string; date: string; description: string; reference?: string; sourceModule: string; items: JournalItem[]; }
interface JournalResponse { total: number; page: number; pages: number; entries: JournalEntry[]; }

// ── Helpers ────────────────────────────────────────────────────
const parseDate = (d: string) => {
    const s = d.substring(0, 10); // "YYYY-MM-DD"
    const [y, m, day] = s.split('-').map(Number);
    return { y, m, day };
};
const fmtDateFull = (d: string) => { const { y, m, day } = parseDate(d); return `${String(day).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`; };
const fmtDay = (d: string) => String(parseDate(d).day).padStart(2, '0');
const fmtMonthYear = (d: string) => { const { y, m } = parseDate(d); return `${String(m).padStart(2, '0')}/${y}`; };
const fmtMonthName = (d: string) => { const { y, m } = parseDate(d); return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); };
const fmtNum = (v: number) => v === 0 ? '—' : Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNumTotal = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtCnpj = (cnpj: string) => {
    const d = cnpj.replace(/\D/g, ''); return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : cnpj;
};

const yr = new Date().getFullYear();
const DEF = {
    dateFrom: `${yr}-01-01`, dateTo: `${yr}-12-31`,
    accountFrom: '', accountTo: '', search: '',
    sources: ['ECD_IMPORT', 'ACCOUNTING', 'PROVISION', 'BANK_IMPORT', 'FISCAL'],
};
type F = typeof DEF;

// Gera sequencial por mês: 0001, 0002... reinicia a cada mês
const buildSeqMap = (entries: JournalEntry[]): Map<string, string> => {
    const map = new Map<string, string>();
    const mc = new Map<string, number>();
    [...entries].sort((a, b) => a.date.localeCompare(b.date)).forEach(e => {
        const m = e.date.substring(0, 7);
        const n = (mc.get(m) ?? 0) + 1;
        mc.set(m, n);
        map.set(e.id, String(n).padStart(4, '0'));
    });
    return map;
};

// Agrupa: mês → dia → lançamentos
const groupByMonthDay = (entries: JournalEntry[]) => {
    const monthMap = new Map<string, Map<string, JournalEntry[]>>();
    [...entries].sort((a, b) => a.date.localeCompare(b.date)).forEach(e => {
        const month = e.date.substring(0, 7); // "2024-03"
        const day = e.date.substring(0, 10);
        if (!monthMap.has(month)) monthMap.set(month, new Map());
        const dayMap = monthMap.get(month)!;
        if (!dayMap.has(day)) dayMap.set(day, []);
        dayMap.get(day)!.push(e);
    });
    return Array.from(monthMap.entries()).map(([month, dayMap]) => ({
        month,
        days: Array.from(dayMap.entries()).map(([day, entries]) => ({ day, entries })),
    }));
};

// ── Modal de filtros ───────────────────────────────────────────
const FilterModal: React.FC<{ f: F; onApply: (f: F) => void }> = ({ f: init, onApply }) => {
    const [f, setF] = useState<F>({ ...init });
    const s = (p: Partial<F>) => setF(prev => ({ ...prev, ...p }));
    const tog = (v: string) => s({ sources: f.sources.includes(v) ? f.sources.filter(x => x !== v) : [...f.sources, v] });
    const inp: React.CSSProperties = { height: 32, border: '0.5px solid #E5E7EB', borderRadius: 6, padding: '0 10px', fontSize: 15, width: '100%', outline: 'none', background: '#fff' };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: 520, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
                <div style={{ padding: '12px 20px', borderBottom: '0.5px solid #E5E7EB', background: '#F9FAFB', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#EFF6FF', color: '#1D4ED8' }}>◆ Contábil</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#111' }}>Diário Geral — Parâmetros de Emissão</span>
                </div>
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <p style={{ fontSize: 15, fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Período</p>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ flex: 1 }}><label style={{ fontSize: 15, color: '#6B7280', display: 'block', marginBottom: 4 }}>Data inicial</label>
                                <input type="date" value={f.dateFrom} max="9999-12-31" onChange={e => s({ dateFrom: e.target.value })} style={inp} /></div>
                            <div style={{ flex: 1 }}><label style={{ fontSize: 15, color: '#6B7280', display: 'block', marginBottom: 4 }}>Data final</label>
                                <input type="date" value={f.dateTo} max="9999-12-31" onChange={e => s({ dateTo: e.target.value })} style={inp} /></div>
                        </div>
                    </div>
                    <div>
                        <p style={{ fontSize: 10, fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Seleção de contas (opcional)</p>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Conta (de)</label>
                                <input type="text" value={f.accountFrom} placeholder="Ex: 1.1.1" onChange={e => s({ accountFrom: e.target.value })} style={inp} /></div>
                            <div style={{ flex: 1 }}><label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Conta (até)</label>
                                <input type="text" value={f.accountTo} placeholder="Ex: 2.9.9" onChange={e => s({ accountTo: e.target.value })} style={inp} /></div>
                        </div>
                    </div>
                    <div><label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Histórico contém</label>
                        <input type="text" value={f.search} placeholder="texto livre..." onChange={e => s({ search: e.target.value })} style={inp} /></div>
                    <div>
                        <p style={{ fontSize: 10, fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Fonte</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 12, background: '#F9FAFB', borderRadius: 6, border: '0.5px solid #E5E7EB' }}>
                            {[['ECD_IMPORT', 'ECD'], ['ACCOUNTING', 'Manual'], ['PROVISION', 'Provisão'], ['BANK_IMPORT', 'Banco'], ['FISCAL', 'Fiscal']].map(([v, l]) => (
                                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={f.sources.includes(v)} onChange={() => tog(v)} style={{ accentColor: '#2563EB' }} />{l}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                <div style={{ padding: '12px 20px', borderTop: '0.5px solid #E5E7EB', background: '#F9FAFB', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => onApply(f)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, border: 'none', background: '#111', fontSize: 13, fontWeight: 500, color: '#fff', cursor: 'pointer' }}>
                        <FiSearch size={13} /> Gerar Diário
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Estilos de tabela ──────────────────────────────────────────
const TH: React.CSSProperties = { padding: '6px 8px', fontSize: 15, fontWeight: 700, color: '#111', borderTop: '1px solid #111', borderBottom: '1px solid #111', textAlign: 'left', whiteSpace: 'nowrap', background: '#fff' };
const TD: React.CSSProperties = { padding: '3px 8px', fontSize: 15, color: '#111', borderBottom: '0.5px solid #F0F0F0', verticalAlign: 'top' };

// ── Página ─────────────────────────────────────────────────────
const DiarioGeralPage: React.FC = () => {
    const { activeCompany } = useCompany();
    const [filters, setFilters] = useState<F>(DEF);
    const [showModal, setShowModal] = useState(true);
    const [data, setData] = useState<JournalResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async (f: F) => {
        if (!activeCompany) return;
        setLoading(true); setError('');
        try {
            let all: JournalEntry[] = [];
            let pg = 1;
            while (true) {
                const params: any = { dateFrom: f.dateFrom, dateTo: f.dateTo, page: pg, limit: 500 };
                if (f.search) params.search = f.search;
                if (f.accountFrom) params.accountCode = f.accountFrom;
                const r = await api.get('/accounting/journal', { params });
                const entries: JournalEntry[] = r.data.entries || [];
                // Filtro de fonte em memória
                const filtered = f.sources.length > 0
                    ? entries.filter(e => f.sources.includes(e.sourceModule))
                    : entries;
                all = [...all, ...filtered];
                if (pg >= r.data.pages) break;
                pg++;
            }
            setData({ total: all.length, page: 1, pages: 1, entries: all });
        } catch (e: any) { setError(e.response?.data?.message || 'Erro ao carregar.'); }
        finally { setLoading(false); }
    }, [activeCompany]);

    const handleApply = (f: F) => { setFilters(f); setShowModal(false); load(f); };

    const grouped = React.useMemo(() => data ? groupByMonthDay(data.entries) : [], [data]);
    const seqMap = React.useMemo(() => data ? buildSeqMap(data.entries) : new Map(), [data]);

    // Totais gerais
    const totD = data?.entries.reduce((s, e) => s + e.items.filter(i => i.type === 'DEBIT').reduce((a, i) => a + Number(i.value), 0), 0) ?? 0;
    const totC = data?.entries.reduce((s, e) => s + e.items.filter(i => i.type === 'CREDIT').reduce((a, i) => a + Number(i.value), 0), 0) ?? 0;

    const exportCSV = () => {
        if (!data?.entries.length) return;
        const rows = [['Mês', 'Dia', 'Conta', 'Nome', 'Red.', 'Histórico', 'Lcto', 'Débito', 'Crédito']];
        grouped.forEach(({ month, days }) => {
            days.forEach(({ day, entries }) => {
                entries.forEach(entry => {
                    const allItems = [...entry.items.filter(i => i.type === 'DEBIT'), ...entry.items.filter(i => i.type === 'CREDIT')];
                    allItems.forEach((item, idx) => {
                        rows.push([
                            fmtMonthYear(day),
                            idx === 0 ? fmtDay(entry.date) : '',
                            item.account?.code || '',
                            `"${item.account?.name || ''}"`,
                            '',
                            idx === 0 ? `"${entry.description}"` : '',
                            idx === 0 ? seqMap.get(entry.id) || '' : '',
                            item.type === 'DEBIT' ? Number(item.value).toFixed(2).replace('.', ',') : '',
                            item.type === 'CREDIT' ? Number(item.value).toFixed(2).replace('.', ',') : '',
                        ]);
                    });
                });
            });
        });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }));
        a.download = `DiarioGeral_${filters.dateFrom}_${filters.dateTo}.csv`; a.click();
    };

    return (
        <div style={{ padding: 24, background: 'var(--color-background-tertiary)', minHeight: '100vh' }}>
            {showModal && <FilterModal f={filters} onApply={handleApply} />}

            {/* Toolbar flutuante */}
            <ReportToolbar
                title="Diário Geral"
                dateFrom={filters.dateFrom}
                dateTo={filters.dateTo}
                count={data?.total}
                countLabel="lançamentos"
                onPeriodChange={(from, to) => {
                    const f = { ...filters, dateFrom: from, dateTo: to };
                    setFilters(f);
                    load(f);
                }}
                onFilter={() => setShowModal(true)}
                onPrint={() => window.print()}
                onExportCSV={data ? exportCSV : undefined}
                hasData={!!data}
            />

            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 12, color: '#9CA3AF' }}>
                    <FiLoader size={20} /><span style={{ fontSize: 13 }}>Carregando lançamentos...</span>
                </div>
            ) : error ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 13 }}>
                    <FiAlertCircle size={14} /> {error}
                </div>
            ) : data && grouped.length > 0 ? (
                <>
                    {/* CSS para impressão */}
                    <style>{`
                        @media print {
                            .no-print { display: none !important; }
                            .page-break { page-break-before: always; }
                            .report-container { box-shadow: none !important; border: none !important; }
                        }
                        @media screen {
                            .page-break { border-top: 3px solid #E5E7EB; margin-top: 8px; padding-top: 0; }
                        }
                    `}</style>

                    {/* Relatório */}
                    <div className="report-container" style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ padding: '20px 28px', overflowX: 'auto' }}>

                            {grouped.map(({ month, days }, monthIdx) => {
                                // Totais do mês
                                const monthD = days.reduce((s, { entries }) => s + entries.reduce((ss, e) => ss + e.items.filter(i => i.type === 'DEBIT').reduce((a, i) => a + Number(i.value), 0), 0), 0);
                                const monthC = days.reduce((s, { entries }) => s + entries.reduce((ss, e) => ss + e.items.filter(i => i.type === 'CREDIT').reduce((a, i) => a + Number(i.value), 0), 0), 0);
                                // Data representativa do mês (primeiro dia)
                                const firstDay = days[0].day;

                                return (
                                    <div key={month} className={monthIdx > 0 ? 'page-break' : ''}>

                                        {/* ── Cabeçalho do relatório (repete em cada mês) ── */}
                                        <div style={{ marginBottom: 12 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                                <div>
                                                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{activeCompany?.legalName || activeCompany?.tradeName}</div>
                                                    <div style={{ fontSize: 14, color: '#111', fontFamily: 'monospace' }}>CNPJ:  {fmtCnpj(activeCompany?.taxId || '')}</div>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: 16, fontWeight: 700, color: '#111', letterSpacing: 1 }}>Diário Geral</div>
                                                </div>
                                                <div style={{ textAlign: 'right', fontSize: 11, color: '#6B7280', lineHeight: 1.6 }}>
                                                    <div>Página: {monthIdx + 1}</div>
                                                    <div>Data: {new Date().toLocaleDateString('pt-BR')}</div>
                                                    <div>Hora: {new Date().toLocaleTimeString('pt-BR')}</div>
                                                </div>
                                            </div>
                                            <div style={{ borderTop: '1px solid #111', borderBottom: '1px solid #111', padding: '4px 0', display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, marginBottom: 0 }}>
                                                <span>Consolidação: Empresa</span>
                                                <span>Período: {fmtDateFull(filters.dateFrom)} a {fmtDateFull(filters.dateTo)}</span>
                                                <span>Mês/Ano: {fmtMonthYear(firstDay)}</span>
                                            </div>
                                        </div>

                                        {/* ── Tabela do mês ── */}
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                                            <thead>
                                                <tr >
                                                    <th style={{ ...TH, width: 28, fontSize: 14 }}>Dia</th>
                                                    <th style={{ ...TH, width: 200, fontSize: 14 }}>Conta</th>
                                                    <th style={{ ...TH, width: 50, fontSize: 14 }}>Red.</th>
                                                    <th style={{ ...TH, fontSize: 14 }}>Histórico</th>
                                                    <th style={{ ...TH, width: 80, fontSize: 14 }}>Lote/Lcto</th>
                                                    <th style={{ ...TH, width: 110, textAlign: 'right', fontSize: 14 }}>Débito</th>
                                                    <th style={{ ...TH, width: 110, textAlign: 'right', fontSize: 14 }}>Crédito</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {days.map(({ day, entries }) => {
                                                    const dayD = entries.reduce((s, e) => s + e.items.filter(i => i.type === 'DEBIT').reduce((a, i) => a + Number(i.value), 0), 0);
                                                    const dayC = entries.reduce((s, e) => s + e.items.filter(i => i.type === 'CREDIT').reduce((a, i) => a + Number(i.value), 0), 0);

                                                    return (
                                                        <React.Fragment key={day}>
                                                            {entries.map(entry => {
                                                                const debits = entry.items.filter(i => i.type === 'DEBIT');
                                                                const credits = entry.items.filter(i => i.type === 'CREDIT');
                                                                const allItems = [...debits, ...credits];
                                                                const lcto = seqMap.get(entry.id) || '';

                                                                return allItems.map((item, idx) => (
                                                                    <tr key={`${entry.id}-${item.accountId}-${idx}`}
                                                                        onMouseEnter={e => e.currentTarget.style.background = '#F0F9FF'}
                                                                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                                                                        {/* Dia — só na 1ª linha do 1º lançamento do dia */}
                                                                        <td style={{ ...TD, fontWeight: 600, color: '#374151', verticalAlign: 'top', paddingTop: idx === 0 ? 5 : 3 }}>
                                                                            {idx === 0 ? fmtDay(entry.date) : ''}
                                                                        </td>
                                                                        {/* Conta código + nome */}
                                                                        <td style={{ ...TD, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 500 }}
                                                                            title={`${item.account?.code} — ${item.account?.name}`}>
                                                                            <span style={{ fontFamily: 'monospace', color: '#1D4ED8', fontWeight: 500 }}>{item.account?.code || '—'}</span>
                                                                            <span style={{ color: '#374151', marginLeft: 6 }}>{item.account?.name || ''}</span>
                                                                        </td>
                                                                        {/* Red. desabilitado */}
                                                                        <td style={{ ...TD, color: '#D1D5DB', fontSize: 10, textAlign: 'center' }}>—</td>
                                                                        {/* Histórico — só 1ª linha de cada lançamento */}
                                                                        <td style={{ ...TD, color: '#374151', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.description}>
                                                                            {idx === 0 ? entry.description : ''}
                                                                        </td>
                                                                        {/* Lcto — só 1ª linha */}
                                                                        <td style={{ ...TD, fontFamily: 'monospace', color: '#9CA3AF', fontSize: 14 }}>
                                                                            {idx === 0 ? lcto : ''}
                                                                        </td>
                                                                        {/* Débito */}
                                                                        <td style={{ ...TD, textAlign: 'right', fontFamily: 'monospace', fontSize: 14, color: item.type === 'DEBIT' ? '#111' : '#D1D5DB' }}>
                                                                            {item.type === 'DEBIT' ? fmtNum(Number(item.value)) : ''}
                                                                        </td>
                                                                        {/* Crédito */}
                                                                        <td style={{ ...TD, textAlign: 'right', fontFamily: 'monospace', fontSize: 14, color: item.type === 'CREDIT' ? '#111' : '#D1D5DB' }}>
                                                                            {item.type === 'CREDIT' ? fmtNum(Number(item.value)) : ''}
                                                                        </td>
                                                                    </tr>
                                                                ));
                                                            })}

                                                            {/* Total do Dia */}
                                                            <tr style={{ background: '#F9FAFB' }}>
                                                                <td colSpan={5} style={{ padding: '4px 8px', fontSize: 11, fontWeight: 700, color: '#374151', textAlign: 'right', borderTop: '0.5px solid #E5E7EB', borderBottom: '0.5px solid #E5E7EB' }}>
                                                                    Total do Dia:
                                                                </td>
                                                                <td style={{ padding: '4px 8px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, fontSize: 15, color: '#111', borderTop: '0.5px solid #E5E7EB', borderBottom: '0.5px solid #E5E7EB' }}>
                                                                    {fmtNumTotal(dayD)}
                                                                </td>
                                                                <td style={{ padding: '4px 8px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, fontSize: 15, color: '#111', borderTop: '0.5px solid #E5E7EB', borderBottom: '0.5px solid #E5E7EB' }}>
                                                                    {fmtNumTotal(dayC)}
                                                                </td>
                                                            </tr>
                                                            {/* Espaçador entre dias */}
                                                            <tr><td colSpan={7} style={{ padding: 1 }} /></tr>
                                                        </React.Fragment>
                                                    );
                                                })}

                                                {/* Total do Mês */}
                                                <tr style={{ background: '#EFF6FF' }}>
                                                    <td colSpan={5} style={{ padding: '6px 8px', fontSize: 15, fontWeight: 700, color: '#1D4ED8', textAlign: 'right', borderTop: '1px solid #1D4ED8' }}>
                                                        Total do Mês — {fmtMonthName(firstDay)}:
                                                    </td>
                                                    <td style={{ padding: '6px 8px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, fontSize: 15, color: '#1D4ED8', borderTop: '1px solid #1D4ED8' }}>
                                                        {fmtNumTotal(monthD)}
                                                    </td>
                                                    <td style={{ padding: '6px 8px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, fontSize: 15, color: '#1D4ED8', borderTop: '1px solid #1D4ED8' }}>
                                                        {fmtNumTotal(monthC)}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        {/* Espaçador entre meses (só na tela) */}
                                        {monthIdx < grouped.length - 1 && (
                                            <div style={{ height: 24 }} />
                                        )}
                                    </div>
                                );
                            })}

                            {/* Totais Gerais — ao final do último mês */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                                <tbody>
                                    <tr style={{ background: '#F0F9FF' }}>
                                        <td colSpan={5} style={{ padding: '8px 8px', fontSize: 15, fontWeight: 700, color: '#111', textAlign: 'right', borderTop: '2px solid #111' }}>
                                            Totais Gerais · {data!.total} lançamentos:
                                        </td>
                                        <td style={{ padding: '8px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, fontSize: 15, color: '#111', borderTop: '2px solid #111', width: 110 }}>
                                            {fmtNumTotal(totD)}
                                        </td>
                                        <td style={{ padding: '8px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, fontSize: 15, color: '#111', borderTop: '2px solid #111', width: 110 }}>
                                            {fmtNumTotal(totC)}
                                        </td>
                                    </tr>
                                    {Math.abs(totD - totC) > 0.01 && (
                                        <tr style={{ background: '#FEF2F2' }}>
                                            <td colSpan={5} style={{ padding: '5px 8px', fontSize: 15, fontWeight: 600, color: '#B91C1C', textAlign: 'right' }}>Diferença (desbalanceado):</td>
                                            <td colSpan={2} style={{ padding: '5px 8px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, fontSize: 15, color: '#B91C1C' }}>
                                                {fmtNumTotal(Math.abs(totD - totC))}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                        </div>
                    </div>
                </>
            ) : data ? (
                <div style={{ textAlign: 'center', padding: 80, border: '0.5px dashed #E5E7EB', borderRadius: 10, color: '#9CA3AF', fontSize: 15 }}>
                    Nenhum lançamento encontrado no período selecionado.
                </div>
            ) : null}
        </div>
    );
};

export default DiarioGeralPage;