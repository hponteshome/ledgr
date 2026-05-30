import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FiCheckCircle, FiAlertCircle, FiClock, FiRefreshCw, FiChevronRight } from "react-icons/fi";
import api from "../services/api";
import { useCompany } from "../contexts/CompanyContext";

type Status = "PENDING" | "IN_PROGRESS" | "DONE" | "OVERDUE";

interface ObrigItem {
  id: string;
  code: string;
  companyId: string;
  companyName: string;
  competence: string;
  dueDate: string;
  status: Status;
}

const STATUS_CFG: Record<Status, { color: string; bg: string; label: string }> = {
  PENDING:     { color: "#6B7280", bg: "#F3F4F6", label: "Pendente" },
  IN_PROGRESS: { color: "#92400E", bg: "#FEF3C7", label: "Em andamento" },
  DONE:        { color: "#065F46", bg: "#D1FAE5", label: "Cumprida" },
  OVERDUE:     { color: "#991B1B", bg: "#FEE2E2", label: "Vencida" },
};

const CODE_LABEL: Record<string, string> = {
  FGTS: "FGTS Mensal", GPS_INSS: "GPS INSS", DARF_PIS: "DARF PIS",
  DARF_COFINS: "DARF COFINS", DARF_CSLL: "DARF CSLL", DARF_IRPJ: "DARF IRPJ",
  DAS: "DAS Simples", ESOCIAL: "eSocial Folha", DCTF: "DCTF",
  SPED_FISCAL: "SPED Fiscal", ECD: "ECD", ECF: "ECF", DIRF: "DIRF",
  DEFIS: "DEFIS", RAIS: "RAIS",
};

function diasRestantes(d: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(d).getTime() - today.getTime()) / 86400000);
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function ObrigacoesWidget() {
  const { activeCompany } = useCompany();
  const navigate = useNavigate();
  const [items, setItems] = useState<ObrigItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    try {
      const today = new Date();
      const comp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      await api.post(`/finance/obrigacoes/gerar/${comp}`);
      const r = await api.get(`/finance/obrigacoes?competence=${comp}`);
      const data: ObrigItem[] = (r.data as any[])
        .filter(o => o.status !== "DONE")
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 6);
      setItems(data);
    } catch { setItems([]); }
    setLoading(false);
  }, [activeCompany]);

  useEffect(() => { load(); }, [load]);

  const vencidas = items.filter(i => i.status === "OVERDUE").length;
  const vencendo7d = items.filter(i => { const d = diasRestantes(i.dueDate); return d >= 0 && d <= 7; }).length;

  return (
    <div style={{ background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", background: "#F9FAFB", borderBottom: "0.5px solid #E5E7EB" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "#111" }}>
          <FiCheckCircle size={15} color="#0369A1" /> Obrigacoes fiscais — proximas
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {vencidas > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#FEE2E2", color: "#991B1B" }}>
              {vencidas} vencida{vencidas > 1 ? "s" : ""}
            </span>
          )}
          {vencendo7d > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#FEF3C7", color: "#92400E" }}>
              {vencendo7d} vence em 7d
            </span>
          )}
          <span onClick={() => navigate("/app/sistema/obrigacoes")}
            style={{ fontSize: 11, color: "#0369A1", cursor: "pointer" }}>
            Ver todas →
          </span>
        </div>
      </div>

      {/* Conteúdo */}
      {loading && (
        <div style={{ padding: "1.5rem", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
          <FiRefreshCw size={14} style={{ marginRight: 6 }} /> Carregando...
        </div>
      )}

      {!loading && items.length === 0 && (
        <div style={{ padding: "1.5rem", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
          Nenhuma obrigacao pendente para este mes.
        </div>
      )}

      {!loading && items.map((item, idx) => {
        const dias = diasRestantes(item.dueDate);
        const st = STATUS_CFG[item.status];
        const isLast = idx === items.length - 1;
        return (
          <div key={item.id}
            onClick={() => navigate("/app/sistema/obrigacoes")}
            style={{ display: "flex", alignItems: "center", padding: "0.6rem 1rem", borderBottom: isLast ? "none" : "0.5px solid #F5F5F5", cursor: "pointer", gap: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = "#F9FAFB")}
            onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
            {/* Status dot */}
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: st.color, flexShrink: 0 }} />
            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {CODE_LABEL[item.code] ?? item.code}
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {item.companyName}
              </div>
            </div>
            {/* Vencimento */}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: dias < 0 ? "#DC2626" : dias <= 7 ? "#D97706" : "#374151" }}>
                {fmt(item.dueDate)}
              </div>
              <div style={{ fontSize: 10, color: dias < 0 ? "#DC2626" : dias <= 7 ? "#D97706" : "#9CA3AF" }}>
                {dias < 0 ? `${Math.abs(dias)}d atraso` : dias === 0 ? "Hoje" : `${dias}d`}
              </div>
            </div>
            {/* Badge status */}
            <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 20, background: st.bg, color: st.color, flexShrink: 0 }}>
              {st.label}
            </span>
            <FiChevronRight size={12} color="#D1D5DB" />
          </div>
        );
      })}

      {/* Footer */}
      <div onClick={() => navigate("/app/sistema/obrigacoes")}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0.6rem 1rem", gap: 5, fontSize: 12, color: "#0369A1", cursor: "pointer", borderTop: "0.5px solid #E5E7EB" }}
        onMouseEnter={e => (e.currentTarget.style.background = "#F9FAFB")}
        onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
        <FiCheckCircle size={13} /> Ver calendario de obrigacoes completo
      </div>
    </div>
  );
}

