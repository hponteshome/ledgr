// frontend/src/components/SituacaoFiscalCard.tsx
// DASH-03 (13/11/2026): situacao fiscal da empresa ativa no Dashboard - alertas (travados no topo),
// obrigacoes em atraso / a retificar / vencendo em 30 dias, DARFs em aberto e matriz obrigacao x ano.
// Fonte: GET /situacao-fiscal (fiscal_obligations + company_alerts + tax_darfs). Some quando nao ha nada cadastrado.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLock, FiAlertTriangle, FiAlertOctagon, FiRotateCcw, FiClock, FiDollarSign, FiChevronRight, FiGrid } from 'react-icons/fi';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { ListaRecolhida } from './ListaRecolhida';

type Sit = 'ATRASADA' | 'RETIFICAR' | 'PENDENTE' | 'ENTREGUE' | 'DISPENSADA';
interface Alerta { id: string; severity: string; title: string; message: string | null; locked: boolean; blocksAction: string | null; createdByName: string | null; createdAt: string; actionUrl?: string | null; actionLabel?: string | null; auto?: boolean; }
interface Grupo { code: string; label: string; sit: Sit; de: string; ate: string; qtd: number; dueDate: string; notes: string | null; dependsOn: string | null; }
interface Prox { id: string; code: string; label: string; competence: string; dueDate: string; notes: string | null; }
interface Darf { id: string; codigo: string; descricao: string | null; periodoApuracao: string | null; vencimento: string; total: number; numeroReferencia: string | null; vencido: boolean; }
interface Celula { sit: Sit; total: number; entregues: number; }
interface Painel {
  alertas: Alerta[];
  kpis: { atrasadas: number; retificar: number; vencendo30: number; darfsAbertos: number; darfsTotal: number; darfProxVenc: string | null };
  grupos: Grupo[]; proximas: Prox[]; darfs: Darf[];
  matriz: { anos: string[]; linhas: { code: string; label: string; celulas: Record<string, Celula> }[] };
}

const BRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
// Datas 'YYYY-MM-DD' formatadas sem passar por Date (evita deslocar um dia pelo fuso)
const fmtD = (iso: string | null) => { if (!iso) return '—'; const [y, m, d] = iso.slice(0, 10).split('-'); return d + '/' + m + '/' + y; };
const fmtComp = (c: string) => (c.length === 7 ? c.slice(5, 7) + '/' + c.slice(0, 4) : c);
const dias = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const t = new Date(y, m - 1, d); const h = new Date(); h.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - h.getTime()) / 86400000);
};

const COR: Record<Sit, { bg: string; fg: string; rot: string }> = {
  ATRASADA:   { bg: '#FEE2E2', fg: '#991B1B', rot: 'Em atraso' },
  RETIFICAR:  { bg: '#FFEDD5', fg: '#9A3412', rot: 'Retificar' },
  PENDENTE:   { bg: '#EFF6FF', fg: '#1D4ED8', rot: 'A entregar' },
  ENTREGUE:   { bg: '#D1FAE5', fg: '#065F46', rot: 'Entregue' },
  DISPENSADA: { bg: '#F3F4F6', fg: '#6B7280', rot: 'Dispensada' },
};
const ORDEM_LEGENDA: Sit[] = ['ATRASADA', 'RETIFICAR', 'PENDENTE', 'ENTREGUE', 'DISPENSADA'];

