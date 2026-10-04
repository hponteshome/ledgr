// frontend/src/pages/projects/workspace/PendenciasProjeto.tsx
// Fase 1.8 (03/10/2026): pendencias da operacao - entradas do extrato sem ligacao (incluir como credito ou marcar como
// nao pertencente) e remetentes nao identificados. Acoes so Master, com motivo e AuditLog. Modais no padrao APPayModal.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { Operacao, fmtBRL, fmtData, cardSt, thSt, tdSt, erroSt, secTitle, tituloSt, subtituloSt } from './projetoTema';

const FIN = '#1A4A3A';
const FIN_ACCENT = '#3DAA7A';
const FIN_LIGHT = '#E8F5EE';

interface Entrada {
  id: string; data: string; valor: string; lancamento: string; pagadorNome: string | null; pagadorDocumento: string | null;
  remetenteConhecido: { id: string; nome: string } | null; depoisDaDataBase: boolean;
}
interface NaoIdentificado { id: string; numeroOrdem: number | null; dataCredito: string; valor: string; referenciaBancaria: string | null; origem: string; }
interface Pendencias { dataBase: string | null; entradasSemLigacao: Entrada[]; remetentesNaoIdentificados: NaoIdentificado[]; }
type Filtro = 'DEPOIS' | 'ATE' | 'TODAS';

