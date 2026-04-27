// src/pages/companies/corporate/atas/age/AgeEdit.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    FiArrowLeft, FiSave, FiPlus, FiTrash2,
    FiFileText, FiEye, FiSearch, FiUser, FiX,
} from 'react-icons/fi';
import api from '@/services/api';
import { DocumentStylePicker, DOC_STYLES, RenderDocument } from '@/components/DocumentStylePicker';
import { useCompany } from '@/contexts/CompanyContext';

// ── Constantes ────────────────────────────────────────────────
const DELIBERACOES_OPTIONS = [
    { value: 'transformacao', label: 'Transformação do tipo societário' },
    { value: 'fusao', label: 'Fusão de sociedades' },
    { value: 'cisao', label: 'Cisão (total ou parcial)' },
    { value: 'alteracao_capital', label: 'Alteração do capital social' },
    { value: 'eleicao_diretores', label: 'Eleição / posse de diretores' },
    { value: 'aprovacao_contas', label: 'Aprovação de contas / balanço' },
    { value: 'alteracao_estatuto', label: 'Alteração do estatuto social' },
    { value: 'outros', label: 'Outros assuntos' },
];

const STATUS_OPTIONS = [
    { value: 'RASCUNHO', label: 'Rascunho' },
    { value: 'EM_REVISAO', label: 'Em Revisão' },
    { value: 'AGUARDANDO_ASSINATURA', label: 'Aguardando Assinatura' },
    { value: 'ASSINADO', label: 'Assinado' },
    { value: 'REGISTRADO', label: 'Registrado (JUCESP/Cartório)' },
    { value: 'ARQUIVADO', label: 'Arquivado' },
];

const CONVOCACAO_OPTIONS = [
    { value: 'unanimidade', label: 'Dispensa por unanimidade' },
    { value: 'carta', label: 'Carta / comunicação direta' },
    { value: 'edital', label: 'Edital (Diário Oficial / jornal)' },
    { value: 'email', label: 'Correio eletrônico (e-mail)' },
];

const CONVOCACAO_TEXTO: Record<string, string> = {
    unanimidade: 'A presente Assembleia dispensa formalidades de convocação, tendo em vista a presença da totalidade dos sócios, que a ela comparecem de forma unânime.',
    carta: 'Assembleia convocada por carta/comunicação direta enviada a todos os sócios com a antecedência legal.',
    edital: 'Assembleia convocada por edital publicado no Diário Oficial e em jornal de grande circulação, nos termos do art. 124 da Lei nº 6.404/76.',
    email: 'Assembleia convocada por correio eletrônico enviado a todos os sócios/acionistas, com confirmação de recebimento.',
};

// ── Tipos ─────────────────────────────────────────────────────
interface MembroMesa {
    cargo: string;
    personId?: string;
    cpf: string;
    nome: string;
}

interface Participante {
    id: string;
    personId?: string;
    cpf: string;
    nome: string;
    tipo: 'ACIONISTA' | 'PROCURADOR' | 'REPRESENTANTE';
}

interface ItemOrdemDia {
    id: string;
    texto: string;
}

interface FormData {
    title: string;
    date: string;
    hora: string;
    local: string;
    status: string;
    membrosMesa: MembroMesa[];
    participantes: Participante[];
    quorum: string;
    convocacao: string;
    itensPautaLivre: ItemOrdemDia[];
    deliberacoes: string[];
    textoDeliberacoes: string;
    cidade: string;
    bookNumber: string;
    changeNote: string;
    numerarSecoes: boolean;
}

const MEMBRO_VAZIO: MembroMesa = { cargo: '', personId: undefined, cpf: '', nome: '' };