// Onde corrigir e orientacao de cada obrigacao (16/11/2026) - generico, para todas as empresas
const OBRIG: Record<string, { rota: string; dica: string }> = {
  ECF: { rota: '/app/sped/ecf', dica: 'Último dia útil de julho do ano seguinte. Atraso: Lei 8.218 art. 12 (Presumido) ou 0,25%/mês do lucro (Real).' },
  ECD: { rota: '/app/sped/ecd', dica: 'Último dia útil de junho. Obrigatória no Lucro Real; no Presumido, facultativa e sem multa.' },
  DIMOB: { rota: '/app/assets/rental-contracts', dica: 'Último dia útil de fevereiro. Multa por mês de atraso (MP 2.158-35, art. 57); base: contratos e recebimentos.' },
  EFD_CONTRIB: { rota: '/app/sped/efd', dica: '10º dia útil do 2º mês seguinte. Multa 0,02%/dia sobre a receita do mês, limite 1%.' },
  DCTF: { rota: '/app/sistema/obrigacoes', dica: 'DCTF mensal (PGD) até dez/2024: 15º dia útil do 2º mês. Multa 2%/mês sobre os tributos, mínimo R$ 500.' },
  DCTFWEB: { rota: '/app/hr/processamento-mensal', dica: 'DCTFWeb/MIT: último dia útil do mês seguinte (desde 2025). Confissão dos tributos do mês.' },
  PIS_COFINS: { rota: '/app/fiscal/apuracao', dica: 'DARF de PIS/Cofins até o dia 25 do mês seguinte.' },
  IRPJ_CSLL_TRI: { rota: '/app/fiscal/apuracao', dica: 'DARF de IRPJ/CSLL: último dia útil do mês seguinte ao trimestre.' },
  IRPJ_CSLL_AJUSTE: { rota: '/app/fiscal/apuracao', dica: 'Ajuste anual do Lucro Real: último dia útil de março do ano seguinte.' },
  DAS: { rota: '/app/fiscal/apuracao', dica: 'DAS do Simples: dia 20 do mês seguinte.' },
  DEFIS: { rota: '/app/sistema/obrigacoes', dica: 'DEFIS: 31 de março do ano seguinte.' },
  ESOCIAL: { rota: '/app/hr/processamento-mensal', dica: 'eSocial: eventos periódicos até o dia 15 do mês seguinte.' },
  FGTS: { rota: '/app/hr/folha', dica: 'FGTS Digital: dia 20 do mês seguinte.' },
  INSS_DARF: { rota: '/app/hr/processamento-mensal', dica: 'INSS pelo DARF da DCTFWeb: dia 20 do mês seguinte.' },
  GPS_INSS: { rota: '/app/hr/pro-labore', dica: 'GPS (até set/2021): dia 20 do mês seguinte.' },
  DIRF: { rota: '/app/hr/informe-rendimentos', dica: 'DIRF extinta a partir do AC 2025; até então, último dia útil de fevereiro.' },
};
const link: React.CSSProperties = { fontSize: 12, color: '#0369A1', cursor: 'pointer', fontWeight: 500 };
const linkCinza: React.CSSProperties = { fontSize: 12, color: '#6B7280', cursor: 'pointer' };

const pill = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 9999,
  fontSize: 11, fontWeight: 500, background: bg, color, whiteSpace: 'nowrap',
});
const caixa: React.CSSProperties = { background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' };
const cab: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.7rem 1rem',
  background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB', fontSize: 13, fontWeight: 500, color: '#111',
};
const titulo: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6 };

const Kpi: React.FC<{ cor: string; icone: React.ReactNode; rotulo: string; valor: React.ReactNode; sub: string }> = ({ cor, icone, rotulo, valor, sub }) => (
  <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderLeft: '3px solid ' + cor, borderRadius: 10, padding: '0.75rem 1rem' }}>
    <div style={{ fontSize: 11, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 5 }}>{icone} {rotulo}</div>
    <div style={{ fontSize: 22, fontWeight: 500, color: '#111', lineHeight: 1.2 }}>{valor}</div>
    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{sub}</div>
  </div>
);

