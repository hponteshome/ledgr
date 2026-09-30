// frontend/src/pages/documentos/DocumentTemplatesPage.tsx
// Templates > Documentos (30/09/2026): lista, duplicar, editar (no LEDGR ou pelo Word),
// pre-visualizar com um contrato real, historico de versoes, padrao e ativacao.
import React, { useEffect, useRef, useState } from 'react';
import {
  FiCopy, FiEdit2, FiFile, FiStar, FiToggleLeft, FiToggleRight, FiTrash2, FiX,
  FiUploadCloud, FiDownload, FiEye, FiAlertCircle,
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { SmartDateInput } from '../../components/SmartDateInput';

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';
const FIN = '#0F2A44';
const FIN_ACCENT = '#1D6FA5';
const FIN_LIGHT = '#EAF3FA';

const TIPO_LABEL: Record<string, string> = { CONTRATO_LOCACAO: 'Contrato de Locação' };

interface TemplateRow {
  id: string; type: string; name: string; description?: string | null;
  escopo: 'GLOBAL' | 'EMPRESA'; isActive: boolean; isDefault: boolean;
  version: number; updatedAt: string; documentosGerados: number;
}

const MARCADORES: { grupo: string; itens: [string, string][] }[] = [
  { grupo: 'Empresa (locadora)', itens: [
    ['{{empresa.legalName}}', 'Razão social'], ['{{empresa.taxId}}', 'CNPJ'],
    ['{{empresa.street}}', 'Logradouro'], ['{{empresa.number}}', 'Número'], ['{{empresa.complement}}', 'Complemento'],
    ['{{empresa.neighborhood}}', 'Bairro'], ['{{empresa.city}}', 'Cidade'], ['{{empresa.state}}', 'UF'], ['{{empresa.zipCode}}', 'CEP'],
  ] },
  { grupo: 'Locatário', itens: [
    ['{{contrato.tenantName}}', 'Nome'], ['{{contrato.tenantNationality}}', 'Nacionalidade'],
    ['{{contrato.tenantMaritalStatus}}', 'Estado civil (flexionado)'], ['{{contrato.tenantProfession}}', 'Profissão'],
    ['{{contrato.tenantRg}}', 'RG'], ['{{contrato.tenantTaxId}}', 'CPF/CNPJ'],
    ['{{contrato.tenantStreet}}', 'Logradouro'], ['{{contrato.tenantNumber}}', 'Número'], ['{{contrato.tenantComplement}}', 'Complemento'],
    ['{{contrato.tenantNeighborhood}}', 'Bairro'], ['{{contrato.tenantZipCode}}', 'CEP'], ['{{contrato.tenantCity}}', 'Cidade'], ['{{contrato.tenantState}}', 'UF'],
  ] },
  { grupo: 'Gênero do locatário', itens: [
    ['{{contrato.loc.TITULO}}', 'LOCATÁRIO / LOCATÁRIA'], ['{{contrato.loc.Titulo}}', 'Locatário / Locatária'],
    ['{{contrato.loc.o}}', 'o / a'], ['{{contrato.loc.O}}', 'O / A'], ['{{contrato.loc.ao}}', 'ao / à'], ['{{contrato.loc.do}}', 'do / da'],
    ['{{contrato.loc.pelo}}', 'pelo / pela'], ['{{contrato.loc.portador}}', 'portador / portadora'], ['{{contrato.loc.inscrito}}', 'inscrito / inscrita'],
    ['{{contrato.loc.domiciliado}}', 'residente e domiciliado(a)'], ['{{contrato.loc.denominado}}', 'denominado / denominada'],
  ] },
  { grupo: 'Imóvel', itens: [
    ['{{imovel.street}}', 'Logradouro'], ['{{imovel.number}}', 'Número'], ['{{imovel.complement}}', 'Complemento'],
    ['{{imovel.neighborhood}}', 'Bairro'], ['{{imovel.city}}', 'Cidade'], ['{{imovel.state}}', 'UF'], ['{{imovel.zipCode}}', 'CEP'],
    ['{{imovel.registryNumber}}', 'Matrícula'], ['{{imovel.registryOffice}}', 'Cartório'],
  ] },
  { grupo: 'Condições', itens: [
    ['{{contrato.prazoMeses}}', 'Prazo em meses'], ['{{contrato.startDate}}', 'Início'], ['{{contrato.endDate}}', 'Término'],
    ['{{contrato.rentAmount}}', 'Aluguel (R$)'], ['{{contrato.rentAmountExtenso}}', 'Aluguel por extenso'], ['{{contrato.dueDay}}', 'Dia do vencimento'],
    ['{{contrato.readjustmentIndex}}', 'Índice de reajuste'], ['{{contrato.readjustmentPeriodMonths}}', 'Periodicidade do reajuste'],
    ['{{contrato.penaltyDescription}}', 'Multa (texto do contrato)'], ['{{contrato.numeroVias}}', 'Número de vias'],
    ['{{contrato.dataAssinatura}}', 'Data do instrumento (por extenso)'],
  ] },
  { grupo: 'Garantia e fiador', itens: [
    ['{{contrato.guaranteeType}}', 'Modalidade da garantia'], ['{{contrato.guaranteeDescription}}', 'Detalhe da garantia'],
    ['{{contrato.fiadorNome}}', 'Nome do fiador (antes da 1ª vírgula)'],
    ['{{contrato.fia.TITULO}}', 'FIADOR / FIADORA'], ['{{contrato.fia.Titulo}}', 'Fiador / Fiadora'],
    ['{{contrato.fia.o}}', 'o / a'], ['{{contrato.fia.do}}', 'do / da'], ['{{contrato.fia.casado}}', 'casado / casada'],
  ] },
  { grupo: 'Blocos condicionais', itens: [
    ['{{#if contrato.isFianca}}', 'Início: só com fiança'], ['{{#if contrato.fiadorComConjuge}}', 'Início: só com cônjuge do fiador'],
    ['{{#if contrato.readjustmentIndex}}', 'Início: só com reajuste'], ['{{#if contrato.guaranteeType}}', 'Início: só com garantia'],
    ['{{#if contrato.temClausulasEspecificas}}', 'Início: só com disposições específicas'],
    ['{{#each contrato.clausulasEspecificas}}', 'Repete cada disposição ({{rotulo}} e {{texto}})'],
    ['{{else}}', 'Senão'], ['{{/if}}', 'Fim do bloco if'], ['{{/each}}', 'Fim do bloco each'],
  ] },
];

const inputSt: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, background: '#fff' };
const btnOutline: React.CSSProperties = { padding: '7px 14px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnPrimary: React.CSSProperties = { ...btnOutline, border: 'none', background: FIN_ACCENT, color: '#fff' };

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: 0.3 }}>{children}</label>
);

