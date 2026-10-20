// frontend/src/pages/projects/workspace/InstrumentosProjeto.tsx
// Instrumentos do plano (10/10/2026): contratos, termos e aditivos do plano F5 - Real Mouchao - Sunrise, com ciclo de vida
// (rascunho, revisao, aprovacao, assinatura, registro, vigencia), versoes por SHA-256 e trilha encadeada por hash.
// As regras moram no banco; a tela so oferece as acoes possiveis na situacao. Master opera; o Revisor le, comenta e envia revisoes.
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { thSt, tdSt, erroSt, PROJ, PROJ_ACCENT } from './projetoTema';

const SIT: Record<string, { rot: string; cor: string; fundo: string }> = {
  RASCUNHO: { rot: 'Rascunho', cor: '#374151', fundo: '#F3F4F6' },
  EM_REVISAO: { rot: 'Em revisão', cor: '#92400E', fundo: '#FEF3C7' },
  APROVADO: { rot: 'Aprovado', cor: '#1E40AF', fundo: '#DBEAFE' },
  EM_ASSINATURA: { rot: 'Em assinatura', cor: '#6B21A8', fundo: '#F3E8FF' },
  ASSINADO: { rot: 'Assinado', cor: '#166534', fundo: '#DCFCE7' },
  REGISTRADO: { rot: 'Registrado', cor: '#14532D', fundo: '#BBF7D0' },
  VIGENTE: { rot: 'Vigente', cor: '#FFFFFF', fundo: '#166534' },
  SUBSTITUIDO: { rot: 'Substituído', cor: '#6B7280', fundo: '#F3F4F6' },
  ENCERRADO: { rot: 'Encerrado', cor: '#A32D2D', fundo: '#FCEBEB' },
};
const ORDEM_SIT = ['RASCUNHO', 'EM_REVISAO', 'APROVADO', 'EM_ASSINATURA', 'ASSINADO', 'REGISTRADO', 'VIGENTE', 'SUBSTITUIDO', 'ENCERRADO'];
const RANK: Record<string, number> = { RASCUNHO: 0, EM_REVISAO: 1, APROVADO: 2, EM_ASSINATURA: 3, ASSINADO: 4, REGISTRADO: 5, VIGENTE: 6, SUBSTITUIDO: -1, ENCERRADO: -1 };
const TIPO_VERSAO: Record<string, string> = { MINUTA: 'Minuta', REVISAO: 'Revisão', FINAL: 'Final', ASSINADA: 'Assinada (PDF)' };
const LEI: Record<string, string> = { BR: 'Lei brasileira', PT: 'Lei portuguesa', BR_PT: 'Leis BR e PT' };
const PAPEL: Record<string, string> = { PARTE: 'Parte', FIADOR: 'Fiador', INTERVENIENTE: 'Interveniente', CIENCIA: 'Ciência', TESTEMUNHA: 'Testemunha' };
const FORMA: Record<string, string> = { CLICKSIGN: 'ClickSign', ICP_BRASIL: 'ICP-Brasil', QUALIFICADA_EU: 'Qualificada (UE/PT)', MANUSCRITA: 'Manuscrita', A_DEFINIR: 'A definir' };
const ORIGEM: Record<string, string> = { ANEXO_I: 'Anexo I', ANEXO_V: 'Anexo V', CONFISSAO: 'Confissão', PLANILHA_NEI: 'Planilha do Nei', SIMULADOR: 'Simulador', MANUAL: 'Manual' };
const TIPO_CERT: Record<string, string> = { ICP_BRASIL: 'ICP-Brasil', GOVBR: 'gov.br', QUALIFICADA_EU: 'Qualificada (UE/PT)', OTHER: 'Outro emissor' };
const CONFIANCA: Record<string, { rot: string; cor: string; fundo: string }> = {
  VALID: { rot: 'Emissor reconhecido', cor: '#166534', fundo: '#DCFCE7' },
  EXPIRED: { rot: 'Certificado vencido', cor: '#A32D2D', fundo: '#FCEBEB' },
  UNTRUSTED: { rot: 'Emissor não reconhecido', cor: '#92400E', fundo: '#FEF3C7' },
  UNKNOWN: { rot: 'Indeterminada', cor: '#374151', fundo: '#F3F4F6' },
};
const EVENTO: Record<string, string> = {
  CRIADO: 'Criado', EDITADO: 'Editado', SITUACAO: 'Situação', VERSAO: 'Versão enviada', VERSAO_ENCERRADO: 'Versão encerrada',
  PARTE: 'Parte incluída', PARTE_ENCERRADO: 'Parte encerrada', DEPENDENCIA: 'Dependência incluída', DEPENDENCIA_ENCERRADO: 'Dependência encerrada',
  REGISTRO: 'Registro informado', REGISTRO_ENCERRADO: 'Registro encerrado', VALOR: 'Valor vinculado', VALOR_ENCERRADO: 'Valor encerrado',
  VALOR_CONGELADO: 'Valor congelado na aprovação', COMENTARIO: 'Comentário',
  ENVIO_ASSINATURA: 'Enviado para assinatura', ENVIO_CONCLUIDO: 'Assinatura concluída', ENVIO_CANCELADO: 'Envio cancelado',
  ASSINATURA_PARTE: 'Parte assinou', VALIDACAO: 'Validação de assinaturas',
};

