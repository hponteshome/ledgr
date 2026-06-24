
// frontend/src/pages/documentos/RedigirProcuracaoModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiSearch, FiPlus, FiChevronRight, FiChevronLeft, FiSave, FiPrinter, FiFileText, FiCheck } from 'react-icons/fi';
import api from '../../services/api';

const PODERES = [
  { id: 'judicial', label: 'Representacao judicial (assinar peticoes, interpor recursos, substabelecer)' },
  { id: 'extrajudicial', label: 'Representacao extrajudicial perante terceiros' },
  { id: 'contratos', label: 'Assinar contratos, escrituras e instrumentos particulares' },
  { id: 'bancario', label: 'Movimentar contas bancarias, emitir cheques e realizar transferencias' },
  { id: 'quitacao', label: 'Receber valores, dar quitacao e firmar recibos' },
  { id: 'orgaos', label: 'Representar perante orgaos publicos (RFB, JUCESP, cartorios, prefeituras)' },
  { id: 'trabalhista', label: 'Assinar documentos trabalhistas e previdenciarios' },
  { id: 'negocial', label: 'Praticar todos os atos necessarios ao fiel cumprimento deste mandato (ad negotia)' },
];

function fmtCpf(v: string) {
  return (v ?? '').replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function qualif(p: any): string {
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
               ,p.cpf?`CPF ${fmtCpf(p.cpf)}`:''].filter(Boolean).join(', ');
  if (docs) parts.push(`portador(a) de ${docs}`);
  if (p.street) parts.push(`residente e domiciliado(a) ${[p.street,p.number?'no '+p.number:'',p.complement,p.neighborhood,p.city?p.city+'/'+(p.state??''):''].filter(Boolean).join(', ')}`);
  return parts.join(', ');
}

