import React, { useState, useEffect, useMemo, useCallback } from "react";
import api from "../../services/api";
import { useCompany } from "../../contexts/CompanyContext";
import { SmartMonthInput } from "../../components/SmartMonthInput";
import { FiAlertCircle, FiCheckCircle, FiClock, FiDownload, FiFilter, FiRefreshCw } from "react-icons/fi";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Status = "PENDING" | "IN_PROGRESS" | "DONE" | "OVERDUE";
type Regime = "TODOS" | "LP_LR" | "SN" | "MEI";

interface ObrigacaoConfig {
  code: string;
  label: string;
  regime: Regime[];
  calcDue: (year: number, month: number) => Date;
}

interface ObrigacaoItem {
  id: string;
  code: string;
  label: string;
  companyId: string;
  companyName: string;
  regime: string;
  competence: string; // YYYY-MM
  dueDate: Date;
  status: Status;
  notes?: string;
}

// ─── Tipo empresa local ──────────────────────────────────────────────────────
interface EmpresaLocal { id: string; name: string; regime: Regime; }

// ─── Helpers de data ──────────────────────────────────────────────────────────
function lastWorkingDay(year: number, month: number): Date {
  const d = new Date(year, month, 0); // último dia do mês
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d;
}
function nextDay(year: number, month: number, day: number): Date {
  const d = new Date(year, month - 1, day);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}
function addMonths(year: number, month: number, add: number): [number, number] {
  const d = new Date(year, month - 1 + add, 1);
  return [d.getFullYear(), d.getMonth() + 1];
}

// ─── Catálogo de obrigações ───────────────────────────────────────────────────
const OBRIGACOES_CONFIG: ObrigacaoConfig[] = [
  {
    code: "FGTS",
    label: "FGTS Mensal",
    regime: ["TODOS", "LP_LR", "SN", "MEI"],
    calcDue: (y, m) => { const [ny, nm] = addMonths(y, m, 1); return nextDay(ny, nm, 7); },
  },
  {
    code: "GPS_INSS",
    label: "GPS — INSS Patronal",
    regime: ["TODOS", "LP_LR", "SN"],
    calcDue: (y, m) => { const [ny, nm] = addMonths(y, m, 1); return nextDay(ny, nm, 15); },
  },
  {
    code: "DARF_PIS",
    label: "DARF — PIS/Pasep",
    regime: ["LP_LR"],
    calcDue: (y, m) => { const [ny, nm] = addMonths(y, m, 1); return nextDay(ny, nm, 25); },
  },
  {
    code: "DARF_COFINS",
    label: "DARF — COFINS",
    regime: ["LP_LR"],
    calcDue: (y, m) => { const [ny, nm] = addMonths(y, m, 1); return nextDay(ny, nm, 25); },
  },
  {
    code: "DARF_CSLL",
    label: "DARF — CSLL",
    regime: ["LP_LR"],
    calcDue: (y, m) => { const [ny, nm] = addMonths(y, m, 1); return lastWorkingDay(ny, nm); },
  },
  {
    code: "DARF_IRPJ",
    label: "DARF — IRPJ",
    regime: ["LP_LR"],
    calcDue: (y, m) => { const [ny, nm] = addMonths(y, m, 1); return lastWorkingDay(ny, nm); },
  },
  {
    code: "DAS",
    label: "DAS — Simples Nacional",
    regime: ["SN"],
    calcDue: (y, m) => { const [ny, nm] = addMonths(y, m, 1); return nextDay(ny, nm, 20); },
  },
  {
    code: "ESOCIAL",
    label: "eSocial — Folha",
    regime: ["TODOS", "LP_LR", "SN"],
    calcDue: (y, m) => { const [ny, nm] = addMonths(y, m, 1); return nextDay(ny, nm, 7); },
  },
  {
    code: "DCTF",
    label: "DCTF Mensal",
    regime: ["LP_LR"],
    calcDue: (y, m) => { const [ny, nm] = addMonths(y, m, 2); return nextDay(ny, nm, 15); },
  },
  {
    code: "SPED_FISCAL",
    label: "SPED Fiscal (EFD ICMS/IPI)",
    regime: ["LP_LR"],
    calcDue: (y, m) => { const [ny, nm] = addMonths(y, m, 1); return nextDay(ny, nm, 25); },
  },
];

