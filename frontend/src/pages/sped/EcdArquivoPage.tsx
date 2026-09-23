// frontend/src/pages/sped/EcdArquivoPage.tsx
// ============================================================================
// ECD - RAZAO (CONSULTA) - CRIADO 21/09/2026 (v2: varias contas / intervalo /
// razao geral + impressao)
// Tela SOMENTE DE CONSULTA sobre o arquivo fiel das ECDs (tabelas ecd_arq*),
// independente do Contabil. A unica acao que grava e "Carregar arquivos", que
// envia o .txt SPED para /sped/ecd-arquivo/carregar (grava so em ecd_arq*).
// ============================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiUpload, FiSearch, FiLoader, FiAlertCircle, FiCheckCircle, FiDownload, FiLock, FiX, FiPrinter } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { useCompany } from '../../contexts/CompanyContext';
import { SmartDateInput } from '../../components/SmartDateInput';

interface ArquivoEcd {
  id: string;
  fileName: string;
  dtIni: string;
  dtFin: string;
  codVerLc: string | null;
  indFinEsc: string | null;
  nomeEmpresarial: string | null;
  cnpj: string | null;
  loadedAt: string;
  stats: any;
}
interface ContaEcd {
  codCta: string;
  codCtaSup: string | null;
  nome: string;
  codNat: string | null;
  indCta: string | null;
  nivel: number | null;
  codCtaRef: string | null;
}
interface Saldo {
  valor: number;
  dc: 'D' | 'C';
}
interface LinhaRazao {
  data: string;
  numLcto: string;
  indLcto: string | null;
  historico: string;
  codHistPad: string | null;
  contrapartida: string;
  debito: number;
  credito: number;
  saldo: number;
  saldoDc: 'D' | 'C';
}
interface RazaoResp {
  arquivo: { id: string; fileName: string; dtIni: string; dtFin: string; codVerLc: string | null };
  conta: { codCta: string; nome: string; indCta: string | null; nivel: number | null; codNat: string | null; codCtaRef: string | null };
  periodo: { dtIni: string; dtFin: string };
  saldoInicial: Saldo;
  linhas: LinhaRazao[];
  totais: { debitos: number; creditos: number; lancamentos: number };
  saldoFinal: Saldo;
  conferencia: null | { esperado: number; esperadoDc: string; calculado: number; calculadoDc: string; criterio: string; ok: boolean };
}
interface Resumo {
  contas: number;
  partidas: number;
  debitos: number;
  creditos: number;
  divergentes: number;
}
interface ItemFila {
  nome: string;
  status: 'aguardando' | 'enviando' | 'ok' | 'erro';
  msg: string;
}

const nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (v: number): string => nf.format(v);
const fmtSaldo = (s: Saldo): string => fmt(s.valor) + ' ' + s.dc;
const dataBr = (iso: string): string => {
  const p = (iso || '').substring(0, 10).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
};
const msgErro = (e: any): string => {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join(' ') : m || e?.message || 'Erro inesperado';
};
const limpa = (s: string): string => (s || '').replace(/[|\r\n]+/g, ' ');
const virgula = (n: number): string => n.toFixed(2).replace('.', ',');
const esc = (s: string): string => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const thBase = 'px-3 py-2 text-[12px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 whitespace-nowrap';
const td = 'px-3 py-2 text-[13px]';

