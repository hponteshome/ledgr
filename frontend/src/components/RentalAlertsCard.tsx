// frontend/src/components/RentalAlertsCard.tsx
// NOVO 23/10/2026 (v2 - layout): alertas de locacao do Dashboard (GET /rental-contracts/alerts)
// Tres paineis no mesmo estilo do Dashboard: Contratos | Reajustes | Recebimentos.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiHome, FiCalendar, FiTrendingUp, FiDollarSign, FiChevronRight, FiAlertTriangle } from 'react-icons/fi';

import { ListaRecolhida } from './ListaRecolhida';

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

type Tipo = 'FIM_CONTRATO' | 'REAJUSTE_PENDENTE' | 'REAJUSTE_PROXIMO' | 'RECEBIMENTO';
type Alerta = {
  tipo: Tipo; severidade: 'alta' | 'media' | 'baixa';
  contratoId: string; imovel: string; data: string; dias: number; valor?: number; mensagem: string;
};

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '-');

const pill = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 9999,
  fontSize: 11, fontWeight: 500, background: bg, color, whiteSpace: 'nowrap',
});
const CORES = {
  vermelho: { bg: '#FEE2E2', fg: '#991B1B', dot: '#EF4444' },
  laranja:  { bg: '#FFEDD5', fg: '#9A3412', dot: '#F97316' },
  amarelo:  { bg: '#FEF9C3', fg: '#854D0E', dot: '#F59E0B' },
  verde:    { bg: '#D1FAE5', fg: '#065F46', dot: '#10B981' },
  azul:     { bg: '#DBEAFE', fg: '#1E40AF', dot: '#3B82F6' },
};

const prazo = (dias: number) => {
  if (dias < 0)   return { txt: 'Vencido ' + Math.abs(dias) + 'd', c: CORES.vermelho };
  if (dias === 0) return { txt: 'Hoje', c: CORES.vermelho };
  if (dias <= 7)  return { txt: dias + (dias === 1 ? ' dia' : ' dias'), c: CORES.amarelo };
  if (dias <= 30) return { txt: dias + ' dias', c: CORES.azul };
  return { txt: dias + ' dias', c: CORES.verde };
};

const Linha: React.FC<{ dot: string; titulo: string; sub: React.ReactNode; direita: React.ReactNode; ultima: boolean; onClick: () => void }> =
  ({ dot, titulo, sub, direita, ultima, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 1rem', cursor: 'pointer',
               borderBottom: ultima ? 'none' : '0.5px solid #F3F4F6', background: hov ? '#F9FAFB' : '#fff', transition: 'background 0.12s' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{titulo}</div>
        <div style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {direita}
        <FiChevronRight size={12} color="#D1D5DB" />
      </div>
    </div>
  );
};

const Painel: React.FC<{ icone: React.ReactNode; titulo: string; total: number; destaque?: { txt: string; c: typeof CORES.vermelho }; children: React.ReactNode }> =
  ({ icone, titulo, total, destaque, children }) => (
  <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.7rem 1rem', background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#111' }}>
        {icone} {titulo}
        <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>({total})</span>
      </div>
      {destaque && <span style={pill(destaque.c.bg, destaque.c.fg)}>{destaque.txt}</span>}
    </div>
    {children}
  </div>
);

