// frontend/src/pages/projects/ConcessoesPage.tsx
// Fase 1.3 (03/10/2026): administracao de concessoes de acesso ao dominio Projetos (so Master).
// Conceder: usuario x escopo (projeto inteiro ou operacao) x perfil x nivel, com validade opcional.
// Revogar: com motivo (minimo 5 caracteres). O backend registra tudo no AuditLog.
// Modais no padrao APPayModal (cores FIN, cabecalho escuro, secao com borda, erro #FCEBEB, Esc/clique fora).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiPlus, FiSlash, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { SmartDateInput } from '../../components/SmartDateInput';

const FIN = '#1A4A3A';
const FIN_ACCENT = '#3DAA7A';
const FIN_LIGHT = '#E8F5EE';

interface Projeto { id: string; codigo: string; nome: string; status: string; }
interface Operacao { id: string; codigo: string; nome: string; }
interface Perfil { codigo: string; nome: string; descricao?: string; acoes: string[]; nivelPadrao: string; }
interface Usuario { id: string; email: string; fullName?: string; name?: string; isActive?: boolean; }
interface Concessao {
  id: string; userId: string; operacaoId: string | null; nivel: string; validoDe: string; validoAte: string | null;
  observacao: string | null; criadoEm: string; canceladoEm: string | null; motivoCancelamento: string | null;
  perfil: { codigo: string; nome: string }; operacao: { codigo: string; nome: string } | null;
  usuario: { id: string; email: string; fullName?: string } | null;
}

const NIVEIS: Record<string, string> = {
  OPERACAO: 'Operação',
  EMPRESA_PROJETO: 'Empresa no projeto',
  EMPRESA_COMPLETA: 'Empresa completa',
};

const thStyle: React.CSSProperties = {
  padding: '8px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase',
  letterSpacing: '0.3px', textAlign: 'left', borderBottom: '1px solid #E5E7EB',
};
const tdStyle: React.CSSProperties = { padding: '8px 10px', fontSize: 13, borderBottom: '0.5px solid #F3F4F6', verticalAlign: 'top' };
const btnPrimary: React.CSSProperties = {
  padding: '8px 16px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8,
  fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
};
const btnSec: React.CSSProperties = {
  padding: '8px 14px', background: '#fff', color: '#374151', border: '0.5px solid #E5E7EB', borderRadius: 8,
  fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
};
const inputSt: React.CSSProperties = {
  width: '100%', padding: '7px 10px', border: '0.5px solid #E5E7EB', borderRadius: 7, fontSize: 13,
  boxSizing: 'border-box', background: '#fff',
};

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, fontWeight: 600 }}>{children}</div>;
}

function fmtData(v?: string | null) {
  if (!v) return '-';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
}

function situacao(c: Concessao) {
  if (c.canceladoEm) return { txt: 'Revogada', cor: '#6B7280', bg: '#F3F4F6' };
  if (c.validoAte && new Date(c.validoAte) <= new Date()) return { txt: 'Vencida', cor: '#A32D2D', bg: '#FCEBEB' };
  return { txt: 'Ativa', cor: '#166534', bg: '#DCFCE7' };
}

