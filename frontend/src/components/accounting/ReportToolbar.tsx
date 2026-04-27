// frontend/src/components/accounting/ReportToolbar.tsx
//
// Barra flutuante de ações para relatórios contábeis.
// Inclui campos de período editáveis inline — alterar datas e clicar em
// "Atualizar" recarrega o relatório sem abrir o modal de filtros.
//
// Uso:
//   <ReportToolbar
//     title="Diário Geral"
//     dateFrom={filters.dateFrom}
//     dateTo={filters.dateTo}
//     count={data?.total}
//     countLabel="lançamentos"
//     onPeriodChange={(from, to) => { setFilters(...); load(...); }}
//     onFilter={() => setShowModal(true)}
//     onPrint={() => window.print()}
//     onExportCSV={exportCSV}
//     onExportPDF={exportPDF}    // opcional
//     onExportXLSX={exportXLSX}  // opcional
//     hasData={!!data}
//   />

import React, { useState, useEffect } from 'react';
import {
    FiFilter, FiPrinter, FiDownload, FiFileText,
    FiChevronDown, FiRefreshCw,
} from 'react-icons/fi';

interface ReportToolbarProps {
    title: string;
    badge?: string;
    badgeColor?: string;
    badgeBg?: string;
    // Período editável inline
    dateFrom: string;
    dateTo: string;
    onPeriodChange: (dateFrom: string, dateTo: string) => void;
    // Contagem opcional (ex: "633 lançamentos")
    count?: number;
    countLabel?: string;
    // Ações
    onFilter: () => void;
    onPrint?: () => void;
    onExportCSV?: () => void;
    onExportPDF?: () => void;
    onExportXLSX?: () => void;
    hasData: boolean;
    filterLabel?: string;
}