const EMPTY: FormData = {
    title: '',
    date: '',
    hora: '',
    local: 'Sede da Sociedade',
    status: 'RASCUNHO',
    membrosMesa: [
        { cargo: 'Presidente', personId: undefined, cpf: '', nome: '' },
        { cargo: 'Secretário(a)', personId: undefined, cpf: '', nome: '' },
    ],
    participantes: [],
    quorum: '100% do capital social',
    convocacao: 'unanimidade',
    itensPautaLivre: [],
    deliberacoes: ['transformacao'],
    textoDeliberacoes: '',
    cidade: 'São Paulo',
    bookNumber: '',
    changeNote: '',
    numerarSecoes: true,
    styleId: 'minimalista',
};

// ── Formatadores ──────────────────────────────────────────────
function formatarData(dateStr: string): string {
    if (!dateStr) return '_____ de __________ de ______';
    const [y, m, d] = dateStr.split('-');
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    return `${parseInt(d)} de ${meses[parseInt(m) - 1]} de ${y}`;
}

function formatarCpf(v: string): string {
    return v.replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
        .slice(0, 14);
}

// ── Gerador de texto da ata ───────────────────────────────────
function gerarTextoAta(form: FormData, companyName: string): string {
    const L: string[] = [];
    const n = form.numerarSecoes;
    let seq = 0;
    const label = (text: string) => n ? `${++seq}. ${text}` : text;

    // NOTA: título e nome da empresa NÃO são inseridos aqui —
    // já aparecem no cabeçalho (StyleHeader) via props companyName/docTitle.

    const horaFmt = form.hora ? `, às ${form.hora}h` : '';
    L.push(label(`DATA, HORA E LOCAL: Aos ${formatarData(form.date)}${horaFmt}, na ${form.local || '[local]'}.`));
    L.push('');

    L.push(label(`CONVOCAÇÃO: ${CONVOCACAO_TEXTO[form.convocacao] ?? ''}`));
    L.push('');

    L.push(label(`PRESENÇA: ${form.quorum || '[quórum]'}.`));
    L.push('');

    const membrosFiltrados = form.membrosMesa.filter(m => m.nome.trim());
    if (membrosFiltrados.length > 0) {
        L.push(label(`MESA: ${membrosFiltrados.map(m => `${m.cargo}: ${m.nome}`).join('; ')}.`));
        L.push('');
    }

    const itensPauta = form.itensPautaLivre.map(i => i.texto).filter(Boolean);
    if (itensPauta.length > 0) {
        const itensStr = itensPauta.map((item, idx) => `${idx + 1}. ${item}`).join('; ');
        L.push(label(`ORDEM DO DIA: ${itensStr}.`));
        L.push('');
    }

    if (form.textoDeliberacoes.trim()) {
        L.push(label('DELIBERAÇÕES:'));
        L.push('');
        form.textoDeliberacoes.split('\n').forEach(l => L.push(l));
        L.push('');
    }

    L.push(label('ENCERRAMENTO: Nada mais havendo a tratar, lavrou-se a presente ata que, lida e achada conforme, vai assinada por todos.'));
    L.push('');
    L.push(`-> ${form.cidade || 'São Paulo'}, ${formatarData(form.date)}. <-`);
    L.push('');

    if (membrosFiltrados.length >= 2) {
        L.push(`||4> ${membrosFiltrados.map(m => `${m.nome} (${m.cargo})`).join(' | ')} <4||`);
    } else if (membrosFiltrados.length === 1) {
        L.push(`-> ${membrosFiltrados[0].nome} (${membrosFiltrados[0].cargo}) <-`);
    }

    return L.join('\n');
}

// ── UI helpers ────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">{title}</h2>
            <div className="space-y-4">{children}</div>
        </div>
    );
}

// ── Busca de pessoa por CPF — Mesa Diretora ───────────────────
interface CpfLookupProps {
    idx: number;
    membro: MembroMesa;
    onChange: (idx: number, updates: Partial<MembroMesa>) => void;
    onRemove: (idx: number) => void;
    canRemove: boolean;
}

