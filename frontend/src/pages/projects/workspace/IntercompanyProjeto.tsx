// frontend/src/pages/projects/workspace/IntercompanyProjeto.tsx
// Fase 1.11 parte B (04/10/2026): intercompany da operacao - o que a recebedora deve a beneficiaria, mes a mes:
// creditos VINCULADOS - aplicacoes por conta - devolucoes ao Adquirente. Saldos informados das contas espelho ao lado.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { Operacao, fmtBRL, fmtData, cardSt, thSt, tdSt, erroSt, secTitle, tituloSt, subtituloSt } from './projetoTema';
import { ModalProjeto, Secao, ErroModal, BotaoSec, BotaoPri, inputModal, erroApi } from './ModalProjeto';
import SaldoInformadoModal, { TIPOS_SALDO } from './SaldoInformadoModal';

interface Mes {
  mes: string; entradas: string; aplicacoes: string; devolucoes: string; saldoMes: string; saldoAcumulado: string;
  informadoRecebedora: string | null; diferencaRecebedora: string | null; informadoBeneficiaria: string | null; diferencaBeneficiaria: string | null;
}
interface Saldo { id: string; tipo: string; dataReferencia: string; valor: string; contaContabil: string | null; fonte: string; }

const nomeMes = (k: string) => { const [a, m] = k.split('-'); return `${m}/${a}`; };
const corDif = (v: string | null) => (v === null ? '#9CA3AF' : Math.abs(Number(v)) < 0.005 ? '#166534' : '#A32D2D');

