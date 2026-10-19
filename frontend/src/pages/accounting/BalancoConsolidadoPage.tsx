// frontend/src/pages/accounting/BalancoConsolidadoPage.tsx
// CRIADO 19/10/2026: Balanco Consolidado Intercompany - empresas lado a lado, Soma, Eliminacoes e Consolidado.
// Eliminacoes calculadas na API (pares intercompany cadastrados + investimento x PL das participacoes da
// Equivalencia, com nao controladores). Nada e gravado no Contabil.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiRefreshCw, FiPrinter, FiPlus, FiTrash2, FiAlertTriangle } from 'react-icons/fi';
import api from '../../services/api';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { isMasterAdmin } from '../../utils/isMasterAdmin';
import { imprimirRelatorio } from '../../utils/imprimirRelatorio';

const DS = {
    accent: '#2563EB',
    accentSurface: '#EFF6FF',
    accentText: '#1D4ED8',
    border: '0.5px solid #E5E7EB',
    surface: '#F9FAFB',
} as const;

interface Empresa { id: string; nome: string; taxId: string }
interface Linha {
    code: string; name: string; type: string; nature: string; level: number; isAnalytic: boolean;
    porEmpresa: Record<string, number>; soma: number; eliminacao: number; consolidado: number;
}
interface Virtual { key: string; name: string; porEmpresa: Record<string, number>; soma: number; eliminacao: number; consolidado: number }
interface Par {
    id: string; descricao: string; empresaA: string; contaA: string; contaANome: string; saldoA: number;
    empresaB: string; contaB: string; contaBNome: string; saldoB: number; diferenca: number; eliminado: number;
}
interface Lanc { origem: string; referencia: string; empresa: string; code: string; conta: string; valor: number }
interface Resultado {
    dataBase: string; empresas: Empresa[]; linhas: Linha[]; virtuais: Virtual[]; pares: Par[];
    investimentos: any[]; lancamentos: Lanc[]; avisos: string[];
}
interface ParCadastro {
    id: string; descricao: string; companyAId: string; companyAName: string; accountACode: string;
    companyBId: string; companyBName: string; accountBCode: string;
}

const fmt = (v: number) => {
    if (Math.abs(v) < 0.005) return '—';
    const s = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return v < 0 ? `(${s})` : s;
};
const paraISO = (d: string) => {
    const p = d.trim().split('/');
    return p.length === 3 && p[2].length === 4 ? `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}` : '';
};
// Exibicao: Ativo em D-C; Passivo e PL em C-D (saldo natural positivo).
const sinal = (type: string, v: number) => (type === 'ASSET' ? v : -v);
const nomeCurto = (c: any) => c?.tradeName || c?.legalName || c?.name || '';

