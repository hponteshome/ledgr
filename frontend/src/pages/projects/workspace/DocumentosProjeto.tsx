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

export default function DocumentosProjeto({ operacao, master }: { operacao: Operacao | null; master: boolean }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [tipos, setTipos] = useState<{ codigo: string; nome: string }[]>([]);
  const [creditos, setCreditos] = useState<Opcao[]>([]);
  const [contrapartes, setContrapartes] = useState<Opcao[]>([]);
  const [erro, setErro] = useState('');
  const [mostrarCancelados, setMostrarCancelados] = useState(false);
  const [enviando, setEnviando] = useState<{ substitui?: Doc } | null>(null);
  const [cancelando, setCancelando] = useState<Doc | null>(null);

  const carregar = useCallback(() => {
    if (!operacao) return;
    setErro('');
    api.get(`/projects/operacoes/${operacao.id}/documentos`).then((r) => setDocs(r.data || [])).catch((e) => setErro(e?.response?.data?.message || 'Falha ao carregar os documentos.'));
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

  const visiveis = useMemo(() => docs.filter((d) => mostrarCancelados || !d.canceladoEm), [docs, mostrarCancelados]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={tituloSt}>Documentos</div>
        <div style={subtituloSt}>{operacao.nome} · arquivos com integridade conferida; os aportes são comprovados pelo próprio extrato</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
          <input type="checkbox" checked={mostrarCancelados} onChange={(e) => setMostrarCancelados(e.target.checked)} /> Mostrar versões anteriores e cancelados
        </label>
        <div style={{ flex: 1 }} />
        {master && <button onClick={() => setEnviando({})} style={{ padding: '8px 16px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Enviar documento</button>}
      </div>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      <div style={{ ...cardSt, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thSt}>Documento</th><th style={thSt}>Tipo</th><th style={thSt}>Anexado a</th><th style={thSt}>Data</th><th style={thSt}>Arquivo</th><th style={thSt}>Situação</th><th style={thSt}></th></tr></thead>
          <tbody>
            {visiveis.length === 0 && <tr><td colSpan={7} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Nenhum documento enviado.</td></tr>}
            {visiveis.map((d) => (
              <tr key={d.id} style={{ opacity: d.canceladoEm ? 0.6 : 1 }}>
                <td style={tdSt}>
                  <div style={{ fontWeight: 600, color: '#111827' }}>{d.titulo}{d.versao > 1 ? ` (v${d.versao})` : ''}</div>
                  {d.descricao && <div style={{ fontSize: 11, color: '#6B7280' }}>{d.descricao}</div>}
                </td>
                <td style={tdSt}>{d.tipo.nome}</td>
                <td style={tdSt}>{d.creditoId ? `Crédito nº ${d.creditoNumero ?? '-'}` : d.contraparteId ? d.contraparteNome : 'Operação'}</td>
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
      {enviando && (
        <EnviarModal operacao={operacao} tipos={tipos} creditos={creditos} contrapartes={contrapartes} substitui={enviando.substitui}
          onClose={() => setEnviando(null)} onFeito={() => { setEnviando(null); carregar(); }} />
      )}
      {cancelando && <CancelarModal operacao={operacao} doc={cancelando} onClose={() => setCancelando(null)} onFeito={() => { setCancelando(null); carregar(); }} />}
    </div>
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
