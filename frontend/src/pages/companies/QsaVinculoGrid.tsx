// frontend/src/pages/companies/QsaVinculoGrid.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

interface QsaSocio {
  nome: string;
  cpfCnpj: string;
  qualificacao: string;
  codigoQualificacao: number;
  dataEntrada: string;
}

interface PersonLink {
  id: string;
  personId: string;
  role: string;
  qualificacaoCvm?: string;
  assinaEcd?: boolean;
  assinaEcf?: boolean;
  person: { id: string; fullName: string; cpf: string; };
}

interface Props {
  companyId: string;
  partners: QsaSocio[];
  labelCls: string;
}

export const QsaVinculoGrid: React.FC<Props> = ({ companyId, partners, labelCls }) => {
  const navigate = useNavigate();
  const [links, setLinks] = useState<PersonLink[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    api.get('/persons/links/company/' + companyId)
      .then(({ data }) => setLinks(data || []))
      .catch(() => {});
  }, [companyId]);

  const normalize = (s: string) => s?.toLowerCase().replace(/\s+/g, ' ').trim();
  const findLink = (socio: QsaSocio) =>
    links.find(l => normalize(l.person.fullName) === normalize(socio.nome));

  const handleToggle = async (socio: QsaSocio, field: 'assinaEcd' | 'assinaEcf', current: boolean) => {
    const link = findLink(socio);
    if (!link) return;
    setSaving(socio.nome + field);
    try {
      await api.patch('/persons/links/' + link.id, { [field]: !current });
      setLinks(prev => prev.map(l => l.id === link.id ? { ...l, [field]: !current } : l));
      toast.success('Atualizado!');
    } catch { toast.error('Erro ao atualizar.'); }
    finally { setSaving(null); }
  };

  if (!partners || partners.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-3">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-widest border-l-4 border-indigo-500 pl-3">
        QSA — Responsabilidades SPED
      </div>
      <div className="text-xs text-gray-400 mb-2">Match por nome com cadastro de Pessoas Fisicas</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
            <th className="text-left py-2 font-semibold">Nome</th>
            <th className="text-left py-2 font-semibold">Qualificacao</th>
            <th className="text-center py-2 font-semibold">Cadastrado</th>
            <th className="text-center py-2 font-semibold">Assina ECD</th>
            <th className="text-center py-2 font-semibold">Assina ECF</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {partners.map((socio, i) => {
            const link = findLink(socio);
            const isSaving = saving?.startsWith(socio.nome);
            return (
              <tr key={i} className="hover:bg-gray-50">
                <td className="py-2 font-medium text-gray-800">{socio.nome}</td>
                <td className="py-2 text-gray-500 text-xs">{socio.qualificacao}</td>
                <td className="py-2 text-center">
                  {link
                    ? <span className="text-green-600 text-xs font-semibold">Cadastrado</span>
                    : <span className="text-amber-600 text-xs">Nao cadastrado</span>}
                </td>
                <td className="py-2 text-center">
                  {link
                    ? <input type="checkbox" checked={!!link.assinaEcd} disabled={!!isSaving}
                        onChange={() => handleToggle(socio, 'assinaEcd', !!link.assinaEcd)}
                        className="w-4 h-4 rounded text-blue-600 cursor-pointer" />
                    : <span className="text-gray-300">-</span>}
                </td>
                <td className="py-2 text-center">
                  {link
                    ? <input type="checkbox" checked={!!link.assinaEcf} disabled={!!isSaving}
                        onChange={() => handleToggle(socio, 'assinaEcf', !!link.assinaEcf)}
                        className="w-4 h-4 rounded text-blue-600 cursor-pointer" />
                    : <span className="text-gray-300">-</span>}
                </td>
                <td className="py-2 text-right">
                  {!link && (
                    <button onClick={() => navigate('/app/persons/new?returnTo=' + encodeURIComponent('/app/companies/edit/' + companyId + '?tab=contabil'))}
                      className="text-xs text-blue-600 hover:underline font-semibold">
                      + Cadastrar
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
