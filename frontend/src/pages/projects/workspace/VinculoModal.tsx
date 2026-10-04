// frontend/src/pages/projects/workspace/VinculoModal.tsx
// Fase 1.6b (03/10/2026): revisao do vinculo do credito a Conta Individual (so Master).
// Vincular a um Adquirente da operacao, ou remover o vinculo (credito de coisa diversa da operacao).
// Motivo obrigatorio (minimo 10 caracteres); o historico e imutavel no banco. Modal no padrao APPayModal.
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { Credito, fmtBRL, fmtData } from './projetoTema';

const FIN = '#1A4A3A';
const FIN_ACCENT = '#3DAA7A';
const FIN_LIGHT = '#E8F5EE';

interface Historico {
  id: string; situacao: string; motivo: string; criadoEm: string; canceladoEm: string | null; motivoCancelamento: string | null;
  adquirente: { id: string; nome: string } | null;
}

const secao: React.CSSProperties = { background: FIN_LIGHT, borderRadius: 8, padding: '12px 14px', borderLeft: `3px solid ${FIN_ACCENT}` };
const secaoTit: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: FIN, marginBottom: 10 };
const inputSt: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '0.5px solid #E5E7EB', borderRadius: 7, fontSize: 13, boxSizing: 'border-box', background: '#fff' };

export default function VinculoModal({ credito, operacaoId, onClose, onSuccess }: {
  credito: Credito; operacaoId: string; onClose: () => void; onSuccess: () => void;
}) {
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [adquirentes, setAdquirentes] = useState<{ id: string; nome: string }[]>([]);
  const [acao, setAcao] = useState<'VINCULAR' | 'DESVINCULAR' | 'RETIFICAR'>('DESVINCULAR');
  const [adquirenteId, setAdquirenteId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  useEffect(() => {
    Promise.all([
      api.get(`/projects/operacoes/${operacaoId}/creditos/${credito.id}/vinculos`),
      api.get(`/projects/operacoes/${operacaoId}/participacoes`),
    ]).then(([h, p]) => {
      setHistorico(h.data || []);
      const adqs = (p.data || [])
        .filter((x: any) => x.papel?.codigo === 'ADQUIRENTE' && x.contraparte)
        .map((x: any) => ({ id: x.contraparte.id, nome: x.contraparte.nome }));
      setAdquirentes(adqs);
      setAdquirenteId(credito.vinculoAtual?.adquirente?.id || adqs[0]?.id || '');
      setAcao(credito.vinculoAtual?.situacao === 'DESVINCULADO' ? 'VINCULAR' : 'DESVINCULAR');
    }).catch((e) => setErro(e?.response?.data?.message || 'Falha ao carregar o histórico do vínculo.'));
  }, [operacaoId, credito]);

  const valido = motivo.trim().length >= 10 && (acao !== 'VINCULAR' || !!adquirenteId);

  const enviar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      await api.post(`/projects/operacoes/${operacaoId}/creditos/${credito.id}/vinculo`, {
        acao, adquirenteId: acao === 'VINCULAR' ? adquirenteId : undefined, motivo: motivo.trim(),
      });
      toast.success(acao === 'RETIFICAR' ? 'Motivo retificado.' : acao === 'VINCULAR' ? 'Vínculo registrado.' : 'Vínculo removido.');
      onSuccess();
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Falha ao registrar o vínculo.');
    } finally {
      setEnviando(false);
    }
  };

  const atual = credito.vinculoAtual;
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 560, maxWidth: '94vw', maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ background: FIN, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Vínculo do crédito nº {credito.numeroOrdem ?? '-'}</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 1 }}>
              {fmtData(credito.dataCredito)} · {fmtBRL(credito.valor)} · {credito.remetente?.nome || 'remetente não identificado'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 15 }}>×</button>
        </div>
        <div style={{ padding: 18, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {erro && <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>⚠ {erro}</div>}
          <div style={secao}>
            <div style={secaoTit}>SITUAÇÃO ATUAL</div>
            <div style={{ fontSize: 13, color: '#111827' }}>
              {atual?.situacao === 'VINCULADO' ? <>Vinculado à Conta Individual de <b>{atual.adquirente?.nome}</b></>
                : atual?.situacao === 'DESVINCULADO' ? <>Desvinculado (fora da Conta Individual)</> : <>Sem vínculo definido</>}
            </div>
          </div>
          <div style={secao}>
            <div style={secaoTit}>ALTERAÇÃO</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8, cursor: 'pointer' }}>
              <input type="radio" checked={acao === 'VINCULAR'} onChange={() => setAcao('VINCULAR')} /> Vincular à Conta Individual de
            </label>
            {acao === 'VINCULAR' && (
              <select style={{ ...inputSt, marginBottom: 10 }} value={adquirenteId} onChange={(e) => setAdquirenteId(e.target.value)}>
                {adquirentes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="radio" checked={acao === 'DESVINCULAR'} onChange={() => setAcao('DESVINCULAR')} /> Remover o vínculo (o crédito se refere a coisa diversa da operação)
            </label>
            {atual && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 8, cursor: 'pointer' }}>
                <input type="radio" checked={acao === 'RETIFICAR'} onChange={() => setAcao('RETIFICAR')} /> Retificar o motivo (mantém a situação atual)
              </label>
            )}
          </div>
          <div style={secao}>
            <div style={secaoTit}>MOTIVO *</div>
            <textarea style={{ ...inputSt, minHeight: 72, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Mínimo de 10 caracteres. Ex.: auditoria de 10/2026 identificou que o crédito se refere a aluguel." />
          </div>
          <div style={secao}>
            <div style={secaoTit}>HISTÓRICO DO VÍNCULO</div>
            {historico.length === 0 && <div style={{ fontSize: 12, color: '#9CA3AF' }}>Sem registros.</div>}
            {historico.map((h) => (
              <div key={h.id} style={{ fontSize: 12, color: '#374151', padding: '6px 0', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                <b>{h.situacao === 'VINCULADO' ? `Vinculado a ${h.adquirente?.nome || '-'}` : 'Desvinculado'}</b>
                {' · '}{fmtData(h.criadoEm)}{h.canceladoEm ? ` até ${fmtData(h.canceladoEm)}` : ' (vigente)'}
                <div style={{ color: '#6B7280' }}>{h.motivo}</div>
                {h.motivoCancelamento && <div style={{ color: '#6B7280' }}>Encerrado: {h.motivoCancelamento}</div>}
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: '#FAFAFA', borderTop: '0.5px solid #E5E7EB', padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 14px', background: '#fff', color: '#374151', border: '0.5px solid #E5E7EB', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={enviar} disabled={!valido || enviando}
            style={{ padding: '8px 16px', background: FIN, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: valido ? 'pointer' : 'default', opacity: valido && !enviando ? 1 : 0.6 }}>
            {enviando ? 'Aguarde...' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
