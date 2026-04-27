// src/components/DocumentStylePicker.tsx
import React, { useState } from 'react';
import { FiX, FiCheck, FiEye } from 'react-icons/fi';

export interface DocStyle {
    id: string;
    name: string;
    description: string;
    fontFamily: string;
    lineHeight: string;
    textAlign: string;
    letterSpacing?: string;
    showLineNumbers?: boolean;
    headerStyle?: 'none' | 'corporate' | 'formal';
    // Cores semânticas por estilo
    labelColor: string;       // cor do rótulo (DELIBERAÇÕES:)
    labelBg: string;          // fundo do rótulo
    titleColor: string;
    accentColor: string;
    thumbnail: React.ReactNode;
}

export const DOC_STYLES: DocStyle[] = [
    {
        id: 'minimalista',
        name: 'Minimalista',
        description: 'Sem serifa, espaçamento limpo, leitura moderna',
        fontFamily: "'DM Sans', sans-serif",
        lineHeight: '1.75',
        textAlign: 'left',
        letterSpacing: '0.01em',
        headerStyle: 'none',
        labelColor: '#1e40af',
        labelBg: '#eff6ff',
        titleColor: '#111827',
        accentColor: '#2563eb',
        thumbnail: (
            <div className="w-full h-full bg-white p-3 flex flex-col gap-1.5">
                <div className="h-2 w-3/4 bg-gray-800 rounded-sm mx-auto" />
                <div className="h-1 w-1/2 bg-gray-400 rounded-sm mx-auto" />
                <div className="h-px w-full bg-gray-200 my-1" />
                <div className="h-1.5 w-16 bg-blue-200 rounded-sm" />
                <div className="h-1.5 w-full bg-gray-200 rounded-sm" />
                <div className="h-1.5 w-5/6 bg-gray-200 rounded-sm" />
            </div>
        ),
    },
    {
        id: 'jucesp',
        name: 'JUCESP',
        description: 'Fonte serifada, margens formais, justificado',
        fontFamily: "'Georgia', serif",
        lineHeight: '1.9',
        textAlign: 'justify',
        headerStyle: 'formal',
        labelColor: '#1f2937',
        labelBg: '#f3f4f6',
        titleColor: '#111827',
        accentColor: '#374151',
        thumbnail: (
            <div className="w-full h-full bg-white p-3 flex flex-col gap-1.5">
                <div className="h-1.5 w-2/3 bg-gray-800 rounded-sm mx-auto" />
                <div className="h-px w-full bg-gray-500 my-1" />
                <div className="h-1.5 w-20 bg-gray-400 rounded-sm" />
                <div className="h-1.5 w-full bg-gray-300 rounded-sm" />
                <div className="h-1.5 w-full bg-gray-300 rounded-sm" />
                <div className="h-1.5 w-full bg-gray-300 rounded-sm" />
                <div className="h-px w-full bg-gray-400 mt-1" />
            </div>
        ),
    },
    {
        id: 'cartorio',
        name: 'Cartório',
        description: 'Espaçamento duplo, numeração de linhas lateral',
        fontFamily: "'Courier New', monospace",
        lineHeight: '2',
        textAlign: 'left',
        showLineNumbers: true,
        headerStyle: 'none',
        labelColor: '#065f46',
        labelBg: '#ecfdf5',
        titleColor: '#064e3b',
        accentColor: '#059669',
        thumbnail: (
            <div className="w-full h-full bg-white p-3 flex flex-col gap-2">
                <div className="h-1.5 w-2/3 bg-gray-700 rounded-sm mx-auto mb-1" />
                {[1,2,3,4].map(n => (
                    <div key={n} className="flex items-center gap-2">
                        <span className="text-gray-300 text-xs w-3 flex-shrink-0">{n}</span>
                        <div className="h-1.5 flex-1 bg-gray-200 rounded-sm" />
                    </div>
                ))}
            </div>
        ),
    },
    {
        id: 'corporativo',
        name: 'Corporativo',
        description: 'Cabeçalho com dados da empresa, visual institucional',
        fontFamily: "'Trebuchet MS', sans-serif",
        lineHeight: '1.7',
        textAlign: 'left',
        headerStyle: 'corporate',
        labelColor: '#1e3a8a',
        labelBg: '#dbeafe',
        titleColor: '#1e3a8a',
        accentColor: '#1d4ed8',
        thumbnail: (
            <div className="w-full h-full bg-white flex flex-col">
                <div className="bg-blue-700 px-3 py-2 flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-white/30" />
                    <div className="flex flex-col gap-0.5">
                        <div className="h-1 w-14 bg-white/80 rounded-sm" />
                        <div className="h-0.5 w-10 bg-white/50 rounded-sm" />
                    </div>
                </div>
                <div className="p-3 flex flex-col gap-1.5">
                    <div className="h-1.5 w-16 bg-blue-200 rounded-sm" />
                    <div className="h-1.5 w-full bg-gray-200 rounded-sm" />
                    <div className="h-1.5 w-4/5 bg-gray-200 rounded-sm" />
                </div>
            </div>
        ),
    },
    {
        id: 'classico',
        name: 'Clássico',
        description: 'Estilo notarial tradicional, espaçamento generoso',
        fontFamily: "'Palatino Linotype', 'Book Antiqua', serif",
        lineHeight: '2',
        textAlign: 'justify',
        letterSpacing: '0.02em',
        headerStyle: 'formal',
        labelColor: '#78350f',
        labelBg: '#fef3c7',
        titleColor: '#451a03',
        accentColor: '#92400e',
        thumbnail: (
            <div className="w-full h-full bg-amber-50 p-3 flex flex-col gap-1.5">
                <div className="h-2 w-1/2 bg-amber-900 rounded-sm opacity-70 mx-auto" />
                <div className="h-px w-full bg-amber-400 my-1 opacity-50" />
                <div className="h-1.5 w-20 bg-amber-600 rounded-sm opacity-40" />
                <div className="h-1.5 w-full bg-amber-800 rounded-sm opacity-25" />
                <div className="h-1.5 w-full bg-amber-800 rounded-sm opacity-25" />
                <div className="h-1.5 w-5/6 bg-amber-800 rounded-sm opacity-25" />
            </div>
        ),
    },
];

