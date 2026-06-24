
// frontend/src/pages/documentos/RedigirProcuracaoModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiSearch, FiPlus, FiChevronRight, FiChevronLeft, FiSave, FiPrinter, FiFileText, FiCheck, FiTrash2, FiUserPlus } from 'react-icons/fi';
import api from '../../services/api';

const TEXTO_PODERES_SUGERIDO = `representar o(a) outorgante junto aos orgaos publicos em geral, em especial os orgaos fazendarios, a Receita Federal do Brasil e suas Secretarias e Delegacias, a Secretaria da Receita Previdenciaria, ao Instituto Nacional de Seguro Social, ao Fundo de Garantia por Tempo de Servico - FGTS, as prefeituras municipais, as Secretarias de Fazenda Estaduais e Municipais; Postos Fiscais do Estado de Sao Paulo; Juntas Comerciais; Cartorios de Titulos e Documentos; Cartorios de Registro de Imoveis; Banco do Brasil; Banco Itau, e demais instituicoes financeiras e bancarias, e ai abrir, encerrar e movimentar contas correntes, investimentos e aplicacoes, atraves de cartao magnetico, taloes de cheques, token, via Internet ou qualquer outro meio fisico ou digital legalmente admitido pela instituicao; as empresas privadas na contratacao e compra de produtos e servicos, contratacao de emprestimos e financiamentos, podendo para tanto dito procurador, negociar e ajustar precos e contratos, assinar escrituras publicas e particulares, conferindo-lhes, ainda, poderes especiais para notificar, confessar, desistir, transigir, firmar compromissos ou acordos, receber e dar quitacao, promover acordos e composicoes amigaveis e judiciais, assinar compromissos, assinar requerimentos, formularios e cartoes de assinaturas; fazer e prestar declaracoes, informacoes e justificativas; apresentar e retirar documentos, participar de reunioes e assembleias, e praticar, finalmente, todos os atos necessarios ao fiel cumprimento deste mandato.`;

