// frontend/src/pages/sped/RegimeConferenciaPage.tsx
// ============================================================================
// REGIMES x DECLARACOES - CRIADO 16/11/2026
// Confere o regime cadastrado (cadastro da empresa) com o declarado nas ECFs do
// arquivo fiel (registro 0010). Tela de consulta; a unica acao que grava e
// "Criar regime a partir da ECF" (so Master, so exercicios sem cadastro).
// ============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { useCompany } from '../../contexts/CompanyContext';

interface Cad { id: string; dtIni: string; dtFin: string | null; forma: string; formaDescricao: string; apuracao: string | null; tipEscPre: string | null; criterioReceita: string | null; }
interface Dec { arquivoId: string; fileName: string; dtIni: string; dtFin: string; codVer: string | null; retificadora: string; numRec: string | null; loadedAt: string; forma: string | null; formaDescricao: string | null; apuracao: string | null; qualificacao: string | null; tipEscPre: string | null; indRecReceita: string | null; }
interface Linha { ano: number; situacao: string; cadastro: Cad[]; declarado: Dec | null; observacoes: string[]; }
interface Resp { linhas: Linha[]; resumo: Record<string, number>; master?: boolean; }

const FIN_ACCENT = '#2563EB';
const SIT: Record<string, { rotulo: string; cor: string }> = {
  confere: { rotulo: 'Confere', cor: '#16A34A' },
  diverge: { rotulo: 'Diverge', cor: '#DC2626' },
  sem_cadastro: { rotulo: 'Sem cadastro', cor: '#B45309' },
  sem_declaracao: { rotulo: 'Sem ECF carregada', cor: '#B45309' },
  no_prazo: { rotulo: 'ECF ainda no prazo', cor: '#6B7280' },
  anterior_ecf: { rotulo: 'Anterior à ECF', cor: '#6B7280' },
  sem_dados: { rotulo: 'Sem dados', cor: '#6B7280' },
};
const APUR: Record<string, string> = { A: 'Anual', T: 'Trimestral' };
const ESC: Record<string, string> = { L: 'Livro Caixa', C: 'Escrituração contábil' };
const CRIT: Record<string, string> = { '1': 'Caixa', '2': 'Competência' };
const fmtD = (iso?: string | null) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '-');
const junta = (p: (string | null | undefined | false)[]) => p.filter(Boolean).join(' - ');

