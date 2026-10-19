// frontend/src/pages/projects/workspace/DocumentosProjeto.tsx
// Fase 1.10 (04/10/2026): documentos do projeto - lista, envio, nova versao, cancelamento (Master) e download
// autenticado com conferencia de integridade (SHA-256). Upload por fetch (o axios corrompe multipart neste projeto).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { SmartDateInput } from '../../../components/SmartDateInput';
import { Operacao, fmtData, cardSt, thSt, tdSt, erroSt, inputSt, tituloSt, subtituloSt } from './projetoTema';

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';
const FIN = '#1A4A3A';
const FIN_ACCENT = '#3DAA7A';
const FIN_LIGHT = '#E8F5EE';

interface Doc {
  id: string; titulo: string; descricao: string | null; dataDocumento: string | null; creditoId: string | null; contraparteId: string | null;
  arquivoNome: string; mime: string | null; tamanho: number; sha256: string; versao: number; documentoOrigemId: string | null;
  criadoEm: string; canceladoEm: string | null; motivoCancelamento: string | null; tipo: { codigo: string; nome: string };
  creditoNumero: number | null; contraparteNome: string | null;
  vinculos: Vinculo[];
}
interface Vinculo {
  id: string; aplicacaoId: string | null; custodiaLancamentoId: string | null; motivo: string; data: string | null; valor: number | null;
  natureza: string | null; descricao: string | null; custodiaTipo: string | null; custodiaNome: string | null; encerrado: boolean;
}
interface Opcao { id: string; rotulo: string; }

const fmtTamanho = (b: number) => (b < 1024 * 1024 ? (b / 1024).toFixed(0) + ' KB' : (b / (1024 * 1024)).toFixed(1) + ' MB');
const secao: React.CSSProperties = { background: FIN_LIGHT, borderRadius: 8, padding: '12px 14px', borderLeft: `3px solid ${FIN_ACCENT}` };
const rot: React.CSSProperties = { fontSize: 11, color: '#6B7280', marginBottom: 4, fontWeight: 600 };

function Modal({ titulo, subtitulo, onClose, rodape, children }: { titulo: string; subtitulo?: string; onClose: () => void; rodape: React.ReactNode; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 560, maxWidth: '94vw', maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ background: FIN, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{titulo}</div>
            {subtitulo && <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 1 }}>{subtitulo}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 15 }}>×</button>
        </div>
        <div style={{ padding: 18, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
        <div style={{ background: '#FAFAFA', borderTop: '0.5px solid #E5E7EB', padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>{rodape}</div>
      </div>
    </div>
  );
}

const btnSec: React.CSSProperties = { padding: '8px 14px', background: '#fff', color: '#374151', border: '0.5px solid #E5E7EB', borderRadius: 8, fontSize: 13, cursor: 'pointer' };
const btnPri = (ativo: boolean): React.CSSProperties => ({ padding: '8px 16px', background: FIN, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: ativo ? 'pointer' : 'default', opacity: ativo ? 1 : 0.6 });
const Erro = ({ msg }: { msg: string }) => (msg ? <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>⚠ {msg}</div> : null);

interface AlvoApl { id: string; data: string | null; valor: number; descricao: string | null; natureza: string; tipo: string; documentos: number; comprovanteFiscal: boolean; lancamento: string | null; }
interface AlvoCus { id: string; tipo: string; data: string | null; valor: number; favorecido: string | null; descricao: string | null; situacao: string; custodia: string; natureza: string | null; documentos: number; }
interface Alvos { aplicacoes: AlvoApl[]; custodia: AlvoCus[]; custodiaVisivel: boolean; }
type Filtro = 'TODOS' | 'VINCULADOS' | 'PENDENTES';
type Visao = 'DOCUMENTOS' | 'APL_SEM_DOC' | 'CUS_SEM_DOC';

const brl = (v: number | null | undefined) => (v == null ? '-' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const TIPO_CUS: Record<string, string> = { ENVIO: 'Envio', DEVOLUCAO: 'Devolução', PAGAMENTO_DIRETO: 'Pagamento direto', RECEBIMENTO_TERCEIRO: 'Recebimento de terceiro' };
const temVinculo = (d: Doc) => d.vinculos.length > 0 || !!d.creditoId || !!d.contraparteId;
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// valor no titulo padronizado "AAAA-MM-DD - 1.234,56 - ..." (usado so para sugerir o lancamento)
const valorDoTitulo = (t: string): number | null => {
  const m = t.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);
  return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : null;
};

function Card({ rotulo, valor, detalhe, ativo, cor, onClick }: { rotulo: string; valor: string; detalhe?: string; ativo?: boolean; cor?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ ...cardSt, padding: '12px 14px', cursor: onClick ? 'pointer' : 'default', borderTop: `3px solid ${cor || FIN_ACCENT}`, outline: ativo ? `2px solid ${cor || FIN_ACCENT}` : 'none', minWidth: 0 }}>
      <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{rotulo}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginTop: 4 }}>{valor}</div>
      {detalhe && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{detalhe}</div>}
    </div>
  );
}

