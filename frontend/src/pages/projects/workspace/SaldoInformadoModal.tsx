// frontend/src/pages/projects/workspace/SaldoInformadoModal.tsx
// Fase 1.11 parte B (04/10/2026): registrar saldo informado (referencia externa so para conferencia).
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { SmartDateInput } from '../../../components/SmartDateInput';
import { ModalProjeto, Secao, ErroModal, Campo, BotaoSec, BotaoPri, inputModal, erroApi } from './ModalProjeto';

export const TIPOS_SALDO: Record<string, string> = {
  CONTA_INDIVIDUAL: 'Conta Individual do Adquirente',
  INTERCOMPANY_RECEBEDORA: 'Intercompany - conta da recebedora',
  INTERCOMPANY_BENEFICIARIA: 'Intercompany - conta da beneficiária',
};

export function normalizarValor(s: string): string {
  const t = s.trim().replace(/\s|R\$/g, '');
  if (!t) return '';
  if (t.includes(',')) return t.replace(/\./g, '');
  if (/^-?\d+\.\d{1,2}$/.test(t)) return t.replace('.', ',');
  return t.replace(/\./g, '');
}

export default function SaldoInformadoModal({ operacaoId, tipoInicial, onClose, onFeito }: { operacaoId: string; tipoInicial: string; onClose: () => void; onFeito: () => void }) {
  const [tipo, setTipo] = useState(tipoInicial);
  const [data, setData] = useState('');
  const [valor, setValor] = useState('');
  const [conta, setConta] = useState('');
  const [fonte, setFonte] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valido = !!data && normalizarValor(valor) !== '' && fonte.trim().length >= 10;
  const enviar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      await api.post(`/projects/operacoes/${operacaoId}/saldos-informados`, { tipo, dataReferencia: data, valor: normalizarValor(valor), contaContabil: conta.trim(), fonte: fonte.trim() });
      toast.success('Saldo informado registrado.');
      onFeito();
    } catch (e: any) { setErro(erroApi(e, 'Falha ao registrar.')); } finally { setEnviando(false); }
  };
  return (
    <ModalProjeto titulo="Registrar saldo informado" subtitulo="Referência externa, usada só para conferência" onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Cancelar</BotaoSec><BotaoPri onClick={enviar} ativo={valido && !enviando}>{enviando ? 'Aguarde...' : 'Registrar'}</BotaoPri></>}>
      <ErroModal msg={erro} />
      <Secao titulo="SALDO">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Campo rotulo="Tipo *" largo>
            <select style={inputModal} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {Object.entries(TIPOS_SALDO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Data de referência *"><SmartDateInput style={inputModal} value={data} onChange={(v) => setData(v)} /></Campo>
          <Campo rotulo="Valor (R$) *"><input style={inputModal} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex.: 3.295.265,82" /></Campo>
          <Campo rotulo="Conta contábil" largo><input style={inputModal} value={conta} onChange={(e) => setConta(e.target.value)} placeholder="Ex.: 22101050005 (na recebedora) ou 12101020022 (na beneficiária)" /></Campo>
        </div>
      </Secao>
      <Secao titulo="FONTE *">
        <textarea style={{ ...inputModal, minHeight: 64, resize: 'vertical' }} value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="Mínimo de 10 caracteres. Ex.: balancete de 12/2025 enviado pela contabilidade." />
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6 }}>O saldo informado nunca entra no cálculo: ele só é comparado com o saldo calculado pela trilha. Para corrigir, registre um novo e encerre o anterior.</div>
      </Secao>
    </ModalProjeto>
  );
}