// ── Parser semântico ─────────────────────────────────────────
// Reconhece: "TÍTULO EM CAIXA ALTA:" ou "5. TÍTULO EM CAIXA ALTA:"
// Também detecta título do documento (primeiras linhas em caixa alta sem dois pontos)
type LineType = 'title' | 'subtitle' | 'label' | 'body' | 'signature' | 'blank';

interface ParsedLine {
    type: LineType;
    raw: string;
    label?: string;   // parte antes dos dois pontos
    rest?: string;    // parte após os dois pontos
    number?: string;  // número do item, ex: "5."
}

const LABEL_REGEX = /^(\d+\.\s+)?([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ\s\/]+):(.*)$/;
const SIGNATURE_KEYWORDS = ['assinatura', 'subscrit', 'presidente', 'secretári', 'diretor'];

function parseLine(line: string, index: number, allLines: string[]): ParsedLine {
    const trimmed = line.trim();

    if (!trimmed) return { type: 'blank', raw: line };

    // Assinatura — linha curta com palavra-chave ou após linha em branco perto do fim
    const lower = trimmed.toLowerCase();
    if (SIGNATURE_KEYWORDS.some(k => lower.includes(k)) && trimmed.length < 60) {
        return { type: 'signature', raw: trimmed };
    }

    // Rótulo — CAIXA ALTA com dois pontos (numerado ou não)
    const labelMatch = trimmed.match(LABEL_REGEX);
    if (labelMatch) {
        return {
            type: 'label',
            raw: trimmed,
            number: labelMatch[1]?.trim(),
            label: labelMatch[2].trim(),
            rest: labelMatch[3].trim(),
        };
    }

    // Título — linha curta, toda em caixa alta, sem dois pontos, nas primeiras 5 linhas
    const nonBlanksBefore = allLines.slice(0, index).filter(l => l.trim()).length;
    if (
        nonBlanksBefore < 4 &&
        trimmed === trimmed.toUpperCase() &&
        trimmed.length > 5 &&
        !trimmed.includes(':')
    ) {
        return { type: nonBlanksBefore < 2 ? 'title' : 'subtitle', raw: trimmed };
    }

    return { type: 'body', raw: trimmed };
}

