// frontend/src/pages/projects/workspace/JuridicoProjeto.tsx
// Juridico RM (30/10/2026): processo, remessas (protocolos Citius), indice de documentos com os arquivos protocolados
// (visualizacao na tela e download com SHA-256), prazos e dossie em zip. Leitura: Master e Revisor; escrita: so Master.
// Arquivo protocolado nao e alterado nem apagado: so encerrado com motivo (regra no banco).
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { thSt, tdSt, erroSt, PROJ, PROJ_ACCENT } from './projetoTema';

const SIT: Record<string, { rot: string; cor: string; fundo: string }> = {
  JUNTO: { rot: 'Junto', cor: '#166534', fundo: '#DCFCE7' },
  SUBSTITUIDO: { rot: 'Substituído', cor: '#6B7280', fundo: '#F3F4F6' },
  SEM_EFEITO: { rot: 'Sem efeito / não junto', cor: '#A32D2D', fundo: '#FCEBEB' },
  A_JUNTAR: { rot: 'A juntar', cor: '#92400E', fundo: '#FEF3C7' },
};
const SIT_PRAZO: Record<string, { rot: string; cor: string; fundo: string }> = {
  ABERTO: { rot: 'Aberto', cor: '#92400E', fundo: '#FEF3C7' },
  CUMPRIDO: { rot: 'Cumprido', cor: '#166534', fundo: '#DCFCE7' },
  DISPENSADO: { rot: 'Dispensado', cor: '#6B7280', fundo: '#F3F4F6' },
};

const painel: React.CSSProperties = { background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: 14, marginBottom: 14 };
const botaoPri: React.CSSProperties = { background: PROJ, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const botaoSec: React.CSSProperties = { background: '#fff', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 6, padding: '7px 14px', fontSize: 13, cursor: 'pointer' };
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: PROJ, cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline' };
const inputSt: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', background: '#fff' };
const pequeno: React.CSSProperties = { fontSize: 11, color: '#6B7280' };
const mono: React.CSSProperties = { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 11 };
const titulo2: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 10px', borderLeft: `3px solid ${PROJ_ACCENT}`, paddingLeft: 8 };

const dataBr = (s?: string | null) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '-');
const tamanho = (n?: number) => (!n ? '-' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const mascaraData = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};
const erroApi = (e: any, padrao: string) => e?.response?.data?.message || padrao;
const docNum = (d: any) => `${d.numero}${d.sub ? '.' + d.sub : ''}`;

function Selo({ s, mapa }: { s: string; mapa: Record<string, { rot: string; cor: string; fundo: string }> }) {
  const x = mapa[s] || { rot: s, cor: '#374151', fundo: '#F3F4F6' };
  return <span style={{ fontSize: 11, fontWeight: 600, color: x.cor, background: x.fundo, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>{x.rot}</span>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '10px 0 4px' }}>{children}</div>;
}