export const RentalAlertsCard: React.FC<{ refreshKey?: unknown }> = ({ refreshKey }) => {
  const navigate = useNavigate();
  const [alertas, setAlertas] = useState<Alerta[] | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('@ledgr:token');
    const company = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
    if (!company?.id) { setAlertas([]); return; }
    setErro('');
    fetch(`${API}/rental-contracts/alerts`, { headers: { Authorization: `Bearer ${token}`, 'x-company-id': company.id } })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(d => setAlertas(d?.alertas ?? []))
      .catch(() => { setErro('Não foi possível carregar os alertas de locação.'); setAlertas([]); });
  }, [refreshKey]);

  const grupos = useMemo(() => {
    const a = alertas ?? [];
    const porData = (x: Alerta, y: Alerta) => x.data.localeCompare(y.data);
    return {
      contratos: a.filter(x => x.tipo === 'FIM_CONTRATO').sort(porData),
      reajustes: a.filter(x => x.tipo === 'REAJUSTE_PENDENTE' || x.tipo === 'REAJUSTE_PROXIMO').sort(porData),
      receber:   a.filter(x => x.tipo === 'RECEBIMENTO').sort(porData),
    };
  }, [alertas]);

  if (alertas === null) return null;
  if (!erro && alertas.length === 0) return null;

  const irContratos = () => navigate('/app/assets/rental-contracts');
  const totalReceber = grupos.receber.reduce((s, x) => s + (x.valor ?? 0), 0);
  const pendentes = grupos.reajustes.filter(x => x.tipo === 'REAJUSTE_PENDENTE').length;

  return (
    <div style={{ marginBottom: 8 }}>
      <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', padding: '0.5rem 0', display: 'flex', alignItems: 'center', gap: 6 }}>
        <FiHome size={12} /> Locações - atenção
      </p>
      {erro ? (
        <div style={{ ...pill(CORES.vermelho.bg, CORES.vermelho.fg), padding: '8px 12px', borderRadius: 8 }}><FiAlertTriangle size={12} /> {erro}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10, alignItems: 'start' }}>
          {grupos.contratos.length > 0 && (
            <Painel icone={<FiCalendar size={14} color="#DC2626" />} titulo="Contratos a vencer" total={grupos.contratos.length}
              destaque={grupos.contratos.some(x => x.dias <= 30) ? { txt: 'Renovar', c: CORES.vermelho } : undefined}>
              <ListaRecolhida itens={grupos.contratos} render={(x, i, vis) => {
                const p = prazo(x.dias);
                return <Linha key={x.contratoId + x.tipo} dot={p.c.dot} titulo={x.imovel} ultima={i === vis.length - 1} onClick={irContratos}
                  sub={'Termina em ' + dataBR(x.data)} direita={<span style={pill(p.c.bg, p.c.fg)}>{p.txt}</span>} />;
              }} />
            </Painel>
          )}
          {grupos.reajustes.length > 0 && (
            <Painel icone={<FiTrendingUp size={14} color="#EA580C" />} titulo="Reajustes" total={grupos.reajustes.length}
              destaque={pendentes > 0 ? { txt: pendentes + ' a aplicar', c: CORES.laranja } : undefined}>
              <ListaRecolhida itens={grupos.reajustes} render={(x, i, vis) => {
                const pend = x.tipo === 'REAJUSTE_PENDENTE';
                const semIndice = /sem índice/i.test(x.mensagem);
                const indice = (x.mensagem.match(/\(([^)]+)\)/)?.[1] ?? '').replace('IGPM', 'IGP-M');
                return <Linha key={x.contratoId + x.tipo} dot={pend ? CORES.laranja.dot : CORES.azul.dot} titulo={x.imovel}
                  ultima={i === vis.length - 1} onClick={irContratos}
                  sub={<>{semIndice ? <span style={{ color: '#B45309' }}>Sem índice cadastrado</span> : indice}{' · data-base ' + dataBR(x.data)}</>}
                  direita={pend ? <span style={pill(CORES.laranja.bg, CORES.laranja.fg)}>Pendente</span>
                                : <span style={pill(CORES.azul.bg, CORES.azul.fg)}>em {x.dias} dias</span>} />;
              }} />
            </Painel>
          )}
          {grupos.receber.length > 0 && (
            <Painel icone={<FiDollarSign size={14} color="#059669" />} titulo="Aluguéis a receber" total={grupos.receber.length}
              destaque={{ txt: BRL(totalReceber), c: CORES.verde }}>
              <ListaRecolhida itens={grupos.receber} render={(x, i, vis) => {
                const p = prazo(x.dias);
                const comp = (x.mensagem.match(/(\d{4}-\d{2})/)?.[1] ?? '').split('-').reverse().join('/');
                return <Linha key={x.contratoId + x.data} dot={p.c.dot} titulo={x.imovel} ultima={i === vis.length - 1}
                  onClick={() => navigate('/app/finance/contas-receber')}
                  sub={'Aluguel ' + comp + ' · vence ' + dataBR(x.data)}
                  direita={<><span style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{BRL(x.valor ?? 0)}</span><span style={pill(p.c.bg, p.c.fg)}>{p.txt}</span></>} />;
              }} />
            </Painel>
          )}
        </div>
      )}
    </div>
  );
};

export default RentalAlertsCard;
