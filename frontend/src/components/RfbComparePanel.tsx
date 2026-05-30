// frontend/src/components/RfbComparePanel.tsx
import React, { useState } from "react";
import api from "../services/api";
import { toast } from "react-toastify";
import { FiRefreshCw, FiCheckCircle, FiAlertCircle, FiX } from "react-icons/fi";

interface FieldChange {
  field: string;
  label: string;
  oldValue: string | null;
  newValue: string | null;
}

interface Props {
  companyId: string;
  cnpj: string;
  onApplied: () => void; // callback para recarregar dados
}

export function RfbComparePanel({ companyId, cnpj, onApplied }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [divergences, setDivergences] = useState<FieldChange[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rfbMeta, setRfbMeta] = useState<{ consultedAt: string } | null>(null);
  const [applying, setApplying] = useState(false);

  const consultar = async () => {
    setLoading(true);
    try {
      const r = await api.post(`/companies/${companyId}/rfb-compare`, { cnpj });
      setDivergences(r.data.divergences ?? []);
      setSelected(new Set(r.data.divergences.map((d: FieldChange) => d.field)));
      setRfbMeta({ consultedAt: new Date().toLocaleString("pt-BR") });
      setOpen(true);
      if (!r.data.divergences.length) toast.success("Cadastro em dia com a RFB! Nenhuma divergencia encontrada.");
    } catch {
      toast.error("Erro ao consultar RFB.");
    }
    setLoading(false);
  };

  const toggleField = (field: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(field) ? next.delete(field) : next.add(field);
      return next;
    });
  };

  const aplicar = async () => {
    const toApply = divergences.filter(d => selected.has(d.field));
    if (!toApply.length) { toast.warning("Nenhum campo selecionado."); return; }
    setApplying(true);
    try {
      const r = await api.post(`/companies/${companyId}/rfb-apply`, { changes: toApply });
      toast.success(`${r.data.applied} campo(s) atualizado(s) e registrado(s) no historico.`);
      setOpen(false);
      setDivergences([]);
      onApplied();
    } catch {
      toast.error("Erro ao aplicar alteracoes.");
    }
    setApplying(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={consultar}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition disabled:opacity-50"
      >
        <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
        {loading ? "Consultando..." : "Consultar RFB"}
      </button>

      {open && divergences.length > 0 && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-800">Divergencias encontradas na RFB</h2>
                {rfbMeta && (
                  <p className="text-xs text-gray-400 mt-0.5">Consultado em {rfbMeta.consultedAt}</p>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <FiX size={18} />
              </button>
            </div>

            {/* Lista de divergencias */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              <p className="text-xs text-gray-500 mb-4">
                Selecione os campos que deseja atualizar no cadastro. As alteracoes serao registradas no historico com a data e origem RFB.
              </p>
              {divergences.map(d => (
                <label key={d.field} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${selected.has(d.field) ? "border-blue-300 bg-blue-50" : "border-gray-100 bg-gray-50 hover:border-gray-200"}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(d.field)}
                    onChange={() => toggleField(d.field)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{d.label}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[10px] text-gray-400 mb-0.5">Cadastro atual</div>
                        <div className="text-xs text-red-600 font-medium break-words">{d.oldValue || "—"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 mb-0.5">Dado RFB</div>
                        <div className="text-xs text-emerald-600 font-medium break-words">{d.newValue || "—"}</div>
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
              <div className="text-xs text-gray-400">
                {selected.size} de {divergences.length} campo(s) selecionado(s)
              </div>
              <div className="flex gap-3">
                <button onClick={() => setOpen(false)} type="button"
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium">
                  Cancelar
                </button>
                <button onClick={aplicar} disabled={applying || !selected.size} type="button"
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
                  <FiCheckCircle size={14} />
                  {applying ? "Aplicando..." : "Aplicar selecionados"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
