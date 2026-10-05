// frontend/src/pages/projects/workspace/KitInvestidorProjeto.tsx
// Kit do Investidor - Etapa 2 (05/10/2026), so o Master: premissas do BP (versao vigente), parametros contratuais da REAL e
// realizado da Operacao Ancora, cada numero com a etiqueta da sua natureza. PDF com codigo de conferencia e registro no historico.
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { cardSt, thSt, tdSt, erroSt, secTitle, tituloSt, subtituloSt } from './projetoTema';

const mi = (v: number) => 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' mi';
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pc = (v: number, d = 2) => (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
const nf = (v: number, d = 0) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const dataBR = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '-');
const ROM = ['I', 'II', 'III', 'IV'];

function Tag({ o, v }: { o: 'LEDGR' | 'BP' | 'CT'; v?: number }) {
  const cfg = { LEDGR: ['Apurado no LEDGR', '#E8F5EE', '#1A4A3A'], BP: [`Premissa do BP v${v ?? ''}`, '#EAF2FB', '#1F5F99'], CT: ['Parâmetro contratual', '#FFF3DF', '#9A6A14'] }[o];
  return <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '1px 7px', background: cfg[1], color: cfg[2], marginLeft: 6 }}>{cfg[0]}</span>;
}

export default function KitInvestidorProjeto({ projetoId }: { projetoId: string }) {
  const [k, setK] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [baixando, setBaixando] = useState(false);
  useEffect(() => {
    api.get(`/projects-relatorios/projetos/${projetoId}/kit-investidor`).then((r) => setK(r.data)).catch((e) => setErro(e?.response?.data?.message || 'Falha ao montar o kit.'));
  }, [projetoId]);
  const pdf = async () => {
    setBaixando(true);
    try {
      const r = await api.get(`/projects-relatorios/projetos/${projetoId}/kit-investidor/pdf`, { responseType: 'blob' });
      const u = URL.createObjectURL(r.data); const a = document.createElement('a'); a.href = u; a.download = `kit-investidor-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
      toast.success('Kit emitido e registrado no histórico.');
    } catch { toast.error('Falha ao gerar o PDF.'); } finally { setBaixando(false); }
  };
  if (erro) return <div style={erroSt}>⚠ {erro}</div>;
  if (!k) return <div style={{ color: '#6B7280' }}>Montando o kit...</div>;
  const v = k.versao.numero; const a = k.ancora || {};
  const card = (rot: string, val: string, o: 'LEDGR' | 'BP' | 'CT') => (
    <div style={{ ...cardSt, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{rot}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#0F2747', margin: '4px 0' }}>{val}</div>
      <Tag o={o} v={v} />
    </div>
  );
  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={tituloSt}>Kit do Investidor</div>
          <div style={subtituloSt}>{k.projeto} · premissas do BP v{v} (base {k.bp.dataBase}) · visível só para o Master</div>
        </div>
        <button onClick={pdf} disabled={baixando} style={{ padding: '8px 14px', background: '#0F2747', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: baixando ? 'default' : 'pointer', opacity: baixando ? 0.6 : 1 }}>{baixando ? 'Gerando...' : 'Baixar PDF'}</button>
      </div>

      <div style={{ ...cardSt, padding: 16 }}>
        <div style={secTitle}>01 · OnePage do Projeto</div>
        <div style={grid}>{card('VGV reexpresso', mi(k.bp.vgv), 'BP')}{card('Receitas projetadas', mi(k.bp.receitas), 'BP')}{card('Resultado projetado', mi(k.bp.resultado), 'BP')}{card('Exposição máxima', mi(Math.abs(k.bp.exposicaoMaxima)), 'BP')}</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}><tbody>
          {[['Total de U.H.', nf(k.bp.uh), 'BP'], ['Cotas econômicas do BP', nf(k.bp.cotas), 'BP'], ['Preço-base médio por cota', brl(k.bp.precoCota), 'BP'], ['Prazo de venda', nf(k.bp.velocidade) + ' meses', 'BP'],
            ['Margem resultado / receita', pc(k.bp.margem), 'BP'], ['TIR do BP', `${pc(k.bp.tirMensal)} a.m. / ${pc(k.bp.tirAnual)} a.a.`, 'BP'], ['Resultado / exposição máxima', nf(k.bp.roe, 2) + 'x', 'BP'],
            [`VPL comparável a ${pc(k.bp.taxaVpl, 0)} a.a.`, mi(k.bp.vpl), 'BP'], ['Passivo de referência assumido', mi(k.contrato.passivo), 'CT'], ['Início da participação', k.contrato.inicioParticipacao || '-', 'CT']]
            .map(([r, val, o]) => <tr key={r}><td style={tdSt}>{r}<Tag o={o as any} v={v} /></td><td style={{ ...tdSt, textAlign: 'right', fontWeight: 700 }}>{val}</td></tr>)}
        </tbody></table>
      </div>

      <div style={{ ...cardSt, padding: 16 }}>
        <div style={secTitle}>02 · Cronograma e andamento</div>
        {[[`${a.inicio || '-'} · Início da Operação Âncora`, `Primeiro aporte em ${dataBR(a.primeiroAporte)}, comprovado no extrato.`, 'LEDGR'],
          [`Até 31/10/2025 · ${brl(a.aportesAte31out2025)} aportados`, 'Soma exata dos créditos vinculados à Conta Individual.', 'LEDGR'],
          [`${dataBR(k.contrato.dataAssuncao)} · Assunção do passivo de ${mi(k.contrato.passivo)}`, 'Marco da exposição econômica do Investidor Estratégico.', 'CT'],
          [`Até 31/12/2025 · ${brl(a.aportesAte31dez2025)} aportados`, a.emConciliacao ? `Em conciliação: diferença de ${brl(a.diferencaConciliacao)} para o saldo informado.` : 'Conciliado.', 'LEDGR'],
          [`${k.contrato.inicioEstruturacao || '-'} · Início da Estruturação`, 'Preparação comercial, financeira e operacional.', 'CT'],
          [`Início da participação: ${k.contrato.inicioParticipacao || '-'}`, 'A data formalizada delimita a base elegível da waterfall.', 'CT']]
          .map(([t, s, o]) => <div key={t} style={{ borderLeft: '2px solid #CAD4E2', padding: '0 0 10px 14px', marginLeft: 4 }}><b style={{ color: '#0F2747' }}>{t}</b><Tag o={o as any} v={v} /><div style={{ fontSize: 12, color: o === 'LEDGR' && a.emConciliacao && t.startsWith('Até 31/12') ? '#9A6A14' : '#667085' }}>{s}</div></div>)}
        <div style={{ marginTop: 6 }}>
          <b style={{ color: '#0F2747' }}>Cota sênior: {pc(a.percentual || 0, 1)} de {brl(k.cotaSenior.valor)}</b><Tag o="LEDGR" />
          <div style={{ height: 8, background: '#E5E7EB', borderRadius: 999, overflow: 'hidden', margin: '6px 0' }}><div style={{ width: `${Math.min(100, (a.percentual || 0) * 100)}%`, height: '100%', background: '#236A57' }} /></div>
          <div style={{ fontSize: 12, color: '#667085' }}>{a.concluidaEm ? `Meta atingida em ${dataBR(a.concluidaEm)}.` : `Saldo líquido de ${brl(a.saldo)}; faltam ${brl(a.falta)}.`}</div>
        </div>
      </div>

      <div style={{ ...cardSt, padding: 16 }}>
        <div style={secTitle}>03 e 04 · Tese e estrutura</div>
        <div style={grid}>{card('Escala (VGV)', mi(k.bp.vgv), 'BP')}{card('Capital (passivo)', mi(k.contrato.passivo), 'CT')}{card('Margem projetada', pc(k.bp.margem, 1), 'BP')}{card('Resultado elegível', mi(k.cotaSenior.resultadoElegivel), 'BP')}</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
          <thead><tr><th style={thSt}>Participante<Tag o="LEDGR" /></th><th style={thSt}>Papel</th></tr></thead>
          <tbody>
            {k.participantes.map((p: any) => <tr key={p.nome + p.papel}><td style={{ ...tdSt, fontWeight: 600 }}>{p.nome}{p.pais !== 'BR' ? ` (${p.pais})` : ''}</td><td style={tdSt}>{p.papel}</td></tr>)}
            <tr><td style={{ ...tdSt, fontWeight: 600 }}>Cliente Âncora</td><td style={tdSt}>Cota sênior de {brl(k.cotaSenior.valor)} ({nf(k.cotaSenior.cotasEquivalentes, 2)} cotas equivalentes, {pc(k.cotaSenior.percentualCotas)} do estoque), segregada da base econômica</td></tr>
          </tbody>
        </table>
      </div>

      <div style={{ ...cardSt, padding: 16 }}>
        <div style={secTitle}>05 · Waterfall econômico<Tag o="CT" /></div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thSt}>Faixa</th><th style={thSt}>Retorno acumulado</th><th style={{ ...thSt, textAlign: 'right' }}>Investidor</th><th style={{ ...thSt, textAlign: 'right' }}>Recebimento indicativo</th><th style={{ ...thSt, textAlign: 'right' }}>MOIC</th></tr></thead>
          <tbody>{k.waterfall.faixas.map((f: any) => (
            <tr key={f.faixa}><td style={{ ...tdSt, fontWeight: 700 }}>{ROM[f.faixa - 1]}</td>
              <td style={tdSt}>{f.ateValor === null ? `Acima de ${mi(f.deValor)}` : `${f.deValor ? mi(f.deValor) + ' → ' : 'Até '}${mi(f.ateValor)}`}</td>
              <td style={{ ...tdSt, textAlign: 'right', fontWeight: 700 }}>{pc(f.pct, 0)}</td><td style={{ ...tdSt, textAlign: 'right' }}>{mi(f.recebimento)}</td><td style={{ ...tdSt, textAlign: 'right' }}>{nf(f.moic, 2)}x</td></tr>))}</tbody>
        </table>
        <div style={{ ...grid, marginTop: 12 }}>
          {card('Caso-base indicativo', `${mi(k.waterfall.recebimentoTotal)} · ${nf(k.waterfall.moic, 2)}x`, 'BP')}
          {card('Realizado', `${brl(k.waterfall.realizado.distribuido)} · Faixa ${ROM[k.waterfall.realizado.faixaVigente - 1]}`, 'LEDGR')}
        </div>
      </div>

      <div style={{ ...cardSt, padding: 16 }}>
        <div style={secTitle}>06 · Sensibilidade<Tag o="BP" v={v} /></div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thSt}>Cenário</th><th style={{ ...thSt, textAlign: 'right' }}>Receita</th><th style={{ ...thSt, textAlign: 'right' }}>Despesas</th><th style={{ ...thSt, textAlign: 'right' }}>Resultado</th><th style={{ ...thSt, textAlign: 'right' }}>Margem</th></tr></thead>
          <tbody>{k.cenarios.map((c: any) => <tr key={c.nome}><td style={tdSt}>{c.nome}</td><td style={{ ...tdSt, textAlign: 'right' }}>{pc(c.varReceita, 0)}</td><td style={{ ...tdSt, textAlign: 'right' }}>{pc(c.varDespesa, 0)}</td><td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>{mi(c.resultado)}</td><td style={{ ...tdSt, textAlign: 'right' }}>{pc(c.margem, 1)}</td></tr>)}</tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: '#6B7280' }}>Código de conferência desta montagem (SHA-256): <span style={{ fontFamily: 'monospace' }}>{k.hash}</span></div>
    </div>
  );
}
