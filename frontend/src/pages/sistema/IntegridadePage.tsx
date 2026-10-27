// frontend/src/pages/sistema/IntegridadePage.tsx
// CRIADO 27/10/2026 - Central de Integridade: verificacoes automaticas de consistencia da escrituracao
import React, { useCallback, useEffect, useState } from 'react';
import { FiShield, FiPlay, FiAlertOctagon, FiAlertTriangle, FiInfo, FiCheckCircle, FiChevronDown, FiChevronRight, FiClock, FiPrinter, FiCopy, FiDownload, FiShare2 } from 'react-icons/fi';
import api from '../../services/api';
import { useCompany } from '../../contexts/CompanyContext';

type Sev = 'CRITICO' | 'ALERTA' | 'INFO';
interface Achado { code: string; severity: Sev; title: string; detail: string; qtd: number; valor: number | null; amostra: any[] }
interface Execucao { id: string; started_at: string; finished_at: string; triggered_by: string; total_findings: number; criticos: number; alertas: number; infos: number; summary?: any }

const SEV: Record<Sev, { label: string; bg: string; fg: string; borda: string; icon: React.ReactNode }> = {
  CRITICO: { label: 'Crítico', bg: '#FEE2E2', fg: '#991B1B', borda: '#EF4444', icon: <FiAlertOctagon size={14} /> },
  ALERTA:  { label: 'Alerta',  bg: '#FEF3C7', fg: '#92400E', borda: '#F59E0B', icon: <FiAlertTriangle size={14} /> },
  INFO:    { label: 'Info',    bg: '#DBEAFE', fg: '#1E40AF', borda: '#3B82F6', icon: <FiInfo size={14} /> },
};
const BRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataHora = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-');
const ROTULO: Record<string, string> = {
  data: 'Data', historico: 'Histórico', origem: 'Origem', debito: 'Débito', credito: 'Crédito', partidas: 'Partidas',
  conta: 'Conta', nome: 'Nome', data_abertura: 'Abertura', lanc_anteriores: 'Lanç. anteriores', desde: 'Desde', saldo_anterior: 'Saldo anterior',
  de: 'De', ate: 'Até', meses: 'Meses', tipo: 'Tipo', natureza: 'Natureza', saldo_devedor: 'Saldo (D+ / C-)',
  ativo: 'Bem', descricao: 'Descrição', custo: 'Custo', bens: 'Bens', custo_cadastro: 'Custo no cadastro', saldo_contabil: 'Saldo contábil', diferenca: 'Diferença',
  competencia: 'Competência', valor: 'Valor', titulo: 'Título', vencimento: 'Vencimento', status: 'Status', problema: 'Problema',
  receita_apuracao: 'Receita na apuração', receita_contabil: 'Receita contábil', item: 'Item', situacao: 'Situação', regime_atual: 'Regime atual',
};
const OCULTAS = new Set(['id', 'ultimo']);
// o banco (jsonb) devolve as chaves fora de ordem: a ordem das colunas segue a lista do ROTULO
const ORDEM = Object.keys(ROTULO);
const colunas = (linhas: any[]) => Object.keys(linhas[0] ?? {}).filter(c => !OCULTAS.has(c))
  .sort((a, b) => (ORDEM.indexOf(a) < 0 ? 999 : ORDEM.indexOf(a)) - (ORDEM.indexOf(b) < 0 ? 999 : ORDEM.indexOf(b)));
const fmtCel = (v: any, c: string) => {
  if (v === null || v === undefined || v === '') return '-';
  if (typeof v === 'number' && !['partidas', 'lanc_anteriores', 'meses', 'bens', 'qtd'].includes(c)) return BRL(v);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split('-').reverse().join('/');
  return String(v);
};