// Obrigações anuais (competência = ano, não mês)
const OBRIGACOES_ANUAIS: ObrigacaoConfig[] = [
  {
    code: "ECD",
    label: "ECD — Escrituração Contábil Digital",
    regime: ["TODOS", "LP_LR"],
    calcDue: (y) => nextDay(y + 1, 7, 31),
  },
  {
    code: "ECF",
    label: "ECF — Escrituração Contábil Fiscal",
    regime: ["LP_LR"],
    calcDue: (y) => nextDay(y + 1, 7, 31),
  },
  {
    code: "DIRF",
    label: "DIRF — Declaração IR na Fonte",
    regime: ["TODOS", "LP_LR", "SN"],
    calcDue: (y) => lastWorkingDay(y + 1, 2),
  },
  {
    code: "DEFIS",
    label: "DEFIS — Declaração Simples Nacional",
    regime: ["SN"],
    calcDue: (y) => nextDay(y + 1, 3, 31),
  },
  {
    code: "RAIS",
    label: "RAIS — Relação Anual de Info Sociais",
    regime: ["TODOS", "LP_LR", "SN"],
    calcDue: (y) => nextDay(y + 1, 4, 5),
  },
];

// ─── Geração das obrigações para o mês ───────────────────────────────────────
function gerarObrigacoes(competence: string, empresas: EmpresaLocal[]): ObrigacaoItem[] {
  const [yearStr, monthStr] = competence.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const items: ObrigacaoItem[] = [];
  const today = new Date();
  empresas.forEach((emp) => {
    OBRIGACOES_CONFIG.forEach((cfg) => {
      const aplicavel =
        cfg.regime.includes("TODOS") ||
        cfg.regime.includes(emp.regime as Regime);
      if (!aplicavel) return;

      const dueDate = cfg.calcDue(year, month);
      const storageKey = `ledgr:obrig:${emp.id}:${cfg.code}:${competence}`;
      const savedStatus = localStorage.getItem(storageKey) as Status | null;

      let status: Status = savedStatus ?? (dueDate < today ? "OVERDUE" : "PENDING");

      items.push({
        id: `${emp.id}-${cfg.code}-${competence}`,
        code: cfg.code,
        label: cfg.label,
        companyId: emp.id,
        companyName: emp.name,
        regime: emp.regime,
        competence,
        dueDate,
        status,
      });
    });

    // Anuais — só mostra se o mês for dezembro (ano de competência) ou janeiro próximo
    if (month === 12 || month === 1) {
      const refYear = month === 12 ? year : year - 1;
      OBRIGACOES_ANUAIS.forEach((cfg) => {
        const aplicavel =
          cfg.regime.includes("TODOS") ||
          cfg.regime.includes(emp.regime as Regime);
        if (!aplicavel) return;
        const dueDate = cfg.calcDue(refYear, 12);
        const storageKey = `ledgr:obrig:${emp.id}:${cfg.code}:${refYear}`;
        const savedStatus = localStorage.getItem(storageKey) as Status | null;
        const status: Status = savedStatus ?? (dueDate < today ? "OVERDUE" : "PENDING");
        items.push({
          id: `${emp.id}-${cfg.code}-${refYear}`,
          code: cfg.code,
          label: cfg.label,
          companyId: emp.id,
          companyName: emp.name,
          regime: emp.regime,
          competence: String(refYear),
          dueDate,
          status,
        });
      });
    }
  });

  return items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

// ─── Status UI helpers ────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; iconName: string }> = {
  PENDING:     { label: "Pendente",     color: "text-slate-600",   bg: "bg-slate-100",   iconName: "clock" },
  IN_PROGRESS: { label: "Em andamento", color: "text-amber-700",   bg: "bg-amber-100",   iconName: "refresh" },
  DONE:        { label: "Cumprida",     color: "text-emerald-700", bg: "bg-emerald-100", iconName: "check" },
  OVERDUE:     { label: "Vencida",      color: "text-red-700",     bg: "bg-red-100",     iconName: "alert" },
};