const painel: React.CSSProperties = { background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: 14 };
const botaoPri: React.CSSProperties = { background: PROJ, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const botaoSec: React.CSSProperties = { background: '#fff', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 6, padding: '7px 14px', fontSize: 13, cursor: 'pointer' };
const botaoPerigo: React.CSSProperties = { ...botaoSec, color: '#A32D2D', borderColor: '#F3C1C1' };
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: PROJ, cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline' };
const mono: React.CSSProperties = { ...tdSt, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 11, whiteSpace: 'nowrap' };
const inputSt: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', background: '#fff' };
const pequeno: React.CSSProperties = { fontSize: 11, color: '#6B7280' };
// Modelo do instrumento (20/10/2026): referencia_minuta pode trazer o link do documento de minutas; a ultima versao
// MINUTA e o modelo em Word. Os dois aparecem na lista enquanto nao houver versao produzida (Revisao, Final ou Assinada).
const urlMinuta = (s?: string | null): string => (String(s || '').match(/https?:\/\/\S+/) || [])[0] || '';
const rotMinuta = (s?: string | null): string => String(s || '').replace(/\s*-?\s*https?:\/\/\S+/, '').trim();

type Acao = { para: string; rot: string; precisa?: 'versao' | 'substituto'; tom?: 'pri' | 'perigo'; dica?: string };
type Aba = 'versoes' | 'partes' | 'assinatura' | 'registro' | 'valores' | 'dependencias' | 'trilha';
type ModalSt =
  | { tipo: 'transitar'; acao: Acao }
  | { tipo: 'versao' } | { tipo: 'parte' } | { tipo: 'registro' } | { tipo: 'valor' } | { tipo: 'dependencia' }
  | { tipo: 'encerrar'; colecao: string; item: any; rotulo: string }
  | { tipo: 'clicksign' } | { tipo: 'cancelarEnvio' };

function acoesDe(i: any): Acao[] {
  const a: Acao[] = [];
  switch (i.situacao) {
    case 'RASCUNHO': a.push({ para: 'EM_REVISAO', rot: 'Enviar para revisão', tom: 'pri', dica: 'Os revisores passam a poder enviar versões revisadas.' }); break;
    case 'EM_REVISAO':
      a.push({ para: 'APROVADO', rot: 'Aprovar versão final', precisa: 'versao', tom: 'pri', dica: 'Os valores vinculados ficam congelados nesta versão.' });
      a.push({ para: 'RASCUNHO', rot: 'Voltar a rascunho' }); break;
    case 'APROVADO':
      if (i.requerAssinatura) a.push({ para: 'EM_ASSINATURA', rot: 'Enviar para assinatura', tom: 'pri', dica: 'Exige as dependências atendidas. Depois, envie o PDF assinado na aba Versões.' });
      else if (i.requerRegistro) a.push({ para: 'REGISTRADO', rot: 'Marcar como registrado', tom: 'pri', dica: 'Exige o registro informado na aba Registro e as dependências atendidas.' });
      else a.push({ para: 'VIGENTE', rot: 'Tornar vigente', tom: 'pri', dica: 'Exige as dependências atendidas.' });
      a.push({ para: 'EM_REVISAO', rot: 'Reabrir revisão' }); break;
    case 'EM_ASSINATURA':
      a.push({ para: 'ASSINADO', rot: 'Marcar como assinado', tom: 'pri', dica: 'Exige a versão Assinada (PDF): use a aba Assinatura (ClickSign) ou envie o PDF assinado na aba Versões.' });
      a.push({ para: 'APROVADO', rot: 'Cancelar assinatura' }); break;
    case 'ASSINADO':
      a.push(i.requerRegistro
        ? { para: 'REGISTRADO', rot: 'Marcar como registrado', tom: 'pri', dica: 'Exige o registro informado na aba Registro.' }
        : { para: 'VIGENTE', rot: 'Tornar vigente', tom: 'pri' }); break;
    case 'REGISTRADO': a.push({ para: 'VIGENTE', rot: 'Tornar vigente', tom: 'pri' }); break;
    case 'VIGENTE': a.push({ para: 'SUBSTITUIDO', rot: 'Substituir por outro instrumento', precisa: 'substituto' }); break;
  }
  if (!['SUBSTITUIDO', 'ENCERRADO'].includes(i.situacao)) a.push({ para: 'ENCERRADO', rot: 'Encerrar', tom: 'perigo' });
  return a;
}
const obrigaMotivo = (de: string, para: string) => (RANK[para] ?? -1) < (RANK[de] ?? -1);
function tiposPermitidos(sit: string, master: boolean): string[] {
  if (!master) return sit === 'EM_REVISAO' ? ['REVISAO'] : [];
  if (sit === 'RASCUNHO') return ['MINUTA', 'REVISAO'];
  if (sit === 'EM_REVISAO') return ['FINAL', 'REVISAO', 'MINUTA'];
  if (sit === 'EM_ASSINATURA') return ['ASSINADA'];
  return [];
}

const fmtDH = (s?: string | null) => { if (!s) return '-'; const d = new Date(s); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
const fmtD = (s?: string | null) => { if (!s) return '-'; const [a, m, d] = String(s).slice(0, 10).split('-'); return `${d}/${m}/${a}`; };
const fmtVal = (v: string, moeda: string) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: moeda || 'BRL' });
const fmtTam = (n: number) => (n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
const dataIso = (br: string) => { const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
const mascaraData = (s: string) => { const d = s.replace(/\D/g, '').slice(0, 8); return d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };
function msgErro(e: any): string {
  const m = e?.response?.data?.message;
  if (Array.isArray(m)) return m.join('; ');
  return m || e?.message || 'Falha na operação.';
}
async function enviarArquivo(url: string, fd: FormData) {
  await api.get('/projects/documento-tipos'); // garante token renovado (o fetch nao passa pelo interceptor)
  const raiz = String(api.defaults.baseURL || '').replace(/\/$/, '');
  const res = await fetch(raiz + url, { method: 'POST', headers: { Authorization: 'Bearer ' + localStorage.getItem('@ledgr:token') }, body: fd });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(Array.isArray(j.message) ? j.message.join('; ') : j.message || 'Falha no envio.');
  return j;
}
async function baixar(url: string, nome: string) {
  const r = await api.get(url, { responseType: 'blob' });
  const href = URL.createObjectURL(r.data);
  const a = document.createElement('a'); a.href = href; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1500);
}
function resumoEvento(e: any): string {
  const d = e.detalhe || {};
  switch (e.tipo) {
    case 'CRIADO': return d.titulo || '';
    case 'SITUACAO': return `${SIT[e.de]?.rot || e.de || '-'} → ${SIT[e.para]?.rot || e.para}`;
    case 'VERSAO': case 'VERSAO_ENCERRADO': return `v${d.numero} · ${TIPO_VERSAO[d.tipo] || d.tipo} · ${d.arquivo_nome || ''}`;
    case 'PARTE': case 'PARTE_ENCERRADO': return `${d.nome || ''} (${PAPEL[d.papel] || d.papel || ''})`;
    case 'REGISTRO': case 'REGISTRO_ENCERRADO': return `${d.orgao || ''}${d.protocolo ? ' · protocolo ' + d.protocolo : ''}`;
    case 'VALOR': case 'VALOR_ENCERRADO': case 'VALOR_CONGELADO': return `${d.rotulo || ''}: ${d.valor != null ? fmtVal(String(d.valor), d.moeda) : ''}`;
    case 'DEPENDENCIA': case 'DEPENDENCIA_ENCERRADO': return `exige ${SIT[d.exige_situacao]?.rot || d.exige_situacao || ''}`;
    case 'COMENTARIO': return d.texto || '';
    case 'ENVIO_ASSINATURA': case 'ENVIO_CONCLUIDO': case 'ENVIO_CANCELADO': return `${d.canal || ''} · documento ${d.chave || ''}`;
    case 'ASSINATURA_PARTE': return `${d.nome || ''} (${d.email || ''}) · ${d.situacao || ''}`;
    case 'VALIDACAO': return `${d.valido ? 'Assinaturas reconhecidas' : 'Não confirmada'} · ${d.assinaturas} assinatura(s)${Array.isArray(d.signatarios) && d.signatarios.length ? ': ' + d.signatarios.join(', ') : ''}`;
    case 'EDITADO': return 'Dados descritivos alterados';
    default: return '';
  }
}

function Chip({ s }: { s: string }) {
  const c = SIT[s] || { rot: s, cor: '#374151', fundo: '#F3F4F6' };
  return <span style={{ fontSize: 11, fontWeight: 600, color: c.cor, background: c.fundo, borderRadius: 10, padding: '2px 9px', whiteSpace: 'nowrap' }}>{c.rot}</span>;
}
function Tag({ children, cor = '#374151', fundo = '#F3F4F6', title }: { children: React.ReactNode; cor?: string; fundo?: string; title?: string }) {
  return <span title={title} style={{ fontSize: 11, color: cor, background: fundo, borderRadius: 4, padding: '1px 6px', marginRight: 4, whiteSpace: 'nowrap', display: 'inline-block', marginBottom: 2 }}>{children}</span>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.3, margin: '10px 0 4px' }}>{children}</div>;
}
function Modal({ titulo, subtitulo, onFechar, onConfirmar, rotulo, ocupado, erro, perigo, children }: {
  titulo: string; subtitulo?: string; onFechar: () => void; onConfirmar: () => void; rotulo: string; ocupado: boolean; erro: string; perigo?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 10, width: 'min(560px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ background: PROJ, color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{titulo}</div>
            {subtitulo && <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{subtitulo}</div>}
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 16, overflowY: 'auto' }}>
          <div style={{ borderLeft: `3px solid ${PROJ_ACCENT}`, paddingLeft: 12 }}>{children}</div>
          {erro && <div style={{ ...erroSt, marginTop: 12 }}>{erro}</div>}
        </div>
        <div style={{ background: '#FAFAFA', borderTop: '1px solid #E5E7EB', padding: '10px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onFechar} style={botaoSec}>Cancelar</button>
          <button onClick={onConfirmar} disabled={ocupado} style={{ ...(perigo ? botaoPerigo : botaoPri), opacity: ocupado ? 0.6 : 1 }}>{ocupado ? 'Gravando...' : rotulo}</button>
        </div>
      </div>
    </div>
  );
}

