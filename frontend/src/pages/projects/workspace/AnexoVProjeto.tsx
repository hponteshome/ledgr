// frontend/src/pages/projects/workspace/AnexoVProjeto.tsx
// Anexo V e desembolsos (09/10/2026): itens da confissao de 31/10/2025 (cl. 2.A.2), classificacao das aplicacoes, relatorio de
// desembolsos no layout do Nei (colunas A-G) com exportacao para Excel e reconciliacao do Anexo I. Calculo a cada consulta; so Master.
import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import { thSt, tdSt, erroSt, fmtBRL, fmtData, PROJ } from './projetoTema';
import { ModalProjeto, BotaoSec, erroApi } from './ModalProjeto';

const CONTRATO = '2025-10-31';
const FORA = 'FORA';
const num: React.CSSProperties = { ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
const dir: React.CSSProperties = { ...thSt, textAlign: 'right' };
const painel: React.CSSProperties = { background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: 14 };
const sel: React.CSSProperties = { padding: '4px 6px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, background: '#fff', maxWidth: 260 };
const botaoPri: React.CSSProperties = { background: PROJ, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const SIT: Record<string, { rot: string; cor: string; fundo: string }> = {
  CONFIRMADO: { rot: 'Confirmado', cor: '#166534', fundo: '#DCFCE7' },
  SUGERIDO: { rot: 'Sugerido', cor: '#92400E', fundo: '#FEF3C7' },
  PENDENTE: { rot: 'A classificar', cor: '#A32D2D', fundo: '#FCEBEB' },
  OK: { rot: 'Bate', cor: '#166534', fundo: '#DCFCE7' },
  DIVERGE: { rot: 'Diverge', cor: '#92400E', fundo: '#FEF3C7' },
  SO_ANEXO_I: { rot: 'Só no Anexo I', cor: '#A32D2D', fundo: '#FCEBEB' },
  SO_LEDGR: { rot: 'Só no LEDGR', cor: '#1E40AF', fundo: '#DBEAFE' },
  ENCERRADO_NO_LEDGR: { rot: 'Encerrado no LEDGR', cor: '#A32D2D', fundo: '#FCEBEB' },
  ENCERRADO_SO_LEDGR: { rot: 'Encerrado (só LEDGR)', cor: '#6B7280', fundo: '#F3F4F6' },
};
function Chip({ s }: { s: string }) {
  const c = SIT[s] || { rot: s, cor: '#374151', fundo: '#F3F4F6' };
  return <span style={{ fontSize: 11, fontWeight: 600, color: c.cor, background: c.fundo, borderRadius: 10, padding: '1px 8px', whiteSpace: 'nowrap' }}>{c.rot}</span>;
}
type Escolha = { destino: string; consta: string };
type Aba = 'itens' | 'classificar' | 'desembolsos' | 'anexoi';

export default function AnexoVProjeto({ projetoId }: { projetoId: string }) {
  const [d, setD] = useState<any>(null);
  const [ai, setAi] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [aba, setAba] = useState<Aba>('itens');
  const [filtro, setFiltro] = useState<string>('PENDENTE');
  const [semManut, setSemManut] = useState(true);
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});
  const [soConfirmadas, setSoConfirmadas] = useState(true);
  const [modal, setModal] = useState<null | { tipo: 'gravar' | 'sugestoes' | 'encerrar'; lista?: any[]; vinculo?: any }>(null);
  const [motivo, setMotivo] = useState('');
  const [erroModal, setErroModal] = useState('');

  const carregar = () => {
    setErro('');
    api.get(`/projects-relatorios/projetos/${projetoId}/anexo-v`).then((r: any) => setD(r.data)).catch((e: any) => setErro(erroApi(e, 'Falha ao carregar o Anexo V.')));
    api.get(`/projects-relatorios/projetos/${projetoId}/anexo-i`).then((r: any) => setAi(r.data)).catch((e: any) => setErro(erroApi(e, 'Falha ao carregar o Anexo I.')));
  };
  useEffect(() => { carregar(); }, [projetoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const itens: any[] = d?.itens || [];
  const aplicacoes: any[] = d?.aplicacoes || [];
  const visiveis = useMemo(() => aplicacoes.filter((a) => (filtro === 'TODAS' || a.situacao === filtro) && !(semManut && a.codigo === 'MANUTENCAO_OPERACAO')), [aplicacoes, filtro, semManut]);
  const contagem = useMemo(() => {
    const c: Record<string, number> = { PENDENTE: 0, SUGERIDO: 0, CONFIRMADO: 0 };
    for (const a of aplicacoes) if (!(semManut && a.codigo === 'MANUTENCAO_OPERACAO')) c[a.situacao] = (c[a.situacao] || 0) + 1;
    return c;
  }, [aplicacoes, semManut]);
  const destinoAtual = (a: any): string => (escolhas[a.id] ? escolhas[a.id].destino : a.fora ? FORA : a.itemId || '');
  const constaAtual = (a: any): string => (escolhas[a.id] ? escolhas[a.id].consta : a.consta || 'Não');
  const escolher = (a: any, campo: keyof Escolha, v: string) => {
    const atual: Escolha = { destino: destinoAtual(a), consta: constaAtual(a) };
    setEscolhas((x) => ({ ...x, [a.id]: { ...atual, [campo]: v } }));
  };
  const montar = (lista: any[], usarSugestao: boolean) => lista.map((a) => {
    const destino = usarSugestao ? (a.fora ? FORA : a.itemId || '') : destinoAtual(a);
    return { aplicacaoId: a.id, itemId: destino && destino !== FORA ? destino : null, fora: destino === FORA, consta: a.data <= CONTRATO ? constaAtual(a) : null };
  }).filter((x) => x.fora || x.itemId);
  const alteradas = aplicacoes.filter((a) => escolhas[a.id] && a.situacao !== 'CONFIRMADO');
  const sugeridasVisiveis = visiveis.filter((a) => a.situacao === 'SUGERIDO');
  const linhas: any[] = (d?.linhas || []).filter((l: any) => !soConfirmadas || l.situacao === 'CONFIRMADO');
  const soma = (lista: any[], k: string) => lista.reduce((s, x) => s + Number(x[k] || 0), 0);

  const executar = async () => {
    if (!modal) return;
    setErroModal('');
    try {
      if (modal.tipo === 'encerrar') await api.post(`/projects-relatorios/projetos/${projetoId}/anexo-v/desvincular`, { vinculoId: modal.vinculo.vinculoId, motivo: motivo.trim() });
      else await api.post(`/projects-relatorios/projetos/${projetoId}/anexo-v/vincular`, { itens: modal.lista, motivo: motivo.trim() });
      setAviso(modal.tipo === 'encerrar' ? 'Vínculo encerrado; a aplicação voltou para a classificação.' : `${(modal.lista || []).length} aplicação(ões) classificada(s).`);
      setModal(null); setMotivo(''); setEscolhas({}); carregar();
    } catch (e) { setErroModal(erroApi(e, 'Falha ao gravar.')); }
  };

  const exportar = async () => {
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Desembolsos');
    ws.addRow(['Data do pagamento', 'Credor do Anexo V', 'Item do Anexo V', 'Valor pago (R$)', 'Origem do dinheiro', 'Antes de 31/10/2025: consta da reconciliação do Anexo V como desembolso a reembolsar?', 'Comprovativo']);
    for (const l of linhas) {
      const [y, m, dd] = String(l.data).split('-').map(Number);
      ws.addRow([new Date(Date.UTC(y, m - 1, dd)), l.credor, l.item, Number(l.valor), l.origem, l.consta || '', l.comprovante]);
    }
    ws.getRow(1).font = { bold: true };
    ws.getColumn(1).numFmt = 'dd/mm/yyyy';
    ws.getColumn(4).numFmt = '#,##0.00';
    [12, 45, 40, 16, 26, 22, 30].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const u = URL.createObjectURL(blob); const el = document.createElement('a');
    el.href = u; el.download = `desembolsos-anexo-v-${new Date().toISOString().slice(0, 10)}.xlsx`; document.body.appendChild(el); el.click(); el.remove(); URL.revokeObjectURL(u);
  };

  const abaBtn = (k: Aba, rot: string) => (
    <button type="button" onClick={() => setAba(k)} style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
      borderBottom: aba === k ? `2px solid ${PROJ}` : '2px solid transparent', background: 'transparent', color: aba === k ? PROJ : '#6B7280' }}>{rot}</button>);
  const totFace = soma(itens, 'valorFace'), totF5 = soma(itens, 'pagoF5'), totOut = soma(itens, 'pagoOutros'), totSaldo = soma(itens, 'saldo');
  const totAntes = soma(itens, 'pagoAntes'), totAntesSim = soma(itens, 'pagoAntesReconciliado');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#0F2747' }}>Anexo V e desembolsos</h1>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
          Passivo brasileiro de R$ 54.418.451,00 na confissão de {fmtData(CONTRATO)} (cl. 2.A.2) · pagamentos classificados por credor, com a origem do dinheiro pelo PEPS · tudo em reconciliação: recalculado a cada consulta
        </div>
      </div>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      {aviso && <div style={{ fontSize: 12, background: '#F0FDF4', border: '0.5px solid #BBF7D0', borderRadius: 8, padding: '6px 12px', display: 'flex' }}><span style={{ flex: 1 }}>{aviso}</span><span style={{ cursor: 'pointer' }} onClick={() => setAviso('')}>×</span></div>}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E5E7EB' }}>
        {abaBtn('itens', 'Itens do Anexo V')}
        {abaBtn('classificar', `Classificação (${contagem.PENDENTE || 0} a classificar)`)}
        {abaBtn('desembolsos', 'Desembolsos')}
        {abaBtn('anexoi', 'Reconciliação do Anexo I')}
      </div>
      {!d && !erro && <div style={{ color: '#6B7280' }}>Carregando...</div>}

      {d && aba === 'itens' && (
        <div style={painel}>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>A carteira do Anexo V é a posição em 31/10/2025: pagamentos anteriores só reduzem o saldo se constarem da reconciliação da cl. 1.F.1 (Sim: entram na confissão da RM); com Não, são crédito da F5 sobre a Sunrise, e os aportes da VAL que os pagaram continuam sendo da VAL. Os valores incluem classificações sugeridas ainda não confirmadas. Pago não é o mesmo que quitado: a diferença para a face pode ser desconto obtido.</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead><tr><th style={thSt}>#</th><th style={thSt}>Credor</th><th style={dir}>Valor na confissão</th><th style={dir}>Pago antes de 31/10/2025</th><th style={dir}>Pago com VAL (depois)</th><th style={dir}>Pago com receita própria (depois)</th><th style={dir}>Total que reduz o saldo</th><th style={dir}>Saldo</th><th style={dir}>% pago</th></tr></thead>
              <tbody>{itens.map((i) => { const pago = i.pagoF5 + i.pagoOutros + (i.pagoAntesReconciliado || 0); return (
                <tr key={i.id}><td style={tdSt}>{i.ordem}</td><td style={{ ...tdSt, fontWeight: 600 }}>{i.credor}</td><td style={num}>{fmtBRL(i.valorFace)}</td>
                  <td style={num} title="Só reduz o saldo se constar da reconciliação da cl. 1.F.1">{fmtBRL(i.pagoAntes || 0)}</td><td style={num}>{fmtBRL(i.pagoF5)}</td><td style={num}>{fmtBRL(i.pagoOutros)}</td><td style={{ ...num, fontWeight: 600 }}>{fmtBRL(pago)}</td>
                  <td style={num}>{fmtBRL(i.saldo)}</td><td style={num}>{i.valorFace ? `${((pago / i.valorFace) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '-'}</td></tr>); })}</tbody>
              <tfoot><tr style={{ borderTop: '1.5px solid #134E4A' }}><td style={tdSt}></td><td style={{ ...tdSt, fontWeight: 700 }}>Total</td><td style={{ ...num, fontWeight: 700 }}>{fmtBRL(totFace)}</td>
                <td style={{ ...num, fontWeight: 700 }}>{fmtBRL(totAntes)}</td><td style={{ ...num, fontWeight: 700 }}>{fmtBRL(totF5)}</td><td style={{ ...num, fontWeight: 700 }}>{fmtBRL(totOut)}</td><td style={{ ...num, fontWeight: 700 }}>{fmtBRL(totF5 + totOut + totAntesSim)}</td>
                <td style={{ ...num, fontWeight: 700 }}>{fmtBRL(totSaldo)}</td><td style={num}>{totFace ? `${(((totF5 + totOut + totAntesSim) / totFace) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '-'}</td></tr></tfoot>
            </table>
          </div>
        </div>)}

      {d && aba === 'classificar' && (
        <div style={painel}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={sel} aria-label="Situação">
              <option value="PENDENTE">A classificar ({contagem.PENDENTE || 0})</option><option value="SUGERIDO">Sugeridas ({contagem.SUGERIDO || 0})</option>
              <option value="CONFIRMADO">Confirmadas ({contagem.CONFIRMADO || 0})</option><option value="TODAS">Todas</option>
            </select>
            <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={semManut} onChange={(e) => setSemManut(e.target.checked)} />Esconder Manutenção da Operação</label>
            <span style={{ flex: 1 }} />
            <BotaoSec onClick={() => { const lista = montar(sugeridasVisiveis, true); if (lista.length) { setMotivo(''); setErroModal(''); setModal({ tipo: 'sugestoes', lista }); } }}>Confirmar sugestões visíveis ({sugeridasVisiveis.length})</BotaoSec>
            <button type="button" style={{ ...botaoPri, opacity: alteradas.length ? 1 : 0.5 }} disabled={!alteradas.length}
              onClick={() => { const lista = montar(alteradas, false); if (lista.length) { setMotivo(''); setErroModal(''); setModal({ tipo: 'gravar', lista }); } }}>Gravar alterações ({alteradas.length})</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
              <thead><tr><th style={thSt}>Data</th><th style={thSt}>Natureza</th><th style={thSt}>Lançamento</th><th style={dir}>Valor</th><th style={dir}>Parte VAL</th><th style={thSt}>Situação</th><th style={thSt}>Item do Anexo V</th><th style={thSt}>Antes de 31/10/2025: recupera de quem?</th><th style={thSt}></th></tr></thead>
              <tbody>{visiveis.map((a) => { const antes = a.data <= CONTRATO; const conf = a.situacao === 'CONFIRMADO'; return (
                <tr key={a.id} style={{ background: escolhas[a.id] ? '#FFFBEB' : undefined }}>
                  <td style={tdSt}>{fmtData(a.data)}</td><td style={{ ...tdSt, fontSize: 12 }}>{a.natureza}</td>
                  <td style={{ ...tdSt, maxWidth: 340 }}><div style={{ fontSize: 12 }}>{a.lancamento}</div>{a.descricao && <div style={{ fontSize: 11, color: '#6B7280' }}>{a.descricao}</div>}{a.darfs && <div style={{ fontSize: 11, color: '#166534' }}>DARF {a.darfs}</div>}</td>
                  <td style={num}>{fmtBRL(a.valor)}</td><td style={num}>{fmtBRL(a.ancora)}</td><td style={tdSt}><Chip s={a.situacao} /></td>
                  <td style={tdSt}>{conf
                    ? <span style={{ fontSize: 12 }} title={a.vinculoMotivo || ''}>{a.fora ? 'Fora do Anexo V' : (itens.find((i) => i.id === a.itemId)?.credor || '')}</span>
                    : <select value={destinoAtual(a)} onChange={(e) => escolher(a, 'destino', e.target.value)} style={sel} aria-label="Item do Anexo V">
                        <option value="">a classificar</option><option value={FORA}>Fora do Anexo V</option>
                        {itens.map((i) => <option key={i.id} value={i.id}>{i.ordem}. {i.credor}</option>)}
                      </select>}</td>
                  <td style={tdSt}>{antes ? (conf ? ((a.consta || 'Não') === 'Sim' ? 'Sim - confissão da RM' : 'Não - crédito sobre a Sunrise') : <select value={constaAtual(a)} onChange={(e) => escolher(a, 'consta', e.target.value)} style={sel} aria-label="Consta da reconciliação"><option value="Não">Não - crédito da F5 sobre a Sunrise</option><option value="Sim">Sim - entra na confissão da RM</option></select>) : '-'}</td>
                  <td style={tdSt}>{conf && <BotaoSec onClick={() => { setMotivo(''); setErroModal(''); setModal({ tipo: 'encerrar', vinculo: a }); }}>Encerrar</BotaoSec>}</td>
                </tr>); })}</tbody>
            </table>
            {!visiveis.length && <div style={{ fontSize: 13, color: '#6B7280', padding: 10 }}>Nenhuma aplicação nesta situação.</div>}
          </div>
        </div>)}

      {d && aba === 'desembolsos' && (
        <div style={painel}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={soConfirmadas} onChange={(e) => setSoConfirmadas(e.target.checked)} />Só classificações confirmadas</label>
            <span style={{ fontSize: 12, color: '#6B7280' }}>{linhas.length} linha(s) · {fmtBRL(soma(linhas, 'valor'))} · VAL {fmtBRL(soma(linhas.filter((l) => l.origem.startsWith('VAL')), 'valor'))}</span>
            <span style={{ flex: 1 }} />
            <button type="button" style={{ ...botaoPri, opacity: linhas.length ? 1 : 0.5 }} disabled={!linhas.length} onClick={exportar}>Exportar para Excel (layout do Nei)</button>
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Colunas A a G da folha Desembolsos do Nei: cole a partir da linha 5. A coluna H (classificação) é calculada pela planilha dele.</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
              <thead><tr><th style={thSt}>A · Data</th><th style={thSt}>B · Credor</th><th style={thSt}>C · Item do Anexo V</th><th style={dir}>D · Valor pago</th><th style={thSt}>E · Origem</th><th style={thSt}>F · Consta da reconciliação?</th><th style={thSt}>G · Comprovativo</th><th style={thSt}>Situação</th></tr></thead>
              <tbody>{linhas.map((l, k) => (
                <tr key={`${l.aplicacaoId}-${k}`}><td style={tdSt}>{fmtData(l.data)}</td><td style={{ ...tdSt, fontSize: 12, maxWidth: 300 }}>{l.credor}</td><td style={{ ...tdSt, fontSize: 12 }}>{l.item}</td>
                  <td style={num}>{fmtBRL(l.valor)}</td><td style={{ ...tdSt, fontSize: 12 }}>{l.origem}</td><td style={tdSt}>{l.consta || '-'}</td><td style={{ ...tdSt, fontSize: 12 }}>{l.comprovante}</td><td style={tdSt}><Chip s={l.situacao} /></td></tr>))}</tbody>
            </table>
            {!linhas.length && <div style={{ fontSize: 13, color: '#6B7280', padding: 10 }}>Nenhum desembolso {soConfirmadas ? 'confirmado' : ''} ainda. Classifique as aplicações na aba Classificação.</div>}
          </div>
        </div>)}

      {aba === 'anexoi' && ai && (
        <div style={painel}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {Object.entries(ai.resumo || {}).map(([k, v]: [string, any]) => (
              <div key={k} style={{ border: '0.5px solid #E5E7EB', borderRadius: 10, padding: '8px 12px', minWidth: 170 }}>
                <Chip s={k} /><div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{v.qtd} lançamento(s)</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>Anexo I {fmtBRL(v.anexoI)} · LEDGR {fmtBRL(v.ledgr)}</div>
              </div>))}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
              <thead><tr><th style={thSt}>N.º</th><th style={thSt}>Data (Anexo I)</th><th style={thSt}>Remetente</th><th style={dir}>Valor (Anexo I)</th><th style={thSt}>Data (LEDGR)</th><th style={dir}>Valor (LEDGR)</th><th style={thSt}>Situação</th><th style={thSt}>Motivo do encerramento</th></tr></thead>
              <tbody>{(ai.lista || []).map((r: any) => (
                <tr key={r.numero} style={{ background: r.situacao === 'OK' ? undefined : '#FFFBEB' }}>
                  <td style={tdSt}>{r.numero}</td><td style={tdSt}>{r.data ? fmtData(r.data) : '-'}</td><td style={{ ...tdSt, fontSize: 12 }}>{r.remetente || r.remetenteLedgr || '-'}</td>
                  <td style={num}>{r.valor != null ? fmtBRL(r.valor) : '-'}</td><td style={tdSt}>{r.dataLedgr ? fmtData(r.dataLedgr) : '-'}</td><td style={num}>{r.valorLedgr != null ? fmtBRL(r.valorLedgr) : '-'}</td>
                  <td style={tdSt}><Chip s={r.situacao} /></td><td style={{ ...tdSt, fontSize: 12, color: '#6B7280' }}>{r.motivoEncerramento || ''}</td></tr>))}</tbody>
            </table>
          </div>
        </div>)}

      {modal && (
        <ModalProjeto titulo={modal.tipo === 'encerrar' ? 'Encerrar classificação' : modal.tipo === 'sugestoes' ? 'Confirmar sugestões' : 'Gravar classificações'}
          subtitulo={modal.tipo === 'encerrar' ? `${fmtData(modal.vinculo.data)} · ${fmtBRL(modal.vinculo.valor)} · ${modal.vinculo.natureza}` : `${(modal.lista || []).length} aplicação(ões); o vínculo só muda depois, se for encerrado com motivo`}
          largura={540} onClose={() => setModal(null)}
          rodape={<><span style={{ flex: 1 }} /><BotaoSec onClick={() => setModal(null)}>Cancelar</BotaoSec><button type="button" style={{ ...botaoPri, background: modal.tipo === 'encerrar' ? '#A32D2D' : PROJ }} onClick={executar}>{modal.tipo === 'encerrar' ? 'Encerrar' : 'Gravar'}</button></>}>
          {erroModal && <div style={erroSt}>⚠ {erroModal}</div>}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>Motivo (mínimo de 10 caracteres)
            <textarea autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} style={{ padding: '6px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, resize: 'vertical' }} /></label>
        </ModalProjeto>)}
    </div>
  );
}
