import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertCircle, FiAlertTriangle, FiInfo, FiCheckCircle,
  FiChevronDown, FiChevronRight, FiArrowLeft, FiZap,
} from "react-icons/fi";
import api from "../../services/api";
import toast from "react-hot-toast";
import { SmartDateInput } from "../../components/SmartDateInput";
import { useCompany } from "../../contexts/CompanyContext";

const ECF_PREVALIDATE_LAST_YEAR_KEY = "ledgr_ecf_prevalidate_last_year";

function getDefaultEcfYear(): number {
  const stored = localStorage.getItem(ECF_PREVALIDATE_LAST_YEAR_KEY);
  const parsed = stored ? parseInt(stored, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
}

interface Check {
  id: string;
  level: "ERROR" | "WARNING" | "INFO";
  title: string;
  description: string;
  count?: number;
  details?: any[];
  action?: string;
}

interface PreValidateResult {
  companyId: string;
  periodStart: string;
  periodEnd: string;
  checks: Check[];
  hasErrors: boolean;
  hasWarnings: boolean;
  generatedAt: string;
}

const levelConfig = {
  ERROR:   { icon: FiAlertCircle,   bg: "bg-red-50",   border: "border-red-200",   text: "text-red-700",   badge: "bg-red-100 text-red-700",   dot: "bg-red-500",   label: "Erro"  },
  WARNING: { icon: FiAlertTriangle, bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400", label: "Aviso" },
  INFO:    { icon: FiInfo,          bg: "bg-blue-50",  border: "border-blue-200",  text: "text-blue-700",  badge: "bg-blue-100 text-blue-700",  dot: "bg-blue-400",  label: "Info"  },
};

function CheckCard({ check }: { check: Check }) {
  const [open, setOpen] = useState(check.level === "ERROR");
  const cfg = levelConfig[check.level];
  const Icon = cfg.icon;
  const hasExtra = !!(check.details?.length || check.action);

  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} overflow-hidden`}>
      <button
        className="w-full flex items-start gap-3 p-4 text-left"
        onClick={() => hasExtra && setOpen((v) => !v)}
      >
        <Icon className={`${cfg.text} mt-0.5 flex-shrink-0`} size={16} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${cfg.badge}`}>{cfg.label}</span>
            <span className={`text-sm font-medium ${cfg.text}`}>{check.title}</span>
          </div>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{check.description}</p>
        </div>
        {hasExtra && (
          <span className="text-gray-400 flex-shrink-0 mt-0.5">
            {open ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
          </span>
        )}
      </button>

      {open && hasExtra && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
          {check.action && (
            <div className="bg-white rounded border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Acao recomendada</p>
              <p className="text-sm text-gray-700 leading-relaxed">{check.action}</p>
            </div>
          )}
          {check.details && check.details.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Itens afetados{check.count && check.count > check.details.length ? ` (mostrando ${check.details.length} de ${check.count})` : ""}
              </p>
              <div className="overflow-auto max-h-48 rounded border border-gray-200 bg-white">
                <table className="min-w-full text-xs">
                  <tbody>
                    {check.details.map((d, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        {Object.entries(d).map(([k, v]) => (
                          <td key={k} className="px-3 py-1.5 text-gray-700 font-mono whitespace-nowrap">{String(v ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EcfPreValidatePage() {
  const navigate = useNavigate();
  const { activeCompany: currentCompany } = useCompany();

  const [periodStart, setPeriodStart] = useState(() => `${getDefaultEcfYear()}-01-01`);
  const [periodEnd, setPeriodEnd]     = useState(() => `${getDefaultEcfYear()}-12-31`);

  const handlePeriodStartChange = (v: string) => {
    setPeriodStart(v);
    const year = v?.slice(0, 4);
    if (year && /^\d{4}$/.test(year)) {
      setPeriodEnd(`${year}-12-31`);
      localStorage.setItem(ECF_PREVALIDATE_LAST_YEAR_KEY, year);
    }
  };
  const [result, setResult]           = useState<PreValidateResult | null>(null);
  const [loading, setLoading]         = useState(false);

  const run = async () => {
    if (!currentCompany?.id) { toast.error("Selecione uma empresa"); return; }
    if (!periodStart || !periodEnd) { toast.error("Preencha o periodo"); return; }
    setLoading(true);
    try {
      const { data } = await api.get("/sped/ecf/pre-validate", {
        params: { periodStart, periodEnd },
        headers: { "x-company-id": currentCompany.id },
      });
      setResult(data);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Erro ao executar pre-validacao");
    } finally {
      setLoading(false);
    }
  };

  const errors   = result?.checks.filter((c) => c.level === "ERROR")   ?? [];
  const warnings = result?.checks.filter((c) => c.level === "WARNING") ?? [];
  const infos    = result?.checks.filter((c) => c.level === "INFO")    ?? [];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 transition-colors">
          <FiArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Pre-Validacao ECF</h1>
          <p className="text-sm text-gray-500">Identifica problemas antes de gerar o arquivo para o PGE</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        {currentCompany && (
          <p className="text-xs text-gray-500 mb-4">
            Empresa: <span className="font-medium text-gray-700">{currentCompany.legalName || currentCompany.tradeName}</span>
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Inicio do Periodo</label>
            <SmartDateInput
              value={periodStart}
              onChange={(v) => setPeriodStart(v)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fim do Periodo</label>
            <SmartDateInput
              value={periodEnd}
              onChange={(v) => setPeriodEnd(v)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={run}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              <FiZap size={14} />
              {loading ? "Verificando..." : "Executar Checks"}
            </button>
          </div>
        </div>
      </div>

      {/* Resultado */}
      {result && (
        <>
          {/* Summary */}
          <div className="flex items-center gap-3 mb-5 p-4 bg-white rounded-xl border border-gray-200">
            {result.hasErrors ? (
              <div className="flex items-center gap-2 text-red-600 font-semibold text-sm">
                <FiAlertCircle size={18} />
                ECF bloqueado — {errors.length} erro(s) critico(s)
              </div>
            ) : result.hasWarnings ? (
              <div className="flex items-center gap-2 text-amber-600 font-semibold text-sm">
                <FiAlertTriangle size={18} />
                Pronto com ressalvas — {warnings.length} aviso(s)
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600 font-semibold text-sm">
                <FiCheckCircle size={18} />
                Pronto para gerar — nenhum problema critico
              </div>
            )}
            <span className="ml-auto text-xs text-gray-400">
              {new Date(result.generatedAt).toLocaleTimeString("pt-BR")}
            </span>
          </div>

          {errors.length > 0 && (
            <section className="mb-5">
              <h2 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                Erros Criticos ({errors.length})
              </h2>
              <div className="space-y-2">{errors.map((c) => <CheckCard key={c.id} check={c} />)}</div>
            </section>
          )}

          {warnings.length > 0 && (
            <section className="mb-5">
              <h2 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                Avisos ({warnings.length})
              </h2>
              <div className="space-y-2">{warnings.map((c) => <CheckCard key={c.id} check={c} />)}</div>
            </section>
          )}

          {infos.length > 0 && (
            <section className="mb-5">
              <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
                Informacoes ({infos.length})
              </h2>
              <div className="space-y-2">{infos.map((c) => <CheckCard key={c.id} check={c} />)}</div>
            </section>
          )}

          {!result.hasErrors && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => navigate(`/app/sped/ecf?periodStart=${periodStart}&periodEnd=${periodEnd}`)}
                className="flex items-center gap-2 bg-green-600 text-white text-sm font-medium rounded-lg px-5 py-2.5 hover:bg-green-700 transition-colors"
              >
                <FiCheckCircle size={15} />
                Prosseguir para geracao do ECF
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
