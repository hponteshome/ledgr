// src/components/DocumentStylePicker.tsx
import React, { useState } from 'react';
import { FiX, FiCheck, FiEye } from 'react-icons/fi';

export interface DocStyle {
    id: string;
    name: string;
    description: string;
    fontFamily: string;
    fontSize: string;
    lineHeight: string;
    textAlign: 'left' | 'justify' | 'center';
    letterSpacing?: string;
    showLineNumbers?: boolean;
    headerStyle?: 'none' | 'simple' | 'corporate' | 'formal';
    paragraphIndent?: string;
    paragraphMarker?: string;   // ex: '>>' para retro
    thumbnail: React.ReactNode;
}

export const DOC_STYLES: DocStyle[] = [
    {
        id: 'minimalista',
        name: 'Minimalista',
        description: 'Sem serifa, espaçamento limpo',
        fontFamily: "'Arial', 'Helvetica', sans-serif",
        fontSize: '13px',
        lineHeight: '1.65',
        textAlign: 'left',
        headerStyle: 'simple',
        thumbnail: (
            <div className="w-full h-full bg-white p-3 flex flex-col gap-1.5">
                <div className="h-2.5 w-2/3 bg-black rounded-none mx-auto" />
                <div className="h-1 w-2/5 bg-gray-500 rounded-none mx-auto" />
                <div className="h-px w-full bg-gray-300 my-1.5" />
                <div className="h-1.5 w-20 bg-black rounded-none" />
                <div className="h-1.5 w-full bg-gray-300 rounded-none" />
                <div className="h-1.5 w-full bg-gray-300 rounded-none" />
                <div className="h-1.5 w-4/5 bg-gray-300 rounded-none" />
            </div>
        ),
    },
    {
        id: 'jucesp',
        name: 'JUCESP',
        description: 'Serifada, justificado, formal',
        fontFamily: "'Georgia', 'Times New Roman', serif",
        fontSize: '13px',
        lineHeight: '1.9',
        textAlign: 'justify',
        headerStyle: 'formal',
        thumbnail: (
            <div className="w-full h-full bg-white p-3 flex flex-col gap-1.5">
                <div className="h-2 w-2/3 bg-black rounded-none mx-auto" />
                <div className="h-px w-full bg-black my-1" />
                <div className="h-1.5 w-20 bg-black rounded-none" />
                <div className="h-1.5 w-full bg-gray-300 rounded-none" />
                <div className="h-1.5 w-full bg-gray-300 rounded-none" />
                <div className="h-1.5 w-full bg-gray-300 rounded-none" />
                <div className="h-px w-full bg-gray-400 mt-1" />
            </div>
        ),
    },
    {
        id: 'cartorio',
        name: 'Cartório',
        description: 'Mono, numeração de linhas, duplo espaço',
        fontFamily: "'Courier New', 'Courier', monospace",
        fontSize: '12px',
        lineHeight: '2.0',
        textAlign: 'left',
        showLineNumbers: true,
        headerStyle: 'simple',
        thumbnail: (
            <div className="w-full h-full bg-white p-3 flex flex-col gap-2">
                <div className="h-1.5 w-2/3 bg-black rounded-none mx-auto mb-1" />
                {[1, 2, 3, 4].map(n => (
                    <div key={n} className="flex items-center gap-1.5">
                        <span className="text-gray-400 text-xs w-3 flex-shrink-0">{n}</span>
                        <div className="h-1.5 flex-1 bg-gray-300 rounded-none" />
                    </div>
                ))}
            </div>
        ),
    },
    {
        id: 'corporativo',
        name: 'Corporativo',
        description: 'Cabeçalho institucional, sem serifa',
        fontFamily: "'Arial', 'Helvetica', sans-serif",
        fontSize: '13px',
        lineHeight: '1.7',
        textAlign: 'left',
        headerStyle: 'corporate',
        thumbnail: (
            <div className="w-full h-full bg-white flex flex-col">
                <div className="bg-black px-3 py-2 flex items-center gap-2">
                    <div className="w-4 h-4 rounded-none bg-white/40 flex-shrink-0" />
                    <div className="flex flex-col gap-0.5">
                        <div className="h-1 w-14 bg-white/80 rounded-none" />
                        <div className="h-0.5 w-10 bg-white/50 rounded-none" />
                    </div>
                </div>
                <div className="p-3 flex flex-col gap-1.5">
                    <div className="h-1.5 w-20 bg-black rounded-none" />
                    <div className="h-1.5 w-full bg-gray-300 rounded-none" />
                    <div className="h-1.5 w-4/5 bg-gray-300 rounded-none" />
                </div>
            </div>
        ),
    },
    {
        id: 'classico',
        name: 'Clássico',
        description: 'Palatino, espaçamento generoso, justificado',
        fontFamily: "'Palatino Linotype', 'Book Antiqua', 'Palatino', serif",
        fontSize: '13px',
        lineHeight: '2.0',
        textAlign: 'justify',
        letterSpacing: '0.02em',
        headerStyle: 'formal',
        thumbnail: (
            <div className="w-full h-full bg-white p-3 flex flex-col gap-1.5">
                <div className="h-2 w-1/2 bg-black rounded-none mx-auto" />
                <div className="h-px w-3/4 bg-black mx-auto my-1 opacity-50" />
                <div className="h-1.5 w-20 bg-black rounded-none opacity-70" />
                <div className="h-1.5 w-full bg-gray-300 rounded-none" />
                <div className="h-1.5 w-full bg-gray-300 rounded-none" />
                <div className="h-1.5 w-5/6 bg-gray-300 rounded-none" />
            </div>
        ),
    },
    {
        id: 'retro',
        name: 'Retrô',
        description: 'Datilografado, indentação, espaçamento generoso',
        fontFamily: "'Courier New', 'Courier', monospace",
        fontSize: '12.5px',
        lineHeight: '1.85',
        textAlign: 'left',
        letterSpacing: '0.03em',
        headerStyle: 'none',
        paragraphIndent: '3em',
        thumbnail: (
            <div className="w-full h-full bg-white p-3 flex flex-col gap-1">
                <div className="flex justify-center gap-1 mb-1">
                    <div className="h-1.5 w-1/2 bg-black rounded-none" />
                </div>
                <div className="h-px w-full bg-black opacity-30" />
                <div className="h-px w-full bg-black opacity-30 mb-1" />
                {[0, 1, 2, 3].map(n => (
                    <div key={n} className="flex items-center gap-1">
                        <span className="text-gray-300 text-xs w-3">{n + 1}</span>
                        <div className={`h-1.5 bg-gray-400 rounded-none ${n % 3 === 0 ? 'w-3/4' : 'flex-1'}`} />
                    </div>
                ))}
            </div>
        ),
    },
];

