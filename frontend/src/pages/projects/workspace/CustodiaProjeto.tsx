// frontend/src/pages/projects/workspace/CustodiaProjeto.tsx
// Custodia (Etapa B, 06/10/2026), so o Master por ora: prestacao de contas dos recursos enviados as contas de terceiros
// (Josi). Envios e devolucoes vem do extrato; pagamentos diretos e recebimentos de terceiros sao registrados com comprovante
// e validados; alocacoes ligam cada envio a sua justificativa e cada devolucao a sua origem.
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { cardSt, thSt, tdSt, erroSt, secTitle, tituloSt, subtituloSt, fmtBRL, fmtData } from './projetoTema';
import { ModalProjeto, Secao, ErroModal, Campo, BotaoSec, BotaoPri, inputModal, erroApi } from './ModalProjeto';
import { useOrdenacao, ThOrdenavel } from '../ordenacao';

const SIT: Record<string, [string, string, string]> = { REGISTRADO: ['Em análise', '#FEF3C7', '#78350F'], VALIDADO: ['Validado', '#DCFCE7', '#166534'], RECUSADO: ['Recusado', '#FCEBEB', '#A32D2D'] };
const selo = (txt: string, bg: string, fg: string) => <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '1px 8px', background: bg, color: fg, whiteSpace: 'nowrap' }}>{txt}</span>;
const btn: React.CSSProperties = { padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#134E4A', cursor: 'pointer' };
const btnPri: React.CSSProperties = { ...btn, border: 'none', background: '#1A4A3A', color: '#fff' };

export default function CustodiaProjeto({ projetoId }: { projetoId: string }) {
  const [lista, setLista] = useState<{ codigo: string; nome: string }[]>([]);
  const [codigo, setCodigo] = useState('');
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [justificar, setJustificar] = useState<any>(null);
  const [origem, setOrigem] = useState<any>(null);
  const [acao, setAcao] = useState<{ tipo: 'recusar' | 'encerrar'; alvo: 'lancamento' | 'alocacao'; id: string; rotulo: string } | null>(null);
  const base = `/projects-relatorios/projetos/${projetoId}/custodias`;
  useEffect(() => {
    api.get(base).then((r) => { setLista(r.data || []); if (r.data?.length) setCodigo(r.data[0].codigo); }).catch((e) => setErro(erroApi(e, 'Falha ao carregar as custódias.')));
  }, [base]);
  const carregar = useCallback(() => {
    if (!codigo) return;
    api.get(`${base}/${codigo}`).then((r) => setD(r.data)).catch((e) => setErro(erroApi(e, 'Falha ao carregar a custódia.')));
  }, [base, codigo]);
  useEffect(() => { carregar(); }, [carregar]);
  const validar = async (alvo: 'lancamento' | 'alocacao', id: string) => {
    try { await api.post(`${base}/${codigo}/validar`, { alvo, id, decisao: 'VALIDADO' }); toast.success('Validado.'); carregar(); } catch (e: any) { toast.error(erroApi(e, 'Falha ao validar.')); }
  };
  if (erro) return <div style={erroSt}>⚠ {erro}</div>;
  if (!lista.length) return <div style={{ color: '#6B7280' }}>Nenhuma custódia cadastrada neste projeto.</div>;
  if (!d) return <div style={{ color: '#6B7280' }}>Carregando...</div>;
  const r = d.resumo; const L: any[] = d.lancamentos;
  const envios = L.filter((x) => x.tipo === 'ENVIO'); const devol = L.filter((x) => x.tipo === 'DEVOLUCAO');
  const manuais = L.filter((x) => x.tipo === 'PAGAMENTO_DIRETO' || x.tipo === 'RECEBIMENTO_TERCEIRO');
  const fila = [...manuais.filter((x) => x.situacao === 'REGISTRADO').map((x) => ({ alvo: 'lancamento' as const, id: x.id, rotulo: `${x.tipo === 'PAGAMENTO_DIRETO' ? 'Pagamento direto' : 'Recebimento de terceiro'} ${fmtData(x.data)} · ${fmtBRL(x.valor)} · ${x.favorecido || '-'}`, det: x.descricao, motivo: x.motivo })),
    ...d.alocacoes.filter((a: any) => a.situacao === 'REGISTRADO').map((a: any) => ({ alvo: 'alocacao' as const, id: a.id, rotulo: `Alocação ${fmtBRL(a.valor)}: ${a.origem} → ${a.destino}`, det: '', motivo: a.motivo }))];
  const card = (rot: string, val: string, sub?: string, cor?: string) => (
    <div style={{ ...cardSt, padding: '10px 14px' }}><div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{rot}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: cor || '#0F2747', margin: '2px 0' }}>{val}</div>{sub && <div style={{ fontSize: 11, color: '#6B7280' }}>{sub}</div>}</div>);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ flex: 1 }}><div style={tituloSt}>{d.custodia.nome}</div><div style={subtituloSt}>{d.custodia.descricao} · prazo de prestação de contas: {d.custodia.prazoDias} dias</div></div>
        {lista.length > 1 && <select value={codigo} onChange={(e) => setCodigo(e.target.value)} style={{ ...inputModal, width: 260 }}>{lista.map((c) => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}</select>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        {card('Enviado', fmtBRL(r.enviado))}{card('Devolvido', fmtBRL(r.devolvido))}
        {card('Pagamentos diretos', fmtBRL(r.pagosDiretos), r.pagosDiretosEmAnalise ? `+ ${fmtBRL(r.pagosDiretosEmAnalise)} em análise` : 'validados')}
        {card('Recebimentos de terceiros', fmtBRL(r.recebidosTerceiros), r.recebidosEmAnalise ? `+ ${fmtBRL(r.recebidosEmAnalise)} em análise` : 'validados')}
        {card('Saldo em poder', fmtBRL(r.saldoEmPoder), r.saldoEmPoder < 0 ? 'devolvido a mais: origem a justificar' : 'a devolver ou comprovar', r.saldoEmPoder < 0 ? '#B45309' : undefined)}
        {card('Envios a justificar', fmtBRL(r.enviosPendentes), `${r.enviosVencidos} vencido(s)`, r.enviosVencidos ? '#A32D2D' : undefined)}
        {card('Devoluções sem origem', fmtBRL(r.devolucoesSemOrigem), 'a explicar', r.devolucoesSemOrigem ? '#B45309' : undefined)}
      </div>
      {fila.length > 0 && (
        <div style={{ ...cardSt, padding: 14, border: '1px solid #FCD34D' }}>
          <div style={secTitle}>Validação pendente ({fila.length})</div>
          {fila.map((f) => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '0.5px solid #F3F4F6' }}>
              <div style={{ flex: 1, fontSize: 13 }}>{f.rotulo}<div style={{ fontSize: 11, color: '#6B7280' }}>{f.det ? f.det + ' · ' : ''}{f.motivo}</div></div>
              <button style={btnPri} onClick={() => validar(f.alvo, f.id)}>Validar</button>
              <button style={btn} onClick={() => setAcao({ tipo: 'recusar', alvo: f.alvo, id: f.id, rotulo: f.rotulo })}>Recusar</button>
            </div>
          ))}
        </div>
      )}
      <TabelaEnvios itens={envios} onJustificar={setJustificar} />
      <TabelaDevolucoes itens={devol} onOrigem={setOrigem} />
      <TabelaManuais itens={manuais} onEncerrar={(x: any) => setAcao({ tipo: 'encerrar', alvo: 'lancamento', id: x.id, rotulo: `${fmtData(x.data)} · ${fmtBRL(x.valor)}` })} />
      {justificar && <JustificarModal base={`${base}/${codigo}`} envio={justificar} d={d} onClose={() => setJustificar(null)} onFeito={() => { setJustificar(null); carregar(); }} />}
      {origem && <OrigemModal base={`${base}/${codigo}`} devolucao={origem} d={d} onClose={() => setOrigem(null)} onFeito={() => { setOrigem(null); carregar(); }} />}
      {acao && <MotivoModal titulo={acao.tipo === 'recusar' ? 'Recusar' : 'Encerrar'} rotulo={acao.rotulo} onClose={() => setAcao(null)}
        enviar={async (motivo) => { if (acao.tipo === 'recusar') await api.post(`${base}/${codigo}/validar`, { alvo: acao.alvo, id: acao.id, decisao: 'RECUSADO', motivo }); else await api.post(`${base}/${codigo}/encerrar`, { alvo: acao.alvo, id: acao.id, motivo }); }}
        onFeito={() => { setAcao(null); carregar(); }} />}
    </div>
  );
}

