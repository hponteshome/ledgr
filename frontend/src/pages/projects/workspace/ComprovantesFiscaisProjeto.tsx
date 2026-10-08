// frontend/src/pages/projects/workspace/ComprovantesFiscaisProjeto.tsx
// Comprovantes fiscais (08/10/2026), so o Master: DARFs do relatorio da RFB e o vinculo de cada um com a aplicacao que o pagou;
// impostos aplicados com a situacao da comprovacao. Vincular e desvincular (com motivo) ficam na trilha de auditoria.
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { cardSt, thSt, tdSt, erroSt, secTitle, tituloSt, subtituloSt, fmtBRL, fmtData } from './projetoTema';
import { ModalProjeto, Secao, ErroModal, Campo, BotaoSec, BotaoPri, inputModal, erroApi } from './ModalProjeto';
import { useOrdenacao, ThOrdenavel } from '../ordenacao';

const dir: React.CSSProperties = { ...thSt, textAlign: 'right' };
const num: React.CSSProperties = { ...tdSt, textAlign: 'right', whiteSpace: 'nowrap' };
const btn: React.CSSProperties = { padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#134E4A', cursor: 'pointer' };
const btnPri: React.CSSProperties = { ...btn, border: 'none', background: '#1A4A3A', color: '#fff' };
const selo = (txt: string, bg: string, fg: string) => <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '1px 8px', background: bg, color: fg, whiteSpace: 'nowrap' }}>{txt}</span>;

const ROT_DARF: [string, string][] = [['TODOS', 'Todos'], ['OK', 'DARF ✓'], ['PARCIAL', 'Parcial'], ['SEM', 'Sem DARF']];
const COR_DARF: Record<string, string> = { TODOS: '#134E4A', OK: '#166534', PARCIAL: '#B45309', SEM: '#A32D2D' };
function ChipsDarf({ valor, set, contagem }: { valor: string; set: (v: string) => void; contagem: Record<string, number> }) {
  return <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>{ROT_DARF.map(([k, r]) => (
    <button key={k} onClick={() => set(k)} style={{ padding: '3px 10px', fontSize: 12, borderRadius: 999, cursor: 'pointer', border: `1px solid ${COR_DARF[k]}`,
      background: valor === k ? COR_DARF[k] : '#fff', color: valor === k ? '#fff' : COR_DARF[k], fontWeight: 600 }}>{r} ({contagem[k] || 0})</button>))}</div>;
}

export default function ComprovantesFiscaisProjeto({ projetoId }: { projetoId: string }) {
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [vinc, setVinc] = useState<{ comprovante?: any; aplicacao?: any } | null>(null);
  const [desv, setDesv] = useState<any>(null);
  const base = `/projects-relatorios/projetos/${projetoId}/comprovantes-fiscais`;
  const carregar = useCallback(() => {
    api.get(base).then((r) => setD(r.data)).catch((e) => setErro(erroApi(e, 'Falha ao carregar os comprovantes fiscais.')));
  }, [base]);
  useEffect(() => { carregar(); }, [carregar]);
  if (erro) return <div style={erroSt}>⚠ {erro}</div>;
  if (!d) return <div style={{ color: '#6B7280' }}>Carregando...</div>;
  const r = d.resumo;
  const card = (rot: string, val: string, sub?: string, cor?: string) => (
    <div style={{ ...cardSt, padding: '10px 14px' }}><div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{rot}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: cor || '#0F2747', margin: '2px 0' }}>{val}</div>{sub && <div style={{ fontSize: 11, color: '#6B7280' }}>{sub}</div>}</div>);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={tituloSt}>Comprovantes fiscais</div>
        <div style={subtituloSt}>DARFs do relatório de pagamentos da RFB, vinculados às aplicações que os pagaram · cada vínculo fica na trilha de auditoria</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        {card('DARFs carregados', fmtBRL(r.totalComprovantes), `${r.qtdComprovantes} documento(s)`)}
        {card('Vinculados a aplicações', fmtBRL(r.totalVinculado))}
        {card('DARFs sem aplicação', fmtBRL(r.semAplicacao), `${r.qtdSemAplicacao} · pagos por outra conta ou a investigar`, r.semAplicacao ? '#B45309' : undefined)}
        {card('Impostos aplicados', fmtBRL(r.totalImpostos), `${r.qtdImpostos} aplicação(ões)`)}
        {card('Comprovados por DARF', fmtBRL(r.impostosComprovados), undefined, '#166534')}
        {card('Impostos sem DARF', fmtBRL(r.impostosSemComprovante), `${r.qtdImpostosSemComprovante} aplicação(ões)`, r.impostosSemComprovante ? '#A32D2D' : undefined)}
      </div>
      <TabelaDarfs itens={d.comprovantes} onVincular={(c: any) => setVinc({ comprovante: c })} onDesvincular={setDesv} />
      <TabelaImpostos itens={d.impostos} onVincular={(a: any) => setVinc({ aplicacao: a })} />
      {vinc && <VincularModal base={base} d={d} inicial={vinc} onClose={() => setVinc(null)} onFeito={() => { setVinc(null); carregar(); }} />}
      {desv && <DesvincularModal base={base} v={desv} onClose={() => setDesv(null)} onFeito={() => { setDesv(null); carregar(); }} />}
    </div>
  );
}

