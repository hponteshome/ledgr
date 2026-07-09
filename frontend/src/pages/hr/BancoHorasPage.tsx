// frontend/src/pages/hr/BancoHorasPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/services/api";

const AC = "#0891B2";

function fmtMin(m: number) {
  const h = Math.floor(Math.abs(m) / 60);
  const min = Math.abs(m) % 60;
  return (m < 0 ? "-" : "") + h + "h" + (min > 0 ? min + "min" : "");
}

const S = {
  th: { padding: "8px 12px", fontSize: 11, fontWeight: 600 as const, color: "#6B7280", textTransform: "uppercase" as const, background: "#F9FAFB", borderBottom: "0.5px solid #E5E7EB", textAlign: "left" as const },
  td: { padding: "10px 12px", fontSize: 13, color: "#374151", borderBottom: "0.5px solid #F5F5F5" },
};

interface BHRow {
  id: string;
  saldoMinutos: number;
  fmtSaldo: string;
  limiteMinutos?: number | null;
  alerta: boolean;
  employee: { id: string; fullName: string; role?: string | null; taxId?: string | null };
}

export default function BancoHorasPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState<BHRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/hr/employees/banco-horas/relatorio");
      setRows(Array.isArray(r.data) ? r.data : []);
    } catch (e: any) {
      // silencioso -- lista vazia se nao houver banco de horas inicializado ainda
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter(r =>
    !busca || r.employee?.fullName?.toLowerCase().includes(busca.toLowerCase())
  );

  const totalPositivo = rows.filter(r => r.saldoMinutos > 0).length;
  const totalNegativo = rows.filter(r => r.saldoMinutos < 0).length;
  const totalAlerta = rows.filter(r => r.alerta).length;

  return (
    <div style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 600, color: AC }}>&#9670; DEPARTAMENTO PESSOAL</span>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "#111", margin: "2px 0 0" }}>Banco de Horas</h1>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: "4px 0 0" }}>
            Visao consolidada de saldo de horas extras por funcionario
          </p>
        </div>
        <input
          placeholder="Buscar funcionario..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ border: "0.5px solid #E5E7EB", borderRadius: 6, padding: "7px 12px", fontSize: 13, outline: "none", width: 240 }}
        />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" as const }}>
        <div style={{ background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 10, padding: "10px 16px" }}>
          <div style={{ fontSize: 10, color: "#9CA3AF", textTransform: "uppercase" as const }}>Funcionarios com saldo</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#111" }}>{rows.length}</div>
        </div>
        <div style={{ background: "#F0FDF4", border: "0.5px solid #86EFAC", borderRadius: 10, padding: "10px 16px" }}>
          <div style={{ fontSize: 10, color: "#15803D", textTransform: "uppercase" as const }}>Saldo positivo</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#15803D" }}>{totalPositivo}</div>
        </div>
        <div style={{ background: "#FEF2F2", border: "0.5px solid #FCA5A5", borderRadius: 10, padding: "10px 16px" }}>
          <div style={{ fontSize: 10, color: "#B91C1C", textTransform: "uppercase" as const }}>Saldo negativo</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#B91C1C" }}>{totalNegativo}</div>
        </div>
        <div style={{ background: "#FEF3C7", border: "0.5px solid #FCD34D", borderRadius: 10, padding: "10px 16px" }}>
          <div style={{ fontSize: 10, color: "#92400E", textTransform: "uppercase" as const }}>Proximo do limite</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#92400E" }}>{totalAlerta}</div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
          <thead>
            <tr>
              <th style={S.th}>Funcionario</th>
              <th style={S.th}>Funcao</th>
              <th style={S.th}>Saldo Atual</th>
              <th style={S.th}>Limite</th>
              <th style={S.th}>Status</th>
              <th style={S.th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ ...S.td, textAlign: "center", color: "#9CA3AF", padding: 40 }}>Carregando...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} style={{ ...S.td, textAlign: "center", color: "#9CA3AF", padding: 40 }}>
                Nenhum funcionario com banco de horas inicializado ainda.
              </td></tr>
            )}
            {!loading && filtered.map(r => (
              <tr key={r.id}>
                <td style={S.td}>{r.employee?.fullName ?? "-"}</td>
                <td style={{ ...S.td, color: "#6B7280" }}>{r.employee?.role ?? "-"}</td>
                <td style={{ ...S.td, fontWeight: 600, color: r.saldoMinutos < 0 ? "#B91C1C" : r.saldoMinutos > 0 ? "#15803D" : "#374151" }}>
                  {r.fmtSaldo}
                </td>
                <td style={{ ...S.td, color: "#6B7280" }}>
                  {r.limiteMinutos ? fmtMin(r.limiteMinutos) : "-"}
                </td>
                <td style={S.td}>
                  {r.alerta ? (
                    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 600, background: "#FEF3C7", color: "#92400E" }}>
                      Proximo do limite
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 600, background: "#F0FDF4", color: "#15803D" }}>
                      Normal
                    </span>
                  )}
                </td>
                <td style={S.td}>
                  <button
                    onClick={() => nav(`/app/hr/employees/${r.employee.id}`)}
                    style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: AC, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500 }}
                  >
                    Ver detalhe
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
