
// frontend/src/pages/documentos/RedigirProcuracaoModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiSearch, FiPlus, FiChevronRight, FiChevronLeft, FiSave, FiPrinter, FiFileText, FiCheck, FiTrash2 } from 'react-icons/fi';
import api from '../../services/api';

const PODERES = [
  { id: 'judicial',      label: 'Representacao judicial (assinar peticoes, interpor recursos, substabelecer)' },
  { id: 'extrajudicial', label: 'Representacao extrajudicial perante terceiros' },
  { id: 'contratos',     label: 'Assinar contratos, escrituras e instrumentos particulares' },
  { id: 'bancario',      label: 'Movimentar contas bancarias, emitir cheques e realizar transferencias' },
  { id: 'quitacao',      label: 'Receber valores, dar quitacao e firmar recibos' },
  { id: 'orgaos',        label: 'Representar perante orgaos publicos (RFB, JUCESP, cartorios, prefeituras)' },
  { id: 'trabalhista',   label: 'Assinar documentos trabalhistas e previdenciarios' },
  { id: 'negocial',      label: 'Praticar todos os atos necessarios ao fiel cumprimento deste mandato (ad negotia)' },
];

function fmtDoc(v: string) {
  const d = (v ?? '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return v;
}

function qualif(p: any): string {
  if (p._tipo === 'PJ') {
    const parts = [p.fullName, p.cpf ? `CNPJ ${fmtDoc(p.cpf)}` : ''].filter(Boolean);
    if (p.street) parts.push(`com sede ${[p.street, p.number ? 'no '+p.number : '', p.complement, p.neighborhood, p.city ? p.city+'/'+(p.state??'') : ''].filter(Boolean).join(', ')}`);
    return parts.join(', ');
  }
  const ms: Record<string,string> = { SOLTEIRO:'solteiro(a)', CASADO:'casado(a)', DIVORCIADO:'divorciado(a)', VIUVO:'viuvo(a)', UNIAO_ESTAVEL:'em uniao estavel', SEPARADO:'separado(a)' };
  const rg: Record<string,string> = { COMUNHAO_PARCIAL:'comunhao parcial de bens', COMUNHAO_UNIVERSAL:'comunhao universal de bens', SEPARACAO_TOTAL:'separacao total de bens', PARTICIPACAO_FINAL:'participacao final nos aquestos' };
  const parts: string[] = [p.fullName];
  if (p.nationality) parts.push(p.nationality);
  if (p.maritalStatus) {
    let civil = ms[p.maritalStatus] ?? p.maritalStatus.toLowerCase();
    if ((p.maritalStatus==='CASADO'||p.maritalStatus==='UNIAO_ESTAVEL') && p.spouseName)
      civil += `, ${rg[p.matrimonialRegime]??''}, com ${p.spouseName}`;
    parts.push(civil);
  }
  if (p.occupation) parts.push(p.occupation);
  const docs = [p.rgNumber?`RG ${p.rgNumber}${p.rgIssuer?'/'+p.rgIssuer:''}`:''
               ,p.cpf?`CPF ${fmtDoc(p.cpf)}`:''].filter(Boolean).join(', ');
  if (docs) parts.push(`portador(a) de ${docs}`);
  if (p.street) parts.push(`residente e domiciliado(a) ${[p.street, p.number?'no '+p.number:'', p.complement, p.neighborhood, p.city?p.city+'/'+(p.state??''):''].filter(Boolean).join(', ')}`);
  return parts.join(', ');
}

function buildHTML(outorgantes: any[], outorgados: any[], pods: string[], livre: string, finalidade: string, prazo: string, local: string, data: string): string {
  const lista = [...PODERES.filter(p=>pods.includes(p.id)).map(p=>p.label), ...(livre?[livre]:[])];
  const dataFmt = data ? new Date(data+'T12:00:00').toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'}) : '___/___/______';
  const blocoPartes = (label: string, partes: any[]) =>
    partes.map((p, i) => `<p><strong>${label}${partes.length>1?' '+(i+1):''}:</strong> ${qualif(p)}.</p>`).join('\n');
  const assinaturas = outorgantes.map(p => `
    <div class="sig-item">
      <div class="ln"></div>
      <p><strong>${p.fullName}</strong></p>
      <p>${p._tipo==='PJ'?'CNPJ':'CPF'}: ${fmtDoc(p.cpf)}</p>
      <p>Outorgante</p>
    </div>`).join('');
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<style>
body{font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:1.8;max-width:700px;margin:40px auto;padding:0 40px}
h1{text-align:center;font-size:14pt;text-transform:uppercase;letter-spacing:3px;margin-bottom:40px}
p{text-align:justify;margin:0 0 14px;text-indent:40px}
ul{margin:16px 0 16px 40px}ul li{margin-bottom:8px}
.sig-wrap{margin-top:60px;display:flex;flex-wrap:wrap;justify-content:center;gap:40px}
.sig-item{text-align:center;min-width:260px}
.ln{border-top:1px solid #000;width:260px;margin:0 auto 4px}
.sig-item p{text-indent:0;margin:0}
.ld{text-align:right;margin-top:40px;margin-bottom:40px}
</style></head><body>
<h1>Procuracao</h1>
${blocoPartes('OUTORGANTE', outorgantes)}
${blocoPartes('OUTORGADO', outorgados)}
<p>Pelo presente instrumento particular de procuracao, ${outorgantes.length>1?'os OUTORGANTES nomeiam e constituem seus bastantes procuradores os OUTORGADOS':'o(a) OUTORGANTE nomeia e constitui seu bastante procurador o(a) OUTORGADO'} acima qualificado(a/s), a quem confere${outorgantes.length>1?'m':''} poderes para:</p>
<ul>${lista.map(l=>`<li>${l};</li>`).join('')}</ul>
${finalidade?`<p>Finalidade: ${finalidade}.</p>`:''}
${prazo?`<p>O presente mandato vigorara pelo prazo de <strong>${prazo}</strong>.</p>`:'<p>O presente mandato e por prazo <strong>indeterminado</strong>.</p>'}
<p>Por ser verdade, firmam o presente instrumento.</p>
<p class="ld">${local||'_____________'}, ${dataFmt}.</p>
<div class="sig-wrap">${assinaturas}</div>
</body></html>`;
}

interface Parte { id: string; fullName: string; cpf: string; _tipo: 'PF'|'PJ'; [k: string]: any; }
interface Props { onClose: () => void; onSuccess: () => void; }

export const RedigirProcuracaoModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [step, setStep]               = useState<1|2|3|4>(1);
  const [outorgantes, setOutorgantes] = useState<Parte[]>([]);
  const [outorgados,  setOutorgados]  = useState<Parte[]>([]);
  const [pods,  setPods]              = useState<string[]>([]);
  const [livre, setLivre]             = useState('');
  const [finalidade, setFinalidade]   = useState('');
  const [prazo, setPrazo]             = useState('');
  const [local, setLocal]             = useState('Sao Paulo');
  const [data,  setData]              = useState(new Date().toISOString().split('T')[0]);
  const [html,  setHtml]              = useState('');
  const [saving, setSaving]           = useState(false);
  const iframeRef                     = useRef<HTMLIFrameElement>(null);
  const [busca,    setBusca]          = useState('');
  const [results,  setResults]        = useState<any[]>([]);
  const [buscando, setBuscando]       = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (busca.length < 2) { setResults([]); return; }
      setBuscando(true);
      try {
        const co = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
        const [rp, rc] = await Promise.allSettled([
          api.get(`/persons?search=${encodeURIComponent(busca)}&companyId=${co.id}`),
          api.get(`/companies?search=${encodeURIComponent(busca)}`),
        ]);
        const pf = rp.status==='fulfilled' ? (rp.value.data?.data ?? rp.value.data ?? []).map((p: any) => ({ ...p, _tipo: 'PF' })) : [];
        const pj = rc.status==='fulfilled' ? (rc.value.data?.data ?? rc.value.data ?? []).map((e: any) => ({ ...e, _tipo: 'PJ', fullName: e.legalName, cpf: e.taxId })) : [];
        setResults([...pf, ...pj]);
      } catch { setResults([]); }
      setBuscando(false);
    }, 300);
    return () => clearTimeout(t);
  }, [busca]);

  const addParte = (p: any, role: 'outorgante'|'outorgado') => {
    const parte: Parte = { ...p, _tipo: p._tipo ?? 'PF' };
    if (role === 'outorgante') {
      if (!outorgantes.find(x => x.id === p.id)) setOutorgantes(prev => [...prev, parte]);
    } else {
      if (!outorgados.find(x => x.id === p.id)) setOutorgados(prev => [...prev, parte]);
    }
    setBusca(''); setResults([]);
  };

  const removeParte = (id: string, role: 'outorgante'|'outorgado') => {
    if (role==='outorgante') setOutorgantes(prev => prev.filter(x => x.id !== id));
    else setOutorgados(prev => prev.filter(x => x.id !== id));
  };

  const avancar = () => {
    if (step===3) { setHtml(buildHTML(outorgantes, outorgados, pods, livre, finalidade, prazo, local, data)); setStep(4); }
    else setStep(s => (s+1) as any);
  };

  const salvar = async (status: 'RASCUNHO'|'EM_REVISAO') => {
    setSaving(true);
    try {
      const co = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
      const nomes = `${outorgantes.map(p=>p.fullName).join(' e ')} outorga${outorgantes.length>1?'m':''} a ${outorgados.map(p=>p.fullName).join(' e ')}`;
      await api.post('/documents', { companyId: co.id, type: 'PROCURACAO',
        title: `Procuracao - ${nomes}`,
        description: finalidade||undefined, content: html, status, visibility: 'RESERVADO', date: data });
      onSuccess(); onClose();
    } catch { alert('Erro ao salvar.'); }
    setSaving(false);
  };

  const canNext = () => step===1?outorgantes.length>0:step===2?outorgados.length>0:step===3?(pods.length>0||livre.trim().length>0):true;
  const STEPS = ['Outorgante(s)','Outorgado(s)','Poderes & Dados','Revisao'];

  const ParteSearch = ({ role }: { role: 'outorgante'|'outorgado' }) => {
    const lista = role==='outorgante' ? outorgantes : outorgados;
    return (
      <div className="space-y-4">
        {lista.length > 0 && (
          <div className="space-y-2">
            {lista.map(p => (
              <div key={p.id} className="flex items-center justify-between border border-green-200 bg-green-50 rounded-xl px-4 py-3">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{p.fullName}</p>
                  <p className="text-xs text-gray-400">{p._tipo==='PJ'?'CNPJ':'CPF'}: {fmtDoc(p.cpf)}{p.city ? ` - ${p.city}` : ''}</p>
                </div>
                <button onClick={() => removeParte(p.id, role)} className="p-1 text-gray-300 hover:text-red-500">
                  <FiTrash2 size={14}/>
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Adicionar por nome, CPF ou CNPJ</label>
          <div className="relative">
            <FiSearch size={14} className="absolute left-3 top-3 text-gray-400"/>
            <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar pessoa fisica ou juridica..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"/>
          </div>
          {buscando && <p className="text-xs text-gray-400">Buscando...</p>}
          {results.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
              {results.map((p: any) => (
                <button key={p.id} onClick={() => addParte(p, role)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-0 flex items-center gap-3">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p._tipo==='PJ'?'bg-purple-100 text-purple-600':'bg-blue-100 text-blue-600'}`}>{p._tipo}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.fullName}</p>
                    <p className="text-xs text-gray-400">{p._tipo==='PJ'?'CNPJ':'CPF'}: {fmtDoc(p.cpf)}{p.city?` - ${p.city}`:''}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {busca.length>=2 && !buscando && results.length===0 && (
            <div className="border border-dashed border-gray-200 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-400 mb-2">Nenhum resultado encontrado</p>
              <button className="text-sm text-blue-600 hover:underline flex items-center gap-1 mx-auto"><FiPlus size={13}/> Cadastrar nova pessoa</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col" style={{maxWidth:step===4?'900px':'580px',maxHeight:'90vh'}}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Redigir Procuracao</h2>
            <p className="text-xs text-gray-400 mt-0.5">Etapa {step} de 4 - {STEPS[step-1]}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><FiX size={18}/></button>
        </div>
        <div className="px-6 py-3 border-b border-gray-50 flex-shrink-0 flex items-center gap-1">
          {STEPS.map((s,i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${i+1===step?'bg-gray-900 text-white':i+1<step?'bg-green-100 text-green-700':'bg-gray-100 text-gray-400'}`}>
                {i+1<step?<FiCheck size={10}/>:<span>{i+1} </span>}{s}
              </div>
              {i<3&&<div className="flex-1 h-px bg-gray-100"/>}
            </React.Fragment>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step===1&&<div className="space-y-4"><p className="text-sm text-gray-500">Pessoa(s) que <strong>concedem</strong> os poderes. Pode adicionar mais de uma.</p><ParteSearch role="outorgante"/></div>}
          {step===2&&<div className="space-y-4"><p className="text-sm text-gray-500">Pessoa(s) que <strong>receberao</strong> os poderes. Pode adicionar mais de uma.</p><ParteSearch role="outorgado"/></div>}
          {step===3&&(
            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Poderes conferidos</label>
                <div className="space-y-2">
                  {PODERES.map(p=>(
                    <label key={p.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${pods.includes(p.id)?'border-blue-300 bg-blue-50':'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={pods.includes(p.id)} onChange={()=>setPods(prev=>prev.includes(p.id)?prev.filter(x=>x!==p.id):[...prev,p.id])} className="mt-0.5"/>
                      <span className="text-sm text-gray-700">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Poderes adicionais</label>
                <textarea value={livre} onChange={e=>setLivre(e.target.value)} rows={3}
                  placeholder="Poderes especificos nao listados acima..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 resize-none"/>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Finalidade / objeto</label>
                <input value={finalidade} onChange={e=>setFinalidade(e.target.value)}
                  placeholder="Ex: Representar no processo no 1234/2026..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Prazo (branco = indeterminado)</label>
                  <input value={prazo} onChange={e=>setPrazo(e.target.value)} placeholder="Ex: 1 (um) ano"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"/>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Local</label>
                  <input value={local} onChange={e=>setLocal(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"/>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Data</label>
                <input type="date" value={data} onChange={e=>setData(e.target.value)} max="9999-12-31"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"/>
              </div>
            </div>
          )}
          {step===4&&(
            <div className="space-y-3">
              <p className="text-xs text-gray-400">Revise o documento. Use Imprimir para gerar PDF via impressora do sistema.</p>
              <iframe ref={iframeRef} srcDoc={html} className="w-full rounded-lg border border-gray-200" style={{height:'520px'}} title="Preview"/>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-gray-50 rounded-b-2xl">
          <button onClick={()=>step>1?setStep(s=>(s-1) as any):onClose()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg bg-white hover:bg-gray-50">
            <FiChevronLeft size={14}/>{step===1?'Cancelar':'Voltar'}
          </button>
          <div className="flex items-center gap-2">
            {step===4&&<>
              <button onClick={()=>iframeRef.current?.contentWindow?.print()} className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50"><FiPrinter size={14}/> Imprimir</button>
              <button onClick={()=>salvar('RASCUNHO')} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50"><FiSave size={14}/> Salvar Rascunho</button>
              <button onClick={()=>salvar('EM_REVISAO')} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700"><FiFileText size={14}/> Finalizar</button>
            </>}
            {step<4&&<button onClick={avancar} disabled={!canNext()} className="flex items-center gap-1.5 px-5 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40">Avancar <FiChevronRight size={14}/></button>}
          </div>
        </div>
      </div>
    </div>
  );
};