// ── Parser semântico ─────────────────────────────────────────
type LineType = 'title' | 'subtitle' | 'label' | 'body' | 'signature' | 'blank' | 'centered' | 'justified' | 'columns';

interface ParsedLine {
    type: LineType;
    raw: string;
    label?: string;
    rest?: string;
    number?: string;
    columns?: string[];   // para type === 'columns'
    indentLeft?: number;  // recuo esquerdo em em
    indentRight?: number; // recuo direito em em
}

// CAIXA ALTA com dois pontos, numerado ou não: "DELIBERAÇÕES:" ou "5. DELIBERAÇÕES:"
const LABEL_REGEX = /^(\d+[\.\)]\s+)?([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ\s\/\-\,]+):(.*)$/;
const SIGNATURE_KEYWORDS = ['assinatura', 'subscrit', 'presidente', 'secretári', 'diretor', 'testemunha'];

function parseLine(line: string, index: number, allLines: string[]): ParsedLine {
    const trimmed = line.trim();
    if (!trimmed) return { type: 'blank', raw: line };

    // ── Comandos inline — verificados PRIMEIRO ──────────────
    // Centralizado: -> texto <-
    if (trimmed.startsWith('->') && trimmed.endsWith('<-')) {
        return { type: 'centered', raw: trimmed.slice(2, -2).trim() };
    }

    // Colunas distribuídas com recuo opcional:
    // || col1 | col2 ||          → sem recuo
    // ||3> col1 | col2 ||        → recuo esquerdo 3em
    // || col1 | col2 <3||        → recuo direito 3em
    // ||3> col1 | col2 <3||      → ambos
    if (trimmed.startsWith('||') && trimmed.endsWith('||')) {
        // Extrair recuo esquerdo: ||N>
        const leftMatch = trimmed.match(/^\|\|(\d+(?:\.\d+)?)>/);
        const rightMatch = trimmed.match(/<(\d+(?:\.\d+)?)\|\|$/);
        const indentLeft = leftMatch ? parseFloat(leftMatch[1]) : 0;
        const indentRight = rightMatch ? parseFloat(rightMatch[1]) : 0;
        // Remover marcadores e recuos do inner
        let inner = trimmed.slice(2, -2);
        if (leftMatch) inner = inner.slice(leftMatch[1].length + 1); // remove "N>"
        if (rightMatch) inner = inner.slice(0, -(rightMatch[1].length + 1)); // remove "<N"
        const columns = inner.split('|').map(c => c.trim());
        return { type: 'columns', raw: trimmed, columns, indentLeft, indentRight };
    }
    // Justificado forçado: |< texto >|
    if (trimmed.startsWith('|<') && trimmed.endsWith('>|')) {
        return { type: 'justified', raw: trimmed.slice(2, -2).trim() };
    }

    const lower = trimmed.toLowerCase();

    // Título e subtítulo — primeiras linhas não vazias em caixa alta sem dois pontos
    const nonBlanks = allLines.slice(0, index).filter(l => l.trim()).length;
    if (
        nonBlanks < 5 &&
        trimmed.length > 4 &&
        trimmed === trimmed.toUpperCase() &&
        !trimmed.includes(':')
    ) {
        return { type: nonBlanks < 2 ? 'title' : 'subtitle', raw: trimmed };
    }

    // Rótulo — CAIXA ALTA com dois pontos (numerado ou não, aceita vírgula)
    const labelMatch = trimmed.match(LABEL_REGEX);
    if (labelMatch && labelMatch[2] === labelMatch[2].toUpperCase()) {
        return {
            type: 'label',
            raw: trimmed,
            number: labelMatch[1]?.trim(),
            label: labelMatch[2].trim(),
            rest: labelMatch[3].trim(),
        };
    }

    // Assinatura — linha curta com palavra-chave
    if (SIGNATURE_KEYWORDS.some(k => lower.includes(k)) && trimmed.length < 70) {
        return { type: 'signature', raw: trimmed };
    }

    return { type: 'body', raw: trimmed };
}