// Ordenacao por coluna (06/10/2026): mesmo componente das telas de triagem; vazios sempre no fim.
const COLS_ENV: Record<string, (x: any) => any> = { data: (x) => x.data, valor: (x) => x.valor, justificado: (x) => x.alocadoValidado, analise: (x) => x.alocadoEmAnalise, pendente: (x) => x.pendente, prazo: (x) => (x.pendente <= 0 ? '9999' : x.prazo) };
const COLS_DEV: Record<string, (x: any) => any> = { data: (x) => x.data, valor: (x) => x.valor, pagador: (x) => x.contraparte || x.lancamentoBanco, origem: (x) => x.alocadoValidado + x.alocadoEmAnalise, sem: (x) => x.pendente };
const COLS_MAN: Record<string, (x: any) => any> = { data: (x) => x.data, tipo: (x) => x.tipo, valor: (x) => x.valor, natureza: (x) => `${x.natureza || ''} ${x.favorecido || ''}`.trim(), comprovante: (x) => x.descricao, situacao: (x) => x.situacao };
const dir: React.CSSProperties = { ...thSt, textAlign: 'right' };

function TabelaEnvios({ itens, onJustificar }: { itens: any[]; onJustificar: (x: any) => void }) {
  const { ordenada, ord, alternar } = useOrdenacao(itens, COLS_ENV, { col: 'data', dir: 'asc' });
  const th = (col: string, rot: string, st: React.CSSProperties = thSt) => <ThOrdenavel col={col} rotulo={rot} ord={ord} alternar={alternar} style={st} />;
  return (
    <div style={{ ...cardSt, overflowX: 'auto' }}>
      <div style={{ ...secTitle, padding: '12px 14px 0' }}>Envios</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{th('data', 'Data')}{th('valor', 'Valor', dir)}{th('justificado', 'Justificado', dir)}{th('analise', 'Em análise', dir)}{th('pendente', 'A justificar', dir)}{th('prazo', 'Prazo')}<th style={thSt}></th></tr></thead>
        <tbody>{ordenada.map((x) => (
          <tr key={x.id}><td style={tdSt}>{fmtData(x.data)}</td><td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>{fmtBRL(x.valor)}</td>
            <td style={{ ...tdSt, textAlign: 'right' }}>{fmtBRL(x.alocadoValidado)}</td><td style={{ ...tdSt, textAlign: 'right' }}>{fmtBRL(x.alocadoEmAnalise)}</td>
            <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>{fmtBRL(x.pendente)}</td>
            <td style={tdSt}>{x.pendente <= 0 ? selo('Justificado', '#DCFCE7', '#166534') : x.vencido ? selo(`Vencido em ${fmtData(x.prazo)}`, '#FCEBEB', '#A32D2D') : selo(`Até ${fmtData(x.prazo)}`, '#FEF3C7', '#78350F')}</td>
            <td style={{ ...tdSt, textAlign: 'right' }}>{x.pendente > 0 && <button style={btnPri} onClick={() => onJustificar(x)}>Justificar</button>}</td></tr>))}</tbody>
      </table>
    </div>
  );
}