export const ReportToolbar: React.FC<ReportToolbarProps> = ({
    title,
    badge = '◆ Contábil', badgeColor = '#1D4ED8', badgeBg = '#EFF6FF',
    dateFrom, dateTo, onPeriodChange,
    count, countLabel = 'registros',
    onFilter, onPrint, onExportCSV, onExportPDF, onExportXLSX,
    hasData, filterLabel = 'Mais filtros',
}) => {
    const [from, setFrom] = useState(dateFrom);
    const [to, setTo] = useState(dateTo);
    const [dirty, setDirty] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);

    // Sincroniza quando o pai atualiza os valores
    useEffect(() => { setFrom(dateFrom); setTo(dateTo); setDirty(false); }, [dateFrom, dateTo]);

    const handleFromChange = (v: string) => { setFrom(v); setDirty(true); };
    const handleToChange = (v: string) => { setTo(v); setDirty(true); };
    const handleApply = () => { if (from && to) { onPeriodChange(from, to); setDirty(false); } };

    const hasExport = onExportCSV || onExportPDF || onExportXLSX;

    const inpStyle: React.CSSProperties = {
        height: 30, border: '0.5px solid #E5E7EB', borderRadius: 6,
        padding: '0 8px', fontSize: 12, fontWeight: 500,
        color: '#1D4ED8', background: '#F0F9FF',
        outline: 'none', cursor: 'pointer',
        transition: 'border-color 0.15s',
    };

    return (
        <>
            <style>{`
                @media print {
                    .report-toolbar { display: none !important; }
                    .report-page-break { page-break-before: always; }
                }
                @media screen {
                    .report-page-break { border-top: 3px solid #E5E7EB; margin-top: 8px; }
                }
                .rtb-date:hover { border-color: #2563EB !important; }
                .rtb-date:focus { border-color: #2563EB !important; box-shadow: 0 0 0 2px #DBEAFE; }
            `}</style>

            <div
                className="report-toolbar"
                style={{
                    position: 'sticky', top: 12, zIndex: 40,
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', gap: 12,
                    background: '#fff', border: '0.5px solid #E5E7EB',
                    borderRadius: 10, padding: '10px 16px',
                    marginBottom: 16,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                }}
            >
                {/* ── Esquerda: badge + título ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{
                        fontSize: 18, fontWeight: 600, padding: '2px 10px',
                        borderRadius: 20, background: badgeBg, color: badgeColor,
                        whiteSpace: 'nowrap',
                    }}>
                        {badge}
                    </span>
                    <span style={{ fontSize: 20, fontWeight: 600, color: '#111', whiteSpace: 'nowrap' }}>
                        {title}
                    </span>
                </div>

                {/* ── Centro: período editável ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, flex: 1,
                    padding: '6px 14px', background: '#F9FAFB',
                    border: `0.5px solid ${dirty ? '#2563EB' : '#E5E7EB'}`,
                    borderRadius: 8, transition: 'border-color 0.2s',
                }}>
                    <span style={{ fontSize: 18, color: '#9CA3AF', whiteSpace: 'nowrap', fontWeight: 500 }}>
                        Período:
                    </span>
                    <input
                        type="date" value={from} max="9999-12-31"
                        className="rtb-date"
                        onChange={e => handleFromChange(e.target.value)}
                        style={inpStyle}
                    />
                    <span style={{ fontSize: 18, color: '#9CA3AF' }}>até</span>
                    <input
                        type="date" value={to} max="9999-12-31"
                        className="rtb-date"
                        onChange={e => handleToChange(e.target.value)}
                        style={inpStyle}
                    />
                    {/* Botão atualizar — aparece quando há alteração */}
                    {dirty ? (
                        <button
                            onClick={handleApply}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '5px 12px', borderRadius: 6,
                                border: 'none', background: '#2563EB',
                                fontSize: 18, fontWeight: 600, color: '#fff',
                                cursor: 'pointer', whiteSpace: 'nowrap',
                                animation: 'pulse 0.3s ease',
                            }}
                        >
                            <FiRefreshCw size={12} /> Atualizar
                        </button>
                    ) : (
                        count !== undefined && (
                            <span style={{ fontSize: 16, color: '#9CA3AF', whiteSpace: 'nowrap', marginLeft: 4 }}>
                                · {count.toLocaleString('pt-BR')} {countLabel}
                            </span>
                        )
                    )}
                </div>

                {/* ── Direita: ações ── */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>

                    {/* Mais filtros */}
                    <button onClick={onFilter} style={btnSecondary}>
                        <FiFilter size={18} /> {filterLabel}
                    </button>

                    {/* Imprimir */}
                    {onPrint && hasData && (
                        <button onClick={onPrint} style={btnSecondary} title="Imprimir / Salvar PDF">
                            <FiPrinter size={18} /> Imprimir
                        </button>
                    )}

                    {/* Exportar dropdown */}
                    {hasExport && hasData && (
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setExportOpen(o => !o)}
                                style={btnSecondary}
                            >
                                <FiDownload size={18} /> Exportar <FiChevronDown size={11} />
                            </button>
                            {exportOpen && (
                                <>
                                    <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setExportOpen(false)} />
                                    <div style={{
                                        position: 'absolute', top: '100%', right: 0, marginTop: 4,
                                        background: '#fff', border: '0.5px solid #E5E7EB',
                                        borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                                        zIndex: 50, minWidth: 160, overflow: 'hidden',
                                    }}>
                                        {onExportPDF && (
                                            <button onClick={() => { onExportPDF(); setExportOpen(false); }}
                                                style={dropItem}
                                                onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                <FiFileText size={13} color="#B91C1C" /> Salvar PDF
                                            </button>
                                        )}
                                        {onExportXLSX && (
                                            <button onClick={() => { onExportXLSX(); setExportOpen(false); }}
                                                style={dropItem}
                                                onMouseEnter={e => e.currentTarget.style.background = '#F0FDF4'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                <FiDownload size={13} color="#15803D" /> Salvar Excel
                                            </button>
                                        )}
                                        {onExportCSV && (
                                            <button onClick={() => { onExportCSV(); setExportOpen(false); }}
                                                style={dropItem}
                                                onMouseEnter={e => e.currentTarget.style.background = '#F0F9FF'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                <FiDownload size={13} color="#1D4ED8" /> Exportar CSV
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Gerar — só sem dados */}
                    {!hasData && (
                        <button onClick={handleApply} style={btnPrimary}>
                            <FiRefreshCw size={18} /> Gerar relatório
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};

const btnSecondary: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 12px', borderRadius: 8,
    border: '0.5px solid #E5E7EB', background: '#F9FAFB',
    fontSize: 12, fontWeight: 500, color: '#374151', cursor: 'pointer',
    whiteSpace: 'nowrap',
};
const btnPrimary: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 8,
    border: 'none', background: '#111',
    fontSize: 12, fontWeight: 500, color: '#fff', cursor: 'pointer',
    whiteSpace: 'nowrap',
};
const dropItem: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '9px 14px',
    border: 'none', background: 'transparent',
    fontSize: 12, color: '#374151', cursor: 'pointer',
    textAlign: 'left',
};

export default ReportToolbar;