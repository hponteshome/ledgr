// frontend/src/pages/documentos/ContratosLocacaoAgrupados.tsx
// ARQ-LOC-01 (24/11/2026) - Arquivo Digital > Imoveis > Contratos de locacao, agrupado por contrato.
// Um contrato vigente ou futuro por linha; aditivos, termos, vistoria, notificacoes, garantia, documentos do
// locatario e recibos ficam recolhidos embaixo do contrato. Documentos de locacao sem vinculo aparecem no topo
// como pendencia, com vinculo por contrato e papel. Encerrados, rescindidos e renovados nao aparecem aqui.
import React, { useEffect, useMemo, useState } from 'react';
import { FiEye, FiChevronRight, FiChevronDown, FiAlertTriangle, FiX, FiLink } from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const PAPEIS_DOC_LOCACAO: Record<string, string> = {
  LASTRO: 'Contrato assinado (lastro)',
  ADITIVO: 'Aditivo',
  TERMO: 'Termo',
  VISTORIA: 'Laudo de vistoria',
  NOTIFICACAO: 'Notificação',
  GARANTIA: 'Garantia / caução',
  DOC_LOCATARIO: 'Documento do locatário',
  RECIBO: 'Recibo',
  OUTRO: 'Outro',
};
const SITUACAO: Record<string, { label: string; cls: string }> = {
  VIGENTE:   { label: 'Vigente', cls: 'bg-green-50 text-green-700' },
  RESERVADO: { label: 'Reservado', cls: 'bg-blue-50 text-blue-700' },
  VENCIDO:   { label: 'Vencido - encerrar ou renovar', cls: 'bg-orange-50 text-orange-700' },
};
const fmt = (d?: string | null) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '-');
const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200';

type DocInfo = { documentId: string; title: string; data: string | null; status: string; temArquivo: boolean };
type DocLigado = DocInfo & { vinculoId: string; papel: string; observacao?: string | null };
type Contrato = {
  id: string; numero: string | null; imovelId: string; imovel: string | null; locatario: string | null;
  inicio: string; fim: string | null; situacao: string; lastro: DocInfo | null; lastroRessalva: string | null; documentos: DocLigado[]; reajuste?: any;
};
type Props = { companyId: string; filtroImovel?: string; reloadKey?: number; onView: (id: string, title: string) => void };

