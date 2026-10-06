// frontend/src/pages/projects/workspace/EstruturaSeries1Projeto.tsx
// Series#1 - Etapa B (05/10/2026), so o Master: subordinacao dos cotistas (passivos da HOTELSYS), divida da REAL com a F5
// (compensacao de 10% dos aportes), parametros da serie e registro de quotas.
import React, { useCallback, useEffect, useState } from 'react';
import api from '../../../services/api';
import { cardSt, thSt, tdSt, erroSt, secTitle, tituloSt, subtituloSt, fmtBRL, fmtData } from './projetoTema';
import SaldoInformadoModal from './SaldoInformadoModal';

const pc = (v: number, d = 2) => (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
const linha = (rot: string, val: React.ReactNode, forte?: boolean) => (
  <tr><td style={tdSt}>{rot}</td><td style={{ ...tdSt, textAlign: 'right', fontWeight: forte ? 700 : 500 }}>{val}</td></tr>
);

export default function EstruturaSeries1Projeto({ projetoId }: { projetoId: string }) {
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [registrando, setRegistrando] = useState(false);
  const carregar = useCallback(() => {
    setErro('');
    api.get(`/projects-relatorios/projetos/${projetoId}/estrutura`).then((r) => setD(r.data)).catch((e) => setErro(e?.response?.data?.message || 'Falha ao carregar a estrutura.'));
  }, [projetoId]);
  useEffect(() => { carregar(); }, [carregar]);
  if (erro) return <div style={erroSt}>⚠ {erro}</div>;
  if (!d) return <div style={{ color: '#6B7280' }}>Carregando...</div>;
  const pv = d.passivos; const dv = d.divida;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={tituloSt}>Series#1 e Dívida</div>
        <div style={subtituloSt}>Premissas v{d.versaoPremissas} · visível só para o Master</div>
      </div>
      <div style={{ borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 600, background: d.subordinacao.liberada ? '#DCFCE7' : '#FEF3C7', color: d.subordinacao.liberada ? '#166534' : '#78350F' }}>
        {d.subordinacao.liberada ? 'Passivos da HOTELSYS quitados: distribuições aos cotistas liberadas.' : 'Distribuições aos cotistas bloqueadas até a quitação dos passivos da HOTELSYS.'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14 }}>
        <div style={{ ...cardSt, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ ...secTitle, flex: 1 }}>Passivos do empreendimento (libera os cotistas)</div>
            <button onClick={() => setRegistrando(true)} style={{ padding: '5px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#134E4A', cursor: 'pointer' }}>Registrar estoque</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
            {pv.estoqueInformado
              ? <>{linha(`Estoque informado em ${fmtData(pv.estoqueInformado.data)}`, fmtBRL(pv.estoqueInformado.valor))}
                  <tr><td colSpan={2} style={{ ...tdSt, fontSize: 11, color: '#6B7280' }}>{pv.estoqueInformado.fonte}</td></tr></>
              : <tr><td colSpan={2} style={{ ...tdSt, color: '#B45309' }}>Sem estoque informado. Registre o estoque de passivos (da contabilidade da HOTELSYS) para o saldo ser calculado.</td></tr>}
            {linha(`(−) Pagamentos de passivo desde ${fmtData(pv.pagamentosDesde)}`, fmtBRL(pv.pagamentos))}
            {pv.saldoEstimado !== null && linha('(=) Saldo estimado de passivos', fmtBRL(pv.saldoEstimado), true)}
          </tbody></table>
          {pv.porNatureza.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
              <thead><tr><th style={thSt}>Pagamentos por natureza</th><th style={{ ...thSt, textAlign: 'right' }}>Qtde.</th><th style={{ ...thSt, textAlign: 'right' }}>Total</th></tr></thead>
              <tbody>{pv.porNatureza.map((x: any) => <tr key={x.nome}><td style={tdSt}>{x.nome}</td><td style={{ ...tdSt, textAlign: 'right' }}>{x.quantidade}</td><td style={{ ...tdSt, textAlign: 'right' }}>{fmtBRL(x.total)}</td></tr>)}</tbody>
            </table>
          )}
        </div>
        <div style={{ ...cardSt, padding: 16 }}>
          <div style={secTitle}>Dívida da REAL com a F5 (libera a REAL)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
            {linha(`Dívida confessada em ${fmtData(dv.data)}`, fmtBRL(dv.valor))}
            {linha('Montante de referência em euros', `€ ${Number(dv.valorEur).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)}
            {linha(`(−) Compensação: ${pc(dv.pctContrapartida, 0)} dos aportes líquidos (${fmtBRL(dv.aportesBase)})`, fmtBRL(dv.compensado))}
            {linha('(=) Saldo da dívida', fmtBRL(dv.saldo), true)}
            {linha(dv.quitadaEm ? 'Quitada em' : 'Aportes que ainda faltam para a quitação', dv.quitadaEm ? fmtData(dv.quitadaEm) : fmtBRL(dv.aportesNecessarios))}
          </tbody></table>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8 }}>Depois da quitação, os {pc(dv.pctContrapartida, 0)} de cada aporte passam a ser exigíveis pela REAL.</div>
        </div>
      </div>
      <div style={{ ...cardSt, padding: 16 }}>
        <div style={secTitle}>Series#1</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
          {linha('Valor da quota sênior', fmtBRL(d.series.valorQuota))}
          {linha('Participação por quota (80% × quota ÷ resultado do BP)', pc(d.series.pctPorQuota, 4))}
          {linha('CDE: cotistas / F5', `${pc(d.series.pctCotistas, 0)} / ${pc(d.series.pctF5, 0)}`)}
          {linha('Janela de subscrição', `${d.series.janela[0] || '-'} a ${d.series.janela[1] || '-'}`)}
          {linha('Primeira distribuição', `${d.series.primeiraDistribuicao || '-'} (${d.series.periodicidade || '-'})`)}
        </tbody></table>
      </div>
      <div style={{ ...cardSt, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thSt}>Quota</th><th style={thSt}>Subscritor</th><th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={{ ...thSt, textAlign: 'right' }}>Capital aportado</th><th style={{ ...thSt, textAlign: 'right' }}>Integralização</th><th style={thSt}>Subscrição</th><th style={thSt}>Ingresso</th><th style={thSt}>Origem</th></tr></thead>
          <tbody>
            {d.quotas.length === 0 && <tr><td colSpan={8} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 20 }}>Nenhuma quota registrada.</td></tr>}
            {d.quotas.map((q: any) => (
              <tr key={q.numero}>
                <td style={{ ...tdSt, fontWeight: 700 }}>nº {q.numero}</td><td style={tdSt}>{q.subscritor}</td>
                <td style={{ ...tdSt, textAlign: 'right' }}>{fmtBRL(q.valor)}</td><td style={{ ...tdSt, textAlign: 'right' }}>{fmtBRL(q.capitalAportado)}</td>
                <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>{pc(q.integralizacao, 1)}</td>
                <td style={tdSt}>{fmtData(q.dataSubscricao)}</td><td style={tdSt}>{fmtData(q.dataIngresso)}</td><td style={tdSt}>{q.origem === 'ANCORA' ? 'Operação Âncora' : q.origem || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DocumentosSemestrais projetoId={projetoId} quotas={d.quotas} />
      {registrando && <SaldoInformadoModal operacaoId={d.operacoes.series1} tipoInicial="PASSIVOS_EMPREENDIMENTO" onClose={() => setRegistrando(false)} onFeito={() => { setRegistrando(false); carregar(); }} />}
    </div>
  );
}

// Series#1 - Etapa C2 (06/10/2026): extrato por quota e demonstrativo da REAL, por semestre civil (01/01-30/06 e 01/07-31/12)
function DocumentosSemestrais({ projetoId, quotas }: { projetoId: string; quotas: any[] }) {
  const hoje = new Date();
  const atual = `${hoje.getFullYear()}-${hoje.getMonth() < 6 ? 1 : 2}`;
  const semestres: string[] = [];
  for (let a = 2024; a <= hoje.getFullYear(); a++) for (const s of [1, 2]) { const c = `${a}-${s}`; if (!(a === 2024 && s === 1) && c <= atual) semestres.push(c); }
  semestres.reverse();
  const [sem, setSem] = useState(atual);
  const [quota, setQuota] = useState<number>(quotas[0]?.numero ?? 1);
  const [baixando, setBaixando] = useState('');
  const rot = (c: string) => `${c.slice(5)}º semestre de ${c.slice(0, 4)}${c === atual ? ' (parcial)' : ''}`;
  const baixar = async (tipo: 'extrato' | 'real') => {
    setBaixando(tipo);
    try {
      const url = tipo === 'extrato' ? `/projects-relatorios/projetos/${projetoId}/extrato-quota/pdf?numero=${quota}&semestre=${sem}` : `/projects-relatorios/projetos/${projetoId}/demonstrativo-real/pdf?semestre=${sem}`;
      const r = await api.get(url, { responseType: 'blob' });
      const u = URL.createObjectURL(r.data); const a = document.createElement('a'); a.href = u;
      a.download = tipo === 'extrato' ? `extrato-quota-${quota}-${sem}.pdf` : `demonstrativo-real-${sem}.pdf`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
    } catch { window.alert('Falha ao gerar o PDF.'); } finally { setBaixando(''); }
  };
  const sel: React.CSSProperties = { padding: '6px 8px', border: '0.5px solid #E5E7EB', borderRadius: 7, fontSize: 13, background: '#fff' };
  const btn: React.CSSProperties = { padding: '7px 12px', background: '#0F2747', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
  return (
    <div style={{ ...cardSt, padding: 16 }}>
      <div style={secTitle}>Documentos semestrais</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <select value={sem} onChange={(e) => setSem(e.target.value)} style={sel}>{semestres.map((c) => <option key={c} value={c}>{rot(c)}</option>)}</select>
        <select value={quota} onChange={(e) => setQuota(Number(e.target.value))} style={sel}>{quotas.map((q: any) => <option key={q.numero} value={q.numero}>Quota nº {q.numero}</option>)}</select>
        <button onClick={() => baixar('extrato')} disabled={!!baixando || !quotas.length} style={{ ...btn, opacity: baixando ? 0.6 : 1 }}>{baixando === 'extrato' ? 'Gerando...' : 'Extrato da quota (PDF)'}</button>
        <button onClick={() => baixar('real')} disabled={!!baixando} style={{ ...btn, background: '#134E4A', opacity: baixando ? 0.6 : 1 }}>{baixando === 'real' ? 'Gerando...' : 'Demonstrativo da REAL (PDF)'}</button>
      </div>
      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8 }}>Cada emissão fica registrada no Histórico, com o código de conferência do documento.</div>
    </div>
  );
}
