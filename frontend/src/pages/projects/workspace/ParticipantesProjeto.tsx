// frontend/src/pages/projects/workspace/ParticipantesProjeto.tsx
// D8 / Fase 1.4-1.5 (04/10/2026): quem faz o que na operacao. Para o Master: adicionar participante (empresa do grupo,
// contraparte ja cadastrada ou nova contraparte), editar contraparte e encerrar participacao (com motivo).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { Operacao, cardSt, thSt, tdSt, erroSt, tituloSt, subtituloSt } from './projetoTema';
import { ModalProjeto, Secao, ErroModal, Campo, BotaoSec, BotaoPri, inputModal, erroApi } from './ModalProjeto';

interface Participacao {
  id: string; companyId: string | null; empresaNome?: string | null; observacao: string | null;
  papel: { codigo: string; nome: string }; contraparte: { id: string; nome: string; tipoPessoa: string | null } | null;
}
interface Papel { codigo: string; nome: string; aplicaA: string; }
interface Empresa { id: string; legalName: string; tradeName: string | null; }

export default function ParticipantesProjeto({ operacao, master }: { operacao: Operacao | null; master: boolean }) {
  const [lista, setLista] = useState<Participacao[]>([]);
  const [papeis, setPapeis] = useState<Papel[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [erro, setErro] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [encerrando, setEncerrando] = useState<Participacao | null>(null);

  const carregar = useCallback(() => {
    if (!operacao) return;
    setErro('');
    api.get(`/projects/operacoes/${operacao.id}/participacoes`).then((r) => setLista(r.data || [])).catch((e) => setErro(erroApi(e, 'Falha ao carregar os participantes.')));
  }, [operacao]);

  useEffect(() => {
    carregar();
    api.get('/projects-cadastros/papeis').then((r) => setPapeis(r.data || [])).catch(() => {});
    if (master) api.get('/projects-cadastros/empresas').then((r) => setEmpresas(r.data || [])).catch(() => {});
  }, [carregar, master]);

  const ordenada = useMemo(() => [...lista].sort((a, b) => {
    const ta = a.companyId ? 0 : 1; const tb = b.companyId ? 0 : 1;
    if (ta !== tb) return ta - tb;
    const p = a.papel.nome.localeCompare(b.papel.nome);
    return p !== 0 ? p : (a.empresaNome || a.contraparte?.nome || '').localeCompare(b.empresaNome || b.contraparte?.nome || '');
  }), [lista]);
  const contrapartes = useMemo(() => {
    const m = new Map<string, string>();
    lista.forEach((p) => { if (p.contraparte) m.set(p.contraparte.id, p.contraparte.nome); });
    return [...m.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [lista]);

  if (!operacao) return <div style={{ color: '#6B7280' }}>Nenhuma operação disponível para o seu acesso.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={tituloSt}>Participantes</div>
          <div style={subtituloSt}>{operacao.nome} · papéis por operação (controle societário não se confunde com titularidade econômica)</div>
        </div>
        {master && <button onClick={() => setAdicionando(true)} style={{ padding: '8px 16px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Adicionar participante</button>}
      </div>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      <div style={{ ...cardSt, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thSt}>Papel</th><th style={thSt}>Participante</th><th style={thSt}>Tipo</th><th style={thSt}>Observação</th>{master && <th style={thSt}></th>}</tr></thead>
          <tbody>
            {ordenada.map((p) => (
              <tr key={p.id}>
                <td style={{ ...tdSt, fontWeight: 600 }}>{p.papel.nome}</td>
                <td style={tdSt}>{p.empresaNome || p.contraparte?.nome || '-'}</td>
                <td style={tdSt}>{p.companyId ? 'Empresa do grupo' : p.contraparte?.tipoPessoa === 'PF' ? 'Contraparte (pessoa física)' : p.contraparte?.tipoPessoa === 'PJ' ? 'Contraparte (pessoa jurídica)' : 'Contraparte'}</td>
                <td style={{ ...tdSt, fontSize: 12, color: '#374151' }}>{p.observacao || '-'}</td>
                {master && (
                  <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {p.contraparte && <button onClick={() => setEditando(p.contraparte!.id)} style={{ padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#134E4A', cursor: 'pointer', marginRight: 6 }}>Editar</button>}
                    <button onClick={() => setEncerrando(p)} style={{ padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#A32D2D', cursor: 'pointer' }}>Encerrar</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adicionando && <AdicionarModal operacaoId={operacao.id} papeis={papeis} empresas={empresas} contrapartes={contrapartes} onClose={() => setAdicionando(false)} onFeito={() => { setAdicionando(false); carregar(); }} />}
      {editando && <EditarContraparteModal operacaoId={operacao.id} contraparteId={editando} onClose={() => setEditando(null)} onFeito={() => { setEditando(null); carregar(); }} />}
      {encerrando && <EncerrarModal operacaoId={operacao.id} part={encerrando} onClose={() => setEncerrando(null)} onFeito={() => { setEncerrando(null); carregar(); }} />}
    </div>
  );
}

function AdicionarModal({ operacaoId, papeis, empresas, contrapartes, onClose, onFeito }: {
  operacaoId: string; papeis: Papel[]; empresas: Empresa[]; contrapartes: { id: string; nome: string }[]; onClose: () => void; onFeito: () => void;
}) {
  const [modo, setModo] = useState<'NOVA' | 'EXISTENTE' | 'EMPRESA'>('NOVA');
  const [papel, setPapel] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [contraparteId, setContraparteId] = useState('');
  const [tipoPessoa, setTipoPessoa] = useState<'PF' | 'PJ'>('PF');
  const [documento, setDocumento] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const papeisModo = papeis.filter((p) => (modo === 'EMPRESA' ? p.aplicaA !== 'CONTRAPARTE' : p.aplicaA !== 'EMPRESA'));
  const valido = !!papel && (modo === 'EMPRESA' ? !!companyId : modo === 'EXISTENTE' ? !!contraparteId : nome.trim().length >= 3);

  const enviar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      if (modo === 'NOVA') {
        await api.post(`/projects-cadastros/operacoes/${operacaoId}/contrapartes`, { tipoPessoa, documento: documento.replace(/\D/g, ''), nome: nome.trim(), email: email.trim(), telefone: telefone.trim(), observacao: observacao.trim(), papelCodigo: papel });
      } else {
        await api.post(`/projects-cadastros/operacoes/${operacaoId}/participacoes`, { papelCodigo: papel, companyId: modo === 'EMPRESA' ? companyId : undefined, contraparteId: modo === 'EXISTENTE' ? contraparteId : undefined, observacao: observacao.trim() });
      }
      toast.success('Participante adicionado.');
      onFeito();
    } catch (e: any) { setErro(erroApi(e, 'Falha ao adicionar.')); } finally { setEnviando(false); }
  };

  return (
    <ModalProjeto titulo="Adicionar participante" subtitulo="Papel na operação" onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Cancelar</BotaoSec><BotaoPri onClick={enviar} ativo={valido && !enviando}>{enviando ? 'Aguarde...' : 'Adicionar'}</BotaoPri></>}>
      <ErroModal msg={erro} />
      <Secao titulo="QUEM">
        <div style={{ display: 'flex', gap: 14, fontSize: 13, marginBottom: 10, flexWrap: 'wrap' }}>
          {([['NOVA', 'Nova contraparte'], ['EXISTENTE', 'Contraparte já cadastrada'], ['EMPRESA', 'Empresa do grupo']] as const).map(([m, r]) => (
            <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><input type="radio" checked={modo === m} onChange={() => { setModo(m); setPapel(''); }} /> {r}</label>
          ))}
        </div>
        {modo === 'EMPRESA' && (
          <select style={inputModal} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Selecione...</option>
            {empresas.map((c) => <option key={c.id} value={c.id}>{c.tradeName && c.tradeName.trim().length > 1 ? c.tradeName : c.legalName}</option>)}
          </select>
        )}
        {modo === 'EXISTENTE' && (
          <select style={inputModal} value={contraparteId} onChange={(e) => setContraparteId(e.target.value)}>
            <option value="">Selecione...</option>
            {contrapartes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
        {modo === 'NOVA' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <Campo rotulo="Tipo *">
              <select style={inputModal} value={tipoPessoa} onChange={(e) => setTipoPessoa(e.target.value as 'PF' | 'PJ')}><option value="PF">Pessoa física</option><option value="PJ">Pessoa jurídica</option></select>
            </Campo>
            <Campo rotulo={tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'}><input style={inputModal} value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="Opcional; só números ou formatado" /></Campo>
            <Campo rotulo="Nome *" largo><input style={inputModal} value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
            <Campo rotulo="E-mail"><input style={inputModal} value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
            <Campo rotulo="Telefone"><input style={inputModal} value={telefone} onChange={(e) => setTelefone(e.target.value)} /></Campo>
          </div>
        )}
      </Secao>
      <Secao titulo="PAPEL NA OPERAÇÃO">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          <Campo rotulo="Papel *">
            <select style={inputModal} value={papel} onChange={(e) => setPapel(e.target.value)}>
              <option value="">Selecione...</option>
              {papeisModo.map((p) => <option key={p.codigo} value={p.codigo}>{p.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Observação"><input style={inputModal} value={observacao} onChange={(e) => setObservacao(e.target.value)} /></Campo>
        </div>
      </Secao>
    </ModalProjeto>
  );
}

function EditarContraparteModal({ operacaoId, contraparteId, onClose, onFeito }: { operacaoId: string; contraparteId: string; onClose: () => void; onFeito: () => void }) {
  const [d, setD] = useState<any>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [tipoPessoa, setTipoPessoa] = useState<'PF' | 'PJ'>('PF');
  const [documento, setDocumento] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get(`/projects-cadastros/operacoes/${operacaoId}/contrapartes/${contraparteId}`).then((r) => {
      setD(r.data); setNome(r.data.nome || ''); setEmail(r.data.email || ''); setTelefone(r.data.telefone || ''); setObservacoes(r.data.observacoes || '');
      if (r.data.tipoPessoa === 'PJ') setTipoPessoa('PJ');
    }).catch((e) => setErro(erroApi(e, 'Falha ao carregar a contraparte.')));
  }, [operacaoId, contraparteId]);

  const valido = !!d && nome.trim().length >= 3;
  const enviar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      await api.post(`/projects-cadastros/operacoes/${operacaoId}/contrapartes/${contraparteId}`, {
        nome: nome.trim(), email: email.trim(), telefone: telefone.trim(), observacoes: observacoes.trim(),
        ...(d?.temDocumento ? {} : { tipoPessoa, documento: documento.replace(/\D/g, '') }),
      });
      toast.success('Contraparte atualizada.');
      onFeito();
    } catch (e: any) { setErro(erroApi(e, 'Falha ao salvar.')); } finally { setEnviando(false); }
  };

  return (
    <ModalProjeto titulo="Editar contraparte" subtitulo={d?.nome || ''} onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Cancelar</BotaoSec><BotaoPri onClick={enviar} ativo={valido && !enviando}>{enviando ? 'Aguarde...' : 'Salvar'}</BotaoPri></>}>
      <ErroModal msg={erro} />
      {d && (
        <Secao titulo="DADOS">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Campo rotulo="Nome *" largo><input style={inputModal} value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
            {d.temDocumento ? (
              <Campo rotulo="Documento (não editável)" largo><div style={{ fontFamily: 'monospace', fontSize: 13, padding: '7px 0' }}>{d.documentoMascarado}</div></Campo>
            ) : (
              <>
                <Campo rotulo="Tipo"><select style={inputModal} value={tipoPessoa} onChange={(e) => setTipoPessoa(e.target.value as 'PF' | 'PJ')}><option value="PF">Pessoa física</option><option value="PJ">Pessoa jurídica</option></select></Campo>
                <Campo rotulo={tipoPessoa === 'PF' ? 'CPF (preencher)' : 'CNPJ (preencher)'}><input style={inputModal} value={documento} onChange={(e) => setDocumento(e.target.value)} /></Campo>
              </>
            )}
            <Campo rotulo="E-mail"><input style={inputModal} value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
            <Campo rotulo="Telefone"><input style={inputModal} value={telefone} onChange={(e) => setTelefone(e.target.value)} /></Campo>
            <Campo rotulo="Observações" largo><textarea style={{ ...inputModal, minHeight: 60, resize: 'vertical' }} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></Campo>
          </div>
        </Secao>
      )}
    </ModalProjeto>
  );
}

function EncerrarModal({ operacaoId, part, onClose, onFeito }: { operacaoId: string; part: Participacao; onClose: () => void; onFeito: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valido = motivo.trim().length >= 10;
  const enviar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      await api.post(`/projects-cadastros/operacoes/${operacaoId}/participacoes/${part.id}/encerrar`, { motivo: motivo.trim() });
      toast.success('Participação encerrada.');
      onFeito();
    } catch (e: any) { setErro(erroApi(e, 'Falha ao encerrar.')); } finally { setEnviando(false); }
  };
  return (
    <ModalProjeto titulo="Encerrar participação" subtitulo={`${part.papel.nome} · ${part.empresaNome || part.contraparte?.nome || ''}`} largura={480} onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Voltar</BotaoSec><BotaoPri onClick={enviar} ativo={valido && !enviando} perigo>{enviando ? 'Aguarde...' : 'Encerrar'}</BotaoPri></>}>
      <ErroModal msg={erro} />
      <Secao><div style={{ fontSize: 12, color: '#374151' }}>A participação deixa de estar vigente e fica no histórico com o motivo. Créditos e vínculos existentes não são alterados.</div></Secao>
      <Secao titulo="MOTIVO *"><textarea style={{ ...inputModal, minHeight: 72, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres." /></Secao>
    </ModalProjeto>
  );
}
