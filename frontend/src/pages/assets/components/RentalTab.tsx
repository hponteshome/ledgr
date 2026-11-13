// frontend/src/pages/assets/components/RentalTab.tsx
// FICHA-01 (13/11/2026): aba Locacoes da Ficha do Imovel - todos os contratos do imovel (ativos e historicos).
// Cadastro unico: cria pelo mesmo formulario do Quadro Resumo; o detalhe (editar, encerrar, gerar contrato) e o modal existente.
// Contrato antigo: salvar e depois Encerrar no Quadro Resumo (o formulario de criacao nao tem status - nasce ATIVO).
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { RentalContractFormModal } from '../modals/RentalContractFormModal';
import { RentalContractDetailModal } from '../modals/RentalContractDetailModal';
import type { FixedAsset } from '../types/asset.types';

const STATUS: Record<string, { label: string; cls: string }> = {
  ATIVO: { label: 'Ativo', cls: 'bg-green-100 text-green-700' },
  ENCERRADO: { label: 'Encerrado', cls: 'bg-gray-100 text-gray-600' },
  RESCINDIDO: { label: 'Rescindido', cls: 'bg-red-100 text-red-700' },
  RENOVADO: { label: 'Renovado', cls: 'bg-blue-100 text-blue-700' },
};
const dBR = (d?: string | null) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '-');
const brl = (v: any) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// IMPL-LOC-02: mascara so na view (banco guarda so digitos)
const fmtDoc = (v?: string | null) => {
  const d = String(v ?? '').replace(/\D/g, '');
  if (d.length === 11 && /^[\d.\-\s]+$/.test(String(v))) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14 && /^[\d.\-\/\s]+$/.test(String(v))) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return v || '-';
};

export function RentalTab({ asset, onRefresh }: { asset: FixedAsset; onRefresh: () => void }) {
  const [novo, setNovo] = useState(false);
  const [aberto, setAberto] = useState<any | null>(null);
  // FICHA-02: contratos do proprio bem + do grupo (mesmo imovel, cadastrados em outro bem)
  const proprios: any[] = (asset as any).rentalContracts ?? [];
  const doGrupo: any[] = ((asset as any).groupRentalContracts ?? [])
    .map((c: any) => ({ ...c, _grupo: c.fixedAsset?.internalCode ?? 'outro bem' }));
  const contratos: any[] = [...proprios, ...doGrupo]
    .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
  const principal: string | null = !proprios.length && doGrupo.length ? doGrupo[0]._grupo : null;
  const novoContrato = () => {
    if (principal && !window.confirm('Este bem faz parte de um imóvel formado por vários bens. Os contratos desse imóvel estão cadastrados em ' + principal + '. Cadastrar mesmo assim neste bem?')) return;
    setNovo(true);
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contratos de locação do imóvel</h3>
        <button type="button" onClick={novoContrato}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700">
          <Plus size={14} /> Novo contrato
        </button>
      </div>
      {contratos.length === 0 ? (
        <div className="py-10 text-center text-gray-400 text-sm">Nenhum contrato de locação cadastrado para este imóvel</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="py-2 pr-2">Nº</th>
              <th className="py-2 pr-2">Locatário</th>
              <th className="py-2 pr-2">CPF/CNPJ</th>
              <th className="py-2 pr-2">Início</th>
              <th className="py-2 pr-2">Fim</th>
              <th className="py-2 pr-2 text-right">Aluguel</th>
              <th className="py-2 pr-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {contratos.map((c) => {
              const s = STATUS[c.status] ?? { label: c.status, cls: 'bg-gray-100 text-gray-600' };
              return (
                <tr key={c.id} onClick={() => setAberto(c)} title="Abrir o Quadro Resumo"
                  className="border-b hover:bg-gray-50 cursor-pointer">
                  <td className="py-2 pr-2 font-mono text-xs">{c.contractNumber || '-'}{c._grupo && <div className="text-[10px] text-blue-600 font-sans">do grupo - cadastrado em {c._grupo}</div>}</td>
                  <td className="py-2 pr-2">{c.tenantName}</td>
                  <td className="py-2 pr-2 font-mono text-xs">{fmtDoc(c.tenantTaxId)}</td>
                  <td className="py-2 pr-2">{dBR(c.startDate)}</td>
                  <td className="py-2 pr-2">{dBR(c.endDate)}</td>
                  <td className="py-2 pr-2 text-right">{brl(c.rentAmount)}</td>
                  <td className="py-2 pr-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="text-xs text-gray-400">
        Contratos encerrados ficam no histórico do imóvel. Contrato antigo: salve e depois use Encerrar no Quadro Resumo.
      </p>
      {novo && (
        <RentalContractFormModal asset={asset} onClose={() => setNovo(false)}
          onSuccess={() => { setNovo(false); onRefresh(); }} />
      )}
      {aberto && (
        <RentalContractDetailModal contractId={aberto.id} title={`Quadro Resumo - ${asset.internalCode}`}
          onClose={() => { setAberto(null); onRefresh(); }} />
      )}
    </div>
  );
}