function CpfLookup({ idx, membro, onChange, onRemove, canRemove }: CpfLookupProps) {
    const [searching, setSearching] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout>>();

    const buscarPorCpf = async (cpf: string) => {
        setSearching(true);
        setNotFound(false);
        try {
            const { data } = await api.get(`/persons/cpf/${cpf.replace(/\D/g, '')}`);
            onChange(idx, { personId: data.id, nome: data.fullName });
        } catch {
            setNotFound(true);
        } finally {
            setSearching(false);
        }
    };

    const handleCpfChange = (raw: string) => {
        const formatted = formatarCpf(raw);
        onChange(idx, { cpf: formatted, personId: undefined });
        setNotFound(false);
        if (formatted.length === 14) {
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => buscarPorCpf(formatted), 400);
        }
    };

    return (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2">
            {/* Cargo — linha própria */}
            <div className="flex items-center gap-2">
                <input type="text" value={membro.cargo}
                    onChange={e => onChange(idx, { cargo: e.target.value })}
                    placeholder="Cargo (ex: Presidente)"
                    className={inputCls + ' flex-1 bg-white font-medium'} />
                {canRemove && (
                    <button onClick={() => onRemove(idx)}
                        className="p-1.5 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                        <FiTrash2 size={14} />
                    </button>
                )}
            </div>

            {/* CPF + Nome — mesma linha */}
            <div className="flex gap-2 items-center">
                <div className="relative w-44 flex-shrink-0">
                    <input type="text" value={membro.cpf}
                        onChange={e => handleCpfChange(e.target.value)}
                        placeholder="000.000.000-00"
                        maxLength={14}
                        className={inputCls + ' bg-white pr-8'} />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                        {searching
                            ? <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                            : membro.personId
                                ? <FiUser size={13} className="text-green-500" />
                                : <FiSearch size={13} />}
                    </span>
                </div>

                <input type="text" value={membro.nome}
                    onChange={e => onChange(idx, { nome: e.target.value, personId: undefined })}
                    placeholder="Nome completo"
                    readOnly={!!membro.personId}
                    className={inputCls + ` flex-1 ${membro.personId ? 'bg-gray-100 text-gray-600 cursor-default' : 'bg-white'}`} />

                {membro.personId && (
                    <button onClick={() => onChange(idx, { personId: undefined, nome: '', cpf: '' })}
                        title="Desvincular"
                        className="p-1.5 text-gray-300 hover:text-orange-400 transition-colors flex-shrink-0">
                        <FiX size={14} />
                    </button>
                )}
            </div>

            {membro.personId && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded px-2 py-1 w-fit flex items-center gap-1.5">
                    <FiUser size={11} /> Vinculado ao cadastro · CPF {membro.cpf}
                </p>
            )}
            {notFound && (
                <div className="flex items-center gap-3 text-xs bg-amber-50 border border-amber-100 rounded px-3 py-2">
                    <span className="text-amber-700">CPF não encontrado no cadastro.</span>
                    <button onClick={() => setNotFound(false)}
                        className="text-amber-600 underline hover:text-amber-800">
                        Preencher manualmente
                    </button>
                    <a href="/app/persons/new" target="_blank" rel="noreferrer"
                        className="text-blue-600 underline hover:text-blue-800">
                        Cadastrar pessoa
                    </a>
                </div>
            )}
        </div>
    );
}

// ── Busca de participante (Presença) ──────────────────────────
const TIPO_PARTICIPANTE_OPTIONS = [
    { value: 'ACIONISTA', label: 'Acionista' },
    { value: 'PROCURADOR', label: 'Procurador' },
    { value: 'REPRESENTANTE', label: 'Representante' },
];

interface ParticipanteLookupProps {
    idx: number;
    p: Participante;
    onChange: (idx: number, updates: Partial<Participante>) => void;
    onRemove: (idx: number) => void;
}