export function ContratosLocacaoAgrupados({ companyId, filtroImovel, reloadKey, onView }: Props) {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [semVinculo, setSemVinculo] = useState<DocInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [vinc, setVinc] = useState<{ doc: DocInfo; contratoId: string; papel: string; data: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/documents/imoveis/contratos-locacao', { params: { companyId } });
      setContratos(Array.isArray(r.data?.contratos) ? r.data.contratos : []);
      setSemVinculo(Array.isArray(r.data?.semVinculo) ? r.data.semVinculo : []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Falha ao carregar os contratos de locação.');
    }
    setLoading(false);
  };
  useEffect(() => { if (companyId) carregar(); }, [companyId, reloadKey]);

  const visiveis = useMemo(() => (filtroImovel ? contratos.filter(c => c.imovel === filtroImovel) : contratos), [contratos, filtroImovel]);
  const comDocs = visiveis.filter(c => c.documentos.length > 0);
  const todosAbertos = comDocs.length > 0 && comDocs.every(c => abertos.has(c.id));
  const alternar = (id: string) => setAbertos(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  const alternarTodos = () => setAbertos(todosAbertos ? new Set() : new Set(comDocs.map(c => c.id)));
  const contratoSel = contratos.find(c => c.id === vinc?.contratoId);
  const papeisPara = (c?: Contrato) => Object.entries(PAPEIS_DOC_LOCACAO).filter(([k]) => k !== 'LASTRO' || !c || !c.lastro);

  const salvarVinculo = async () => {
    if (!vinc) return;
    if (!vinc.contratoId || !vinc.papel) { toast.error('Escolha o contrato e o papel do documento.'); return; }
    setSalvando(true);
    try {
      await api.post(`/documents/imoveis/contratos-locacao/${vinc.contratoId}/documentos`, {
        companyId, documentId: vinc.doc.documentId, papel: vinc.papel, data: vinc.data || undefined,
      });
      toast.success('Documento vinculado ao contrato.');
      const alvo = vinc.contratoId;
      setAbertos(prev => { const s = new Set(prev); s.add(alvo); return s; });
      setVinc(null);
      await carregar();
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Falha ao vincular.'); }
    setSalvando(false);
  };
  const desvincular = async (d: DocLigado) => {
    if (!window.confirm(`Desvincular "${d.title}" deste contrato? O documento continua no Arquivo Digital e volta para "sem vínculo".`)) return;
    try {
      await api.patch(`/documents/imoveis/contratos-locacao/documentos/${d.vinculoId}/desvincular`, { companyId });
      toast.success('Documento desvinculado.');
      await carregar();
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Falha ao desvincular.'); }
  };

  return (
    <div className="space-y-3">
      {semVinculo.length > 0 && (
        <div className="border border-orange-200 bg-orange-50 rounded-[10px] p-3">
          <p className="text-[13px] font-semibold text-orange-800 flex items-center gap-1.5 mb-2">
            <FiAlertTriangle size={14} /> {semVinculo.length} documento(s) de locação sem vínculo - ligue cada um ao contrato e informe o papel
          </p>
          <div className="space-y-1">
            {semVinculo.map(d => (
              <div key={d.documentId} className="flex flex-wrap items-center gap-2 bg-white border border-orange-100 rounded px-2.5 py-1.5">
                <button onClick={() => onView(d.documentId, d.title)} className="text-[13px] text-gray-900 hover:text-blue-600 hover:underline text-left">{d.title}</button>
                <span className="text-[11px] text-gray-400">{fmt(d.data)}</span>
                {!d.temArquivo && <span className="text-[11px] text-orange-700">sem PDF</span>}
                {vinc?.doc.documentId === d.documentId ? (
                  <span className="flex flex-wrap items-center gap-1.5 ml-auto">
                    <select value={vinc.contratoId} onChange={e => setVinc({ ...vinc, contratoId: e.target.value, papel: '' })}
                      className="border border-gray-300 rounded px-1.5 py-1 text-[12px] max-w-[300px]">
                      <option value="">Contrato...</option>
                      {contratos.map(c => <option key={c.id} value={c.id}>{(c.imovel ?? '') + ' - ' + (c.locatario ?? '') + ' - ' + fmt(c.inicio)}</option>)}
                    </select>
                    <select value={vinc.papel} onChange={e => setVinc({ ...vinc, papel: e.target.value })} disabled={!vinc.contratoId}
                      className="border border-gray-300 rounded px-1.5 py-1 text-[12px]">
                      <option value="">Papel...</option>
                      {papeisPara(contratoSel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <input type="date" value={vinc.data} onChange={e => setVinc({ ...vinc, data: e.target.value })} title="Data do documento"
                      className="border border-gray-300 rounded px-1.5 py-0.5 text-[12px]" />
                    <button onClick={salvarVinculo} disabled={salvando} className="px-2.5 py-1 rounded text-white text-[12px]" style={{ background: '#1A3A5C' }}>
                      {salvando ? 'Salvando...' : 'Vincular'}
                    </button>
                    <button onClick={() => setVinc(null)} title="Cancelar" className="p-1 text-gray-400 hover:text-gray-700"><FiX size={14} /></button>
                  </span>
                ) : (
                  <button onClick={() => setVinc({ doc: d, contratoId: '', papel: '', data: d.data ?? '' })}
                    className="ml-auto inline-flex items-center gap-1 text-[12px] text-blue-600 hover:underline"><FiLink size={12} /> vincular</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[12px] text-gray-500">{visiveis.length} contrato(s) vigente(s) ou futuro(s). Encerrados, rescindidos e renovados não aparecem aqui.</p>
        {comDocs.length > 0 && (
          <button onClick={alternarTodos} className="text-[12px] text-blue-600 hover:underline">{todosAbertos ? 'Recolher tudo' : 'Expandir tudo'}</button>
        )}
      </div>

      <div className="border border-gray-200 rounded-[10px] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className={th} style={{ width: 64 }}></th>
              <th className={th}>Imóvel</th>
              <th className={th}>Contrato</th>
              <th className={th}>Locatário</th>
              <th className={th}>Vigência</th>
              <th className={th}>Situação</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-[14px]">Carregando...</td></tr>
            ) : visiveis.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-[14px]">Nenhum contrato vigente ou futuro</td></tr>
            ) : visiveis.map(c => {
              const aberto = abertos.has(c.id);
              const sit = SITUACAO[c.situacao] ?? SITUACAO.VIGENTE;
              return (
                <React.Fragment key={c.id}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50 align-top">
                    <td className="px-3 py-2.5">
                      {c.documentos.length > 0 && (
                        <button onClick={() => alternar(c.id)} title={aberto ? 'Recolher' : 'Ver documentos do contrato'}
                          className="inline-flex items-center gap-0.5 text-[12px] text-blue-600 hover:underline whitespace-nowrap">
                          {aberto ? <FiChevronDown size={13} /> : <FiChevronRight size={13} />} {c.documentos.length}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] font-medium text-gray-900">{c.imovel ?? '-'}</td>
                    <td className="px-3 py-2.5">
                      {c.lastro ? (
                        <button onClick={() => onView(c.lastro!.documentId, c.lastro!.title)} className="text-[13px] text-gray-900 hover:text-blue-600 hover:underline text-left">{c.lastro.title}</button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[12px] text-orange-700"><FiAlertTriangle size={12} /> {c.lastroRessalva ? 'Sem PDF assinado (com ressalva)' : 'Sem PDF assinado'}</span>
                      )}
                      {c.lastro && !c.lastro.temArquivo && <p className="text-[11px] text-orange-700">Lastro cadastrado sem o arquivo PDF</p>}
                      <p className="text-[11px] text-gray-400">{[c.numero ? 'nº ' + c.numero : '', c.documentos.length ? c.documentos.length + ' documento(s) ligado(s)' : ''].filter(Boolean).join(' · ')}</p>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700">{c.locatario || '-'}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700" style={{ whiteSpace: 'nowrap' }}>{fmt(c.inicio) + ' a ' + (c.fim ? fmt(c.fim) : 'indeterminado')}</td>
                    <td className="px-3 py-2.5">
                      <span className={'inline-block px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap ' + sit.cls}>{sit.label}</span>
                      {c.reajuste?.dataBasePendente && <p className="mt-1 text-[11px] text-orange-700 whitespace-nowrap" title="Registre o reajuste aplicado ou a dispensa no Quadro Resumo do contrato">Reajuste {c.reajuste.indiceLabel} pendente desde {fmt(c.reajuste.dataBasePendente)}</p>}
                      {c.reajuste?.semIndice && <p className="mt-1 text-[11px] text-gray-500 whitespace-nowrap">Reajuste: índice não cadastrado</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      {c.lastro && (
                        <button title="Visualizar" onClick={() => onView(c.lastro!.documentId, c.lastro!.title)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"><FiEye size={14} /></button>
                      )}
                    </td>
                  </tr>
                  {aberto && c.documentos.map(d => (
                    <tr key={d.vinculoId} className="border-b border-gray-100 bg-slate-50">
                      <td></td>
                      <td colSpan={2} className="px-3 py-1.5 pl-6">
                        <span className="inline-block mr-2 px-1.5 py-0.5 rounded bg-white border border-gray-200 text-[10px] font-semibold uppercase tracking-wide text-gray-600">{PAPEIS_DOC_LOCACAO[d.papel] ?? d.papel}</span>
                        <button onClick={() => onView(d.documentId, d.title)} className="text-[12px] text-gray-800 hover:text-blue-600 hover:underline text-left">{d.title}</button>
                        {!d.temArquivo && <span className="ml-2 text-[11px] text-orange-700">sem PDF</span>}
                      </td>
                      <td className="px-3 py-1.5 text-[11px] text-gray-500">{d.observacao ?? ''}</td>
                      <td className="px-3 py-1.5 text-[12px] text-gray-600" style={{ whiteSpace: 'nowrap' }}>{fmt(d.data)}</td>
                      <td></td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <button title="Visualizar" onClick={() => onView(d.documentId, d.title)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"><FiEye size={13} /></button>
                        <button title="Desvincular do contrato" onClick={() => desvincular(d)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><FiX size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
