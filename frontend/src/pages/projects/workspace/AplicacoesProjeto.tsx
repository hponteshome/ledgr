// frontend/src/pages/projects/workspace/AplicacoesProjeto.tsx
// Fase 1.11 parte A / A2 (04/10/2026): aplicacoes de recursos da operacao - so o que o Financeiro classificou no LEDGR,
// cada uma com a saida do extrato como prova. Totais por natureza; devolucoes destacadas. Master: encerrar com motivo
// (a saida volta a triagem no LEDGR).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { Operacao, fmtBRL, fmtData, cardSt, thSt, tdSt, erroSt, secTitle, tituloSt, subtituloSt } from './projetoTema';
import { ModalProjeto, Secao, ErroModal, BotaoSec, BotaoPri, inputModal, erroApi } from './ModalProjeto';
import { usePrintHandler } from '../../../contexts/PrintContext';
import { imprimirProjeto } from './imprimirProjeto';

interface Aplicacao {
  id: string; dataAplicacao: string; valor: string; descricao: string | null; motivo: string; lancamento: string | null;
  beneficiario: string | null; creditoNumero: number | null; natureza: { codigo: string; nome: string; tipo: string };
}

const ROT_DARF: [string, string][] = [['TODOS', 'Todos'], ['OK', 'DARF ✓'], ['PARCIAL', 'Parcial'], ['SEM', 'Sem DARF']];
const COR_DARF: Record<string, string> = { TODOS: '#134E4A', OK: '#166534', PARCIAL: '#B45309', SEM: '#A32D2D' };
function ChipsDarf({ valor, set, contagem }: { valor: string; set: (v: string) => void; contagem: Record<string, number> }) {
  return <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>{ROT_DARF.map(([k, r]) => (
    <button key={k} onClick={() => set(k)} style={{ padding: '3px 10px', fontSize: 12, borderRadius: 999, cursor: 'pointer', border: `1px solid ${COR_DARF[k]}`,
      background: valor === k ? COR_DARF[k] : '#fff', color: valor === k ? '#fff' : COR_DARF[k], fontWeight: 600 }}>{r} ({contagem[k] || 0})</button>))}</div>;
}

