// frontend/src/pages/projects/workspace/KitCotistaProjeto.tsx
// Kit do Cotista - Series#1, Etapa C1 (06/10/2026), so o Master. Substitui o Kit do Investidor (premissas v1).
// Premissas da versao vigente + realizado do LEDGR, cada numero com a etiqueta da sua natureza; PDF com codigo de conferencia.
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { cardSt, thSt, tdSt, erroSt, secTitle, tituloSt, subtituloSt, fmtBRL } from './projetoTema';

const pc = (v: number, d = 2) => (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
const mi = (v: number) => 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' mi';
const nf = (v: number, d = 0) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const dataBR = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '-');
const ROM = ['I', 'II', 'III', 'IV'];

function Tag({ o, v }: { o: 'LEDGR' | 'P' | 'CT'; v?: number }) {
  const cfg = { LEDGR: ['Apurado no LEDGR', '#E8F5EE', '#1A4A3A'], P: [`Premissa v${v ?? ''}`, '#EAF2FB', '#1F5F99'], CT: ['Parâmetro contratual', '#FFF3DF', '#9A6A14'] }[o];
  return <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '1px 7px', background: cfg[1], color: cfg[2], marginLeft: 6 }}>{cfg[0]}</span>;
}

export default function KitCotistaProjeto({ projetoId }: { projetoId: string }) {
  const [k, setK] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [baixando, setBaixando] = useState(false);
  useEffect(() => {
    api.get(`/projects-relatorios/projetos/${projetoId}/kit-cotista`).then((r) => setK(r.data)).catch((e) => setErro(e?.response?.data?.message || 'Falha ao montar o kit.'));
  }, [projetoId]);
  const pdf = async () => {
    setBaixando(true);
    try {
      const r = await api.get(`/projects-relatorios/projetos/${projetoId}/kit-cotista/pdf`, { responseType: 'blob' });
      const u = URL.createObjectURL(r.data); const a = document.createElement('a'); a.href = u; a.download = `kit-cotista-series1-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
      toast.success('Kit emitido e registrado no histórico.');
    } catch { toast.error('Falha ao gerar o PDF.'); } finally { setBaixando(false); }
  };
  if (erro) return <div style={erroSt}>⚠ {erro}</div>;
  if (!k) return <div style={{ color: '#6B7280' }}>Montando o kit...</div>;
  const v = k.versao.numero; const s = k.series; const r = k.realizado; const pv = r.passivos;
  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 };
  const card = (rot: string, val: string, o: 'LEDGR' | 'P' | 'CT', sub?: string) => (
    <div style={{ ...cardSt, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{rot}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#0F2747', margin: '4px 0' }}>{val}</div>
      {sub && <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{sub}</div>}
      <Tag o={o} v={v} />
    </div>
  );
  const sec = (titulo: string, filhos: React.ReactNode) => <div style={{ ...cardSt, padding: 16 }}><div style={secTitle}>{titulo}</div>{filhos}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={tituloSt}>Kit do Cotista · Series#1</div>
          <div style={subtituloSt}>{k.projeto} · premissas v{v} · visível só para o Master</div>
        </div>
        <button onClick={pdf} disabled={baixando} style={{ padding: '8px 14px', background: '#0F2747', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: baixando ? 'default' : 'pointer', opacity: baixando ? 0.6 : 1 }}>{baixando ? 'Gerando...' : 'Baixar PDF'}</button>
      </div>
      {sec('01 · A oferta', <>
        <div style={grid}>{card('Valor da quota', fmtBRL(s.valorQuota), 'CT')}{card('Participação por quota', pc(s.pctPorQuota, 4), 'P', 'do Caixa Distribuível Elegível')}{card('Renda projetada (12 meses)', fmtBRL(s.renda12m), 'P', `${pc(s.rendimento12m)} ao ano`)}{card('Distribuições', s.periodicidade || '-', 'CT', `a partir de ${s.primeiraDistribuicao || '-'}`)}</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>Janela de subscrição: {s.janela[0] || '-'} a {s.janela[1] || '-'} · Início da participação: {s.inicioParticipacao || '-'} · Regra: {s.regra || '-'}{s.pctQuotaBook ? ` (o book cita ${pc(s.pctQuotaBook, 4)})` : ''}</div>
      </>)}
      {sec('02 · O empreendimento (BP reexpresso)', <div style={grid}>{card('VGV', mi(k.bp.vgv), 'P')}{card('Resultado', mi(k.bp.resultado), 'P', `margem ${pc(k.bp.margem)}`)}{card('Unidades', nf(k.bp.uh), 'P')}{card('TIR do BP', `${pc(k.bp.tirAnual)} a.a.`, 'P', `${pc(k.bp.tirMensal)} a.m.`)}</div>)}
      {sec('03 · O modelo de renda', <>
        <div style={{ fontSize: 13, marginBottom: 8 }}>Do CDE, <b>{pc(s.pctCotistas, 0)}</b> aos cotistas e <b>{pc(s.pctF5, 0)}</b> à F5<Tag o="CT" />. Faixas sobre o capital aportado (valores para uma quota):</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thSt}>Faixa</th><th style={thSt}>Retorno acumulado</th><th style={{ ...thSt, textAlign: 'right' }}>Parte do cotista</th><th style={{ ...thSt, textAlign: 'right' }}>Múltiplo esperado</th></tr></thead>
          <tbody>{k.faixas.map((f: any) => (
            <tr key={f.faixa}><td style={{ ...tdSt, fontWeight: 700 }}>{ROM[f.faixa - 1]}</td>
              <td style={tdSt}>{f.ateMoic === null ? `acima de ${nf(f.deMoic, 2)}x (${fmtBRL(f.deValor)})` : `${f.deMoic ? nf(f.deMoic, 2) + 'x a ' : 'até '}${nf(f.ateMoic, 2)}x (${f.deMoic ? fmtBRL(f.deValor) + ' a ' : 'até '}${fmtBRL(f.ateValor)})`}</td>
              <td style={{ ...tdSt, textAlign: 'right', fontWeight: 700 }}>{pc(f.pct, 0)}</td><td style={{ ...tdSt, textAlign: 'right' }}>{nf(f.multiploEsperado, 2)}x</td></tr>))}</tbody>
        </table>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>Piso da remuneração: {s.piso || '-'}</div>
      </>)}
      {sec('04 · Subordinação', <>
        <div style={{ borderRadius: 8, padding: '10px 12px', fontSize: 13, background: pv.liberada ? '#DCFCE7' : '#FEF3C7', color: pv.liberada ? '#166534' : '#78350F' }}>
          {pv.liberada ? 'Passivos quitados: distribuições liberadas.' : 'Distribuições bloqueadas até a quitação dos passivos do empreendimento.'}{' '}
          {pv.estoque === null ? `Estoque de passivos ainda não informado; pagamentos de passivo desde ${dataBR(pv.pagamentosDesde)}: ${fmtBRL(pv.pagamentos)}.` : `Estoque em ${dataBR(pv.estoqueData)}: ${fmtBRL(pv.estoque)}; pagamentos desde então: ${fmtBRL(pv.pagamentos)}; saldo estimado: ${fmtBRL(pv.saldo)}.`}
          <Tag o="LEDGR" />
        </div>
        <div style={{ fontSize: 13, marginTop: 8 }}>{pc(k.contrapartidaPct, 0)} de cada aporte destinam-se à contrapartida de lucros da Real Mouchão.<Tag o="CT" /></div>
      </>)}
      {sec('05 · Projeção de renda por quota', <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thSt}>Ano<Tag o="P" v={v} /></th><th style={{ ...thSt, textAlign: 'right' }}>Renda</th><th style={{ ...thSt, textAlign: 'right' }}>Acumulado</th><th style={{ ...thSt, textAlign: 'right' }}>% da quota</th></tr></thead>
          <tbody>{k.renda.map((x: any) => <tr key={x.ano}><td style={tdSt}>{x.ano}</td><td style={{ ...tdSt, textAlign: 'right' }}>{fmtBRL(x.renda)}</td><td style={{ ...tdSt, textAlign: 'right' }}>{fmtBRL(x.acumulado)}</td><td style={{ ...tdSt, textAlign: 'right' }}>{pc(x.pctAcumulado)}</td></tr>)}</tbody>
        </table>
        <table style={{ width: '100%', borderCollapse: 'collapse', alignSelf: 'start' }}>
          <thead><tr><th style={thSt}>Choque de fluxo<Tag o="P" v={v} /></th><th style={{ ...thSt, textAlign: 'right' }}>Renda 12 meses</th><th style={{ ...thSt, textAlign: 'right' }}>Rendimento</th></tr></thead>
          <tbody>{k.choques.map((c: any) => <tr key={c.fluxo}><td style={tdSt}>{pc(c.fluxo, 0)} do fluxo</td><td style={{ ...tdSt, textAlign: 'right' }}>{fmtBRL(c.renda)}</td><td style={{ ...tdSt, textAlign: 'right' }}>{pc(c.rendimento)}</td></tr>)}</tbody>
        </table>
      </div>)}
      {sec('06 · Cronograma e captação', <>
        {k.cronograma.map((c: any) => <div key={c.nome} style={{ borderLeft: '2px solid #CAD4E2', padding: '0 0 10px 14px', marginLeft: 4 }}><b style={{ color: '#0F2747' }}>{c.nome}</b><Tag o="P" v={v} /><div style={{ fontSize: 12, color: '#667085' }}>{c.texto}</div></div>)}
        <div style={{ ...grid, marginTop: 8 }}>{card('Quotas registradas', nf(r.quotas), 'LEDGR')}{card('Capital aportado', fmtBRL(r.captado), 'LEDGR')}{card('Distribuído', fmtBRL(r.distribuido), 'LEDGR', `Faixa ${ROM[r.faixaVigente - 1]}`)}</div>
      </>)}
      <div style={{ fontSize: 11, color: '#6B7280' }}>Código de conferência desta montagem (SHA-256): <span style={{ fontFamily: 'monospace' }}>{k.hash}</span></div>
    </div>
  );
}