const STATUS_CYCLE: Record<Status, Status> = {
  PENDING: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  DONE: "PENDING",
  OVERDUE: "DONE",
};

function fmt(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function diasRestantes(d: Date): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function ObrigacoesPage() {
  const today = new Date();
  const defaultComp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const { activeCompany, companies } = useCompany();
  const EMPRESAS: EmpresaLocal[] = companies.map(c => ({ id: c.id, name: c.tradeName || c.legalName, regime: "LP_LR" as Regime }));
  const [competence, setCompetence] = useState(defaultComp);
  const [filterEmpresa, setFilterEmpresa] = useState("TODAS");
  const [filterStatus, setFilterStatus] = useState<Status | "TODAS">("TODAS");
  const [filterCodigo, setFilterCodigo] = useState("");
  const [items, setItems] = useState<ObrigacaoItem[]>([]);
  const [syncing, setSyncing] = useState(false);

  const loadAndSync = useCallback(async () => {
    const gerados = gerarObrigacoes(competence, EMPRESAS);
    setItems(gerados);
    if (!activeCompany) return;
    setSyncing(true);
    try {
      await api.post(`/finance/obrigacoes/gerar/${competence}`);
      const r = await api.get(`/finance/obrigacoes?competence=${competence}`);
      const salvos: Record<string, string> = {};
      (r.data as any[]).forEach((o: any) => { salvos[o.code + "|" + o.competence] = o.status; });
      setItems(prev => prev.map(it => {
        if (it.companyId !== activeCompany.id) return it;
        const key = it.code + "|" + it.competence;
        return salvos[key] ? { ...it, status: salvos[key] as Status } : it;
      }));
    } catch { /* mantém status gerado */ }
    setSyncing(false);
  }, [competence, activeCompany]);

  useEffect(() => { loadAndSync(); }, [loadAndSync]);


  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (filterEmpresa !== "TODAS" && it.companyId !== filterEmpresa) return false;
      if (filterStatus !== "TODAS" && it.status !== filterStatus) return false;
      if (filterCodigo && !it.label.toLowerCase().includes(filterCodigo.toLowerCase()) && !it.code.toLowerCase().includes(filterCodigo.toLowerCase())) return false;
      return true;
    });
  }, [items, filterEmpresa, filterStatus, filterCodigo]);

  const kpis = useMemo(() => ({
    vencidas: items.filter(i => i.status === "OVERDUE").length,
    andamento: items.filter(i => i.status === "IN_PROGRESS").length,
    pendentes: items.filter(i => i.status === "PENDING").length,
    cumpridas: items.filter(i => i.status === "DONE").length,
    total: items.length,
    vencendo7d: items.filter(i => { const d = diasRestantes(i.dueDate); return d >= 0 && d <= 7 && i.status !== "DONE"; }).length,
  }), [items]);

  async function toggleStatus(item: ObrigacaoItem) {
    const next = STATUS_CYCLE[item.status];
    // Atualizar UI imediatamente (optimistic)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: next } : i));
    // Persistir no banco apenas para a empresa ativa
    if (activeCompany && item.companyId === activeCompany.id) {
      try {
        await api.patch(`/finance/obrigacoes/${item.code}/${item.competence}`, { status: next });
      } catch { /* silencioso — UI já atualizou */ }
    }
  }

  function exportCSV() {
    const header = "Empresa,Código,Obrigação,Competência,Vencimento,Status";
    const rows = filtered.map(i =>
      `"${i.companyName}","${i.code}","${i.label}","${i.competence}","${fmt(i.dueDate)}","${STATUS_CONFIG[i.status].label}"`
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `obrigacoes-${competence}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const progresso = kpis.total > 0 ? Math.round((kpis.cumpridas / kpis.total) * 100) : 0;

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Calendário de Obrigações</h1>
          <p className="text-sm text-slate-500 mt-0.5">Declarações, recolhimentos e obrigações acessórias</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition"
        >
          <FiDownload size={14} /> Exportar CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Vencidas", value: kpis.vencidas, color: "text-red-600", bg: "bg-red-50 border-red-200" },
          { label: "Vencendo em 7d", value: kpis.vencendo7d, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
          { label: "Em andamento", value: kpis.andamento, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
          { label: "Pendentes", value: kpis.pendentes, color: "text-slate-600", bg: "bg-slate-50 border-slate-200" },
          { label: "Cumpridas", value: kpis.cumpridas, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
          { label: "Progresso", value: `${progresso}%`, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Barra de progresso */}
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${progresso}%` }}
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Competência</label>
          <SmartMonthInput
            value={competence}
            onChange={v => v && setCompetence(v)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Empresa</label>
          <select
            value={filterEmpresa}
            onChange={e => setFilterEmpresa(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="TODAS">Todas as empresas</option>
            {EMPRESAS.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Status</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as Status | "TODAS")}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="TODAS">Todos</option>
            <option value="OVERDUE">Vencidas</option>
            <option value="IN_PROGRESS">Em andamento</option>
            <option value="PENDING">Pendentes</option>
            <option value="DONE">Cumpridas</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Buscar obrigação</label>
          <input
            value={filterCodigo}
            onChange={e => setFilterCodigo(e.target.value)}
            placeholder="FGTS, DARF, ECD..."
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-52"
          />
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400 ml-auto">
          <FiFilter size={12} /> {filtered.length} de {items.length} obrigações
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Empresa</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Obrigação</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Competência</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vencimento</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Prazo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">Nenhuma obrigação encontrada</td></tr>
            )}
            {filtered.map(item => {
              const dias = diasRestantes(item.dueDate);
              const cfg = STATUS_CONFIG[item.status];
              const rowBg = item.status === "OVERDUE" ? "bg-red-50/40" : item.status === "DONE" ? "bg-emerald-50/20" : "";
              return (
                <tr key={item.id} className={`hover:bg-slate-50/60 transition ${rowBg}`}>
                  <td className="px-4 py-3 font-medium text-slate-800 text-xs">{item.companyName}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-700">{item.label}</span>
                    <span className="ml-2 text-xs text-slate-400 font-mono">{item.code}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs font-mono">{item.competence}</td>
                  <td className="px-4 py-3 text-slate-700 text-xs font-medium">{fmt(item.dueDate)}</td>
                  <td className="px-4 py-3">
                    {item.status === "DONE" ? (
                      <span className="text-xs text-emerald-600">—</span>
                    ) : dias < 0 ? (
                      <span className="text-xs font-semibold text-red-600">{Math.abs(dias)}d atraso</span>
                    ) : dias === 0 ? (
                      <span className="text-xs font-semibold text-amber-600">Hoje!</span>
                    ) : dias <= 7 ? (
                      <span className="text-xs font-semibold text-amber-500">{dias}d</span>
                    ) : (
                      <span className="text-xs text-slate-400">{dias}d</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleStatus(item)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition hover:opacity-80 ${cfg.color} ${cfg.bg}`}
                      title="Clique para avançar o status"
                    >
                      {cfg.iconName === "clock" && <FiClock size={13} />}{cfg.iconName === "refresh" && <FiRefreshCw size={13} />}{cfg.iconName === "check" && <FiCheckCircle size={13} />}{cfg.iconName === "alert" && <FiAlertCircle size={13} />} {cfg.label}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 text-center">
        Status salvo localmente por sessão. Fase 2 integrará com banco de dados.
      </p>
    </div>
  );
}



