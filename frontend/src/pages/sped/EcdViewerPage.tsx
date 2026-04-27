// apps/frontend/src/pages/sped/EcdViewerPage.tsx
import React from 'react';
import { useParams } from 'react-router-dom';
import { useEcdViewer } from '../../components/hooks/use-ecd-viewer';
import { EcdAccountTree } from '../../components/sped/EcdAccountTree';

export const EcdViewerPage: React.FC = () => {
  const { importId } = useParams<{ importId: string }>();
  const { data, loading } = useEcdViewer(importId!);

  if (loading) return <div className="p-8 text-center">Carregando dados da ECD...</div>;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <p className="text-xs text-gray-500 uppercase font-bold">Empresa</p>
          <h2 className="text-lg font-semibold">{data.summary.companyName}</h2>
          <p className="text-sm text-gray-400">{data.summary.cnpj}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase font-bold">Período</p>
          <p className="text-md">{data.summary.period}</p>
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
            Leiaute {data.summary.layoutVersion}
          </span>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 uppercase font-bold">Status do Arquivo</p>
          <p className="font-medium text-indigo-600">{data.summary.contentType}</p>
        </div>
      </div>

      {/* Alertas de Consistência */}
      {data.consistency && data.consistency.totalDivergent > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-amber-700">
                Atenção: Foram encontradas <strong>{data.consistency.totalDivergent}</strong> divergências entre os saldos e lançamentos analíticos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="text-base font-semibold leading-6 text-gray-900">Plano de Contas e Saldos</h3>
        </div>

        <div className="p-4">
          <EcdAccountTree accounts={data.accounts} />
        </div>
        // Adicione este trecho dentro do card de Plano de Contas na EcdViewerPage.tsx
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="border-b border-gray-200 px-4 py-3 flex justify-between items-center">
            <h3 className="text-base font-semibold text-gray-900">Plano de Contas e Saldos</h3>
            <span className="text-xs text-gray-500">
              {data.accounts.length} contas carregadas
            </span>
          </div>
          <div className="p-4">
            <EcdAccountTree accounts={data.accounts} />
          </div>
        </div>
      </div>
    </div>
  );
};