import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

interface QsaSocio { nome: string; cpfCnpj: string; qualificacao: string; dataEntrada: string; }

interface Shareholder {
  id: string;
  shareholderType: 'PF' | 'PJ';
  personId?: string;
  shareholderCompanyId?: string;
  qualificacao?: string;
  assinaEcd: boolean;
  assinaEcf: boolean;
  person?: { id: string; fullName: string; cpf: string };
  shareholderCompany?: { id: string; legalName: string; tradeName: string; taxId: string };
}

interface Props { companyId: string; partners: QsaSocio[]; readOnly?: boolean; }

export const QsaVinculoGrid: React.FC<Props> = ({ companyId, partners, readOnly = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  const load = () => {
    if (!companyId) return;
    api.get('/companies/' + companyId + '/shareholders')
      .then(({ data }) => setShareholders(data || []))
      .catch(() => {});
  };

  useEffect(() => { load(); }, [companyId]);

  // Auto-vinculo ao retornar de cadastro
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cpfVinculado = params.get('vinculado');
    if (!cpfVinculado || !companyId) return;
    const digits = cpfVinculado.replace(/\D/g, '');
    if (digits.length < 4) return;
    const socio = partners?.find(p => {
      const pd = (p.cpfCnpj || '').replace(/\*/g, '').replace(/\D/g, '');
      return pd.length >= 4 && digits.includes(pd);
    });
    if (!socio) return;
    const isPJ = digits.length === 14;
    const endpoint = isPJ ? '/companies/taxid/' + digits : '/persons/cpf/' + digits;
    api.get(endpoint).then(({ data: entity }) => {
      if (!entity?.id) return;
      return api.post('/companies/' + companyId + '/shareholders', {
        shareholderType: isPJ ? 'PJ' : 'PF',
        ...(isPJ ? { shareholderCompanyId: entity.id } : { personId: entity.id }),
        qualificacao: socio.qualificacao,
        dataEntrada: socio.dataEntrada || null,
        assinaEcd: !isPJ,
        assinaEcf: false,
      }).then(() => { load(); toast.success('Vinculo criado!'); });
    }).catch(() => {});
  }, [location.search]);

  const norm = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const cpfDigits = (masked: string) => (masked || '').replace(/\*/g, '').replace(/\D/g, '');
  const similarity = (a: string, b: string) => {
    const wa = norm(a).split(' '); const wb = norm(b).split(' ');
    const common = wa.filter(w => w.length > 2 && wb.includes(w));
    return common.length / Math.max(wa.length, wb.length);
  };

  const findMatch = (socio: QsaSocio): { sh: Shareholder | null; status: 'ok' | 'diverge' | 'missing' | 'pj' } => {
    const digits = cpfDigits(socio.cpfCnpj);
    const isPJ = digits.length === 14 || (socio.cpfCnpj || '').replace(/\D/g,'').length === 14;

    if (isPJ) {
      const found = shareholders.find(s =>
        s.shareholderType === 'PJ' &&
        s.shareholderCompany?.taxId?.replace(/\D/g,'').includes(digits)
      );
      return { sh: found || null, status: found ? 'ok' : 'pj' };
    }

    if (digits.length >= 4) {
      const byCpf = shareholders.find(s =>
        s.shareholderType === 'PF' &&
        s.person?.cpf?.replace(/\D/g,'').includes(digits)
      );
      if (byCpf) {
        const nameOk = similarity(byCpf.person?.fullName || '', socio.nome) >= 0.4;
        return { sh: byCpf, status: nameOk ? 'ok' : 'diverge' };
      }
    }
    const byName = shareholders.find(s =>
      s.shareholderType === 'PF' && norm(s.person?.fullName || '') === norm(socio.nome)
    );
    if (byName) return { sh: byName, status: 'ok' };
    const partial = shareholders.find(s =>
      s.shareholderType === 'PF' && similarity(s.person?.fullName || '', socio.nome) >= 0.5
    );
    if (partial) return { sh: partial, status: 'diverge' };
    return { sh: null, status: 'missing' };
  };

  const handleToggle = async (sh: Shareholder, field: 'assinaEcd' | 'assinaEcf') => {
    setSaving(sh.id + field);
    try {
      const newVal = !sh[field];
      await api.patch('/companies/' + companyId + '/shareholders/' + sh.id, { [field]: newVal });
      setShareholders(prev => prev.map(s => s.id === sh.id ? { ...s, [field]: newVal } : s));
      toast.success('Atualizado!');
    } catch { toast.error('Erro.'); } finally { setSaving(null); }
  };

  const handleVincular = async (socio: QsaSocio) => {
    const digits = cpfDigits(socio.cpfCnpj);
    const isPJ = digits.length === 14;
    const endpoint = isPJ ? '/companies/taxid/' + digits : '/persons/cpf/' + digits;
    try {
      const { data: entity } = await api.get(endpoint);
      if (entity?.id) {
        setSaving('linking');
        await api.post('/companies/' + companyId + '/shareholders', {
          shareholderType: isPJ ? 'PJ' : 'PF',
          ...(isPJ ? { shareholderCompanyId: entity.id } : { personId: entity.id }),
          qualificacao: socio.qualificacao,
          dataEntrada: socio.dataEntrada || null,
          assinaEcd: !isPJ,
          assinaEcf: false,
        });
        load();
        toast.success('Vinculo criado!');
        setSaving(null);
        return;
      }
    } catch { /* nao encontrado */ }
    const cpfParam = digits ? '&vinculado=' + digits : '';
    navigate('/app/persons/new?returnTo=' + encodeURIComponent('/app/companies/edit/' + companyId + '?tab=contabil' + cpfParam));
  };

  if (!partners || partners.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-3">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-widest border-l-4 border-indigo-500 pl-3">
        QSA - Responsabilidades SPED
      </div>
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
            const { sh, status } = findMatch(socio);
            const busy = saving?.startsWith(sh?.id || '');
            return (
              <tr key={i} className="hover:bg-gray-50">
                <td className="py-2 text-center">
                  {sh ? (
                    readOnly
                      ? <span className={sh.assinaEcd ? "text-emerald-600 font-bold" : "text-gray-300"}>{sh.assinaEcd ? "✓" : "—"}</span>
                      : <input type="checkbox" checked={!!sh.assinaEcd} disabled={!!busy || sh.shareholderType === 'PJ'} onChange={() => handleToggle(sh, 'assinaEcd')} className="w-4 h-4 cursor-pointer" />
                  ) : <span className="text-gray-200">—</span>}
                </td>
                <td className="py-2 text-center">
                  {sh ? (
                    readOnly
                      ? <span className={sh.assinaEcf ? "text-emerald-600 font-bold" : "text-gray-300"}>{sh.assinaEcf ? "✓" : "—"}</span>
                      : <input type="checkbox" checked={!!sh.assinaEcf} disabled={!!busy || sh.shareholderType === 'PJ'} onChange={() => handleToggle(sh, 'assinaEcf')} className="w-4 h-4 cursor-pointer" />
                  ) : <span className="text-gray-200">—</span>}
                </td>
                <td className="py-2 font-medium text-gray-800">{socio.nome}</td>
                <td className="py-2 text-gray-500 text-xs">{socio.qualificacao}</td>
                <td className="py-2 text-center">
                  {status === 'ok' && <span className="text-green-600 text-xs font-semibold">✓ Ok</span>}
                  {status === 'diverge' && <span className="text-amber-500 text-xs font-semibold" title={sh?.person?.fullName}>⚠ Divergencia</span>}
                  {status === 'missing' && <span className="text-red-500 text-xs">Nao cadastrado</span>}
                  {status === 'pj' && !sh && <span className="text-gray-400 text-xs">PJ — nao vinculada</span>}
                  {status === 'pj' && sh && <span className="text-green-600 text-xs font-semibold">✓ Ok</span>}
                </td>
                <td className="py-2 text-right">
                  {(status === 'missing' || (status === 'pj' && !sh)) && (
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