const BalancoConsolidadoPage: React.FC = () => {
    const { companies, activeCompany, activeCompetencia } = useCompany() as any;
    const { user } = useAuth() as any;
    const master = isMasterAdmin(user);

    const [dataBase, setDataBase] = useState(() => {
        const d: Date = activeCompetencia ? new Date(activeCompetencia) : new Date(new Date().getFullYear(), 11, 31);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    });
    const [selecionadas, setSelecionadas] = useState<string[]>([]);
    const [pares, setPares] = useState<ParCadastro[]>([]);
    const [res, setRes] = useState<Resultado | null>(null);
    const [aba, setAba] = useState<'balanco' | 'pares' | 'eliminacoes'>('balanco');
    const [maxDepth, setMaxDepth] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');
    const [novo, setNovo] = useState({ companyAId: '', accountACode: '', companyBId: '', accountBCode: '', descricao: '' });

    const carregarPares = useCallback(async () => {
        try {
            const r = await api.get('/accounting/consolidation/pares');
            const lista: ParCadastro[] = r.data ?? [];
            setPares(lista);
            return lista;
        } catch { return [] as ParCadastro[]; }
    }, []);

    useEffect(() => {
        carregarPares().then(lista => {
            const doGrupo = Array.from(new Set(lista.flatMap(p => [p.companyAId, p.companyBId])));
            const disponiveis = new Set((companies || []).map((c: any) => c.id));
            const ini = doGrupo.filter(id => disponiveis.has(id));
            setSelecionadas(ini.length ? ini : activeCompany ? [activeCompany.id] : []);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companies?.length]);

    const gerar = async () => {
        const iso = paraISO(dataBase);
        if (!iso) { setErro('Data-base inválida (dd/mm/aaaa).'); return; }
        if (!selecionadas.length) { setErro('Selecione ao menos uma empresa.'); return; }
        setLoading(true); setErro('');
        try {
            const ordem = (companies || []).map((c: any) => c.id).filter((id: string) => selecionadas.includes(id));
            const r = await api.get('/accounting/consolidation', { params: { companyIds: ordem.join(','), date: iso } });
            setRes(r.data);
        } catch (e: any) {
            setErro(e?.response?.data?.message || 'Erro ao consolidar.');
            setRes(null);
        } finally { setLoading(false); }
    };

    const adicionarPar = async () => {
        try {
            await api.post('/accounting/consolidation/pares', novo);
            setNovo({ companyAId: '', accountACode: '', companyBId: '', accountBCode: '', descricao: '' });
            await carregarPares();
            if (res) gerar();
        } catch (e: any) { setErro(e?.response?.data?.message || 'Erro ao cadastrar o par.'); }
    };
    const removerPar = async (id: string) => {
        if (!window.confirm('Remover este par intercompany?')) return;
        try {
            await api.delete(`/accounting/consolidation/pares/${id}`);
            await carregarPares();
            if (res) gerar();
        } catch (e: any) { setErro(e?.response?.data?.message || 'Erro ao remover o par.'); }
    };

    // ── Totais (sempre pelas contas analiticas, independem da arvore) ─────────
    const totais = useMemo(() => {
        if (!res) return null;
        const cols = [...res.empresas.map(e => e.id), '~soma', '~elim', '~cons'];
        const val = (l: { porEmpresa: Record<string, number>; soma: number; eliminacao: number; consolidado: number }, c: string) =>
            c === '~soma' ? l.soma : c === '~elim' ? l.eliminacao : c === '~cons' ? l.consolidado : (l.porEmpresa[c] ?? 0);
        const t: Record<string, { ativo: number; passivo: number; pl: number }> = {};
        for (const c of cols) {
            let ativo = 0, passivo = 0, pl = 0;
            for (const l of res.linhas) {
                if (!l.isAnalytic) continue;
                if (l.type === 'ASSET') ativo += val(l, c);
                else if (l.type === 'LIABILITY') passivo -= val(l, c);
                else if (l.type === 'EQUITY') pl -= val(l, c);
            }
            for (const v of res.virtuais) pl -= val(v, c);
            t[c] = { ativo, passivo, pl };
        }
        return { cols, t, val };
    }, [res]);

    const linhasVisiveis = useMemo(() => {
        if (!res) return [];
        return res.linhas.filter(l =>
            (maxDepth === null || l.level <= maxDepth) &&
            (Math.abs(l.soma) >= 0.005 || Math.abs(l.eliminacao) >= 0.005 ||
                Object.values(l.porEmpresa).some(v => Math.abs(v) >= 0.005)));
    }, [res, maxDepth]);

    const imprimir = () => {
        if (!res || !totais) return;
        const head = `<tr><th>Código</th><th>Conta</th>${res.empresas.map(e => `<th class="num">${e.nome}</th>`).join('')}<th class="num">Soma</th><th class="num">Eliminações</th><th class="num">Consolidado</th></tr>`;
        const celulas = (type: string, l: any) => totais.cols.map(c => `<td class="num">${fmt(sinal(type, totais.val(l, c)))}</td>`).join('');
        const corpo = linhasVisiveis.map(l => `<tr${l.isAnalytic ? '' : ' style="font-weight:bold"'}><td>${l.code}</td><td>${l.name}</td>${celulas(l.type, l)}</tr>`).join('');
        const virt = res.virtuais.map(v => `<tr><td></td><td>${v.name}</td>${celulas('EQUITY', v)}</tr>`).join('');
        const linhaTotal = (rot: string, f: (x: { ativo: number; passivo: number; pl: number }) => number) =>
            `<tr class="total"><td></td><td>${rot}</td>${totais.cols.map(c => `<td class="num">${fmt(f(totais.t[c]))}</td>`).join('')}</tr>`;
        const tot = linhaTotal('TOTAL DO ATIVO', x => x.ativo) + linhaTotal('TOTAL DO PASSIVO', x => x.passivo) +
            linhaTotal('TOTAL DO PATRIMÔNIO LÍQUIDO', x => x.pl) + linhaTotal('PASSIVO + PL', x => x.passivo + x.pl) +
            linhaTotal('DIFERENÇA (ATIVO - PASSIVO - PL)', x => x.ativo - x.passivo - x.pl);
        const paresHtml = res.pares.length ? `<h3 style="margin-top:18px">Pares intercompany</h3><table><thead><tr><th>Par</th><th>Empresa A / conta</th><th class="num">Saldo A</th><th>Empresa B / conta</th><th class="num">Saldo B</th><th class="num">Diferença</th><th class="num">Eliminado</th></tr></thead><tbody>${res.pares.map(p => `<tr><td>${p.descricao}</td><td>${p.empresaA} ${p.contaA} ${p.contaANome}</td><td class="num">${fmt(p.saldoA)}</td><td>${p.empresaB} ${p.contaB} ${p.contaBNome}</td><td class="num">${fmt(p.saldoB)}</td><td class="num">${fmt(p.diferenca)}</td><td class="num">${fmt(p.eliminado)}</td></tr>`).join('')}</tbody></table><p style="font-size:10px;color:#555">Saldos em débito positivo e crédito entre parênteses. Diferença = Saldo A + Saldo B (zero quando os dois lados se espelham).</p>` : '';
        imprimirRelatorio({
            titulo: 'BALANÇO CONSOLIDADO INTERCOMPANY',
            subtitulo: res.empresas.map(e => e.nome).join(' · '),
            empresaNome: 'Consolidado',
            empresaCnpj: '',
            periodo: `Data-base ${dataBase}`,
            corpoHtml: `<table><thead>${head}</thead><tbody>${corpo}${virt}${tot}</tbody></table>${paresHtml}`,
            larguraTotal: true,
        });
    };

    const th: React.CSSProperties = { background: DS.accentSurface, color: '#4B5563', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.4px', padding: '7px 10px', fontWeight: 600, borderBottom: DS.border, whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1 };
    const td: React.CSSProperties = { padding: '4px 10px', fontSize: 12, color: '#374151', whiteSpace: 'nowrap', borderBottom: '0.5px solid #F0F0F0' };
    const num: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'monospace' };
    const inp: React.CSSProperties = { border: DS.border, borderRadius: 6, padding: '6px 10px', fontSize: 12, background: '#fff' };
    const btn = (ativo: boolean): React.CSSProperties => ({ padding: '7px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: `0.5px solid ${ativo ? DS.accent : '#D1D5DB'}`, background: ativo ? DS.accent : '#fff', color: ativo ? '#fff' : DS.accentText, fontWeight: ativo ? 600 : 400 });
    const corValor = (v: number) => (v < -0.004 ? '#B91C1C' : '#111111');

    const celulasTela = (type: string, l: any, negrito: boolean) => totais!.cols.map(c => {
        const v = sinal(type, totais!.val(l, c));
        const destaque = c === '~cons';
        const elim = c === '~elim';
        return (
            <td key={c} style={{ ...num, color: elim ? '#7C3AED' : corValor(v), fontWeight: negrito || destaque ? 600 : 400, background: destaque ? '#F8FAFC' : undefined }}>
                {fmt(v)}
            </td>
        );
    });

    return (
        <div style={{ flex: 1, background: DS.surface, minHeight: '100vh', padding: '24px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h1 style={{ fontSize: 20, fontWeight: 400, letterSpacing: 1, margin: 0, color: '#111' }}>BALANÇO CONSOLIDADO</h1>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: DS.accentSurface, color: DS.accentText }}>◆ Intercompany</span>
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
                Soma das empresas selecionadas, com eliminação dos saldos entre elas e do investimento x PL. Nada é gravado na contabilidade.
            </div>

            {/* Filtros */}
            <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', border: DS.border, borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 }}>Data-base</div>
                    <input value={dataBase} onChange={e => setDataBase(e.target.value)} placeholder="dd/mm/aaaa" maxLength={10} style={{ ...inp, width: 110, fontFamily: 'monospace' }} />
                </div>
                <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 }}>Empresas</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(companies || []).map((c: any) => {
                            const on = selecionadas.includes(c.id);
                            return (
                                <button key={c.id} type="button" onClick={() => setSelecionadas(on ? selecionadas.filter(x => x !== c.id) : [...selecionadas, c.id])}
                                    style={{ ...btn(on), padding: '5px 10px', fontSize: 11 }}>
                                    {on ? '✓ ' : ''}{nomeCurto(c)}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <button type="button" onClick={gerar} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: '#111', color: '#fff', fontSize: 13, fontWeight: 500, borderRadius: 6, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>
                    {loading && <FiRefreshCw size={13} />} Consolidar
                </button>
                {res && (
                    <button type="button" onClick={imprimir} style={{ ...btn(false), display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FiPrinter size={13} /> Imprimir
                    </button>
                )}
            </div>

            {erro && <div style={{ marginBottom: 12, padding: '10px 14px', background: '#FCEBEB', border: '0.5px solid #FECACA', borderRadius: 6, color: '#B91C1C', fontSize: 13 }}>{erro}</div>}

            {/* Abas */}
            <div style={{ display: 'flex', borderBottom: DS.border, marginBottom: 12 }}>
                {([['balanco', 'Balanço'], ['pares', `Pares intercompany${res ? ` (${res.pares.length})` : ''}`], ['eliminacoes', 'Eliminações']] as const).map(([k, rot]) => (
                    <button key={k} type="button" onClick={() => setAba(k as any)}
                        style={{ padding: '9px 18px', fontSize: 13, background: 'none', border: 'none', borderBottom: aba === k ? `2px solid ${DS.accent}` : '2px solid transparent', color: aba === k ? DS.accent : '#6B7280', fontWeight: aba === k ? 500 : 400, cursor: 'pointer', marginBottom: -1 }}>
                        {rot}
                    </button>
                ))}
                {aba === 'balanco' && res && (
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: '#9CA3AF' }}>Nível:</span>
                        {[1, 2, 3, 4, 5, 6].map(n => (
                            <button key={n} type="button" onClick={() => setMaxDepth(maxDepth === n ? null : n)}
                                style={{ width: 24, height: 24, borderRadius: 4, fontSize: 12, border: 'none', cursor: 'pointer', background: maxDepth === n ? '#111' : 'transparent', color: maxDepth === n ? '#fff' : '#6B7280' }}>{n}</button>
                        ))}
                        <button type="button" onClick={() => setMaxDepth(null)}
                            style={{ padding: '0 6px', height: 24, borderRadius: 4, fontSize: 13, border: 'none', cursor: 'pointer', background: maxDepth === null ? '#111' : 'transparent', color: maxDepth === null ? '#fff' : '#6B7280' }}>∞</button>
                    </div>
                )}
            </div>

            {res && (res.avisos?.length ?? 0) > 0 && (
                <div style={{ marginBottom: 12, padding: '10px 14px', background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 6, fontSize: 12, color: '#92400E' }}>
                    {res.avisos.map((a, i) => <div key={i} style={{ display: 'flex', gap: 6 }}><FiAlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} /> {a}</div>)}
                </div>
            )}

            {/* Aba Balanco */}
            {aba === 'balanco' && (
                !res || !totais ? (
                    <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF', fontSize: 13, background: '#fff', border: DS.border, borderRadius: 10 }}>
                        Escolha a data-base e as empresas e clique em "Consolidar".
                    </div>
                ) : (
                    <div style={{ background: '#fff', border: DS.border, borderRadius: 10, overflow: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
                        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{ ...th, textAlign: 'left' }}>Código</th>
                                    <th style={{ ...th, textAlign: 'left' }}>Conta</th>
                                    {res.empresas.map(e => <th key={e.id} style={{ ...th, textAlign: 'right' }}>{e.nome}</th>)}
                                    <th style={{ ...th, textAlign: 'right' }}>Soma</th>
                                    <th style={{ ...th, textAlign: 'right', color: '#7C3AED' }}>Eliminações</th>
                                    <th style={{ ...th, textAlign: 'right', color: DS.accentText }}>Consolidado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {linhasVisiveis.map(l => (
                                    <tr key={l.code} style={{ background: l.level === 1 ? DS.accentSurface : undefined }}>
                                        <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF' }}>{l.code}</td>
                                        <td style={{ ...td, fontWeight: l.isAnalytic ? 400 : 600, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }} title={l.name}>{l.name}</td>
                                        {celulasTela(l.type, l, !l.isAnalytic)}
                                    </tr>
                                ))}
                                {res.virtuais.map(v => (
                                    <tr key={v.key} style={{ background: '#F5F3FF' }}>
                                        <td style={td}></td>
                                        <td style={{ ...td, fontStyle: 'italic' }}>{v.name}</td>
                                        {celulasTela('EQUITY', v, false)}
                                    </tr>
                                ))}
                                {([
                                    ['TOTAL DO ATIVO', (x: any) => x.ativo],
                                    ['TOTAL DO PASSIVO', (x: any) => x.passivo],
                                    ['TOTAL DO PATRIMÔNIO LÍQUIDO', (x: any) => x.pl],
                                    ['PASSIVO + PL', (x: any) => x.passivo + x.pl],
                                    ['DIFERENÇA (ATIVO - PASSIVO - PL)', (x: any) => x.ativo - x.passivo - x.pl],
                                ] as [string, (x: any) => number][]).map(([rot, f]) => (
                                    <tr key={rot} style={{ background: '#F3F4F6', borderTop: '1px solid #E5E7EB' }}>
                                        <td style={td}></td>
                                        <td style={{ ...td, fontWeight: 700, fontSize: 11 }}>{rot}</td>
                                        {totais.cols.map(c => {
                                            const v = f(totais.t[c]);
                                            const ehDif = rot.startsWith('DIFEREN');
                                            return <td key={c} style={{ ...num, fontWeight: 700, color: ehDif && Math.abs(v) >= 0.01 ? '#B91C1C' : corValor(v) }}>{ehDif && Math.abs(v) < 0.01 ? '✓' : fmt(v)}</td>;
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {/* Aba Pares */}
            {aba === 'pares' && (
                <div style={{ background: '#fff', border: DS.border, borderRadius: 10, overflow: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ ...th, textAlign: 'left' }}>Par</th>
                                <th style={{ ...th, textAlign: 'left' }}>Empresa A / conta</th>
                                <th style={{ ...th, textAlign: 'right' }}>Saldo A</th>
                                <th style={{ ...th, textAlign: 'left' }}>Empresa B / conta</th>
                                <th style={{ ...th, textAlign: 'right' }}>Saldo B</th>
                                <th style={{ ...th, textAlign: 'right' }}>Diferença</th>
                                <th style={{ ...th, textAlign: 'right' }}>Eliminado</th>
                                {master && <th style={th}></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {pares.map(p => {
                                const calc = res?.pares.find(x => x.id === p.id);
                                const dif = calc ? calc.diferenca : 0;
                                return (
                                    <tr key={p.id}>
                                        <td style={td}>{p.descricao}</td>
                                        <td style={td}>{p.companyAName} <span style={{ fontFamily: 'monospace', color: '#6B7280' }}>{p.accountACode}</span>{calc ? ` ${calc.contaANome}` : ''}</td>
                                        <td style={num}>{calc ? fmt(calc.saldoA) : ''}</td>
                                        <td style={td}>{p.companyBName} <span style={{ fontFamily: 'monospace', color: '#6B7280' }}>{p.accountBCode}</span>{calc ? ` ${calc.contaBNome}` : ''}</td>
                                        <td style={num}>{calc ? fmt(calc.saldoB) : ''}</td>
                                        <td style={{ ...num, fontWeight: 600, color: calc && Math.abs(dif) >= 0.01 ? '#B91C1C' : '#15803D' }}>{calc ? (Math.abs(dif) < 0.01 ? '✓ bate' : fmt(dif)) : 'fora da seleção'}</td>
                                        <td style={{ ...num, color: '#7C3AED' }}>{calc ? fmt(calc.eliminado) : ''}</td>
                                        {master && <td style={td}><button type="button" title="Remover" onClick={() => removerPar(p.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#B91C1C' }}><FiTrash2 size={13} /></button></td>}
                                    </tr>
                                );
                            })}
                            {master && (
                                <tr style={{ background: DS.surface }}>
                                    <td style={td}><input value={novo.descricao} onChange={e => setNovo({ ...novo, descricao: e.target.value })} placeholder="Descrição do par" style={{ ...inp, width: 200 }} /></td>
                                    <td style={td}>
                                        <select value={novo.companyAId} onChange={e => setNovo({ ...novo, companyAId: e.target.value })} style={{ ...inp, maxWidth: 160 }}>
                                            <option value="">Empresa A</option>
                                            {(companies || []).map((c: any) => <option key={c.id} value={c.id}>{nomeCurto(c)}</option>)}
                                        </select>{' '}
                                        <input value={novo.accountACode} onChange={e => setNovo({ ...novo, accountACode: e.target.value })} placeholder="Código da conta" style={{ ...inp, width: 120, fontFamily: 'monospace' }} />
                                    </td>
                                    <td style={td}></td>
                                    <td style={td}>
                                        <select value={novo.companyBId} onChange={e => setNovo({ ...novo, companyBId: e.target.value })} style={{ ...inp, maxWidth: 160 }}>
                                            <option value="">Empresa B</option>
                                            {(companies || []).map((c: any) => <option key={c.id} value={c.id}>{nomeCurto(c)}</option>)}
                                        </select>{' '}
                                        <input value={novo.accountBCode} onChange={e => setNovo({ ...novo, accountBCode: e.target.value })} placeholder="Código da conta" style={{ ...inp, width: 120, fontFamily: 'monospace' }} />
                                    </td>
                                    <td style={td}></td>
                                    <td colSpan={3} style={td}>
                                        <button type="button" onClick={adicionarPar} style={{ ...btn(true), display: 'flex', alignItems: 'center', gap: 6 }}><FiPlus size={13} /> Adicionar par</button>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    <div style={{ padding: '8px 12px', fontSize: 11, color: '#6B7280' }}>
                        Saldos em débito positivo e crédito entre parênteses. Diferença = Saldo A + Saldo B: zero quando os dois lados se espelham. Só o valor que se espelha é eliminado; a diferença fica no consolidado.
                    </div>
                </div>
            )}

            {/* Aba Eliminacoes */}
            {aba === 'eliminacoes' && (
                !res ? (
                    <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF', fontSize: 13, background: '#fff', border: DS.border, borderRadius: 10 }}>Clique em "Consolidar" para ver as eliminações.</div>
                ) : (
                    <>
                        {res.investimentos.length > 0 && (
                            <div style={{ background: '#fff', border: DS.border, borderRadius: 10, overflow: 'auto', marginBottom: 12 }}>
                                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                                    <thead>
                                        <tr>
                                            {['Investidora', 'Investida', '%', 'PL da investida', 'Equivalência (PL x %)', 'Investimento registrado', 'Não controladores'].map((h, i) => (
                                                <th key={h} style={{ ...th, textAlign: i < 2 ? 'left' : 'right' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {res.investimentos.map((i, k) => (
                                            <tr key={k}>
                                                <td style={td}>{i.investidora}</td>
                                                <td style={td}>{i.investida}</td>
                                                <td style={num}>{Number(i.percentual).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</td>
                                                <td style={{ ...num, color: corValor(i.plInvestida) }}>{fmt(i.plInvestida)}</td>
                                                <td style={{ ...num, color: corValor(i.valorEquivalencia) }}>{fmt(i.valorEquivalencia)}</td>
                                                <td style={num}>{fmt(i.saldoInvestimento ?? 0)}</td>
                                                <td style={num}>{fmt(i.minoritarios ?? 0)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div style={{ padding: '8px 12px', fontSize: 11, color: '#6B7280' }}>
                                    Investimento registrado = saldo D-C das contas cadastradas na participação (investimento, redutora e provisão). A diferença entre ele e a equivalência vai para "Diferença de consolidação".
                                </div>
                            </div>
                        )}
                        <div style={{ background: '#fff', border: DS.border, borderRadius: 10, overflow: 'auto' }}>
                            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                                <thead>
                                    <tr>
                                        {['Origem', 'Referência', 'Empresa', 'Código', 'Conta', 'Débito', 'Crédito'].map((h, i) => (
                                            <th key={h} style={{ ...th, textAlign: i < 5 ? 'left' : 'right' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {res.lancamentos.map((l, k) => (
                                        <tr key={k}>
                                            <td style={td}>{l.origem === 'PAR' ? 'Par' : 'Investimento'}</td>
                                            <td style={td}>{l.referencia}</td>
                                            <td style={td}>{l.empresa}</td>
                                            <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{l.code}</td>
                                            <td style={td}>{l.conta}</td>
                                            <td style={num}>{l.valor > 0 ? fmt(l.valor) : ''}</td>
                                            <td style={num}>{l.valor < 0 ? fmt(-l.valor) : ''}</td>
                                        </tr>
                                    ))}
                                    <tr style={{ background: '#F3F4F6' }}>
                                        <td colSpan={5} style={{ ...td, fontWeight: 700 }}>TOTAIS</td>
                                        <td style={{ ...num, fontWeight: 700 }}>{fmt(res.lancamentos.filter(l => l.valor > 0).reduce((s, l) => s + l.valor, 0))}</td>
                                        <td style={{ ...num, fontWeight: 700 }}>{fmt(-res.lancamentos.filter(l => l.valor < 0).reduce((s, l) => s + l.valor, 0))}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </>
                )
            )}
        </div>
    );
};

export default BalancoConsolidadoPage;