export default function InstrumentosProjeto({ projetoId }: { projetoId: string }) {
  const base = `/projects-instrumentos/projetos/${projetoId}/instrumentos`;
  const [lista, setLista] = useState<any>(null);
  const [selId, setSelId] = useState('');
  const [det, setDet] = useState<any>(null);
  const [aba, setAba] = useState<Aba>('versoes');
  const [erro, setErro] = useState('');
  const [modal, setModal] = useState<ModalSt | null>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [arq, setArq] = useState<File | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erroM, setErroM] = useState('');
  const [comentario, setComentario] = useState('');
  const [sinc, setSinc] = useState(false);
  const [fontes, setFontes] = useState<any[]>([]);
  const [gerando, setGerando] = useState(false);

  const carregarLista = () => api.get(base).then((r) => { setLista(r.data); setErro(''); }).catch((e) => setErro(msgErro(e)));
  const carregarDet = (id: string) => api.get(`${base}/${id}`).then((r) => setDet(r.data)).catch((e) => setErro(msgErro(e)));
  useEffect(() => { carregarLista(); }, [projetoId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (selId) { setDet(null); carregarDet(selId); } }, [selId]); // eslint-disable-line react-hooks/exhaustive-deps
  const recarregar = () => { carregarLista(); if (selId) carregarDet(selId); };
  const campo = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target.value; setF((x) => ({ ...x, [k]: v }));
  };

  const inst = det?.instrumento;
  const master = !!(det?.podeOperar ?? lista?.podeOperar);
  const encerrado = inst ? ['SUBSTITUIDO', 'ENCERRADO'].includes(inst.situacao) : false;

  const abrir = (m: ModalSt) => {
    const ini: Record<string, string> = {};
    if (m.tipo === 'versao' && inst) ini.tipo = tiposPermitidos(inst.situacao, master)[0] || '';
    if (m.tipo === 'parte') { ini.papel = 'PARTE'; ini.forma = 'A_DEFINIR'; ini.jurisdicao = 'BR'; }
    if (m.tipo === 'registro') ini.orgao = inst?.orgaoRegistro || '';
    if (m.tipo === 'valor') {
      ini.moeda = 'BRL'; ini.origem = 'MANUAL'; ini.fonte = '';
      api.get(`/projects-instrumentos/projetos/${projetoId}/instrumentos-fontes`).then((r) => setFontes(r.data || [])).catch(() => setFontes([]));
    }
    if (m.tipo === 'dependencia') ini.exige = 'ASSINADO';
    if (m.tipo === 'clicksign') {
      ini.prazo = '30';
      (det?.partes || []).filter((p: any) => !p.canceladoEm).forEach((p: any) => {
        ini['sel_' + p.id] = p.formaAssinatura === 'CLICKSIGN' ? '1' : ''; ini['email_' + p.id] = p.email || ''; ini['nome_' + p.id] = '';
      });
    }
    setF(ini); setArq(null); setErroM(''); setModal(m);
  };

  const confirmar = async () => {
    if (!modal || !inst) return;
    const url = `${base}/${inst.id}`;
    setErroM('');
    try {
      if (modal.tipo === 'transitar') {
        const a = modal.acao;
        if (a.precisa === 'versao' && !f.versaoId) throw new Error('Escolha a versão FINAL que está sendo aprovada.');
        if (a.precisa === 'substituto' && !f.substitutoId) throw new Error('Escolha o instrumento substituto.');
        if (obrigaMotivo(inst.situacao, a.para) && (f.motivo || '').trim().length < 10) throw new Error('Informe o motivo (mínimo de 10 caracteres).');
        setOcupado(true);
        await api.post(`${url}/transitar`, { para: a.para, motivo: f.motivo || '', versaoAprovadaId: f.versaoId || null, substitutoId: f.substitutoId || null });
      } else if (modal.tipo === 'versao') {
        if (!f.tipo) throw new Error('Nesta situação não cabe envio de versão.');
        if (!arq) throw new Error('Escolha o arquivo.');
        const fd = new FormData();
        fd.append('file', arq); fd.append('tipo', f.tipo);
        if (f.baseId) fd.append('versaoBaseId', f.baseId);
        if ((f.comentario || '').trim()) fd.append('comentario', (f.comentario || '').trim());
        setOcupado(true);
        await enviarArquivo(`${url}/versoes`, fd);
      } else if (modal.tipo === 'parte') {
        if ((f.nome || '').trim().length < 2) throw new Error('Informe o nome.');
        setOcupado(true);
        await api.post(`${url}/partes`, { nome: f.nome, papel: f.papel, documento: f.documento || null, email: f.email || null, jurisdicao: f.jurisdicao || null, formaAssinatura: f.forma, observacao: f.observacao || null });
      } else if (modal.tipo === 'registro') {
        const iso = dataIso(f.data || '');
        if ((f.orgao || '').trim().length < 3) throw new Error('Informe o órgão.');
        if (!iso) throw new Error('Informe a data no formato dd/mm/aaaa.');
        const fd = new FormData();
        fd.append('orgao', (f.orgao || '').trim()); fd.append('dataRegistro', iso);
        if ((f.protocolo || '').trim()) fd.append('protocolo', (f.protocolo || '').trim());
        if ((f.observacao || '').trim()) fd.append('observacao', (f.observacao || '').trim());
        if (arq) fd.append('file', arq);
        setOcupado(true);
        await enviarArquivo(`${url}/registros`, fd);
      } else if (modal.tipo === 'valor' && f.fonte) {
        setOcupado(true);
        await api.post(`${url}/valores`, { fonte: f.fonte, rotulo: f.rotulo || null, marcador: f.marcador || null });
      } else if (modal.tipo === 'valor') {
        const bruto = String(f.valor || '').trim();
        const v = Number(bruto.replace(/\./g, '').replace(',', '.'));
        if ((f.rotulo || '').trim().length < 3) throw new Error('Informe o rótulo.');
        if (!bruto || !isFinite(v)) throw new Error('Valor inválido.');
        setOcupado(true);
        await api.post(`${url}/valores`, { rotulo: f.rotulo, marcador: f.marcador || null, valor: v, moeda: f.moeda, origem: f.origem, origemRef: f.ref ? { descricao: f.ref } : null });
      } else if (modal.tipo === 'dependencia') {
        if (!f.depId) throw new Error('Escolha o instrumento.');
        setOcupado(true);
        await api.post(`${url}/dependencias`, { dependeDeId: f.depId, exigeSituacao: f.exige, justificativa: f.justificativa || null });
      } else if (modal.tipo === 'clicksign') {
        const ativas = det.partes.filter((p: any) => !p.canceladoEm);
        const sig = ativas.filter((p: any) => f['sel_' + p.id] === '1').map((p: any) => ({ parteId: p.id, email: (f['email_' + p.id] || '').trim(), nome: (f['nome_' + p.id] || '').trim() }));
        if (!sig.length) throw new Error('Escolha ao menos uma parte.');
        if (sig.some((s: any) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email))) throw new Error('Informe um e-mail válido para cada parte escolhida.');
        if (sig.some((s: any) => s.nome.split(/\s+/).filter(Boolean).length < 2)) throw new Error('Informe o nome completo (nome e sobrenome) de quem assina por cada parte.');
        setOcupado(true);
        await api.post(`${url}/assinatura/clicksign`, { signatarios: sig, prazoDias: Number(f.prazo || 30) });
      } else if (modal.tipo === 'cancelarEnvio') {
        if ((f.motivo || '').trim().length < 10) throw new Error('Informe o motivo (mínimo de 10 caracteres).');
        setOcupado(true);
        const r = await api.post(`${url}/assinatura/cancelar`, { motivo: f.motivo });
        if (r.data?.aviso) toast(r.data.aviso);
      } else if (modal.tipo === 'encerrar') {
        if ((f.motivo || '').trim().length < 10) throw new Error('Informe o motivo (mínimo de 10 caracteres).');
        setOcupado(true);
        await api.post(`${url}/${modal.colecao}/${modal.item.id}/encerrar`, { motivo: f.motivo });
      }
      toast.success('Registrado na trilha.');
      setModal(null);
      recarregar();
    } catch (e: any) { setErroM(msgErro(e)); } finally { setOcupado(false); }
  };

  const gerarDossie = async () => {
    setGerando(true);
    try {
      const r = await api.get(`/projects-instrumentos/projetos/${projetoId}/dossie`, { responseType: 'blob' });
      const sha = (r.headers as any)?.['x-manifesto-sha256'];
      const href = URL.createObjectURL(r.data);
      const a = document.createElement('a'); a.href = href; a.download = `dossie-instrumentos-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(href), 1500);
      toast.success(sha ? `Dossiê gerado. SHA-256 do manifesto: ${String(sha).slice(0, 16)}...` : 'Dossiê gerado e registrado na auditoria.');
    } catch (e) { toast.error(msgErro(e)); } finally { setGerando(false); }
  };
  const atualizarClickSign = async () => {
    if (!inst) return;
    setSinc(true);
    try {
      const r = await api.post(`${base}/${inst.id}/assinatura/atualizar`, {});
      const d = r.data;
      if (d.aviso) toast(d.aviso);
      else toast.success(d.concluido ? 'Todos assinaram: PDF assinado guardado e validado.' : `ClickSign: ${d.status || '-'} · novas assinaturas: ${d.novasAssinaturas}.`);
      carregarDet(inst.id);
    } catch (e) { toast.error(msgErro(e)); } finally { setSinc(false); }
  };
  const reenviar = async () => {
    if (!inst) return;
    setSinc(true);
    try {
      const d = (await api.post(`${base}/${inst.id}/assinatura/reenviar`, {})).data;
      if (d.enviados?.length) toast.success('E-mail reenviado para ' + d.enviados.join(', '));
      else toast(d.falhas?.length ? 'Falha: ' + d.falhas.join('; ') : 'Nenhum signatário pendente.');
    } catch (e) { toast.error(msgErro(e)); } finally { setSinc(false); }
  };
  const validarVersao = async (v: any) => {
    if (!inst) return;
    try {
      const r = await api.post(`${base}/${inst.id}/versoes/${v.id}/validar`, {});
      toast.success(r.data?.valido ? 'Assinaturas com emissor reconhecido.' : 'Assinaturas não confirmadas. Veja a aba Assinatura.');
      carregarDet(inst.id);
    } catch (e) { toast.error(msgErro(e)); }
  };
  const comentar = async () => {
    if (!inst || comentario.trim().length < 3) return;
    try {
      await api.post(`${base}/${inst.id}/comentar`, { texto: comentario.trim() });
      setComentario(''); toast.success('Comentário registrado na trilha.'); carregarDet(inst.id);
    } catch (e) { toast.error(msgErro(e)); }
  };

  if (erro && !lista) return <div style={erroSt}>{erro}</div>;
  if (!lista) return <div style={{ color: '#6B7280', fontSize: 13 }}>Carregando...</div>;

  // ------------------------------------------------------------------ lista
  if (!selId) {
    const cont: Record<string, number> = {};
    (lista.itens || []).forEach((x: any) => { cont[x.situacao] = (cont[x.situacao] || 0) + 1; });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 20, color: '#111827' }}>Instrumentos do plano</h2>
            {lista.podeOperar && <button style={botaoSec} disabled={gerando} onClick={gerarDossie}>{gerando ? 'Gerando...' : 'Gerar dossiê de auditoria'}</button>}
          </div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            Contratos, termos e aditivos do plano F5 - Real Mouchão - Sunrise. Cada mudança fica numa trilha encadeada por hash, que ninguém altera.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ORDEM_SIT.filter((s) => cont[s]).map((s) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151' }}><Chip s={s} /> {cont[s]}</span>
          ))}
        </div>
        <div style={{ ...painel, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>
                <th style={thSt}>Código</th><th style={thSt}>Instrumento</th><th style={thSt}>Situação</th>
                <th style={thSt}>Depende de</th><th style={{ ...thSt, textAlign: 'right' }}>Versões</th><th style={thSt}>Última movimentação</th>
              </tr>
            </thead>
            <tbody>
              {lista.itens.map((x: any) => (
                <tr key={x.id} onClick={() => { setSelId(x.id); setAba('versoes'); }} style={{ cursor: 'pointer' }}>
                  <td style={{ ...tdSt, fontWeight: 600 }}>{x.codigo}</td>
                  <td style={tdSt}>
                    <div style={{ color: '#111827' }}>{x.titulo}</div>
                    <div style={pequeno}>Item {x.itemPlanilha || '-'} da planilha · {LEI[x.lei] || x.lei}{x.requerRegistro ? ' · registro: ' + (x.orgaoRegistro || 'a definir') : ''}</div>
                    {!x.versoesProduzidas && (x.minuta || urlMinuta(x.referenciaMinuta)) && (
                      <div style={{ marginTop: 3, fontSize: 12 }} onClick={(e) => e.stopPropagation()}>
                        <span style={pequeno}>Modelo: </span>
                        {x.minuta && <button type="button" style={linkBtn} title={x.minuta.nome}
                          onClick={() => baixar(`${base}/${x.id}/versoes/${x.minuta.id}/arquivo`, x.minuta.nome).catch((e) => toast.error(msgErro(e)))}>Word (v{x.minuta.numero})</button>}
                        {x.minuta && urlMinuta(x.referenciaMinuta) && <span style={pequeno}> · </span>}
                        {urlMinuta(x.referenciaMinuta) && <a href={urlMinuta(x.referenciaMinuta)} target="_blank" rel="noopener noreferrer" style={{ ...linkBtn, fontSize: 12 }}
                          title={rotMinuta(x.referenciaMinuta)}>minuta online ↗</a>}
                      </div>)}
                  </td>
                  <td style={tdSt}><Chip s={x.situacao} /></td>
                  <td style={tdSt}>
                    {x.dependencias.length === 0 ? <span style={pequeno}>-</span> : x.dependencias.map((d: any) => (
                      <Tag key={d.dependeDeId} title={`${d.codigo}: ${SIT[d.situacao]?.rot || d.situacao} (exige ${SIT[d.exigeSituacao]?.rot || d.exigeSituacao})`}
                        cor={d.atendida ? '#166534' : '#92400E'} fundo={d.atendida ? '#DCFCE7' : '#FEF3C7'}>{d.atendida ? '✓ ' : ''}{d.codigo}</Tag>
                    ))}
                  </td>
                  <td style={{ ...tdSt, textAlign: 'right' }}>{x.versoes}</td>
                  <td style={tdSt}>{fmtDH(x.ultimoEvento)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ detalhe
  if (!det || !inst) return <div style={{ color: '#6B7280', fontSize: 13 }}>{erro ? <span style={erroSt}>{erro}</span> : 'Carregando...'}</div>;
  const acoes = master ? acoesDe(inst) : [];
  const versoesAtivas = det.versoes.filter((v: any) => !v.canceladoEm);
  const tiposV = tiposPermitidos(inst.situacao, master);
  const outros = (lista.itens || []).filter((x: any) => x.id !== inst.id && !['SUBSTITUIDO', 'ENCERRADO'].includes(x.situacao));
  const abaBtn = (k: Aba, rot: string, n?: number) => (
    <button key={k} onClick={() => setAba(k)} style={{
      background: 'none', border: 'none', borderBottom: aba === k ? `2px solid ${PROJ}` : '2px solid transparent',
      color: aba === k ? PROJ : '#6B7280', fontWeight: aba === k ? 700 : 500, fontSize: 13, padding: '8px 10px', cursor: 'pointer', whiteSpace: 'nowrap',
    }}>{rot}{n != null ? ` (${n})` : ''}</button>
  );
  const encerrarBtn = (colecao: string, item: any, rotulo: string) => (master && !item.canceladoEm
    ? <button style={linkBtn} onClick={() => abrir({ tipo: 'encerrar', colecao, item, rotulo })}>Encerrar</button> : null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><button style={linkBtn} onClick={() => { setSelId(''); setDet(null); }}>← Voltar à lista</button></div>

      <div style={painel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{inst.codigo} · item {inst.itemPlanilha || '-'} da planilha</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginTop: 2 }}>{inst.titulo}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              <Chip s={inst.situacao} />
              <Tag>{LEI[inst.lei] || inst.lei}</Tag>
              <Tag>{inst.requerAssinatura ? 'Exige assinatura' : 'Sem assinatura'}</Tag>
              <Tag>{inst.requerRegistro ? 'Registro: ' + (inst.orgaoRegistro || 'a definir') : 'Sem registro'}</Tag>
              {inst.referenciaMinuta && (urlMinuta(inst.referenciaMinuta)
                ? <a href={urlMinuta(inst.referenciaMinuta)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}><Tag cor={PROJ} fundo="#E6F4F1" title="Abrir a minuta online">{rotMinuta(inst.referenciaMinuta) || 'Minuta online'} ↗</Tag></a>
                : <Tag>{inst.referenciaMinuta}</Tag>)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: det.trilha.integra ? '#166534' : '#A32D2D', background: det.trilha.integra ? '#DCFCE7' : '#FCEBEB', borderRadius: 6, padding: '4px 10px', display: 'inline-block' }}>
              {det.trilha.integra ? `Trilha íntegra · ${det.trilha.eventos} eventos` : 'Trilha violada - verifique'}
            </div>
            <div style={{ ...pequeno, marginTop: 4 }}>Situação desde {fmtDH(inst.situacaoEm)}</div>
          </div>
        </div>
        {inst.pendencias && (
          <div style={{ marginTop: 10, background: '#FEF3C7', color: '#92400E', borderRadius: 6, padding: '8px 10px', fontSize: 12 }}>
            Dependências pendentes: {inst.pendencias}
          </div>
        )}
        {acoes.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {acoes.map((a) => (
              <button key={a.para} style={a.tom === 'pri' ? botaoPri : a.tom === 'perigo' ? botaoPerigo : botaoSec}
                onClick={() => abrir({ tipo: 'transitar', acao: a })}>{a.rot}</button>
            ))}
          </div>
        )}
        {!master && <div style={{ ...pequeno, marginTop: 10 }}>Perfil revisor: você pode ler, comentar e, com o instrumento Em revisão, enviar versões revisadas.</div>}
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #E5E7EB', overflowX: 'auto' }}>
        {abaBtn('versoes', 'Versões', versoesAtivas.length)}
        {abaBtn('partes', 'Partes', det.partes.filter((p: any) => !p.canceladoEm).length)}
        {abaBtn('assinatura', 'Assinatura', (det.validacoes || []).length)}
        {abaBtn('registro', 'Registro', det.registros.filter((r: any) => !r.canceladoEm).length)}
        {abaBtn('valores', 'Valores', det.valores.filter((v: any) => !v.canceladoEm).length)}
        {abaBtn('dependencias', 'Dependências', det.dependencias.length)}
        {abaBtn('trilha', 'Trilha', det.eventos.length)}
      </div>

      {aba === 'versoes' && (
        <div style={painel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
            <div style={pequeno}>Cada arquivo é guardado pelo seu SHA-256. Baixar confere a integridade antes de entregar.</div>
            {tiposV.length > 0 && <button style={botaoPri} onClick={() => abrir({ tipo: 'versao' })}>Enviar versão</button>}
          </div>
          {det.versoes.length === 0 ? <div style={pequeno}>Nenhuma versão enviada. A minuta está no documento de minutas ({rotMinuta(inst.referenciaMinuta) || '-'}{urlMinuta(inst.referenciaMinuta) && <> · <a href={urlMinuta(inst.referenciaMinuta)} target="_blank" rel="noopener noreferrer">abrir</a></>}); exporte para Word e envie como Minuta: ela vira o modelo na lista.</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                <thead><tr><th style={thSt}>Nº</th><th style={thSt}>Tipo</th><th style={thSt}>Arquivo</th><th style={thSt}>SHA-256</th><th style={thSt}>Enviado por</th><th style={thSt}>Comentário</th><th style={thSt}></th></tr></thead>
                <tbody>
                  {det.versoes.map((v: any) => (
                    <tr key={v.id} style={{ opacity: v.canceladoEm ? 0.55 : 1 }}>
                      <td style={{ ...tdSt, fontWeight: 600 }}>v{v.numero}</td>
                      <td style={tdSt}>
                        <Tag>{TIPO_VERSAO[v.tipo] || v.tipo}</Tag>
                        {inst.versaoAprovadaId === v.id && <Tag cor="#1E40AF" fundo="#DBEAFE">Aprovada</Tag>}
                      </td>
                      <td style={tdSt}>{v.arquivoNome}<div style={pequeno}>{fmtTam(v.tamanho)}</div></td>
                      <td style={mono} title={v.sha256}>{String(v.sha256).slice(0, 12)}</td>
                      <td style={tdSt}>{v.criadoPor || '-'}<div style={pequeno}>{fmtDH(v.criadoEm)}</div></td>
                      <td style={tdSt}>
                        {v.comentario || '-'}
                        {v.canceladoEm && <div style={{ fontSize: 11, color: '#A32D2D' }}>Encerrada: {v.motivoCancelamento}</div>}
                      </td>
                      <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>
                        <button style={linkBtn} onClick={() => baixar(`${base}/${inst.id}/versoes/${v.id}/arquivo`, v.arquivoNome).catch((e) => toast.error(msgErro(e)))}>Baixar</button>
                        {' '}{master && v.tipo === 'ASSINADA' && !v.canceladoEm && <button style={linkBtn} onClick={() => validarVersao(v)}>Validar</button>}{' '}{encerrarBtn('versoes', v, `versão v${v.numero}`)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {aba === 'partes' && (
        <div style={painel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
            <div style={pequeno}>Quem assina e como. Partes em Portugal podem assinar com assinatura qualificada ou à mão (PDF enviado depois).</div>
            {master && ['RASCUNHO', 'EM_REVISAO', 'APROVADO'].includes(inst.situacao) && <button style={botaoPri} onClick={() => abrir({ tipo: 'parte' })}>Incluir parte</button>}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead><tr><th style={thSt}>Nome</th><th style={thSt}>Papel</th><th style={thSt}>Documento</th><th style={thSt}>Jurisdição</th><th style={thSt}>Assinatura</th><th style={thSt}></th></tr></thead>
              <tbody>
                {det.partes.map((p: any) => (
                  <tr key={p.id} style={{ opacity: p.canceladoEm ? 0.55 : 1 }}>
                    <td style={tdSt}>{p.nome}{p.email && <div style={pequeno}>{p.email}</div>}{p.canceladoEm && <div style={{ fontSize: 11, color: '#A32D2D' }}>Encerrada: {p.motivoCancelamento}</div>}</td>
                    <td style={tdSt}>{PAPEL[p.papel] || p.papel}</td>
                    <td style={mono}>{p.documento || '-'}</td>
                    <td style={tdSt}>{p.jurisdicao || 'a confirmar'}</td>
                    <td style={tdSt}>{FORMA[p.formaAssinatura] || p.formaAssinatura}</td>
                    <td style={tdSt}>{encerrarBtn('partes', p, p.nome)}</td>
                  </tr>
                ))}
                {det.partes.length === 0 && <tr><td style={tdSt} colSpan={6}><span style={pequeno}>Sem partes (instrumento sem assinatura própria).</span></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aba === 'assinatura' && (() => {
        const envios: any[] = det.envios || [];
        const ativo = envios.find((e: any) => e.situacao === 'ENVIADO');
        const aprovada = det.versoes.find((v: any) => v.id === inst.versaoAprovadaId);
        const aprovadaPdf = !!aprovada && /\.pdf$/i.test(aprovada.arquivoNome || '');
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={painel}>
              <div style={pequeno}>
                Partes no Brasil assinam pela ClickSign. Partes em Portugal (assinatura qualificada ou à mão) assinam fora: o PDF assinado
                entra na aba Versões como Assinada e a validação roda sozinha. Depois, use "Marcar como assinado".
              </div>
              {!inst.requerAssinatura && <div style={{ ...pequeno, marginTop: 8 }}>Este instrumento não exige assinatura.</div>}
              {master && inst.situacao === 'EM_ASSINATURA' && !ativo && envios.some((e: any) => e.situacao === 'CONCLUIDO' && e.versaoNumero === aprovada?.numero) && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#166534' }}>Assinatura concluída pela ClickSign: use "Marcar como assinado" no topo.</div>
              )}
              {master && inst.situacao === 'EM_ASSINATURA' && !ativo && !envios.some((e: any) => e.situacao === 'CONCLUIDO' && e.versaoNumero === aprovada?.numero) && (
                <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button style={{ ...botaoPri, opacity: aprovadaPdf ? 1 : 0.5 }} disabled={!aprovadaPdf} onClick={() => abrir({ tipo: 'clicksign' })}>Enviar à ClickSign</button>
                  {!aprovadaPdf && <span style={{ fontSize: 12, color: '#92400E' }}>A versão aprovada não é PDF. A ClickSign só aceita PDF.</span>}
                </div>
              )}
            </div>
            {ativo && (
              <div style={painel}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Envio em andamento · ClickSign</div>
                    <div style={pequeno}>Documento {ativo.chave} · versão v{ativo.versaoNumero} · prazo {fmtDH(ativo.prazo)}</div>
                    <div style={pequeno}>Situação na ClickSign: {ativo.statusExterno || 'não consultada'} · última consulta {fmtDH(ativo.ultimaConsulta)}</div>
                  </div>
                  {master && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={botaoPri} disabled={sinc} onClick={atualizarClickSign}>{sinc ? 'Consultando...' : 'Atualizar da ClickSign'}</button>
                      <button style={botaoSec} disabled={sinc} onClick={reenviar}>Reenviar e-mail</button>
                      <button style={botaoPerigo} onClick={() => abrir({ tipo: 'cancelarEnvio' })}>Cancelar envio</button>
                    </div>
                  )}
                </div>
                <div style={{ overflowX: 'auto', marginTop: 10 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                    <thead><tr><th style={thSt}>Parte</th><th style={thSt}>E-mail</th><th style={thSt}>Situação</th><th style={thSt}>Assinou em</th></tr></thead>
                    <tbody>
                      {ativo.assinaturas.map((a: any) => (
                        <tr key={a.id}>
                          <td style={tdSt}>{a.nome}{a.signatario && <div style={pequeno}>por {a.signatario}</div>}</td><td style={tdSt}>{a.email}</td>
                          <td style={tdSt}><Tag cor={a.situacao === 'ASSINADO' ? '#166534' : '#92400E'} fundo={a.situacao === 'ASSINADO' ? '#DCFCE7' : '#FEF3C7'}>{a.situacao === 'ASSINADO' ? 'Assinou' : a.situacao === 'RECUSADO' ? 'Recusou' : 'Pendente'}</Tag></td>
                          <td style={tdSt}>{fmtDH(a.assinadoEm)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {envios.filter((e: any) => e.situacao !== 'ENVIADO').length > 0 && (
              <div style={painel}>
                <Label>Envios anteriores</Label>
                {envios.filter((e: any) => e.situacao !== 'ENVIADO').map((e: any) => (
                  <div key={e.id} style={{ borderTop: '1px solid #F3F4F6', padding: '6px 0', fontSize: 12 }}>
                    <b>{e.situacao === 'CONCLUIDO' ? 'Concluído' : 'Cancelado'}</b> · ClickSign {e.chave} · versão v{e.versaoNumero} · enviado em {fmtDH(e.criadoEm)}
                    {e.concluidoEm && <> · concluído em {fmtDH(e.concluidoEm)}</>}
                    {e.motivoCancelamento && <div style={{ color: '#A32D2D' }}>Motivo: {e.motivoCancelamento}</div>}
                    <div style={pequeno}>{e.assinaturas.map((a: any) => `${a.nome} (${a.situacao === 'ASSINADO' ? 'assinou' : 'pendente'})`).join(' · ')}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={painel}>
              <Label>Validações de PDF assinado</Label>
              {(det.validacoes || []).length === 0 ? <div style={pequeno}>Nenhuma validação ainda.</div> : det.validacoes.map((x: any) => (
                <div key={x.id} style={{ borderTop: '1px solid #F3F4F6', padding: '8px 0' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>v{x.versaoNumero}</span>
                    <Tag cor={x.valido ? '#166534' : '#A32D2D'} fundo={x.valido ? '#DCFCE7' : '#FCEBEB'}>{x.valido ? 'Emissor reconhecido' : 'Não confirmada'}</Tag>
                    <span style={pequeno}>{x.qtd} assinatura(s) · {fmtDH(x.criadoEm)} · PDF {String(x.sha256).slice(0, 12)}</span>
                  </div>
                  {(x.resultado?.assinaturas || []).map((s: any, k: number) => {
                    const cf = CONFIANCA[s.confianca] || CONFIANCA.UNKNOWN;
                    return (
                      <div key={k} style={{ fontSize: 12, marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{s.nome || 'Sem nome'}</span>
                        {/clicksign/i.test(s.nome || '') && <Tag cor="#1E40AF" fundo="#DBEAFE" title="Certificado da plataforma; quem assinou está no log anexado ao PDF">Selo da plataforma (não identifica o signatário)</Tag>}
                        {s.documento && !/clicksign/i.test(s.nome || '') && <span style={mono}>{s.documento}</span>}
                        <Tag>{TIPO_CERT[s.tipo] || s.tipo}</Tag>
                        <Tag cor={cf.cor} fundo={cf.fundo}>{cf.rot}</Tag>
                        <span style={pequeno}>{s.emissor} · válido até {fmtD(s.validoAte)}</span>
                      </div>
                    );
                  })}
                  {(x.resultado?.erros || []).length > 0 && <div style={{ fontSize: 11, color: '#A32D2D', marginTop: 4 }}>{x.resultado.erros.join(' · ')}</div>}
                  {x.resultado?.metodo && <div style={{ ...pequeno, marginTop: 4, fontStyle: 'italic' }}>{x.resultado.metodo}</div>}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {aba === 'registro' && (
        <div style={painel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
            <div style={pequeno}>{inst.requerRegistro ? `Registro previsto: ${inst.orgaoRegistro || 'a definir'}.` : 'Este instrumento não exige registro.'}</div>
            {master && inst.requerRegistro && ['APROVADO', 'ASSINADO'].includes(inst.situacao) && <button style={botaoPri} onClick={() => abrir({ tipo: 'registro' })}>Informar registro</button>}
          </div>
          {det.registros.length === 0 ? <div style={pequeno}>Nenhum registro informado.</div> : det.registros.map((r: any) => (
            <div key={r.id} style={{ borderTop: '1px solid #F3F4F6', padding: '8px 0', opacity: r.canceladoEm ? 0.55 : 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{r.orgao}</div>
              <div style={pequeno}>Protocolo {r.protocolo || '-'} · {fmtD(r.dataRegistro)} · informado em {fmtDH(r.criadoEm)}</div>
              {r.observacao && <div style={{ fontSize: 12, marginTop: 2 }}>{r.observacao}</div>}
              <div style={{ marginTop: 4 }}>
                {r.arquivoNome && <button style={linkBtn} onClick={() => baixar(`${base}/${inst.id}/registros/${r.id}/comprovante`, r.arquivoNome).catch((e) => toast.error(msgErro(e)))}>Comprovante ({String(r.sha256).slice(0, 12)})</button>}
                {' '}{encerrarBtn('registros', r, r.orgao)}
              </div>
              {r.canceladoEm && <div style={{ fontSize: 11, color: '#A32D2D' }}>Encerrado: {r.motivoCancelamento}</div>}
            </div>
          ))}
        </div>
      )}

      {aba === 'valores' && (
        <div style={painel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
            <div style={pequeno}>Os valores entre colchetes da minuta, com a origem no LEDGR. Ficam congelados na aprovação da versão final.</div>
            {master && ['RASCUNHO', 'EM_REVISAO'].includes(inst.situacao) && <button style={botaoPri} onClick={() => abrir({ tipo: 'valor' })}>Vincular valor</button>}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead><tr><th style={thSt}>Rótulo</th><th style={thSt}>Marcador</th><th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={thSt}>Origem</th><th style={thSt}>Congelado</th><th style={thSt}></th></tr></thead>
              <tbody>
                {det.valores.map((v: any) => (
                  <tr key={v.id} style={{ opacity: v.canceladoEm ? 0.55 : 1 }}>
                    <td style={tdSt}>{v.rotulo}{v.canceladoEm && <div style={{ fontSize: 11, color: '#A32D2D' }}>Encerrado: {v.motivoCancelamento}</div>}</td>
                    <td style={mono}>{v.marcador || '-'}</td>
                    <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtVal(v.valor, v.moeda)}</td>
                    <td style={tdSt}>{ORIGEM[v.origem] || v.origem}{v.origemRef?.descricao && <div style={pequeno}>{v.origemRef.descricao}</div>}{v.origemRef?.criterio && <div style={pequeno}>{v.origemRef.criterio} · {v.origemRef.qtd} registro(s)</div>}<div style={pequeno}>apurado em {fmtDH(v.apuradoEm)}</div></td>
                    <td style={tdSt}>{v.congeladoEm ? fmtDH(v.congeladoEm) : '-'}</td>
                    <td style={tdSt}>{!v.congeladoEm && encerrarBtn('valores', v, v.rotulo)}</td>
                  </tr>
                ))}
                {det.valores.length === 0 && <tr><td style={tdSt} colSpan={6}><span style={pequeno}>Nenhum valor vinculado.</span></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aba === 'dependencias' && (
        <div style={painel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
            <div style={pequeno}>O instrumento só segue para assinatura (ou vigência) quando as dependências atingem a situação exigida.</div>
            {master && ['RASCUNHO', 'EM_REVISAO', 'APROVADO'].includes(inst.situacao) && <button style={botaoPri} onClick={() => abrir({ tipo: 'dependencia' })}>Incluir dependência</button>}
          </div>
          <Label>Depende de</Label>
          {det.dependencias.length === 0 ? <div style={pequeno}>Nenhuma.</div> : det.dependencias.map((d: any) => (
            <div key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: '1px solid #F3F4F6', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{d.codigo}</span><span style={{ fontSize: 13 }}>{d.titulo}</span>
              <Chip s={d.situacao} /><span style={pequeno}>exige {SIT[d.exigeSituacao]?.rot || d.exigeSituacao}</span>
              <Tag cor={d.atendida ? '#166534' : '#92400E'} fundo={d.atendida ? '#DCFCE7' : '#FEF3C7'}>{d.atendida ? 'Atendida' : 'Pendente'}</Tag>
              {d.justificativa && <span style={pequeno}>{d.justificativa}</span>}
              {encerrarBtn('dependencias', d, `dependência de ${d.codigo}`)}
            </div>
          ))}
          <Label>É exigido por</Label>
          {det.dependentes.length === 0 ? <div style={pequeno}>Nenhum.</div> : det.dependentes.map((d: any) => (
            <div key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: '1px solid #F3F4F6', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{d.codigo}</span><span style={{ fontSize: 13 }}>{d.titulo}</span><Chip s={d.situacao} />
            </div>
          ))}
        </div>
      )}

      {aba === 'trilha' && (
        <div style={painel}>
          {!encerrado && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-start' }}>
              <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} placeholder="Comentário para a trilha (fica registrado e não pode ser apagado)" style={{ ...inputSt, resize: 'vertical' }} />
              <button style={botaoPri} onClick={comentar} disabled={comentario.trim().length < 3}>Comentar</button>
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead><tr><th style={thSt}>#</th><th style={thSt}>Quando</th><th style={thSt}>Quem</th><th style={thSt}>Evento</th><th style={thSt}>Detalhe</th><th style={thSt}>Hash</th></tr></thead>
              <tbody>
                {[...det.eventos].reverse().map((e: any) => (
                  <tr key={e.seq}>
                    <td style={{ ...tdSt, fontWeight: 600 }}>{e.seq}</td>
                    <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>{fmtDH(e.criadoEm)}</td>
                    <td style={tdSt}>{e.por || '-'}</td>
                    <td style={tdSt}>{EVENTO[e.tipo] || e.tipo}</td>
                    <td style={tdSt}>{resumoEvento(e)}{e.motivo && <div style={pequeno}>Motivo: {e.motivo}</div>}</td>
                    <td style={mono} title={`hash ${e.hash}\nanterior ${e.hashAnterior}`}>{String(e.hash).slice(0, 12)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && modal.tipo === 'transitar' && (
        <Modal titulo={modal.acao.rot} subtitulo={`${inst.codigo} · ${SIT[inst.situacao]?.rot} → ${SIT[modal.acao.para]?.rot}`} onFechar={() => setModal(null)}
          onConfirmar={confirmar} rotulo="Confirmar" ocupado={ocupado} erro={erroM} perigo={modal.acao.tom === 'perigo'}>
          {modal.acao.dica && <div style={{ fontSize: 12, color: '#374151' }}>{modal.acao.dica}</div>}
          {modal.acao.precisa === 'versao' && (<>
            <Label>Versão final aprovada</Label>
            <select value={f.versaoId || ''} onChange={campo('versaoId')} style={inputSt}>
              <option value="">Escolha...</option>
              {versoesAtivas.filter((v: any) => v.tipo === 'FINAL').map((v: any) => <option key={v.id} value={v.id}>v{v.numero} · {v.arquivoNome} · {String(v.sha256).slice(0, 12)}</option>)}
            </select>
            {versoesAtivas.filter((v: any) => v.tipo === 'FINAL').length === 0 && <div style={{ ...pequeno, marginTop: 4 }}>Nenhuma versão Final enviada. Envie uma na aba Versões.</div>}
          </>)}
          {modal.acao.precisa === 'substituto' && (<>
            <Label>Instrumento substituto</Label>
            <select value={f.substitutoId || ''} onChange={campo('substitutoId')} style={inputSt}>
              <option value="">Escolha...</option>
              {outros.map((x: any) => <option key={x.id} value={x.id}>{x.codigo} · {x.titulo}</option>)}
            </select>
          </>)}
          <Label>{obrigaMotivo(inst.situacao, modal.acao.para) ? 'Motivo (obrigatório)' : 'Observação (opcional)'}</Label>
          <textarea value={f.motivo || ''} onChange={campo('motivo')} rows={3} style={{ ...inputSt, resize: 'vertical' }} />
        </Modal>
      )}

      {modal && modal.tipo === 'versao' && (
        <Modal titulo="Enviar versão" subtitulo={`${inst.codigo} · ${inst.titulo}`} onFechar={() => setModal(null)} onConfirmar={confirmar} rotulo="Enviar" ocupado={ocupado} erro={erroM}>
          <Label>Tipo</Label>
          {master ? (
            <select value={f.tipo || ''} onChange={campo('tipo')} style={inputSt}>
              {tiposV.map((t) => <option key={t} value={t}>{TIPO_VERSAO[t]}</option>)}
            </select>
          ) : <div style={{ fontSize: 13 }}>Revisão</div>}
          <Label>Revisa a versão (opcional)</Label>
          <select value={f.baseId || ''} onChange={campo('baseId')} style={inputSt}>
            <option value="">-</option>
            {versoesAtivas.map((v: any) => <option key={v.id} value={v.id}>v{v.numero} · {TIPO_VERSAO[v.tipo]} · {v.arquivoNome}</option>)}
          </select>
          <Label>{master ? 'Comentário (opcional)' : 'O que foi revisado (obrigatório)'}</Label>
          <textarea value={f.comentario || ''} onChange={campo('comentario')} rows={3} style={{ ...inputSt, resize: 'vertical' }} />
          <Label>Arquivo ({f.tipo === 'ASSINADA' ? 'PDF' : 'Word, ODT ou PDF'}; até 20 MB)</Label>
          <input type="file" accept={f.tipo === 'ASSINADA' ? '.pdf' : '.docx,.doc,.odt,.pdf'} onChange={(e) => setArq(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />
        </Modal>
      )}

      {modal && modal.tipo === 'parte' && (
        <Modal titulo="Incluir parte" subtitulo={`${inst.codigo} · ${inst.titulo}`} onFechar={() => setModal(null)} onConfirmar={confirmar} rotulo="Incluir" ocupado={ocupado} erro={erroM}>
          <Label>Nome ou razão social</Label><input value={f.nome || ''} onChange={campo('nome')} style={inputSt} />
          <Label>Papel</Label>
          <select value={f.papel || 'PARTE'} onChange={campo('papel')} style={inputSt}>{Object.keys(PAPEL).map((k) => <option key={k} value={k}>{PAPEL[k]}</option>)}</select>
          <Label>Documento (CPF, CNPJ, NIF ou NIPC; só números)</Label><input value={f.documento || ''} onChange={campo('documento')} style={inputSt} />
          <Label>E-mail</Label><input value={f.email || ''} onChange={campo('email')} style={inputSt} />
          <Label>Jurisdição</Label>
          <select value={f.jurisdicao || ''} onChange={campo('jurisdicao')} style={inputSt}>
            <option value="">A confirmar</option><option value="BR">Brasil</option><option value="PT">Portugal</option><option value="OUTRA">Outra</option>
          </select>
          <Label>Forma de assinatura</Label>
          <select value={f.forma || 'A_DEFINIR'} onChange={campo('forma')} style={inputSt}>{Object.keys(FORMA).map((k) => <option key={k} value={k}>{FORMA[k]}</option>)}</select>
          <Label>Observação</Label><input value={f.observacao || ''} onChange={campo('observacao')} style={inputSt} />
        </Modal>
      )}

      {modal && modal.tipo === 'registro' && (
        <Modal titulo="Informar registro" subtitulo={`${inst.codigo} · ${inst.titulo}`} onFechar={() => setModal(null)} onConfirmar={confirmar} rotulo="Gravar" ocupado={ocupado} erro={erroM}>
          <Label>Órgão</Label><input value={f.orgao || ''} onChange={campo('orgao')} style={inputSt} />
          <Label>Protocolo</Label><input value={f.protocolo || ''} onChange={campo('protocolo')} style={inputSt} />
          <Label>Data (dd/mm/aaaa)</Label>
          <input value={f.data || ''} onChange={(e) => { const v = mascaraData(e.target.value); setF((x) => ({ ...x, data: v })); }} placeholder="dd/mm/aaaa" style={{ ...inputSt, maxWidth: 160 }} />
          <Label>Observação</Label><input value={f.observacao || ''} onChange={campo('observacao')} style={inputSt} />
          <Label>Comprovante (PDF ou imagem; opcional)</Label>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setArq(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />
        </Modal>
      )}

      {modal && modal.tipo === 'valor' && (
        <Modal titulo="Vincular valor" subtitulo={`${inst.codigo} · ${inst.titulo}`} onFechar={() => setModal(null)} onConfirmar={confirmar} rotulo="Vincular" ocupado={ocupado} erro={erroM}>
          <Label>Fonte do valor</Label>
          <select value={f.fonte || ''} onChange={(e) => { const v = e.target.value; const fo = fontes.find((x: any) => x.codigo === v); setF((x) => ({ ...x, fonte: v, rotulo: fo ? fo.rotulo : (x.rotulo || '') })); }} style={inputSt}>
            <option value="">Manual (digitar o valor)</option>
            {fontes.map((fo: any) => <option key={fo.codigo} value={fo.codigo}>{fo.rotulo}</option>)}
          </select>
          {f.fonte && (() => {
            const fo = fontes.find((x: any) => x.codigo === f.fonte);
            return fo ? (
              <div style={{ marginTop: 8, background: '#F0FDF4', borderRadius: 6, padding: '8px 10px', fontSize: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{fmtVal(String(fo.valor), 'BRL')}</div>
                <div>{fo.criterio} · {fo.qtd} registro(s)</div>
                {fo.aviso && <div style={{ color: '#92400E' }}>Atenção: {fo.aviso}</div>}
                <div style={pequeno}>Prévia. O valor é recalculado no servidor ao gravar, com a lista dos registros que o compõem.</div>
              </div>
            ) : null;
          })()}
          <Label>Rótulo</Label><input value={f.rotulo || ''} onChange={campo('rotulo')} placeholder="Ex.: Aportes reconhecidos à VAL" style={inputSt} />
          <Label>Marcador na minuta</Label><input value={f.marcador || ''} onChange={campo('marcador')} placeholder="Ex.: R$ [3.445.475,82]" style={inputSt} />
          {!f.fonte && (<>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 2 }}><Label>Valor</Label><input value={f.valor || ''} onChange={campo('valor')} placeholder="3.445.475,82" style={inputSt} /></div>
            <div style={{ flex: 1 }}><Label>Moeda</Label>
              <select value={f.moeda || 'BRL'} onChange={campo('moeda')} style={inputSt}><option value="BRL">BRL</option><option value="EUR">EUR</option><option value="USD">USD</option></select>
            </div>
          </div>
          <Label>Origem</Label>
          <select value={f.origem || 'MANUAL'} onChange={campo('origem')} style={inputSt}>{Object.keys(ORIGEM).map((k) => <option key={k} value={k}>{ORIGEM[k]}</option>)}</select>
          <Label>Referência da origem</Label><input value={f.ref || ''} onChange={campo('ref')} placeholder="Ex.: Anexo I, 51 lançamentos vigentes em 10/10/2026" style={inputSt} />
          </>)}
        </Modal>
      )}

      {modal && modal.tipo === 'dependencia' && (
        <Modal titulo="Incluir dependência" subtitulo={`${inst.codigo} · ${inst.titulo}`} onFechar={() => setModal(null)} onConfirmar={confirmar} rotulo="Incluir" ocupado={ocupado} erro={erroM}>
          <Label>Depende de</Label>
          <select value={f.depId || ''} onChange={campo('depId')} style={inputSt}>
            <option value="">Escolha...</option>
            {outros.map((x: any) => <option key={x.id} value={x.id}>{x.codigo} · {x.titulo}</option>)}
          </select>
          <Label>Situação exigida</Label>
          <select value={f.exige || 'ASSINADO'} onChange={campo('exige')} style={inputSt}>
            {['APROVADO', 'ASSINADO', 'REGISTRADO', 'VIGENTE'].map((s) => <option key={s} value={s}>{SIT[s].rot}</option>)}
          </select>
          <Label>Justificativa</Label><input value={f.justificativa || ''} onChange={campo('justificativa')} style={inputSt} />
        </Modal>
      )}

      {modal && modal.tipo === 'clicksign' && (
        <Modal titulo="Enviar à ClickSign" subtitulo={`${inst.codigo} · ${inst.titulo}`} onFechar={() => setModal(null)} onConfirmar={confirmar} rotulo="Enviar" ocupado={ocupado} erro={erroM}>
          <div style={{ fontSize: 12, color: '#374151' }}>O PDF aprovado vai para a ClickSign e cada parte escolhida recebe o pedido por e-mail. Partes que assinam fora (Portugal ou à mão) ficam desmarcadas. Para cada parte, informe a pessoa que assina por ela (representante): nome completo e e-mail.</div>
          <Label>Partes que assinam pela ClickSign</Label>
          {det.partes.filter((p: any) => !p.canceladoEm).map((p: any) => (
            <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '6px 0', flexWrap: 'wrap' }}>
              <input type="checkbox" checked={f['sel_' + p.id] === '1'} onChange={(e) => { const v = e.target.checked ? '1' : ''; setF((x) => ({ ...x, ['sel_' + p.id]: v })); }} />
              <div style={{ minWidth: 180, flex: 1, fontSize: 13 }}>{p.nome}<div style={pequeno}>{PAPEL[p.papel] || p.papel} · {FORMA[p.formaAssinatura] || p.formaAssinatura}</div></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 260 }}>
                <input value={f['nome_' + p.id] || ''} onChange={campo('nome_' + p.id)} placeholder="nome completo de quem assina" style={inputSt} disabled={f['sel_' + p.id] !== '1'} />
                <input value={f['email_' + p.id] || ''} onChange={campo('email_' + p.id)} placeholder="e-mail de quem assina" style={inputSt} disabled={f['sel_' + p.id] !== '1'} />
              </div>
            </div>
          ))}
          <Label>Prazo (dias)</Label>
          <input value={f.prazo || ''} onChange={campo('prazo')} style={{ ...inputSt, maxWidth: 100 }} />
        </Modal>
      )}

      {modal && modal.tipo === 'cancelarEnvio' && (
        <Modal titulo="Cancelar envio" subtitulo={`${inst.codigo} · ClickSign`} onFechar={() => setModal(null)} onConfirmar={confirmar} rotulo="Cancelar envio" ocupado={ocupado} erro={erroM} perigo>
          <div style={{ fontSize: 12, color: '#374151' }}>O documento é cancelado na ClickSign e o envio fica registrado como cancelado na trilha.</div>
          <Label>Motivo (obrigatório)</Label>
          <textarea value={f.motivo || ''} onChange={campo('motivo')} rows={3} style={{ ...inputSt, resize: 'vertical' }} />
        </Modal>
      )}

      {modal && modal.tipo === 'encerrar' && (
        <Modal titulo="Encerrar" subtitulo={modal.rotulo} onFechar={() => setModal(null)} onConfirmar={confirmar} rotulo="Encerrar" ocupado={ocupado} erro={erroM} perigo>
          <div style={{ fontSize: 12, color: '#374151' }}>O registro continua visível, marcado como encerrado, e o encerramento entra na trilha.</div>
          <Label>Motivo (obrigatório)</Label>
          <textarea value={f.motivo || ''} onChange={campo('motivo')} rows={3} style={{ ...inputSt, resize: 'vertical' }} />
        </Modal>
      )}
    </div>
  );
}