function TabelaDevolucoes({ itens, onOrigem }: { itens: any[]; onOrigem: (x: any) => void }) {
  const { ordenada, ord, alternar } = useOrdenacao(itens, COLS_DEV, { col: 'data', dir: 'asc' });
  const th = (col: string, rot: string, st: React.CSSProperties = thSt) => <ThOrdenavel col={col} rotulo={rot} ord={ord} alternar={alternar} style={st} />;
  return (
    <div style={{ ...cardSt, overflowX: 'auto' }}>
      <div style={{ ...secTitle, padding: '12px 14px 0' }}>Devoluções</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{th('data', 'Data')}{th('valor', 'Valor', dir)}{th('pagador', 'Pagador (extrato)')}{th('origem', 'Origem explicada', dir)}{th('sem', 'Sem origem', dir)}<th style={thSt}></th></tr></thead>
        <tbody>{ordenada.map((x) => (
          <tr key={x.id}><td style={tdSt}>{fmtData(x.data)}</td><td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>{fmtBRL(x.valor)}</td><td style={{ ...tdSt, fontSize: 12 }}>{x.contraparte || x.lancamentoBanco}</td>
            <td style={{ ...tdSt, textAlign: 'right' }}>{fmtBRL(x.alocadoValidado + x.alocadoEmAnalise)}</td><td style={{ ...tdSt, textAlign: 'right', fontWeight: 600, color: x.pendente > 0 ? '#B45309' : '#166534' }}>{fmtBRL(x.pendente)}</td>
            <td style={{ ...tdSt, textAlign: 'right' }}>{x.pendente > 0 && <button style={btn} onClick={() => onOrigem(x)}>Explicar origem</button>}</td></tr>))}</tbody>
      </table>
    </div>
  );
}