const ErrorBox: React.FC<{ msg: string }> = ({ msg }) => (
  <div style={{ background: '#FCEBEB', color: '#A32D2D', border: '1px solid #F5C2C2', borderRadius: 8, padding: '8px 12px', fontSize: 12, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
    <FiAlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} /> <span>{msg}</span>
  </div>
);

const ModalShell: React.FC<{
  title: string; subtitle?: string; onClose: () => void; width?: number | string; height?: number | string;
  footer?: React.ReactNode; children: React.ReactNode;
}> = ({ title, subtitle, onClose, width = 560, height, footer, children }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
    <div style={{ background: '#fff', borderRadius: 14, width, maxWidth: '96vw', height, maxHeight: '94vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
      <div style={{ background: FIN, color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{subtitle}</div>}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }} title="Fechar"><FiX size={18} /></button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{children}</div>
      {footer && (
        <div style={{ background: '#FAFAFA', borderTop: '1px solid #EEE', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>{footer}</div>
      )}
    </div>
  </div>
);

function authHeaders(json = false): Record<string, string> {
  const token = localStorage.getItem('@ledgr:token');
  const company = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
  const h: Record<string, string> = { Authorization: 'Bearer ' + token, 'x-company-id': company.id ?? '' };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

function msgErro(e: any): string {
  if (Array.isArray(e?.message)) return e.message.join('; ');
  return e?.message ?? 'Erro na operação.';
}

async function apiJson(path: string, init?: RequestInit) {
  const res = await fetch(API + path, init);
  if (!res.ok) {
    const e = await res.json().catch(() => null);
    throw new Error(msgErro(e));
  }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

async function baixarWord(id: string, fallback: string) {
  try {
    const res = await fetch(`${API}/document-templates/${id}/docx`, { headers: authHeaders() });
    if (!res.ok) throw new Error();
    const disp = res.headers.get('Content-Disposition') ?? '';
    const m = disp.match(/filename="([^"]+)"/);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await res.blob());
    a.download = m ? m[1] : fallback;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  } catch {
    toast.error('Não foi possível gerar o arquivo Word do template.');
  }
}

// ── Duplicar ───────────────────────────────────────────────
const DuplicateModal: React.FC<{ src: TemplateRow; onClose: () => void; onDone: (id: string) => void }> = ({ src, onClose, onDone }) => {
  const [name, setName] = useState(`${src.name} (cópia)`);
  const [description, setDescription] = useState(src.description ?? '');
  const [escopo, setEscopo] = useState<'GLOBAL' | 'EMPRESA'>('EMPRESA');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const salvar = async () => {
    setSaving(true); setErr('');
    try {
      const novo = await apiJson(`/document-templates/${src.id}/duplicate`, {
        method: 'POST', headers: authHeaders(true), body: JSON.stringify({ name, description, escopo }),
      });
      toast.success('Template criado.');
      onDone(novo.id);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Novo template" subtitle={`A partir de "${src.name}" v${src.version}`} onClose={onClose} width={520}
      footer={<>
        <button style={btnOutline} onClick={onClose}>Cancelar</button>
        <button style={{ ...btnPrimary, opacity: saving || !name.trim() ? 0.5 : 1 }} disabled={saving || !name.trim()} onClick={salvar}>
          {saving ? 'Criando...' : 'Criar e editar'}
        </button>
      </>}>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ borderLeft: `3px solid ${FIN_ACCENT}`, paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><Label>Nome</Label><input style={inputSt} value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Descrição</Label><textarea style={{ ...inputSt, minHeight: 60 }} value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div>
            <Label>Abrangência</Label>
            <select style={inputSt} value={escopo} onChange={e => setEscopo(e.target.value as any)}>
              <option value="EMPRESA">Só da empresa ativa</option>
              <option value="GLOBAL">Global (todas as empresas)</option>
            </select>
          </div>
        </div>
        {err && <ErrorBox msg={err} />}
      </div>
    </ModalShell>
  );
};

// ── Editor ─────────────────────────────────────────────────
const TemplateEditor: React.FC<{ id: string; onClose: () => void; onSaved: () => void }> = ({ id, onClose, onSaved }) => {
  const [tpl, setTpl] = useState<any>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [original, setOriginal] = useState('');
  const [aba, setAba] = useState<'preview' | 'marcadores' | 'historico'>('preview');
  const [contratos, setContratos] = useState<any[]>([]);
  const [contratoId, setContratoId] = useState('');
  const [dataInst, setDataInst] = useState(new Date().toISOString().slice(0, 10));
  const [pdfUrl, setPdfUrl] = useState('');
  const [previewed, setPreviewed] = useState<string | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const carregar = () =>
    apiJson(`/document-templates/${id}`, { headers: authHeaders() })
      .then(t => { setTpl(t); setName(t.name); setDescription(t.description ?? ''); setContent(t.content); setOriginal(t.content); })
      .catch(e => setErr(e.message));

  useEffect(() => {
    carregar();
    apiJson('/rental-contracts', { headers: authHeaders() })
      .then(l => { const arr = Array.isArray(l) ? l : []; setContratos(arr); if (arr[0]) setContratoId(arr[0].id); })
      .catch(() => setContratos([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const textoMudou = content !== original;
  const algoMudou = !!tpl && (textoMudou || name !== tpl.name || description !== (tpl.description ?? ''));
  const precisaPreview = textoMudou && previewed !== content;
  const podeSalvar = !!tpl && !busy && algoMudou && name.trim() !== '' && confirmado && !precisaPreview;

  const fechar = () => {
    if (algoMudou && !window.confirm('Há alterações não salvas. Descartar?')) return;
    onClose();
  };

  const preVisualizar = async () => {
    if (!contratoId) { setErr('Selecione um contrato para a pré-visualização.'); return; }
    setBusy('preview'); setErr('');
    try {
      const res = await fetch(`${API}/rental-contracts/${contratoId}/preview-template`, {
        method: 'POST', headers: authHeaders(true), body: JSON.stringify({ content, dataInstrumento: dataInst }),
      });
      if (!res.ok) { const e = await res.json().catch(() => null); throw new Error(msgErro(e)); }
      const blob = await res.blob();
      setPdfUrl(prev => {
        if (prev) URL.revokeObjectURL(prev.split('#')[0]);
        return URL.createObjectURL(blob) + '#navpanes=0&view=FitH';
      });
      setPreviewed(content);
      setAba('preview');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  };

  const importarWord = async (file: File) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!window.confirm('Substituir o texto do editor pelo conteúdo deste arquivo Word? Nada é salvo até você clicar em "Salvar nova versão".')) return;
    setBusy('import'); setErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API}/document-templates/${id}/import-docx`, { method: 'POST', headers: authHeaders(), body: fd });
      if (!res.ok) { const e = await res.json().catch(() => null); throw new Error(msgErro(e)); }
      const { content: novo } = await res.json();
      setContent(novo);
      setPreviewed(null);
      setConfirmado(false);
      toast.success('Texto importado do Word. Pré-visualize antes de salvar.');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  };

  const salvar = async () => {
    setBusy('save'); setErr('');
    try {
      await apiJson(`/document-templates/${id}`, {
        method: 'PUT', headers: authHeaders(true),
        body: JSON.stringify({ name, description, content, changeNote }),
      });
      toast.success(textoMudou ? 'Nova versão do template salva.' : 'Template atualizado.');
      setChangeNote(''); setConfirmado(false); setPreviewed(null);
      await carregar();
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  };

  const copiar = (m: string) => {
    navigator.clipboard?.writeText(m).then(() => toast.success(`Copiado: ${m}`)).catch(() => toast.error('Não foi possível copiar.'));
  };

  const abaSt = (a: string): React.CSSProperties => ({
    padding: '8px 14px', fontSize: 13, cursor: 'pointer', border: 'none', background: 'none',
    borderBottom: aba === a ? `2px solid ${FIN_ACCENT}` : '2px solid transparent', color: aba === a ? FIN_ACCENT : '#6B7280', fontWeight: aba === a ? 600 : 400,
  });

  return (
    <ModalShell
      title="Editar template"
      subtitle={tpl ? `${tpl.name} - v${tpl.version} - ${tpl.escopo === 'EMPRESA' ? 'da empresa' : 'global'}${tpl.isDefault ? ' - padrão' : ''}` : 'Carregando...'}
      onClose={fechar} width="96vw" height="92vh"
      footer={<>
        <input style={{ ...inputSt, flex: 1, maxWidth: 420 }} placeholder="Nota da alteração (opcional, vai para o histórico)"
          value={changeNote} onChange={e => setChangeNote(e.target.value)} />
        <label style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
          <input type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} />
          Revisei a pré-visualização desta versão
        </label>
        <button style={btnOutline} onClick={fechar}>Cancelar</button>
        <button style={{ ...btnPrimary, opacity: podeSalvar ? 1 : 0.5 }} disabled={!podeSalvar} onClick={salvar}
          title={precisaPreview ? 'Pré-visualize o texto atual antes de salvar' : ''}>
          {busy === 'save' ? 'Salvando...' : textoMudou ? 'Salvar nova versão' : 'Salvar'}
        </button>
      </>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, padding: 16, height: '100%', boxSizing: 'border-box' }}>
        {/* Esquerda: dados e texto */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <div style={{ borderLeft: `3px solid ${FIN_ACCENT}`, paddingLeft: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><Label>Nome</Label><input style={inputSt} value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label>Descrição</Label><input style={inputSt} value={description} onChange={e => setDescription(e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button style={btnOutline} onClick={() => { if (textoMudou) toast('O Word baixado é o da última versão salva.'); baixarWord(id, 'template.docx'); }}>
              <FiDownload size={13} /> Baixar Word
            </button>
            <button style={btnOutline} disabled={busy === 'import'} onClick={() => fileRef.current?.click()}>
              <FiUploadCloud size={13} /> {busy === 'import' ? 'Importando...' : 'Importar Word'}
            </button>
            <input ref={fileRef} type="file" accept=".docx" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) importarWord(f); }} />
            {textoMudou && <span style={{ fontSize: 12, color: '#B45309' }}>Texto alterado{precisaPreview ? ' - pré-visualize antes de salvar' : ' - pré-visualizado'}</span>}
          </div>
          <textarea
            style={{ ...inputSt, flex: 1, minHeight: 0, fontFamily: 'Consolas, monospace', fontSize: 12, lineHeight: 1.5, resize: 'none', whiteSpace: 'pre' }}
            spellCheck={false} value={content}
            onChange={e => { setContent(e.target.value); setConfirmado(false); }} />
          {err && <ErrorBox msg={err} />}
        </div>

        {/* Direita: pre-visualizacao, marcadores, historico */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', background: FIN_LIGHT }}>
            <button style={abaSt('preview')} onClick={() => setAba('preview')}>Pré-visualização</button>
            <button style={abaSt('marcadores')} onClick={() => setAba('marcadores')}>Marcadores</button>
            <button style={abaSt('historico')} onClick={() => setAba('historico')}>Histórico</button>
          </div>

          {aba === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px auto', gap: 8, padding: 10, alignItems: 'end', borderBottom: '1px solid #F3F4F6' }}>
                <div>
                  <Label>Contrato de exemplo</Label>
                  <select style={inputSt} value={contratoId} onChange={e => setContratoId(e.target.value)}>
                    {contratos.length === 0 && <option value="">Nenhum contrato nesta empresa</option>}
                    {contratos.map(c => (
                      <option key={c.id} value={c.id}>{(c.fixedAsset?.internalCode ?? '') + ' - ' + (c.tenantName ?? '')}</option>
                    ))}
                  </select>
                </div>
                <div><Label>Data do instrumento</Label><SmartDateInput className="w-full" value={dataInst} onChange={(v: string) => setDataInst(v)} /></div>
                <button style={{ ...btnPrimary, opacity: busy === 'preview' ? 0.5 : 1 }} disabled={busy === 'preview'} onClick={preVisualizar}>
                  <FiEye size={13} /> {busy === 'preview' ? 'Gerando...' : 'Pré-visualizar'}
                </button>
              </div>
              {pdfUrl
                ? <iframe title="Pré-visualização" src={pdfUrl} style={{ flex: 1, border: 'none', minHeight: 0 }} />
                : <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13, padding: 20, textAlign: 'center' }}>
                    Escolha um contrato e clique em Pré-visualizar para ver o PDF com o texto do editor.
                  </div>}
            </div>
          )}

          {aba === 'marcadores' && (
            <div style={{ overflow: 'auto', padding: 12, fontSize: 12 }}>
              <div style={{ color: '#6B7280', marginBottom: 8 }}>Clique num marcador para copiá-lo.</div>
              {MARCADORES.map(g => (
                <div key={g.grupo} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, color: FIN, marginBottom: 4 }}>{g.grupo}</div>
                  {g.itens.map(([m, d]) => (
                    <div key={m} onClick={() => copiar(m)} title="Copiar"
                      style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 6px', borderRadius: 4, cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = FIN_LIGHT)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <code style={{ color: FIN_ACCENT }}>{m}</code><span style={{ color: '#6B7280', textAlign: 'right' }}>{d}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {aba === 'historico' && (
            <div style={{ overflow: 'auto', padding: 12, fontSize: 12 }}>
              {(tpl?.versions ?? []).length === 0 && <div style={{ color: '#9CA3AF' }}>Sem versões registradas.</div>}
              {(tpl?.versions ?? []).map((v: any) => (
                <div key={v.version} style={{ padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ fontWeight: 600 }}>v{v.version} <span style={{ fontWeight: 400, color: '#6B7280' }}>- {new Date(v.createdAt).toLocaleString('pt-BR')}</span></div>
                  {v.changeNote && <div style={{ color: '#374151', marginTop: 2 }}>{v.changeNote}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
};

// ── Pagina ─────────────────────────────────────────────────
export const DocumentTemplatesPage: React.FC = () => {
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dupSrc, setDupSrc] = useState<TemplateRow | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const load = () => {
    setLoading(true); setError('');
    apiJson('/document-templates', { headers: authHeaders() })
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const acao = async (fn: () => Promise<any>, ok: string) => {
    try { await fn(); toast.success(ok); load(); } catch (e: any) { toast.error(e.message); }
  };

  const iconBtn: React.CSSProperties = { padding: 6, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#6B7280' };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-medium text-gray-900">Templates de Documentos</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">
          Modelos usados para gerar documentos (ex: Contrato de Locação). Duplique um template para criar variações, edite no LEDGR ou pelo Word e escolha o template na hora de gerar o documento.
        </p>
      </div>

      {error && <ErrorBox msg={error} />}

      {loading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Carregando...</div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">Nenhum template encontrado.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase text-gray-500 border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-2">Template</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Abrangência</th>
                <th className="px-3 py-2">Versão</th>
                <th className="px-3 py-2">Situação</th>
                <th className="px-3 py-2">Documentos</th>
                <th className="px-3 py-2">Atualizado</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900 flex items-center gap-1.5">
                      {r.name}
                      {r.isDefault && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">PADRÃO</span>}
                    </div>
                    {r.description && <div className="text-[11px] text-gray-500">{r.description}</div>}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{TIPO_LABEL[r.type] ?? r.type}</td>
                  <td className="px-3 py-2 text-gray-700">{r.escopo === 'EMPRESA' ? 'Empresa' : 'Global'}</td>
                  <td className="px-3 py-2 text-gray-700">v{r.version}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${r.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {r.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{r.documentosGerados}</td>
                  <td className="px-3 py-2 text-gray-500 text-[12px]">{new Date(r.updatedAt).toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button style={iconBtn} title="Editar" onClick={() => setEditId(r.id)}><FiEdit2 size={14} /></button>
                    <button style={iconBtn} title="Duplicar (novo template)" onClick={() => setDupSrc(r)}><FiCopy size={14} /></button>
                    <button style={iconBtn} title="Baixar Word" onClick={() => baixarWord(r.id, 'template.docx')}><FiFile size={14} /></button>
                    {!r.isDefault && r.isActive && (
                      <button style={iconBtn} title="Definir como padrão"
                        onClick={() => window.confirm(`Definir "${r.name}" como template padrão (${r.escopo === 'EMPRESA' ? 'da empresa' : 'global'})?`)
                          && acao(() => apiJson(`/document-templates/${r.id}/default`, { method: 'PATCH', headers: authHeaders() }), 'Template padrão definido.')}>
                        <FiStar size={14} />
                      </button>
                    )}
                    <button style={iconBtn} title={r.isActive ? 'Desativar' : 'Ativar'}
                      onClick={() => acao(() => apiJson(`/document-templates/${r.id}/active`, {
                        method: 'PATCH', headers: authHeaders(true), body: JSON.stringify({ active: !r.isActive }),
                      }), r.isActive ? 'Template desativado.' : 'Template ativado.')}>
                      {r.isActive ? <FiToggleRight size={16} /> : <FiToggleLeft size={16} />}
                    </button>
                    {!r.isDefault && r.documentosGerados === 0 && (
                      <button style={{ ...iconBtn, color: '#B91C1C' }} title="Excluir"
                        onClick={() => window.confirm(`Excluir o template "${r.name}"?`)
                          && acao(() => apiJson(`/document-templates/${r.id}`, { method: 'DELETE', headers: authHeaders() }), 'Template excluído.')}>
                        <FiTrash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dupSrc && (
        <DuplicateModal src={dupSrc} onClose={() => setDupSrc(null)}
          onDone={id => { setDupSrc(null); load(); setEditId(id); }} />
      )}
      {editId && <TemplateEditor id={editId} onClose={() => setEditId(null)} onSaved={load} />}
    </div>
  );
};