const COLS_D: Record<string, (x: any) => any> = { data: (x) => x.data, receita: (x) => x.receita, numero: (x) => x.numero, periodo: (x) => x.periodo, principal: (x) => x.principal,
  multa: (x) => x.multa, juros: (x) => x.juros, total: (x) => x.total, saldo: (x) => x.saldo };

function TabelaDarfs({ itens, onVincular, onDesvincular }: { itens: any[]; onVincular: (c: any) => void; onDesvincular: (v: any) => void }) {
  const { ordenada, ord, alternar } = useOrdenacao(itens, COLS_D, { col: 'data', dir: 'asc' });
  const th = (col: string, rot: string, st: React.CSSProperties = thSt) => <ThOrdenavel col={col} rotulo={rot} ord={ord} alternar={alternar} style={st} />;
  return (
    <div style={{ ...cardSt, overflowX: 'auto' }}>
      <div style={{ ...secTitle, padding: '12px 14px 0' }}>DARFs</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{th('data', 'Arrecadação')}{th('receita', 'Receita')}{th('numero', 'Nº documento')}{th('periodo', 'Período')}{th('principal', 'Principal', dir)}{th('multa', 'Multa', dir)}{th('juros', 'Juros', dir)}{th('total', 'Total', dir)}{th('saldo', 'Sem aplicação', dir)}<th style={thSt}>Aplicação vinculada</th><th style={thSt}></th></tr></thead>
        <tbody>{ordenada.map((c) => (
          <tr key={c.id} style={{ verticalAlign: 'top' }}>
            <td style={tdSt}>{fmtData(c.data)}</td><td style={tdSt}>{c.receita}</td><td style={{ ...tdSt, fontSize: 12 }}>{c.numero}</td><td style={tdSt}>{c.periodo ? fmtData(c.periodo) : '-'}</td>
            <td style={num}>{fmtBRL(c.principal)}</td><td style={num}>{fmtBRL(c.multa)}</td><td style={num}>{fmtBRL(c.juros)}</td><td style={{ ...num, fontWeight: 600 }}>{fmtBRL(c.total)}</td>
            <td style={{ ...num, color: c.saldo > 0 ? '#B45309' : '#166534' }}>{fmtBRL(c.saldo)}</td>
            <td style={{ ...tdSt, fontSize: 12 }}>{c.vinculos.length === 0 ? selo('sem aplicação', '#FEF3C7', '#78350F') : c.vinculos.map((v: any) => (
              <div key={v.id} style={{ marginBottom: 3 }}>{fmtData(v.data)} · {fmtBRL(v.valor)} · {v.lancamento || v.natureza}{' '}
                <button style={{ ...btn, padding: '0 6px', fontSize: 11, color: '#A32D2D' }} onClick={() => onDesvincular({ ...v, numero: c.numero })}>desvincular</button></div>))}</td>
            <td style={{ ...tdSt, textAlign: 'right' }}>{c.saldo > 0 && <button style={btnPri} onClick={() => onVincular(c)}>Vincular</button>}</td>
          </tr>))}</tbody>
      </table>
    </div>
  );
}

