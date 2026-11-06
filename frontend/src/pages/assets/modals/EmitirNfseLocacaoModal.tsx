// frontend/src/pages/assets/modals/EmitirNfseLocacaoModal.tsx
// 06/11/2026 - Emissao da NFS-e de locacao (cTribNac 99.03.01 - Reforma Tributaria, NT 009) a partir do contrato.
// Rotina universal (qualquer empresa): regime lido do historico na data do pagamento e confirmado pelo usuario;
// certificado A1 (padrao - assinatura e envio pela API) ou A3 (LEDGR Agent, porta 7778).
// Nao interfere nas demais emissoes de NFS-e (Prefeitura SP, Simples, Pontes).
import { useEffect, useState } from 'react';
import api from '../../../services/api';
import { SmartDateInput } from '../../../components/SmartDateInput';

const FIN = '#1E293B';
const FIN_ACCENT = '#2563EB';
const AGENT = 'http://localhost:7778';
const inputSt = 'w-full text-[13px] border border-gray-200 rounded-lg px-3 py-2 bg-white';
const brl = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hoje = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const dataBR = (s: any) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '-');
const num = (s: any) => {
  const t = String(s ?? '').trim();
  if (!t) return 0;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return isNaN(n) ? 0 : n;
};
const TIPOS: Record<string, string> = {
  '01': 'IPTU / tributos inclusos no aluguel',
  '03': 'Condomínio incluso no aluguel',
  '02': 'Emolumentos inclusos',
  '99': 'Outras parcelas inclusas',
};
const REGIMES: Record<string, string> = {
  LUCRO_REAL: 'Lucro Real', LUCRO_PRESUMIDO: 'Lucro Presumido', SIMPLES_NACIONAL: 'Simples Nacional',
};

function Label({ children }: { children: any }) {
  return <label className="block text-[11px] font-medium text-gray-500 mb-1">{children}</label>;
}
function Secao({ titulo, children }: { titulo: string; children: any }) {
  return (
    <div className="pl-3 py-1 space-y-3" style={{ borderLeft: '3px solid ' + FIN_ACCENT }}>
      <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: FIN }}>{titulo}</p>
      {children}
    </div>
  );
}

type Deducao = { tipo: string; valor: string; descricao: string; fixedAssetId: string };
type Cert = { key: string; id: string; tipo: 'A1' | 'A3'; label: string };