// ── Relatorio em Markdown (copiar para colar no chat / baixar) ──
const achadoMd = (a: Achado) => {
  const s = SEV[a.severity] ?? SEV.INFO;
  const l: string[] = [`### [${s.label.toUpperCase()}] ${a.title}`, `Código: ${a.code}` + (a.valor !== null && a.valor !== undefined ? ` · Valor: R$ ${BRL(Number(a.valor))}` : '') + ` · Qtd: ${a.qtd}`, '', a.detail, ''];
  if (a.amostra?.length) {
    const cols = colunas(a.amostra);
    l.push('| ' + cols.map(c => ROTULO[c] ?? c).join(' | ') + ' |', '|' + cols.map(() => '---').join('|') + '|');
    a.amostra.forEach(r => l.push('| ' + cols.map(c => fmtCel(r[c], c).replace(/\|/g, '/')).join(' | ') + ' |'));
    if (a.amostra.length < a.qtd) l.push('', `(amostra: ${a.amostra.length} de ${a.qtd})`);
    l.push('');
  }
  return l.join('\n');
};
const relatorioMd = (empresa: string, exec: Execucao | null, achados: Achado[]) => [
  `# Central de Integridade - ${empresa}`,
  `Verificação de ${exec ? new Date(exec.finished_at).toLocaleString('pt-BR') : '-'} (${exec?.triggered_by ?? '-'}) · ` +
  `${achados.filter(a => a.severity === 'CRITICO').length} crítico(s), ${achados.filter(a => a.severity === 'ALERTA').length} alerta(s), ${achados.filter(a => a.severity === 'INFO').length} info`,
  '', ...achados.map(achadoMd)].join('\n');
const copiar = async (texto: string) => {
  try { await navigator.clipboard.writeText(texto); return true; }
  catch {
    const t = document.createElement('textarea'); t.value = texto; document.body.appendChild(t); t.select();
    const ok = document.execCommand('copy'); document.body.removeChild(t); return ok;
  }
};
const baixar = (nome: string, texto: string) => {
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = nome; a.click(); URL.revokeObjectURL(url);
};

const pill = (bg: string, fg: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 500, background: bg, color: fg, whiteSpace: 'nowrap' });

const Tabela: React.FC<{ linhas: any[] }> = ({ linhas }) => {
  if (!linhas?.length) return null;
  const cols = colunas(linhas);
  const fmt = fmtCel;
  return (
    <div style={{ overflowX: 'auto', borderTop: '0.5px solid #E5E7EB' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr>{cols.map(c => (
          <th key={c} style={{ textAlign: typeof linhas[0][c] === 'number' ? 'right' : 'left', padding: '6px 10px', background: '#F9FAFB', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '0.5px solid #E5E7EB' }}>{ROTULO[c] ?? c}</th>
        ))}</tr></thead>
        <tbody>{linhas.map((l, i) => (
          <tr key={i} style={{ borderBottom: '0.5px solid #F3F4F6' }}>{cols.map(c => (
            <td key={c} style={{ padding: '5px 10px', textAlign: typeof l[c] === 'number' ? 'right' : 'left', color: typeof l[c] === 'number' && l[c] < 0 ? '#B91C1C' : '#111', whiteSpace: c === 'historico' || c === 'nome' || c === 'item' ? 'normal' : 'nowrap' }}>{fmt(l[c], c)}</td>
          ))}</tr>
        ))}</tbody>
      </table>
    </div>
  );
};

const CardAchado: React.FC<{ a: Achado; forcarAberto?: boolean; onCopiado: (m: string) => void }> = ({ a, forcarAberto, onCopiado }) => {
  const [abertoUser, setAberto] = useState(a.severity === 'CRITICO');
  const aberto = forcarAberto || abertoUser;
  const s = SEV[a.severity] ?? SEV.INFO;
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderLeft: '3px solid ' + s.borda, borderRadius: 10, overflow: 'hidden' }}>
      <div onClick={() => setAberto(v => !v)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0.8rem 1rem', cursor: 'pointer' }}>
        <span style={{ marginTop: 1, color: '#9CA3AF' }}>{aberto ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={pill(s.bg, s.fg)}>{s.icon} {s.label}</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#111' }}>{a.title}</span>
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4, lineHeight: 1.45 }}>{a.detail}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {a.valor !== null && a.valor !== undefined && <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>R$ {BRL(Number(a.valor))}</div>}
          <div style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace' }}>{a.code}</div>
          <button className="no-print" title="Copiar este achado (para colar no chat)"
            onClick={async e => { e.stopPropagation(); onCopiado((await copiar(achadoMd(a))) ? 'Achado copiado' : 'Não foi possível copiar'); }}
            style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#0369A1', background: 'none', border: '0.5px solid #BFDBFE', borderRadius: 6, padding: '2px 7px', cursor: 'pointer' }}>
            <FiCopy size={11} /> Copiar
          </button>
        </div>
      </div>
      {aberto && <Tabela linhas={a.amostra} />}
      {aberto && a.amostra?.length >= 60 && <div style={{ fontSize: 11, color: '#9CA3AF', padding: '6px 12px' }}>Mostrando os 60 primeiros de {a.qtd}.</div>}
    </div>
  );
};