function ParticipanteLookup({ idx, p, onChange, onRemove }: ParticipanteLookupProps) {
    const [searching, setSearching] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout>>();

    const buscarPorCpf = async (cpf: string) => {
        setSearching(true);
        setNotFound(false);
        try {
            const { data } = await api.get(`/persons/cpf/${cpf.replace(/\D/g, '')}`);
            onChange(idx, { personId: data.id, nome: data.fullName });
        } catch {
            setNotFound(true);
        } finally {
            setSearching(false);
        }
    };

    const handleCpfChange = (raw: string) => {
        const formatted = formatarCpf(raw);
        onChange(idx, { cpf: formatted, personId: undefined });
        setNotFound(false);
        if (formatted.length === 14) {
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => buscarPorCpf(formatted), 400);
        }
    };

    return (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2">
            {/* Tipo — linha própria */}
            <div className="flex items-center gap-2">
                <select value={p.tipo} onChange={e => onChange(idx, { tipo: e.target.value as Participante['tipo'] })}
                    className={inputCls + ' w-48 flex-shrink-0 bg-white font-medium'}>
                    {TIPO_PARTICIPANTE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
                <button onClick={() => onRemove(idx)}
                    className="p-1.5 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 ml-auto">
                    <FiTrash2 size={14} />
                </button>
            </div>

            {/* CPF + Nome — mesma linha */}
            <div className="flex gap-2 items-center">
                <div className="relative w-44 flex-shrink-0">
                    <input type="text" value={p.cpf}
                        onChange={e => handleCpfChange(e.target.value)}
                        placeholder="000.000.000-00"
                        maxLength={14}
                        className={inputCls + ' bg-white pr-8'} />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                        {searching
                            ? <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                            : p.personId
                                ? <FiUser size={13} className="text-green-500" />
                                : <FiSearch size={13} />}
                    </span>
                </div>

                <input type="text" value={p.nome}
                    onChange={e => onChange(idx, { nome: e.target.value, personId: undefined })}
                    placeholder="Nome completo"
                    readOnly={!!p.personId}
                    className={inputCls + ` flex-1 ${p.personId ? 'bg-gray-100 text-gray-600 cursor-default' : 'bg-white'}`} />

                {p.personId && (
                    <button onClick={() => onChange(idx, { personId: undefined, nome: '', cpf: '' })}
                        title="Desvincular"
                        className="p-1.5 text-gray-300 hover:text-orange-400 transition-colors flex-shrink-0">
                        <FiX size={14} />
                    </button>
                )}
            </div>

            {p.personId && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded px-2 py-1 w-fit flex items-center gap-1.5">
                    <FiUser size={11} /> Vinculado ao cadastro · CPF {p.cpf}
                </p>
            )}
            {notFound && (
                <div className="flex items-center gap-3 text-xs bg-amber-50 border border-amber-100 rounded px-3 py-2">
                    <span className="text-amber-700">CPF não encontrado no cadastro.</span>
                    <button onClick={() => setNotFound(false)}
                        className="text-amber-600 underline hover:text-amber-800">
                        Preencher manualmente
                    </button>
                    <a href="/app/persons/new" target="_blank" rel="noreferrer"
                        className="text-blue-600 underline hover:text-blue-800">
                        Cadastrar pessoa
                    </a>
                </div>
            )}
        </div>
    );
}