export function EmitirNfseLocacaoModal({ contrato, onClose }: { contrato: any; onClose: () => void }) {
  const [dataPagamento, setDataPagamento] = useState(hoje());
  const [competencia, setCompetencia] = useState(hoje().slice(0, 7));
  const [vencimento, setVencimento] = useState('');
  const [valor, setValor] = useState(contrato?.rentAmount ? Number(contrato.rentAmount).toFixed(2).replace('.', ',') : '');
  const [descCond, setDescCond] = useState('');
  const [deducoes, setDeducoes] = useState<Deducao[]>([]);
  const [redutor, setRedutor] = useState(true);
  const [imoveis, setImoveis] = useState<any[]>([]);
  const [extras, setExtras] = useState<string[]>([]);
  const [regime, setRegime] = useState<any>(null);
  const [regimeTick, setRegimeTick] = useState(0);
  const [regimeOk, setRegimeOk] = useState(false);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [certKey, setCertKey] = useState('');
  const [agentOnline, setAgentOnline] = useState(false);
  const [iniciandoAgent, setIniciandoAgent] = useState(false);
  const iniciarAgent = () => { setErro(''); setIniciandoAgent(true); window.location.href = 'ledgr-agent://iniciar'; };

  // Opcao "A3 (token) - iniciar LEDGR Agent": abre o Agent (protocolo ledgr-agent://), aguarda subir e carrega os A3.
  useEffect(() => {
    if (!iniciandoAgent) return;
    let vivo = true; let tentativas = 0; let subiu = false;
    const id = setInterval(async () => {
      tentativas++;
      try {
        if (!subiu) { await fetch(AGENT + '/health', { signal: AbortSignal.timeout(1500) }); subiu = true; clearInterval(id); }
        let cnpj = '';
        try { const c: any = await api.get('/companies/me'); cnpj = String(c.data?.taxId || '').replace(/\D/g, ''); } catch (e) { /* sem CNPJ */ }
        const r = await fetch(AGENT + '/certificates');
        const l = await r.json();
        const novos: Cert[] = (Array.isArray(l) ? l : []).filter((c: any) => !cnpj || c.cnpj === cnpj)
          .map((c: any) => ({ key: 'a3:' + c.thumbprint, id: c.thumbprint, tipo: 'A3' as const,
            label: 'A3 (Agent) - ' + String(c.subject || '').split(',')[0].replace('CN=', '') + ' (até ' + dataBR(c.validTo) + ')' }));
        if (!vivo) return;
        setAgentOnline(true);
        setCerts(prev => [...prev.filter(x => x.tipo !== 'A3'), ...novos]);
        if (novos[0]) setCertKey(novos[0].key);
        else setErro('LEDGR Agent no ar, mas nenhum certificado A3 desta empresa foi encontrado. Conecte o token.');
        setIniciandoAgent(false);
      } catch (e) {
        if (!vivo) return;
        if (subiu) { setIniciandoAgent(false); setErro('LEDGR Agent no ar, mas a leitura dos certificados falhou. Conecte o token e tente de novo.'); }
        else if (tentativas >= 15) { clearInterval(id); setIniciandoAgent(false); setErro('O LEDGR Agent não respondeu. Inicie manualmente: scripts\\iniciar-agent.ps1'); }
      }
    }, 2000);
    return () => { vivo = false; clearInterval(id); };
  }, [iniciandoAgent]);
  const [prep, setPrep] = useState<any>(null);
  const [resultado, setResultado] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [verXml, setVerXml] = useState(false);
  const [busy, setBusy] = useState('');
  const [erro, setErro] = useState('');

  const msg = (e: any) => {
    const m = e?.response?.data?.message;
    return Array.isArray(m) ? m.join(' | ') : (m || e?.message || 'Erro inesperado');
  };
  const carregarHistorico = () =>
    api.get('/fiscal/nfse-nacional/locacao', { params: { contrato: contrato.id } })
      .then((r: any) => setHistorico(r.data || [])).catch(() => {});

  useEffect(() => {
    carregarHistorico();
    api.get('/assets').then((r: any) => {
      const l = Array.isArray(r.data) ? r.data : (r.data?.items ?? r.data?.data ?? []);
      setImoveis(l.filter((a: any) => a.group === 'REAL_ESTATE' && a.id !== contrato.fixedAssetId && !a.deletedAt));
    }).catch(() => {});
    (async () => {
      const lista: Cert[] = [];
      let cnpj = '';
      try { const c: any = await api.get('/companies/me'); cnpj = String(c.data?.taxId || '').replace(/\D/g, ''); } catch (e) { /* sem CNPJ */ }
      try {
        const r: any = await api.get('/certificates');
        (r.data || []).filter((c: any) => c.isActive && c.type === 'A1' && new Date(c.validTo) > new Date())
          .forEach((c: any) => lista.push({ key: 'a1:' + c.id, id: c.id, tipo: 'A1', label: 'A1 - ' + (c.alias || c.subject) + ' (até ' + dataBR(c.validTo) + ')' }));
      } catch (e) { /* sem A1 */ }
      try {
        await fetch(AGENT + '/health', { signal: AbortSignal.timeout(1500) });
        setAgentOnline(true);
        const r = await fetch(AGENT + '/certificates');
        const l = await r.json();
        (Array.isArray(l) ? l : []).filter((c: any) => !cnpj || c.cnpj === cnpj)
          .forEach((c: any) => lista.push({ key: 'a3:' + c.thumbprint, id: c.thumbprint, tipo: 'A3',
            label: 'A3 (Agent) - ' + String(c.subject || '').split(',')[0].replace('CN=', '') + ' (até ' + dataBR(c.validTo) + ')' }));
      } catch (e) { setAgentOnline(false); }
      setCerts(lista);
      setCertKey(lista[0]?.key ?? '');
    })();
  }, []);

  useEffect(() => {
    setRegime(null); setRegimeOk(false);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPagamento || '')) return;
    api.get('/fiscal/nfse-nacional/locacao/regime', { params: { data: dataPagamento } })
      .then((r: any) => setRegime(r.data))
      .catch((e: any) => setRegime({ erro: msg(e) }));
  }, [regimeTick, dataPagamento]);

  useEffect(() => { setPrep(null); }, [dataPagamento, competencia, vencimento, valor, descCond, deducoes, redutor, extras, regimeOk]);

  const unidadesNota = [{ id: contrato.fixedAssetId, internalCode: contrato.fixedAsset?.internalCode ?? 'Imóvel do contrato' },
    ...imoveis.filter(i => extras.includes(i.id))];
  const setDed = (i: number, k: keyof Deducao, v: string) => setDeducoes(l => l.map((d, j) => (j === i ? { ...d, [k]: v } : d)));

  const preparar = async () => {
    setErro(''); setResultado(null); setBusy('preparar');
    try {
      const r: any = await api.post('/fiscal/nfse-nacional/locacao/preparar', {
        rentalContractId: contrato.id,
        competencia,
        dataPagamento,
        valorRecebido: num(valor),
        vencimentoOriginal: vencimento || undefined,
        descontoCondicionado: num(descCond) || undefined,
        unidadesAdicionais: extras,
        usarRedutorSocial: redutor,
        regimeConfirmado: regimeOk ? regime?.forma : undefined,
        deducoes: deducoes.filter(d => num(d.valor) > 0).map(d => ({
          tipo: d.tipo, valor: num(d.valor), descricao: d.descricao || undefined, fixedAssetId: d.fixedAssetId || undefined,
        })),
        ambiente: 'HOMOLOGACAO',
      });
      setPrep(r.data);
    } catch (e) { setErro(msg(e)); } finally { setBusy(''); }
  };

  const enviar = async () => {
    if (!prep) return;
    const c = certs.find(x => x.key === certKey);
    if (!c) { setErro('Selecione o certificado.'); return; }
    setErro(''); setBusy('enviar');
    try {
      let r: any;
      if (c.tipo === 'A1') {
        r = await api.post('/fiscal/nfse-nacional/locacao/' + prep.id + '/enviar', { certId: c.id });
      } else {
        const ag = await fetch(AGENT + '/nfse-nacional/enviar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ thumbprint: c.id, xml: prep.xml, idDps: prep.idDps, url: prep.url }),
        });
        const j = await ag.json();
        if (!ag.ok) throw new Error(j?.error || 'Falha no LEDGR Agent');
        const xmlAssinado = j.xmlAssinadoB64
          ? new TextDecoder().decode(Uint8Array.from(atob(j.xmlAssinadoB64), ch => ch.charCodeAt(0)))
          : undefined;
        r = await api.post('/fiscal/nfse-nacional/locacao/' + prep.id + '/retorno',
          { httpStatus: j.httpStatus, resposta: j.resposta, xmlAssinado, thumbprint: c.id });
      }
      setResultado(r.data); setPrep(null); carregarHistorico();
    } catch (e) { setErro(msg(e)); } finally { setBusy(''); }
  };

  const res = prep?.resumo;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-xl">
        <div className="flex justify-between items-center px-5 py-4" style={{ background: FIN }}>
          <div>
            <h3 className="text-[16px] font-medium text-white">Emitir NFS-e de locação</h3>
            <p className="text-[12px] text-white/70 mt-0.5">
              {contrato.tenantName} · {contrato.fixedAsset?.internalCode ?? ''} · 99.03.01 · Homologação (produção restrita)
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-white text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <Secao titulo="Recebimento">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div><Label>Data do pagamento *</Label><SmartDateInput value={dataPagamento} onChange={(v: any) => setDataPagamento(v)} /></div>
              <div><Label>Competência do aluguel (AAAA-MM)</Label><input className={inputSt} value={competencia} onChange={e => setCompetencia(e.target.value)} /></div>
              <div><Label>Vencimento original</Label><SmartDateInput value={vencimento} onChange={(v: any) => setVencimento(v)} /></div>
              <div><Label>Valor recebido *</Label><input className={inputSt} value={valor} onChange={e => setValor(e.target.value)} /></div>
              <div><Label>Desconto condicionado</Label><input className={inputSt} value={descCond} onChange={e => setDescCond(e.target.value)} placeholder="0,00" /></div>
            </div>
          </Secao>

          {imoveis.length > 0 && (
            <Secao titulo="Unidades na mesma nota">
              <p className="text-[12px] text-gray-500">Imóvel do contrato: <b>{contrato.fixedAsset?.internalCode}</b>. Marque outras unidades locadas no mesmo contrato (mesmo município e mesmo uso).</p>
              <div className="flex flex-wrap gap-2">
                {imoveis.map(i => (
                  <label key={i.id} className="flex items-center gap-1.5 text-[12px] border border-gray-200 rounded-lg px-2 py-1">
                    <input type="checkbox" checked={extras.includes(i.id)}
                      onChange={() => setExtras(l => (l.includes(i.id) ? l.filter(x => x !== i.id) : [...l, i.id]))} />
                    {i.internalCode}
                  </label>
                ))}
              </div>
            </Secao>
          )}

          <Secao titulo="Deduções da base do IBS/CBS">
            {deducoes.length === 0 && <p className="text-[12px] text-gray-400">Sem deduções. Use quando IPTU ou condomínio estiverem incluídos no aluguel (ex.: Bertioga).</p>}
            {deducoes.map((d, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4"><Label>Tipo</Label>
                  <select className={inputSt} value={d.tipo} onChange={e => setDed(i, 'tipo', e.target.value)}>
                    {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{k} - {v}</option>)}
                  </select>
                </div>
                <div className="col-span-2"><Label>Valor</Label><input className={inputSt} value={d.valor} onChange={e => setDed(i, 'valor', e.target.value)} /></div>
                <div className="col-span-3"><Label>Unidade</Label>
                  <select className={inputSt} value={d.fixedAssetId} onChange={e => setDed(i, 'fixedAssetId', e.target.value)}>
                    {unidadesNota.map(u => <option key={u.id} value={u.id}>{u.internalCode}</option>)}
                  </select>
                </div>
                <div className="col-span-2"><Label>Descrição</Label><input className={inputSt} value={d.descricao} onChange={e => setDed(i, 'descricao', e.target.value)} placeholder={d.tipo === '99' ? 'obrigatória' : ''} /></div>
                <div className="col-span-1"><button type="button" onClick={() => setDeducoes(l => l.filter((_, j) => j !== i))} className="text-[12px] text-red-600 px-2 py-2">Remover</button></div>
              </div>
            ))}
            <button type="button" onClick={() => setDeducoes(l => [...l, { tipo: '03', valor: '', descricao: '', fixedAssetId: contrato.fixedAssetId }])}
              className="text-[12px] px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">+ Adicionar dedução</button>
            <label className="flex items-center gap-2 text-[12px] text-gray-700">
              <input type="checkbox" checked={redutor} onChange={e => setRedutor(e.target.checked)} />
              Aplicar redutor social (R$ 600 por imóvel - só locação residencial)
            </label>
          </Secao>

          <Secao titulo="Regime tributário na data do pagamento">
            {!regime && <p className="text-[12px] text-gray-400">Informe a data do pagamento.</p>}
            {regime?.erro && (
              <div className="rounded-lg px-3 py-2 text-[12px] text-red-700" style={{ background: '#FCEBEB' }}>
                <div>{regime.erro}</div>
                <div className="flex gap-4 mt-1.5">
                  <button type="button" className="underline font-medium" onClick={() => {
                    const w = window.open('', '_blank');
                    api.get('/companies/me')
                      .then(r => { const id = r.data?.id; if (w) w.location.href = id ? `/app/companies/show/${id}` : '/app/companies'; })
                      .catch(() => { if (w) w.location.href = '/app/companies'; });
                  }}>Corrigir regime tributário</button>
                  <button type="button" className="underline" onClick={() => setRegimeTick(t => t + 1)}>Consultar novamente</button>
                </div>
              </div>
            )}
            {regime && !regime.erro && (
              <div className="text-[12px] text-gray-700 space-y-2">
                <p>Regime vigente em {dataBR(dataPagamento)}: <b>{REGIMES[regime.forma] ?? regime.forma}</b> · PIS {Number(regime.pis).toFixed(2)}% · Cofins {Number(regime.cofins).toFixed(2)}% <span className="text-gray-400">({regime.fonte})</span></p>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={regimeOk} onChange={e => setRegimeOk(e.target.checked)} />
                  Confirmo o regime <b>{REGIMES[regime.forma] ?? regime.forma}</b> para esta operação
                </label>
              </div>
            )}
          </Secao>

          <Secao titulo="Certificado">
            {certs.length === 0 && agentOnline
              ? <p className="text-[12px] text-red-700">Nenhum certificado disponível. Carregue o A1 em Certificados ou conecte o token A3.</p>
              : (
                <select className={inputSt} value={certKey} disabled={iniciandoAgent}
                  onChange={e => { const v = e.target.value; if (v === 'a3:iniciar') iniciarAgent(); else setCertKey(v); }}>
                  {certs.length === 0 && <option value="">Selecione o certificado</option>}
                  {certs.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  {!agentOnline && <option value="a3:iniciar">A3 (token) - iniciar LEDGR Agent</option>}
                </select>
              )}
            <p className="text-[11px] text-gray-400">
              {iniciandoAgent
                ? 'Iniciando o LEDGR Agent... (se o navegador perguntar, permita abrir o LEDGR Agent)'
                : <>LEDGR Agent: {agentOnline ? 'online' : 'offline'} (necessário só para A3)
                  {!agentOnline && <> - <button type="button" className="underline font-medium text-blue-600" onClick={() => iniciarAgent()}>Iniciar Agent</button></>}</>}
            </p>
          </Secao>

          {res && (
            <Secao titulo={'DPS preparada - ' + res.idDps}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px]">
                <div><span className="text-gray-500">Valor do serviço</span><p className="font-medium">{brl(res.vServ)}</p></div>
                <div><span className="text-gray-500">Deduções (IBS/CBS)</span><p className="font-medium">{brl(res.totalAjustes)}</p></div>
                <div><span className="text-gray-500">PIS / Cofins</span><p className="font-medium">{brl(res.vPis)} / {brl(res.vCofins)}</p></div>
                <div><span className="text-gray-500">Base IBS/CBS</span><p className="font-medium">{brl(res.vBCIbsCbs)}</p></div>
                <div><span className="text-gray-500">CBS estimada</span><p className="font-medium">{brl(res.cbsEstimada)}</p></div>
                <div><span className="text-gray-500">IBS estimado</span><p className="font-medium">{brl(res.ibsEstimado)}</p></div>
                <div className="col-span-2"><span className="text-gray-500">Regime</span><p className="font-medium">{REGIMES[res.regime?.forma] ?? res.regime?.forma}</p></div>
              </div>
              <button type="button" onClick={() => setVerXml(v => !v)} className="text-[12px] underline" style={{ color: FIN_ACCENT }}>{verXml ? 'Ocultar XML' : 'Ver XML da DPS'}</button>
              {verXml && <pre className="text-[10px] bg-gray-50 border border-gray-200 rounded-lg p-2 max-h-60 overflow-auto whitespace-pre-wrap break-all">{prep.xml}</pre>}
            </Secao>
          )}

          {resultado && (
            <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: resultado.status === 'AUTORIZADA' ? '#ECFDF5' : '#FCEBEB' }}>
              <p className="font-semibold">{resultado.status === 'AUTORIZADA' ? 'NFS-e autorizada' : 'DPS rejeitada'}</p>
              {resultado.status === 'AUTORIZADA'
                ? <p>Número {resultado.numeroNfse ?? '-'} · Chave {resultado.chaveNfse}</p>
                : <p className="break-words">{resultado.motivoRejeicao}</p>}
            </div>
          )}

          {erro && <div className="rounded-lg px-3 py-2 text-[12px] text-red-700 break-words" style={{ background: '#FCEBEB' }}>{erro}</div>}

          {historico.length > 0 && (
            <Secao titulo="Notas de locação deste contrato">
              <table className="w-full text-[12px]">
                <thead><tr className="text-left text-gray-500"><th className="py-1">Pagamento</th><th>Situação</th><th>Ambiente</th><th className="text-right">Valor</th><th>Nº / motivo</th></tr></thead>
                <tbody>
                  {historico.map(h => (
                    <tr key={h.id} className="border-t border-gray-100 align-top">
                      <td className="py-1">{dataBR(h.dCompet)}</td>
                      <td>{h.status}</td>
                      <td>{h.ambiente === 'PRODUCAO' ? 'Produção' : 'Homologação'}</td>
                      <td className="text-right">{brl(h.vTotOper)}</td>
                      <td className="max-w-[280px] break-words">{h.numeroNfse || h.motivoRejeicao || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Secao>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200" style={{ background: '#FAFAFA' }}>
          <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] border border-gray-200 rounded-lg bg-white">Fechar</button>
          <button type="button" onClick={preparar} disabled={!regimeOk || !!busy}
            className="px-4 py-2 text-[13px] rounded-lg text-white disabled:opacity-50" style={{ background: FIN }}>
            {busy === 'preparar' ? 'Preparando...' : 'Preparar DPS'}
          </button>
          <button type="button" onClick={enviar} disabled={!prep || !certKey || !!busy}
            className="px-4 py-2 text-[13px] rounded-lg text-white disabled:opacity-50" style={{ background: FIN_ACCENT }}>
            {busy === 'enviar' ? 'Enviando...' : 'Enviar (homologação)'}
          </button>
        </div>
      </div>
    </div>
  );
}