// ── Renderizador de uma linha ────────────────────────────────
function RenderLine({ parsed, style, lineNum }: {
    parsed: ParsedLine; style: DocStyle; lineNum?: number;
}) {
    const mono = style.fontFamily.includes('Courier');
    const isRetro = style.id === 'retro';

    const inner = (() => {
        switch (parsed.type) {
            case 'blank':
                return <div style={{ height: `${parseFloat(style.lineHeight) * 0.5}em` }} />;

            case 'title':
                return (
                    <p style={{
                        textAlign: 'center',
                        fontWeight: 'bold',
                        fontSize: '1.05em',
                        textTransform: 'uppercase',
                        letterSpacing: isRetro ? '0.15em' : '0.05em',
                        marginBottom: '0.2em',
                        color: '#000',
                        textDecoration: isRetro ? 'underline' : 'none',
                        textUnderlineOffset: '3px',
                    }}>
                        {parsed.raw}
                    </p>
                );

            case 'subtitle':
                return (
                    <p style={{
                        textAlign: 'center',
                        fontSize: '0.9em',
                        color: '#444',
                        marginBottom: '0.3em',
                        fontStyle: isRetro ? 'normal' : 'normal',
                        letterSpacing: isRetro ? '0.08em' : 'normal',
                    }}>
                        {parsed.raw}
                    </p>
                );

            case 'label':
                return (
                    <div style={{ marginTop: '1em', marginBottom: '0.15em' }}>
                        <p style={{ fontWeight: 'bold', color: '#000' }}>
                            {parsed.number && (
                                <span style={{ marginRight: '0.3em' }}>{parsed.number}</span>
                            )}
                            <span style={{ textDecoration: isRetro ? 'underline' : 'none', textUnderlineOffset: '2px' }}>
                                {parsed.label}:
                            </span>
                            {parsed.rest && (
                                <span style={{ fontWeight: 'normal', marginLeft: '0.5em' }}>
                                    {parsed.rest}
                                </span>
                            )}
                        </p>
                    </div>
                );

            case 'signature':
                return (
                    <p style={{
                        textAlign: 'center',
                        fontStyle: 'italic',
                        color: '#555',
                        marginTop: '0.4em',
                    }}>
                        {parsed.raw}
                    </p>
                );

            case 'centered':
                return (
                    <p style={{ textAlign: 'center', color: '#111' }}>
                        {parsed.raw}
                    </p>
                );

            case 'columns':
                return (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '1rem',
                        color: '#111',
                        marginLeft: parsed.indentLeft ? `${parsed.indentLeft}em` : undefined,
                        marginRight: parsed.indentRight ? `${parsed.indentRight}em` : undefined,
                    }}>
                        {(parsed.columns ?? []).map((col, i) => (
                            <span key={i} style={{
                                flex: 1,
                                textAlign: i === 0 ? 'left'
                                    : i === (parsed.columns!.length - 1) ? 'right'
                                        : 'center',
                            }}>
                                {col}
                            </span>
                        ))}
                    </div>
                );

            case 'justified':
                return (
                    <p style={{ textAlign: 'justify', color: '#111' }}>
                        {parsed.raw}
                    </p>
                );

            default: // body
                return (
                    <p style={{
                        textAlign: style.textAlign,
                        textIndent: style.paragraphIndent,
                        color: '#111',
                    }}>
                        {parsed.raw}
                    </p>
                );
        }
    })();

    if (style.showLineNumbers && lineNum !== undefined && parsed.type !== 'blank') {
        return (
            <div style={{ display: 'flex', gap: '1rem' }}>
                <span style={{
                    color: '#aaa',
                    fontSize: '0.7em',
                    width: '1.8rem',
                    flexShrink: 0,
                    paddingTop: '0.25em',
                    textAlign: 'right',
                    userSelect: 'none',
                    fontFamily: "'Courier New', monospace",
                }}>
                    {lineNum}
                </span>
                <div style={{ flex: 1 }}>{inner}</div>
            </div>
        );
    }
    return inner;
}