function TabelaManuais({ itens, onEncerrar }: { itens: any[]; onEncerrar: (x: any) => void }) {
  const { ordenada, ord, alternar } = useOrdenacao(itens, COLS_MAN, { col: 'data', dir: 'asc' });
  const th = (col: string, rot: string, st: React.CSSProperties = thSt) => <ThOrdenavel col={col} rotulo={rot} ord={ord} alternar={alternar} style={st} />;
  return (
    <div style={{ ...cardSt, overflowX: 'auto' }}>
      <div style={{ ...secTitle, padding: '12px 14px 0' }}>Pagamentos diretos e recebimentos de terceiros</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{th('data', 'Data')}{th('tipo', 'Tipo')}{th('valor', 'Valor', dir)}{th('natureza', 'Natureza / favorecido')}{th('comprovante', 'Comprovante')}{th('situacao', 'Situação')}<th style={thSt}></th></tr></thead>
        <tbody>
          {ordenada.length === 0 && <tr><td colSpan={7} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 18 }}>Nenhum registro ainda. Use "Justificar" num envio ou "Explicar origem" numa devolução.</td></tr>}
          {ordenada.map((x) => (
            <tr key={x.id}><td style={tdSt}>{fmtData(x.data)}</td><td style={tdSt}>{x.tipo === 'PAGAMENTO_DIRETO' ? 'Pagamento direto' : 'Recebimento de terceiro'}</td>
              <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>{fmtBRL(x.valor)}</td><td style={{ ...tdSt, fontSize: 12 }}>{x.natureza ? <b>{x.natureza}</b> : null}{x.natureza ? ' · ' : ''}{x.favorecido || '-'}</td>
              <td style={{ ...tdSt, fontSize: 12, color: '#6B7280' }}>{x.descricao}</td>
              <td style={tdSt} title={x.motivoValidacao || ''}>{selo(...SIT[x.situacao])}</td>
              <td style={{ ...tdSt, textAlign: 'right' }}>{x.situacao !== 'RECUSADO' && <button style={btn} onClick={() => onEncerrar(x)}>Encerrar</button>}</td></tr>))}
        </tbody>
      </table>
    </div>
  );
}

function Abas({ abas, ativa, set }: { abas: [string, string][]; ativa: string; set: (k: string) => void }) {
  return <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>{abas.map(([k, r]) => <button key={k} onClick={() => set(k)} style={{ ...btn, background: ativa === k ? '#134E4A' : '#fff', color: ativa === k ? '#fff' : '#134E4A' }}>{r}</button>)}</div>;
}

