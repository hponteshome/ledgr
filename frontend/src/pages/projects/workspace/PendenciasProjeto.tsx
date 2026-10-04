// frontend/src/pages/projects/workspace/PendenciasProjeto.tsx
// Fase 1.8 revista (03/10/2026): pendencias SO do projeto - creditos aguardando decisao de vinculo (encaminhados pelo
// Financeiro) e remetentes nao identificados. O extrato completo nunca aparece aqui: a triagem e feita no LEDGR.
// Fase 1.4-1.5 (04/10/2026): identificar o remetente pela tela (contraparte existente ou nova), com a fonte.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { Operacao, Credito, fmtBRL, fmtData, cardSt, thSt, tdSt, erroSt, secTitle, tituloSt, subtituloSt } from './projetoTema';
import VinculoModal from './VinculoModal';
import { ModalProjeto, Secao, ErroModal, Campo, BotaoSec, BotaoPri, inputModal, erroApi } from './ModalProjeto';

interface CreditoPend {
  id: string; numeroOrdem: number | null; dataCredito: string; valor: string; origem: string; remetenteNomeExtrato: string | null;
  referenciaBancaria: string | null; identificacaoPendente: boolean; remetente: { id: string; nome: string; tipoPessoa: string | null } | null;
}

export default function PendenciasProjeto({ operacao, master }: { operacao: Operacao | null; master: boolean }) {
  const [dados, setDados] = useState<{ aguardandoVinculo: CreditoPend[]; remetentesNaoIdentificados: CreditoPend[] } | null>(null);
  const [contrapartes, setContrapartes] = useState<{ id: string; nome: string }[]>([]);
  const [erro, setErro] = useState('');
  const [decidindo, setDecidindo] = useState<CreditoPend | null>(null);
  const [identificando, setIdentificando] = useState<CreditoPend | null>(null);

  const carregar = useCallback(() => {
    if (!operacao) return;
    setErro('');
    api.get(`/projects/operacoes/${operacao.id}/pendencias`)
      .then((r) => setDados(r.data))
      .catch((e) => setErro(e?.response?.data?.message || 'Falha ao carregar as pendências.'));
    api.get(`/projects/operacoes/${operacao.id}/participacoes`).then((r) => {
      const m = new Map<string, string>();
      (r.data || []).forEach((p: any) => { if (p.contraparte) m.set(p.contraparte.id, p.contraparte.nome); });
      setContrapartes([...m.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome)));
    }).catch(() => {});
  }, [operacao]);
  useEffect(() => { carregar(); }, [carregar]);

  if (!operacao) return <div style={{ color: '#6B7280' }}>Nenhuma operação disponível para o seu acesso.</div>;

  const comoCredito = (c: CreditoPend): Credito => ({
    id: c.id, numeroOrdem: c.numeroOrdem, dataCredito: c.dataCredito, valor: c.valor, remetenteNomeExtrato: c.remetenteNomeExtrato,
    referenciaBancaria: c.referenciaBancaria, origem: c.origem, identificacaoPendente: c.identificacaoPendente, observacao: null,
    remetente: c.remetente ? { ...c.remetente, documentoMascarado: null } : null, vinculoAtual: null,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={tituloSt}>Pendências</div>
        <div style={subtituloSt}>{operacao.nome} · o que ainda exige decisão do projeto</div>
      </div>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      <div style={{ ...cardSt, padding: 16 }}>
        <div style={secTitle}>Créditos aguardando decisão de vínculo</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
          Entradas encaminhadas pelo Financeiro, no LEDGR, já comprovadas no extrato. Falta decidir se pertencem à Conta Individual do Adquirente.
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thSt}>Nº</th><th style={thSt}>Data</th><th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={thSt}>Remetente</th><th style={thSt}>Referência bancária</th>{master && <th style={thSt}></th>}</tr></thead>
          <tbody>
            {(dados?.aguardandoVinculo || []).length === 0 && <tr><td colSpan={6} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 20 }}>Nenhum crédito aguardando decisão.</td></tr>}
            {(dados?.aguardandoVinculo || []).map((c) => (
              <tr key={c.id}>
                <td style={tdSt}>{c.numeroOrdem ?? '-'}</td>
                <td style={tdSt}>{fmtData(c.dataCredito)}</td>
                <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>{fmtBRL(c.valor)}</td>
                <td style={tdSt}>{c.remetente?.nome || <i style={{ color: '#9CA3AF' }}>Não identificado</i>}</td>
                <td style={{ ...tdSt, fontSize: 12 }}>{c.referenciaBancaria || '-'}</td>
                {master && (
                  <td style={{ ...tdSt, textAlign: 'right' }}>
                    <button onClick={() => setDecidindo(c)} style={{ padding: '4px 10px', fontSize: 12, border: 'none', borderRadius: 7, background: '#134E4A', color: '#fff', cursor: 'pointer' }}>Decidir vínculo</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ ...cardSt, padding: 16 }}>
        <div style={secTitle}>Créditos com remetente não identificado</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
          O extrato não informa o pagador nestes lançamentos. A identificação depende de comprovante ou de outra fonte, que fica registrada.
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thSt}>Nº</th><th style={thSt}>Data</th><th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={thSt}>Referência bancária</th>{master && <th style={thSt}></th>}</tr></thead>
          <tbody>
            {(dados?.remetentesNaoIdentificados || []).length === 0 && <tr><td colSpan={5} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 20 }}>Todos os remetentes identificados.</td></tr>}
            {(dados?.remetentesNaoIdentificados || []).map((c) => (
              <tr key={c.id}>
                <td style={tdSt}>{c.numeroOrdem ?? '-'}</td>
                <td style={tdSt}>{fmtData(c.dataCredito)}</td>
                <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>{fmtBRL(c.valor)}</td>
                <td style={{ ...tdSt, fontSize: 12 }}>{c.referenciaBancaria || '-'}</td>
                {master && (
                  <td style={{ ...tdSt, textAlign: 'right' }}>
                    <button onClick={() => setIdentificando(c)} style={{ padding: '4px 10px', fontSize: 12, border: 'none', borderRadius: 7, background: '#134E4A', color: '#fff', cursor: 'pointer' }}>Identificar remetente</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {decidindo && (
        <VinculoModal credito={comoCredito(decidindo)} operacaoId={operacao.id} onClose={() => setDecidindo(null)} onSuccess={() => { setDecidindo(null); carregar(); }} />
      )}
      {identificando && (
        <IdentificarModal operacaoId={operacao.id} credito={identificando} contrapartes={contrapartes} onClose={() => setIdentificando(null)} onFeito={() => { setIdentificando(null); carregar(); }} />
      )}
    </div>
  );
}

function IdentificarModal({ operacaoId, credito, contrapartes, onClose, onFeito }: {
  operacaoId: string; credito: CreditoPend; contrapartes: { id: string; nome: string }[]; onClose: () => void; onFeito: () => void;
}) {
  const [modo, setModo] = useState<'EXISTENTE' | 'NOVA'>('EXISTENTE');
  const [contraparteId, setContraparteId] = useState('');
  const [tipoPessoa, setTipoPessoa] = useState<'PF' | 'PJ'>('PF');
  const [documento, setDocumento] = useState('');
  const [nome, setNome] = useState('');
  const [fonte, setFonte] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ordenadas = useMemo(() => contrapartes, [contrapartes]);
  const valido = fonte.trim().length >= 10 && (modo === 'EXISTENTE' ? !!contraparteId : nome.trim().length >= 3);

  const enviar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      let id = contraparteId;
      if (modo === 'NOVA') {
        const r = await api.post(`/projects-cadastros/operacoes/${operacaoId}/contrapartes`, { tipoPessoa, documento: documento.replace(/\D/g, ''), nome: nome.trim(), papelCodigo: 'REMETENTE', observacao: 'Cadastrado na identificacao do credito n ' + (credito.numeroOrdem ?? '') });
        id = r.data.id;
      }
      await api.post(`/projects-cadastros/operacoes/${operacaoId}/creditos/${credito.id}/remetente`, { contraparteId: id, motivo: fonte.trim() });
      toast.success('Remetente identificado.');
      onFeito();
    } catch (e: any) { setErro(erroApi(e, 'Falha ao identificar.')); } finally { setEnviando(false); }
  };

  return (
    <ModalProjeto titulo="Identificar remetente" subtitulo={`Crédito nº ${credito.numeroOrdem ?? '-'} · ${fmtData(credito.dataCredito)} · ${fmtBRL(credito.valor)}`} onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Cancelar</BotaoSec><BotaoPri onClick={enviar} ativo={valido && !enviando}>{enviando ? 'Aguarde...' : 'Identificar'}</BotaoPri></>}>
      <ErroModal msg={erro} />
      <Secao titulo="QUEM PAGOU">
        <div style={{ display: 'flex', gap: 14, fontSize: 13, marginBottom: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><input type="radio" checked={modo === 'EXISTENTE'} onChange={() => setModo('EXISTENTE')} /> Contraparte já cadastrada</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><input type="radio" checked={modo === 'NOVA'} onChange={() => setModo('NOVA')} /> Nova contraparte</label>
        </div>
        {modo === 'EXISTENTE' ? (
          <select style={inputModal} value={contraparteId} onChange={(e) => setContraparteId(e.target.value)}>
            <option value="">Selecione...</option>
            {ordenadas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <Campo rotulo="Tipo *">
              <select style={inputModal} value={tipoPessoa} onChange={(e) => setTipoPessoa(e.target.value as 'PF' | 'PJ')}><option value="PF">Pessoa física</option><option value="PJ">Pessoa jurídica</option></select>
            </Campo>
            <Campo rotulo={tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'}><input style={inputModal} value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="Recomendado" /></Campo>
            <Campo rotulo="Nome *" largo><input style={inputModal} value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
          </div>
        )}
      </Secao>
      <Secao titulo="FONTE DA IDENTIFICAÇÃO *">
        <textarea style={{ ...inputModal, minHeight: 64, resize: 'vertical' }} value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="Mínimo de 10 caracteres. Ex.: comprovante de depósito enviado pelo pagador em 10/2026." />
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6 }}>Se houver comprovante, anexe-o em Documentos, vinculado a este crédito.</div>
      </Secao>
    </ModalProjeto>
  );
}