// ── Renderizador de linha ────────────────────────────────────
function RenderLine({ parsed, style, lineNum }: {
    parsed: ParsedLine;
    style: DocStyle;
    lineNum?: number;
}) {
    const wrapNumber = style.showLineNumbers && lineNum !== undefined;

    const inner = (() => {
        switch (parsed.type) {
            case 'blank':
                return <div style={{ height: `${parseFloat(style.lineHeight) * 0.6}em` }} />;

            case 'title':
                return (
                    <p style={{
                        textAlign: 'center',
                        fontWeight: 'bold',
                        fontSize: '1.1em',
                        color: style.titleColor,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        marginBottom: '0.25em',
                    }}>
                        {parsed.raw}
                    </p>
                );

            case 'subtitle':
                return (
                    <p style={{
                        textAlign: 'center',
                        fontSize: '0.9em',
                        color: '#6b7280',
                        marginBottom: '0.5em',
                    }}>
                        {parsed.raw}
                    </p>
                );

            case 'label':
                return (
                    <div style={{ marginTop: '1em', marginBottom: '0.25em' }}>
                        <span style={{
                            display: 'inline-block',
                            backgroundColor: style.labelBg,
                            color: style.labelColor,
                            fontWeight: 'bold',
                            fontSize: '0.8em',
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            padding: '1px 8px',
                            borderRadius: '3px',
                            borderLeft: `3px solid ${style.accentColor}`,
                        }}>
                            {parsed.number && <span style={{ color: style.accentColor, marginRight: '4px' }}>{parsed.number}</span>}
                            {parsed.label}
                        </span>
                        {parsed.rest && (
                            <span style={{
                                display: 'block',
                                marginTop: '0.2em',
                                textAlign: style.textAlign as any,
                            }}>
                                {parsed.rest}
                            </span>
                        )}
                    </div>
                );

            case 'signature':
                return (
                    <p style={{
                        textAlign: 'center',
                        fontStyle: 'italic',
                        color: '#6b7280',
                        marginTop: '0.5em',
                    }}>
                        {parsed.raw}
                    </p>
                );

            default:
                return (
                    <p style={{ textAlign: style.textAlign as any }}>
                        {parsed.raw}
                    </p>
                );
        }
    })();

    if (wrapNumber) {
        return (
            <div style={{ display: 'flex', gap: '1rem' }}>
                <span style={{ color: '#d1d5db', fontSize: '0.75em', width: '1.5rem', flexShrink: 0, paddingTop: '0.2em', textAlign: 'right', userSelect: 'none' }}>
                    {lineNum}
                </span>
                <div style={{ flex: 1 }}>{inner}</div>
            </div>
        );
    }
    return inner;
}