function JustificarModal({ base, envio, d, onClose, onFeito }: { base: string; envio: any; d: any; onClose: () => void; onFeito: () => void }) {
  const devs = (d.lancamentos as any[]).filter((x) => x.tipo === 'DEVOLUCAO' && x.pendente > 0);
  const [aba, setAba] = useState(devs.length ? 'devolucao' : 'pagamento');
  const [devId, setDevId] = useState('');
  const [valor, setValor] = useState(String(envio.pendente));
  const [data, setData] = useState(envio.data);
  const [natureza, setNatureza] = useState('');
  const [favorecido, setFavorecido] = useState('');
  const [comprovante, setComprovante] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const v = Number(String(valor).replace(',', '.'));
  const valido = v > 0 && v <= envio.pendente + 0.001 && motivo.trim().length >= 10 && (aba === 'devolucao' ? !!devId : !!natureza && comprovante.trim().length >= 3 && !!data);
  const enviar = async () => {
    if (!valido) return; setErro(''); setEnviando(true);
    try {
      if (aba === 'devolucao') await api.post(`${base}/alocacoes`, { origemId: envio.id, destinoId: devId, valor: v, motivo: motivo.trim() });
      else await api.post(`${base}/lancamentos`, { tipo: 'PAGAMENTO_DIRETO', data, valor: v, naturezaCodigo: natureza, favorecido, comprovante, motivo: motivo.trim(), alocarEm: envio.id });
      toast.success('Registrado; aguarda validação.'); onFeito();
    } catch (e: any) { setErro(erroApi(e, 'Falha ao registrar.')); } finally { setEnviando(false); }
  };
  return (
    <ModalProjeto titulo="Justificar envio" subtitulo={`${fmtData(envio.data)} · ${fmtBRL(envio.valor)} · a justificar ${fmtBRL(envio.pendente)}`} onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Cancelar</BotaoSec><BotaoPri onClick={enviar} ativo={valido && !enviando}>{enviando ? 'Aguarde...' : 'Registrar'}</BotaoPri></>}>
      <ErroModal msg={erro} />
      <Abas abas={[['devolucao', 'Com uma devolução'], ['pagamento', 'Com um pagamento direto']]} ativa={aba} set={setAba} />
      {aba === 'devolucao' ? (
        <Secao titulo="DEVOLUÇÃO">
          <Campo rotulo="Devolução *"><select style={inputModal} value={devId} onChange={(e) => { setDevId(e.target.value); const x = devs.find((y) => y.id === e.target.value); if (x) setValor(String(Math.min(envio.pendente, x.pendente))); }}>
            <option value="">Selecione...</option>{devs.map((x) => <option key={x.id} value={x.id}>{fmtData(x.data)} · {fmtBRL(x.valor)} · disponível {fmtBRL(x.pendente)}</option>)}</select></Campo>
        </Secao>
      ) : (
        <Secao titulo="PAGAMENTO DIRETO FEITO PELA CUSTODIANTE">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Campo rotulo="Data do pagamento *"><input type="date" style={inputModal} value={data} onChange={(e) => setData(e.target.value)} /></Campo>
            <Campo rotulo="Natureza *"><select style={inputModal} value={natureza} onChange={(e) => setNatureza(e.target.value)}><option value="">Selecione...</option>{(d.naturezas as any[]).map((n) => <option key={n.codigo} value={n.codigo}>{n.nome}</option>)}</select></Campo>
            <Campo rotulo="Favorecido"><input style={inputModal} value={favorecido} onChange={(e) => setFavorecido(e.target.value)} placeholder="Quem recebeu o pagamento" /></Campo>
            <Campo rotulo="Comprovante *"><input style={inputModal} value={comprovante} onChange={(e) => setComprovante(e.target.value)} placeholder="Nº do DARF, recibo, processo..." /></Campo>
          </div>
        </Secao>
      )}
      <Secao titulo="VALOR E MOTIVO *">
        <Campo rotulo={`Valor (até ${fmtBRL(envio.pendente)})`}><input style={inputModal} value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
        <textarea style={{ ...inputModal, minHeight: 56, marginTop: 8, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres. Fica na trilha de auditoria." />
      </Secao>
    </ModalProjeto>
  );
}

function OrigemModal({ base, devolucao, d, onClose, onFeito }: { base: string; devolucao: any; d: any; onClose: () => void; onFeito: () => void }) {
  const envs = (d.lancamentos as any[]).filter((x) => x.tipo === 'ENVIO' && x.pendente > 0);
  const [aba, setAba] = useState(envs.length ? 'envio' : 'terceiro');
  const [envId, setEnvId] = useState('');
  const [valor, setValor] = useState(String(devolucao.pendente));
  const [data, setData] = useState(devolucao.data);
  const [favorecido, setFavorecido] = useState('');
  const [comprovante, setComprovante] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const v = Number(String(valor).replace(',', '.'));
  const valido = v > 0 && v <= devolucao.pendente + 0.001 && motivo.trim().length >= 10 && (aba === 'envio' ? !!envId : favorecido.trim().length >= 3 && comprovante.trim().length >= 3 && !!data);
  const enviar = async () => {
    if (!valido) return; setErro(''); setEnviando(true);
    try {
      if (aba === 'envio') await api.post(`${base}/alocacoes`, { origemId: envId, destinoId: devolucao.id, valor: v, motivo: motivo.trim() });
      else await api.post(`${base}/lancamentos`, { tipo: 'RECEBIMENTO_TERCEIRO', data, valor: v, favorecido, comprovante, motivo: motivo.trim(), alocarEm: devolucao.id });
      toast.success('Registrado; aguarda validação.'); onFeito();
    } catch (e: any) { setErro(erroApi(e, 'Falha ao registrar.')); } finally { setEnviando(false); }
  };
  return (
    <ModalProjeto titulo="Explicar a origem da devolução" subtitulo={`${fmtData(devolucao.data)} · ${fmtBRL(devolucao.valor)} · sem origem ${fmtBRL(devolucao.pendente)}`} onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Cancelar</BotaoSec><BotaoPri onClick={enviar} ativo={valido && !enviando}>{enviando ? 'Aguarde...' : 'Registrar'}</BotaoPri></>}>
      <ErroModal msg={erro} />
      <Abas abas={[['envio', 'Retorno de um envio'], ['terceiro', 'Recebimento de terceiro']]} ativa={aba} set={setAba} />
      {aba === 'envio' ? (
        <Secao titulo="ENVIO DE ORIGEM">
          <Campo rotulo="Envio *"><select style={inputModal} value={envId} onChange={(e) => { setEnvId(e.target.value); const x = envs.find((y) => y.id === e.target.value); if (x) setValor(String(Math.min(devolucao.pendente, x.pendente))); }}>
            <option value="">Selecione...</option>{envs.map((x) => <option key={x.id} value={x.id}>{fmtData(x.data)} · {fmtBRL(x.valor)} · a justificar {fmtBRL(x.pendente)}</option>)}</select></Campo>
        </Secao>
      ) : (
        <Secao titulo="RECEBIMENTO NA CONTA DA CUSTODIANTE">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Campo rotulo="Data do recebimento *"><input type="date" style={inputModal} value={data} onChange={(e) => setData(e.target.value)} /></Campo>
            <Campo rotulo="Origem (quem pagou) *"><input style={inputModal} value={favorecido} onChange={(e) => setFavorecido(e.target.value)} placeholder="Ex.: hóspede, cliente, venda" /></Campo>
            <Campo rotulo="Comprovante *" largo><input style={inputModal} value={comprovante} onChange={(e) => setComprovante(e.target.value)} placeholder="Recibo, nota, contrato, transferência..." /></Campo>
          </div>
        </Secao>
      )}
      <Secao titulo="VALOR E MOTIVO *">
        <Campo rotulo={`Valor (até ${fmtBRL(devolucao.pendente)})`}><input style={inputModal} value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
        <textarea style={{ ...inputModal, minHeight: 56, marginTop: 8, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres. Fica na trilha de auditoria." />
      </Secao>
    </ModalProjeto>
  );
}

function MotivoModal({ titulo, rotulo, enviar, onClose, onFeito }: { titulo: string; rotulo: string; enviar: (m: string) => Promise<void>; onClose: () => void; onFeito: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ok = motivo.trim().length >= 10;
  return (
    <ModalProjeto titulo={titulo} subtitulo={rotulo} onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Cancelar</BotaoSec><BotaoPri ativo={ok && !enviando} onClick={async () => { if (!ok) return; setEnviando(true); setErro(''); try { await enviar(motivo.trim()); toast.success('Feito.'); onFeito(); } catch (e: any) { setErro(erroApi(e, 'Falha.')); } finally { setEnviando(false); } }}>{enviando ? 'Aguarde...' : titulo}</BotaoPri></>}>
      <ErroModal msg={erro} />
      <Secao titulo="MOTIVO *"><textarea style={{ ...inputModal, minHeight: 64, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres. Fica na trilha de auditoria." /></Secao>
    </ModalProjeto>
  );
}
