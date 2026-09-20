// frontend/src/pages/accounting/RazaoAnaliticoPage.tsx

import React, { useState, useCallback } from 'react';
import { FiSearch, FiLoader, FiAlertCircle } from 'react-icons/fi';
import api from '../../services/api';
import { useCompany } from '../../contexts/CompanyContext';
import { ReportToolbar } from '../../components/accounting/ReportToolbar';

// ── Tipos ──────────────────────────────────────────────────────
interface AccountInfo {
    id: string; code: string; name: string;
    type: string; nature: string; level: number;
    isAnalytic: boolean;
    reducedCode?: string;
}
interface JournalItem {
    accountId: string; account?: AccountInfo;
    value: number; type: 'DEBIT' | 'CREDIT';
}
interface JournalEntry {
    id: string; date: string; description: string;
    reference?: string; sourceModule: string;
    items: JournalItem[];
    lote?: { numero: number; ano: number } | null;
}
interface BalanceRow {
    account: AccountInfo;
    previousBalance: number;
    debits: number;
    credits: number;
    currentBalance: number;
}
interface ReportData {
    startDate: string;
    endDate: string;
    balances: BalanceRow[];
}

// ── Helpers ────────────────────────────────────────────────────
const parseDate = (d: string) => {
    const s = d.substring(0, 10);
    const [y, m, day] = s.split('-').map(Number);
    return { y, m, day };
};
const fmtDateFull = (d: string) => {
    const { y, m, day } = parseDate(d);
    return `${String(day).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
};
const fmtCnpj = (cnpj: string) => {
    const d = cnpj.replace(/\D/g, '');
    return d.length === 14
        ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
        : cnpj;
};
const fmtNum = (v: number, dash = false): string => {
    if (v === 0) return dash ? '' : '0,00';
    return Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtSaldo = (v: number): string => {
    if (v === 0) return '0,00';
    const s = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return v < 0 ? `(${s})` : s;
};

const getActiveYear = () => {
    try {
        const companyId = localStorage.getItem('@ledgr:companyId');
        if (companyId) {
            const saved = localStorage.getItem(`@ledgr:activeCompetencia:${companyId}`);
            if (saved) return new Date(saved).getFullYear();
        }
    } catch {}
    return new Date().getFullYear();
};
const yr = getActiveYear();
const DEF = {
    startDate: yr + '-01-01',
    endDate: yr + '-12-31',
    filterMode: 'all' as 'all' | 'one' | 'range' | 'list',
    accountFrom: '',
    accountTo: '',
    accountList: '',
    reducedFrom: '',
    reducedTo: '',
    showZero: false,
    // NOVO (16/09/2026): filtro de fonte/tipo de lancamento, mesmo padrao
    // do Diario Geral - vazio = Todas as fontes (sem filtro).
    sources: [] as string[],
};
type F = typeof DEF;

// Sequencial por mês
const buildSeqMap = (entries: JournalEntry[]): Map<string, string> => {
    const map = new Map<string, string>();
    const mc = new Map<string, number>();
    [...entries].sort((a, b) => a.date.localeCompare(b.date)).forEach(e => {
        const m = e.date.substring(0, 7);
        const n = (mc.get(m) ?? 0) + 1; mc.set(m, n);
        map.set(e.id, String(n).padStart(4, '0'));
    });
    return map;
};







// ── Autocomplete de conta (usa as contas ja carregadas no relatorio,
// sem chamada nova a API) ───────────────────────────────────────
const AccountAutocomplete: React.FC<{
    accounts: AccountInfo[];
    value: string;
    onChange: (code: string) => void;
    placeholder?: string;
    style?: React.CSSProperties;
}> = ({ accounts, value, onChange, placeholder, style }) => {
    const [aberto, setAberto] = useState(false);
    const [busca, setBusca] = useState('');
    const wrapRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const termo = (aberto ? busca : value).toLowerCase();
    const filtradas = (termo
        ? accounts.filter(a => a.code.toLowerCase().includes(termo) || a.name.toLowerCase().includes(termo))
        : accounts
    ).slice(0, 30);

    return (
        <div ref={wrapRef} style={{ position: 'relative' }}>
            <input
                type="text"
                value={aberto ? busca : value}
                placeholder={placeholder}
                onFocus={() => { setAberto(true); setBusca(value); }}
                onChange={e => { setBusca(e.target.value); onChange(e.target.value); }}
                style={style}
            />
            {aberto && filtradas.length > 0 && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 40, background: '#fff',
                    border: '1px solid #E5E7EB', borderRadius: 6, marginTop: 2, maxHeight: 220, overflowY: 'auto',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}>
                    {filtradas.map(a => (
                        <div
                            key={a.id}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => { onChange(a.code); setBusca(a.code); setAberto(false); }}
                            style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '0.5px solid #F5F5F5' }}
                        >
                            <span style={{ fontFamily: 'monospace', color: '#2563EB', marginRight: 6 }}>{a.code}</span>
                            {a.name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Autocomplete por Codigo Reduzido ───────────────────────────
// Campo proprio: busca SOMENTE em reducedCode (numerico, prefixo). Evita
// conflito com codigos de grupo/nivel (1, 11, 111...) que o campo
// "Conta unica" tambem casa por texto.
const ReducedCodeAutocomplete: React.FC<{
    accounts: AccountInfo[];
    selectedCode: string;
    onSelect: (account: AccountInfo | null) => void;
    placeholder?: string;
    style?: React.CSSProperties;
}> = ({ accounts, selectedCode, onSelect, placeholder, style }) => {
    const [aberto, setAberto] = useState(false);
    const [busca, setBusca] = useState('');
    const [ativo, setAtivo] = useState(0);
    const wrapRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const comReduzido = React.useMemo(
        () => accounts
            .filter(a => !!a.reducedCode)
            .sort((a, b) => (a.reducedCode as string).localeCompare(b.reducedCode as string, undefined, { numeric: true })),
        [accounts]
    );

    const selecionada = selectedCode ? accounts.find(a => a.code === selectedCode) : undefined;
    const valorSelecionado = selecionada?.reducedCode || '';

    const filtradas = (busca
        ? comReduzido.filter(a => (a.reducedCode as string).startsWith(busca))
        : comReduzido
    ).slice(0, 30);

    const escolher = (a: AccountInfo) => {
        onSelect(a);
        setBusca(a.reducedCode || '');
        setAberto(false);
    };

    return (
        <div ref={wrapRef} style={{ position: 'relative' }}>
            <input
                type="text"
                inputMode="numeric"
                value={aberto ? busca : valorSelecionado}
                placeholder={placeholder}
                onFocus={() => { setAberto(true); setBusca(valorSelecionado); setAtivo(0); }}
                onChange={e => {
                    const digitos = e.target.value.replace(/\D/g, '');
                    setBusca(digitos);
                    setAtivo(0);
                    if (!digitos && valorSelecionado) onSelect(null);
                }}
                onKeyDown={e => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo(i => Math.min(i + 1, Math.max(filtradas.length - 1, 0))); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo(i => Math.max(i - 1, 0)); }
                    else if (e.key === 'Enter') {
                        e.preventDefault();
                        const alvo = filtradas.find(a => a.reducedCode === busca) || filtradas[ativo];
                        if (alvo) escolher(alvo);
                    }
                    else if (e.key === 'Escape') setAberto(false);
                }}
                style={style}
            />
            {aberto && filtradas.length > 0 && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, minWidth: 380, zIndex: 40, background: '#fff',
                    border: '1px solid #E5E7EB', borderRadius: 6, marginTop: 2, maxHeight: 240, overflowY: 'auto',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}>
                    {filtradas.map((a, i) => (
                        <div
                            key={a.id}
                            onMouseDown={e => e.preventDefault()}
                            onMouseEnter={() => setAtivo(i)}
                            onClick={() => escolher(a)}
                            style={{
                                padding: '6px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '0.5px solid #F5F5F5',
                                display: 'flex', gap: 8, alignItems: 'baseline', background: i === ativo ? '#EFF6FF' : '#fff',
                            }}
                        >
                            <span style={{ fontFamily: 'monospace', color: '#1D4ED8', fontWeight: 700, minWidth: 42 }}>{a.reducedCode}</span>
                            <span style={{ fontFamily: 'monospace', color: '#6B7280', fontSize: 11 }}>{a.code}</span>
                            <span style={{ color: '#111' }}>{a.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Página ─────────────────────────────────────────────────────
const RazaoAnaliticoPage: React.FC = () => {
    const { activeCompany } = useCompany();
    const [filters, setFilters] = useState<F>(() => { const yr = getActiveYear(); return { ...DEF, startDate: yr + '-01-01', endDate: yr + '-12-31' }; });
    const [reportData, setReportData] = useState<ReportData | null>(null);
    React.useEffect(() => { if (activeCompany) { setReportData(null); } }, [activeCompany?.id]);
    const [allEntries, setAllEntries] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // A ReportToolbar e sticky (top:12, zIndex 40) e cobria a barra de filtros
    // (sticky em top:0). Mede a altura real da toolbar e encaixa a barra logo abaixo.
    const [stickyTop, setStickyTop] = useState(84);
    React.useEffect(() => {
        const el = document.querySelector('.report-toolbar') as HTMLElement | null;
        if (!el) return;
        const upd = () => setStickyTop(12 + el.offsetHeight + 8);
        upd();
        const ro = new ResizeObserver(upd);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // NOVO (16/09/2026): contas pro autocomplete de "Conta unica" - busca
    // independente do relatorio gerado (Plano de Contas), pra funcionar
    // mesmo antes de clicar em "Gerar Razao" pela primeira vez. Achado
    // real: usando so reportData.balances, a lista ficava vazia ate o
    // primeiro relatorio ser gerado.
    const [allAccounts, setAllAccounts] = useState<AccountInfo[]>([]);
    React.useEffect(() => {
        if (!activeCompany?.id) { setAllAccounts([]); return; }
        api.get('/chart-of-accounts', { params: { onlyAnalytic: true, limit: 1000 } })
            .then(r => setAllAccounts(r.data?.items || []))
            .catch(() => setAllAccounts([]));
    }, [activeCompany?.id]);

    // ── Load exclusivamente baseado em lançamentos ─────────────
    const load = useCallback(async (f: F) => {
        if (!activeCompany) return;
        setLoading(true); setError(''); setReportData(null);
        try {
            // Busca todos os lançamentos desde o início até o fim do período
            // para calcular saldo anterior (antes de startDate) e movimentos do período
            let allJournal: JournalEntry[] = [];
            let pg = 1;
            while (true) {
                const r = await api.get('/accounting/journal', {
                    params: { dateFrom: '1900-01-01', dateTo: f.endDate, page: pg, limit: 500 },
                });
                allJournal = [...allJournal, ...(r.data.entries || [])];
                if (pg >= r.data.pages) break;
                pg++;
            }

            // Filtro de fonte em memória (mesmo padrão do Diário Geral) -
            // aplicado antes de separar saldo anterior/período, pra manter
            // as duas partes consistentes com o mesmo conjunto de fontes.
            if (f.sources.length > 0) {
                allJournal = allJournal.filter(e => f.sources.includes(e.sourceModule));
            }

            // Separa lançamentos antes e dentro do período
            const beforePeriod = allJournal.filter(e => e.date.substring(0, 10) < f.startDate);
            const inPeriod = allJournal.filter(e => e.date.substring(0, 10) >= f.startDate);

            // Acumula por conta
            const accMap = new
                Map<string, {
                    account: AccountInfo;
                    prevD: number; prevC: number;
                    perD: number; perC: number;
                }>();

            const accumulate = (entries: JournalEntry[], field: 'prev' | 'per') => {
                // LOG 1: Ver se as entradas de 2014 realmente chegaram no front-end
                if (field === 'prev') {
                    console.log(`[SALDO ANTERIOR] Processando ${entries.length} lançamentos de períodos passados.`);
                }
                entries.forEach(entry => {
                    entry.items.forEach(item => {
                        if (!item.account) return;
                        if (!accMap.has(item.accountId)) {
                            accMap.set(item.accountId, {
                                account: item.account,
                                prevD: 0, prevC: 0, perD: 0, perC: 0,
                            });
                        }
                        const acc = accMap.get(item.accountId)!;
                        if (field === 'prev') {
                            if (item.type === 'DEBIT') acc.prevD += Number(item.value);
                            else acc.prevC += Number(item.value);
                        } else {
                            if (item.type === 'DEBIT') acc.perD += Number(item.value);
                            else acc.perC += Number(item.value);
                        }
                    });
                });
            };

            accumulate(beforePeriod, 'prev');
            accumulate(inPeriod, 'per');

            // Converte para BalanceRow — só contas analíticas
            const balances: BalanceRow[] = Array.from(accMap.values())

                .filter(a => a.account.isAnalytic === true)
                .map(({ account, prevD, prevC, perD, perC }) => {
                    const previousBalance = account.nature === 'DEBIT'
                        ? prevD - prevC
                        : prevC - prevD;
                    const currentBalance = account.nature === 'DEBIT'
                        ? (prevD + perD) - (prevC + perC)
                        : (prevC + perC) - (prevD + perD);
                    return { account, previousBalance, debits: perD, credits: perC, currentBalance };
                })
                .filter(r => f.showZero || r.debits !== 0 || r.credits !== 0)
                .sort((a, b) => a.account.code.localeCompare(b.account.code));

            setReportData({ startDate: f.startDate, endDate: f.endDate, balances });
            setAllEntries(inPeriod);
        } catch (e: any) {
            setError(e.response?.data?.message || 'Erro ao carregar.');
        } finally { setLoading(false); }
    }, [activeCompany]);

    // Filtro local por conta/nome
    const rows = React.useMemo((): BalanceRow[] => {
        if (!reportData?.balances) return [];
        let list = [...reportData.balances];

        if (filters.filterMode === 'one' && filters.accountFrom)
            list = list.filter(r => r.account.code === filters.accountFrom);
        else if (filters.filterMode === 'list' && filters.accountList) {
            const codes = filters.accountList.split(';').map((c: string) => c.trim()).filter(Boolean);
            list = list.filter(r => codes.some((c: string) => r.account.code === c || r.account.reducedCode === c));
        }
        else if (filters.filterMode === 'range' && filters.accountFrom)
            list = list.filter(r =>
                r.account.code >= filters.accountFrom &&
                (!filters.accountTo || r.account.code <= filters.accountTo)
            );

        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            list = list.filter(r =>
                r.account.code.toLowerCase().includes(q) ||
                r.account.name.toLowerCase().includes(q)
            );
        }
        return list;
    }, [reportData, filters, searchTerm]);

    // Mapa: accountId → lançamentos do período ordenados por data
    const entriesByAccount = React.useMemo(() => {
        const map = new Map<string, JournalEntry[]>();
        allEntries.forEach(entry => {
            const seen = new Set<string>();
            entry.items.forEach(item => {
                if (seen.has(item.accountId)) return;
                seen.add(item.accountId);
                if (!map.has(item.accountId)) map.set(item.accountId, []);
                map.get(item.accountId)!.push(entry);
            });
        });
        map.forEach((entries, key) => {
            map.set(key, [...entries].sort((a, b) => a.date.localeCompare(b.date)));
        });
        return map;
    }, [allEntries]);

    const seqMap = React.useMemo(() => buildSeqMap(allEntries), [allEntries]);

    // Fonte unica de verdade para a coluna "Lote/Lcto" - usada pela tela,
    // pela impressao e pelo export CSV, garantindo que os tres nunca
    // divirjam na interpretacao do mesmo dado (achado real: a impressao
    // e o CSV ficaram desatualizados apos a tela ser corrigida, ate este
    // ponto).
    const loteLctoLabel = (entry: JournalEntry): string => {
        const lcto = seqMap.get(entry.id) || '';
        return entry.lote ? `${entry.lote.numero}/${lcto}` : lcto;
    };

    // Totais gerais
    const totPrev = rows.reduce((s, r) => s + r.previousBalance, 0);
    const totD = rows.reduce((s, r) => s + r.debits, 0);
    const totC = rows.reduce((s, r) => s + r.credits, 0);
    const totFin = rows.reduce((s, r) => s + r.currentBalance, 0);

    const printLivroRazao = () => {
        if (!reportData || !activeCompany) return;
        const empresa = activeCompany.legalName || activeCompany.tradeName || '';
        const cnpj = (activeCompany.taxId || '').replace(/\D/g,'').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5');
        const periodo = filters.startDate.split('-').reverse().join('/') + ' a ' + filters.endDate.split('-').reverse().join('/');
        const raizCnpj = (activeCompany.taxId || '').replace(/\D/g, '').substring(0, 8).replace(/(\d{2})(\d{3})(\d{3})/, '$1.$2.$3');
        const prefixoArq = raizCnpj.length === 10 ? raizCnpj : (activeCompany.tradeName || activeCompany.legalName || '');
        let escopoArq = 'Razão Completo';
        if (filters.filterMode === 'one' && filters.accountFrom) escopoArq = 'Razão Conta ' + filters.accountFrom;
        else if (filters.filterMode === 'range' && filters.accountFrom) escopoArq = 'Razão Contas ' + filters.accountFrom + (filters.accountTo ? ' a ' + filters.accountTo : ' em diante');
        else if (filters.filterMode === 'list' && filters.accountList) escopoArq = 'Razão Contas selecionadas';
        const periodoArq = filters.startDate.split('-').reverse().join('-') + ' a ' + filters.endDate.split('-').reverse().join('-');
        const tituloArquivo = (prefixoArq + ' - ' + escopoArq + ' - ' + periodoArq).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
        const hoje = new Date().toLocaleDateString('pt-BR');
        const hora = new Date().toLocaleTimeString('pt-BR');

        let body = '';
        rows.forEach(function(row) {
            const a = row.account;
            const accountEntries = entriesByAccount.get(a.id) || [];
            let saldo = row.previousBalance;

            body += "<div class='conta-bloco'>";
            body += "<div class='conta-header'>";
            body += "<div class='conta-info'>";
            body += "<span class='conta-code'>" + a.code + "</span>";
            if (a.reducedCode) body += "<span class='conta-red'>" + a.reducedCode + "</span>";
            body += "<span class='conta-name'>" + a.name + "</span>";
            body += "</div>";
            body += "<div class='saldo-anterior'>Saldo Anterior: <b>" + fmtSaldo(row.previousBalance) + "</b></div>";
            body += "</div>";

            if (accountEntries.length === 0) {
                body += "<div class='sem-movimento'>Sem movimentos no período</div>";
            } else {
                body += "<table><thead><tr><th class='w90'>Data</th><th>Histórico</th><th class='w80'>Lote/Lcto</th><th class='num w100'>Débito</th><th class='num w100'>Crédito</th><th class='num w110'>Saldo</th></tr></thead><tbody>";
                accountEntries.forEach(function(entry) {
                    const items = entry.items.filter(function(i) { return i.accountId === a.id; });
                    items.forEach(function(item) {
                        const val = Number(item.value);
                        const isD = item.type === 'DEBIT';
                        const nature = a.nature === 'DEBIT' ? 1 : -1;
                        saldo += (isD ? val : -val) * nature;
                        body += "<tr>";
                        body += "<td>" + entry.date.substring(0,10).split('-').reverse().join('/') + "</td>";
                        body += "<td class='hist'>" + (entry.description || '') + "</td>";
                        body += "<td>" + loteLctoLabel(entry) + "</td>";
                        body += "<td class='num'>" + (isD ? fmtSaldo(val) : '') + "</td>";
                        body += "<td class='num'>" + (!isD ? fmtSaldo(val) : '') + "</td>";
                        body += "<td class='num saldo-" + (saldo < 0 ? 'neg' : 'pos') + "'>" + fmtSaldo(saldo) + "</td>";
                        body += "</tr>";
                    });
                });
                body += "</tbody></table>";
            }

            body += "<div class='conta-footer'>";
            body += "<span>Débitos: <b>" + fmtSaldo(row.debits) + "</b></span>";
            body += "<span>Créditos: <b>" + fmtSaldo(row.credits) + "</b></span>";
            body += "<span>Saldo Final: <b>" + fmtSaldo(row.currentBalance) + "</b></span>";
            body += "</div>";
            body += "</div>";
        });

        const css =
            "@page{size:A4 portrait;margin:12mm 14mm}" +
            "body{font-family:Arial,sans-serif;font-size:9pt;color:#111;margin:0}" +
            ".header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:10px}" +
            ".header-left h2{margin:0;font-size:11pt}" +
            ".header-left p{margin:2px 0;font-size:8pt;color:#555}" +
            ".header-center{text-align:center;font-size:13pt;font-weight:700;letter-spacing:1px}" +
            ".header-right{text-align:right;font-size:8pt;color:#555}" +
            ".periodo{font-size:9pt;font-weight:600;border-bottom:0.5px solid #ccc;padding-bottom:4px;margin-bottom:8px}" +
            ".conta-bloco{margin-bottom:12px}" +
            ".conta-header,.sem-movimento{break-after:avoid;page-break-after:avoid}" +
            "thead{display:table-header-group}" +
            "tr{break-inside:avoid;page-break-inside:avoid}" +
            ".conta-footer{break-inside:avoid;page-break-inside:avoid}" +
            "@media screen{body{max-width:1000px;margin:0 auto;padding:16px}}" +
            ".conta-header{display:flex;justify-content:space-between;align-items:baseline;background:#F3F4F6;border-top:1px solid #374151;border-bottom:0.5px solid #D1D5DB;padding:3px 6px}" +
            ".conta-info{display:flex;align-items:baseline;gap:10px}" +
            ".conta-code{font-family:monospace;font-size:9pt;color:#1D4ED8;font-weight:700}" +
            ".conta-red{font-family:monospace;font-size:8pt;color:#6B7280;background:#E5E7EB;padding:0 4px;border-radius:3px}" +
            ".conta-name{font-size:9pt;font-weight:600;color:#111}" +
            ".saldo-anterior{font-size:9pt;color:#374151;white-space:nowrap}" +
            ".sem-movimento{color:#9CA3AF;font-style:italic;font-size:8pt;padding:4px 6px}" +
            "table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8pt}" +
            "th{padding:3px 5px;border-bottom:1px solid #111;text-align:left;font-weight:700;font-size:8pt}" +
            "td{padding:2px 5px;border-bottom:0.5px solid #F3F4F6}" +
            ".num{text-align:right;font-family:monospace}" +
            ".w90{width:62px}.w80{width:64px}.w100{width:82px}.w110{width:90px}" +
            ".hist{overflow-wrap:anywhere;word-break:break-word}" +
            ".saldo-neg{color:#B91C1C}" +
            ".saldo-pos{color:#111}" +
            ".conta-footer{display:flex;gap:20px;justify-content:flex-end;padding:3px 6px;font-size:8pt;border-top:1px solid #374151;background:#F9FAFB}" +
            ".totais{margin-top:10px;border-top:2px solid #111;padding-top:6px;display:flex;gap:20px;justify-content:flex-end;font-size:9pt}";

        const html =
            "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'/>" +
            "<title>" + tituloArquivo + "</title>" +
            "<style>" + css + "</style></head><body>" +
            "<div class='header'>" +
            "<div class='header-left'><h2>" + empresa + "</h2><p>CNPJ: " + cnpj + "</p></div>" +
            "<div class='header-center'>Razão Analítico</div>" +
            "<div class='header-right'><div>Data: " + hoje + "</div><div>Hora: " + hora + "</div></div>" +
            "</div>" +
            "<div class='periodo'>Período: " + periodo + " · " + rows.length + " contas</div>" +
            body +
            "<div class='totais'>" +
            "<span>Total Débitos: <b>" + fmtSaldo(totD) + "</b></span>" +
            "<span>Total Créditos: <b>" + fmtSaldo(totC) + "</b></span>" +
            "</div>" +
            "<script>window.onload=function(){window.print();}<\/script>" +
            "</body></html>";

        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
    };

    const exportCSV = () => {
        const lines = [['Conta', 'Red.', 'Nome', 'Saldo Anterior', 'Data', 'Histórico', 'Lote/Lcto', 'Débito', 'Crédito', 'Saldo']];
        rows.forEach(row => {
            const a = row.account;
            const accountEntries = entriesByAccount.get(a.id) || [];
            let saldo = row.previousBalance;
            lines.push([a.code, '—', `"${a.name}"`, fmtSaldo(row.previousBalance), '', '', '', '', '', '']);
            accountEntries.forEach(entry => {
                const items = entry.items.filter(i => i.accountId === a.id);
                items.forEach(item => {
                    const d = item.type === 'DEBIT' ? Number(item.value) : 0;
                    const c = item.type === 'CREDIT' ? Number(item.value) : 0;
                    saldo = a.nature === 'DEBIT' ? saldo + d - c : saldo - d + c;
                    lines.push(['', '', '', '', fmtDateFull(entry.date), `"${entry.description}"`, loteLctoLabel(entry), fmtNum(d, true), fmtNum(c, true), fmtSaldo(saldo)]);
                });
            });
            lines.push(['', '', '', 'Total da Conta:', '', '', '', fmtNum(row.debits), fmtNum(row.credits), fmtSaldo(row.currentBalance)]);
        });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['\uFEFF' + lines.map(l => l.join('|')).join('\n')], { type: 'text/csv;charset=utf-8' }));
        a.download = `RazaoAnalitico_${filters.startDate}_${filters.endDate}.csv`;
        a.click();
    };

    const TD: React.CSSProperties = {
        padding: '2px 6px', fontSize: 13, color: '#111',
        borderBottom: '0.5px solid #F3F4F6', verticalAlign: 'top', lineHeight: '1.4',
    };

    return (
        <div style={{ padding: '8px 24px 24px', background: 'var(--color-background-tertiary)', minHeight: '100vh' }}>

            {/* Toolbar flutuante */}
            <ReportToolbar
                title="Razão Analítico"
                dateFrom={filters.startDate}
                dateTo={filters.endDate}
                count={rows.length}
                countLabel="contas"
                onPeriodChange={(from, to) => {
                    const f = { ...filters, startDate: from, endDate: to };
                    setFilters(f);
                    load(f);
                }}
                onFilter={() => load(filters)}
                filterLabel={loading ? 'Gerando...' : 'Gerar Razão'}
                onPrint={printLivroRazao}
                onExportCSV={reportData ? exportCSV : undefined}
                hasData={!!reportData}
            />

            {/* NOVO (16/09/2026): card compacto fixo (sticky) no topo, no lugar
                do modal antigo. Selecao de contas e "Sem movimento" ja aplicam
                na hora (rows() ja reage a mudanca de filters em memoria, sem
                precisar recarregar do servidor); Fonte precisa clicar
                "Gerar Razao" pois muda o que e buscado da API. */}
            <div style={{
                position: 'sticky', top: stickyTop, zIndex: 30, background: '#fff', border: '0.5px solid #E5E7EB',
                borderRadius: 10, padding: '8px 14px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#374151', cursor: 'pointer', height: 30 }}>
                        <input
                            type="checkbox"
                            checked={filters.filterMode === 'all'}
                            onChange={e => setFilters(prev => e.target.checked
                                ? { ...prev, filterMode: 'all', accountFrom: '', accountList: '' }
                                : { ...prev, filterMode: 'one' })}
                            style={{ accentColor: '#2563EB' }}
                        />
                        Todas as Contas
                    </label>
                    <div style={{ width: 200 }}>
                        <label style={{ fontSize: 10, color: '#9CA3AF', display: 'block', marginBottom: 2, textTransform: 'uppercase' }}>Conta única</label>
                        <AccountAutocomplete
                            accounts={allAccounts}
                            value={filters.filterMode === 'one' ? filters.accountFrom : ''}
                            onChange={v => {
                                setFilters(prev => (!v && !prev.accountList)
                                    ? { ...prev, filterMode: 'all', accountFrom: '' }
                                    : { ...prev, filterMode: 'one', accountFrom: v, accountList: '' });
                            }}
                            placeholder="Código ou nome..."
                            style={{ height: 30, border: '0.5px solid #E5E7EB', borderRadius: 6, padding: '0 8px', fontSize: 12, outline: 'none', background: '#fff', width: '100%' }}
                        />
                    </div>
                    <div style={{ width: 110 }}>
                        <label style={{ fontSize: 10, color: '#9CA3AF', display: 'block', marginBottom: 2, textTransform: 'uppercase' }}>Cód. reduzido</label>
                        <ReducedCodeAutocomplete
                            accounts={allAccounts}
                            selectedCode={filters.filterMode === 'one' ? filters.accountFrom : ''}
                            onSelect={a => setFilters(prev => a
                                ? { ...prev, filterMode: 'one', accountFrom: a.code, accountList: '' }
                                : (prev.filterMode === 'one' ? { ...prev, filterMode: 'all', accountFrom: '' } : prev))}
                            placeholder="Ex: 1003"
                            style={{ height: 30, border: '0.5px solid #E5E7EB', borderRadius: 6, padding: '0 8px', fontSize: 12, outline: 'none', background: '#fff', width: '100%', fontFamily: 'monospace' }}
                        />
                    </div>
                    <div style={{ width: 240 }}>
                        <label style={{ fontSize: 10, color: '#9CA3AF', display: 'block', marginBottom: 2, textTransform: 'uppercase' }}>Várias contas (separadas por ;)</label>
                        <input
                            type="text"
                            value={filters.filterMode === 'list' ? filters.accountList : ''}
                            placeholder="Ex: 11102010001;11104030002"
                            onChange={e => {
                                const v = e.target.value;
                                setFilters(prev => (!v && !prev.accountFrom)
                                    ? { ...prev, filterMode: 'all', accountList: '' }
                                    : { ...prev, filterMode: 'list', accountList: v, accountFrom: '' });
                            }}
                            style={{ height: 30, border: '0.5px solid #E5E7EB', borderRadius: 6, padding: '0 8px', fontSize: 12, outline: 'none', background: '#fff', width: '100%' }}
                        />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#374151', cursor: 'pointer', height: 30 }}>
                        <input type="checkbox" checked={filters.showZero} onChange={e => setFilters(prev => ({ ...prev, showZero: e.target.checked }))} style={{ accentColor: '#2563EB' }} />
                        Sem movimento
                    </label>
                    <div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>Fonte:</span>
                            {[['ECD_IMPORT', 'ECD'], ['ACCOUNTING', 'Manual'], ['PROVISION', 'Provisão'], ['BANK_IMPORT', 'Banco'], ['FISCAL', 'Fiscal'], ['JOURNAL_IMPORT', 'Importação']].map(([v, l]) => (
                                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={filters.sources.includes(v)}
                                        onChange={() => setFilters(prev => ({ ...prev, sources: prev.sources.includes(v) ? prev.sources.filter(x => x !== v) : [...prev.sources, v] }))}
                                        style={{ accentColor: '#2563EB' }}
                                    />{l}
                                </label>
                            ))}
                        </div>
                        <p style={{ fontSize: 9, color: '#D1D5DB', margin: '2px 0 0' }}>Nenhuma marcada = todas incluídas</p>
                    </div>
                    {reportData && (
                        <div style={{ position: 'relative', marginLeft: 'auto' }}>
                            <FiSearch size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Filtrar por código ou nome..."
                                style={{ height: 30, border: '0.5px solid #E5E7EB', borderRadius: 6, paddingLeft: 26, paddingRight: 10, fontSize: 12, width: 220, outline: 'none', background: '#fff' }} />
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 12, color: '#9CA3AF' }}>
                    <FiLoader size={20} /><span style={{ fontSize: 13 }}>Carregando razão analítico...</span>
                </div>
            ) : error ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 13 }}>
                    <FiAlertCircle size={14} /> {error}
                </div>
            ) : reportData && rows.length > 0 ? (
                <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '20px 28px', overflowX: 'auto' }}>

                        {/* Cabeçalho do relatório */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                <div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: '#111' }}>{activeCompany?.legalName || activeCompany?.tradeName}</div>
                                    <div style={{ fontSize: 18, color: '#9CA3AF', fontFamily: 'monospace' }}>CNPJ: {fmtCnpj(activeCompany?.taxId || '')}</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: '#111', letterSpacing: 1 }}>Razão Analítico</div>
                                </div>
                                <div style={{ textAlign: 'right', fontSize: 16, color: '#6B7280', lineHeight: 1.6 }}>
                                    <div>Data: {new Date().toLocaleDateString('pt-BR')}</div>
                                    <div>Hora: {new Date().toLocaleTimeString('pt-BR')}</div>
                                </div>
                            </div>
                            <div style={{ borderTop: '1px solid #111', borderBottom: '1px solid #111', padding: '4px 0', display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}>
                                <span>Consolidação: Empresa</span>
                                <span>Periodo: {fmtDateFull(filters.startDate)} a {fmtDateFull(filters.endDate)}</span>
                            </div>
                        </div>

                        {/* Cabeçalho das colunas */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 18, marginBottom: 8 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #374151' }}>
                                    <th style={{ padding: '5px 16px 5px 6px', fontSize: 15, fontWeight: 700, color: '#111', textAlign: 'left', width: 130 }}>Data</th>
                                    <th style={{ padding: '5px 6px', fontSize: 15, fontWeight: 700, color: '#111', textAlign: 'left' }}>Histórico</th>
                                    <th style={{ padding: '5px 6px', fontSize: 15, fontWeight: 700, color: '#111', textAlign: 'left', width: 80 }}>Lote/Lcto.</th>
                                    <th style={{ padding: '5px 14px', fontSize: 15, fontWeight: 700, color: '#111', textAlign: 'right', width: 130 }}>Débito</th>
                                    <th style={{ padding: '5px 14px', fontSize: 15, fontWeight: 700, color: '#111', textAlign: 'right', width: 130 }}>Crédito</th>
                                    <th style={{ padding: '5px 14px', fontSize: 15, fontWeight: 700, color: '#111', textAlign: 'right', width: 130 }}>Saldo</th>
                                </tr>
                            </thead>
                        </table>

                        {/* Contas */}
                        {rows.map(row => {
                            const a = row.account;
                            const accountEntries = entriesByAccount.get(a.id) || [];
                            let saldo = row.previousBalance;

                            return (
                                <div key={a.id} style={{ marginBottom: 16 }}>
                                    {/* Cabeçalho da conta */}
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                                        borderTop: '0.5px solid #374151', borderBottom: '0.5px solid #E5E7EB',
                                        padding: '4px 6px', background: '#FAFAFA',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 15, fontSize: 15, fontWeight: 700, color: '#111' }}>
                                            <span>Conta: <span style={{ fontFamily: 'monospace', fontSize: 15, color: '#1D4ED8' }}>{a.code}</span></span>
                                            <span style={{ fontWeight: 400, fontSize: 15, color: '#6B7280' }}>Red.: <span style={{ fontFamily: 'monospace', color: '#374151' }}>{a.reducedCode || '—'}</span></span>
                                            <span style={{ fontWeight: 600, fontSize: 15, color: '#374151' }}>{a.name}</span>
                                        </div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>
                                            Saldo Anterior:&nbsp;
                                            <span style={{ fontFamily: 'monospace', color: row.previousBalance < 0 ? '#B91C1C' : '#111' }}>
                                                {fmtSaldo(row.previousBalance)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Lançamentos */}
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
                                        <tbody>
                                            {accountEntries.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} style={{ ...TD, color: '#D1D5DB', fontStyle: 'italic', textAlign: 'center', padding: 6 }}>
                                                        Sem movimentos no período
                                                    </td>
                                                </tr>
                                            ) : accountEntries.map(entry => {
                                                const items = entry.items.filter(i => i.accountId === a.id);
                                                return items.map((item, itemIdx) => {
                                                    const d = item.type === 'DEBIT' ? Number(item.value) : 0;
                                                    const c = item.type === 'CREDIT' ? Number(item.value) : 0;
                                                    saldo = a.nature === 'DEBIT' ? saldo + d - c : saldo - d + c;
                                                    return (
                                                        <tr key={`${entry.id}-${itemIdx}`}
                                                            onMouseEnter={e => e.currentTarget.style.background = '#F0F9FF'}
                                                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                                                            <td style={{ ...TD, width: 130, paddingRight: 16, fontSize: 18, fontFamily: 'monospace', color: '#6B7280', whiteSpace: 'nowrap' }}>
                                                                {fmtDateFull(entry.date)}
                                                            </td>
                                                            <td style={{ ...TD, paddingLeft: 16, fontSize: 18, color: '#374151' }}>
                                                                {entry.description}
                                                            </td>
                                                            <td style={{ ...TD, width: 80, fontSize: 16, fontFamily: 'monospace', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                                                                {loteLctoLabel(entry)}
                                                            </td>
                                                            <td style={{ ...TD, width: 130, padding: '2px 14px', textAlign: 'right', fontSize: 18, fontFamily: 'monospace', color: d > 0 ? '#111' : '#D1D5DB' }}>
                                                                {d > 0 ? fmtNum(d) : ''}
                                                            </td>
                                                            <td style={{ ...TD, width: 130, padding: '2px 14px', textAlign: 'right', fontSize: 18, fontFamily: 'monospace', color: c > 0 ? '#111' : '#D1D5DB' }}>
                                                                {c > 0 ? fmtNum(c) : ''}
                                                            </td>
                                                            <td style={{ ...TD, width: 130, padding: '2px 14px', textAlign: 'right', fontSize: 18, fontFamily: 'monospace', fontWeight: 500, color: saldo < 0 ? '#B91C1C' : '#111' }}>
                                                                {fmtSaldo(saldo)}
                                                            </td>
                                                        </tr>
                                                    );
                                                });
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ borderTop: '0.5px solid #374151' }}>
                                                <td colSpan={3} style={{ padding: '4px 6px', fontSize: 18, fontWeight: 700, color: '#374151', textAlign: 'right' }}>
                                                    Total da Conta:
                                                </td>
                                                <td style={{ padding: '4px 14px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, fontSize: 18, color: '#111', width: 130 }}>
                                                    {fmtNum(row.debits)}
                                                </td>
                                                <td style={{ padding: '4px 14px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, fontSize: 18, color: '#111', width: 130 }}>
                                                    {fmtNum(row.credits)}
                                                </td>
                                                <td style={{ padding: '4px 14px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, fontSize: 18, color: row.currentBalance < 0 ? '#B91C1C' : '#111', width: 130 }}>
                                                    {fmtSaldo(row.currentBalance)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            );
                        })}

                        {/* Totais Gerais */}
                        <div style={{ borderTop: '2px solid #111', paddingTop: 8, marginTop: 8 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <tbody>
                                    <tr>
                                        <td colSpan={3} style={{ padding: '6px', fontSize: 13, fontWeight: 700, color: '#111', textAlign: 'right' }}>
                                            Totais Gerais · {rows.length} contas:
                                        </td>
                                        <td style={{ padding: '6px 14px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#1D4ED8', width: 130 }}>
                                            {fmtNum(totD)}
                                        </td>
                                        <td style={{ padding: '6px 14px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#15803D', width: 130 }}>
                                            {fmtNum(totC)}
                                        </td>
                                        <td style={{ padding: '6px 14px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, fontSize: 13, color: totFin < 0 ? '#B91C1C' : '#111', width: 130 }}>
                                            {fmtSaldo(totFin)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                    </div>
                </div>
            ) : reportData ? (
                <div style={{ textAlign: 'center', padding: 80, border: '0.5px dashed #E5E7EB', borderRadius: 10, color: '#9CA3AF', fontSize: 13 }}>
                    Nenhuma conta analítica com movimento no período selecionado.
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: 80, border: '0.5px dashed #E5E7EB', borderRadius: 10, color: '#9CA3AF', fontSize: 13 }}>
                    Escolha o período e os filtros acima e clique em "Gerar Razão".
                </div>
            )}
        </div>
    );
};

export default RazaoAnaliticoPage;