function buildHTML(og: any, od: any, pods: string[], livre: string, finalidade: string, prazo: string, local: string, data: string): string {
  const lista = [...PODERES.filter(p=>pods.includes(p.id)).map(p=>p.label), ...(livre?[livre]:[])];
  const dataFmt = data ? new Date(data+'T12:00:00').toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'}) : '___/___/______';
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<style>
body{font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:1.8;max-width:700px;margin:40px auto;padding:0 40px}
h1{text-align:center;font-size:14pt;text-transform:uppercase;letter-spacing:3px;margin-bottom:40px}
p{text-align:justify;margin:0 0 16px;text-indent:40px}
ul{margin:16px 0 16px 40px}ul li{margin-bottom:8px}
.sig{margin-top:60px;text-align:center}.sig .ln{border-top:1px solid #000;width:320px;margin:0 auto 4px}.sig p{text-indent:0;margin:0}
.ld{text-align:right;margin-top:40px;margin-bottom:40px}
</style></head><body>
<h1>Procuracao</h1>
<p><strong>OUTORGANTE:</strong> ${qualif(og)}.</p>
<p><strong>OUTORGADO:</strong> ${qualif(od)}.</p>
<p>Pelo presente instrumento particular de procuracao, o(a) <strong>OUTORGANTE</strong> nomeia e constitui seu bastante procurador o(a) <strong>OUTORGADO</strong> acima qualificado(a), a quem confere poderes para:</p>
<ul>${lista.map(l=>`<li>${l};</li>`).join('')}</ul>
${finalidade?`<p>Finalidade: ${finalidade}.</p>`:''}
${prazo?`<p>O presente mandato vigorara pelo prazo de <strong>${prazo}</strong>.</p>`:'<p>O presente mandato e por prazo <strong>indeterminado</strong>.</p>'}
<p>Por ser verdade, firmam o presente instrumento.</p>
<p class="ld">${local||'_____________'}, ${dataFmt}.</p>
<div class="sig"><div class="ln"></div><p><strong>${og.fullName}</strong></p><p>CPF: ${fmtCpf(og.cpf)}</p><p>Outorgante</p></div>
</body></html>`;
}

interface Props { onClose: () => void; onSuccess: () => void; }

export const RedigirProcuracaoModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [step, setStep]             = useState<1|2|3|4>(1);
  const [outorgante, setOutorgante] = useState<any>(null);
  const [outorgado,  setOutorgado]  = useState<any>(null);
  const [pods,  setPods]            = useState<string[]>([]);
  const [livre, setLivre]           = useState('');
  const [finalidade, setFinalidade] = useState('');
  const [prazo, setPrazo]           = useState('');
  const [local, setLocal]           = useState('Sao Paulo');
  const [data,  setData]            = useState(new Date().toISOString().split('T')[0]);
  const [html,  setHtml]            = useState('');
  const [saving, setSaving]         = useState(false);
  const iframeRef                   = useRef<HTMLIFrameElement>(null);
  const [busca,    setBusca]        = useState('');
  const [pessoas,  setPessoas]      = useState<any[]>([]);
  const [buscando, setBuscando]     = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (busca.length < 2) { setPessoas([]); return; }
      setBuscando(true);
      try {
        const co = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
        const r = await api.get(`/persons?search=${encodeURIComponent(busca)}&companyId=${co.id}`);
        setPessoas(r.data?.data ?? r.data ?? []);
      } catch { setPessoas([]); }
      setBuscando(false);
    }, 300);
    return () => clearTimeout(t);
  }, [busca]);

  const sel = (p: any, role: 'outorgante'|'outorgado') => {
    role==='outorgante' ? setOutorgante(p) : setOutorgado(p);
    setBusca(''); setPessoas([]);
  };

  const avancar = () => {
    if (step===3) { setHtml(buildHTML(outorgante,outorgado,pods,livre,finalidade,prazo,local,data)); setStep(4); }
    else setStep(s=>(s+1) as any);
  };

  const salvar = async (status: 'RASCUNHO'|'EM_REVISAO') => {
    setSaving(true);
    try {
      const co = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
      await api.post('/documents', { companyId: co.id, type: 'PROCURACAO',
        title: `Procuracao - ${outorgante.fullName} outorga a ${outorgado.fullName}`,
        description: finalidade||undefined, content: html, status, visibility: 'RESERVADO', date: data });
      onSuccess(); onClose();
    } catch { alert('Erro ao salvar.'); }
    setSaving(false);
  };

  const canNext = () => step===1?!!outorgante:step===2?!!outorgado:step===3?(pods.length>0||livre.trim().length>0):true;
  const STEPS = ['Outorgante','Outorgado','Poderes & Dados','Revisao'];

  const Search = ({ role }: { role: 'outorgante'|'outorgado' }) => {
    const picked = role==='outorgante' ? outorgante : outorgado;
    return picked ? (
      <div className="border border-green-200 bg-green-50 rounded-xl p-4 flex justify-between items-start">
        <div>
          <p className="font-semibold text-gray-900">{picked.fullName}</p>
          <p className="text-sm text-gray-500">CPF: {fmtCpf(picked.cpf)}</p>
          {picked.occupation && <p className="text-sm text-gray-500">{picked.occupation}</p>}
          {picked.city && <p className="text-sm text-gray-400">{picked.city}/{picked.state}</p>}
        </div>
        <button onClick={()=>role==='outorgante'?setOutorgante(null):setOutorgado(null)} className="text-xs text-gray-400 hover:text-red-500 underline">trocar</button>
      </div>
    ) : (
      <div className="space-y-2">
        <div className="relative">
          <FiSearch size={14} className="absolute left-3 top-3 text-gray-400"/>
          <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por nome ou CPF..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"/>
        </div>
        {buscando && <p className="text-xs text-gray-400">Buscando...</p>}
        {pessoas.length>0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
            {pessoas.map((p:any)=>(
              <button key={p.id} onClick={()=>sel(p,role)} className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-0">
                <p className="text-sm font-medium text-gray-900">{p.fullName}</p>
                <p className="text-xs text-gray-400">CPF: {fmtCpf(p.cpf)}{p.city?` - ${p.city}`:''}</p>
              </button>
            ))}
          </div>
        )}
        {busca.length>=2 && !buscando && pessoas.length===0 && (
          <div className="border border-dashed border-gray-200 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-400 mb-2">Nenhuma pessoa encontrada</p>
            <button className="text-sm text-blue-600 hover:underline flex items-center gap-1 mx-auto"><FiPlus size={13}/> Cadastrar nova pessoa</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col" style={{maxWidth:step===4?'900px':'560px',maxHeight:'90vh'}}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Redigir Procuracao</h2>
            <p className="text-xs text-gray-400 mt-0.5">Etapa {step} de 4 - {STEPS[step-1]}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><FiX size={18}/></button>
        </div>
        <div className="px-6 py-3 border-b border-gray-50 flex-shrink-0 flex items-center gap-1">
          {STEPS.map((s,i)=>(
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${i+1===step?'bg-gray-900 text-white':i+1<step?'bg-green-100 text-green-700':'bg-gray-100 text-gray-400'}`}>
                {i+1<step?<FiCheck size={10}/>:<span>{i+1} </span>}{s}
              </div>
              {i<3&&<div className="flex-1 h-px bg-gray-100"/>}
            </React.Fragment>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step===1&&<div className="space-y-4"><p className="text-sm text-gray-500">Pessoa que <strong>concede</strong> os poderes.</p><Search role="outorgante"/></div>}
          {step===2&&<div className="space-y-4"><p className="text-sm text-gray-500">Pessoa que ira <strong>receber</strong> os poderes.</p><Search role="outorgado"/></div>}
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
                <textarea value={livre} onChange={e=>setLivre(e.target.value)} rows={3} placeholder="Poderes especificos nao listados acima..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 resize-none"/>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Finalidade / objeto</label>
                <input value={finalidade} onChange={e=>setFinalidade(e.target.value)} placeholder="Ex: Representar no processo no 1234/2026..."
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
              <p className="text-xs text-gray-400">Revise o documento. Use Imprimir para PDF via impressora do sistema.</p>
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
