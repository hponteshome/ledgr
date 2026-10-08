// frontend/src/pages/projects/workspace/AplicacoesProjeto.tsx
// Fase 1.11 parte A / A2 (04/10/2026): aplicacoes de recursos da operacao - so o que o Financeiro classificou no LEDGR,
// cada uma com a saida do extrato como prova. Totais por natureza; devolucoes destacadas. Master: encerrar com motivo
// (a saida volta a triagem no LEDGR).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { Operacao, fmtBRL, fmtData, cardSt, thSt, tdSt, erroSt, secTitle, tituloSt, subtituloSt } from './projetoTema';
import { ModalProjeto, Secao, ErroModal, BotaoSec, BotaoPri, inputModal, erroApi } from './ModalProjeto';

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

export default function AplicacoesProjeto({ operacao, master }: { operacao: Operacao | null; master: boolean }) {
  const [lista, setLista] = useState<Aplicacao[]>([]);
  const [erro, setErro] = useState('');
  const [encerrando, setEncerrando] = useState<Aplicacao | null>(null);
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [natSel, setNatSel] = useState('');
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
  const visiveis = fDarf === 'TODOS' ? baseNat : baseNat.filter((a) => statusDarf(a) === fDarf);
  const totalVis = visiveis.reduce((s, a) => s + Number(a.valor), 0);
  const br = (d: string) => d.split('-').reverse().join('/');
  const periodo = de && ate ? `de ${br(de)} a ${br(ate)}` : ate ? `até ${br(ate)}` : de ? `desde ${br(de)}` : 'geral';
  const anoAtual = String(new Date().getFullYear());
  if (!operacao) return <div style={{ color: '#6B7280' }}>Nenhuma operação disponível para o seu acesso.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={tituloSt}>Aplicações de recursos</div>
        <div style={subtituloSt}>{operacao.nome} · saídas classificadas pelo Financeiro no LEDGR, comprovadas no extrato · total {periodo}: {fmtBRL(total)}</div>
      </div>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      <div style={{ ...cardSt, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <div style={{ ...secTitle, marginBottom: 0 }}>Por natureza · {periodo}</div>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: '#6B7280' }}>De</span>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={{ ...inputModal, width: 150, padding: '5px 8px' }} />
          <span style={{ fontSize: 12, color: '#6B7280' }}>Até</span>
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
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          {master && <caption style={{ textAlign: 'left', padding: '10px 10px 6px', captionSide: 'top' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: 0.4 }}>COMPROVAÇÃO FISCAL</span><ChipsDarf valor={fDarf} set={setFDarf} contagem={contDarf} /></div></caption>}<thead><tr><th style={thSt}>Data</th><th style={thSt}>Natureza</th><th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={thSt}>Descrição e motivo</th><th style={thSt}>Devolvido a / crédito</th><th style={thSt}>Lançamento do extrato</th>{master && <th style={thSt}></th>}</tr></thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={7} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Nenhuma aplicação classificada ainda. A classificação é feita no LEDGR, em Projetos → Classificar saídas.</td></tr>}
            {visiveis.map((a) => (
              <tr key={a.id}>
                <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>{fmtData(a.dataAplicacao)}</td>
                <td style={tdSt}>{a.natureza.nome}{master && /impost/i.test(a.natureza.nome) && (() => { const c = comprov[a.id]; const ok = c && c.valor >= Number(a.valor) - 0.005; const [txt, bg, fg] = ok ? ['DARF ✓', '#DCFCE7', '#166534'] : c ? ['DARF parcial', '#FEF3C7', '#78350F'] : ['sem DARF', '#FCEBEB', '#A32D2D']; return <span title={c ? 'DARF: ' + c.darfs.join(', ') : 'Nenhum DARF vinculado (Comprovantes fiscais)'} style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, borderRadius: 999, padding: '1px 7px', background: bg, color: fg, whiteSpace: 'nowrap' }}>{txt}</span>; })()}</td>
                <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtBRL(a.valor)}</td>
                <td style={tdSt}>{a.descricao && <div>{a.descricao}</div>}<div style={{ fontSize: 11, color: '#6B7280' }}>{a.motivo}</div></td>
                <td style={tdSt}>{a.beneficiario || '-'}{a.creditoNumero ? ` · crédito nº ${a.creditoNumero}` : ''}</td>
                <td style={{ ...tdSt, fontSize: 12 }}>{a.lancamento || '-'}</td>
                {master && <td style={{ ...tdSt, textAlign: 'right' }}><button onClick={() => setEncerrando(a)} style={{ padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#A32D2D', cursor: 'pointer' }}>Encerrar</button></td>}
              </tr>
            ))}
          </tbody>
<tfoot><tr><td colSpan={2} style={{ ...tdSt, fontWeight: 700 }}>{visiveis.length} aplicação(ões){natSel ? ' · ' + (porNatureza.find((n) => n.codigo === natSel)?.nome || '') : ''} · {periodo}</td><td style={{ ...tdSt, textAlign: 'right', fontWeight: 700 }}>{fmtBRL(totalVis)}</td><td colSpan={master ? 4 : 3} style={tdSt}></td></tr></tfoot>
        </table>
      </div>
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