// ── Cabeçalhos ───────────────────────────────────────────────
function StyleHeader({ style, companyName, docTitle }: {
    style: DocStyle; companyName: string; docTitle: string;
}) {
    if (style.headerStyle === 'corporate') {
        return (
            <div style={{ backgroundColor: '#1d4ed8', color: 'white', padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', flexShrink: 0 }}>
                    {companyName.charAt(0)}
                </div>
                <div>
                    <p style={{ fontWeight: 'bold', margin: 0 }}>{companyName}</p>
                    <p style={{ color: '#bfdbfe', fontSize: '0.85em', margin: 0 }}>{docTitle}</p>
                </div>
            </div>
        );
    }
    if (style.headerStyle === 'formal') {
        return (
            <div style={{ textAlign: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: `2px solid ${style.titleColor}` }}>
                <p style={{ fontWeight: 'bold', fontSize: '1em', letterSpacing: '0.1em', textTransform: 'uppercase', color: style.titleColor, margin: 0 }}>
                    {companyName}
                </p>
                <p style={{ fontSize: '0.85em', marginTop: '0.25rem', color: '#6b7280' }}>{docTitle}</p>
            </div>
        );
    }
    return null;
}

// ── Renderizador completo do documento ───────────────────────
export function RenderDocument({ style, content, companyName, docTitle }: {
    style: DocStyle; content: string; companyName: string; docTitle: string;
}) {
    const lines = content.split('\n');
    const parsed = lines.map((line, i) => parseLine(line, i, lines));
    let lineCounter = 0;

    return (
        <div style={{
            fontFamily: style.fontFamily,
            lineHeight: style.lineHeight,
            letterSpacing: style.letterSpacing ?? 'normal',
            color: '#1f2937',
            backgroundColor: style.id === 'classico' ? '#fffbeb' : 'white',
        }}>
            <StyleHeader style={style} companyName={companyName} docTitle={docTitle} />
            <div style={{ padding: style.headerStyle === 'corporate' ? '0 2rem 2rem' : '2.5rem' }}>
                {parsed.map((p, i) => {
                    if (style.showLineNumbers && p.type !== 'blank') lineCounter++;
                    return (
                        <RenderLine
                            key={i}
                            parsed={p}
                            style={style}
                            lineNum={style.showLineNumbers && p.type !== 'blank' ? lineCounter : undefined}
                        />
                    );
                })}
            </div>
        </div>
    );
}

// ── Modal de preview ─────────────────────────────────────────
function PreviewModal({ style, content, companyName, docTitle, onClose, onSelect }: {
    style: DocStyle; content: string; companyName: string; docTitle: string;
    onClose: () => void; onSelect: (id: string) => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                    <div>
                        <h3 className="font-bold text-gray-800 text-lg">{style.name}</h3>
                        <p className="text-sm text-gray-500">{style.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { onSelect(style.id); onClose(); }}
                            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                            <FiCheck size={16} />
                            Usar este estilo
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                            <FiX size={20} />
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto bg-gray-100 p-8">
                    <div className="bg-white shadow-lg mx-auto max-w-2xl min-h-[700px] overflow-hidden">
                        <RenderDocument
                            style={style}
                            content={content || 'ASSEMBLEIA GERAL EXTRAORDINÁRIA\nEmpresa Exemplo S.A.\n\nDATA E HORA: Aos 10 de março de 2026.\n\nPRESENÇA: Totalidade dos acionistas presentes.\n\n1. ORDEM DO DIA: Transformação do tipo societário.\n\n2. DELIBERAÇÕES: Aprovada por unanimidade a transformação.'}
                            companyName={companyName}
                            docTitle={docTitle}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Componente principal ─────────────────────────────────────
interface DocumentStylePickerProps {
    selectedStyleId?: string;
    content: string;
    companyName: string;
    docTitle: string;
    onChange: (styleId: string) => void;
}

export const DocumentStylePicker: React.FC<DocumentStylePickerProps> = ({
    selectedStyleId, content, companyName, docTitle, onChange,
}) => {
    const [previewStyle, setPreviewStyle] = useState<DocStyle | null>(null);
    const selected = selectedStyleId ?? 'minimalista';

    return (
        <>
            {previewStyle && (
                <PreviewModal
                    style={previewStyle}
                    content={content}
                    companyName={companyName}
                    docTitle={docTitle}
                    onClose={() => setPreviewStyle(null)}
                    onSelect={(id) => { onChange(id); setPreviewStyle(null); }}
                />
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Estilo do Documento</h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Clique para selecionar • <FiEye className="inline" size={11} /> para visualizar com o texto atual
                        </p>
                    </div>
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full font-medium">
                        {DOC_STYLES.find(s => s.id === selected)?.name ?? 'Minimalista'}
                    </span>
                </div>

                <div className="grid grid-cols-5 gap-3">
                    {DOC_STYLES.map((style) => {
                        const isSelected = style.id === selected;
                        return (
                            <div
                                key={style.id}
                                className={`relative rounded-xl border-2 overflow-hidden cursor-pointer transition-all group
                                    ${isSelected
                                        ? 'border-blue-600 shadow-md shadow-blue-100'
                                        : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'}`}
                                onClick={() => onChange(style.id)}
                            >
                                <div className="h-24 w-full overflow-hidden">{style.thumbnail}</div>
                                <div className={`px-2 py-1.5 text-center border-t ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-gray-50 border-gray-100'}`}>
                                    <p className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-gray-600'}`}>
                                        {style.name}
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setPreviewStyle(style); }}
                                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                                    title="Visualizar"
                                >
                                    <FiEye size={11} />
                                </button>
                                {isSelected && (
                                    <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                                        <FiCheck size={10} className="text-white" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
};