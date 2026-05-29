import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

interface QsaSocio { nome: string; cpfCnpj: string; qualificacao: string; dataEntrada: string; }
interface PersonLink {
  id: string; personId: string; role: string;
  assinaEcd?: boolean; assinaEcf?: boolean;
  person: { id: string; fullName: string; cpf: string; };
}
interface Props { companyId: string; partners: QsaSocio[]; }

export const QsaVinculoGrid: React.FC<Props> = ({ companyId, partners }) => {
  const navigate = useNavigate();
  const [links, setLinks] = useState<PersonLink[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    api.get('/persons/links/company/' + companyId).then(({ data }) => setLinks(data || [])).catch(() => {});
  }, [companyId]);

  const norm = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const cpfDigits = (masked: string) => (masked || '').replace(/\*/g, '').replace(/\D/g, '');
  const similarity = (a: string, b: string) => {
    const wa = norm(a).split(' '); const wb = norm(b).split(' ');
    const common = wa.filter(w => w.length > 2 && wb.includes(w));
    return common.length / Math.max(wa.length, wb.length);
  };

  const findMatch = (socio: QsaSocio): { link: PersonLink | null; status: 'ok' | 'diverge' | 'missing' } => {
    const digits = cpfDigits(socio.cpfCnpj);
    if (digits.length >= 4) {
      const byCpf = links.find(l => l.person.cpf && l.person.cpf.replace(/\D/g, '').includes(digits));
      if (byCpf) {
        const nameOk = similarity(byCpf.person.fullName, socio.nome) >= 0.4;
        return { link: byCpf, status: nameOk ? 'ok' : 'diverge' };
      }
    }
    const byName = links.find(l => norm(l.person.fullName) === norm(socio.nome));
    if (byName) return { link: byName, status: 'ok' };
    const partial = links.find(l => similarity(l.person.fullName, socio.nome) >= 0.5);
    if (partial) return { link: partial, status: 'diverge' };
    return { link: null, status: 'missing' };
  };

  const handleToggle = async (link: PersonLink, field: 'assinaEcd' | 'assinaEcf') => {
    setSaving(link.id + field);
    try {
      const newVal = !link[field];
      await api.patch('/persons/links/' + link.id, { [field]: newVal });
      setLinks(prev => prev.map(l => l.id === link.id ? { ...l, [field]: newVal } : l));
      toast.success('Atualizado!');
    } catch { toast.error('Erro.'); } finally { setSaving(null); }
  };

  if (!partners || partners.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-3">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-widest border-l-4 border-indigo-500 pl-3">QSA — Responsabilidades SPED</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
            <th className="text-center py-2 w-10">ECD</th>
            <th className="text-center py-2 w-10">ECF</th>
            <th className="text-left py-2">Nome</th>
            <th className="text-left py-2">Qualificacao</th>
            <th className="text-center py-2">Status</th>
            <th className="py-2 w-24"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {partners.map((socio, i) => {
            const { link, status } = findMatch(socio);
            const busy = saving?.startsWith(link?.id || '');
            return (
              <tr key={i} className="hover:bg-gray-50">
                <td className="py-2 text-center">
                  {link
                    ? <input type="checkbox" checked={!!link.assinaEcd} disabled={!!busy} onChange={() => handleToggle(link, 'assinaEcd')} className="w-4 h-4 cursor-pointer" />
                    : <span className="text-gray-200">—</span>}
                </td>
                <td className="py-2 text-center">
                  {link
                    ? <input type="checkbox" checked={!!link.assinaEcf} disabled={!!busy} onChange={() => handleToggle(link, 'assinaEcf')} className="w-4 h-4 cursor-pointer" />
                    : <span className="text-gray-200">—</span>}
                </td>
                <td className="py-2 font-medium text-gray-800">{socio.nome}</td>
                <td className="py-2 text-gray-500 text-xs">{socio.qualificacao}</td>
                <td className="py-2 text-center">
                  {status === 'ok' && <span className="text-green-600 text-xs font-semibold">✓ Ok</span>}
                  {status === 'diverge' && <span className="text-amber-500 text-xs font-semibold" title={link?.person.fullName}>⚠ Divergencia</span>}
                  {status === 'missing' && <span className="text-red-500 text-xs">Nao cadastrado</span>}
                </td>
                <td className="py-2 text-right">
                  {status === 'missing' && (
                    <button onClick={() => navigate('/app/persons/new?returnTo=' + encodeURIComponent('/app/companies/edit/' + companyId + '?tab=contabil'))}
                      className="text-xs text-blue-600 hover:underline font-semibold">+ Cadastrar</button>
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
