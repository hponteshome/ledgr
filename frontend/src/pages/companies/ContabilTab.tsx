// frontend/src/pages/companies/ContabilTab.tsx
import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { PersonLookupField } from '../../components/PersonLookupField';
import { QsaVinculoGrid } from './QsaVinculoGrid';

interface Props { companyId: string; labelCls: string; inputCls: string; partners?: any[]; }

export const ContabilTab: React.FC<Props> = ({ companyId, labelCls, inputCls, partners }) => {
  const [config, setConfig] = useState<any>({});
  const [searchParams] = useSearchParams();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get('/accounting/config')
    .then(({ data }) => {
      const base = data || {};
      const cnpjParam = searchParams.get('escritorioCnpj');
      if (cnpjParam && !base.escritorioCnpj) base.escritorioCnpj = cnpjParam;
      setConfig(base);
    })
  }, [companyId]);

  const upd = (field: string, value: string) => setConfig((p: any) => ({ ...p, [field]: value }));

  const F = ({ label, field, placeholder }: { label: string; field: string; placeholder?: string }) => (
    <div>
      <label className={labelCls}>{label}</label>
      <input value={config[field] || ''} onChange={e => upd(field, e.target.value)}
        placeholder={placeholder} className={inputCls} />
    </div>
  );

  const handleSave = async () => {
    setSaving(true);
    try { await api.put('/accounting/config', config); toast.success('Configuração contábil salva!'); }
    catch { toast.error('Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">

      {/* Escritorio Contabil */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
      {partners && partners.length > 0 && (
        <QsaVinculoGrid companyId={companyId} partners={partners} labelCls={labelCls} />
      )}

        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest border-l-4 border-green-500 pl-3">Escritório / Organização Contábil</div>
        <PersonLookupField
          label="Escritório Contábil"
          cpfCnpj={config.escritorioCnpj || ''} initialFound={!!config.escritorioCnpj}
          name={config.escritorioNome || ''}
          onCpfCnpjChange={v => upd('escritorioCnpj', v)}
          onNameChange={v => upd('escritorioNome', v)}
          onFound={d => { upd('escritorioNome', d.legalName || d.fullName || ''); upd('escritorioEmail', d.email || ''); upd('escritorioTelefone', d.phone1 || ''); }}
          labelCls={labelCls} inputCls={inputCls} tipo="empresa" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <F label="CRC (Organização)" field="escritorioCrc" placeholder="2SP000000/O-8" />
          <F label="UF CRC" field="escritorioCrcState" placeholder="SP" />
          <F label="E-mail" field="escritorioEmail" />
          <F label="Telefone" field="escritorioTelefone" />
        </div>
      </div>

      {/* Contador */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest border-l-4 border-blue-500 pl-3">Contador Responsável (Assina ECD/ECF)</div>
        <PersonLookupField
          label="Contador"
          cpfCnpj={config.accountantCpf || ''} initialFound={!!config.accountantCpf}
          name={config.accountantName || ''}
          onCpfCnpjChange={v => upd('accountantCpf', v)}
          onNameChange={v => upd('accountantName', v)}
          onFound={d => { upd('accountantName', d.fullName || ''); upd('accountantCrc', d.crcNumber || ''); upd('accountantCrcState', d.crcState || ''); }}
          labelCls={labelCls} inputCls={inputCls} tipo="pessoa" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <F label="CRC" field="accountantCrc" placeholder="1SP999999/O-1" />
          <F label="UF CRC" field="accountantCrcState" placeholder="SP" />
          <F label="Função" field="accountantRole" placeholder="Contador" />
        </div>
      </div>

      {/* Representante Legal */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest border-l-4 border-purple-500 pl-3">Representante Legal</div>
        <PersonLookupField
          label="Representante Legal"
          cpfCnpj={config.legalRepCpf || ''} initialFound={!!config.legalRepCpf}
          name={config.legalRepName || ''}
          onCpfCnpjChange={v => upd('legalRepCpf', v)}
          onNameChange={v => upd('legalRepName', v)}
          onFound={d => upd('legalRepName', d.fullName || '')}
          labelCls={labelCls} inputCls={inputCls} tipo="pessoa" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <F label="Função / Cargo" field="legalRepRole" placeholder="Sócio-Administrador" />
        </div>
      </div>

      {/* Auditor */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest border-l-4 border-orange-500 pl-3">Auditor Independente (se aplicável)</div>
        <PersonLookupField
          label="Auditor"
          cpfCnpj={config.auditorCpf || ''} initialFound={!!config.auditorCpf}
          name={config.auditorName || ''}
          onCpfCnpjChange={v => upd('auditorCpf', v)}
          onNameChange={v => upd('auditorName', v)}
          onFound={d => { upd('auditorName', d.fullName || ''); upd('auditorCrc', d.crcNumber || ''); }}
          labelCls={labelCls} inputCls={inputCls} tipo="pessoa" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <F label="CRC" field="auditorCrc" />
          <F label="Função" field="auditorRole" placeholder="Auditor" />
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar Configuração Contábil'}
        </button>
      </div>
    </div>
  );
};