// ── Cabeçalho por estilo ─────────────────────────────────────
function StyleHeader({ style, companyName, docTitle, cnpj, registerInfo }: {
    style: DocStyle; companyName: string; docTitle: string; cnpj?: string; registerInfo?: string;
}) {
    if (style.headerStyle === 'corporate') {
        return (
            <div style={{
                background: '#000',
                color: '#fff',
                padding: '1.1rem 3rem',   // ← recuo de ~20pt em cada lado
                textAlign: 'center',
                marginBottom: '1.5rem',
            }}>
                <p style={{
                    fontWeight: 'bold',
                    fontSize: '1em',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    margin: 0,
                    lineHeight: '1.4',
                    wordBreak: 'break-word',
                    hyphens: 'auto',
                }}>
                    {companyName}
                </p>
                {(cnpj || registerInfo) && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2.5rem', fontSize: '0.75em', color: '#bbb', marginTop: '0.3rem' }}>
                        {cnpj && <span>CNPJ: {cnpj}</span>}
                        {registerInfo && <span>{registerInfo}</span>}
                    </div>
                )}
                {/* Título do documento — quebra suave, com recuo extra para não colidir com as bordas */}
                <p style={{
                    color: '#ccc',
                    fontSize: '0.82em',
                    margin: '0.45rem 2rem 0',  // ← margem lateral adicional dentro do header
                    letterSpacing: '0.04em',
                    lineHeight: '1.45',
                    wordBreak: 'break-word',
                }}>
                    {docTitle}
                </p>
            </div>
        );
    }
    if (style.headerStyle === 'simple') {
        return (
            <div style={{ textAlign: 'center', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid #000' }}>
                <p style={{ fontWeight: 'bold', fontSize: '1em', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#000', margin: 0 }}>
                    {companyName}
                </p>
                {(cnpj || registerInfo) && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2.5rem', marginTop: '0.3rem', fontSize: '0.78em', color: '#555', letterSpacing: '0.03em' }}>
                        {cnpj && <span>CNPJ: {cnpj}</span>}
                        {registerInfo && <span>{registerInfo}</span>}
                    </div>
                )}
                <p style={{ fontSize: '0.85em', color: '#666', marginTop: '0.35rem' }}>{docTitle}</p>
            </div>
        );
    }
    if (style.headerStyle === 'formal') {
        return (
            <div style={{ textAlign: 'center', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '2px solid #000' }}>
                <p style={{ fontWeight: 'bold', fontSize: '1em', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#000', margin: 0 }}>
                    {companyName}
                </p>
                {(cnpj || registerInfo) && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2.5rem', marginTop: '0.3rem', fontSize: '0.78em', color: '#444', letterSpacing: '0.03em' }}>
                        {cnpj && <span>CNPJ: {cnpj}</span>}
                        {registerInfo && <span>{registerInfo}</span>}
                    </div>
                )}
                <p style={{ fontSize: '0.85em', color: '#555', marginTop: '0.4rem' }}>{docTitle}</p>
            </div>
        );
    }
    // Retro — linha dupla decorativa
    if (style.id === 'retro') {
        return (
            <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
                <div style={{ borderTop: '2px solid #000', borderBottom: '1px solid #000', padding: '0.5rem 0', marginBottom: '0.4rem' }}>
                    <p style={{ fontWeight: 'bold', letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0, fontSize: '0.95em' }}>
                        {companyName}
                    </p>
                    {(cnpj || registerInfo) && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '2.5rem', marginTop: '0.25rem', fontSize: '0.78em', color: '#444', letterSpacing: '0.06em', fontFamily: "'Courier New', monospace" }}>
                            {cnpj && <span>CNPJ: {cnpj}</span>}
                            {registerInfo && <span>{registerInfo}</span>}
                        </div>
                    )}
                </div>
                <p style={{ fontSize: '0.85em', color: '#444', letterSpacing: '0.05em' }}>{docTitle}</p>
            </div>
        );
    }
    return null;
}

