// frontend/src/components/RentalAlertsCard.tsx
// NOVO 23/10/2026: card de alertas de locacao do Dashboard (GET /rental-contracts/alerts)
// - fim de contrato (90 dias), reajuste pendente / proximo, recebimentos de aluguel (15 dias)
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiHome, FiAlertTriangle, FiTrendingUp, FiCalendar, FiDollarSign } from 'react-icons/fi';

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

type Alerta = {
  tipo: 'FIM_CONTRATO' | 'REAJUSTE_PENDENTE' | 'REAJUSTE_PROXIMO' | 'RECEBIMENTO';
  severidade: 'alta' | 'media' | 'baixa';
  contratoId: string;
  imovel: string;
  data: string;
  dias: number;
  valor?: number;
  mensagem: string;
};

const TIPO: Record<Alerta['tipo'], { label: string; icon: React.ReactNode }> = {
  FIM_CONTRATO:      { label: 'Fim de contrato',  icon: <FiCalendar size={13} /> },
  REAJUSTE_PENDENTE: { label: 'Reajuste pendente', icon: <FiTrendingUp size={13} /> },
  REAJUSTE_PROXIMO:  { label: 'Reajuste próximo',  icon: <FiTrendingUp size={13} /> },
  RECEBIMENTO:       { label: 'Recebimento',       icon: <FiDollarSign size={13} /> },
};

const COR: Record<Alerta['severidade'], string> = {
  alta:  'bg-red-50 text-red-700 border-red-200',
  media: 'bg-amber-50 text-amber-700 border-amber-200',
  baixa: 'bg-blue-50 text-blue-700 border-blue-200',
};

const fmtData = (iso: string) => iso ? iso.slice(0, 10).split('-').reverse().join('/') : '-';
const fmtValor = (v?: number) => v === undefined ? '' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const RentalAlertsCard: React.FC<{ refreshKey?: unknown }> = ({ refreshKey }) => {
  const [alertas, setAlertas] = useState<Alerta[] | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('@ledgr:token');
    const company = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
    if (!company?.id) { setAlertas([]); return; }
    fetch(`${API}/rental-contracts/alerts`, {
      headers: { Authorization: `Bearer ${token}`, 'x-company-id': company.id },
    })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(d => setAlertas(d?.alertas ?? []))
      .catch(() => { setErro('Não foi possível carregar os alertas de locação.'); setAlertas([]); });
  }, [refreshKey]);

  if (alertas === null) return null;
  // empresa sem contratos de locacao: nao ocupa espaco no Dashboard
  if (!erro && alertas.length === 0) return null;

  const contagem = alertas.reduce<Record<string, number>>((acc, a) => { acc[a.severidade] = (acc[a.severidade] ?? 0) + 1; return acc; }, {});

  return (
    <div className="border border-gray-200 rounded-[10px] bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 text-[14px] font-medium text-gray-900">
          <FiHome size={14} className="text-blue-600" /> Locações - alertas
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          {contagem.alta ? <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700">{contagem.alta} urgente{contagem.alta > 1 ? 's' : ''}</span> : null}
          {contagem.media ? <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{contagem.media} pendente{contagem.media > 1 ? 's' : ''}</span> : null}
          <Link to="/app/assets/rental-contracts" className="text-blue-600 hover:underline">Ver contratos</Link>
        </div>
      </div>
      {erro ? (
        <p className="px-4 py-3 text-[12px] text-red-600 flex items-center gap-1.5"><FiAlertTriangle size={12} /> {erro}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {alertas.map((a, i) => (
            <li key={a.tipo + a.contratoId + a.data + i} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] whitespace-nowrap ${COR[a.severidade]}`}>
                  {TIPO[a.tipo]?.icon} {TIPO[a.tipo]?.label ?? a.tipo}
                </span>
                <span className="text-[13px] font-medium text-gray-900 whitespace-nowrap">{a.imovel}</span>
                <span className="text-[12px] text-gray-500 truncate">{a.mensagem}</span>
              </div>
              <div className="text-right text-[12px] text-gray-600 whitespace-nowrap">
                {a.valor !== undefined && <span className="mr-2 font-medium text-gray-800">{fmtValor(a.valor)}</span>}
                {fmtData(a.data)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default RentalAlertsCard;