const COLS_I: Record<string, (x: any) => any> = { data: (x) => x.data, valor: (x) => x.valor, comprovado: (x) => x.comprovado, falta: (x) => x.falta, lancamento: (x) => x.lancamento || x.descricao };

function TabelaImpostos({ itens, onVincular }: { itens: any[]; onVincular: (a: any) => void }) {
  const [filtroDarf, setFiltroDarf] = useState('TODOS');
  const st = (a: any) => (a.falta <= 0 ? 'OK' : a.comprovado > 0 ? 'PARCIAL' : 'SEM');
  const cont: Record<string, number> = { TODOS: itens.length }; itens.forEach((a) => { cont[st(a)] = (cont[st(a)] || 0) + 1; });
  const vis = filtroDarf === 'TODOS' ? itens : itens.filter((a) => st(a) === filtroDarf);
  const { ordenada, ord, alternar } = useOrdenacao(vis, COLS_I, { col: 'data', dir: 'asc' });
  const th = (col: string, rot: string, st: React.CSSProperties = thSt) => <ThOrdenavel col={col} rotulo={rot} ord={ord} alternar={alternar} style={st} />;
  const tot = vis.reduce((s, a) => s + a.valor, 0); const falta = vis.reduce((s, a) => s + a.falta, 0);
  return (
    <div style={{ ...cardSt, overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 0' }}>
        <div style={{ ...secTitle, marginBottom: 0, flex: 1 }}>Impostos aplicados e comprovação</div>
        <ChipsDarf valor={filtroDarf} set={setFiltroDarf} contagem={cont} />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{th('data', 'Data')}{th('valor', 'Valor', dir)}{th('comprovado', 'Comprovado', dir)}{th('falta', 'Sem DARF', dir)}<th style={thSt}>Situação</th>{th('lancamento', 'Lançamento / descrição')}<th style={thSt}></th></tr></thead>
        <tbody>{ordenada.map((a) => (
          <tr key={a.id} style={{ verticalAlign: 'top' }}>
            <td style={tdSt}>{fmtData(a.data)}</td><td style={{ ...num, fontWeight: 600 }}>{fmtBRL(a.valor)}</td><td style={num}>{fmtBRL(a.comprovado)}</td>
            <td style={{ ...num, color: a.falta > 0 ? '#A32D2D' : '#166534' }}>{fmtBRL(a.falta)}</td>
            <td style={tdSt}>{a.falta <= 0 ? selo('DARF ✓', '#DCFCE7', '#166534') : a.comprovado > 0 ? selo('DARF parcial', '#FEF3C7', '#78350F') : selo('sem DARF', '#FCEBEB', '#A32D2D')}</td>
            <td style={{ ...tdSt, fontSize: 12 }}>{a.lancamento}{a.descricao && <div style={{ color: '#6B7280', fontSize: 11 }}>{a.descricao}</div>}</td>
            <td style={{ ...tdSt, textAlign: 'right' }}>{a.falta > 0 && <button style={btn} onClick={() => onVincular(a)}>Vincular DARF</button>}</td>
          </tr>))}</tbody>
        <tfoot><tr style={{ borderTop: '1.5px solid #134E4A' }}><td style={{ ...tdSt, fontWeight: 700 }}>{vis.length} aplicação(ões)</td><td style={{ ...num, fontWeight: 700 }}>{fmtBRL(tot)}</td>
          <td style={{ ...num, fontWeight: 700 }}>{fmtBRL(tot - falta)}</td><td style={{ ...num, fontWeight: 700 }}>{fmtBRL(falta)}</td><td colSpan={3} style={tdSt}></td></tr></tfoot>
      </table>
    </div>
  );
}

function VincularModal({ base, d, inicial, onClose, onFeito }: { base: string; d: any; inicial: { comprovante?: any; aplicacao?: any }; onClose: () => void; onFeito: () => void }) {
  const darfs = (d.comprovantes as any[]).filter((c) => c.saldo > 0);
  const apls = (d.impostos as any[]).filter((a) => a.falta > 0);
  const [cid, setCid] = useState<string>(inicial.comprovante?.id || '');
  const [aid, setAid] = useState<string>(inicial.aplicacao?.id || '');
  const c = darfs.find((x) => x.id === cid); const a = apls.find((x) => x.id === aid);
  const sug = c && a ? Math.min(c.saldo, a.falta) : c ? c.saldo : a ? a.falta : 0;
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const v = Number(String(valor || sug).replace(',', '.'));
  const valido = !!c && !!a && v > 0 && v <= Math.min(c.saldo, a.falta) + 0.001 && motivo.trim().length >= 10;
  const enviar = async () => {
    if (!valido) return; setErro(''); setEnviando(true);
    try { await api.post(`${base}/vincular`, { comprovanteId: cid, aplicacaoId: aid, valor: v, motivo: motivo.trim() }); toast.success('DARF vinculado.'); onFeito(); }
    catch (e: any) { setErro(erroApi(e, 'Falha ao vincular.')); } finally { setEnviando(false); }
  };
  return (
    <ModalProjeto titulo="Vincular DARF a uma aplicação" subtitulo="O vínculo não pode passar do valor do DARF nem do valor da aplicação" onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Cancelar</BotaoSec><BotaoPri onClick={enviar} ativo={valido && !enviando}>{enviando ? 'Aguarde...' : 'Vincular'}</BotaoPri></>}>
      <ErroModal msg={erro} />
      <Secao titulo="DOCUMENTO E APLICAÇÃO">
        <Campo rotulo="DARF *"><select style={inputModal} value={cid} onChange={(e) => { setCid(e.target.value); setValor(''); }}>
          <option value="">Selecione...</option>{darfs.map((x) => <option key={x.id} value={x.id}>{fmtData(x.data)} · {x.receita} · {x.numero} · disponível {fmtBRL(x.saldo)}</option>)}</select></Campo>
        <div style={{ height: 8 }} />
        <Campo rotulo="Aplicação (imposto) *"><select style={inputModal} value={aid} onChange={(e) => { setAid(e.target.value); setValor(''); }}>
          <option value="">Selecione...</option>{apls.map((x) => <option key={x.id} value={x.id}>{fmtData(x.data)} · {fmtBRL(x.valor)} · sem DARF {fmtBRL(x.falta)} · {x.lancamento || ''}</option>)}</select></Campo>
      </Secao>
      <Secao titulo="VALOR E MOTIVO *">
        <Campo rotulo={`Valor${c && a ? ` (até ${fmtBRL(Math.min(c.saldo, a.falta))})` : ''}`}><input style={inputModal} value={valor || (sug ? String(sug) : '')} onChange={(e) => setValor(e.target.value)} /></Campo>
        <textarea style={{ ...inputModal, minHeight: 56, marginTop: 8, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: comprovante do Itaú mostra o DARF nº ... pago nesta saída. Mínimo de 10 caracteres." />
      </Secao>
    </ModalProjeto>
  );
}

function DesvincularModal({ base, v, onClose, onFeito }: { base: string; v: any; onClose: () => void; onFeito: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ok = motivo.trim().length >= 10;
  return (
    <ModalProjeto titulo="Desvincular DARF" subtitulo={`DARF ${v.numero} · ${fmtData(v.data)} · ${fmtBRL(v.valor)}`} onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Cancelar</BotaoSec><BotaoPri ativo={ok && !enviando} perigo onClick={async () => { if (!ok) return; setEnviando(true); setErro('');
        try { await api.post(`${base}/desvincular`, { vinculoId: v.id, motivo: motivo.trim() }); toast.success('Vínculo encerrado.'); onFeito(); }
        catch (e: any) { setErro(erroApi(e, 'Falha ao desvincular.')); } finally { setEnviando(false); } }}>{enviando ? 'Aguarde...' : 'Desvincular'}</BotaoPri></>}>
      <ErroModal msg={erro} />
      <Secao titulo="MOTIVO *"><textarea style={{ ...inputModal, minHeight: 64, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres. Fica na trilha de auditoria." /></Secao>
    </ModalProjeto>
  );
}
