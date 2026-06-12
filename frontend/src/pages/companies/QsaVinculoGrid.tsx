import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

interface QsaSocio { nome: string; cpfCnpj: string; qualificacao: string; dataEntrada: string; }
interface PersonLink {
  id: string; personId: string; role: string;
  assinaEcd?: boolean; assinaEcf?: boolean;
  person: { id: string; fullName: string; cpf: string; };
}
interface Props { companyId: string; partners: QsaSocio[]; readOnly?: boolean; }

export const QsaVinculoGrid: React.FC<Props> = ({ companyId, partners, readOnly = false }) => {
  const navigate = useNavigate();
  const [links, setLinks] = useState<PersonLink[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const location = useLocation();

  // Ao retornar de cadastro de pessoa, tenta criar vinculo automaticamente
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cpfVinculado = params.get('vinculado');
    if (!cpfVinculado || !companyId) return;
    const digits = cpfVinculado.replace(/\D/g, '');
    if (digits.length < 4) return;
    // Busca o socio correspondente
    const socio = partners?.find(p => {
      const pd = (p.cpfCnpj || '').replace(/\*/g, '').replace(/\D/g, '');
      return pd.length >= 4 && digits.includes(pd);
    });
    if (!socio) return;
    api.get('/persons/cpf/' + digits).then(({ data: person }) => {
      if (!person?.id) return;
      return api.post('/persons/links', {
        personId: person.id,
        companyId,
        role: socio.qualificacao || 'socio',
        assinaEcd: true,
        assinaEcf: false,
      }).then(() => {
        return api.get('/persons/links/company/' + companyId);
      }).then(({ data }) => {
        setLinks(data || []);
        toast.success('Vinculo criado automaticamente!');
      });
    }).catch(() => {});
  }, [location.search]);

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

  const isPJ = (socio: QsaSocio) => {
    const digits = (socio.cpfCnpj || '').replace(/\D/g, '').replace(/\*/g, '');
    return digits.length === 14 || (socio.cpfCnpj || '').replace(/\D/g,'').length === 14;
  };

  const findMatch = (socio: QsaSocio): { link: PersonLink | null; status: 'ok' | 'diverge' | 'missing' | 'pj' } => {
    if (isPJ(socio)) return { link: null, status: 'pj' };
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
    return { link: null, status: 'missing' as const };
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

  const handleVincular = async (socio: QsaSocio) => {
    const digits = cpfDigits(socio.cpfCnpj);
    // Tenta buscar pessoa existente pelo CPF
    try {
      const endpoint = digits.length === 11
        ? '/persons/cpf/' + digits
        : '/companies/taxid/' + digits;
      const { data: person } = await api.get(endpoint);
      if (person?.id) {
        // Pessoa existe — cria vinculo direto
        setSaving('linking');
        await api.post('/persons/links', {
          personId: person.id,
          companyId,
          role: socio.qualificacao || 'socio',
          assinaEcd: true,
          assinaEcf: false,
        });
        const { data } = await api.get('/persons/links/company/' + companyId);
        setLinks(data || []);
        toast.success('Vinculo criado para ' + person.fullName + '!');
        setSaving(null);
        return;
      }
    } catch {
      // Pessoa nao encontrada — abre cadastro
    }
    const cpfParam = cpfDigits(socio.cpfCnpj) ? '&vinculado=' + cpfDigits(socio.cpfCnpj) : '';
    navigate('/app/persons/new?returnTo=' + encodeURIComponent('/app/companies/edit/' + companyId + '?tab=contabil' + cpfParam));
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
                    ? (readOnly
                        ? <span className={link.assinaEcd ? "text-emerald-600 font-bold text-base" : "text-gray-300"} >{link.assinaEcd ? "✓" : "—"}</span>
                        : <input type="checkbox" checked={!!link.assinaEcd} disabled={!!busy} onChange={() => handleToggle(link, 'assinaEcd')} className="w-4 h-4 cursor-pointer" />)
                    : <span className="text-gray-200">—</span>}
                </td>
                <td className="py-2 text-center">
                  {link
                    ? (readOnly
                        ? <span className={link.assinaEcf ? "text-emerald-600 font-bold text-base" : "text-gray-300"} >{link.assinaEcf ? "✓" : "—"}</span>
                        : <input type="checkbox" checked={!!link.assinaEcf} disabled={!!busy} onChange={() => handleToggle(link, 'assinaEcf')} className="w-4 h-4 cursor-pointer" />)
                    : <span className="text-gray-200">—</span>}
                </td>
                <td className="py-2 font-medium text-gray-800">{socio.nome}</td>
                <td className="py-2 text-gray-500 text-xs">{socio.qualificacao}</td>
                <td className="py-2 text-center">
                  {status === 'ok' && <span className="text-green-600 text-xs font-semibold">✓ Ok</span>}
                  {status === 'diverge' && <span className="text-amber-500 text-xs font-semibold" title={link?.person.fullName}>⚠ Divergencia</span>}
                  {status === 'missing' && <span className="text-red-500 text-xs">Nao cadastrado</span>}
                  {status === 'pj' && <span className="text-gray-400 text-xs" title="Pessoa Juridica - representante legal assina">PJ — ver rep. legal</span>}
                </td>
                <td className="py-2 text-right">
                  {status === 'missing' && !isPJ(socio) && (
                    <button onClick={() => handleVincular(socio)}
                      className="text-xs text-blue-600 hover:underline font-semibold">+ Vincular</button>
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