const chipSt: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, background: FIN_LIGHT, color: FIN, borderRadius: 6, padding: '3px 8px', marginBottom: 4, maxWidth: 320 };
const pendenteSt: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#92400E', background: '#FEF3C7', borderRadius: 999, padding: '2px 8px', display: 'inline-block', marginTop: 4 };
const segBtn = (ativo: boolean): React.CSSProperties => ({ padding: '6px 12px', fontSize: 12, border: 'none', background: ativo ? FIN : '#fff', color: ativo ? '#fff' : '#374151', cursor: 'pointer', fontWeight: ativo ? 600 : 400 });

export default function DocumentosProjeto({ operacao, master }: { operacao: Operacao | null; master: boolean }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [alvos, setAlvos] = useState<Alvos>({ aplicacoes: [], custodia: [], custodiaVisivel: false });
  const [tipos, setTipos] = useState<{ codigo: string; nome: string }[]>([]);
  const [creditos, setCreditos] = useState<Opcao[]>([]);
  const [contrapartes, setContrapartes] = useState<Opcao[]>([]);
  const [erro, setErro] = useState('');
  const [mostrarCancelados, setMostrarCancelados] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [busca, setBusca] = useState('');
  const [visao, setVisao] = useState<Visao>('DOCUMENTOS');
  const [incluirFiscal, setIncluirFiscal] = useState(false);
  const [enviando, setEnviando] = useState<{ substitui?: Doc } | null>(null);
  const [cancelando, setCancelando] = useState<Doc | null>(null);
  const [vinculando, setVinculando] = useState<Doc | null>(null);
  const [desvinculando, setDesvinculando] = useState<{ doc: Doc; v: Vinculo } | null>(null);

  const carregar = useCallback(() => {
    if (!operacao) return;
    setErro('');
    api.get(`/projects/operacoes/${operacao.id}/documentos`).then((r) => setDocs((r.data || []).map((d: any) => ({ ...d, vinculos: d.vinculos || [] })))).catch((e) => setErro(e?.response?.data?.message || 'Falha ao carregar os documentos.'));
    api.get(`/projects/operacoes/${operacao.id}/documentos-alvos`).then((r) => setAlvos(r.data || { aplicacoes: [], custodia: [], custodiaVisivel: false })).catch(() => {});
  }, [operacao]);

  useEffect(() => {
    carregar();
    if (!operacao) return;
    api.get('/projects/documento-tipos').then((r) => setTipos(r.data || [])).catch(() => {});
    api.get(`/projects/operacoes/${operacao.id}/creditos`).then((r) => setCreditos((r.data || []).map((c: any) => ({ id: c.id, rotulo: `Nº ${c.numeroOrdem ?? '-'} · ${fmtData(c.dataCredito)} · ${Number(c.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` })))).catch(() => {});
    api.get(`/projects/operacoes/${operacao.id}/participacoes`).then((r) => {
      const m = new Map<string, string>();
      (r.data || []).forEach((p: any) => { if (p.contraparte) m.set(p.contraparte.id, p.contraparte.nome); });
      setContrapartes([...m.entries()].map(([id, nome]) => ({ id, rotulo: nome })).sort((a, b) => a.rotulo.localeCompare(b.rotulo)));
    }).catch(() => {});
  }, [carregar, operacao]);

  const vigentes = useMemo(() => docs.filter((d) => !d.canceladoEm), [docs]);
  const tot = useMemo(() => {
    const porTipo = new Map<string, number>();
    vigentes.forEach((d) => porTipo.set(d.tipo.nome, (porTipo.get(d.tipo.nome) || 0) + 1));
    const vinc = vigentes.filter(temVinculo);
    const alvoValor = new Map<string, number>();
    vigentes.forEach((d) => d.vinculos.forEach((v) => alvoValor.set(v.aplicacaoId || v.custodiaLancamentoId || v.id, v.valor || 0)));
    const apl = alvos.aplicacoes;
    const aplCom = apl.filter((a) => a.documentos > 0);
    const aplFiscal = apl.filter((a) => a.documentos === 0 && a.comprovanteFiscal);
    const aplSem = apl.filter((a) => a.documentos === 0 && !a.comprovanteFiscal);
    const cus = alvos.custodia.filter((l) => l.tipo === 'PAGAMENTO_DIRETO' || l.tipo === 'ENVIO');
    const cusCom = cus.filter((l) => l.documentos > 0);
    const soma = (xs: { valor: number }[]) => xs.reduce((s, x) => s + Math.round(x.valor * 100), 0) / 100;
    return {
      porTipo: [...porTipo.entries()].sort((a, b) => b[1] - a[1]), vinculados: vinc.length, pendentes: vigentes.length - vinc.length,
      valorVinculado: [...alvoValor.values()].reduce((s, v) => s + Math.round(v * 100), 0) / 100, lancamentosVinculados: alvoValor.size,
      apl: apl.length, aplValor: soma(apl), aplCom: aplCom.length, aplComValor: soma(aplCom), aplFiscal: aplFiscal.length, aplFiscalValor: soma(aplFiscal),
      aplSem: aplSem.length, aplSemValor: soma(aplSem), cus: cus.length, cusCom: cusCom.length, cusSemValor: soma(cus.filter((l) => l.documentos === 0)),
    };
  }, [vigentes, alvos]);

  const visiveis = useMemo(() => {
    const q = semAcento(busca.trim());
    return docs.filter((d) => {
      if (!mostrarCancelados && d.canceladoEm) return false;
      if (filtro === 'VINCULADOS' && !temVinculo(d)) return false;
      if (filtro === 'PENDENTES' && (temVinculo(d) || d.canceladoEm)) return false;
      if (tipoFiltro && d.tipo.codigo !== tipoFiltro) return false;
      if (q && !semAcento(`${d.titulo} ${d.descricao || ''} ${d.arquivoNome}`).includes(q)) return false;
      return true;
    });
  }, [docs, mostrarCancelados, filtro, tipoFiltro, busca]);

  const aplSemDoc = useMemo(() => {
    const q = semAcento(busca.trim());
    return alvos.aplicacoes.filter((a) => a.documentos === 0 && (incluirFiscal || !a.comprovanteFiscal)
      && (!q || semAcento(`${a.natureza} ${a.descricao || ''} ${a.lancamento || ''} ${brl(a.valor)} ${fmtData(a.data)}`).includes(q)));
  }, [alvos, incluirFiscal, busca]);
  const cusSemDoc = useMemo(() => alvos.custodia.filter((l) => (l.tipo === 'PAGAMENTO_DIRETO' || l.tipo === 'ENVIO') && l.documentos === 0), [alvos]);

  const baixar = async (d: Doc) => {
    if (!operacao) return;
    try {
      await api.get('/projects/documento-tipos'); // garante token renovado (o fetch nao passa pelo interceptor)
      const res = await fetch(`${API}/projects/operacoes/${operacao.id}/documentos/${d.id}/arquivo`, { headers: { Authorization: 'Bearer ' + localStorage.getItem('@ledgr:token') } });
      if (!res.ok) { const j = await res.json().catch(() => ({})); toast.error(j.message || 'Falha ao baixar o documento.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = d.arquivoNome; a.click();
      URL.revokeObjectURL(url);
      toast.success('Integridade conferida (SHA-256).');
    } catch { toast.error('Falha ao baixar o documento.'); }
  };

  if (!operacao) return <div style={{ color: '#6B7280' }}>Nenhuma operação disponível para o seu acesso.</div>;

  const rotuloVinculo = (v: Vinculo) => v.aplicacaoId
    ? `Aplicação ${fmtData(v.data)} · ${brl(v.valor)}${v.natureza ? ' · ' + v.natureza : ''}`
    : `Custódia${v.custodiaNome ? ' ' + v.custodiaNome : ''} · ${TIPO_CUS[v.custodiaTipo || ''] || 'lançamento'}${v.data ? ' ' + fmtData(v.data) : ''}${v.valor != null ? ' · ' + brl(v.valor) : ''}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={tituloSt}>Documentos</div>
        <div style={subtituloSt}>{operacao.nome} · arquivos com integridade conferida; os aportes são comprovados pelo próprio extrato</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
        <Card rotulo="Documentos vigentes" valor={String(vigentes.length)} detalhe={tot.porTipo.map(([n, q]) => `${q} ${n.split(' ')[0].toLowerCase()}`).join(' · ') || undefined}
          ativo={visao === 'DOCUMENTOS' && filtro === 'TODOS'} onClick={() => { setVisao('DOCUMENTOS'); setFiltro('TODOS'); }} />
        <Card rotulo="Vinculados" valor={String(tot.vinculados)} detalhe={`${tot.lancamentosVinculados} lançamentos · ${brl(tot.valorVinculado)}`}
          ativo={visao === 'DOCUMENTOS' && filtro === 'VINCULADOS'} onClick={() => { setVisao('DOCUMENTOS'); setFiltro('VINCULADOS'); }} />
        <Card rotulo="Pendentes de vinculação" valor={String(tot.pendentes)} detalhe={tot.pendentes ? 'documentos sem aplicação ou custódia' : 'nenhum pendente'} cor="#D97706"
          ativo={visao === 'DOCUMENTOS' && filtro === 'PENDENTES'} onClick={() => { setVisao('DOCUMENTOS'); setFiltro('PENDENTES'); }} />
        <Card rotulo="Aplicações com documento" valor={`${tot.aplCom} de ${tot.apl}`} detalhe={`${brl(tot.aplComValor)} de ${brl(tot.aplValor)}`} />
        <Card rotulo="Aplicações sem comprovação" valor={String(tot.aplSem)} detalhe={`${brl(tot.aplSemValor)}${tot.aplFiscal ? ` · +${tot.aplFiscal} só com DARF (${brl(tot.aplFiscalValor)})` : ''}`} cor="#A32D2D"
          ativo={visao === 'APL_SEM_DOC'} onClick={() => setVisao('APL_SEM_DOC')} />
        {alvos.custodiaVisivel && (
          <Card rotulo="Custódia com documento" valor={`${tot.cusCom} de ${tot.cus}`} detalhe={`envios e pagamentos diretos · sem documento ${brl(tot.cusSemValor)}`} cor="#6D28D9"
            ativo={visao === 'CUS_SEM_DOC'} onClick={() => setVisao('CUS_SEM_DOC')} />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {visao === 'DOCUMENTOS' ? (
          <>
            <div style={{ display: 'inline-flex', border: '0.5px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
              {(['TODOS', 'VINCULADOS', 'PENDENTES'] as Filtro[]).map((f) => (
                <button key={f} style={segBtn(filtro === f)} onClick={() => setFiltro(f)}>
                  {f === 'TODOS' ? 'Todos' : f === 'VINCULADOS' ? `Vinculados (${tot.vinculados})` : `Pendentes (${tot.pendentes})`}
                </button>
              ))}
            </div>
            <select style={{ ...inputSt, fontSize: 12 }} value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}>
              <option value="">Todos os tipos</option>
              {tipos.map((t) => <option key={t.codigo} value={t.codigo}>{t.nome}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
              <input type="checkbox" checked={mostrarCancelados} onChange={(e) => setMostrarCancelados(e.target.checked)} /> Mostrar versões anteriores e cancelados
            </label>
          </>
        ) : (
          <>
            <button style={btnSec} onClick={() => setVisao('DOCUMENTOS')}>← Voltar aos documentos</button>
            {visao === 'APL_SEM_DOC' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
                <input type="checkbox" checked={incluirFiscal} onChange={(e) => setIncluirFiscal(e.target.checked)} /> Incluir as comprovadas só por DARF
              </label>
            )}
          </>
        )}
        <input style={{ ...inputSt, fontSize: 12, minWidth: 220 }} placeholder="Buscar por título, valor, natureza..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div style={{ flex: 1 }} />
        {master && visao === 'DOCUMENTOS' && <button onClick={() => setEnviando({})} style={{ padding: '8px 16px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Enviar documento</button>}
      </div>
      {erro && <div style={erroSt}>⚠ {erro}</div>}

      {visao === 'DOCUMENTOS' && (
        <div style={{ ...cardSt, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={thSt}>Documento</th><th style={thSt}>Tipo</th><th style={thSt}>Vinculado a</th><th style={thSt}>Data</th><th style={thSt}>Arquivo</th><th style={thSt}>Situação</th><th style={thSt}></th></tr></thead>
            <tbody>
              {visiveis.length === 0 && <tr><td colSpan={7} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 24 }}>{docs.length ? 'Nenhum documento neste filtro.' : 'Nenhum documento enviado.'}</td></tr>}
              {visiveis.map((d) => (
                <tr key={d.id} style={{ opacity: d.canceladoEm ? 0.6 : 1 }}>
                  <td style={tdSt}>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{d.titulo}{d.versao > 1 ? ` (v${d.versao})` : ''}</div>
                    {d.descricao && <div style={{ fontSize: 11, color: '#6B7280' }}>{d.descricao}</div>}
                  </td>
                  <td style={tdSt}>{d.tipo.nome}</td>
                  <td style={{ ...tdSt, minWidth: 220 }}>
                    {d.creditoId && <div style={chipSt}>Crédito nº {d.creditoNumero ?? '-'}</div>}
                    {d.contraparteId && <div style={chipSt}>{d.contraparteNome}</div>}
                    {d.vinculos.map((v) => (
                      <div key={v.id} style={{ ...chipSt, ...(v.custodiaLancamentoId ? { background: '#EDE9FE', color: '#5B21B6' } : {}), ...(v.encerrado ? { textDecoration: 'line-through' } : {}) }}
                        title={`${v.descricao || ''}${v.descricao ? '\n' : ''}Motivo: ${v.motivo}${v.encerrado ? '\nLançamento encerrado' : ''}`}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rotuloVinculo(v)}</span>
                        {master && !d.canceladoEm && <span onClick={() => setDesvinculando({ doc: d, v })} title="Desvincular" style={{ cursor: 'pointer', fontWeight: 700, opacity: 0.7 }}>×</span>}
                      </div>
                    ))}
                    {!temVinculo(d) && <><div style={{ fontSize: 12, color: '#6B7280' }}>Operação</div>{!d.canceladoEm && <span style={pendenteSt}>Pendente de vinculação</span>}</>}
                  </td>
                  <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>{fmtData(d.dataDocumento)}</td>
                  <td style={tdSt}>
                    <div style={{ fontSize: 12 }}>{d.arquivoNome}</div>
                    <div style={{ fontSize: 11, color: '#6B7280', fontFamily: 'monospace' }} title={d.sha256}>{fmtTamanho(d.tamanho)} · {d.sha256.slice(0, 12)}…</div>
                  </td>
                  <td style={tdSt}>
                    {d.canceladoEm
                      ? <><span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', background: '#F3F4F6', borderRadius: 999, padding: '2px 8px' }}>Encerrado</span><div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{d.motivoCancelamento}</div></>
                      : <span style={{ fontSize: 11, fontWeight: 600, color: '#166534', background: '#DCFCE7', borderRadius: 999, padding: '2px 8px' }}>Vigente</span>}
                  </td>
                  <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => baixar(d)} style={{ padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#134E4A', cursor: 'pointer', marginRight: 6 }}>Baixar</button>
                    {master && !d.canceladoEm && (
                      <>
                        <button onClick={() => setVinculando(d)} style={{ padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: FIN, cursor: 'pointer', marginRight: 6 }}>Vincular</button>
                        <button onClick={() => setEnviando({ substitui: d })} style={{ padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#374151', cursor: 'pointer', marginRight: 6 }}>Nova versão</button>
                        <button onClick={() => setCancelando(d)} style={{ padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#A32D2D', cursor: 'pointer' }}>Cancelar</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visao === 'APL_SEM_DOC' && (
        <div style={{ ...cardSt, overflowX: 'auto' }}>
          <div style={{ fontSize: 12, color: '#6B7280', padding: '10px 12px' }}>
            {aplSemDoc.length} aplicações · {brl(aplSemDoc.reduce((s, a) => s + Math.round(a.valor * 100), 0) / 100)} · sem documento vinculado{incluirFiscal ? ' (inclui as comprovadas só por DARF)' : ' e sem DARF'}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={thSt}>Data</th><th style={thSt}>Natureza</th><th style={thSt}>Descrição / lançamento</th><th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={thSt}>DARF</th></tr></thead>
            <tbody>
              {aplSemDoc.length === 0 && <tr><td colSpan={5} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Nenhuma aplicação pendente.</td></tr>}
              {aplSemDoc.map((a) => (
                <tr key={a.id}>
                  <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>{fmtData(a.data)}</td>
                  <td style={tdSt}>{a.natureza}</td>
                  <td style={tdSt}><div style={{ fontSize: 12 }}>{a.descricao || '-'}</div>{a.lancamento && <div style={{ fontSize: 11, color: '#6B7280' }}>{a.lancamento}</div>}</td>
                  <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap' }}>{brl(a.valor)}</td>
                  <td style={tdSt}>{a.comprovanteFiscal ? 'Sim' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visao === 'CUS_SEM_DOC' && (
        <div style={{ ...cardSt, overflowX: 'auto' }}>
          <div style={{ fontSize: 12, color: '#6B7280', padding: '10px 12px' }}>{cusSemDoc.length} envios e pagamentos diretos da custódia sem documento vinculado</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={thSt}>Data</th><th style={thSt}>Custódia</th><th style={thSt}>Tipo</th><th style={thSt}>Favorecido / descrição</th><th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={thSt}>Situação</th></tr></thead>
            <tbody>
              {cusSemDoc.length === 0 && <tr><td colSpan={6} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Nenhum lançamento pendente.</td></tr>}
              {cusSemDoc.map((l) => (
                <tr key={l.id}>
                  <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>{fmtData(l.data)}</td>
                  <td style={tdSt}>{l.custodia}</td>
                  <td style={tdSt}>{TIPO_CUS[l.tipo] || l.tipo}</td>
                  <td style={tdSt}><div style={{ fontSize: 12 }}>{l.favorecido || '-'}</div>{l.descricao && <div style={{ fontSize: 11, color: '#6B7280' }}>{l.descricao}</div>}</td>
                  <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap' }}>{brl(l.valor)}</td>
                  <td style={tdSt}>{l.situacao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {enviando && (
        <EnviarModal operacao={operacao} tipos={tipos} creditos={creditos} contrapartes={contrapartes} substitui={enviando.substitui}
          onClose={() => setEnviando(null)} onFeito={() => { setEnviando(null); carregar(); }} />
      )}
      {cancelando && <CancelarModal operacao={operacao} doc={cancelando} onClose={() => setCancelando(null)} onFeito={() => { setCancelando(null); carregar(); }} />}
      {vinculando && <VincularModal operacao={operacao} doc={vinculando} alvos={alvos} onClose={() => setVinculando(null)} onFeito={() => { setVinculando(null); carregar(); }} />}
      {desvinculando && (
        <DesvincularModal operacao={operacao} doc={desvinculando.doc} vinculo={desvinculando.v} rotulo={rotuloVinculo(desvinculando.v)}
          onClose={() => setDesvinculando(null)} onFeito={() => { setDesvinculando(null); carregar(); }} />
      )}
    </div>
  );
}

function VincularModal({ operacao, doc, alvos, onClose, onFeito }: { operacao: Operacao; doc: Doc; alvos: Alvos; onClose: () => void; onFeito: () => void }) {
  const [alvo, setAlvo] = useState<'APL' | 'CUS'>('APL');
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [motivo, setMotivo] = useState('Comprovante do pagamento conferido com o lançamento');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ja = useMemo(() => new Set(doc.vinculos.map((v) => v.aplicacaoId || v.custodiaLancamentoId)), [doc]);
  const vt = valorDoTitulo(doc.titulo);
  const lista = useMemo(() => {
    const q = semAcento(busca.trim());
    const base = alvo === 'APL'
      ? alvos.aplicacoes.map((a) => ({ id: a.id, data: a.data, valor: a.valor, linha1: a.natureza, linha2: [a.descricao, a.lancamento].filter(Boolean).join(' · '), docs: a.documentos }))
      : alvos.custodia.map((l) => ({ id: l.id, data: l.data, valor: l.valor, linha1: `${l.custodia} · ${TIPO_CUS[l.tipo] || l.tipo}`, linha2: [l.favorecido, l.descricao].filter(Boolean).join(' · '), docs: l.documentos }));
    const filtrada = base.filter((x) => !ja.has(x.id) && (!q || semAcento(`${x.linha1} ${x.linha2} ${brl(x.valor)} ${fmtData(x.data)}`).includes(q)));
    const sug = (x: { valor: number }) => (vt != null && Math.abs(x.valor - vt) < 0.005 ? 0 : 1);
    return filtrada.sort((a, b) => sug(a) - sug(b) || (a.data || '').localeCompare(b.data || '')).slice(0, 200);
  }, [alvo, alvos, busca, ja, vt]);
  const valido = sel.size > 0 && motivo.trim().length >= 10;
  const alternar = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const enviar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      for (const id of Array.from(sel)) {
        await api.post(`/projects/operacoes/${operacao.id}/documentos/${doc.id}/vinculos`, { [alvo === 'APL' ? 'aplicacaoId' : 'custodiaLancamentoId']: id, motivo: motivo.trim() });
      }
      toast.success(sel.size === 1 ? 'Vínculo registrado.' : `${sel.size} vínculos registrados.`);
      onFeito();
    } catch (e: any) { setErro(e?.response?.data?.message || 'Falha ao vincular.'); } finally { setEnviando(false); }
  };

  return (
    <Modal titulo="Vincular documento" subtitulo={doc.titulo} onClose={onClose}
      rodape={<><button style={btnSec} onClick={onClose}>Cancelar</button><button style={btnPri(valido && !enviando)} disabled={!valido || enviando} onClick={enviar}>{enviando ? 'Gravando...' : sel.size > 1 ? `Vincular ${sel.size}` : 'Vincular'}</button></>}>
      <Erro msg={erro} />
      <div style={secao}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 8, fontSize: 13 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><input type="radio" checked={alvo === 'APL'} onChange={() => { setAlvo('APL'); setSel(new Set()); }} /> Aplicação</label>
          {alvos.custodiaVisivel && <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><input type="radio" checked={alvo === 'CUS'} onChange={() => { setAlvo('CUS'); setSel(new Set()); }} /> Lançamento da custódia</label>}
        </div>
        <input style={{ ...inputSt, width: '100%', boxSizing: 'border-box' }} placeholder="Buscar por data, valor, natureza, favorecido..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        {vt != null && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6 }}>Lançamentos de {brl(vt)} (valor do título) aparecem primeiro.</div>}
        <div style={{ maxHeight: 280, overflowY: 'auto', marginTop: 8, background: '#fff', borderRadius: 6, border: '0.5px solid #E5E7EB' }}>
          {lista.length === 0 && <div style={{ padding: 14, fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>Nada encontrado.</div>}
          {lista.map((x) => {
            const sugerido = vt != null && Math.abs(x.valor - vt) < 0.005;
            return (
              <label key={x.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 10px', borderBottom: '0.5px solid #F3F4F6', cursor: 'pointer', background: sel.has(x.id) ? FIN_LIGHT : sugerido ? '#FFFBEB' : '#fff' }}>
                <input type="checkbox" checked={sel.has(x.id)} onChange={() => alternar(x.id)} style={{ marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, display: 'flex', gap: 8 }}>
                    <span style={{ whiteSpace: 'nowrap' }}>{fmtData(x.data)}</span>
                    <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{brl(x.valor)}</span>
                    <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.linha1}</span>
                  </div>
                  {x.linha2 && <div style={{ fontSize: 11, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.linha2}</div>}
                </div>
                <span style={{ fontSize: 10, color: x.docs ? '#166534' : '#9CA3AF', whiteSpace: 'nowrap' }}>{x.docs ? `${x.docs} doc.` : 'sem doc.'}</span>
              </label>
            );
          })}
        </div>
      </div>
      <div style={secao}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FIN, marginBottom: 10 }}>MOTIVO *</div>
        <textarea style={{ ...inputSt, width: '100%', minHeight: 56, resize: 'vertical', boxSizing: 'border-box' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres." />
      </div>
    </Modal>
  );
}

function DesvincularModal({ operacao, doc, vinculo, rotulo, onClose, onFeito }: { operacao: Operacao; doc: Doc; vinculo: Vinculo; rotulo: string; onClose: () => void; onFeito: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valido = motivo.trim().length >= 10;
  const enviar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      await api.post(`/projects/operacoes/${operacao.id}/documentos/${doc.id}/vinculos/${vinculo.id}/cancelar`, { motivo: motivo.trim() });
      toast.success('Vínculo cancelado.');
      onFeito();
    } catch (e: any) { setErro(e?.response?.data?.message || 'Falha ao desvincular.'); } finally { setEnviando(false); }
  };
  return (
    <Modal titulo="Desvincular documento" subtitulo={doc.titulo} onClose={onClose}
      rodape={<><button style={btnSec} onClick={onClose}>Voltar</button><button style={{ ...btnPri(valido && !enviando), background: '#A32D2D' }} disabled={!valido || enviando} onClick={enviar}>{enviando ? 'Aguarde...' : 'Desvincular'}</button></>}>
      <Erro msg={erro} />
      <div style={{ ...secao, fontSize: 12, color: '#374151' }}>{rotulo}<div style={{ marginTop: 6, color: '#6B7280' }}>O vínculo fica no histórico com o motivo; ele apenas deixa de valer.</div></div>
      <div style={secao}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FIN, marginBottom: 10 }}>MOTIVO *</div>
        <textarea style={{ ...inputSt, width: '100%', minHeight: 72, resize: 'vertical', boxSizing: 'border-box' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres." />
      </div>
    </Modal>
  );
}

function EnviarModal({ operacao, tipos, creditos, contrapartes, substitui, onClose, onFeito }: {
  operacao: Operacao; tipos: { codigo: string; nome: string }[]; creditos: Opcao[]; contrapartes: Opcao[]; substitui?: Doc; onClose: () => void; onFeito: () => void;
}) {
  const [tipo, setTipo] = useState(substitui?.tipo.codigo || '');
  const [titulo, setTitulo] = useState(substitui?.titulo || '');
  const [descricao, setDescricao] = useState(substitui?.descricao || '');
  const [data, setData] = useState(substitui?.dataDocumento ? substitui.dataDocumento.slice(0, 10) : '');
  const [alvo, setAlvo] = useState<'OPERACAO' | 'CREDITO' | 'CONTRAPARTE'>(substitui?.creditoId ? 'CREDITO' : substitui?.contraparteId ? 'CONTRAPARTE' : 'OPERACAO');
  const [alvoId, setAlvoId] = useState(substitui?.creditoId || substitui?.contraparteId || '');
  const [motivoVersao, setMotivoVersao] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valido = !!arquivo && !!tipo && titulo.trim().length >= 3 && (alvo === 'OPERACAO' || !!alvoId) && (!substitui || motivoVersao.trim().length >= 10);

  const enviar = async () => {
    if (!valido || !arquivo) return;
    setErro(''); setEnviando(true);
    try {
      await api.get('/projects/documento-tipos'); // garante token renovado (o fetch nao passa pelo interceptor)
      const fd = new FormData();
      fd.append('file', arquivo);
      fd.append('tipoCodigo', tipo);
      fd.append('titulo', titulo.trim());
      if (descricao.trim()) fd.append('descricao', descricao.trim());
      if (data) fd.append('dataDocumento', data);
      if (alvo === 'CREDITO') fd.append('creditoId', alvoId);
      if (alvo === 'CONTRAPARTE') fd.append('contraparteId', alvoId);
      if (substitui) { fd.append('substituiDocumentoId', substitui.id); fd.append('motivoVersao', motivoVersao.trim()); }
      const res = await fetch(`${API}/projects/operacoes/${operacao.id}/documentos`, { method: 'POST', headers: { Authorization: 'Bearer ' + localStorage.getItem('@ledgr:token') }, body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || 'Falha no envio.');
      toast.success(substitui ? `Versão ${j.versao} registrada.` : 'Documento enviado.');
      onFeito();
    } catch (e: any) {
      setErro(e?.message || 'Falha no envio.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal titulo={substitui ? 'Nova versão do documento' : 'Enviar documento'} subtitulo={substitui ? substitui.titulo : operacao.nome} onClose={onClose}
      rodape={<><button style={btnSec} onClick={onClose}>Cancelar</button><button style={btnPri(valido && !enviando)} disabled={!valido || enviando} onClick={enviar}>{enviando ? 'Enviando...' : 'Enviar'}</button></>}>
      <Erro msg={erro} />
      <div style={secao}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FIN, marginBottom: 10 }}>DOCUMENTO</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><div style={rot}>Tipo *</div>
            <select style={{ ...inputSt, width: '100%' }} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Selecione...</option>
              {tipos.map((t) => <option key={t.codigo} value={t.codigo}>{t.nome}</option>)}
            </select>
          </div>
          <div><div style={rot}>Data do documento</div><SmartDateInput style={{ ...inputSt, width: '100%' }} value={data} onChange={(v) => setData(v)} /></div>
          <div style={{ gridColumn: '1 / -1' }}><div style={rot}>Título *</div><input style={{ ...inputSt, width: '100%' }} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Termo da Operação Âncora" /></div>
          <div style={{ gridColumn: '1 / -1' }}><div style={rot}>Descrição</div><input style={{ ...inputSt, width: '100%' }} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
        </div>
      </div>
      <div style={secao}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FIN, marginBottom: 10 }}>ANEXAR A</div>
        <div style={{ display: 'flex', gap: 14, marginBottom: 8, fontSize: 13 }}>
          {(['OPERACAO', 'CREDITO', 'CONTRAPARTE'] as const).map((a) => (
            <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: substitui ? 'default' : 'pointer' }}>
              <input type="radio" disabled={!!substitui} checked={alvo === a} onChange={() => { setAlvo(a); setAlvoId(''); }} />
              {a === 'OPERACAO' ? 'Operação' : a === 'CREDITO' ? 'Crédito' : 'Contraparte'}
            </label>
          ))}
        </div>
        {alvo !== 'OPERACAO' && (
          <select style={{ ...inputSt, width: '100%' }} value={alvoId} disabled={!!substitui} onChange={(e) => setAlvoId(e.target.value)}>
            <option value="">Selecione...</option>
            {(alvo === 'CREDITO' ? creditos : contrapartes).map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
          </select>
        )}
      </div>
      <div style={secao}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FIN, marginBottom: 10 }}>ARQUIVO *</div>
        <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6 }}>PDF, imagem, Word ou Excel, até 20 MB. O arquivo é guardado com o SHA-256 do conteúdo e nunca é sobrescrito.</div>
      </div>
      {substitui && (
        <div style={secao}>
          <div style={{ fontSize: 11, fontWeight: 700, color: FIN, marginBottom: 10 }}>MOTIVO DA NOVA VERSÃO *</div>
          <textarea style={{ ...inputSt, width: '100%', minHeight: 64, resize: 'vertical', boxSizing: 'border-box' }} value={motivoVersao} onChange={(e) => setMotivoVersao(e.target.value)} placeholder="Mínimo de 10 caracteres. A versão anterior fica encerrada com este motivo." />
        </div>
      )}
    </Modal>
  );
}

function CancelarModal({ operacao, doc, onClose, onFeito }: { operacao: Operacao; doc: Doc; onClose: () => void; onFeito: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valido = motivo.trim().length >= 10;
  const enviar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      await api.post(`/projects/operacoes/${operacao.id}/documentos/${doc.id}/cancelar`, { motivo: motivo.trim() });
      toast.success('Documento cancelado.');
      onFeito();
    } catch (e: any) { setErro(e?.response?.data?.message || 'Falha ao cancelar.'); } finally { setEnviando(false); }
  };
  return (
    <Modal titulo="Cancelar documento" subtitulo={doc.titulo} onClose={onClose}
      rodape={<><button style={btnSec} onClick={onClose}>Voltar</button><button style={{ ...btnPri(valido && !enviando), background: '#A32D2D' }} disabled={!valido || enviando} onClick={enviar}>{enviando ? 'Aguarde...' : 'Cancelar documento'}</button></>}>
      <Erro msg={erro} />
      <div style={{ ...secao, fontSize: 12, color: '#374151' }}>O registro e o arquivo permanecem guardados, com o motivo, na trilha de auditoria. O documento apenas deixa de estar vigente.</div>
      <div style={secao}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FIN, marginBottom: 10 }}>MOTIVO *</div>
        <textarea style={{ ...inputSt, width: '100%', minHeight: 72, resize: 'vertical', boxSizing: 'border-box' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres." />
      </div>
    </Modal>
  );
}