// Um bloco = razao de UMA conta (cabecalho, cartoes, conferencia e tabela)
function BlocoConta({ r, rolagem }: { r: RazaoResp; rolagem: boolean }) {
  const conf = r.conferencia;
  return (
    <div className="border-b border-gray-100">
      <div className="px-4 py-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-mono text-[15px] font-semibold text-gray-800">{r.conta.codCta}</span>
          <span className="text-[15px] text-gray-800">{r.conta.nome}</span>
          {r.conta.codCtaRef && (
            <span className="text-[12px] text-gray-400" title="Conta referencial (I051)">ref. {r.conta.codCtaRef}</span>
          )}
        </div>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="rounded-lg bg-gray-50 px-3 py-2"><div className="text-[11px] uppercase text-gray-400">Saldo inicial</div><div className="font-mono text-[14px] font-semibold text-gray-800">{fmtSaldo(r.saldoInicial)}</div></div>
          <div className="rounded-lg bg-gray-50 px-3 py-2"><div className="text-[11px] uppercase text-gray-400">D&eacute;bitos</div><div className="font-mono text-[14px] font-semibold text-gray-800">{fmt(r.totais.debitos)}</div></div>
          <div className="rounded-lg bg-gray-50 px-3 py-2"><div className="text-[11px] uppercase text-gray-400">Cr&eacute;ditos</div><div className="font-mono text-[14px] font-semibold text-gray-800">{fmt(r.totais.creditos)}</div></div>
          <div className="rounded-lg bg-blue-50 px-3 py-2"><div className="text-[11px] uppercase text-blue-400">Saldo final</div><div className="font-mono text-[14px] font-semibold text-blue-800">{fmtSaldo(r.saldoFinal)}</div></div>
        </div>
        <div className="mt-2">
          {conf ? (
            conf.ok ? (
              <span className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                <FiCheckCircle size={12} /> Confere com o I155 ({conf.criterio === 'com_encerramento' ? 'incluindo o encerramento' : 'antes do encerramento'})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                <FiAlertCircle size={12} /> Diverge do I155: esperado {fmt(conf.esperado)} {conf.esperadoDc} &middot; calculado {fmt(conf.calculado)} {conf.calculadoDc}
              </span>
            )
          ) : (
            <span className="text-[12px] text-gray-400">Sem I155 para conferir o fim deste per&iacute;odo (a confer&ecirc;ncia s&oacute; ocorre quando a data final &eacute; o fim de um m&ecirc;s).</span>
          )}
        </div>
      </div>

      <div className={rolagem ? 'overflow-auto' : ''} style={rolagem ? { maxHeight: 'calc(100vh - 470px)' } : undefined}>
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            <col style={{ width: '96px' }} />
            <col style={{ width: '84px' }} />
            <col />
            <col style={{ width: '150px' }} />
            <col style={{ width: '115px' }} />
            <col style={{ width: '115px' }} />
            <col style={{ width: '145px' }} />
          </colgroup>
          <thead className={'bg-gray-50 ' + (rolagem ? 'sticky top-0 z-10' : '')}>
            <tr>
              <th className={thBase + ' text-left'}>Data</th>
              <th className={thBase + ' text-left'}>N&ordm; Lan&ccedil;</th>
              <th className={thBase + ' text-left'}>Hist&oacute;rico</th>
              <th className={thBase + ' text-left'}>Contrapartida</th>
              <th className={thBase + ' text-right'}>D&eacute;bito</th>
              <th className={thBase + ' text-right'}>Cr&eacute;dito</th>
              <th className={thBase + ' text-right'}>Saldo</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-gray-50">
              <td colSpan={6} className={td + ' font-semibold text-gray-600'}>Saldo inicial</td>
              <td className={td + ' text-right font-mono font-semibold'}>{fmtSaldo(r.saldoInicial)}</td>
            </tr>
            {r.linhas.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-gray-400 text-sm">Nenhum lan&ccedil;amento da conta neste per&iacute;odo.</td></tr>
            )}
            {r.linhas.map((l, i) => (
              <tr key={i} className={'border-b border-gray-50 hover:bg-blue-50/40 ' + (l.indLcto === 'E' ? 'bg-amber-50/60' : '')}>
                <td className={td + ' whitespace-nowrap text-gray-700'}>{dataBr(l.data)}</td>
                <td className={td + ' whitespace-nowrap font-mono text-gray-500'}>
                  {l.numLcto}
                  {l.indLcto === 'E' && (
                    <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700" title="Lan&ccedil;amento de encerramento">ENC</span>
                  )}
                </td>
                <td className={td + ' text-gray-700'} title={l.historico}>{l.historico}</td>
                <td className={td + ' font-mono text-gray-400 whitespace-nowrap'}>{l.contrapartida}</td>
                <td className={td + ' text-right font-mono'}>{l.debito ? fmt(l.debito) : ''}</td>
                <td className={td + ' text-right font-mono'}>{l.credito ? fmt(l.credito) : ''}</td>
                <td className={td + ' text-right font-mono whitespace-nowrap'}>{fmt(l.saldo)} {l.saldoDc}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className={'bg-gray-50 ' + (rolagem ? 'sticky bottom-0' : '')}>
            <tr>
              <td colSpan={4} className={td + ' font-semibold text-gray-600'}>Totais do per&iacute;odo ({r.totais.lancamentos} partidas)</td>
              <td className={td + ' text-right font-mono font-semibold'}>{fmt(r.totais.debitos)}</td>
              <td className={td + ' text-right font-mono font-semibold'}>{fmt(r.totais.creditos)}</td>
              <td className={td + ' text-right font-mono font-semibold whitespace-nowrap'}>{fmtSaldo(r.saldoFinal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function EcdArquivoPage() {
  const { activeCompany } = useCompany();
  const [arquivos, setArquivos] = useState<ArquivoEcd[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selId, setSelId] = useState('');
  const [contas, setContas] = useState<ContaEcd[]>([]);
  const [loadingContas, setLoadingContas] = useState(false);
  const [busca, setBusca] = useState('');
  const [soAnaliticas, setSoAnaliticas] = useState(true);
  const [multi, setMulti] = useState(false);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [soComMov, setSoComMov] = useState(true);
  const [contaSel, setContaSel] = useState('');
  const [dtIni, setDtIni] = useState('');
  const [dtFin, setDtFin] = useState('');
  const [blocos, setBlocos] = useState<RazaoResp[] | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loadingRazao, setLoadingRazao] = useState(false);
  const [erro, setErro] = useState('');
  const [fila, setFila] = useState<ItemFila[]>([]);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const limparResultado = () => {
    setBlocos(null);
    setResumo(null);
    setErro('');
  };

  const carregarLista = useCallback(async () => {
    if (!activeCompany) {
      setArquivos([]);
      return;
    }
    setLoadingList(true);
    try {
      const r = await api.get('/sped/ecd-arquivo/arquivos');
      setArquivos(r.data ?? []);
    } catch (e: any) {
      toast.error(msgErro(e));
    } finally {
      setLoadingList(false);
    }
  }, [activeCompany]);

  useEffect(() => {
    setSelId('');
    setContas([]);
    setBlocos(null);
    setResumo(null);
    setContaSel('');
    setMarcadas([]);
    setDe('');
    setAte('');
    setErro('');
    carregarLista();
  }, [activeCompany?.id, carregarLista]);

  const arqSel = useMemo(() => arquivos.find((a) => a.id === selId) ?? null, [arquivos, selId]);

  useEffect(() => {
    setContas([]);
    setBlocos(null);
    setResumo(null);
    setContaSel('');
    setMarcadas([]);
    setDe('');
    setAte('');
    setErro('');
    setBusca('');
    if (!selId) return;
    const a = arquivos.find((x) => x.id === selId);
    if (a) {
      setDtIni(a.dtIni.substring(0, 10));
      setDtFin(a.dtFin.substring(0, 10));
    }
    setLoadingContas(true);
    api
      .get('/sped/ecd-arquivo/' + selId + '/contas', { params: { bloco: 'I' } })
      .then((r) => setContas(r.data ?? []))
      .catch((e) => toast.error(msgErro(e)))
      .finally(() => setLoadingContas(false));
  }, [selId]);

  // Uma conta
  const consultar = useCallback(
    async (cod: string, ini: string, fin: string) => {
      if (!selId || !cod) return;
      setLoadingRazao(true);
      setErro('');
      setResumo(null);
      try {
        const r = await api.get('/sped/ecd-arquivo/' + selId + '/razao', {
          params: { conta: cod, dtIni: ini || undefined, dtFin: fin || undefined },
        });
        setBlocos([r.data]);
      } catch (e: any) {
        setBlocos(null);
        setErro(msgErro(e));
      } finally {
        setLoadingRazao(false);
      }
    },
    [selId],
  );

  // Varias contas / intervalo / geral
  const consultarVarias = useCallback(async () => {
    if (!selId) return;
    setLoadingRazao(true);
    setErro('');
    try {
      const params: any = { dtIni: dtIni || undefined, dtFin: dtFin || undefined, soComMovimento: soComMov ? '1' : '0' };
      if (marcadas.length > 0) {
        params.contas = marcadas.join(',');
      } else {
        if (de.trim()) params.de = de.trim();
        if (ate.trim()) params.ate = ate.trim();
      }
      const r = await api.get('/sped/ecd-arquivo/' + selId + '/razao-geral', { params });
      setBlocos(r.data?.blocos ?? []);
      setResumo(r.data?.resumo ?? null);
    } catch (e: any) {
      setBlocos(null);
      setResumo(null);
      setErro(msgErro(e));
    } finally {
      setLoadingRazao(false);
    }
  }, [selId, dtIni, dtFin, soComMov, marcadas, de, ate]);

  const escolherConta = (cod: string) => {
    setContaSel(cod);
    consultar(cod, dtIni, dtFin);
  };

  const contasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return contas.filter(
      (c) =>
        (!soAnaliticas || c.indCta === 'A') &&
        (!q || c.codCta.toLowerCase().includes(q) || c.nome.toLowerCase().includes(q)),
    );
  }, [contas, busca, soAnaliticas]);

  const contasAnaliticas = useMemo(() => contas.filter((c) => c.indCta === 'A'), [contas]);
  const marcadasSet = useMemo(() => new Set(marcadas), [marcadas]);

  const alternarConta = (cod: string) => {
    setMarcadas((prev) => (prev.includes(cod) ? prev.filter((x) => x !== cod) : prev.concat([cod])));
  };
  const marcarVisiveis = () => {
    setMarcadas((prev) => Array.from(new Set(prev.concat(contasFiltradas.map((c) => c.codCta)))));
  };

  const dica =
    marcadas.length > 0
      ? marcadas.length + ' conta(s) marcada(s) na lista'
      : de.trim() || ate.trim()
        ? 'Intervalo: ' + (de.trim() || 'in\u00edcio') + ' a ' + (ate.trim() || 'fim')
        : 'Todas as contas anal\u00edticas (raz\u00e3o geral)';

  const enviar = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const lista = Array.from(files).sort((a, b) => a.name.localeCompare(b.name));
    setFila(lista.map((f) => ({ nome: f.name, status: 'aguardando', msg: '' })));
    setEnviando(true);
    for (let i = 0; i < lista.length; i++) {
      setFila((q) => q.map((x, j) => (j === i ? { ...x, status: 'enviando' } : x)));
      try {
        const fd = new FormData();
        fd.append('file', lista[i]);
        const r = await api.post('/sped/ecd-arquivo/carregar', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 15 * 60 * 1000,
        });
        const d = r.data;
        const msg =
          d.lancamentos + ' lan\u00e7amentos \u00b7 ' + d.partidas + ' partidas \u00b7 ' + d.contasI + ' contas' +
          (d.substituiu ? ' \u00b7 substituiu a carga anterior do per\u00edodo' : '');
        setFila((q) => q.map((x, j) => (j === i ? { ...x, status: 'ok', msg } : x)));
      } catch (e: any) {
        const msg = msgErro(e);
        setFila((q) => q.map((x, j) => (j === i ? { ...x, status: 'erro', msg } : x)));
      }
    }
    setEnviando(false);
    if (inputRef.current) inputRef.current.value = '';
    await carregarLista();
  };

  const exportarCsv = () => {
    if (!blocos || blocos.length === 0) return;
    const sep = '|';
    const out: string[] = [];
    out.push(['Conta', 'Nome da conta', 'Data', 'Nr Lanc', 'Tipo', 'Historico', 'Contrapartida', 'Debito', 'Credito', 'Saldo', 'D/C'].join(sep));
    for (const r of blocos) {
      const cab = [r.conta.codCta, limpa(r.conta.nome)];
      out.push(cab.concat(['', '', '', 'SALDO INICIAL', '', '', '', virgula(r.saldoInicial.valor), r.saldoInicial.dc]).join(sep));
      for (const l of r.linhas) {
        out.push(
          cab.concat([dataBr(l.data), l.numLcto, l.indLcto ?? '', limpa(l.historico), l.contrapartida, virgula(l.debito), virgula(l.credito), virgula(l.saldo), l.saldoDc]).join(sep),
        );
      }
      out.push(cab.concat(['', '', '', 'TOTAIS', '', virgula(r.totais.debitos), virgula(r.totais.creditos), '', '']).join(sep));
      out.push(cab.concat(['', '', '', 'SALDO FINAL', '', '', '', virgula(r.saldoFinal.valor), r.saldoFinal.dc]).join(sep));
    }
    const p0 = blocos[0].periodo;
    const nome = blocos.length === 1
      ? 'razao-ecd-' + blocos[0].conta.codCta + '-' + p0.dtIni + '_' + p0.dtFin + '.csv'
      : 'razao-ecd-' + p0.dtIni.substring(0, 4) + '-' + blocos.length + 'contas-' + p0.dtIni + '_' + p0.dtFin + '.csv';
    const blob = new Blob(['\uFEFF' + out.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Impressao: abre uma janela propria (A4 paisagem) e chama o print do navegador
  const imprimir = () => {
    if (!blocos || blocos.length === 0 || !arqSel) return;
    const css =
      '@page{size:A4 landscape;margin:10mm}' +
      'body{font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#111}' +
      'h1{font-size:15px;margin:0 0 2px}.sub{color:#555;margin-bottom:8px}' +
      'h2{font-size:12px;margin:14px 0 4px;page-break-after:avoid;border-bottom:1px solid #999;padding-bottom:2px}' +
      'table{width:100%;border-collapse:collapse;margin-bottom:6px}' +
      'th{background:#eee;text-align:left;padding:3px 4px;border-bottom:1px solid #999;font-size:9px;text-transform:uppercase}' +
      'td{padding:2px 4px;border-bottom:1px solid #ddd;vertical-align:top}' +
      '.r{text-align:right;white-space:nowrap;font-family:Consolas,monospace}' +
      'thead{display:table-header-group}tr{page-break-inside:avoid}' +
      '.tot td{font-weight:bold;background:#f6f6f6}.ok{color:#166534}.bad{color:#991b1b;font-weight:bold}';
    const p0 = blocos[0].periodo;
    let html =
      '<h1>Raz&atilde;o ECD &mdash; ' + esc(arqSel.nomeEmpresarial || '') + '</h1>' +
      '<div class="sub">Per&iacute;odo: ' + dataBr(p0.dtIni) + ' a ' + dataBr(p0.dtFin) +
      ' &middot; Arquivo: ' + esc(arqSel.fileName) + ' &middot; Leiaute ' + esc(arqSel.codVerLc || '-') +
      (resumo ? ' &middot; ' + resumo.contas + ' conta(s), ' + resumo.partidas + ' partida(s)' : '') + '</div>';
    for (const r of blocos) {
      const c = r.conferencia;
      html += '<h2>' + esc(r.conta.codCta) + ' &mdash; ' + esc(r.conta.nome) + '</h2>';
      html += '<table><thead><tr><th>Data</th><th>N&ordm; Lan&ccedil;</th><th>Hist&oacute;rico</th><th>Contrapartida</th><th class="r">D&eacute;bito</th><th class="r">Cr&eacute;dito</th><th class="r">Saldo</th></tr></thead><tbody>';
      html += '<tr class="tot"><td colspan="6">Saldo inicial</td><td class="r">' + fmtSaldo(r.saldoInicial) + '</td></tr>';
      for (const l of r.linhas) {
        html +=
          '<tr><td>' + dataBr(l.data) + '</td><td>' + esc(l.numLcto) + (l.indLcto === 'E' ? ' (ENC)' : '') + '</td><td>' + esc(l.historico) +
          '</td><td>' + esc(l.contrapartida) + '</td><td class="r">' + (l.debito ? fmt(l.debito) : '') +
          '</td><td class="r">' + (l.credito ? fmt(l.credito) : '') + '</td><td class="r">' + fmt(l.saldo) + ' ' + l.saldoDc + '</td></tr>';
      }
      html += '<tr class="tot"><td colspan="4">Totais do per&iacute;odo</td><td class="r">' + fmt(r.totais.debitos) + '</td><td class="r">' + fmt(r.totais.creditos) + '</td><td class="r">' + fmtSaldo(r.saldoFinal) + '</td></tr></tbody></table>';
      if (c) {
        html += '<div class="' + (c.ok ? 'ok' : 'bad') + '">' +
          (c.ok ? 'Confere com o I155' : 'Diverge do I155: esperado ' + fmt(c.esperado) + ' ' + c.esperadoDc + ' / calculado ' + fmt(c.calculado) + ' ' + c.calculadoDc) + '</div>';
      }
    }
    html += '<div class="sub" style="margin-top:10px">Consulta ao arquivo fiel da ECD (independente do Cont&aacute;bil) &middot; gerado em ' + new Date().toLocaleString('pt-BR') + '</div>';
    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) {
      toast.error('Permita pop-ups para este site para imprimir.');
      return;
    }
    w.document.open();
    w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Razao ECD</title><style>' + css + '</style></head><body>' + html + '</body></html>');
    w.document.close();
    setTimeout(() => {
      w.focus();
      w.print();
    }, 400);
  };

  if (!activeCompany) {
    return <div className="p-8 text-center text-gray-400 text-sm">Selecione uma empresa para consultar as ECDs.</div>;
  }

  const temResultado = !!blocos && blocos.length > 0;

  return (
    <div className="p-4 space-y-4">
      {/* Cabecalho */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">ECD &mdash; Raz&atilde;o (consulta)</h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              <FiLock size={11} /> SOMENTE CONSULTA
            </span>
          </div>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Dados lidos direto dos arquivos SPED ECD e guardados &agrave; parte, independentes do Cont&aacute;bil. Nada aqui altera ou usa a contabilidade.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".txt"
            multiple
            className="hidden"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => enviar(e.target.files)}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            {enviando ? <FiLoader className="animate-spin" size={14} /> : <FiUpload size={14} />} Carregar arquivos .txt
          </button>
        </div>
      </div>

      {/* Fila de carga */}
      {fila.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 space-y-1">
          <div className="text-[12px] font-bold uppercase tracking-wider text-gray-400 mb-1">Carga dos arquivos</div>
          {fila.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-[13px]">
              {f.status === 'enviando' && <FiLoader className="animate-spin text-blue-600" size={13} />}
              {f.status === 'ok' && <FiCheckCircle className="text-green-600" size={13} />}
              {f.status === 'erro' && <FiX className="text-red-600" size={13} />}
              {f.status === 'aguardando' && <span className="w-[13px] text-gray-300">&bull;</span>}
              <span className="font-mono text-gray-600">{f.nome}</span>
              <span className={f.status === 'erro' ? 'text-red-600' : 'text-gray-400'}>
                {f.status === 'aguardando' ? 'aguardando' : f.status === 'enviando' ? 'lendo e gravando...' : f.msg}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Arquivos carregados */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-gray-700">Arquivos ECD carregados <span className="text-gray-400 font-normal">&mdash; clique num ano para consultar</span></span>
          {loadingList && <FiLoader className="animate-spin text-gray-400" size={14} />}
        </div>
        {arquivos.length === 0 && !loadingList ? (
          <div className="py-10 text-center text-gray-400 text-sm">
            Nenhum arquivo carregado. Use &quot;Carregar arquivos .txt&quot; e selecione as ECDs (pode escolher v&aacute;rios de uma vez).
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className={thBase + ' text-left'}>Per&iacute;odo</th>
                  <th className={thBase + ' text-left'}>Arquivo</th>
                  <th className={thBase + ' text-left'}>Leiaute</th>
                  <th className={thBase + ' text-right'}>Lan&ccedil;amentos</th>
                  <th className={thBase + ' text-right'}>Partidas</th>
                  <th className={thBase + ' text-right'}>Contas</th>
                  <th className={thBase + ' text-right'}>Saldos</th>
                  <th className={thBase + ' text-left'}>Carregado em</th>
                </tr>
              </thead>
              <tbody>
                {arquivos.map((a) => {
                  const st = a.stats ?? {};
                  const ativo = a.id === selId;
                  return (
                    <tr
                      key={a.id}
                      onClick={() => setSelId(a.id)}
                      className={'border-b border-gray-50 cursor-pointer ' + (ativo ? 'bg-blue-50' : 'hover:bg-gray-50')}
                    >
                      <td className={td + ' font-medium text-gray-800 whitespace-nowrap'}>
                        {dataBr(a.dtIni)} &rarr; {dataBr(a.dtFin)}
                        {a.indFinEsc === '1' && (
                          <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700" title="ECD substituta">
                            SUBST.
                          </span>
                        )}
                      </td>
                      <td className={td + ' text-gray-500 max-w-[300px] truncate'} title={a.fileName}>{a.fileName}</td>
                      <td className={td + ' font-mono'}>{a.codVerLc ?? '-'}</td>
                      <td className={td + ' text-right font-mono'}>{st.lancamentos ?? '-'}</td>
                      <td className={td + ' text-right font-mono'}>{st.partidas ?? '-'}</td>
                      <td className={td + ' text-right font-mono'}>{st.contasI ?? '-'}</td>
                      <td className={td + ' text-right font-mono'}>{st.saldosI ?? '-'}</td>
                      <td className={td + ' text-gray-400'}>{new Date(a.loadedAt).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Consulta */}
      {arqSel && (
        <div className="grid grid-cols-12 gap-4">
          {/* Plano de contas do arquivo */}
          <div className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] font-semibold text-gray-700">
                  Plano de {dataBr(arqSel.dtIni).substring(6)} <span className="text-gray-400 font-normal">({contasFiltradas.length} de {contas.length})</span>
                </div>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[12px]">
                  <button
                    onClick={() => { setMulti(false); limparResultado(); }}
                    className={'px-2 py-1 ' + (!multi ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}
                  >
                    Uma conta
                  </button>
                  <button
                    onClick={() => { setMulti(true); limparResultado(); }}
                    className={'px-2 py-1 ' + (multi ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}
                  >
                    V&aacute;rias contas
                  </button>
                </div>
              </div>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar c&oacute;digo ou nome..."
                  className="h-7 w-full border border-gray-200 rounded-lg pl-8 pr-3 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="flex items-center gap-1.5 text-[12px] text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={soAnaliticas} onChange={(e) => setSoAnaliticas(e.target.checked)} />
                  Somente anal&iacute;ticas
                </label>
                {multi && (
                  <div className="flex items-center gap-2 text-[12px]">
                    <button onClick={marcarVisiveis} className="text-blue-700 hover:underline">Marcar vis&iacute;veis</button>
                    <button onClick={() => setMarcadas([])} disabled={marcadas.length === 0} className="text-gray-500 hover:underline disabled:opacity-40">
                      Limpar ({marcadas.length})
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
              {loadingContas ? (
                <div className="py-10 text-center text-gray-400"><FiLoader className="animate-spin mx-auto" size={18} /></div>
              ) : (
                contasFiltradas.map((c) => {
                  const pad = 12 + ((c.nivel ?? 1) - 1) * 10;
                  if (multi) {
                    const marc = marcadasSet.has(c.codCta);
                    return (
                      <label
                        key={c.codCta}
                        style={{ paddingLeft: pad }}
                        className={'w-full pr-3 py-1.5 border-b border-gray-50 text-[13px] flex items-center gap-2 cursor-pointer ' + (marc ? 'bg-blue-50' : 'hover:bg-gray-50')}
                      >
                        <input type="checkbox" checked={marc} onChange={() => alternarConta(c.codCta)} />
                        <span className="font-mono text-gray-500 shrink-0">{c.codCta}</span>
                        <span className={c.indCta === 'S' ? 'font-semibold text-gray-700' : 'text-gray-700'}>{c.nome}</span>
                        {c.indCta === 'S' && (
                          <span className="ml-auto text-[10px] font-bold px-1.5 rounded bg-gray-100 text-gray-500" title="Inclui todas as contas anal&iacute;ticas abaixo">GRUPO</span>
                        )}
                      </label>
                    );
                  }
                  return (
                    <button
                      key={c.codCta}
                      onClick={() => escolherConta(c.codCta)}
                      style={{ paddingLeft: pad }}
                      className={'w-full text-left pr-3 py-1.5 border-b border-gray-50 text-[13px] flex gap-2 ' + (c.codCta === contaSel ? 'bg-blue-50' : 'hover:bg-gray-50')}
                    >
                      <span className="font-mono text-gray-500 shrink-0">{c.codCta}</span>
                      <span className={c.indCta === 'S' ? 'font-semibold text-gray-700' : 'text-gray-700'}>{c.nome}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Razao */}
          <div className="col-span-12 lg:col-span-8 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 border rounded-lg px-3 py-1 bg-white border-gray-200">
                <SmartDateInput
                  value={dtIni}
                  onChange={(v) => setDtIni(v)}
                  className="h-6 border-none bg-transparent text-sm font-medium text-gray-700 outline-none w-24"
                />
                <span className="text-[13px] text-gray-400">at&eacute;</span>
                <SmartDateInput
                  value={dtFin}
                  onChange={(v) => setDtFin(v)}
                  className="h-6 border-none bg-transparent text-sm font-medium text-gray-700 outline-none w-24"
                />
              </div>
              <button
                onClick={() => (multi ? consultarVarias() : consultar(contaSel, dtIni, dtFin))}
                disabled={(!multi && !contaSel) || loadingRazao}
                className="px-3 py-1.5 text-[13px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40"
              >
                {multi ? 'Gerar raz\u00e3o' : 'Consultar'}
              </button>
              <button
                onClick={exportarCsv}
                disabled={!temResultado}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                <FiDownload size={13} /> CSV
              </button>
              <button
                onClick={imprimir}
                disabled={!temResultado}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                <FiPrinter size={13} /> Imprimir
              </button>
            </div>

            {multi && (
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-3 flex-wrap text-[13px]">
                <span className="text-gray-500">Intervalo de contas:</span>
                <input
                  list="dl-contas"
                  value={de}
                  onChange={(e) => setDe(e.target.value)}
                  placeholder="de (c&oacute;digo)"
                  className="h-7 w-40 border border-gray-200 rounded-lg px-2 font-mono text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-400">at&eacute;</span>
                <input
                  list="dl-contas"
                  value={ate}
                  onChange={(e) => setAte(e.target.value)}
                  placeholder="at&eacute; (c&oacute;digo)"
                  className="h-7 w-40 border border-gray-200 rounded-lg px-2 font-mono text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <datalist id="dl-contas">
                  {contasAnaliticas.map((c) => (
                    <option key={c.codCta} value={c.codCta} label={c.nome} />
                  ))}
                </datalist>
                {(de || ate) && (
                  <button onClick={() => { setDe(''); setAte(''); }} className="text-gray-400 hover:text-red-500" title="Limpar intervalo">
                    <FiX size={14} />
                  </button>
                )}
                <label className="flex items-center gap-1.5 text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={soComMov} onChange={(e) => setSoComMov(e.target.checked)} />
                  Ocultar contas sem movimento
                </label>
                <span className="text-[12px] text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">{dica}</span>
              </div>
            )}

            {!multi && !contaSel && !blocos && (
              <div className="py-16 text-center text-gray-400 text-sm">Escolha uma conta do plano ao lado para ver o raz&atilde;o.</div>
            )}
            {multi && !blocos && !loadingRazao && !erro && (
              <div className="py-16 text-center text-gray-400 text-sm">
                Marque contas na lista, informe um intervalo ou deixe tudo vazio para o raz&atilde;o geral, e clique em &quot;Gerar raz&atilde;o&quot;.
              </div>
            )}
            {loadingRazao && (
              <div className="py-16 text-center text-gray-400"><FiLoader className="animate-spin mx-auto mb-2" size={20} /><span className="text-sm">Consultando...</span></div>
            )}
            {erro && !loadingRazao && (
              <div className="m-4 p-3 rounded-lg text-[13px] flex items-center gap-2" style={{ background: '#FCEBEB', color: '#A32D2D' }}>
                <FiAlertCircle size={14} /> {erro}
              </div>
            )}

            {blocos && !loadingRazao && blocos.length === 0 && (
              <div className="py-16 text-center text-gray-400 text-sm">Nenhuma conta com movimento no per&iacute;odo.</div>
            )}

            {temResultado && !loadingRazao && blocos && (
              <div>
                {resumo && (
                  <div className="px-4 py-2 border-b border-gray-100 bg-blue-50/50 flex items-center gap-4 flex-wrap text-[13px]">
                    <span><b>{resumo.contas}</b> conta(s)</span>
                    <span><b>{resumo.partidas}</b> partida(s)</span>
                    <span>D&eacute;bitos <b className="font-mono">{fmt(resumo.debitos)}</b></span>
                    <span>Cr&eacute;ditos <b className="font-mono">{fmt(resumo.creditos)}</b></span>
                    {resumo.divergentes > 0 ? (
                      <span className="inline-flex items-center gap-1 text-red-700"><FiAlertCircle size={13} /> {resumo.divergentes} conta(s) divergem do I155</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-green-700"><FiCheckCircle size={13} /> nenhuma diverg&ecirc;ncia com o I155</span>
                    )}
                  </div>
                )}
                {blocos.length === 1 ? (
                  <BlocoConta r={blocos[0]} rolagem={true} />
                ) : (
                  <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 340px)' }}>
                    {blocos.map((r) => (
                      <BlocoConta key={r.conta.codCta} r={r} rolagem={false} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
