// frontend/src/pages/companies/ContabilTab.tsx
import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { PersonLookupField } from '../../components/PersonLookupField';
import { QsaVinculoGrid } from './QsaVinculoGrid';

interface Props { companyId: string; labelCls: string; inputCls: string; partners?: any[]; }

// ── AccountPicker simples (mesmo padrao usado em FolhaPage.tsx) ─────────────
function AccountPicker({ label, value, onChange, accounts }: { label:string; value:string; onChange:(id:string)=>void; accounts:any[] }) {
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const safe = Array.isArray(accounts) ? accounts : [];
  const selected = safe.find(a => a.id === value);
  const display = selected ? (selected.reducedCode ?? selected.code) + ' — ' + selected.name : '';
  const qNorm = q.replace(/\./g, '');
  const filtered = qNorm.length >= 1
    ? safe.filter(a => a.code.includes(qNorm) || (a.reducedCode??'').replace(/\./g,'').includes(qNorm) || a.name.toLowerCase().includes(q.toLowerCase())).slice(0, 10)
    : [];
  return (
    <div style={{position:'relative',marginBottom:10}}>
      <label style={{fontSize:10,textTransform:'uppercase' as const,color:'#6B7280',display:'block',marginBottom:3}}>{label}</label>
      <input style={{height:34,border:'0.5px solid #E5E7EB',borderRadius:6,padding:'0 9px',fontSize:13,width:'100%',boxSizing:'border-box' as const}}
        value={open ? q : display} placeholder="Codigo ou nome..."
        onFocus={()=>{setOpen(true);setQ('');}}
        onBlur={()=>setTimeout(()=>setOpen(false),200)}
        onChange={e=>setQ(e.target.value)} />
      {value && !open && <button onClick={()=>onChange('')} style={{position:'absolute',right:6,top:24,background:'none',border:'none',cursor:'pointer',color:'#9CA3AF',fontSize:13}}>×</button>}
      {open && filtered.length > 0 && (
        <div style={{position:'absolute',zIndex:999,background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:6,width:'100%',maxHeight:180,overflowY:'auto' as const,boxShadow:'0 4px 12px rgba(0,0,0,.08)'}}>
          {filtered.map(a=>(
            <div key={a.id} onMouseDown={()=>{onChange(a.id);setOpen(false);setQ('');}}
              style={{padding:'6px 10px',fontSize:12,cursor:'pointer',borderBottom:'0.5px solid #F5F5F5'}}>
              <span style={{fontWeight:500,color:'#1D4ED8'}}>{a.reducedCode??a.code}</span>
              <span style={{color:'#6B7280',marginLeft:8}}>{a.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const ContabilTab: React.FC<Props> = ({ companyId, labelCls, inputCls, partners }) => {
  const [config, setConfig] = useState<any>({});
  const [accounts, setAccounts] = useState<any[]>([]);
  const [searchParams] = useSearchParams();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get('/accounting/config', { headers: { 'x-company-id': companyId } })
    .then(({ data }) => {
      const base = data || {};
      const cnpjParam = searchParams.get('escritorioCnpj');
      if (cnpjParam && !base.escritorioCnpj) base.escritorioCnpj = cnpjParam;
      setConfig(base);
    })
  }, [companyId]);
  useEffect(() => {
    api.get('/chart-of-accounts/tree', { headers: { 'x-company-id': companyId } }).then(r => {
      const flat: any[] = [];
      function walk(nodes: any[]) { for (const n of (nodes||[])) { if (n.isAnalytic===true) flat.push(n); if (n.children) walk(n.children); } }
      walk(Array.isArray(r.data) ? r.data : (r.data?.items ?? []));
      setAccounts(flat);
    }).catch(() => {});
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
    try { await api.put('/accounting/config', config, { headers: { 'x-company-id': companyId } }); toast.success('Configuracao contabil salva!'); }
    catch { toast.error('Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">

      {/* Escritorio Contabil */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
      {partners && partners.length > 0 && (
        <QsaVinculoGrid companyId={companyId} partners={partners} />
      )}

        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest border-l-4 border-green-500 pl-3">Escritório / Organização Contábil</div>
        <PersonLookupField
          label="Escritório Contábil"
          cpfCnpj={config.escritorioCnpj || ''}
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
          cpfCnpj={config.accountantCpf || ''}
          name={config.accountantName || ''}
          onCpfCnpjChange={v => upd('accountantCpf', v)}
          onNameChange={v => upd('accountantName', v)}
          onFound={d => { upd('accountantName', d.fullName || ''); upd('accountantCrc', d.crcNumber || ''); upd('accountantCrcState', d.crcState || ''); }}
          labelCls={labelCls} inputCls={inputCls} tipo="pessoa" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <F label="CRC" field="accountantCrc" placeholder="1SP999999/O-1" />
          <F label="UF CRC" field="accountantCrcState" placeholder="SP" />
          <F label="Função" field="accountantRole" placeholder="Contador" />
          <div>
            <label className={labelCls}>E-mail</label>
            <input value={config.accountantEmail || ''} onChange={e => setConfig((p: any) => ({...p, accountantEmail: e.target.value}))}
              placeholder="contador@email.com" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Telefone</label>
            <input value={config.accountantPhone || ''} onChange={e => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 11);
              const fmt = v.length > 10
                ? v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
                : v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
              setConfig((p: any) => ({...p, accountantPhone: fmt}));
            }} placeholder="(41) 99999-9999" className={inputCls} />
          </div>
        </div>
      </div>

      {/* Encerramento de Exercicio */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest border-l-4 border-emerald-500 pl-3">Encerramento de Exercício</div>
        <p className="text-xs text-gray-500">Configure as contas usadas para zerar Receitas/Despesas no encerramento anual. Todas são necessárias para o encerramento ser gerado.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AccountPicker label="Apuração do Resultado (ARE)" value={config.encerramentoContaApuracaoResultadoId||''} onChange={v=>upd('encerramentoContaApuracaoResultadoId', v)} accounts={accounts} />
          <AccountPicker label="Lucro do Exercício" value={config.encerramentoContaLucroExercicioId||''} onChange={v=>upd('encerramentoContaLucroExercicioId', v)} accounts={accounts} />
          <AccountPicker label="Prejuízo do Exercício" value={config.encerramentoContaPrejuizoExercicioId||''} onChange={v=>upd('encerramentoContaPrejuizoExercicioId', v)} accounts={accounts} />
        </div>
      </div>

      {/* Representante Legal */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest border-l-4 border-purple-500 pl-3">Representante Legal</div>
        <PersonLookupField
          label="Representante Legal"
          cpfCnpj={config.legalRepCpf || ''}
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
          cpfCnpj={config.auditorCpf || ''}
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
