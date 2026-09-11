// frontend/src/pages/accounting/JournalManualImportModal.tsx
// CRIADO 03/09/2026 (Etapa 4 - historico por partida / importacao manual).
// Mesmo padrao visual do IobLotdImportModal.tsx (header "Contabil", modal
// branco arredondado, footer Cancelar/acao). Diferente do IOB: aqui o texto
// fica sempre editavel numa textarea unica, com validacao re-executavel ate
// zerar erros - suporta correcao inline das linhas problematicas sem
// obrigar reupload de arquivo.

import React, { useState, useRef } from 'react';
import { FiUpload, FiCheckCircle, FiAlertTriangle, FiX, FiInfo } from 'react-icons/fi';

interface Props { onClose: () => void; onSuccess?: () => void; }

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

const fmt = (v: string | number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EXEMPLO = `05736256000185|Manual
04072018||4042|2028|Pagto IPTU nesta data|||5635,57
05072018||1001||Aporte de Caixa nesta data|||10000,00
06072018||4042||Pagto IPTU nesta data|||5000,00
06072018|||2028|Aporte AFAC nesta data|||15000,00`;

export const JournalManualImportModal: React.FC<Props> = ({ onClose, onSuccess }) => {
    const [text, setText]         = useState('');
    const [tipo, setTipo]         = useState('Manual');
    // NOVO (10/09/2026): nome real do arquivo carregado - antes era sempre
    // gravado como "manual-import.txt" (nome fixo do Blob), nunca o nome
    // que o usuario de fato carregou (ex: LoteSantander2018.txt).
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
    const [loading, setLoading]   = useState(false);
    const [preview, setPreview]   = useState<any>(null);
    const [result, setResult]     = useState<any>(null);
    const [done, setDone]         = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const fileRef                 = useRef<HTMLInputElement>(null);
    // NOVO (10/09/2026): confirmacao de sobreposicao quando o mesmo arquivo
    // ja foi importado antes - achado real de duplicacao (3 clicks geraram
    // 3x os lancamentos, sem aviso nenhum).
    const [duplicateLotes, setDuplicateLotes] = useState<any[] | null>(null);
    const [duplicateMsg, setDuplicateMsg]     = useState('');

    const token   = localStorage.getItem('@ledgr:token');
    const company = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
    const headers = { Authorization: `Bearer ${token}`, 'x-company-id': company.id ?? '' };

    function handleFocusEmpty() {
        if (!text.trim() && company.taxId) {
            setText(`${company.taxId}|${tipo}\n`);
        }
    }

    function handleFile(f: File) {
        setUploadedFileName(f.name);
        const reader = new FileReader();
        reader.onload = () => setText(String(reader.result ?? ''));
        reader.readAsText(f, 'utf-8');
    }

    async function handleValidate() {
        if (!text.trim()) return;
        setLoading(true);
        try {
            const blob = new Blob([text], { type: 'text/plain' });
            const fd = new FormData();
            fd.append('file', blob, uploadedFileName || 'manual-import.txt');
            const res  = await fetch(`${API}/accounting/journal/preview-manual-import`, { method: 'POST', headers, body: fd });
            const data = await res.json();
            setPreview(data);
        } catch (e: any) { alert(e.message); }
        finally { setLoading(false); }
    }

    async function handleConfirm(overrideDuplicate = false) {
        if (!text.trim() || !preview || preview.hasErrors) return;
        setLoading(true);
        setDuplicateLotes(null);
        try {
            const blob = new Blob([text], { type: 'text/plain' });
            const fd = new FormData();
            fd.append('file', blob, uploadedFileName || 'manual-import.txt');
            if (overrideDuplicate) fd.append('overrideDuplicate', 'true');
            const res  = await fetch(`${API}/accounting/journal/manual-import`, { method: 'POST', headers, body: fd });
            const data = await res.json();

            // NOVO (10/09/2026): backend retorna 400 com duplicateLotes
            // quando o mesmo nome de arquivo ja foi importado - mostra tela
            // de confirmacao em vez de tentar gravar (ou de falhar em
            // silencio como antes).
            if (!res.ok && data?.duplicateLotes) {
                setDuplicateMsg(data.message || 'Arquivo já importado anteriormente.');
                setDuplicateLotes(data.duplicateLotes);
                setLoading(false);
                return;
            }
            if (!res.ok) {
                alert(data?.message || 'Erro ao importar.');
                setLoading(false);
                return;
            }

            setResult(data);
            setDone(true);
            // NAO chama onSuccess aqui - o pai (JournalPage) fecha o modal
            // instantaneamente no onSuccess, impedindo a tela "Importacao
            // concluida" de aparecer. onSuccess so dispara no botao Fechar.
        } catch (e: any) { alert(e.message); }
        finally { setLoading(false); }
    }

    const errors   = preview?.issues?.filter((i: any) => i.severity === 'error')   ?? [];
    const warnings = preview?.issues?.filter((i: any) => i.severity === 'warning') ?? [];

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', borderRadius: 14, width: 720, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#EFF6FF' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#1D4ED8' }}>◆ Contábil</span>
                            <h2 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 500, color: '#111' }}>Importar Lançamentos — Formato Manual</h2>
                        </div>
                        <button onClick={() => setShowHelp(v => !v)} title="Ver layout do arquivo"
                            style={{ background: showHelp ? '#DBEAFE' : 'none', border: '0.5px solid #93C5FD', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#1D4ED8', flexShrink: 0 }}>
                            <FiInfo size={13} />
                        </button>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}><FiX size={18} /></button>
                </div>

                <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>

                    {showHelp && (
                        <div style={{ background: '#F9FAFB', border: '0.5px solid #E5E7EB', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                            <p style={{ fontSize: 12, color: '#374151', margin: '0 0 8px' }}>
                                <strong>Linha 1 (cabeçalho):</strong> <code>CNPJ|Tipo</code> — CNPJ da empresa e tipo do lote (ex: Manual).
                            </p>
                            <p style={{ fontSize: 12, color: '#374151', margin: '0 0 8px' }}>
                                <strong>Demais linhas:</strong> <code>Data|NrLancto|ContaDébito|ContaCrédito|Histórico|HP|Complemento|Valor</code>
                            </p>
                            <ul style={{ fontSize: 12, color: '#6B7280', margin: '0 0 10px', paddingLeft: 18 }}>
                                <li>Data no formato <code>DDMMAAAA</code>, sem separador.</li>
                                <li>NrLancto sempre vazio — a Ledgr atribui automaticamente.</li>
                                <li>Conta por código completo ou código reduzido.</li>
                                <li>Preencha Débito <em>e</em> Crédito na mesma linha para uma partida simples, ou só um dos dois — várias linhas assim (mesma data) se somam automaticamente até débito = crédito, formando uma partida dobrada.</li>
                                <li>HP e Complemento: ainda não utilizados, deixe em branco.</li>
                                <li>Valor no formato <code>1.234,56</code> ou <code>1234,56</code>.</li>
                            </ul>
                            <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 6, padding: 10 }}>
                                <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>Exemplo</div>
                                <pre style={{ margin: 0, fontSize: 11, fontFamily: 'monospace', color: '#374151', whiteSpace: 'pre-wrap' }}>{EXEMPLO}</pre>
                                <button onClick={() => setText(EXEMPLO)}
                                    style={{ marginTop: 8, fontSize: 11, color: '#1D4ED8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                    Usar este exemplo no campo abaixo
                                </button>
                            </div>
                        </div>
                    )}

                    {!done && (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <span style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase' }}>Conteúdo do arquivo</span>
                                <button onClick={() => fileRef.current?.click()}
                                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#374151', background: '#F3F4F6', border: '0.5px solid #E5E7EB', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
                                    <FiUpload size={11} /> Carregar arquivo .txt
                                </button>
                                <input ref={fileRef} type="file" accept=".txt,.TXT" style={{ display: 'none' }}
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                            </div>
                            <textarea
                                value={text}
                                onFocus={handleFocusEmpty}
                                onChange={e => setText(e.target.value)}
                                placeholder="Cole aqui o conteúdo do arquivo (ou clique no ícone i acima para ver o layout esperado)"
                                spellCheck={false}
                                style={{ width: '100%', height: 180, fontFamily: 'monospace', fontSize: 12, padding: 10, border: '0.5px solid #D1D5DB', borderRadius: 8, resize: 'vertical', outline: 'none' }}
                            />

                            {preview && (
                                <div style={{ marginTop: 16 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 12 }}>
                                        {[
                                            { label: 'Lançamentos', value: preview.totalEntries, color: '#111' },
                                            { label: 'Partidas',    value: preview.totalLines,   color: '#374151' },
                                            { label: 'Erros',       value: errors.length,   color: errors.length   > 0 ? '#B91C1C' : '#15803D' },
                                            { label: 'Avisos',      value: warnings.length, color: warnings.length > 0 ? '#C2410C' : '#15803D' },
                                        ].map(k => (
                                            <div key={k.label} style={{ background: '#F9FAFB', border: '0.5px solid #E5E7EB', borderRadius: 8, padding: '8px 12px' }}>
                                                <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 2 }}>{k.label}</div>
                                                <div style={{ fontSize: 18, fontWeight: 500, color: k.color }}>{k.value ?? 0}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {errors.length > 0 && (
                                        <div style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                                <FiAlertTriangle size={13} color="#B91C1C" />
                                                <span style={{ fontSize: 12, fontWeight: 500, color: '#B91C1C' }}>Corrija estas linhas antes de importar</span>
                                            </div>
                                            <div style={{ maxHeight: 140, overflowY: 'auto' }}>
                                                {errors.map((iss: any, i: number) => (
                                                    <div key={i} style={{ fontSize: 11, color: '#B91C1C', marginBottom: 2 }}>
                                                        {iss.lineNum ? `Linha ${iss.lineNum}: ` : ''}{iss.reason}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {warnings.length > 0 && (
                                        <div style={{ background: '#FFF7ED', border: '0.5px solid #FED7AA', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                                            <div style={{ fontSize: 12, fontWeight: 500, color: '#C2410C', marginBottom: 6 }}>Avisos (não bloqueiam a importação)</div>
                                            <div style={{ maxHeight: 100, overflowY: 'auto' }}>
                                                {warnings.map((iss: any, i: number) => (
                                                    <div key={i} style={{ fontSize: 11, color: '#C2410C', marginBottom: 2 }}>
                                                        {iss.lineNum ? `Linha ${iss.lineNum}: ` : ''}{iss.reason}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {preview.entries?.length > 0 && (
                                        <div>
                                            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase' }}>
                                                Prévia — {preview.entries.length} de {preview.totalEntries} lançamento(s)
                                            </div>
                                            <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                                    <thead>
                                                        <tr style={{ background: '#F9FAFB' }}>
                                                            {['Data', 'Histórico', 'Partidas', 'Débito', 'Crédito', 'OK'].map(h => (
                                                                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, color: '#6B7280', fontWeight: 500, textTransform: 'uppercase', borderBottom: '0.5px solid #E5E7EB' }}>{h}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {preview.entries.map((p: any, i: number) => (
                                                            <tr key={i} style={{ borderBottom: '0.5px solid #F5F5F5' }}>
                                                                <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>{p.date?.split('-').reverse().join('/')}</td>
                                                                <td style={{ padding: '5px 10px', color: '#374151', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</td>
                                                                <td style={{ padding: '5px 10px', color: '#9CA3AF', textAlign: 'center' }}>{p.itemCount}</td>
                                                                <td style={{ padding: '5px 10px', fontFamily: 'monospace', textAlign: 'right', color: '#2563EB' }}>{fmt(p.debitTotal)}</td>
                                                                <td style={{ padding: '5px 10px', fontFamily: 'monospace', textAlign: 'right', color: '#15803D' }}>{fmt(p.creditTotal)}</td>
                                                                <td style={{ padding: '5px 10px', textAlign: 'center' }}>{p.balanced ? '✓' : '✗'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {duplicateLotes && duplicateLotes.length > 0 && (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <FiAlertTriangle size={40} color="#C2410C" style={{ marginBottom: 12 }} />
                            <h3 style={{ fontSize: 16, fontWeight: 500, color: '#111', margin: '0 0 8px' }}>Arquivo já importado</h3>
                            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>{duplicateMsg}</p>
                            <div style={{ border: '0.5px solid #FED7AA', background: '#FFF7ED', borderRadius: 8, padding: 12, textAlign: 'left', marginBottom: 4 }}>
                                {duplicateLotes.map((d: any) => (
                                    <div key={d.id} style={{ fontSize: 12, color: '#9A3412', marginBottom: 4 }}>
                                        Lote {d.numero}/{d.ano} — {d.quantidadeLancamentos} lançamento(s) — importado em {new Date(d.createdAt).toLocaleString('pt-BR')}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {done && result && (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <FiCheckCircle size={40} color="#15803D" style={{ marginBottom: 12 }} />
                            <h3 style={{ fontSize: 16, fontWeight: 500, color: '#111', margin: '0 0 8px' }}>Importação concluída</h3>
                            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>{result.inserted} lançamento(s) importado(s).</p>

                            {/* NOVO (10/09/2026): capa de lote - resumo por ano tocado pelo arquivo */}
                            {result.lotes?.map((l: any) => (
                                <div key={`${l.ano}-${l.numero}`} style={{ border: '0.5px solid #BBF7D0', background: '#F0FDF4', borderRadius: 8, padding: 14, textAlign: 'left', marginBottom: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>Lote nº {l.numero} / {l.ano}</span>
                                        <span style={{ fontSize: 12, color: '#6B7280' }}>{l.nomeArquivo}</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}>
                                        Período: {new Date(l.dataInicial + 'T00:00:00').toLocaleDateString('pt-BR')} a {new Date(l.dataFinal + 'T00:00:00').toLocaleDateString('pt-BR')}
                                    </div>
                                    <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                                        <span style={{ color: '#6B7280' }}>{l.quantidadeLancamentos} lançamento(s)</span>
                                        <span style={{ color: '#2563EB' }}>D: {fmt(l.totalDebito)}</span>
                                        <span style={{ color: '#15803D' }}>C: {fmt(l.totalCredito)}</span>
                                    </div>
                                </div>
                            ))}

                            {result.errors?.length > 0 && (
                                <div style={{ marginTop: 8 }}>
                                    {result.errors.map((e: any, i: number) => (
                                        <p key={i} style={{ fontSize: 12, color: '#B91C1C', margin: 0 }}>{e.ref}: {e.reason}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '12px 20px', borderTop: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => { if (done) onSuccess?.(); onClose(); }} style={{ padding: '8px 16px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}>
                        {done ? 'Fechar' : 'Cancelar'}
                    </button>
                    {!done && duplicateLotes && duplicateLotes.length > 0 && (
                        <>
                            <button onClick={() => setDuplicateLotes(null)} disabled={loading}
                                style={{ padding: '8px 18px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}>
                                Cancelar
                            </button>
                            <button onClick={() => handleConfirm(true)} disabled={loading}
                                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#C2410C', color: '#fff', fontSize: 13, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
                                {loading ? 'Sobrepondo...' : 'Sobrepor lote existente'}
                            </button>
                        </>
                    )}
                    {!done && !(duplicateLotes && duplicateLotes.length > 0) && (
                        <>
                            <button onClick={handleValidate} disabled={!text.trim() || loading}
                                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563EB', color: '#fff', fontSize: 13, cursor: 'pointer', opacity: !text.trim() || loading ? 0.5 : 1 }}>
                                {loading ? 'Validando...' : 'Validar'}
                            </button>
                            <button onClick={() => handleConfirm(false)} disabled={!preview || preview.hasErrors || loading}
                                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#111', color: '#fff', fontSize: 13, cursor: 'pointer', opacity: !preview || preview.hasErrors || loading ? 0.5 : 1 }}>
                                {loading ? 'Importando...' : 'Confirmar Importação'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