const S = {
  page: { padding: '24px 0', fontFamily: 'var(--font-sans,system-ui)', fontSize: 14, color: 'var(--color-text-primary)' } as React.CSSProperties,
  card: { background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: '16px 20px', marginBottom: 16 } as React.CSSProperties,
  kpi: { background: 'var(--color-background-secondary)', borderRadius: 8, padding: '10px 14px', minWidth: 120 } as React.CSSProperties,
  kpiL: { fontSize: 10, textTransform: 'uppercase' as const, color: 'var(--color-text-secondary)', marginBottom: 4 },
  kpiV: { fontSize: 18, fontWeight: 600 },
  btn: (c = '#111') => ({ height: 32, border: 'none', borderRadius: 6, padding: '0 16px', fontSize: 12, cursor: 'pointer', background: c, color: '#fff', fontWeight: 500 } as React.CSSProperties),
  btnO: { height: 32, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '0 12px', fontSize: 12, cursor: 'pointer', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)' } as React.CSSProperties,
  badge: (c: string) => ({ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: c + '22', color: c, whiteSpace: 'nowrap' as const } as React.CSSProperties),
  th: { background: 'var(--color-background-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, padding: '7px 10px', textAlign: 'left' as const, borderBottom: '0.5px solid var(--color-border-tertiary)', color: 'var(--color-text-secondary)' },
  td: { padding: '8px 10px', fontSize: 12, borderBottom: '0.5px solid var(--color-border-tertiary)', verticalAlign: 'top' as const },
  sub: { fontSize: 11, color: 'var(--color-text-secondary)' } as React.CSSProperties,
};

export default function RegimeConferenciaPage() {
  const ctx: any = useCompany();
  const companyId = ctx?.activeCompany?.id ?? ctx?.company?.id ?? ctx?.selectedCompany?.id ?? ctx?.companyId ?? null;
  const [dados, setDados] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const { data } = await api.get('/sped/regime-conferencia');
      setDados(data);
    } catch (e: any) {
      setDados(null);
      setErro(e?.response?.data?.message || 'Erro ao carregar a conferência.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setConfirmar(false);
    if (companyId) carregar();
    else setDados(null);
  }, [companyId, carregar]);

  const criar = async () => {
    setCriando(true);
    try {
      const { data } = await api.post('/sped/regime-conferencia/criar-regimes');
      const n = (data?.criados ?? []).length;
      toast.success(n + ' regime(s) criado(s) a partir das ECFs.');
      setConfirmar(false);
      await carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao criar os regimes.');
    } finally {
      setCriando(false);
    }
  };

  const linhas = dados?.linhas ?? [];
  const res = dados?.resumo ?? {};
  const semCadastro = linhas.filter((l) => l.situacao === 'sem_cadastro');
  const kpis: [string, string][] = [['confere', '#16A34A'], ['diverge', '#DC2626'], ['sem_cadastro', '#B45309'], ['sem_declaracao', '#B45309']];

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>SPED - Conferência</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>Regimes x Declarações</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Regime tributário do cadastro da empresa conferido com o que foi declarado nas ECFs entregues (registro 0010 do arquivo fiel), ano a ano.</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={S.btnO} onClick={carregar} disabled={loading || !companyId}>{loading ? 'Atualizando...' : 'Atualizar'}</button>
          {dados?.master && semCadastro.length > 0 && !confirmar && (
            <button style={S.btn(FIN_ACCENT)} onClick={() => setConfirmar(true)}>Criar regime a partir da ECF</button>
          )}
        </div>
      </div>

      {!companyId && <div style={S.card}>Selecione uma empresa.</div>}
      {erro && <div style={{ background: '#FCEBEB', color: '#991B1B', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 12 }}>{erro}</div>}

      {confirmar && (
        <div style={{ background: '#EFF6FF', borderLeft: '3px solid ' + FIN_ACCENT, borderRadius: 6, padding: '10px 14px', fontSize: 12, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <b>Criar regime para {semCadastro.length} exercício(s) sem cadastro</b> ({semCadastro.map((l) => l.ano).join(', ')}), conforme declarado nas ECFs.
            Exercícios seguidos com a mesma declaração viram um único período. Nenhum regime já cadastrado é alterado.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={S.btnO} onClick={() => setConfirmar(false)} disabled={criando}>Cancelar</button>
            <button style={S.btn(FIN_ACCENT)} onClick={criar} disabled={criando}>{criando ? 'Criando...' : 'Confirmar'}</button>
          </div>
        </div>
      )}

      {companyId && dados && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            {kpis.map(([k, cor]) => (
              <div key={k} style={S.kpi}>
                <div style={S.kpiL}>{SIT[k].rotulo}</div>
                <div style={{ ...S.kpiV, color: (res[k] ?? 0) > 0 ? cor : 'var(--color-text-primary)' }}>{res[k] ?? 0}</div>
              </div>
            ))}
          </div>

          <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width: 60 }}>Ano</th>
                  <th style={S.th}>Regime no cadastro</th>
                  <th style={S.th}>Declarado na ECF</th>
                  <th style={S.th}>Arquivo</th>
                  <th style={{ ...S.th, width: 150 }}>Situação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 && (
                  <tr><td style={S.td} colSpan={5}>Nenhum regime cadastrado e nenhuma ECF carregada no arquivo fiel desta empresa.</td></tr>
                )}
                {linhas.map((l) => {
                  const s = SIT[l.situacao] ?? { rotulo: l.situacao, cor: '#6B7280' };
                  const d = l.declarado;
                  return (
                    <tr key={l.ano}>
                      <td style={{ ...S.td, fontWeight: 600 }}>{l.ano}</td>
                      <td style={S.td}>
                        {l.cadastro.length === 0 && <span style={S.sub}>-</span>}
                        {l.cadastro.map((c) => (
                          <div key={c.id} style={{ marginBottom: 4 }}>
                            <b>{c.forma} - {c.formaDescricao}</b>
                            <div style={S.sub}>{junta([c.apuracao ? APUR[c.apuracao] ?? c.apuracao : null, c.tipEscPre ? ESC[c.tipEscPre] ?? c.tipEscPre : null, c.criterioReceita])}</div>
                            <div style={S.sub}>{fmtD(c.dtIni)} a {c.dtFin ? fmtD(c.dtFin) : 'atual'}</div>
                          </div>
                        ))}
                      </td>
                      <td style={S.td}>
                        {!d && <span style={S.sub}>-</span>}
                        {d && (
                          <div>
                            <b>{d.forma ? d.forma + ' - ' + d.formaDescricao : 'Registro 0010 não localizado'}</b>
                            <div style={S.sub}>{junta([d.apuracao ? APUR[d.apuracao] ?? d.apuracao : null, d.tipEscPre ? ESC[d.tipEscPre] ?? d.tipEscPre : null, d.indRecReceita ? CRIT[d.indRecReceita] ?? d.indRecReceita : null])}</div>
                            <div style={S.sub}>{fmtD(d.dtIni)} a {fmtD(d.dtFin)}</div>
                          </div>
                        )}
                      </td>
                      <td style={S.td}>
                        {!d && <span style={S.sub}>-</span>}
                        {d && (
                          <div>
                            <div>{junta([d.retificadora === 'S' ? 'Retificadora' : 'Original', d.codVer ? 'leiaute ' + d.codVer : null])}</div>
                            {d.numRec && <div style={S.sub}>Recibo anterior: {d.numRec}</div>}
                            <div style={{ ...S.sub, wordBreak: 'break-all' }}>{d.fileName}</div>
                          </div>
                        )}
                      </td>
                      <td style={S.td}>
                        <span style={S.badge(s.cor)}>{s.rotulo}</span>
                        {l.observacoes.map((o, i) => <div key={i} style={{ ...S.sub, marginTop: 4 }}>{o}</div>)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={S.sub}>
            O declarado vem das ECFs carregadas em SPED - ECF - Análise do LALUR (consulta). Para alterar um regime já cadastrado, use o cadastro da empresa (aba SPED).
            A EFD-Contribuições ainda não entra nesta conferência.
          </div>
        </>
      )}
    </div>
  );
}