function ModalLedgr({ titulo, subtitulo, largura = 520, onClose, rodape, children }: {
  titulo: string; subtitulo?: string; largura?: number; onClose: () => void; rodape: React.ReactNode; children: React.ReactNode;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ background: '#fff', borderRadius: 12, width: largura, maxWidth: '94vw', maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
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

function Erro({ msg }: { msg: string }) {
  if (!msg) return null;
  return <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>⚠ {msg}</div>;
}

function ConcederModal({ projetoId, operacoes, onClose, onSuccess }: {
  projetoId: string; operacoes: Operacao[]; onClose: () => void; onSuccess: () => void;
}) {
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [userId, setUserId] = useState('');
  const [escopo, setEscopo] = useState('');
  const [perfilCodigo, setPerfilCodigo] = useState('');
  const [nivel, setNivel] = useState('OPERACAO');
  const [validoAte, setValidoAte] = useState('');
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/projects/perfis'), api.get('/users')])
      .then(([p, u]) => {
        setPerfis(p.data || []);
        setUsuarios((u.data || []).filter((x: Usuario) => x.isActive !== false));
      })
      .catch((e) => setErro(e?.response?.data?.message || 'Falha ao carregar perfis e usuários.'));
  }, []);

  const perfil = perfis.find((p) => p.codigo === perfilCodigo);
  const escolherPerfil = (codigo: string) => {
    setPerfilCodigo(codigo);
    const p = perfis.find((x) => x.codigo === codigo);
    if (p) setNivel(p.nivelPadrao);
  };

  const enviar = async () => {
    if (!userId || !perfilCodigo) { setErro('Informe o usuário e o perfil.'); return; }
    setErro(''); setEnviando(true);
    try {
      await api.post('/projects/concessoes', {
        userId, projetoId, operacaoId: escopo || undefined, perfilCodigo, nivel,
        validoAte: validoAte ? validoAte + 'T23:59:59' : undefined,
        observacao: observacao.trim() || undefined,
      });
      toast.success('Acesso concedido.');
      onSuccess();
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Falha ao conceder o acesso.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ModalLedgr
      titulo="Conceder acesso ao projeto"
      subtitulo="Usuário, escopo, perfil e nível de visibilidade"
      onClose={onClose}
      rodape={<>
        <button style={btnSec} onClick={onClose}>Cancelar</button>
        <button style={{ ...btnPrimary, background: FIN, opacity: enviando ? 0.6 : 1 }} disabled={enviando} onClick={enviar}>{enviando ? 'Aguarde...' : 'Conceder'}</button>
      </>}
    >
      <Erro msg={erro} />
      <div style={{ background: FIN_LIGHT, borderRadius: 8, padding: '12px 14px', borderLeft: `3px solid ${FIN_ACCENT}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FIN, marginBottom: 10 }}>QUEM E ONDE</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Label>Usuário *</Label>
            <select style={inputSt} value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Selecione...</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{(u.fullName || u.name || u.email) + ' (' + u.email + ')'}</option>)}
            </select>
          </div>
          <div>
            <Label>Escopo *</Label>
            <select style={inputSt} value={escopo} onChange={(e) => setEscopo(e.target.value)}>
              <option value="">Projeto inteiro</option>
              {operacoes.map((o) => <option key={o.id} value={o.id}>{'Operação: ' + o.nome}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div style={{ background: FIN_LIGHT, borderRadius: 8, padding: '12px 14px', borderLeft: `3px solid ${FIN_ACCENT}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FIN, marginBottom: 10 }}>PERFIL E VISIBILIDADE</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Label>Perfil no projeto *</Label>
            <select style={inputSt} value={perfilCodigo} onChange={(e) => escolherPerfil(e.target.value)}>
              <option value="">Selecione...</option>
              {perfis.map((p) => <option key={p.codigo} value={p.codigo}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <Label>Nível de visibilidade</Label>
            <select style={inputSt} value={nivel} onChange={(e) => setNivel(e.target.value)}>
              {Object.entries(NIVEIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        {perfil && (
          <div style={{ fontSize: 11, color: '#374151', marginTop: 8 }}>
            Ações permitidas: <b>{perfil.acoes.join(', ')}</b>{perfil.descricao ? ' · ' + perfil.descricao : ''}
          </div>
        )}
        {nivel === 'EMPRESA_COMPLETA' && (
          <div style={{ fontSize: 11, color: '#92400E', marginTop: 6 }}>
            Empresa completa só tem efeito se o usuário também tiver vínculo com a empresa no LEDGR, concedido à parte.
          </div>
        )}
      </div>
      <div style={{ background: FIN_LIGHT, borderRadius: 8, padding: '12px 14px', borderLeft: `3px solid ${FIN_ACCENT}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FIN, marginBottom: 10 }}>VALIDADE E OBSERVAÇÃO</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
          <div>
            <Label>Válido até (opcional)</Label>
            <SmartDateInput style={inputSt} value={validoAte} onChange={(v) => setValidoAte(v)} />
          </div>
          <div>
            <Label>Observação</Label>
            <input style={inputSt} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: auditoria externa do exercício 2026" />
          </div>
        </div>
      </div>
    </ModalLedgr>
  );
}

function RevogarModal({ concessao, onClose, onSuccess }: { concessao: Concessao; onClose: () => void; onSuccess: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valido = motivo.trim().length >= 5;

  const enviar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      await api.post(`/projects/concessoes/${concessao.id}/revogar`, { motivo: motivo.trim() });
      toast.success('Acesso revogado.');
      onSuccess();
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Falha ao revogar o acesso.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ModalLedgr
      titulo="Revogar acesso"
      subtitulo={(concessao.usuario?.fullName || concessao.usuario?.email || '') + ' · ' + concessao.perfil.nome}
      largura={460}
      onClose={onClose}
      rodape={<>
        <button style={btnSec} onClick={onClose}>Cancelar</button>
        <button style={{ ...btnPrimary, background: '#A32D2D', opacity: valido && !enviando ? 1 : 0.6 }} disabled={!valido || enviando} onClick={enviar}>{enviando ? 'Aguarde...' : 'Revogar'}</button>
      </>}
    >
      <Erro msg={erro} />
      <div style={{ background: FIN_LIGHT, borderRadius: 8, padding: '12px 14px', borderLeft: `3px solid ${FIN_ACCENT}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: FIN, marginBottom: 10 }}>MOTIVO DA REVOGAÇÃO *</div>
        <textarea style={{ ...inputSt, minHeight: 80, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 5 caracteres. Fica registrado na trilha de auditoria." autoFocus />
      </div>
    </ModalLedgr>
  );
}

export default function ConcessoesPage() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [projetoId, setProjetoId] = useState('');
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [concessoes, setConcessoes] = useState<Concessao[]>([]);
  const [mostrarRevogadas, setMostrarRevogadas] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [conceder, setConceder] = useState(false);
  const [revogando, setRevogando] = useState<Concessao | null>(null);

  useEffect(() => {
    api.get('/projects')
      .then((r) => {
        setProjetos(r.data || []);
        if (r.data?.length) setProjetoId(r.data[0].id);
      })
      .catch((e) => setErro(e?.response?.data?.message || 'Falha ao carregar projetos.'));
  }, []);

  const carregar = useCallback(async () => {
    if (!projetoId) return;
    setCarregando(true); setErro('');
    try {
      const [c, p] = await Promise.all([api.get(`/projects/${projetoId}/concessoes`), api.get(`/projects/${projetoId}`)]);
      setConcessoes(c.data || []);
      setOperacoes(p.data?.operacoes || []);
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Falha ao carregar as concessões.');
    } finally {
      setCarregando(false);
    }
  }, [projetoId]);

  useEffect(() => { carregar(); }, [carregar]);

  const visiveis = useMemo(() => concessoes.filter((c) => mostrarRevogadas || !c.canceladoEm), [concessoes, mostrarRevogadas]);
  const ativas = concessoes.filter((c) => situacao(c).txt === 'Ativa').length;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Concessões de acesso</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Projetos · quem acessa o quê, com qual perfil e até quando</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <select style={{ ...inputSt, width: 280 }} value={projetoId} onChange={(e) => setProjetoId(e.target.value)}>
          {projetos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
          <input type="checkbox" checked={mostrarRevogadas} onChange={(e) => setMostrarRevogadas(e.target.checked)} />
          Mostrar revogadas
        </label>
        <span style={{ fontSize: 12, color: '#6B7280' }}>{ativas} ativa(s)</span>
        <div style={{ flex: 1 }} />
        <button style={btnSec} onClick={carregar} disabled={carregando}><FiRefreshCw size={13} /> Atualizar</button>
        <button style={btnPrimary} onClick={() => setConceder(true)} disabled={!projetoId}><FiPlus size={14} /> Conceder acesso</button>
      </div>

      <Erro msg={erro} />

      <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflowX: 'auto', marginTop: erro ? 12 : 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Usuário</th>
              <th style={thStyle}>Escopo</th>
              <th style={thStyle}>Perfil</th>
              <th style={thStyle}>Nível</th>
              <th style={thStyle}>Validade</th>
              <th style={thStyle}>Concedida em</th>
              <th style={thStyle}>Situação</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {!carregando && visiveis.length === 0 && (
              <tr><td style={{ ...tdStyle, color: '#9CA3AF', textAlign: 'center', padding: 24 }} colSpan={8}>Nenhuma concessão para exibir.</td></tr>
            )}
            {visiveis.map((c) => {
              const s = situacao(c);
              return (
                <tr key={c.id}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{c.usuario?.fullName || '-'}</div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>{c.usuario?.email || c.userId}</div>
                  </td>
                  <td style={tdStyle}>{c.operacao ? c.operacao.nome : 'Projeto inteiro'}</td>
                  <td style={tdStyle}>{c.perfil.nome}</td>
                  <td style={tdStyle}>{NIVEIS[c.nivel] || c.nivel}</td>
                  <td style={tdStyle}>{c.validoAte ? 'até ' + fmtData(c.validoAte) : 'sem prazo'}</td>
                  <td style={tdStyle}>{fmtData(c.criadoEm)}</td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: s.cor, background: s.bg, borderRadius: 999, padding: '2px 8px' }}>{s.txt}</span>
                    {c.canceladoEm && c.motivoCancelamento && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{c.motivoCancelamento}</div>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {!c.canceladoEm && (
                      <button style={{ ...btnSec, padding: '5px 10px', fontSize: 12, color: '#A32D2D' }} onClick={() => setRevogando(c)}>
                        <FiSlash size={12} /> Revogar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {conceder && (
        <ConcederModal projetoId={projetoId} operacoes={operacoes} onClose={() => setConceder(false)} onSuccess={() => { setConceder(false); carregar(); }} />
      )}
      {revogando && (
        <RevogarModal concessao={revogando} onClose={() => setRevogando(null)} onSuccess={() => { setRevogando(null); carregar(); }} />
      )}
    </div>
  );
}
