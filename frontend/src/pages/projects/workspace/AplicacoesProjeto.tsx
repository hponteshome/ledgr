// frontend/src/pages/projects/workspace/AplicacoesProjeto.tsx
// Fase 1.11 parte A / A2 (04/10/2026): aplicacoes de recursos da operacao - so o que o Financeiro classificou no LEDGR,
// cada uma com a saida do extrato como prova. Totais por natureza; devolucoes destacadas. Master: encerrar com motivo
// (a saida volta a triagem no LEDGR).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { Operacao, fmtBRL, fmtData, cardSt, thSt, tdSt, erroSt, secTitle, tituloSt, subtituloSt } from './projetoTema';
import { ModalProjeto, Secao, ErroModal, BotaoSec, BotaoPri, inputModal, erroApi } from './ModalProjeto';

interface Aplicacao {
  id: string; dataAplicacao: string; valor: string; descricao: string | null; motivo: string; lancamento: string | null;
  beneficiario: string | null; creditoNumero: number | null; natureza: { codigo: string; nome: string; tipo: string };
}

export default function AplicacoesProjeto({ operacao, master }: { operacao: Operacao | null; master: boolean }) {
  const [lista, setLista] = useState<Aplicacao[]>([]);
  const [erro, setErro] = useState('');
  const [encerrando, setEncerrando] = useState<Aplicacao | null>(null);
  const carregar = useCallback(() => {
    if (!operacao) return;
    api.get(`/projects/operacoes/${operacao.id}/aplicacoes`).then((r) => setLista(r.data || [])).catch((e) => setErro(erroApi(e, 'Falha ao carregar as aplicações.')));
  }, [operacao]);
  useEffect(() => { carregar(); }, [carregar]);
  const porNatureza = useMemo(() => {
    const m = new Map<string, { nome: string; tipo: string; total: number; n: number }>();
    lista.forEach((a) => { const e = m.get(a.natureza.codigo) || { nome: a.natureza.nome, tipo: a.natureza.tipo, total: 0, n: 0 }; e.total += Number(a.valor); e.n += 1; m.set(a.natureza.codigo, e); });
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [lista]);
  const total = lista.reduce((s, a) => s + Number(a.valor), 0);
  if (!operacao) return <div style={{ color: '#6B7280' }}>Nenhuma operação disponível para o seu acesso.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={tituloSt}>Aplicações de recursos</div>
        <div style={subtituloSt}>{operacao.nome} · saídas classificadas pelo Financeiro no LEDGR, comprovadas no extrato · total {fmtBRL(total)}</div>
      </div>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      {porNatureza.length > 0 && (
        <div style={{ ...cardSt, padding: 16 }}>
          <div style={secTitle}>Por natureza</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {porNatureza.map((n) => (
                <tr key={n.nome}>
                  <td style={tdSt}>{n.nome}{n.tipo === 'DEVOLUCAO' && <span style={{ marginLeft: 8, fontSize: 11, color: '#92400E', background: '#FEF3C7', borderRadius: 999, padding: '1px 7px' }}>reduz a Conta Individual</span>}</td>
                  <td style={{ ...tdSt, textAlign: 'right' }}>{n.n}</td>
                  <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>{fmtBRL(n.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ ...cardSt, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thSt}>Data</th><th style={thSt}>Natureza</th><th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={thSt}>Descrição e motivo</th><th style={thSt}>Devolvido a / crédito</th><th style={thSt}>Lançamento do extrato</th>{master && <th style={thSt}></th>}</tr></thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={7} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Nenhuma aplicação classificada ainda. A classificação é feita no LEDGR, em Projetos → Classificar saídas.</td></tr>}
            {lista.map((a) => (
              <tr key={a.id}>
                <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>{fmtData(a.dataAplicacao)}</td>
                <td style={tdSt}>{a.natureza.nome}</td>
                <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtBRL(a.valor)}</td>
                <td style={tdSt}>{a.descricao && <div>{a.descricao}</div>}<div style={{ fontSize: 11, color: '#6B7280' }}>{a.motivo}</div></td>
                <td style={tdSt}>{a.beneficiario || '-'}{a.creditoNumero ? ` · crédito nº ${a.creditoNumero}` : ''}</td>
                <td style={{ ...tdSt, fontSize: 12 }}>{a.lancamento || '-'}</td>
                {master && <td style={{ ...tdSt, textAlign: 'right' }}><button onClick={() => setEncerrando(a)} style={{ padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#A32D2D', cursor: 'pointer' }}>Encerrar</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {encerrando && <EncerrarModal operacaoId={operacao.id} ap={encerrando} onClose={() => setEncerrando(null)} onFeito={() => { setEncerrando(null); carregar(); }} />}
    </div>
  );
}

function EncerrarModal({ operacaoId, ap, onClose, onFeito }: { operacaoId: string; ap: Aplicacao; onClose: () => void; onFeito: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valido = motivo.trim().length >= 10;
  const enviar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      await api.post(`/projects/operacoes/${operacaoId}/aplicacoes/${ap.id}/encerrar`, { motivo: motivo.trim() });
      toast.success('Aplicação encerrada; a saída voltou à triagem no LEDGR.');
      onFeito();
    } catch (e: any) { setErro(erroApi(e, 'Falha ao encerrar.')); } finally { setEnviando(false); }
  };
  return (
    <ModalProjeto titulo="Encerrar aplicação" subtitulo={`${fmtData(ap.dataAplicacao)} · ${fmtBRL(ap.valor)} · ${ap.natureza.nome}`} largura={480} onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Voltar</BotaoSec><BotaoPri onClick={enviar} ativo={valido && !enviando} perigo>{enviando ? 'Aguarde...' : 'Encerrar'}</BotaoPri></>}>
      <ErroModal msg={erro} />
      <Secao><div style={{ fontSize: 12, color: '#374151' }}>A aplicação fica no histórico com o motivo, e a saída volta para Classificar saídas no LEDGR, para ser reclassificada.</div></Secao>
      <Secao titulo="MOTIVO *"><textarea style={{ ...inputModal, minHeight: 64, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres. Ex.: devolução ao caixa da SUNSYS, não ao Adquirente." /></Secao>
    </ModalProjeto>
  );
}