export default function IntercompanyProjeto({ operacao, master }: { operacao: Operacao | null; master: boolean }) {
  const [meses, setMeses] = useState<Mes[]>([]);
  const [pend, setPend] = useState<{ quantidade: number; total: string } | null>(null);
  const [saldos, setSaldos] = useState<Saldo[]>([]);
  const [nomes, setNomes] = useState<{ recebedora: string; beneficiaria: string }>({ recebedora: 'Recebedora', beneficiaria: 'Beneficiária' });
  const [erro, setErro] = useState('');
  const [registrando, setRegistrando] = useState(false);
  const [encerrando, setEncerrando] = useState<Saldo | null>(null);

  const carregar = useCallback(() => {
    if (!operacao) return;
    setErro('');
    api.get(`/projects/operacoes/${operacao.id}/intercompany`).then((r) => { setMeses(r.data?.meses || []); setPend(r.data?.pendentesDecisao || null); }).catch((e) => setErro(erroApi(e, 'Falha ao carregar o intercompany.')));
    api.get(`/projects/operacoes/${operacao.id}/saldos-informados`).then((r) => setSaldos(r.data || [])).catch(() => {});
    api.get(`/projects/operacoes/${operacao.id}/participacoes`).then((r) => {
      const ps = r.data || [];
      const rec = ps.find((p: any) => p.papel?.codigo === 'RECEBEDORA_FINANCEIRA' && p.empresaNome);
      const ben = ps.find((p: any) => p.papel?.codigo === 'BENEFICIARIA_ECONOMICA' && p.empresaNome);
      setNomes({ recebedora: rec?.empresaNome || 'Recebedora', beneficiaria: ben?.empresaNome || 'Beneficiária' });
    }).catch(() => {});
  }, [operacao]);
  useEffect(() => { carregar(); }, [carregar]);

  const tot = useMemo(() => meses.reduce((s, m) => ({ e: s.e + Number(m.entradas), a: s.a + Number(m.aplicacoes), d: s.d + Number(m.devolucoes) }), { e: 0, a: 0, d: 0 }), [meses]);
  const atual = meses.length ? meses[meses.length - 1].saldoAcumulado : '0';

  if (!operacao) return <div style={{ color: '#6B7280' }}>Nenhuma operação disponível para o seu acesso.</div>;
  const kpi = (titulo: string, valor: string, cor?: string) => (
    <div style={{ ...cardSt, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{titulo}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: cor || '#111827', marginTop: 4 }}>{valor}</div>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={tituloSt}>Intercompany</div>
          <div style={subtituloSt}>{nomes.recebedora} deve a {nomes.beneficiaria}: créditos vinculados − aplicações por conta − devoluções ao Adquirente</div>
        </div>
        {master && <button onClick={() => setRegistrando(true)} style={{ padding: '8px 14px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Saldo informado</button>}
      </div>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      {pend && pend.quantidade > 0 && (
        <div style={{ background: '#FEF3C7', color: '#78350F', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
          {pend.quantidade} crédito(s), somando {fmtBRL(pend.total)}, aguardam decisão de vínculo e ainda não entram no intercompany.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {kpi('Créditos vinculados', fmtBRL(tot.e))}
        {kpi('Aplicações por conta', fmtBRL(tot.a))}
        {kpi('Devoluções ao Adquirente', fmtBRL(tot.d))}
        {kpi('Saldo esperado atual', fmtBRL(atual), '#134E4A')}
      </div>
      <div style={{ ...cardSt, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thSt}>Mês</th><th style={{ ...thSt, textAlign: 'right' }}>Créditos</th><th style={{ ...thSt, textAlign: 'right' }}>Aplicações</th>
              <th style={{ ...thSt, textAlign: 'right' }}>Devoluções</th><th style={{ ...thSt, textAlign: 'right' }}>Saldo do mês</th><th style={{ ...thSt, textAlign: 'right' }}>Saldo esperado</th>
              <th style={{ ...thSt, textAlign: 'right' }}>Informado ({nomes.recebedora})</th><th style={{ ...thSt, textAlign: 'right' }}>Dif.</th>
              <th style={{ ...thSt, textAlign: 'right' }}>Informado ({nomes.beneficiaria})</th><th style={{ ...thSt, textAlign: 'right' }}>Dif.</th>
            </tr>
          </thead>
          <tbody>
            {meses.length === 0 && <tr><td colSpan={10} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Sem movimento.</td></tr>}
            {meses.map((m) => (
              <tr key={m.mes}>
                <td style={tdSt}>{nomeMes(m.mes)}</td>
                <td style={{ ...tdSt, textAlign: 'right' }}>{Number(m.entradas) ? fmtBRL(m.entradas) : '-'}</td>
                <td style={{ ...tdSt, textAlign: 'right' }}>{Number(m.aplicacoes) ? fmtBRL(m.aplicacoes) : '-'}</td>
                <td style={{ ...tdSt, textAlign: 'right' }}>{Number(m.devolucoes) ? fmtBRL(m.devolucoes) : '-'}</td>
                <td style={{ ...tdSt, textAlign: 'right' }}>{fmtBRL(m.saldoMes)}</td>
                <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>{fmtBRL(m.saldoAcumulado)}</td>
                <td style={{ ...tdSt, textAlign: 'right' }}>{m.informadoRecebedora !== null ? fmtBRL(m.informadoRecebedora) : '-'}</td>
                <td style={{ ...tdSt, textAlign: 'right', color: corDif(m.diferencaRecebedora) }}>{m.diferencaRecebedora !== null ? fmtBRL(m.diferencaRecebedora) : ''}</td>
                <td style={{ ...tdSt, textAlign: 'right' }}>{m.informadoBeneficiaria !== null ? fmtBRL(m.informadoBeneficiaria) : '-'}</td>
                <td style={{ ...tdSt, textAlign: 'right', color: corDif(m.diferencaBeneficiaria) }}>{m.diferencaBeneficiaria !== null ? fmtBRL(m.diferencaBeneficiaria) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ ...cardSt, padding: 16 }}>
        <div style={secTitle}>Saldos informados</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>Referências externas, só para conferência. Nunca entram no cálculo.</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thSt}>Data</th><th style={thSt}>Tipo</th><th style={thSt}>Conta</th><th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={thSt}>Fonte</th>{master && <th style={thSt}></th>}</tr></thead>
          <tbody>
            {saldos.length === 0 && <tr><td colSpan={6} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 16 }}>Nenhum saldo informado.</td></tr>}
            {saldos.map((s) => (
              <tr key={s.id}>
                <td style={tdSt}>{fmtData(s.dataReferencia)}</td>
                <td style={tdSt}>{TIPOS_SALDO[s.tipo] || s.tipo}</td>
                <td style={{ ...tdSt, fontFamily: 'monospace', fontSize: 12 }}>{s.contaContabil || '-'}</td>
                <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>{fmtBRL(s.valor)}</td>
                <td style={{ ...tdSt, fontSize: 12, color: '#374151' }}>{s.fonte}</td>
                {master && <td style={{ ...tdSt, textAlign: 'right' }}><button onClick={() => setEncerrando(s)} style={{ padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#A32D2D', cursor: 'pointer' }}>Encerrar</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {registrando && <SaldoInformadoModal operacaoId={operacao.id} tipoInicial="INTERCOMPANY_RECEBEDORA" onClose={() => setRegistrando(false)} onFeito={() => { setRegistrando(false); carregar(); }} />}
      {encerrando && <EncerrarSaldoModal operacaoId={operacao.id} saldo={encerrando} onClose={() => setEncerrando(null)} onFeito={() => { setEncerrando(null); carregar(); }} />}
    </div>
  );
}

export function EncerrarSaldoModal({ operacaoId, saldo, onClose, onFeito }: { operacaoId: string; saldo: Saldo; onClose: () => void; onFeito: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valido = motivo.trim().length >= 10;
  const enviar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      await api.post(`/projects/operacoes/${operacaoId}/saldos-informados/${saldo.id}/encerrar`, { motivo: motivo.trim() });
      toast.success('Saldo informado encerrado.');
      onFeito();
    } catch (e: any) { setErro(erroApi(e, 'Falha ao encerrar.')); } finally { setEnviando(false); }
  };
  return (
    <ModalProjeto titulo="Encerrar saldo informado" subtitulo={`${fmtData(saldo.dataReferencia)} · ${fmtBRL(saldo.valor)}`} largura={460} onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Voltar</BotaoSec><BotaoPri onClick={enviar} ativo={valido && !enviando} perigo>{enviando ? 'Aguarde...' : 'Encerrar'}</BotaoPri></>}>
      <ErroModal msg={erro} />
      <Secao titulo="MOTIVO *"><textarea style={{ ...inputModal, minHeight: 64, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres. Ex.: substituído pelo balancete revisado." /></Secao>
    </ModalProjeto>
  );
}