// ── Componente principal ──────────────────────────────────────
export const AgeEdit: React.FC = () => {
    const { id, docId } = useParams<{ id: string; docId?: string }>();
    const navigate = useNavigate();
    const { activeCompany } = useCompany();
    const companyId = activeCompany?.id ?? id ?? '';
    const isEditing = !!docId;

    const [form, setForm] = useState<FormData>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(isEditing);
    const [showPreview, setShowPreview] = useState(false);

    const companyName = activeCompany?.legalName || activeCompany?.tradeName || 'EMPRESA';
    const cnpj = (activeCompany as any)?.taxId as string | undefined;
    // registerInfo: monta a partir dos novos campos, com fallback para nire legado
    const _regOrg = (activeCompany as any)?.registerOrg as string | undefined;
    const _regNum = (activeCompany as any)?.registerNumber as string | undefined;
    const _nire = (activeCompany as any)?.nire as string | undefined;
    const registerInfo = _regOrg
        ? (_regOrg.toLowerCase().includes('jucesp') ? `NIRE: ${_regNum ?? ''}` : `${_regOrg}${_regNum ? ` nº ${_regNum}` : ''}`)
        : (_nire ? `NIRE: ${_nire}` : undefined);

    const textoGerado = gerarTextoAta(form, companyName);
    const activeStyle = DOC_STYLES.find(s => s.id === form.styleId) ?? DOC_STYLES[0];

    useEffect(() => {
        if (!isEditing) return;
        api.get(`/documents/${docId}`)
            .then(({ data }) => {
                let extra: Partial<FormData> = {};
                try { extra = JSON.parse(data.notes ?? '{}'); } catch { }
                setForm({
                    title: data.title ?? '',
                    date: data.date ? data.date.slice(0, 10) : '',
                    hora: extra.hora ?? '',
                    local: extra.local ?? 'Sede da Sociedade',
                    status: data.status ?? 'RASCUNHO',
                    membrosMesa: extra.membrosMesa ?? EMPTY.membrosMesa,
                    participantes: extra.participantes ?? [],
                    quorum: extra.quorum ?? '100% do capital social',
                    convocacao: extra.convocacao ?? 'unanimidade',
                    // Migração: deliberacoes salvas como chaves → converte em itens livres
                    itensPautaLivre: (() => {
                        const livres: ItemOrdemDia[] = extra.itensPautaLivre ?? [];
                        const deLibs: ItemOrdemDia[] = (extra.deliberacoes ?? [])
                            .map((d: string) => DELIBERACOES_OPTIONS.find(o => o.value === d))
                            .filter(Boolean)
                            .map((o: any) => ({ id: crypto.randomUUID(), texto: o.label }))
                            // Não duplicar se já existir como item livre com mesmo texto
                            .filter((d: ItemOrdemDia) => !livres.some(l => l.texto === d.texto));
                        return [...livres, ...deLibs];
                    })(),
                    deliberacoes: [],   // campo legado — não usado na nova UI
                    textoDeliberacoes: extra.textoDeliberacoes ?? '',
                    cidade: extra.cidade ?? 'São Paulo',
                    bookNumber: String(data.bookNumber ?? ''),
                    changeNote: '',
                    numerarSecoes: extra.numerarSecoes ?? true,
                    styleId: data.description ?? 'minimalista',
                });
            })
            .catch(() => alert('Erro ao carregar ata.'))
            .finally(() => setLoading(false));
    }, [docId]);

    const set = (field: keyof FormData, value: any) =>
        setForm(prev => ({ ...prev, [field]: value }));

    const updateMembro = (idx: number, updates: Partial<MembroMesa>) =>
        setForm(prev => {
            const m = [...prev.membrosMesa];
            m[idx] = { ...m[idx], ...updates };
            return { ...prev, membrosMesa: m };
        });
    const addMembro = () => setForm(prev => ({ ...prev, membrosMesa: [...prev.membrosMesa, { ...MEMBRO_VAZIO }] }));
    const removeMembro = (idx: number) => setForm(prev => ({ ...prev, membrosMesa: prev.membrosMesa.filter((_, i) => i !== idx) }));

    const addParticipante = () => setForm(prev => ({
        ...prev,
        participantes: [...prev.participantes, { id: crypto.randomUUID(), cpf: '', nome: '', tipo: 'ACIONISTA', personId: undefined }],
    }));
    const updateParticipante = (idx: number, updates: Partial<Participante>) =>
        setForm(prev => {
            const list = [...prev.participantes];
            list[idx] = { ...list[idx], ...updates };
            return { ...prev, participantes: list };
        });
    const removeParticipante = (idx: number) =>
        setForm(prev => ({ ...prev, participantes: prev.participantes.filter((_, i) => i !== idx) }));

    const addItemPauta = () => setForm(prev => ({ ...prev, itensPautaLivre: [...prev.itensPautaLivre, { id: crypto.randomUUID(), texto: '' }] }));
    const setItemPauta = (itemId: string, texto: string) => setForm(prev => ({ ...prev, itensPautaLivre: prev.itensPautaLivre.map(i => i.id === itemId ? { ...i, texto } : i) }));
    const removeItemPauta = (itemId: string) => setForm(prev => ({ ...prev, itensPautaLivre: prev.itensPautaLivre.filter(i => i.id !== itemId) }));
    const toggleDelib = (value: string) => setForm(prev => ({ ...prev, deliberacoes: prev.deliberacoes.includes(value) ? prev.deliberacoes.filter(d => d !== value) : [...prev.deliberacoes, value] }));

    const handleSave = async () => {
        if (!form.title.trim()) { alert('Título obrigatório.'); return; }
        setSaving(true);
        try {
            const notesJson = JSON.stringify({
                hora: form.hora, local: form.local, membrosMesa: form.membrosMesa,
                participantes: form.participantes,
                quorum: form.quorum, convocacao: form.convocacao,
                itensPautaLivre: form.itensPautaLivre, deliberacoes: form.deliberacoes,
                textoDeliberacoes: form.textoDeliberacoes, cidade: form.cidade,
                numerarSecoes: form.numerarSecoes,
            });
            const payload = {
                companyId, type: 'ATA_AGE', title: form.title,
                date: form.date || undefined, content: textoGerado, status: form.status,
                bookNumber: form.bookNumber ? Number(form.bookNumber) : undefined,
                notes: notesJson, changeNote: form.changeNote || undefined, description: form.styleId,
            };
            if (isEditing) await api.patch(`/documents/${docId}`, payload);
            else await api.post('/documents', payload);
            navigate(`/app/companies/corporate/atas/age/${companyId}`);
        } catch (err) {
            console.error('Erro ao salvar:', err);
            alert('Erro ao salvar a ata.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
    );

    return (
        <div className="max-w-screen-xl mx-auto p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(`/app/companies/corporate/atas/age/${companyId}`)}
                        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                        <FiArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">{isEditing ? 'Editar AGE' : 'Nova AGE'}</h1>
                        <p className="text-sm text-gray-400">Assembleia Geral Extraordinária — {companyName}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowPreview(v => !v)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors
                            ${showPreview ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                        <FiEye size={15} />
                        {showPreview ? 'Ocultar prévia' : 'Ver prévia'}
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors font-medium">
                        <FiSave size={16} />
                        {saving ? 'Salvando…' : 'Salvar'}
                    </button>
                </div>
            </div>

            <div className="flex gap-6 items-start">
                {/* Formulário */}
                <div className={`space-y-5 min-w-0 ${showPreview ? 'w-1/2' : 'w-full'}`}>

                    {/* 1. Identificação */}
                    <Section title="Identificação">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Título *</label>
                            <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
                                placeholder="Ex: AGE de Transformação — mar/2026" className={inputCls} />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Data</label>
                                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Hora</label>
                                <input type="time" value={form.hora} onChange={e => set('hora', e.target.value)} className={inputCls} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                                <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls + ' bg-white'}>
                                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Local de Realização</label>
                                <input type="text" value={form.local} onChange={e => set('local', e.target.value)}
                                    placeholder="Ex: Sede da Sociedade" className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Cidade (encerramento)</label>
                                <input type="text" value={form.cidade} onChange={e => set('cidade', e.target.value)}
                                    placeholder="Ex: São Paulo" className={inputCls} />
                            </div>
                        </div>

                        {/* Opção de numeração — visível logo na primeira seção */}
                        <div className="pt-3 border-t border-gray-100 flex items-center gap-2.5">
                            <input
                                type="checkbox"
                                id="numerarSecoes"
                                checked={form.numerarSecoes}
                                onChange={e => set('numerarSecoes', e.target.checked)}
                                className="w-4 h-4 accent-blue-600 cursor-pointer flex-shrink-0"
                            />
                            <label htmlFor="numerarSecoes" className="text-sm text-gray-700 cursor-pointer select-none">
                                Numerar seções
                                <span className="ml-1.5 text-xs text-gray-400">
                                    1. DATA, HORA E LOCAL &nbsp;·&nbsp; 2. CONVOCAÇÃO &nbsp;·&nbsp; 3. PRESENÇA &nbsp;·&nbsp; …
                                </span>
                            </label>
                        </div>
                    </Section>

                    {/* 2. Mesa Diretora */}
                    <Section title="Mesa Diretora">
                        <p className="text-xs text-gray-400 -mt-2">
                            Digite o CPF para buscar no cadastro. Se não encontrado, preencha manualmente ou{' '}
                            <a href="/app/persons/new" target="_blank" className="text-blue-500 hover:underline">cadastre a pessoa</a>.
                        </p>
                        <div className="space-y-2">
                            {form.membrosMesa.map((m, idx) => (
                                <CpfLookup key={idx} idx={idx} membro={m}
                                    onChange={updateMembro} onRemove={removeMembro}
                                    canRemove={form.membrosMesa.length > 1} />
                            ))}
                            <button onClick={addMembro}
                                className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 mt-1 transition-colors">
                                <FiPlus size={13} /> Adicionar membro
                            </button>
                        </div>
                    </Section>

                    {/* 3. Presença e Convocação */}
                    <Section title="Presença e Convocação">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Quórum / Presença</label>
                            <input type="text" value={form.quorum} onChange={e => set('quorum', e.target.value)}
                                placeholder="Ex: 100% do capital social representado" className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Forma de Convocação</label>
                            <select value={form.convocacao} onChange={e => set('convocacao', e.target.value)} className={inputCls + ' bg-white'}>
                                {CONVOCACAO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>

                        {/* Participantes presentes */}
                        <div className="pt-2 border-t border-gray-100">
                            <p className="text-xs font-medium text-gray-500 mb-2">
                                Participantes presentes
                            </p>
                            <p className="text-xs text-gray-400 mb-3">
                                Digite o CPF para buscar no cadastro. Se não encontrado, preencha manualmente ou{' '}
                                <a href="/app/persons/new" target="_blank" className="text-blue-500 hover:underline">cadastre a pessoa</a>.
                            </p>
                            <div className="space-y-2">
                                {form.participantes.map((p, idx) => (
                                    <ParticipanteLookup key={p.id} idx={idx} p={p}
                                        onChange={updateParticipante} onRemove={removeParticipante} />
                                ))}
                                <button onClick={addParticipante}
                                    className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 mt-1 transition-colors">
                                    <FiPlus size={13} /> Adicionar participante
                                </button>
                            </div>
                        </div>
                    </Section>

                    {/* 4. Ordem do Dia */}
                    <Section title="Ordem do Dia">
                        <div className="flex items-start gap-3">
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                    Itens da pauta
                                    <span className="ml-1.5 font-normal text-gray-400">— separados por ponto e vírgula</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.itensPautaLivre.map(i => i.texto).join('; ')}
                                    onChange={e => {
                                        const partes = e.target.value.split(';').map(p => p.trim()).filter(Boolean);
                                        setForm(prev => ({
                                            ...prev,
                                            itensPautaLivre: partes.length
                                                ? partes.map((texto, idx) => ({ id: prev.itensPautaLivre[idx]?.id ?? crypto.randomUUID(), texto }))
                                                : [],
                                        }));
                                    }}
                                    placeholder="Ex: Transformação do tipo societário; Eleição de diretores"
                                    className={inputCls}
                                />
                                <p className="text-[11px] text-gray-400 mt-1">
                                    Aparecerá como: <span className="font-mono">ORDEM DO DIA: 1. Transformação…; 2. Eleição…</span>
                                </p>
                            </div>
                        </div>

                        {/* Sugestões rápidas */}
                        <div className="pt-2 border-t border-gray-100">
                            <p className="text-xs font-medium text-gray-400 mb-2">Sugestões — clique para acrescentar:</p>
                            <div className="flex flex-wrap gap-1.5">
                                {DELIBERACOES_OPTIONS.map(opt => {
                                    const jaAdicionado = form.itensPautaLivre.some(i => i.texto === opt.label);
                                    return (
                                        <button key={opt.value}
                                            onClick={() => {
                                                if (!jaAdicionado)
                                                    setForm(prev => ({ ...prev, itensPautaLivre: [...prev.itensPautaLivre, { id: crypto.randomUUID(), texto: opt.label }] }));
                                            }}
                                            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${jaAdicionado
                                                ? 'bg-blue-50 border-blue-200 text-blue-500 cursor-default'
                                                : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 cursor-pointer'
                                                }`}>
                                            {jaAdicionado ? '✓ ' : '+ '}{opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </Section>

                    {/* 5. Texto das Deliberações */}
                    <Section title="Texto das Deliberações">
                        <p className="text-xs text-gray-400 -mt-2 mb-1">
                            Redija apenas o mérito. O restante é gerado automaticamente.{' '}
                            <span className="text-gray-300">
                                Comandos: <code className="bg-gray-100 px-1 rounded">-{'>'} texto {'<'}-</code> centraliza &nbsp;•&nbsp;
                                <code className="bg-gray-100 px-1 rounded">|| col1 | col2 ||</code> colunas &nbsp;•&nbsp;
                                <code className="bg-gray-100 px-1 rounded">||3{'>'} col1 | col2 {'<'}3||</code> colunas com recuo.
                            </span>
                        </p>
                        <textarea value={form.textoDeliberacoes} onChange={e => set('textoDeliberacoes', e.target.value)}
                            placeholder={"1. TRANSFORMAÇÃO: Aprovada por unanimidade...\n\n2. CAPITAL SOCIAL E AÇÕES: O capital social..."}
                            className="w-full h-72 px-4 py-3 text-sm text-gray-700 leading-relaxed font-mono border border-gray-200 rounded-lg bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
                    </Section>

                    {/* 6. Estilo */}
                    <DocumentStylePicker
                        selectedStyleId={form.styleId}
                        content={textoGerado}
                        companyName={companyName}
                        docTitle={form.title}
                        onChange={(styleId) => set('styleId', styleId)}
                    />

                    {/* 7. Registro */}
                    <Section title="Registro">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Nº Livro / Registro</label>
                                <input type="text" value={form.bookNumber} onChange={e => set('bookNumber', e.target.value)}
                                    placeholder="Ex: Livro 3, Folha 45" className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Nota de Alteração</label>
                                <input type="text" value={form.changeNote} onChange={e => set('changeNote', e.target.value)}
                                    placeholder="Ex: Transformação de Ltda para S.A." className={inputCls} />
                            </div>
                        </div>
                    </Section>
                </div>

                {/* Prévia ao vivo */}
                {showPreview && (
                    <div className="w-1/2 sticky top-6">
                        <div className="bg-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                            <div className="px-4 py-2.5 bg-white border-b border-gray-200 flex items-center gap-2">
                                <FiFileText size={14} className="text-gray-400" />
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Prévia — {activeStyle.name}
                                </span>
                            </div>
                            <div className="overflow-y-auto max-h-[calc(100vh-160px)]">
                                <RenderDocument
                                    style={activeStyle}
                                    content={textoGerado}
                                    companyName={companyName}
                                    docTitle={form.title}
                                    cnpj={cnpj}
                                    registerInfo={registerInfo}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};