// ── Renderizador completo — exportado para AgeView/StatuteView ──
export function RenderDocument({ style, content, companyName, docTitle, cnpj, nire, registerInfo }: {
    style: DocStyle; content: string; companyName: string; docTitle: string; cnpj?: string; nire?: string; registerInfo?: string;
}) {
    const lines = content.split('\n');
    const parsed = lines.map((line, i) => parseLine(line, i, lines));
    let lineCounter = 0;

    return (
        <div style={{
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
            letterSpacing: style.letterSpacing ?? 'normal',
            color: '#111',
            background: '#fff',
        }}>
            <StyleHeader style={style} companyName={companyName} docTitle={docTitle} cnpj={cnpj} registerInfo={registerInfo ?? (nire ? `NIRE: ${nire}` : undefined)} />
            <div style={{ padding: '2.5rem' }}>
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
const SAMPLE_TEXT = `DATA E HORA: Aos 10 de março de 2026, às 14h00.

LOCAL: Sede social da empresa.

PRESENÇA: Totalidade dos sócios representando 100% do capital social.

1. ORDEM DO DIA: Transformação do tipo jurídico da sociedade.

2. DELIBERAÇÕES: Aprovada por unanimidade a transformação da sociedade limitada em sociedade anônima de capital fechado.

Presidente da Mesa
Secretário(a)`;

function PreviewModal({ style, content, companyName, docTitle, onClose, onSelect }: {
    style: DocStyle; content: string; companyName: string; docTitle: string;
    onClose: () => void; onSelect: (id: string) => void;
}) {
    const displayContent = content?.trim() ? content : SAMPLE_TEXT;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                    <div>
                        <h3 className="font-bold text-gray-900">{style.name}</h3>
                        <p className="text-sm text-gray-500">{style.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { onSelect(style.id); onClose(); }}
                            className="flex items-center gap-2 px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors font-medium text-sm"
                        >
                            <FiCheck size={15} />
                            Usar este estilo
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                            <FiX size={18} />
                        </button>
                    </div>
                </div>
                {/* Simula folha A4 */}
                <div className="flex-1 overflow-y-auto bg-gray-200 p-8">
                    <div className="bg-white shadow-lg mx-auto min-h-[900px] overflow-hidden"
                        style={{ maxWidth: '21cm', boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}>
                        <RenderDocument
                            style={style}
                            content={displayContent}
                            companyName={companyName || 'EMPRESA SOCIEDADE LTDA.'}
                            docTitle={docTitle || 'Assembleia Geral Extraordinária'}
                            cnpj="33.000.000/0001-95"
                            registerInfo="NIRE: 35230000000"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── StylePicker ──────────────────────────────────────────────
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
                            Clique para selecionar • passe o mouse para visualizar
                        </p>
                    </div>
                    <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded font-medium">
                        {DOC_STYLES.find(s => s.id === selected)?.name ?? 'Minimalista'}
                    </span>
                </div>

                <div className="grid grid-cols-6 gap-3">
                    {DOC_STYLES.map((style) => {
                        const isSelected = style.id === selected;
                        return (
                            <div
                                key={style.id}
                                className={`relative rounded-lg border-2 overflow-hidden cursor-pointer transition-all group
                                    ${isSelected
                                        ? 'border-gray-900 shadow-md'
                                        : 'border-gray-200 hover:border-gray-400'}`}
                                onClick={() => onChange(style.id)}
                            >
                                <div className="h-24 w-full overflow-hidden bg-white">
                                    {style.thumbnail}
                                </div>
                                <div className={`px-2 py-1.5 text-center border-t ${isSelected ? 'bg-gray-900 border-gray-900' : 'bg-gray-50 border-gray-100'}`}>
                                    <p className={`text-xs font-medium truncate ${isSelected ? 'text-white' : 'text-gray-600'}`}>
                                        {style.name}
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setPreviewStyle(style); }}
                                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black"
                                    title="Visualizar"
                                >
                                    <FiEye size={11} />
                                </button>
                                {isSelected && (
                                    <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center">
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