function AcaoModal({ titulo, subtitulo, aviso, comVinculo, rotulo, onClose, onConfirmar }: {
  titulo: string; subtitulo: string; aviso: string; comVinculo: boolean; rotulo: string;
  onClose: () => void; onConfirmar: (motivo: string, vincular: boolean) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  const [vincular, setVincular] = useState(true);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const valido = motivo.trim().length >= 10;
  const confirmar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try { await onConfirmar(motivo.trim(), vincular); } catch (e: any) { setErro(e?.response?.data?.message || 'Falha ao registrar.'); } finally { setEnviando(false); }
  };
  const secao: React.CSSProperties = { background: FIN_LIGHT, borderRadius: 8, padding: '12px 14px', borderLeft: `3px solid ${FIN_ACCENT}` };
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 520, maxWidth: '94vw', maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ background: FIN, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{titulo}</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 1 }}>{subtitulo}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 15 }}>×</button>
        </div>
        <div style={{ padding: 18, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {erro && <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>⚠ {erro}</div>}
          <div style={{ ...secao, fontSize: 12, color: '#374151' }}>{aviso}</div>
          {comVinculo && (
            <div style={secao}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={vincular} onChange={(e) => setVincular(e.target.checked)} /> Vincular à Conta Individual do Adquirente da operação
              </label>
            </div>
          )}
          <div style={secao}>
            <div style={{ fontSize: 11, fontWeight: 700, color: FIN, marginBottom: 10 }}>MOTIVO *</div>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres. Fica registrado na trilha de auditoria."
              style={{ width: '100%', minHeight: 72, padding: '7px 10px', border: '0.5px solid #E5E7EB', borderRadius: 7, fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ background: '#FAFAFA', borderTop: '0.5px solid #E5E7EB', padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 14px', background: '#fff', color: '#374151', border: '0.5px solid #E5E7EB', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={confirmar} disabled={!valido || enviando}
            style={{ padding: '8px 16px', background: FIN, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: valido ? 'pointer' : 'default', opacity: valido && !enviando ? 1 : 0.6 }}>
            {enviando ? 'Aguarde...' : rotulo}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PendenciasProjeto({ operacao }: { operacao: Operacao | null }) {
  const [dados, setDados] = useState<Pendencias | null>(null);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('DEPOIS');
  const [soConhecidos, setSoConhecidos] = useState(false);
  const [acao, setAcao] = useState<{ tipo: 'incluir' | 'descartar'; entrada: Entrada } | null>(null);

  const carregar = useCallback(() => {
    if (!operacao) return;
    setErro('');
    api.get(`/projects/operacoes/${operacao.id}/pendencias`)
      .then((r) => setDados(r.data))
      .catch((e) => setErro(e?.response?.data?.message || 'Falha ao carregar as pendências.'));
  }, [operacao]);
  useEffect(() => { carregar(); }, [carregar]);

  const lista = useMemo(() => (dados?.entradasSemLigacao || []).filter((e) =>
    (filtro === 'TODAS' || (filtro === 'DEPOIS' ? e.depoisDaDataBase : !e.depoisDaDataBase)) && (!soConhecidos || !!e.remetenteConhecido)), [dados, filtro, soConhecidos]);
  const total = lista.reduce((s, e) => s + Number(e.valor), 0);
  const conhecidas = (dados?.entradasSemLigacao || []).filter((e) => e.remetenteConhecido && e.depoisDaDataBase);

  if (!operacao) return <div style={{ color: '#6B7280' }}>Nenhuma operação disponível para o seu acesso.</div>;

  const botaoFiltro = (f: Filtro, rotulo: string) => (
    <button onClick={() => setFiltro(f)} style={{ padding: '6px 12px', fontSize: 12, borderRadius: 7, cursor: 'pointer',
      border: filtro === f ? '1px solid #134E4A' : '0.5px solid #E5E7EB', background: filtro === f ? '#F0FDFA' : '#fff', color: filtro === f ? '#134E4A' : '#374151', fontWeight: filtro === f ? 600 : 400 }}>{rotulo}</button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={tituloSt}>Pendências</div>
        <div style={subtituloSt}>{operacao.nome} · o que ainda exige decisão</div>
      </div>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      {conhecidas.length > 0 && (
        <div style={{ background: '#FEF3C7', color: '#78350F', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
          <b>{conhecidas.length} entrada(s) depois da data-base vêm de remetentes que já pagam a operação</b>, somando {fmtBRL(conhecidas.reduce((s, e) => s + Number(e.valor), 0))}. São as candidatas mais fortes a créditos novos.
        </div>
      )}
      <div style={{ ...cardSt, padding: 16 }}>
        <div style={secTitle}>Entradas do extrato sem ligação com a operação</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {botaoFiltro('DEPOIS', `Depois da data-base (${fmtData(dados?.dataBase)})`)}
          {botaoFiltro('ATE', 'Até a data-base')}
          {botaoFiltro('TODAS', 'Todas')}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', cursor: 'pointer', marginLeft: 8 }}>
            <input type="checkbox" checked={soConhecidos} onChange={(e) => setSoConhecidos(e.target.checked)} /> Só remetentes conhecidos
          </label>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 13, color: '#374151' }}>{lista.length} entrada(s) · <b>{fmtBRL(total)}</b></div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th style={thSt}>Data</th><th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={thSt}>Lançamento</th><th style={thSt}>Pagador (extrato)</th><th style={thSt}></th><th style={thSt}></th></tr>
            </thead>
            <tbody>
              {lista.length === 0 && <tr><td colSpan={6} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Nenhuma entrada para exibir.</td></tr>}
              {lista.map((e) => (
                <tr key={e.id}>
                  <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>{fmtData(e.data)}</td>
                  <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtBRL(e.valor)}</td>
                  <td style={{ ...tdSt, fontSize: 12 }}>{e.lancamento}</td>
                  <td style={tdSt}>
                    {e.pagadorNome ? <div>{e.pagadorNome}</div> : <i style={{ color: '#9CA3AF' }}>extrato sem pagador</i>}
                    {e.pagadorDocumento && <div style={{ fontSize: 11, color: '#6B7280', fontFamily: 'monospace' }}>{e.pagadorDocumento}</div>}
                  </td>
                  <td style={tdSt}>
                    {e.remetenteConhecido && <span style={{ fontSize: 11, fontWeight: 600, color: '#134E4A', background: '#F0FDFA', border: '0.5px solid #99F6E4', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>Remetente conhecido</span>}
                  </td>
                  <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setAcao({ tipo: 'incluir', entrada: e })} style={{ padding: '4px 10px', fontSize: 12, border: 'none', borderRadius: 7, background: '#134E4A', color: '#fff', cursor: 'pointer', marginRight: 6 }}>Incluir</button>
                    <button onClick={() => setAcao({ tipo: 'descartar', entrada: e })} style={{ padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#374151', cursor: 'pointer' }}>Não pertence</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ ...cardSt, padding: 16 }}>
        <div style={secTitle}>Créditos com remetente não identificado</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
          O extrato não informa o pagador nestes lançamentos (depósito em caixa e transferências SISPAG). A identificação depende de comprovante ou de outra fonte.
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thSt}>Nº</th><th style={thSt}>Data</th><th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={thSt}>Referência bancária</th></tr></thead>
          <tbody>
            {(dados?.remetentesNaoIdentificados || []).map((c) => (
              <tr key={c.id}>
                <td style={tdSt}>{c.numeroOrdem ?? '-'}</td>
                <td style={tdSt}>{fmtData(c.dataCredito)}</td>
                <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>{fmtBRL(c.valor)}</td>
                <td style={{ ...tdSt, fontSize: 12 }}>{c.referenciaBancaria || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {acao && (
        <AcaoModal
          titulo={acao.tipo === 'incluir' ? 'Incluir como crédito da operação' : 'Entrada não pertence à operação'}
          subtitulo={`${fmtData(acao.entrada.data)} · ${fmtBRL(acao.entrada.valor)} · ${acao.entrada.pagadorNome || 'pagador não identificado no extrato'}`}
          aviso={acao.tipo === 'incluir'
            ? 'Cria um crédito da operação a partir desta entrada, já comprovado por ela. Se o pagador ainda não for conhecido, ele é cadastrado como remetente com os dados do extrato.'
            : 'A entrada deixa de aparecer nas pendências desta operação. A decisão fica registrada com o motivo e pode ser revista.'}
          comVinculo={acao.tipo === 'incluir'}
          rotulo={acao.tipo === 'incluir' ? 'Incluir crédito' : 'Registrar'}
          onClose={() => setAcao(null)}
          onConfirmar={async (motivo, vincular) => {
            await api.post(`/projects/operacoes/${operacao.id}/extrato/${acao.entrada.id}/${acao.tipo}`, { motivo, vincular });
            toast.success(acao.tipo === 'incluir' ? 'Crédito incluído.' : 'Decisão registrada.');
            setAcao(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}
