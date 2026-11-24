// frontend/src/pages/assets/modals/ReajusteContratoSection.tsx
// REAJ-01 (24/11/2026) - Reajuste no Quadro Resumo do contrato de locacao: indice, periodicidade, proxima data-base,
// ultimo reajuste, aviso de reajuste pendente (fica ativo ate ser registrado), registrar reajuste aplicado ou dispensa
// (com motivo) e historico (so o mais recente pode ser excluido).
import { useState } from 'react';
import { Loader } from 'lucide-react';
import { Field } from './ModalComponents';

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';
const fmtBR = (s?: string | null) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '-');
const fmtMoeda = (v: any) => { const n = Number(v); return isNaN(n) ? '-' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };
const num = (s: string) => { const t = String(s ?? '').trim(); if (!t) return NaN; return Number(t.includes(',') ? t.split('.').join('').replace(',', '.') : t); };

type Form = { tipo: 'APLICADO' | 'DISPENSADO'; dataBase: string; percentual: string; valorNovo: string; competenciaInicio: string; motivo: string };
type Props = { contract: any; token?: string | null; companyId: string; onChanged: () => void };

export function ReajusteContratoSection({ contract, token, companyId, onChanged }: Props) {
  const r = contract?.reajuste ?? null;
  const hist: any[] = Array.isArray(contract?.reajustes) ? contract.reajustes : [];
  const [form, setForm] = useState<Form | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const valorAtual = Number(contract?.rentAmount ?? 0);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}`, 'x-company-id': companyId };

  const abrir = (tipo: 'APLICADO' | 'DISPENSADO') => {
    const db = r?.dataBasePendente ?? r?.proximaDataBase ?? '';
    setErro('');
    setForm({ tipo, dataBase: db, percentual: '', valorNovo: '', competenciaInicio: db ? db.slice(0, 7) : '', motivo: '' });
  };
  const pct = form ? num(form.percentual) : NaN;
  const valorCalc = !isNaN(pct) ? Math.round(valorAtual * (1 + pct / 100) * 100) / 100 : NaN;

  const salvar = async () => {
    if (!form) return;
    setErro('');
    const informado = num(form.valorNovo);
    const valorNovo = !isNaN(informado) ? informado : valorCalc;
    if (!form.dataBase) { setErro('Informe a data-base.'); return; }
    if (form.tipo === 'APLICADO' && !(valorNovo > 0)) { setErro('Informe o percentual ou o novo valor do aluguel.'); return; }
    if (form.tipo === 'DISPENSADO' && form.motivo.trim().length < 10) { setErro('Informe o motivo da dispensa (mínimo 10 caracteres).'); return; }
    setSalvando(true);
    try {
      const res = await fetch(`${API}/rental-contracts/${contract.id}/reajustes`, {
        method: 'POST', headers,
        body: JSON.stringify({
          tipo: form.tipo, dataBase: form.dataBase, percentual: isNaN(pct) ? undefined : pct,
          valorNovo: form.tipo === 'APLICADO' ? valorNovo : undefined,
          competenciaInicio: form.competenciaInicio || undefined, motivo: form.motivo.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(Array.isArray(body?.message) ? body.message.join(' ') : (body?.message ?? `Erro ${res.status}`));
      if (Array.isArray(body?.titulosValorAntigo) && body.titulosValorAntigo.length) {
        window.alert('Reajuste registrado. Aluguéis já gerados com valor diferente do novo, a partir da competência informada: ' + body.titulosValorAntigo.join(', ') + '. Ajuste ou complemente esses títulos.');
      }
      setForm(null);
      onChanged();
    } catch (e: any) { setErro(e?.message || 'Não foi possível registrar.'); }
    setSalvando(false);
  };

  const excluir = async (h: any) => {
    if (!window.confirm('Excluir o registro deste reajuste? O valor e as datas do contrato voltam ao que eram antes dele.')) return;
    try {
      const res = await fetch(`${API}/rental-contracts/${contract.id}/reajustes/${h.id}/excluir`, { method: 'PATCH', headers });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Erro ${res.status}`);
      onChanged();
    } catch (e: any) { window.alert(e?.message || 'Não foi possível excluir.'); }
  };

  if (!r) return null;
  return (
    <div className="pt-2 border-t border-gray-100 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reajuste</div>
      {r.temporada ? (
        <div className="text-sm text-gray-600">Locação por temporada - sem reajuste.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Índice de Reajuste">
              {r.indice
                ? <div className="text-sm text-gray-900">{r.indiceLabel}</div>
                : <div className="text-sm text-orange-700">Não cadastrado - conferir no contrato</div>}
            </Field>
            <Field label="Periodicidade">
              <div className="text-sm text-gray-900">{r.indice ? `A cada ${r.periodoMeses} meses` : '-'}</div>
            </Field>
            <Field label="Próxima data-base">
              <div className="text-sm text-gray-900">{fmtBR(r.proximaDataBase)}</div>
            </Field>
            <Field label="Último reajuste">
              <div className="text-sm text-gray-900">{fmtBR(r.ultimoAplicado)}</div>
            </Field>
          </div>

          {r.dataBasePendente && !form && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-orange-50 border border-orange-200 text-orange-800 rounded-md px-3 py-2">
              <span>Reajuste {r.indiceLabel} pendente desde <b>{fmtBR(r.dataBasePendente)}</b>{r.pendentes > 1 ? ` (${r.pendentes} datas-base)` : ''} - registre o reajuste aplicado ou a dispensa.</span>
              <span className="flex gap-2">
                <button type="button" onClick={() => abrir('APLICADO')} className="font-medium text-white bg-orange-600 hover:bg-orange-700 rounded px-2.5 py-1">Registrar reajuste</button>
                <button type="button" onClick={() => abrir('DISPENSADO')} className="font-medium text-orange-800 border border-orange-300 hover:bg-orange-100 rounded px-2.5 py-1">Dispensar</button>
              </span>
            </div>
          )}
          {!r.dataBasePendente && r.aplica && !form && (
            <div className="flex justify-end">
              <button type="button" onClick={() => abrir('APLICADO')} className="text-xs text-blue-700 hover:underline">Registrar reajuste</button>
            </div>
          )}

          {form && (
            <div className="space-y-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-sm font-medium text-gray-900">{form.tipo === 'APLICADO' ? 'Registrar reajuste aplicado' : 'Dispensar reajuste'}</div>
              {erro && <div className="text-xs text-red-700 bg-red-50 rounded px-2 py-1">{erro}</div>}
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-gray-600">Data-base
                  <input type="date" className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm" value={form.dataBase}
                    onChange={e => setForm({ ...form, dataBase: e.target.value })} />
                </label>
                {form.tipo === 'APLICADO' && (
                  <>
                    <label className="text-xs text-gray-600">Percentual (%)
                      <input type="text" className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm" placeholder="Ex.: 4,25" value={form.percentual}
                        onChange={e => setForm({ ...form, percentual: e.target.value })} />
                    </label>
                    <label className="text-xs text-gray-600">Novo valor do aluguel
                      <input type="text" className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        placeholder={!isNaN(valorCalc) ? fmtMoeda(valorCalc) : 'Ex.: 12.510,00'} value={form.valorNovo}
                        onChange={e => setForm({ ...form, valorNovo: e.target.value })} />
                      <span className="block mt-0.5 text-[11px] text-gray-400">Atual: {fmtMoeda(valorAtual)}{!isNaN(valorCalc) && !form.valorNovo ? ' - será usado ' + fmtMoeda(valorCalc) : ''}</span>
                    </label>
                    <label className="text-xs text-gray-600">A partir da competência
                      <input type="month" className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm" value={form.competenciaInicio}
                        onChange={e => setForm({ ...form, competenciaInicio: e.target.value })} />
                    </label>
                  </>
                )}
              </div>
              <label className="text-xs text-gray-600 block">{form.tipo === 'DISPENSADO' ? 'Motivo da dispensa' : 'Observação'}
                <textarea rows={2} className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm" value={form.motivo}
                  onChange={e => setForm({ ...form, motivo: e.target.value })}
                  placeholder={form.tipo === 'DISPENSADO' ? 'Ex.: acordo com o locatário - valor fixado por 6 meses' : ''} />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setForm(null)} disabled={salvando}
                  className="text-sm text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50">Cancelar</button>
                <button type="button" onClick={salvar} disabled={salvando}
                  className="text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg px-3 py-1.5 flex items-center gap-2">
                  {salvando ? <Loader className="w-4 h-4 animate-spin" /> : null}
                  {form.tipo === 'APLICADO' ? 'Registrar reajuste' : 'Registrar dispensa'}
                </button>
              </div>
            </div>
          )}

          {hist.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Histórico de reajustes</div>
              <table className="w-full text-xs">
                <tbody>
                  {hist.map((h: any, i: number) => (
                    <tr key={h.id} className="border-b border-gray-100 last:border-0 align-top">
                      <td className="py-1 pr-2 whitespace-nowrap">{fmtBR(h.dataBase)}</td>
                      <td className="py-1 pr-2">{h.tipo === 'APLICADO' ? 'Aplicado' : 'Dispensado'}</td>
                      <td className="py-1 pr-2 whitespace-nowrap">{h.percentual != null ? Number(h.percentual).toLocaleString('pt-BR', { maximumFractionDigits: 4 }) + '%' : '-'}</td>
                      <td className="py-1 pr-2 whitespace-nowrap">{h.tipo === 'APLICADO' ? fmtMoeda(h.valorAnterior) + ' → ' + fmtMoeda(h.valorNovo) : fmtMoeda(h.valorAnterior)}</td>
                      <td className="py-1 pr-2 whitespace-nowrap">{h.competenciaInicio ? 'desde ' + h.competenciaInicio.split('-').reverse().join('/') : ''}</td>
                      <td className="py-1 pr-2 text-gray-500">{h.motivo ?? ''}</td>
                      <td className="py-1 text-right">{i === 0 && <button type="button" onClick={() => excluir(h)} className="text-red-600 hover:underline">excluir</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