export const SituacaoFiscalCard: React.FC<{ refreshKey?: number }> = ({ refreshKey }) => {
  const navigate = useNavigate();
  const [d, setD] = useState<Painel | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [resolv, setResolv] = useState<string | null>(null); const [nota, setNota] = useState(''); const [rk, setRk] = useState(0);

  useEffect(() => {
    let vivo = true;
    api.post('/finance/obrigacoes/gerar-historico').catch(() => null).then(() => api.get('/situacao-fiscal'))
      .then(r => { if (vivo) { setD(r.data?.data ?? r.data); setErro(null); } })
      .catch(e => { if (vivo) setErro(e?.response?.data?.message ?? 'Falha ao carregar a situação fiscal'); });
    return () => { vivo = false; };
  }, [refreshKey, rk]);

  if (erro) return <div style={{ ...caixa, padding: '0.75rem 1rem', fontSize: 12, color: '#991B1B', background: '#FCEBEB' }}>Situação fiscal: {erro}</div>;
  if (!d) return null;
  if (d.alertas.length === 0 && d.matriz.linhas.length === 0 && d.darfs.length === 0) return null;
  const k = d.kpis;
  const irObrigacoes = () => navigate('/app/sistema/obrigacoes');
  const irCod = (code: string) => navigate(OBRIG[code]?.rota ?? '/app/sistema/obrigacoes');
  const resolver = async (id: string) => {
    if (!nota.trim()) { toast.error('Informe o motivo da resolução.'); return; }
    try { await api.post('/situacao-fiscal/alertas/' + id + '/resolver', { nota }); toast.success('Resolução registrada.'); setResolv(null); setRk(k => k + 1); }
    catch (e: any) { toast.error(e?.response?.data?.message ?? 'Falha ao registrar a resolução'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ALERTAS - travados primeiro */}
      {d.alertas.map(a => {
        const critico = a.locked || a.severity === 'CRITICAL';
        return (
          <div key={a.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '0.85rem 1rem', borderRadius: 10,
            background: critico ? '#FEF2F2' : '#FFFBEB', border: '1px solid ' + (critico ? '#FCA5A5' : '#FCD34D'),
            borderLeft: '4px solid ' + (critico ? '#DC2626' : '#F59E0B') }}>
            <div style={{ paddingTop: 2, color: critico ? '#DC2626' : '#B45309' }}>{a.locked ? <FiLock size={18} /> : <FiAlertTriangle size={18} />}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: critico ? '#7F1D1D' : '#78350F' }}>{a.title}</div>
              {a.message && <div style={{ fontSize: 12, color: '#4B5563', marginTop: 3, lineHeight: 1.45 }}>{a.message}</div>}
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {a.locked && <span style={pill('#FEE2E2', '#991B1B')}><FiLock size={10} /> Travado - só sai com resolução registrada</span>}
                {a.blocksAction && <span style={pill('#F3F4F6', '#374151')}>Bloqueia: {a.blocksAction === 'ECF_EXPORT' ? 'geração da ECF' : a.blocksAction}</span>}
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>desde {fmtD(a.createdAt)}{a.createdByName ? ' · ' + a.createdByName : ''}</span>
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {a.actionUrl && <span onClick={() => navigate(a.actionUrl as string)} style={link}>{a.actionLabel || 'Ir para a correção'} →</span>}
                {!a.auto && resolv !== a.id && <span onClick={() => { setResolv(a.id); setNota(''); }} style={linkCinza}>Registrar resolução</span>}
                {resolv === a.id && (
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, minWidth: 260 }}>
                    <input autoFocus value={nota} onChange={e => setNota(e.target.value)} placeholder='Motivo da resolução (fica registrado)' style={{ flex: 1, height: 28, border: '0.5px solid #D1D5DB', borderRadius: 6, padding: '0 8px', fontSize: 12 }} />
                    <button type='button' onClick={() => resolver(a.id)} style={{ height: 28, border: 'none', borderRadius: 6, padding: '0 12px', fontSize: 12, background: '#111827', color: '#fff', cursor: 'pointer' }}>Confirmar</button>
                    <button type='button' onClick={() => setResolv(null)} style={{ height: 28, border: '0.5px solid #D1D5DB', borderRadius: 6, padding: '0 10px', fontSize: 12, background: '#fff', cursor: 'pointer' }}>Cancelar</button>
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <Kpi cor="#DC2626" icone={<FiAlertOctagon size={12} color="#DC2626" />} rotulo="Obrigações em atraso" valor={k.atrasadas} sub="competências não entregues após o prazo" />
        <Kpi cor="#EA580C" icone={<FiRotateCcw size={12} color="#EA580C" />} rotulo="A retificar" valor={k.retificar} sub="entregues com informação a corrigir" />
        <Kpi cor="#2563EB" icone={<FiClock size={12} color="#2563EB" />} rotulo="Vencendo em 30 dias" valor={k.vencendo30} sub="obrigações a entregar no prazo" />
        <Kpi cor="#7C3AED" icone={<FiDollarSign size={12} color="#7C3AED" />} rotulo="DARFs em aberto" valor={k.darfsAbertos ? BRL(k.darfsTotal) : '—'}
          sub={k.darfsAbertos ? k.darfsAbertos + ' DARF' + (k.darfsAbertos > 1 ? 's' : '') + ' · próximo vencimento ' + fmtD(k.darfProxVenc) : 'nenhum DARF em aberto'} />
      </div>

      {/* PENDENCIAS | PRAZOS E DARFS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 10 }}>
        <div style={caixa}>
          <div style={cab}>
            <span style={titulo}><FiAlertTriangle size={14} color="#DC2626" /> Pendências de obrigações <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>({d.grupos.length})</span></span>
            <span onClick={irObrigacoes} style={{ fontSize: 11, color: '#0369A1', cursor: 'pointer', fontWeight: 400 }}>Ver obrigações →</span>
          </div>
          {d.grupos.length === 0 && <div style={{ padding: '1.25rem', textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>Nenhuma pendência.</div>}
          <ListaRecolhida itens={d.grupos} render={(g, i, vis) => {
            const c = COR[g.sit];
            return (
              <div key={g.code + g.de + g.sit} onClick={() => irCod(g.code)} title={OBRIG[g.code]?.dica}
                style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '0.6rem 1rem', cursor: 'pointer',
                  borderBottom: i === vis.length - 1 ? 'none' : '0.5px solid #F3F4F6' }}>
                <span style={{ ...pill(c.bg, c.fg), minWidth: 74, justifyContent: 'center' }}>{c.rot}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>
                    {g.label} · {g.de === g.ate ? fmtComp(g.de) : fmtComp(g.de) + ' a ' + fmtComp(g.ate)}{g.qtd > 1 ? ' (' + g.qtd + ')' : ''}
                  </div>
                  {g.notes && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{g.notes}</div>}
                  {g.dependsOn && <div style={{ fontSize: 11, color: '#9A3412', marginTop: 1 }}>Depende de: {g.dependsOn}</div>}
                  {OBRIG[g.code] && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{OBRIG[g.code].dica}</div>}
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {g.sit === 'ATRASADA' ? 'prazo ' + fmtD(g.dueDate) : g.sit === 'PENDENTE' ? 'vence ' + fmtD(g.dueDate) : ''}
                  <div><FiChevronRight size={12} color="#D1D5DB" /></div>
                </div>
              </div>
            );
          }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={caixa}>
            <div style={cab}><span style={titulo}><FiClock size={14} color="#2563EB" /> Vencendo em 30 dias <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>({d.proximas.length})</span></span></div>
            {d.proximas.length === 0 && <div style={{ padding: '1rem', textAlign: 'center', fontSize: 12, color: '#9CA3AF' }}>Nada a entregar nos próximos 30 dias.</div>}
            <ListaRecolhida itens={d.proximas} render={p => {
              const n = dias(p.dueDate);
              return (
                <div key={p.id} onClick={() => irCod(p.code)} title={OBRIG[p.code]?.dica} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 1rem', borderBottom: '0.5px solid #F3F4F6', fontSize: 12 }}>
                  <span style={{ color: '#111' }}>{p.label} · {fmtComp(p.competence)}</span>
                  <span style={pill(n <= 3 ? '#FEF3C7' : '#D1FAE5', n <= 3 ? '#92400E' : '#065F46')}>{fmtD(p.dueDate)} · {n === 0 ? 'hoje' : n + 'd'}</span>
                </div>
              );
            }} />
          </div>
          <div style={caixa}>
            <div style={cab}><span style={titulo}><FiDollarSign size={14} color="#7C3AED" /> DARFs em aberto (tributos e multas) <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>({d.darfs.length})</span></span></div>
            {d.darfs.length === 0 && <div style={{ padding: '1rem', textAlign: 'center', fontSize: 12, color: '#9CA3AF' }}>Nenhum DARF em aberto.</div>}
            <ListaRecolhida itens={d.darfs} render={x => {
              const n = dias(x.vencimento);
              return (
                <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '0.5rem 1rem', borderBottom: '0.5px solid #F3F4F6', fontSize: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.codigo} · {x.descricao ?? ''}</div>
                    {x.numeroReferencia && <div style={{ fontSize: 11, color: '#9CA3AF' }}>Ref. {x.numeroReferencia}</div>}
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 500, color: '#111' }}>{BRL(x.total)}</div>
                    <span style={pill(n < 0 ? '#FEE2E2' : n <= 7 ? '#FEF3C7' : '#F3F4F6', n < 0 ? '#991B1B' : n <= 7 ? '#92400E' : '#374151')}>
                      {n < 0 ? 'vencido ' + fmtD(x.vencimento) : 'vence ' + fmtD(x.vencimento)}
                    </span>
                  </div>
                </div>
              );
            }} />
          </div>
        </div>
      </div>

      {/* MATRIZ obrigacao x ano */}
      {d.matriz.linhas.length > 0 && (
        <div style={caixa}>
          <div style={cab}>
            <span style={titulo}><FiGrid size={14} color="#0369A1" /> Situação por obrigação e ano</span>
            <span style={{ display: 'flex', gap: 10, fontSize: 11, fontWeight: 400, color: '#6B7280', flexWrap: 'wrap' }}>
              {ORDEM_LEGENDA.map(s => (
                <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: COR[s].fg, display: 'inline-block' }} />{COR[s].rot}
                </span>
              ))}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.5rem 1rem', color: '#6B7280', fontWeight: 500, borderBottom: '0.5px solid #E5E7EB' }}>Obrigação</th>
                  {d.matriz.anos.map(a => <th key={a} style={{ padding: '0.5rem', color: '#6B7280', fontWeight: 500, borderBottom: '0.5px solid #E5E7EB' }}>{a}</th>)}
                </tr>
              </thead>
              <tbody>
                {d.matriz.linhas.map(l => (
                  <tr key={l.code}>
                    <td style={{ padding: '0.45rem 1rem', color: '#111', borderBottom: '0.5px solid #F3F4F6', whiteSpace: 'nowrap', cursor: 'pointer' }} title={OBRIG[l.code]?.dica} onClick={() => irCod(l.code)}>{l.label}</td>
                    {d.matriz.anos.map(a => {
                      const c = l.celulas[a];
                      return (
                        <td key={a} style={{ padding: '0.35rem 0.5rem', textAlign: 'center', borderBottom: '0.5px solid #F3F4F6' }}>
                          {c
                            ? <span title={COR[c.sit].rot + (c.total > 1 ? ' - ' + c.entregues + ' de ' + c.total + ' em dia (entregues ou dispensadas)' : '')}
                                style={{ ...pill(COR[c.sit].bg, COR[c.sit].fg), minWidth: 64, justifyContent: 'center' }}>
                                {c.total > 1 ? c.entregues + '/' + c.total : COR[c.sit].rot}
                              </span>
                            : <span style={{ color: '#D1D5DB' }}>—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SituacaoFiscalCard;