export default function IntegridadePage() {
  const { activeCompany } = useCompany();
  const [exec, setExec] = useState<Execucao | null>(null);
  const [achados, setAchados] = useState<Achado[]>([]);
  const [hist, setHist] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState('');
  const [menu, setMenu] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);
  const [aviso, setAviso] = useState('');
  const empresa = activeCompany?.legalName ?? activeCompany?.tradeName ?? '';
  const avisar = (m: string) => { setAviso(m); setTimeout(() => setAviso(''), 2500); };
  const imprimir = () => { setMenu(false); setImprimindo(true); setTimeout(() => { window.print(); setImprimindo(false); }, 150); };

  const carregar = useCallback(async () => {
    if (!activeCompany?.id) return;
    setCarregando(true); setErro('');
    try {
      const [u, h] = await Promise.all([api.get('/integridade/ultima'), api.get('/integridade/historico')]);
      setExec(u.data?.execucao ?? null); setAchados(u.data?.achados ?? []); setHist(h.data ?? []);
    } catch { setErro('Não foi possível carregar a Central de Integridade.'); }
    setCarregando(false);
  }, [activeCompany?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  const executar = async () => {
    setRodando(true); setErro('');
    try {
      const r = await api.post('/integridade/executar');
      setExec(r.data?.execucao ?? null); setAchados(r.data?.achados ?? []);
      const h = await api.get('/integridade/historico'); setHist(h.data ?? []);
    } catch (e: any) { setErro(e?.response?.data?.message ?? 'Falha ao executar as verificações.'); }
    setRodando(false);
  };

  const n = (s: Sev) => achados.filter(a => a.severity === s).length;

  return (
    <div id="integridade-print" style={{ maxWidth: 1200, margin: '0 auto' }} onClick={() => menu && setMenu(false)}>
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #integridade-print, #integridade-print * { visibility: visible !important; }
        #integridade-print { position: absolute; left: 0; top: 0; width: 100%; max-width: none !important; }
        #integridade-print .no-print { display: none !important; }
        @page { size: A4 landscape; margin: 12mm; }
      }`}</style>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}><FiShield color="#0369A1" /> Central de Integridade</h1>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
            {activeCompany?.legalName ?? activeCompany?.tradeName ?? ''} · Verificações automáticas de consistência da escrituração (somente leitura)
          </p>
        </div>
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {aviso && <span style={{ fontSize: 12, color: '#166534' }}>{aviso}</span>}
        {exec && (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setMenu(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: '#fff', color: '#374151', border: '0.5px solid #D1D5DB', fontSize: 13, cursor: 'pointer' }}>
              <FiShare2 size={13} /> Exportar <FiChevronDown size={12} />
            </button>
            {menu && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 20, background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', minWidth: 270, overflow: 'hidden' }}>
                {[
                  { ic: <FiPrinter size={14} />, t: 'Imprimir / salvar em PDF', s: 'Todos os achados abertos', f: imprimir },
                  { ic: <FiCopy size={14} />, t: 'Copiar relatório completo', s: 'Texto com tabelas, para colar no chat', f: async () => { setMenu(false); avisar((await copiar(relatorioMd(empresa, exec, achados))) ? 'Relatório copiado' : 'Não foi possível copiar'); } },
                  { ic: <FiDownload size={14} />, t: 'Baixar relatório (.md)', s: 'Arquivo para anexar ou arquivar', f: () => { setMenu(false); baixar(`integridade_${(empresa || 'empresa').split(' ')[0]}_${new Date().toISOString().slice(0, 10)}.md`, relatorioMd(empresa, exec, achados)); } },
                ].map(o => (
                  <div key={o.t} onClick={o.f} style={{ display: 'flex', gap: 10, padding: '0.6rem 0.9rem', cursor: 'pointer', borderBottom: '0.5px solid #F3F4F6' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')} onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                    <span style={{ color: '#0369A1', marginTop: 2 }}>{o.ic}</span>
                    <div><div style={{ fontSize: 13, color: '#111' }}>{o.t}</div><div style={{ fontSize: 11, color: '#9CA3AF' }}>{o.s}</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <button onClick={executar} disabled={rodando || !activeCompany?.id}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#111', color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer', opacity: rodando ? 0.6 : 1 }}>
          <FiPlay size={13} /> {rodando ? 'Verificando...' : 'Executar verificações'}
        </button>
        </div>
      </div>

      {erro && <div style={{ ...pill(SEV.CRITICO.bg, SEV.CRITICO.fg), borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>{erro}</div>}

      {!carregando && !exec && (
        <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: '2rem', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
          Nenhuma verificação executada para esta empresa. Clique em <b>Executar verificações</b>.
        </div>
      )}

      {exec && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
            {([['CRITICO', n('CRITICO')], ['ALERTA', n('ALERTA')], ['INFO', n('INFO')]] as [Sev, number][]).map(([s, q]) => (
              <div key={s} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderLeft: '3px solid ' + SEV[s].borda, borderRadius: 10, padding: '0.8rem 1rem' }}>
                <div style={{ fontSize: 11, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 5 }}>{SEV[s].icon} {SEV[s].label}{q === 1 ? '' : 's'}</div>
                <div style={{ fontSize: 22, fontWeight: 500, color: q ? SEV[s].fg : '#111' }}>{q}</div>
              </div>
            ))}
            <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderLeft: '3px solid #9CA3AF', borderRadius: 10, padding: '0.8rem 1rem' }}>
              <div style={{ fontSize: 11, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 5 }}><FiClock size={13} /> Última verificação</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#111', marginTop: 4 }}>{dataHora(exec.finished_at)}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>{exec.triggered_by === 'MANUAL' ? 'manual' : exec.triggered_by.toLowerCase()}</div>
            </div>
          </div>

          {exec.summary?.erros?.length > 0 && (
            <div style={{ ...pill(SEV.ALERTA.bg, SEV.ALERTA.fg), borderRadius: 8, padding: '8px 12px', marginBottom: 10, whiteSpace: 'normal' }}>
              {exec.summary.erros.length} verificação(ões) não puderam rodar: {exec.summary.erros.map((e: any) => e.verificacao + ' (' + e.erro + ')').join('; ')}
            </div>
          )}

          {achados.length === 0 ? (
            <div style={{ background: '#F0FDF4', border: '0.5px solid #BBF7D0', borderRadius: 10, padding: '1.25rem', display: 'flex', alignItems: 'center', gap: 8, color: '#166534', fontSize: 14 }}>
              <FiCheckCircle /> Nenhuma inconsistência encontrada nas {exec.summary?.verificacoes ?? ''} verificações.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{achados.map(a => <CardAchado key={a.code} a={a} forcarAberto={imprimindo} onCopiado={avisar} />)}</div>
          )}
        </>
      )}

      {hist.length > 0 && (
        <>
          <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', padding: '1.25rem 0 0.5rem' }}>Histórico de verificações</p>
          <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
            {hist.map((h, i) => (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.55rem 1rem', borderBottom: i === hist.length - 1 ? 'none' : '0.5px solid #F3F4F6', fontSize: 12 }}>
                <span style={{ width: 120, color: '#111' }}>{dataHora(h.started_at)}</span>
                <span style={{ width: 70, color: '#9CA3AF' }}>{String(h.triggered_by).toLowerCase()}</span>
                <span style={pill(h.criticos ? SEV.CRITICO.bg : '#F3F4F6', h.criticos ? SEV.CRITICO.fg : '#6B7280')}>{h.criticos} crít.</span>
                <span style={pill(h.alertas ? SEV.ALERTA.bg : '#F3F4F6', h.alertas ? SEV.ALERTA.fg : '#6B7280')}>{h.alertas} alertas</span>
                <span style={pill(h.infos ? SEV.INFO.bg : '#F3F4F6', h.infos ? SEV.INFO.fg : '#6B7280')}>{h.infos} info</span>
                <span style={{ flex: 1, color: '#9CA3AF', fontFamily: 'monospace', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.verificacoes ?? ''}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