export default function AplicacoesProjeto({ operacao, master, projetoNome }: { operacao: Operacao | null; master: boolean; projetoNome?: string }) {
  const [lista, setLista] = useState<Aplicacao[]>([]);
  const [erro, setErro] = useState('');
  const [encerrando, setEncerrando] = useState<Aplicacao | null>(null);
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [natSel, setNatSel] = useState('');
  // Rateio e reclassificacao (14/10/2026): busca no lancamento, selecao para reclassificar em lote e rateio de uma aplicacao.
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [rateando, setRateando] = useState<Aplicacao | null>(null);
  const [lote, setLote] = useState(false);
  const [naturezas, setNaturezas] = useState<{ codigo: string; nome: string }[]>([]);
  useEffect(() => {
    if (!master || !operacao) return;
    api.get(`/projects/operacoes/${operacao.id}/naturezas-aplicacao`).then((r) => setNaturezas(r.data || [])).catch(() => setNaturezas([]));
  }, [master, operacao]);
  const alternarSel = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const carregar = useCallback(() => {
    if (!operacao) return;
    api.get(`/projects/operacoes/${operacao.id}/aplicacoes`).then((r) => setLista(r.data || [])).catch((e) => setErro(erroApi(e, 'Falha ao carregar as aplicações.')));
  }, [operacao]);
  useEffect(() => { carregar(); }, [carregar]);
  // Comprovacao fiscal (08/10/2026): DARFs vinculados a cada aplicacao; so o Master ve o selo.
  const [comprov, setComprov] = useState<Record<string, { valor: number; darfs: string[] }>>({});
  const [fDarf, setFDarf] = useState('TODOS');
  useEffect(() => {
    if (!master || !operacao) return;
    api.get(`/projects-relatorios/operacoes/${operacao.id}/comprovacao-fiscal`)
      .then((r) => setComprov(Object.fromEntries((r.data || []).map((x: any) => [x.aplicacaoId, x]))))
      .catch(() => setComprov({}));
  }, [master, operacao]);
  // Periodo (07/10/2026): totais e lista ate uma data (ex.: 31/12/2025); clique na natureza filtra a lista.
  const noPeriodo = useMemo(() => lista.filter((a) => { const d = String(a.dataAplicacao).slice(0, 10); return (!de || d >= de) && (!ate || d <= ate); }), [lista, de, ate]);
  const porNatureza = useMemo(() => {
    const m = new Map<string, { codigo: string; nome: string; tipo: string; total: number; n: number }>();
    noPeriodo.forEach((a) => { const e = m.get(a.natureza.codigo) || { codigo: a.natureza.codigo, nome: a.natureza.nome, tipo: a.natureza.tipo, total: 0, n: 0 }; e.total += Number(a.valor); e.n += 1; m.set(a.natureza.codigo, e); });
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [noPeriodo]);
  const total = noPeriodo.reduce((s, a) => s + Number(a.valor), 0);
  // Filtro pelos selos de DARF (08/10/2026): so impostos; as demais naturezas ficam como 'NA'.
  const statusDarf = (a: Aplicacao) => { if (!/impost/i.test(a.natureza.nome)) return 'NA'; const c = comprov[a.id]; return c && c.valor >= Number(a.valor) - 0.005 ? 'OK' : c ? 'PARCIAL' : 'SEM'; };
  const baseNat = natSel ? noPeriodo.filter((a) => a.natureza.codigo === natSel) : noPeriodo;
  const contDarf: Record<string, number> = { TODOS: baseNat.length }; baseNat.forEach((a) => { const s = statusDarf(a); contDarf[s] = (contDarf[s] || 0) + 1; });
  const tBusca = busca.trim().toLowerCase();
  const visiveis = (fDarf === 'TODOS' ? baseNat : baseNat.filter((a) => statusDarf(a) === fDarf))
    .filter((a) => !tBusca || [a.lancamento, a.descricao, a.motivo, a.natureza.nome].some((x) => (x || '').toLowerCase().includes(tBusca)));
  const totalVis = visiveis.reduce((s, a) => s + Number(a.valor), 0);
  const br = (d: string) => d.split('-').reverse().join('/');
  const periodo = de && ate ? `de ${br(de)} a ${br(ate)}` : ate ? `até ${br(ate)}` : de ? `desde ${br(de)}` : 'geral';
  const anoAtual = String(new Date().getFullYear());
  // Impressao (14/10/2026): botao flutuante global - totais por natureza e a lista como estao na tela (periodo e filtros).
  const raiz = useRef<HTMLDivElement>(null);
  usePrintHandler(operacao && lista.length ? () => imprimirProjeto({ projetoNome, titulo: 'Aplicações de recursos',
    subtitulo: operacao.nome + (natSel ? ' · ' + (porNatureza.find((n) => n.codigo === natSel)?.nome || '') : '') + (fDarf !== 'TODOS' ? ' · DARF: ' + (ROT_DARF.find(([k]) => k === fDarf)?.[1] || fDarf) : ''),
    periodo, raiz: raiz.current, larguraTotal: true }) : null, 'Imprimir Aplicações', [operacao, lista, periodo, natSel, fDarf, comprov, projetoNome]);
  if (!operacao) return <div style={{ color: '#6B7280' }}>Nenhuma operação disponível para o seu acesso.</div>;
  return (
    <div ref={raiz} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div data-noprint="1" style={tituloSt}>Aplicações de recursos</div>
        <div data-noprint="1" style={subtituloSt}>{operacao.nome} · saídas classificadas pelo Financeiro no LEDGR, comprovadas no extrato · total {periodo}: {fmtBRL(total)}</div>
      </div>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      <div style={{ ...cardSt, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <div style={{ ...secTitle, marginBottom: 0 }}>Por natureza · {periodo}</div>
          <div style={{ flex: 1 }} />
          <span data-noprint="1" style={{ fontSize: 12, color: '#6B7280' }}>De</span>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={{ ...inputModal, width: 150, padding: '5px 8px' }} />
          <span data-noprint="1" style={{ fontSize: 12, color: '#6B7280' }}>Até</span>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={{ ...inputModal, width: 150, padding: '5px 8px' }} />
          {([['Até 31/12/2025', '', '2025-12-31'], ['Ano atual', anoAtual + '-01-01', ''], ['Tudo', '', '']] as [string, string, string][]).map(([rot, d, a]) => (
            <button key={rot} onClick={() => { setDe(d); setAte(a); }} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 7, cursor: 'pointer', border: '0.5px solid #E5E7EB', background: de === d && ate === a ? '#134E4A' : '#fff', color: de === d && ate === a ? '#fff' : '#134E4A' }}>{rot}</button>
          ))}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {porNatureza.length === 0 && <tr><td colSpan={3} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF' }}>Nenhuma aplicação no período.</td></tr>}
            {porNatureza.map((n) => (
              <tr key={n.codigo} onClick={() => setNatSel(natSel === n.codigo ? '' : n.codigo)} title="Clique para filtrar a lista por esta natureza" style={{ cursor: 'pointer', background: natSel === n.codigo ? '#E6F4F1' : undefined }}>
                <td style={{ ...tdSt, fontWeight: natSel === n.codigo ? 700 : 400 }}>{natSel === n.codigo ? '▶ ' : ''}{n.nome}</td>
                <td style={{ ...tdSt, textAlign: 'right' }}>{n.n}</td>
                <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>{fmtBRL(n.total)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: '1.5px solid #134E4A' }}>
              <td style={{ ...tdSt, fontWeight: 700 }}>Total {periodo}</td>
              <td style={{ ...tdSt, textAlign: 'right', fontWeight: 700 }}>{noPeriodo.length}</td>
              <td style={{ ...tdSt, textAlign: 'right', fontWeight: 700 }}>{fmtBRL(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ ...cardSt, overflowX: 'auto' }}>
        <div data-noprint="1" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '10px 10px 0' }}>
          <input style={{ ...inputModal, width: 280, padding: '5px 8px' }} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar no lançamento, descrição ou natureza" />
          {master && <>
            <button onClick={() => setSel(new Set(visiveis.map((a) => a.id)))} style={{ padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#134E4A', cursor: 'pointer' }}>Selecionar visíveis ({visiveis.length})</button>
            {sel.size > 0 && <button onClick={() => setSel(new Set())} style={{ padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#134E4A', cursor: 'pointer' }}>Limpar seleção</button>}
            <span style={{ flex: 1 }} />
            <button disabled={!sel.size} onClick={() => setLote(true)} style={{ padding: '5px 12px', fontSize: 12, border: 'none', borderRadius: 7, background: '#134E4A', color: '#fff', cursor: sel.size ? 'pointer' : 'default', opacity: sel.size ? 1 : 0.5 }}>Reclassificar selecionadas ({sel.size})</button>
          </>}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          {master && <caption data-noprint="1" style={{ textAlign: 'left', padding: '10px 10px 6px', captionSide: 'top' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: 0.4 }}>COMPROVAÇÃO FISCAL</span><ChipsDarf valor={fDarf} set={setFDarf} contagem={contDarf} /></div></caption>}<thead><tr>{master && <th style={thSt}></th>}<th style={thSt}>Data</th><th style={thSt}>Natureza</th><th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={thSt}>Descrição e motivo</th><th style={thSt}>Devolvido a / crédito</th><th style={thSt}>Lançamento do extrato</th>{master && <th style={thSt}></th>}</tr></thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={7} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Nenhuma aplicação classificada ainda. A classificação é feita no LEDGR, em Projetos → Classificar saídas.</td></tr>}
            {visiveis.map((a) => (
              <tr key={a.id}>
                {master && <td style={tdSt}><input type="checkbox" checked={sel.has(a.id)} onChange={() => alternarSel(a.id)} /></td>}<td style={{ ...tdSt, whiteSpace: 'nowrap' }}>{fmtData(a.dataAplicacao)}</td>
                <td style={tdSt}>{a.natureza.nome}{master && /impost/i.test(a.natureza.nome) && (() => { const c = comprov[a.id]; const ok = c && c.valor >= Number(a.valor) - 0.005; const [txt, bg, fg] = ok ? ['DARF ✓', '#DCFCE7', '#166534'] : c ? ['DARF parcial', '#FEF3C7', '#78350F'] : ['sem DARF', '#FCEBEB', '#A32D2D']; return <span title={c ? 'DARF: ' + c.darfs.join(', ') : 'Nenhum DARF vinculado (Comprovantes fiscais)'} style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, borderRadius: 999, padding: '1px 7px', background: bg, color: fg, whiteSpace: 'nowrap' }}>{txt}</span>; })()}</td>
                <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtBRL(a.valor)}</td>
                <td style={tdSt}>{a.descricao && <div>{a.descricao}</div>}<div style={{ fontSize: 11, color: '#6B7280' }}>{a.motivo}</div></td>
                <td style={tdSt}>{a.beneficiario || '-'}{a.creditoNumero ? ` · crédito nº ${a.creditoNumero}` : ''}</td>
                <td style={{ ...tdSt, fontSize: 12 }}>{a.lancamento || '-'}</td>
                {master && <td style={{ ...tdSt, textAlign: 'right' }}><button onClick={() => setRateando(a)} style={{ padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#134E4A', cursor: 'pointer', marginRight: 6 }}>Ratear</button><button onClick={() => setEncerrando(a)} style={{ padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#A32D2D', cursor: 'pointer' }}>Encerrar</button></td>}
              </tr>
            ))}
          </tbody>
<tfoot><tr><td colSpan={master ? 3 : 2} style={{ ...tdSt, fontWeight: 700 }}>{visiveis.length} aplicação(ões){natSel ? ' · ' + (porNatureza.find((n) => n.codigo === natSel)?.nome || '') : ''} · {periodo}</td><td style={{ ...tdSt, textAlign: 'right', fontWeight: 700 }}>{fmtBRL(totalVis)}</td><td colSpan={master ? 4 : 3} style={tdSt}></td></tr></tfoot>
        </table>
      </div>
      {rateando && <RatearModal operacaoId={operacao.id} ap={rateando} naturezas={naturezas} onClose={() => setRateando(null)} onFeito={() => { setRateando(null); setSel(new Set()); carregar(); }} />}
      {lote && <LoteModal operacaoId={operacao.id} lista={lista.filter((a) => sel.has(a.id))} naturezas={naturezas} onClose={() => setLote(false)} onFeito={() => { setLote(false); setSel(new Set()); carregar(); }} />}
      {encerrando && <EncerrarModal operacaoId={operacao.id} ap={encerrando} onClose={() => setEncerrando(null)} onFeito={() => { setEncerrando(null); carregar(); }} />}
    </div>
  );
}

function EncerrarModal({ operacaoId, ap, onClose, onFeito }: { operacaoId: string; ap: Aplicacao; onClose: () => void; onFeito: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valido = motivo.trim().length >= 10;
  const enviar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      await api.post(`/projects/operacoes/${operacaoId}/aplicacoes/${ap.id}/encerrar`, { motivo: motivo.trim() });
      toast.success('Aplicação encerrada; a saída voltou à triagem no LEDGR.');
      onFeito();
    } catch (e: any) { setErro(erroApi(e, 'Falha ao encerrar.')); } finally { setEnviando(false); }
  };
  return (
    <ModalProjeto titulo="Encerrar aplicação" subtitulo={`${fmtData(ap.dataAplicacao)} · ${fmtBRL(ap.valor)} · ${ap.natureza.nome}`} largura={480} onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Voltar</BotaoSec><BotaoPri onClick={enviar} ativo={valido && !enviando} perigo>{enviando ? 'Aguarde...' : 'Encerrar'}</BotaoPri></>}>
      <ErroModal msg={erro} />
      <Secao><div style={{ fontSize: 12, color: '#374151' }}>A aplicação fica no histórico com o motivo, e a saída volta para Classificar saídas no LEDGR, para ser reclassificada.</div></Secao>
      <Secao titulo="MOTIVO *"><textarea style={{ ...inputModal, minHeight: 64, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres. Ex.: devolução ao caixa da SUNSYS, não ao Adquirente." /></Secao>
    </ModalProjeto>
  );
}

// Rateio (14/10/2026): a aplicacao e encerrada e substituida pelas partes, que somam o valor original (natureza, valor e descricao).
const centavos = (s: string) => { const t = String(s || '').trim(); const n = t.includes(',') ? Number(t.split('.').join('').replace(',', '.')) : Number(t); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };
type Parte = { natureza: string; valor: string; descricao: string };
function RatearModal({ operacaoId, ap, naturezas, onClose, onFeito }: { operacaoId: string; ap: Aplicacao; naturezas: { codigo: string; nome: string }[]; onClose: () => void; onFeito: () => void }) {
  const total = Math.round(Number(ap.valor) * 100);
  const [partes, setPartes] = useState<Parte[]>([{ natureza: ap.natureza.codigo, valor: '', descricao: ap.descricao || '' }, { natureza: '', valor: '', descricao: '' }]);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const somaC = partes.reduce((s, p) => s + (centavos(p.valor) || 0), 0);
  const resto = total - somaC;
  const valido = partes.length > 0 && partes.every((p) => !!p.natureza && centavos(p.valor) > 0) && resto === 0 && motivo.trim().length >= 10;
  const mudar = (i: number, campo: keyof Parte, v: string) => setPartes((l) => l.map((p, j) => (j === i ? { ...p, [campo]: v } : p)));
  const enviar = async () => {
    if (!valido) return; setErro(''); setEnviando(true);
    try {
      await api.post(`/projects/operacoes/${operacaoId}/aplicacoes/reclassificar`, { motivo: motivo.trim(), itens: [{ aplicacaoId: ap.id, partes: partes.map((p) => ({ naturezaCodigo: p.natureza, valor: centavos(p.valor) / 100, descricao: p.descricao.trim() })) }] });
      toast.success('Aplicação rateada. Classifique as partes no Anexo V.'); onFeito();
    } catch (e: any) { setErro(erroApi(e, 'Falha ao ratear.')); } finally { setEnviando(false); }
  };
  return (
    <ModalProjeto titulo="Ratear aplicação" subtitulo={`${fmtData(ap.dataAplicacao)} · ${fmtBRL(ap.valor)} · ${ap.lancamento || ap.natureza.nome}`} largura={760} onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Cancelar</BotaoSec><BotaoPri onClick={enviar} ativo={valido && !enviando}>{enviando ? 'Aguarde...' : 'Ratear'}</BotaoPri></>}>
      <ErroModal msg={erro} />
      <Secao titulo="PARTES (SOMAM O VALOR DA APLICAÇÃO)">
        {partes.map((p, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '220px 130px 1fr 28px', gap: 8, marginBottom: 8 }}>
            <select style={inputModal} value={p.natureza} onChange={(e) => mudar(i, 'natureza', e.target.value)}><option value="">Natureza...</option>{naturezas.map((n) => <option key={n.codigo} value={n.codigo}>{n.nome}</option>)}</select>
            <input style={inputModal} value={p.valor} onChange={(e) => mudar(i, 'valor', e.target.value)} placeholder="Valor" />
            <input style={inputModal} value={p.descricao} onChange={(e) => mudar(i, 'descricao', e.target.value)} placeholder="Descrição (favorecido, processo, contrato)" />
            <button title="Remover parte" disabled={partes.length === 1} onClick={() => setPartes((l) => l.filter((_, j) => j !== i))} style={{ border: 'none', background: 'transparent', color: '#A32D2D', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setPartes((l) => [...l, { natureza: '', valor: resto > 0 ? (resto / 100).toFixed(2).replace('.', ',') : '', descricao: '' }])} style={{ padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#134E4A', cursor: 'pointer' }}>+ parte</button>
          <span style={{ fontSize: 12, color: resto === 0 ? '#166534' : '#A32D2D' }}>{resto === 0 ? 'Partes somam o valor da aplicação.' : resto > 0 ? `Faltam ${fmtBRL(resto / 100)}` : `Passou ${fmtBRL(-resto / 100)}`}</span>
        </div>
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8 }}>A aplicação original fica no histórico (encerrada com o motivo) e a classificação dela no Anexo V é encerrada: classifique cada parte de novo.</div>
      </Secao>
      <Secao titulo="MOTIVO *"><textarea style={{ ...inputModal, minHeight: 56, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres. Ex.: 50.945,00 processo Roberto Herculano + 10.000,00 sinal do contrato Visão Contábil." /></Secao>
    </ModalProjeto>
  );
}

// Reclassificacao em lote (14/10/2026): troca a natureza das aplicacoes selecionadas (cada uma vira uma parte unica, mesmo valor).
function LoteModal({ operacaoId, lista, naturezas, onClose, onFeito }: { operacaoId: string; lista: Aplicacao[]; naturezas: { codigo: string; nome: string }[]; onClose: () => void; onFeito: () => void }) {
  const [natureza, setNatureza] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [feitas, setFeitas] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const alvo = lista.filter((a) => a.natureza.codigo !== natureza);
  const total = alvo.reduce((s, a) => s + Number(a.valor), 0);
  const valido = !!natureza && alvo.length > 0 && motivo.trim().length >= 10;
  const enviar = async () => {
    if (!valido) return; setErro(''); setEnviando(true); let n = 0;
    try {
      for (let i = 0; i < alvo.length; i += 25) {
        const bloco = alvo.slice(i, i + 25);
        await api.post(`/projects/operacoes/${operacaoId}/aplicacoes/reclassificar`, { motivo: motivo.trim(), itens: bloco.map((a) => ({ aplicacaoId: a.id, partes: [{ naturezaCodigo: natureza, valor: Number(a.valor), descricao: a.descricao || '' }] })) });
        n += bloco.length; setFeitas(n);
      }
      toast.success(`${n} aplicação(ões) reclassificada(s).`); onFeito();
    } catch (e: any) { setErro(`${erroApi(e, 'Falha ao reclassificar.')} (${n} de ${alvo.length} já reclassificadas)`); } finally { setEnviando(false); }
  };
  return (
    <ModalProjeto titulo="Reclassificar aplicações" subtitulo={`${alvo.length} aplicação(ões) · ${fmtBRL(total)}`} largura={520} onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Cancelar</BotaoSec><BotaoPri onClick={enviar} ativo={valido && !enviando}>{enviando ? `Aguarde... ${feitas}/${alvo.length}` : 'Reclassificar'}</BotaoPri></>}>
      <ErroModal msg={erro} />
      <Secao titulo="NOVA NATUREZA *"><select style={inputModal} value={natureza} onChange={(e) => setNatureza(e.target.value)}><option value="">Selecione...</option>{naturezas.map((n) => <option key={n.codigo} value={n.codigo}>{n.nome}</option>)}</select>
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6 }}>Cada aplicação é encerrada e recriada com a nova natureza (mesmo valor, data e saída do extrato). A classificação no Anexo V delas é encerrada. As que já têm esta natureza ficam de fora.</div></Secao>
      <Secao titulo="MOTIVO *"><textarea style={{ ...inputModal, minHeight: 56, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres. Ex.: folha da própria Sunsys, sem mútuo com a Hotelsys." /></Secao>
    </ModalProjeto>
  );
}