function Modal({ titulo, subtitulo, onClose, children, rodape, largura = 520 }:
  { titulo: string; subtitulo?: string; onClose: () => void; children: React.ReactNode; rodape?: React.ReactNode; largura?: number }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: largura, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: PROJ, color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{titulo}</div>
            {subtitulo && <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{subtitulo}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>{children}</div>
        {rodape && <div style={{ padding: '10px 16px', background: '#FAFAFA', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>{rodape}</div>}
      </div>
    </div>
  );
}

type ModalSt =
  | { tipo: 'situacao'; doc: any }
  | { tipo: 'novoDoc' }
  | { tipo: 'arquivo'; doc: any }
  | { tipo: 'encerrar'; arq: any; doc: any }
  | { tipo: 'referencia'; remessa: any }
  | { tipo: 'prazo'; prazo: any }
  | null;

export default function JuridicoProjeto({ projetoId }: { projetoId: string }) {
  const base = `/projects-juridico/projetos/${projetoId}`;
  const [lista, setLista] = useState<any[]>([]);
  const [procId, setProcId] = useState('');
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState<string>('TODOS');
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState<ModalSt>(null);
  const [f, setF] = useState<Record<string, any>>({});
  const [arq, setArq] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroModal, setErroModal] = useState('');
  const [visor, setVisor] = useState<{ url: string; nome: string; sha: string; doc: string } | null>(null);

  useEffect(() => {
    api.get(`${base}/processos`).then((r) => {
      const it = r.data?.itens || []; setLista(it); if (it.length) setProcId(it[0].id); else setErro('Nenhum processo cadastrado ou sem acesso.');
    }).catch((e) => setErro(erroApi(e, 'Falha ao carregar os processos.')));
  }, [projetoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const carregar = () => {
    if (!procId) return;
    api.get(`${base}/processos/${procId}`).then((r) => { setD(r.data); setErro(''); }).catch((e) => setErro(erroApi(e, 'Falha ao carregar o processo.')));
  };
  useEffect(carregar, [procId]); // eslint-disable-line react-hooks/exhaustive-deps

  const podeOperar = !!d?.podeOperar;
  const docs = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (d?.documentos || []).filter((x: any) => (filtro === 'TODOS' || x.situacao === filtro)
      && (!q || `${docNum(x)} ${x.titulo} ${(x.arquivos || []).map((a: any) => a.arquivoNome + ' ' + (a.nomeOrigem || '')).join(' ')}`.toLowerCase().includes(q)));
  }, [d, filtro, busca]);
  const contagem = useMemo(() => {
    const c: Record<string, number> = { TODOS: (d?.documentos || []).length };
    for (const x of d?.documentos || []) c[x.situacao] = (c[x.situacao] || 0) + 1;
    return c;
  }, [d]);

  const abrir = (m: ModalSt, inicial: Record<string, any> = {}) => { setModal(m); setF(inicial); setArq(null); setErroModal(''); };
  const fechar = () => { if (!enviando) setModal(null); };
  const campo = (k: string) => (e: any) => setF((x) => ({ ...x, [k]: e.target.value }));

  const ver = async (a: any, doc: any) => {
    try {
      const r = await api.get(`${base}/arquivos/${a.id}?inline=1`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data], { type: a.mime || 'application/pdf' }));
      setVisor({ url, nome: a.arquivoNome, sha: r.headers?.['x-documento-sha256'] || a.sha256, doc: docNum(doc) });
    } catch (e: any) { toast.error(erroApi(e, 'Falha ao abrir o arquivo.')); }
  };
  const fecharVisor = () => { if (visor) URL.revokeObjectURL(visor.url); setVisor(null); };
  const baixar = async (url: string, nome: string) => {
    try {
      const r = await api.get(url, { responseType: 'blob' });
      const href = URL.createObjectURL(r.data);
      const el = document.createElement('a'); el.href = href; el.download = nome; document.body.appendChild(el); el.click(); el.remove();
      setTimeout(() => URL.revokeObjectURL(href), 60000);
    } catch (e: any) { toast.error(erroApi(e, 'Falha no download.')); }
  };
  const dossie = () => baixar(`${base}/processos/${procId}/dossie`, `dossie-${d?.processo?.codigo || 'processo'}-${new Date().toISOString().slice(0, 10)}.zip`);

  const confirmar = async () => {
    if (!modal) return;
    setEnviando(true); setErroModal('');
    try {
      if (modal.tipo === 'situacao') {
        await api.post(`${base}/documentos/${modal.doc.id}/situacao`, { situacao: f.situacao, motivo: f.motivo, ...(f.prazo !== undefined ? { prazo: f.prazo } : {}) });
      } else if (modal.tipo === 'novoDoc') {
        await api.post(`${base}/processos/${procId}/documentos`, { numero: f.numero, sub: f.sub, ordem: f.ordem, titulo: f.titulo, situacao: f.situacao || 'JUNTO', prazo: f.prazo, observacao: f.observacao, motivo: f.motivo });
      } else if (modal.tipo === 'arquivo') {
        if (!arq) throw { response: { data: { message: 'Selecione o arquivo.' } } };
        const fd = new FormData();
        fd.append('file', arq); fd.append('remessaId', f.remessaId || '');
        for (const k of ['posicaoCitius', 'nomeOrigem', 'sha256Esperado', 'substituiArquivoId', 'observacao']) if (f[k]) fd.append(k, f[k]);
        const r = await api.post(`${base}/documentos/${modal.doc.id}/arquivos`, fd);
        toast.success(`Arquivo registrado (v${r.data?.versao}) - SHA-256 ${String(r.data?.sha256 || '').slice(0, 12)}...`);
      } else if (modal.tipo === 'encerrar') {
        await api.post(`${base}/arquivos/${modal.arq.id}/encerrar`, { motivo: f.motivo });
      } else if (modal.tipo === 'referencia') {
        const fd = new FormData();
        if (f.refCitius) fd.append('refCitius', f.refCitius);
        if (arq) fd.append('file', arq);
        await api.post(`${base}/remessas/${modal.remessa.id}/referencia`, fd);
      } else if (modal.tipo === 'prazo') {
        await api.post(`${base}/prazos/${modal.prazo.id}`, { situacao: f.situacao, remessaId: f.remessaId || null, observacao: f.observacao });
      }
      if (modal.tipo !== 'arquivo') toast.success('Registrado.');
      setModal(null); carregar();
    } catch (e: any) { setErroModal(erroApi(e, 'Falha ao gravar.')); }
    finally { setEnviando(false); }
  };

  if (erro) return <div style={erroSt}>⚠ {erro}</div>;
  if (!d) return <div style={{ color: '#6B7280' }}>Carregando...</div>;
  const p = d.processo;
  const prazosAbertos = d.prazos.filter((z: any) => z.situacao === 'ABERTO');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#111827', flex: 1 }}>Jurídico RM</h2>
        {lista.length > 1 && (
          <select value={procId} onChange={(e) => setProcId(e.target.value)} style={{ ...inputSt, width: 260 }}>
            {lista.map((x) => <option key={x.id} value={x.id}>{x.codigo} - {x.numero}</option>)}
          </select>
        )}
        <button style={botaoSec} onClick={dossie}>Dossiê (zip)</button>
      </div>

      {/* Processo */}
      <div style={painel}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}>
            <div style={pequeno}>Processo</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{p.numero}</div>
            <div style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>{p.tribunal}{p.juizo ? ` - ${p.juizo}` : ''}</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{p.natureza}</div>
          </div>
          <div style={{ flex: '1 1 320px', fontSize: 12, color: '#374151' }}>
            {p.partes && <div><b>Partes:</b> {p.partes}</div>}
            {p.mandatarios && <div style={{ marginTop: 4 }}><b>Mandatários:</b> {p.mandatarios}</div>}
          </div>
        </div>
      </div>

      {/* Prazos */}
      <div style={painel}>
        <div style={titulo2}>Prazos {prazosAbertos.length > 0 && <span style={{ ...pequeno, fontWeight: 400 }}>({prazosAbertos.length} em aberto)</span>}</div>
        {d.prazos.length === 0 ? <div style={pequeno}>Nenhum prazo.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={thSt}>Data limite</th><th style={thSt}>Descrição</th><th style={thSt}>Situação</th>{podeOperar && <th style={thSt} />}</tr></thead>
            <tbody>
              {d.prazos.map((z: any) => {
                const urg = z.situacao === 'ABERTO' && z.diasRestantes <= 3;
                return (
                  <tr key={z.id}>
                    <td style={{ ...tdSt, whiteSpace: 'nowrap', color: urg ? '#A32D2D' : undefined, fontWeight: urg ? 700 : 400 }}>
                      {dataBr(z.dataLimite)}{z.situacao === 'ABERTO' && <div style={pequeno}>{z.diasRestantes >= 0 ? `faltam ${z.diasRestantes} dia(s)` : `vencido há ${-z.diasRestantes} dia(s)`}</div>}
                    </td>
                    <td style={tdSt}>{z.descricao}{z.observacao && <div style={pequeno}>{z.observacao}</div>}</td>
                    <td style={tdSt}><Selo s={z.situacao} mapa={SIT_PRAZO} /></td>
                    {podeOperar && <td style={tdSt}><button style={linkBtn} onClick={() => abrir({ tipo: 'prazo', prazo: z }, { situacao: z.situacao === 'ABERTO' ? 'CUMPRIDO' : z.situacao, remessaId: z.cumpridoRemessaId || '' })}>Atualizar</button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Remessas */}
      <div style={painel}>
        <div style={titulo2}>Remessas (protocolos)</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {d.remessas.map((r: any) => (
            <div key={r.id} style={{ flex: '1 1 260px', border: '1px solid #E5E7EB', borderRadius: 8, padding: 10, background: '#FAFAFA' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontWeight: 700, color: '#111827' }}>{r.ordem}. {dataBr(r.dataProtocolo)}</div>
                <div style={{ flex: 1 }} />
                {r.refCitius ? <span style={{ ...mono, fontSize: 12, fontWeight: 700 }}>ref. {r.refCitius}</span>
                  : <span style={{ fontSize: 11, fontWeight: 600, color: '#92400E', background: '#FEF3C7', padding: '2px 8px', borderRadius: 10 }}>ref. pendente</span>}
              </div>
              <div style={{ fontSize: 12, color: '#374151', marginTop: 6 }}>{r.descricao}</div>
              <div style={{ ...pequeno, marginTop: 6, display: 'flex', gap: 10, alignItems: 'center' }}>
                <span>{r.arquivos} arquivo(s)</span>
                {r.comprovativoSha256 && <button style={linkBtn} onClick={() => baixar(`${base}/remessas/${r.id}/comprovativo`, r.comprovativoNome || 'comprovativo.pdf')}>Comprovativo</button>}
                {podeOperar && (!r.refCitius || !r.comprovativoSha256) && <button style={linkBtn} onClick={() => abrir({ tipo: 'referencia', remessa: r })}>Completar</button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Indice */}
      <div style={painel}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ ...titulo2, margin: 0 }}>Índice de documentos</div>
          <div style={{ flex: 1 }} />
          {['TODOS', 'JUNTO', 'SUBSTITUIDO', 'SEM_EFEITO', 'A_JUNTAR'].map((s) => (
            <button key={s} onClick={() => setFiltro(s)} style={{ ...botaoSec, padding: '4px 10px', fontSize: 12, background: filtro === s ? PROJ : '#fff', color: filtro === s ? '#fff' : '#374151', borderColor: filtro === s ? PROJ : '#D1D5DB' }}>
              {s === 'TODOS' ? 'Todos' : SIT[s].rot} ({contagem[s] || 0})
            </button>
          ))}
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" style={{ ...inputSt, width: 180 }} />
          {podeOperar && <button style={botaoPri} onClick={() => abrir({ tipo: 'novoDoc' }, { situacao: 'JUNTO' })}>Novo documento</button>}
        </div>
        {docs.length === 0 ? <div style={pequeno}>Nenhum documento {filtro !== 'TODOS' || busca ? 'no filtro' : 'cadastrado - aguardando a carga'}.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...thSt, width: 80 }}>Doc.</th><th style={thSt}>Título</th><th style={{ ...thSt, width: 130 }}>Situação</th><th style={thSt}>Arquivos protocolados</th>{podeOperar && <th style={{ ...thSt, width: 90 }} />}</tr></thead>
            <tbody>
              {docs.map((x: any) => (
                <tr key={x.id} style={{ verticalAlign: 'top' }}>
                  <td style={{ ...tdSt, fontWeight: 700, whiteSpace: 'nowrap' }}>{docNum(x)}</td>
                  <td style={tdSt}>
                    {x.titulo}
                    {x.situacaoMotivo && <div style={pequeno}>{x.situacaoMotivo}</div>}
                    {x.prazo && <div style={{ ...pequeno, color: '#92400E' }}>Prazo: {dataBr(x.prazo)}</div>}
                  </td>
                  <td style={tdSt}><Selo s={x.situacao} mapa={SIT} /></td>
                  <td style={tdSt}>
                    {(x.arquivos || []).length === 0 ? <span style={pequeno}>-</span> : (x.arquivos || []).map((a: any) => (
                      <div key={a.id} style={{ padding: '3px 0', borderBottom: '1px dashed #EEF0F3', opacity: a.canceladoEm ? 0.5 : 1 }}>
                        <div style={{ fontSize: 12 }}>
                          <span style={{ ...mono, color: '#6B7280' }}>{dataBr(a.remessaData)} {a.remessaRef ? `ref. ${a.remessaRef}` : 'ref. pendente'}{a.posicaoCitius ? ` - ${a.posicaoCitius}` : ''}</span>
                          {' '}{a.arquivoNome}{a.versao > 1 && <span style={pequeno}> (v{a.versao})</span>}
                          {a.canceladoEm && <span style={{ ...pequeno, color: '#A32D2D' }}> - encerrado: {a.motivoCancelamento}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <span style={{ ...mono, color: '#9CA3AF' }} title={a.sha256}>SHA-256 {a.sha256.slice(0, 12)}...</span>
                          <span style={pequeno}>{tamanho(a.tamanho)}</span>
                          {!a.canceladoEm && <button style={linkBtn} onClick={() => ver(a, x)}>Ver</button>}
                          {!a.canceladoEm && <button style={linkBtn} onClick={() => baixar(`${base}/arquivos/${a.id}`, a.arquivoNome)}>Baixar</button>}
                          {podeOperar && !a.canceladoEm && <button style={{ ...linkBtn, color: '#A32D2D' }} onClick={() => abrir({ tipo: 'encerrar', arq: a, doc: x })}>Encerrar</button>}
                        </div>
                        {a.nomeOrigem && <div style={pequeno}>Nome no Drive: {a.nomeOrigem}</div>}
                      </div>
                    ))}
                  </td>
                  {podeOperar && (
                    <td style={tdSt}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button style={linkBtn} onClick={() => abrir({ tipo: 'arquivo', doc: x }, { remessaId: d.remessas[d.remessas.length - 1]?.id || '' })}>+ Arquivo</button>
                        <button style={linkBtn} onClick={() => abrir({ tipo: 'situacao', doc: x }, { situacao: x.situacao })}>Situação</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Visualizador */}
      {visor && (
        <Modal titulo={`${visor.doc} - ${visor.nome}`} subtitulo={`SHA-256 ${visor.sha}`} onClose={fecharVisor} largura={1100}>
          <iframe title="documento" src={visor.url} style={{ width: '100%', height: '75vh', border: '1px solid #E5E7EB', borderRadius: 6 }} />
        </Modal>
      )}

      {/* Modais de operacao */}
      {modal && (
        <Modal
          titulo={modal.tipo === 'situacao' ? `Situação - ${docNum(modal.doc)}` : modal.tipo === 'novoDoc' ? 'Novo documento do índice'
            : modal.tipo === 'arquivo' ? `Registrar arquivo protocolado - ${docNum(modal.doc)}` : modal.tipo === 'encerrar' ? `Encerrar arquivo - ${docNum(modal.doc)}`
            : modal.tipo === 'referencia' ? `Remessa ${modal.remessa.ordem} - ${dataBr(modal.remessa.dataProtocolo)}` : 'Atualizar prazo'}
          subtitulo={modal.tipo === 'arquivo' ? 'O arquivo fica imutável; correção só por nova versão ou encerramento com motivo.'
            : modal.tipo === 'encerrar' ? 'O arquivo continua guardado e listado como encerrado.' : undefined}
          onClose={fechar}
          rodape={<>
            <button style={botaoSec} onClick={fechar} disabled={enviando}>Cancelar</button>
            <button style={botaoPri} onClick={confirmar} disabled={enviando}>{enviando ? 'Gravando...' : 'Confirmar'}</button>
          </>}>
          {erroModal && <div style={{ ...erroSt, marginBottom: 10, background: '#FCEBEB' }}>⚠ {erroModal}</div>}

          {modal.tipo === 'situacao' && <>
            <Label>Situação</Label>
            <select value={f.situacao || ''} onChange={campo('situacao')} style={inputSt}>{Object.keys(SIT).map((k) => <option key={k} value={k}>{SIT[k].rot}</option>)}</select>
            {f.situacao === 'A_JUNTAR' && <><Label>Prazo (dd/mm/aaaa)</Label><input value={f.prazo || ''} onChange={(e) => setF((x) => ({ ...x, prazo: mascaraData(e.target.value) }))} style={{ ...inputSt, maxWidth: 160 }} /></>}
            <Label>Motivo (mínimo 10 caracteres)</Label>
            <textarea value={f.motivo || ''} onChange={campo('motivo')} rows={3} style={{ ...inputSt, resize: 'vertical' }} placeholder="Ex.: substituído pelo Doc. 8 retificado junto em 30/10/2026" />
          </>}

          {modal.tipo === 'novoDoc' && <>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 2 }}><Label>Número</Label><input value={f.numero || ''} onChange={campo('numero')} placeholder="Doc. 26" style={inputSt} /></div>
              <div style={{ flex: 1 }}><Label>Sub-item</Label><input value={f.sub || ''} onChange={campo('sub')} placeholder="ex.: 4" style={inputSt} /></div>
              <div style={{ flex: 1 }}><Label>Ordem</Label><input value={f.ordem || ''} onChange={campo('ordem')} placeholder="26" style={inputSt} /></div>
            </div>
            <Label>Título</Label><input value={f.titulo || ''} onChange={campo('titulo')} style={inputSt} />
            <Label>Situação</Label>
            <select value={f.situacao || 'JUNTO'} onChange={campo('situacao')} style={inputSt}>{Object.keys(SIT).map((k) => <option key={k} value={k}>{SIT[k].rot}</option>)}</select>
            {f.situacao === 'A_JUNTAR' && <><Label>Prazo (dd/mm/aaaa)</Label><input value={f.prazo || ''} onChange={(e) => setF((x) => ({ ...x, prazo: mascaraData(e.target.value) }))} style={{ ...inputSt, maxWidth: 160 }} /></>}
            <Label>Observação</Label><input value={f.observacao || ''} onChange={campo('observacao')} style={inputSt} />
          </>}

          {modal.tipo === 'arquivo' && <>
            <Label>Remessa</Label>
            <select value={f.remessaId || ''} onChange={campo('remessaId')} style={inputSt}>
              {d.remessas.map((r: any) => <option key={r.id} value={r.id}>{r.ordem}. {dataBr(r.dataProtocolo)} - {r.refCitius ? `ref. ${r.refCitius}` : 'ref. pendente'}</option>)}
            </select>
            <Label>Arquivo (PDF exatamente como protocolado)</Label>
            <input type="file" accept=".pdf,application/pdf" onChange={(e) => setArq(e.target.files?.[0] || null)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}><Label>Posição no Citius</Label><input value={f.posicaoCitius || ''} onChange={campo('posicaoCitius')} placeholder="Doc. 3" style={inputSt} /></div>
              <div style={{ flex: 1 }}><Label>SHA-256 esperado (início)</Label><input value={f.sha256Esperado || ''} onChange={campo('sha256Esperado')} placeholder="opcional" style={inputSt} /></div>
            </div>
            <Label>Nome no Drive (referência)</Label><input value={f.nomeOrigem || ''} onChange={campo('nomeOrigem')} style={inputSt} />
            {(modal.doc.arquivos || []).some((a: any) => !a.canceladoEm) && <>
              <Label>Substitui o arquivo</Label>
              <select value={f.substituiArquivoId || ''} onChange={campo('substituiArquivoId')} style={inputSt}>
                <option value="">(nenhum)</option>
                {modal.doc.arquivos.filter((a: any) => !a.canceladoEm).map((a: any) => <option key={a.id} value={a.id}>v{a.versao} - {a.arquivoNome}</option>)}
              </select>
            </>}
            <Label>Observação</Label><input value={f.observacao || ''} onChange={campo('observacao')} style={inputSt} />
          </>}

          {modal.tipo === 'encerrar' && <>
            <div style={{ fontSize: 13, color: '#374151' }}>{modal.arq.arquivoNome} <span style={{ ...mono, color: '#6B7280' }}>({modal.arq.sha256.slice(0, 12)}...)</span></div>
            <Label>Motivo (mínimo 10 caracteres)</Label>
            <textarea value={f.motivo || ''} onChange={campo('motivo')} rows={3} style={{ ...inputSt, resize: 'vertical' }} />
          </>}

          {modal.tipo === 'referencia' && <>
            <div style={{ fontSize: 12, color: '#374151' }}>{modal.remessa.descricao}</div>
            {!modal.remessa.refCitius && <><Label>Referência Citius</Label><input value={f.refCitius || ''} onChange={(e) => setF((x) => ({ ...x, refCitius: e.target.value.replace(/\D/g, '') }))} placeholder="ex.: 58007275" style={{ ...inputSt, maxWidth: 200 }} /></>}
            {!modal.remessa.comprovativoSha256 && <><Label>Comprovativo de entrega (PDF)</Label><input type="file" accept=".pdf,application/pdf" onChange={(e) => setArq(e.target.files?.[0] || null)} /></>}
            <div style={{ ...pequeno, marginTop: 8 }}>A referência e o comprovativo só podem ser informados uma vez.</div>
          </>}

          {modal.tipo === 'prazo' && <>
            <div style={{ fontSize: 12, color: '#374151' }}>{modal.prazo.descricao}</div>
            <Label>Situação</Label>
            <select value={f.situacao || ''} onChange={campo('situacao')} style={inputSt}>{Object.keys(SIT_PRAZO).map((k) => <option key={k} value={k}>{SIT_PRAZO[k].rot}</option>)}</select>
            {f.situacao === 'CUMPRIDO' && <>
              <Label>Cumprido na remessa</Label>
              <select value={f.remessaId || ''} onChange={campo('remessaId')} style={inputSt}>
                <option value="">(não informar)</option>
                {d.remessas.map((r: any) => <option key={r.id} value={r.id}>{r.ordem}. {dataBr(r.dataProtocolo)} - {r.refCitius ? `ref. ${r.refCitius}` : 'ref. pendente'}</option>)}
              </select>
            </>}
            <Label>Observação</Label><input value={f.observacao || ''} onChange={campo('observacao')} style={inputSt} />
          </>}
        </Modal>
      )}
    </div>
  );
}