function fmtDoc(v: string) {
  const d = (v ?? '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return v;
}

function qualif(p: any): string {
  if (p._tipo === 'PJ') {
    const parts = [p.fullName, p.cpf ? `CNPJ ${fmtDoc(p.cpf)}` : ''].filter(Boolean);
    if (p.street) parts.push(`com sede ${[p.street,p.number?'no '+p.number:'',p.complement,p.neighborhood,p.city?p.city+'/'+(p.state??''):''].filter(Boolean).join(', ')}`);
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
  const docs = [p.rgNumber?`RG ${p.rgNumber}${p.rgIssuer?'/'+p.rgIssuer:''}`:'' ,p.cpf?`CPF ${fmtDoc(p.cpf)}`:''].filter(Boolean).join(', ');
  if (docs) parts.push(`portador(a) de ${docs}`);
  if (p.street) parts.push(`residente e domiciliado(a) ${[p.street,p.number?'no '+p.number:'',p.complement,p.neighborhood,p.city?p.city+'/'+(p.state??''):''].filter(Boolean).join(', ')}`);
  return parts.join(', ');
}

function buildHTML(outorgantes: any[], outorgados: any[], textoPoderes: string, finalidade: string, prazo: string, local: string, data: string): string {
  const dataFmt = data ? new Date(data+'T12:00:00').toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'}) : '___/___/______';
  const blocoPartes = (label: string, partes: any[]) =>
    partes.map((p,i) => `<p><strong>${label}${partes.length>1?' '+(i+1):''}:</strong> ${qualif(p)}.</p>`).join('\n');
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
.sig-wrap{margin-top:60px;display:flex;flex-wrap:wrap;justify-content:center;gap:40px}
.sig-item{text-align:center;min-width:260px}.ln{border-top:1px solid #000;width:260px;margin:0 auto 4px}
.sig-item p{text-indent:0;margin:0}.ld{text-align:right;margin-top:40px;margin-bottom:40px}
</style></head><body>
<h1>Procuracao</h1>
${blocoPartes('OUTORGANTE',outorgantes)}
${blocoPartes('OUTORGADO',outorgados)}
<p>Pelo presente instrumento particular de procuracao, ${outorgantes.length>1?'os OUTORGANTES nomeiam e constituem seus bastantes procuradores os OUTORGADOS':'o(a) OUTORGANTE nomeia e constitui seu bastante procurador o(a) OUTORGADO'} acima qualificado(a/s), a quem confere${outorgantes.length>1?'m':''} os seguintes poderes:</p>
<p style="text-indent:40px">${textoPoderes.replace(/\n/g,'</p><p style="text-indent:40px">')}</p>
${finalidade?`<p>Finalidade: ${finalidade}.</p>`:''}
${prazo?`<p>O presente mandato vigorara pelo prazo de <strong>${prazo}</strong>.</p>`:'<p>O presente mandato e por prazo <strong>indeterminado</strong>.</p>'}
<p>Por ser verdade, firmam o presente instrumento.</p>
<p class="ld">${local||'_____________'}, ${dataFmt}.</p>
<div class="sig-wrap">${assinaturas}</div>
</body></html>`;
}

interface Parte { id: string; fullName: string; cpf: string; _tipo: 'PF'|'PJ'; [k: string]: any; }

const ParteSearch: React.FC<{
  role: 'outorgante'|'outorgado';
  lista: Parte[];
  onAdd: (p: any, role: 'outorgante'|'outorgado') => void;
  onRemove: (id: string, role: 'outorgante'|'outorgado') => void;
}> = ({ role, lista, onAdd, onRemove }) => {
  const [tipo,        setTipo]       = useState<'PF'|'PJ'>('PF');
  const [busca,       setBusca]      = useState('');
  const [results,     setResults]    = useState<any[]>([]);
  const [buscando,    setBuscando]   = useState(false);
  const [adicionando, setAdicionando] = useState(lista.length === 0);

  // Ao adicionar primeiro item, oculta formulario automaticamente
  const prevLen = React.useRef(lista.length);
  useEffect(() => {
    if (lista.length > prevLen.current) { setAdicionando(false); setBusca(''); setResults([]); }
    prevLen.current = lista.length;
  }, [lista.length]);

  useEffect(() => { setBusca(''); setResults([]); }, [tipo]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (busca.length < 2) { setResults([]); return; }
      setBuscando(true);
      try {
        const co = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
        if (tipo === 'PF') {
          const r = await api.get(`/persons?search=${encodeURIComponent(busca)}&companyId=${co.id}`);
          setResults((r.data?.data ?? r.data ?? []).map((p: any) => ({ ...p, _tipo: 'PF' })));
        } else {
          const r = await api.get(`/companies?search=${encodeURIComponent(busca)}`);
          setResults((r.data?.data ?? r.data ?? []).map((e: any) => ({ ...e, _tipo: 'PJ', fullName: e.legalName, cpf: e.taxId })));
        }
      } catch { setResults([]); }
      setBuscando(false);
    }, 300);
    return () => clearTimeout(t);
  }, [busca, tipo]);

  const add = (p: any) => { onAdd(p, role); };
  const label = role === 'outorgante' ? 'outorgante' : 'outorgado';

  return (
    <div className="space-y-3">
      {/* Lista de partes ja adicionadas */}
      {lista.length > 0 && (
        <div className="space-y-2">
          {lista.map(p => (
            <div key={p.id} className="flex items-center justify-between border border-green-200 bg-green-50 rounded-xl px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p._tipo==='PJ'?'bg-purple-100 text-purple-600':'bg-blue-100 text-blue-600'}`}>{p._tipo}</span>
                  <p className="font-semibold text-gray-900 text-sm">{p.fullName}</p>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{p._tipo==='PJ'?'CNPJ':'CPF'}: {fmtDoc(p.cpf)}{p.city?` - ${p.city}`:''}</p>
              </div>
              <button onClick={() => onRemove(p.id, role)} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50"><FiTrash2 size={14}/></button>
            </div>
          ))}
          {/* Botao adicionar outro */}
          {!adicionando && (
            <button onClick={() => setAdicionando(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
              <FiUserPlus size={14}/> Adicionar outro {label}
            </button>
          )}
        </div>
      )}

      {/* Formulario de busca — visivel quando adicionando */}
      {adicionando && (
        <div className="space-y-3 border border-gray-200 rounded-xl p-4 bg-gray-50">
          <div className="flex gap-3">
            {(['PF','PJ'] as const).map(t => (
              <button key={t} onClick={() => setTipo(t)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${tipo===t?t==='PF'?'border-blue-400 bg-blue-50 text-blue-700':'border-purple-400 bg-purple-50 text-purple-700':'border-gray-200 bg-white text-gray-400 hover:border-gray-300'}`}>
                <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${tipo===t?t==='PF'?'border-blue-500':'border-purple-500':'border-gray-300'}`}>
                  {tipo===t && <div className={`w-1.5 h-1.5 rounded-full ${t==='PF'?'bg-blue-500':'bg-purple-500'}`}/>}
                </div>
                {t==='PF'?'Pessoa Fisica':'Pessoa Juridica'}
              </button>
            ))}
            {lista.length > 0 && (
              <button onClick={() => { setAdicionando(false); setBusca(''); setResults([]); }}
                className="ml-auto text-xs text-gray-400 hover:text-gray-600 px-2">cancelar</button>
            )}
          </div>
          <div className="relative">
            <FiSearch size={14} className="absolute left-3 top-3 text-gray-400"/>
            <input value={busca} onChange={e=>setBusca(e.target.value)}
              placeholder={tipo==='PF'?'Buscar por nome ou CPF...':'Buscar por razao social ou CNPJ...'}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-gray-400" autoFocus/>
          </div>
          {buscando && <p className="text-xs text-gray-400">Buscando...</p>}
          {results.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto bg-white">
              {results.map((p: any) => (
                <button key={p.id} onClick={() => add(p)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-0 flex items-center gap-3">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${p._tipo==='PJ'?'bg-purple-100 text-purple-600':'bg-blue-100 text-blue-600'}`}>{p._tipo}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.fullName}</p>
                    <p className="text-xs text-gray-400">{p._tipo==='PJ'?'CNPJ':'CPF'}: {fmtDoc(p.cpf)}{p.city?` - ${p.city}`:''}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {busca.length>=2 && !buscando && results.length===0 && (
            <div className="border border-dashed border-gray-200 rounded-lg p-4 text-center bg-white">
              <p className="text-sm text-gray-400 mb-2">Nenhum resultado encontrado</p>
              <button className="text-sm text-blue-600 hover:underline flex items-center gap-1 mx-auto"><FiPlus size={13}/> Cadastrar nova pessoa</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface Props { onClose: () => void; onSuccess: () => void; }

export const RedigirProcuracaoModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [step, setStep]               = useState<1|2|3|4>(1);
  const [outorgantes, setOutorgantes] = useState<Parte[]>([]);
  const [outorgados,  setOutorgados]  = useState<Parte[]>([]);
  const [textoPoderes, setTextoPoderes] = useState(TEXTO_PODERES_SUGERIDO);
  const [finalidade,  setFinalidade]  = useState('');
  const [prazo,       setPrazo]       = useState('');
  const [local,       setLocal]       = useState('Sao Paulo');
  const [data,        setData]        = useState(new Date().toISOString().split('T')[0]);
  const [html,        setHtml]        = useState('');
  const [saving,      setSaving]      = useState(false);
  const iframeRef                     = useRef<HTMLIFrameElement>(null);

  const addParte = (p: any, role: 'outorgante'|'outorgado') => {
    const parte: Parte = { ...p, _tipo: p._tipo ?? 'PF' };
    if (role==='outorgante') { if (!outorgantes.find(x=>x.id===p.id)) setOutorgantes(prev=>[...prev,parte]); }
    else { if (!outorgados.find(x=>x.id===p.id)) setOutorgados(prev=>[...prev,parte]); }
  };
  const removeParte = (id: string, role: 'outorgante'|'outorgado') => {
    if (role==='outorgante') setOutorgantes(prev=>prev.filter(x=>x.id!==id));
    else setOutorgados(prev=>prev.filter(x=>x.id!==id));
  };

  const avancar = () => {
    if (step===3) { setHtml(buildHTML(outorgantes,outorgados,textoPoderes,finalidade,prazo,local,data)); setStep(4); }
    else setStep(s=>(s+1) as any);
  };

  const salvar = async (status: 'RASCUNHO'|'EM_REVISAO') => {
    setSaving(true);
    try {
      const co = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
      const nomes = `${outorgantes.map(p=>p.fullName).join(' e ')} outorga${outorgantes.length>1?'m':''} a ${outorgados.map(p=>p.fullName).join(' e ')}`;
      await api.post('/documents', { companyId: co.id, type: 'PROCURACAO',
        title: `Procuracao - ${nomes}`, description: finalidade||undefined,
        content: html, status, visibility: 'RESERVADO', date: data });
      onSuccess(); onClose();
    } catch { alert('Erro ao salvar.'); }
    setSaving(false);
  };

  const canNext = () => step===1?outorgantes.length>0:step===2?outorgados.length>0:step===3?textoPoderes.trim().length>0:true;
  const STEPS = ['Outorgante(s)','Outorgado(s)','Poderes & Dados','Revisao'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col" style={{maxWidth:step===3?'780px':step===4?'960px':'640px',maxHeight:'90vh'}}>
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
          {step===1&&<div className="space-y-4">
            <p className="text-sm text-gray-500">Pessoa(s) que <strong>concedem</strong> os poderes. Adicione quantas precisar.</p>
            <ParteSearch role="outorgante" lista={outorgantes} onAdd={addParte} onRemove={removeParte}/>
          </div>}
          {step===2&&<div className="space-y-4">
            <p className="text-sm text-gray-500">Pessoa(s) que <strong>receberao</strong> os poderes. Adicione quantas precisar.</p>
            <ParteSearch role="outorgado" lista={outorgados} onAdd={addParte} onRemove={removeParte}/>
          </div>}
          {step===3&&(
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Texto dos poderes</label>
                  <button onClick={() => setTextoPoderes(TEXTO_PODERES_SUGERIDO)} className="text-xs text-blue-500 hover:underline">Restaurar sugestao</button>
                </div>
                <p className="text-xs text-gray-400 mb-2">Edite livremente o texto que aparecera na procuracao.</p>
                <textarea value={textoPoderes} onChange={e=>setTextoPoderes(e.target.value)} rows={16}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm leading-relaxed focus:outline-none focus:border-gray-400 resize-y" style={{fontFamily:'"Times New Roman",Times,serif',fontSize:'12pt',minHeight:'360px',maxHeight:'65vh'}}
                  style={{fontFamily:'"Times New Roman",Times,serif',fontSize:'12pt'}}/>
                <p className="text-xs text-gray-300 mt-1 text-right">{textoPoderes.length} caracteres</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Finalidade / objeto (opcional)</label>
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
