// frontend/src/pages/projects/DecisaoMovimentoModal.tsx
// Fase 1.11 A2 (04/10/2026): decisao sobre movimento do extrato que NAO vai ao projeto como aplicacao ou credito -
// transferencia interna (neutra, com rotulo de circuito), nao pertence ou custodia (14/10/2026: saida = envio a custodiante,
// entrada = devolucao, com o valor e a data do extrato). Usado na triagem de entradas e de saidas (LEDGR).
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { ModalProjeto, Secao, ErroModal, Campo, BotaoSec, BotaoPri, inputModal, erroApi } from './workspace/ModalProjeto';

export interface MovimentoTriagem { id: string; data: string; valor: string; lancamento: string; anotacao: string | null; }

type Decisao = 'TRANSFERENCIA_INTERNA' | 'NAO_PERTENCE' | 'CUSTODIA';
const fmtBRL = (v: any) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (iso?: string | null) => { if (!iso) return '-'; const [a, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${a}`; };
const opcaoSt: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8, cursor: 'pointer' };
const dicaSt: React.CSSProperties = { fontSize: 11, color: '#6B7280', marginTop: 6 };

export default function DecisaoMovimentoModal({ rota, mov, rotulos, onClose, onFeito }: {
  rota: string; mov: MovimentoTriagem; rotulos: string[]; onClose: () => void; onFeito: () => void;
}) {
  const [decisao, setDecisao] = useState<Decisao>('TRANSFERENCIA_INTERNA');
  const [circuito, setCircuito] = useState('');
  const [custodias, setCustodias] = useState<{ codigo: string; nome: string }[]>([]);
  const [custodia, setCustodia] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const entrada = rota.includes('/entradas/');
  useEffect(() => {
    api.get('/projects-financeiro/custodias')
      .then((r: any) => { const l = Array.isArray(r.data) ? r.data : []; setCustodias(l); if (l.length === 1) setCustodia(String(l[0].codigo)); })
      .catch(() => setCustodias([]));
  }, []);
  const valido = motivo.trim().length >= 10 && (decisao !== 'TRANSFERENCIA_INTERNA' || circuito.trim().length >= 3) && (decisao !== 'CUSTODIA' || !!custodia);
  const enviar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      await api.post(rota, { decisao, circuito: circuito.trim(), custodia: decisao === 'CUSTODIA' ? custodia : undefined, motivo: motivo.trim() });
      toast.success('Decisão registrada.');
      onFeito();
    } catch (e: any) { setErro(erroApi(e, 'Falha ao registrar.')); } finally { setEnviando(false); }
  };
  return (
    <ModalProjeto titulo="Movimento fora do projeto" subtitulo={`${fmtData(mov.data)} · ${fmtBRL(mov.valor)} · ${mov.lancamento}`} largura={520} onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Cancelar</BotaoSec><BotaoPri onClick={enviar} ativo={valido && !enviando}>{enviando ? 'Aguarde...' : 'Registrar'}</BotaoPri></>}>
      <ErroModal msg={erro} />
      {mov.anotacao && <Secao titulo="ANOTAÇÃO DA PLANILHA (SÓ APOIO)"><div style={{ fontSize: 12, color: '#374151', fontStyle: 'italic' }}>{mov.anotacao}</div></Secao>}
      <Secao titulo="DECISÃO">
        <label style={opcaoSt}>
          <input type="radio" checked={decisao === 'TRANSFERENCIA_INTERNA'} onChange={() => setDecisao('TRANSFERENCIA_INTERNA')} /> Transferência interna (neutra: sai e volta, sem efeito no projeto)
        </label>
        <label style={opcaoSt}>
          <input type="radio" checked={decisao === 'NAO_PERTENCE'} onChange={() => setDecisao('NAO_PERTENCE')} /> Não pertence à operação
        </label>
        {custodias.length > 0 && (
          <label style={{ ...opcaoSt, marginBottom: 0 }}>
            <input type="radio" checked={decisao === 'CUSTODIA'} onChange={() => setDecisao('CUSTODIA')} /> {entrada ? 'Custódia: devolução feita pela custodiante' : 'Custódia: envio à custodiante (ela devolve ou paga diretamente)'}
          </label>
        )}
        {decisao === 'TRANSFERENCIA_INTERNA' && (
          <div style={{ marginTop: 12 }}>
            <Campo rotulo="Circuito *">
              <input style={inputModal} list="circuitos-existentes" value={circuito} onChange={(e) => setCircuito(e.target.value)} placeholder="Ex.: Antonio Vieira - saques" />
              <datalist id="circuitos-existentes">{rotulos.map((r) => <option key={r} value={r} />)}</datalist>
            </Campo>
            <div style={dicaSt}>Use o mesmo nome nas duas pontas (a saída e a volta). O saldo de cada circuito aparece em Projetos → Circuitos neutros.</div>
          </div>
        )}
        {decisao === 'CUSTODIA' && (
          <div style={{ marginTop: 12 }}>
            <Campo rotulo="Custódia *">
              <select style={inputModal} value={custodia} onChange={(e) => setCustodia(e.target.value)}>
                <option value="">Selecione...</option>
                {custodias.map((c) => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}
              </select>
            </Campo>
            <div style={dicaSt}>{entrada
              ? 'Entra na custódia como devolução, com o valor e a data do extrato. Depois, na tela Custódia do projeto, aloque-a ao envio de origem.'
              : 'Entra na custódia como envio, com o valor e a data do extrato. Depois, na tela Custódia do projeto, registre o que a custodiante pagou diretamente e aloque as devoluções.'}</div>
          </div>
        )}
      </Secao>
      <Secao titulo="MOTIVO *">
        <textarea style={{ ...inputModal, minHeight: 64, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres." />
      </Secao>
    </ModalProjeto>
  );
}
