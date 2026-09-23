// frontend/src/pages/sped/EcfArquivoPage.tsx
// ============================================================================
// ECF - ANALISE DO LALUR (CONSULTA) - CRIADO 21/09/2026
// Tela SOMENTE DE CONSULTA sobre o arquivo fiel das ECFs (tabelas ecf_arq*),
// independente do Contabil. A unica acao que grava e "Carregar arquivos", que
// envia o .txt SPED ECF para /sped/ecf-arquivo/carregar (grava so em ecf_arq*).
// ============================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiUpload, FiLoader, FiAlertCircle, FiCheckCircle, FiLock, FiX, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { useCompany } from '../../contexts/CompanyContext';

interface ArquivoEcf {
  id: string;
  fileName: string;
  dtIni: string;
  dtFin: string;
  codVer: string | null;
  retificadora: string;
  numRec: string | null;
  hashAnterior: string | null;
  qualidade: number;
  versoesDescartadas: any;
  stats: any;
  loadedAt: string;
}
interface SaldoB {
  ini: number;
  a: number;
  b: number;
  fim: number;
}
interface ResumoAno {
  arquivoId: string;
  ano: string;
  retificadora: string;
  codVer: string | null;
  lucroContabil: number | null;
  lucroAntesIrpj: number | null;
  adicoes: number;
  exclusoes: number;
  baseIrpj: number | null;
  baseCsll: number | null;
  parteB: { I: SaldoB; C: SaldoB };
  m500Ok: number;
  m500Total: number;
}
interface LinhaCadeia {
  ano: number;
  arquivoId: string;
  retificadora: string;
  iniDeclarado: number;
  fimAnteriorDeclarado: number | null;
  saltoAnterior: number | null;
  iniEsperado: number;
  dif: number;
  parteA: number;
  parteB: number;
  fimDeclarado: number;
  fimRecalculado: number;
  lacuna: boolean;
  anoAnterior: number | null;
}
interface Linhagem {
  ano: number;
  retificadora: string;
  numRec: string | null;
  hashAnterior: string | null;
  partiuDe: string | null;
  baseadoNaOriginal: boolean;
}
interface CadeiaResp {
  I: LinhaCadeia[];
  C: LinhaCadeia[];
  linhagem: Linhagem[];
}
interface ParteBLinhaValidacao {
  ano: string;
  contaB: string;
  saldoInicial: number;
  parteA: number;
  parteB: number;
  saldoFinal: number;
  origem: 'primeiro_ano' | 'continuidade' | 'nova_conta' | 'quebra';
  contaOrigem: string | null;
  diferenca: number | null;
}
interface ParteBValidacaoResp {
  I: ParteBLinhaValidacao[];
  C: ParteBLinhaValidacao[];
}
interface ParteAConsistenciaAno {
  ano: string;
  arquivoId: string;
  m300Cod2: number | null;
  l300: number | null;
  diferenca: number | null;
  ok: boolean;
}
interface ParteACruzadaLinha {
  ano: string;
  cod: string;
  descricao: string;
  tipo: string;
  valorIrpj: number | null;
  valorCsll: number | null;
  situacao: 'igual' | 'diferem' | 'so_irpj' | 'so_csll';
  semLastroIrpj: boolean;
  semLastroCsll: boolean;
}
interface ParteAValidacaoResp {
  consistencia: ParteAConsistenciaAno[];
  cruzada: ParteACruzadaLinha[];
}
interface PeriodoM {
  per: string;
  dtIni: string;
  dtFin: string;
}
interface ContaA {
  codCta: string;
  codCcus: string;
  valor: number;
  dc: string;
}
interface LinhaA {
  cod: string;
  descricao: string;
  tipo: string;
  indRelacao: string;
  valor: number;
  historico: string;
  contas: ContaA[];
}
interface ParteAResp {
  arquivo: { id: string; ano: string; retificadora: string; fileName: string };
  trib: string;
  per: string;
  periodos: PeriodoM[];
  linhas: LinhaA[];
  totais: { adicoes: number; exclusoes: number };
}
interface RegLinha {
  ordem: number;
  per: string | null;
  campos: string[];
}
interface ParteBResp {
  arquivo: { id: string; ano: string; retificadora: string; fileName: string };
  per: string;
  periodos: PeriodoM[];
  m010: RegLinha[];
  m410: RegLinha[];
  m500: RegLinha[];
  m510: RegLinha[];
}
interface IndiceResp {
  registros: { bloco: string; reg: string; n: number }[];
  periodos: string[];
}
interface RegsResp {
  reg: string;
  per: string | null;
  total: number;
  limite: number;
  offset: number;
  linhas: RegLinha[];
}
interface EcdResultadoAno {
  ano: string;
  arquivoId: string;
  resultado: number | null;
  contaCodigo: string | null;
  contaNome: string | null;
  status: 'ok' | 'conta_nao_encontrada' | 'conta_ambigua';
}
interface ItemFila {
  nome: string;
  status: 'aguardando' | 'enviando' | 'ok' | 'aviso' | 'erro';
  msg: string;
}
type Aba = 'geral' | 'partea' | 'parteb' | 'registros' | 'ecdxecf' | 'inconsist';
type Alerta =
  | { tipo: 'erro'; trib: string; ano: number; valor: number }
  | { tipo: 'lacuna'; de: number; ate: number }
  | { tipo: 'original'; ano: number; base: string };

const nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (v: number | null | undefined): string => (v === null || v === undefined ? '-' : nf.format(v));
const dataBr = (iso: string): string => {
  const p = (iso || '').substring(0, 10).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
};
const msgErro = (e: any): string => {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join(' ') : m || e?.message || 'Erro inesperado';
};

const HDR: Record<string, string[]> = {
  M300: ['Código', 'Descrição', 'Tipo', 'Relação', 'Valor', 'Histórico'],
  M350: ['Código', 'Descrição', 'Tipo', 'Relação', 'Valor', 'Histórico'],
  M310: ['Conta contábil', 'C. custo', 'Valor', 'D/C'],
  M360: ['Conta contábil', 'C. custo', 'Valor', 'D/C'],
  M410: ['Conta B', 'Tributo', 'Valor', 'Código', 'Campo 5', 'Histórico', 'Ind.'],
  M500: ['Conta B', 'Tributo', 'Saldo inicial', 'D/C', 'Parte A', 'D/C', 'Parte B', 'D/C', 'Saldo final', 'D/C'],
  M510: ['Código', 'Descrição', 'Tributo', 'Saldo inicial', 'D/C', 'Parte A', 'D/C', 'Parte B', 'D/C', 'Saldo final', 'D/C'],
  N630: ['Código', 'Descrição', 'Valor'],
  N670: ['Código', 'Descrição', 'Valor'],
  L300: ['Código', 'Descrição', 'Ind.', 'Nível', 'Nat.', 'Cód. sup.', 'Valor', 'D/C'],
};

const thBase = 'px-3 py-2 text-[12px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 whitespace-nowrap';
const td = 'px-3 py-2 text-[13px]';
const card = 'bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden';
const cardHead = 'px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-[13px] font-semibold text-gray-700';

function TabelaCampos({ rows, headers }: { rows: RegLinha[]; headers?: string[] }) {
  let n = 0;
  for (const r of rows) if (r.campos.length > n) n = r.campos.length;
  const cab = (i: number): string => (headers && headers[i] ? headers[i] : 'c' + (i + 1));
  if (rows.length === 0) return <div className="py-6 text-center text-gray-400 text-sm">Nenhuma linha.</div>;
  return (
    <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
      <table className="w-full border-collapse">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className={thBase + ' text-left'}>#</th>
            <th className={thBase + ' text-left'}>Per.</th>
            {Array.from({ length: n }).map((_, i) => (
              <th key={i} className={thBase + ' text-left'}>{cab(i)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/40">
              <td className={td + ' font-mono text-gray-400'}>{r.ordem}</td>
              <td className={td + ' font-mono text-gray-500'}>{r.per ?? '-'}</td>
              {Array.from({ length: n }).map((_, j) => (
                <td key={j} className={td + ' font-mono text-gray-700 whitespace-nowrap'}>{r.campos[j] ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BadgeVersao({ ret }: { ret: string }) {
  return ret === 'S' ? (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700" title="Retificadora (substitui a original)">RETIF.</span>
  ) : (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500" title="Original">ORIG.</span>
  );
}

export default function EcfArquivoPage() {
  const { activeCompany } = useCompany();
  const [arquivos, setArquivos] = useState<ArquivoEcf[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [aba, setAba] = useState<Aba>('geral');
  const [selId, setSelId] = useState('');
  const [resumo, setResumo] = useState<ResumoAno[]>([]);
  const [cadeia, setCadeia] = useState<CadeiaResp | null>(null);
  const [parteBValid, setParteBValid] = useState<ParteBValidacaoResp | null>(null);
  const [parteAValid, setParteAValid] = useState<ParteAValidacaoResp | null>(null);
  const [trib, setTrib] = useState<'I' | 'C'>('I');
  const [per, setPer] = useState('A00');
  const [parteA, setParteA] = useState<ParteAResp | null>(null);
  const [abertas, setAbertas] = useState<string[]>([]);
  const [parteB, setParteB] = useState<ParteBResp | null>(null);
  const [indice, setIndice] = useState<IndiceResp | null>(null);
  const [regSel, setRegSel] = useState('');
  const [perR, setPerR] = useState('');
  const [q, setQ] = useState('');
  const [limite, setLimite] = useState(200);
  const [regs, setRegs] = useState<RegsResp | null>(null);
  const [loadingAba, setLoadingAba] = useState(false);
  const [erro, setErro] = useState('');
  const [ecdResultados, setEcdResultados] = useState<EcdResultadoAno[]>([]);
  const [loadingEcdXEcf, setLoadingEcdXEcf] = useState(false);
  const [decompAberta, setDecompAberta] = useState<string | null>(null);
  const [decompDados, setDecompDados] = useState<Record<string, ParteAResp | 'loading' | string>>({});
  const [fila, setFila] = useState<ItemFila[]>([]);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const carregarTudo = useCallback(async () => {
    if (!activeCompany) {
      setArquivos([]);
      setResumo([]);
      setCadeia(null);
      setParteBValid(null);
      setParteAValid(null);
      return;
    }
    setLoadingList(true);
    try {
      const [a, r, c, v, va] = await Promise.all([
        api.get('/sped/ecf-arquivo/arquivos'),
        api.get('/sped/ecf-arquivo/lalur/resumo'),
        api.get('/sped/ecf-arquivo/lalur/cadeia'),
        api.get('/sped/ecf-arquivo/lalur/parte-b-validacao'),
        api.get('/sped/ecf-arquivo/lalur/parte-a-validacao'),
      ]);
      const ls: ArquivoEcf[] = a.data ?? [];
      setArquivos(ls);
      setResumo(r.data ?? []);
      setCadeia(c.data ?? null);
      setParteBValid(v.data ?? null);
      setParteAValid(va.data ?? null);
      setSelId((cur) => (cur && ls.some((x) => x.id === cur) ? cur : ls.length > 0 ? ls[ls.length - 1].id : ''));
    } catch (e: any) {
      toast.error(msgErro(e));
    } finally {
      setLoadingList(false);
    }
  }, [activeCompany]);

  useEffect(() => {
    setSelId('');
    setResumo([]);
    setCadeia(null);
    setParteA(null);
    setParteB(null);
    setIndice(null);
    setRegs(null);
    setErro('');
    carregarTudo();
  }, [activeCompany?.id, carregarTudo]);

  // Parte A
  useEffect(() => {
    if (aba !== 'partea' || !selId) return undefined;
    let vivo = true;
    setLoadingAba(true);
    setErro('');
    api
      .get('/sped/ecf-arquivo/' + selId + '/parte-a', { params: { per, trib } })
      .then((r) => {
        if (vivo) {
          setParteA(r.data);
          setAbertas([]);
        }
      })
      .catch((e) => {
        if (vivo) {
          setParteA(null);
          setErro(msgErro(e));
        }
      })
      .finally(() => {
        if (vivo) setLoadingAba(false);
      });
    return () => {
      vivo = false;
    };
  }, [aba, selId, per, trib]);

  // Parte B
  useEffect(() => {
    if (aba !== 'parteb' || !selId) return undefined;
    let vivo = true;
    setLoadingAba(true);
    setErro('');
    api
      .get('/sped/ecf-arquivo/' + selId + '/parte-b', { params: { per } })
      .then((r) => {
        if (vivo) setParteB(r.data);
      })
      .catch((e) => {
        if (vivo) {
          setParteB(null);
          setErro(msgErro(e));
        }
      })
      .finally(() => {
        if (vivo) setLoadingAba(false);
      });
    return () => {
      vivo = false;
    };
  }, [aba, selId, per]);

  // Registros: indice
  useEffect(() => {
    if (aba !== 'registros' || !selId) return undefined;
    let vivo = true;
    api
      .get('/sped/ecf-arquivo/' + selId + '/indice')
      .then((r) => {
        if (!vivo) return;
        const d: IndiceResp = r.data;
        setIndice(d);
        setRegSel((cur) => (cur && d.registros.some((x) => x.reg === cur) ? cur : d.registros.some((x) => x.reg === 'M500') ? 'M500' : d.registros.length > 0 ? d.registros[0].reg : ''));
      })
      .catch((e) => {
        if (vivo) setErro(msgErro(e));
      });
    return () => {
      vivo = false;
    };
  }, [aba, selId]);

  // Registros: dados (com pequena espera ao digitar a busca)
  useEffect(() => {
    if (aba !== 'registros' || !selId || !regSel) return undefined;
    let vivo = true;
    const t = setTimeout(() => {
      setLoadingAba(true);
      setErro('');
      api
        .get('/sped/ecf-arquivo/' + selId + '/registros', {
          params: { reg: regSel, per: perR || undefined, q: q || undefined, limite, offset: 0 },
        })
        .then((r) => {
          if (vivo) setRegs(r.data);
        })
        .catch((e) => {
          if (vivo) {
            setRegs(null);
            setErro(msgErro(e));
          }
        })
        .finally(() => {
          if (vivo) setLoadingAba(false);
        });
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [aba, selId, regSel, perR, q, limite]);

  // ECD x ECF: resultado anual reconstruido da ECD (independe do arquivo selecionado)
  useEffect(() => {
    if (!activeCompany) return undefined;
    let vivo = true;
    setLoadingEcdXEcf(true);
    api
      .get('/sped/ecd-arquivo/resultado-anual')
      .then((r) => {
        if (vivo) setEcdResultados(r.data ?? []);
      })
      .catch((e) => {
        if (vivo) toast.error(msgErro(e));
      })
      .finally(() => {
        if (vivo) setLoadingEcdXEcf(false);
      });
    return () => {
      vivo = false;
    };
  }, [activeCompany?.id]);

  const abrirDecomposicao = (ano: string, ecfArquivoId: string) => {
    if (decompAberta === ano) {
      setDecompAberta(null);
      return;
    }
    setDecompAberta(ano);
    if (decompDados[ano]) return;
    setDecompDados((p) => ({ ...p, [ano]: 'loading' }));
    api
      .get('/sped/ecf-arquivo/' + ecfArquivoId + '/parte-a', { params: { per: 'A00', trib: 'I' } })
      .then((r) => setDecompDados((p) => ({ ...p, [ano]: r.data })))
      .catch((e) => setDecompDados((p) => ({ ...p, [ano]: 'ERRO: ' + msgErro(e) })));
  };

  const anosOrdenadosCompletos = useMemo(() => {
    const anos = new Set<string>();
    for (const r of resumo) anos.add(r.ano);
    for (const e of ecdResultados) anos.add(e.ano);
    return Array.from(anos).sort();
  }, [resumo, ecdResultados]);

  const linhasEcdXEcf = useMemo(() => {
    const anos = new Set<string>();
    for (const r of resumo) anos.add(r.ano);
    for (const e of ecdResultados) anos.add(e.ano);
    return Array.from(anos)
      .sort()
      .map((ano) => {
        const ecf = resumo.find((r) => r.ano === ano) ?? null;
        const ecd = ecdResultados.find((e) => e.ano === ano) ?? null;
        let status: 'ok' | 'diverge' | 'sem_ecd' | 'sem_ecf' | 'ecd_indeterminado' = 'sem_ecf';
        let dif: number | null = null;
        if (!ecf) status = 'sem_ecf';
        else if (!ecd) status = 'sem_ecd';
        else if (ecd.status !== 'ok' || ecd.resultado === null) status = 'ecd_indeterminado';
        else {
          dif = ecf.lucroContabil !== null ? ecf.lucroContabil - ecd.resultado : null;
          status = dif !== null && Math.abs(dif) <= 0.01 ? 'ok' : 'diverge';
        }
        return { ano, ecf, ecd, dif, status };
      });
  }, [resumo, ecdResultados]);

  const alertas = useMemo<Alerta[]>(() => {
    const out: Alerta[] = [];
    if (!cadeia) return out;
    for (const t of ['I', 'C'] as const) {
      const primeira = cadeia[t].find((l) => !l.lacuna && Math.abs(l.dif) > 0.004);
      if (primeira) out.push({ tipo: 'erro', trib: t, ano: primeira.ano, valor: primeira.dif });
    }
    for (const l of cadeia.I) {
      if (l.lacuna && l.anoAnterior !== null) out.push({ tipo: 'lacuna', de: l.anoAnterior + 1, ate: l.ano - 1 });
    }
    for (const g of cadeia.linhagem) {
      if (g.baseadoNaOriginal && g.partiuDe) out.push({ tipo: 'original', ano: g.ano, base: g.partiuDe });
    }
    return out;
  }, [cadeia]);

  const enviar = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const lista = Array.from(files).sort((a, b) => a.name.localeCompare(b.name));
    setFila(lista.map((f) => ({ nome: f.name, status: 'aguardando', msg: '' })));
    setEnviando(true);
    for (let i = 0; i < lista.length; i++) {
      setFila((x) => x.map((y, j) => (j === i ? { ...y, status: 'enviando' } : y)));
      try {
        const fd = new FormData();
        fd.append('file', lista[i]);
        const r = await api.post('/sped/ecf-arquivo/carregar', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 15 * 60 * 1000,
        });
        const d = r.data;
        const ret = d.retificadora === 'S' ? 'retificadora' : 'original';
        let status: ItemFila['status'] = 'ok';
        let msg = '';
        if (d.acao === 'carregada') msg = 'carregada (' + ret + ', ' + d.periodo + ', ' + d.linhas + ' linhas)';
        else if (d.acao === 'substituiu') msg = 'substituiu a versão anterior (' + d.motivo + ') · ' + d.linhas + ' linhas';
        else if (d.acao === 'igual') msg = 'já estava carregada';
        else if (d.acao === 'ignorada') { status = 'aviso'; msg = 'ignorada: ' + d.motivo; }
        else { status = 'erro'; msg = d.motivo || 'conflito'; }
        setFila((x) => x.map((y, j) => (j === i ? { ...y, status, msg } : y)));
      } catch (e: any) {
        const msg = msgErro(e);
        setFila((x) => x.map((y, j) => (j === i ? { ...y, status: 'erro', msg } : y)));
      }
    }
    setEnviando(false);
    if (inputRef.current) inputRef.current.value = '';
    await carregarTudo();
  };


  interface ItemInconsist {
    ano: string;
    categoria: string;
    descricao: string;
    diferenca: number | null;
    aba: Aba;
  }
  const inconsistencias = useMemo<ItemInconsist[]>(() => {
    const out: ItemInconsist[] = [];

    for (const l of linhasEcdXEcf) {
      if (l.status === 'diverge') {
        out.push({
          ano: l.ano,
          categoria: 'Resultado do exerc\u00edcio',
          descricao: 'ECD (' + fmt(l.ecd?.resultado ?? null) + ') diverge da ECF/L300 (' + fmt(l.ecf?.lucroContabil ?? null) + ')',
          diferenca: l.dif,
          aba: 'ecdxecf',
        });
      } else if (l.status === 'sem_ecd' || l.status === 'sem_ecf') {
        out.push({
          ano: l.ano,
          categoria: 'Lacuna',
          descricao: l.status === 'sem_ecd' ? 'Falta ECD para este ano' : 'Falta ECF vigente para este ano',
          diferenca: null,
          aba: l.status === 'sem_ecd' ? 'ecdxecf' : 'geral',
        });
      }
    }

    if (parteBValid) {
      for (const trib of ['I', 'C'] as const) {
        for (const l of parteBValid[trib]) {
          if (l.origem === 'quebra') {
            out.push({
              ano: l.ano,
              categoria: 'Parte B \u2014 ' + (trib === 'I' ? 'IRPJ' : 'CSLL'),
              descricao: 'Conta ' + l.contaB + ': saldo inicial n\u00e3o bate com nenhum fechamento do ano anterior',
              diferenca: l.diferenca,
              aba: 'geral',
            });
          }
        }
      }
    }

    if (parteAValid) {
      for (const c of parteAValid.consistencia) {
        if (!c.ok) {
          out.push({
            ano: c.ano,
            categoria: 'Parte A \u2014 consist\u00eancia',
            descricao: 'Lucro base do LALUR (M300) diverge do L300 declarado',
            diferenca: c.diferenca,
            aba: 'partea',
          });
        }
      }
      for (const l of parteAValid.cruzada) {
        if (l.situacao !== 'igual') {
          const rotulo = l.situacao === 'diferem' ? 'Valores diferentes' : l.situacao === 'so_irpj' ? 'S\u00f3 no IRPJ' : 'S\u00f3 na CSLL';
          out.push({
            ano: l.ano,
            categoria: 'Parte A \u2014 IRPJ \u00d7 CSLL',
            descricao: '[' + l.cod + '] ' + l.descricao + ' \u2014 ' + rotulo,
            diferenca: l.valorIrpj !== null && l.valorCsll !== null ? l.valorIrpj - l.valorCsll : null,
            aba: 'partea',
          });
        }
      }
    }

    return out.sort((a, b) => a.ano.localeCompare(b.ano) || a.categoria.localeCompare(b.categoria));
  }, [linhasEcdXEcf, parteBValid, parteAValid]);

  if (!activeCompany) {
    return <div className="p-8 text-center text-gray-400 text-sm">Selecione uma empresa para analisar as ECFs.</div>;
  }

  const seletorArquivo = (
    <select
      value={selId}
      onChange={(e) => {
        setSelId(e.target.value);
        setPer('A00');
        setPerR('');
      }}
      className="h-8 border border-gray-200 rounded-lg px-2 text-[13px] bg-white"
    >
      {arquivos.map((a) => (
        <option key={a.id} value={a.id}>
          {a.dtIni.substring(0, 4) + (a.retificadora === 'S' ? ' (retificadora)' : ' (original)')}
        </option>
      ))}
    </select>
  );

  const seletorPeriodo = (periodos: PeriodoM[] | undefined) => (
    <select value={per} onChange={(e) => setPer(e.target.value)} className="h-8 border border-gray-200 rounded-lg px-2 text-[13px] bg-white">
      {(periodos ?? [{ per: 'A00', dtIni: '', dtFin: '' }]).map((p) => (
        <option key={p.per} value={p.per}>
          {p.per + (p.dtIni ? '  ' + dataBr(p.dtIni) + ' a ' + dataBr(p.dtFin) : '')}
        </option>
      ))}
    </select>
  );

  const abas: { id: Aba; nome: string }[] = [
    { id: 'geral', nome: 'Visão geral' },
    { id: 'partea', nome: 'Parte A' },
    { id: 'parteb', nome: 'Parte B' },
    { id: 'registros', nome: 'Registros' },
    { id: 'ecdxecf', nome: 'ECD × ECF' },
    { id: 'inconsist', nome: 'Inconsistências' },
  ];

  const tabelaCadeia = (titulo: string, linhas: LinhaCadeia[]) => (
    <div className={card}>
      <div className={cardHead}>{titulo}</div>
      <div className="overflow-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th className={thBase + ' text-left'}>Ano</th>
              <th className={thBase + ' text-right'}>Fechamento anterior</th>
              <th className={thBase + ' text-right'}>Saldo inicial declarado</th>
              <th className={thBase + ' text-right'}>Salto</th>
              <th className={thBase + ' text-right'}>Esperado (recalculado)</th>
              <th className={thBase + ' text-right'}>Diferen&ccedil;a</th>
              <th className={thBase + ' text-right'}>Parte A</th>
              <th className={thBase + ' text-right'}>Parte B</th>
              <th className={thBase + ' text-right'}>Saldo final</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.ano} className="border-b border-gray-50">
                <td className={td + ' font-medium text-gray-800 whitespace-nowrap'}>
                  {l.ano} <BadgeVersao ret={l.retificadora} />
                  {l.lacuna && (
                    <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700" title="H&aacute; anos sem ECF entre este e o anterior">LACUNA</span>
                  )}
                </td>
                <td className={td + ' text-right font-mono text-gray-500'}>{fmt(l.fimAnteriorDeclarado)}</td>
                <td className={td + ' text-right font-mono'}>{fmt(l.iniDeclarado)}</td>
                <td className={td + ' text-right font-mono ' + (l.saltoAnterior !== null && Math.abs(l.saltoAnterior) > 0.004 ? 'text-amber-700' : 'text-gray-400')}>{fmt(l.saltoAnterior)}</td>
                <td className={td + ' text-right font-mono text-gray-500'}>{fmt(l.iniEsperado)}</td>
                <td className={td + ' text-right font-mono font-semibold ' + (!l.lacuna && Math.abs(l.dif) > 0.004 ? 'text-red-700' : 'text-gray-400')}>{fmt(l.dif)}</td>
                <td className={td + ' text-right font-mono'}>{fmt(l.parteA)}</td>
                <td className={td + ' text-right font-mono'}>{fmt(l.parteB)}</td>
                <td className={td + ' text-right font-mono font-semibold'}>{fmt(l.fimDeclarado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      {/* Cabecalho */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">ECF &mdash; An&aacute;lise do LALUR (consulta)</h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              <FiLock size={11} /> SOMENTE CONSULTA
            </span>
          </div>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Dados lidos direto dos arquivos SPED ECF, independentes do Cont&aacute;bil. Fica s&oacute; a vers&atilde;o vigente de cada ano: a retificadora substitui a original.
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
        <div className={card + ' p-3 space-y-1'}>
          <div className="text-[12px] font-bold uppercase tracking-wider text-gray-400 mb-1">Carga dos arquivos</div>
          {fila.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-[13px]">
              {f.status === 'enviando' && <FiLoader className="animate-spin text-blue-600" size={13} />}
              {f.status === 'ok' && <FiCheckCircle className="text-green-600" size={13} />}
              {f.status === 'aviso' && <FiAlertCircle className="text-amber-600" size={13} />}
              {f.status === 'erro' && <FiX className="text-red-600" size={13} />}
              {f.status === 'aguardando' && <span className="w-[13px] text-gray-300">&bull;</span>}
              <span className="font-mono text-gray-600">{f.nome}</span>
              <span className={f.status === 'erro' ? 'text-red-600' : f.status === 'aviso' ? 'text-amber-700' : 'text-gray-400'}>
                {f.status === 'aguardando' ? 'aguardando' : f.status === 'enviando' ? 'lendo e gravando...' : f.msg}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Arquivos vigentes */}
      <div className={card}>
        <div className={cardHead + ' flex items-center justify-between'}>
          <span>ECFs carregadas (vers&atilde;o vigente)</span>
          {loadingList && <FiLoader className="animate-spin text-gray-400" size={14} />}
        </div>
        {arquivos.length === 0 && !loadingList ? (
          <div className="py-10 text-center text-gray-400 text-sm">
            Nenhuma ECF carregada. Use &quot;Carregar arquivos .txt&quot; e selecione as ECFs desta empresa (pode escolher v&aacute;rias, originais e retificadoras).
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className={thBase + ' text-left'}>Per&iacute;odo</th>
                  <th className={thBase + ' text-left'}>Vers&atilde;o</th>
                  <th className={thBase + ' text-left'}>Arquivo</th>
                  <th className={thBase + ' text-left'}>Leiaute</th>
                  <th className={thBase + ' text-right'}>Linhas</th>
                  <th className={thBase + ' text-right'}>Descartadas</th>
                  <th className={thBase + ' text-left'}>Carregado em</th>
                </tr>
              </thead>
              <tbody>
                {arquivos.map((a) => {
                  const desc: any[] = Array.isArray(a.versoesDescartadas) ? a.versoesDescartadas : [];
                  return (
                    <tr
                      key={a.id}
                      onClick={() => setSelId(a.id)}
                      className={'border-b border-gray-50 cursor-pointer ' + (a.id === selId ? 'bg-blue-50' : 'hover:bg-gray-50')}
                    >
                      <td className={td + ' font-medium text-gray-800 whitespace-nowrap'}>{dataBr(a.dtIni)} &rarr; {dataBr(a.dtFin)}</td>
                      <td className={td}><BadgeVersao ret={a.retificadora} /></td>
                      <td className={td + ' text-gray-500 max-w-[320px] truncate'} title={a.fileName}>{a.fileName}</td>
                      <td className={td + ' font-mono'}>{a.codVer ?? '-'}</td>
                      <td className={td + ' text-right font-mono'}>{a.stats?.linhas ?? '-'}</td>
                      <td
                        className={td + ' text-right font-mono ' + (desc.length > 0 ? 'text-gray-700' : 'text-gray-300')}
                        title={desc.map((d) => d.fileName + ' — ' + d.motivo).join('\n')}
                      >
                        {desc.length}
                      </td>
                      <td className={td + ' text-gray-400'}>{new Date(a.loadedAt).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Abas */}
      {arquivos.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#E5E7EB', borderRadius: 12, padding: 6 }}>
          {abas.map((x) => {
            const ativa = aba === x.id;
            return (
              <button
                key={x.id}
                onClick={() => { setAba(x.id); setErro(''); }}
                style={{
                  padding: '7px 18px',
                  fontSize: 13,
                  fontWeight: ativa ? 600 : 500,
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  background: ativa ? '#FFFFFF' : 'transparent',
                  color: ativa ? '#1D4ED8' : '#4B5563',
                  boxShadow: ativa ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                }}
              >
                {x.nome}
              </button>
            );
          })}
        </div>
      )}

      {erro && (
        <div className="p-3 rounded-lg text-[13px] flex items-center gap-2" style={{ background: '#FCEBEB', color: '#A32D2D' }}>
          <FiAlertCircle size={14} /> {erro}
        </div>
      )}

      {/* VISAO GERAL */}
      {arquivos.length > 0 && aba === 'geral' && (
        <div className="space-y-4">
          {alertas.map((a, i) => (
            <div
              key={i}
              className={'rounded-lg px-3 py-2 text-[13px] flex items-start gap-2 border ' + (a.tipo === 'erro' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-amber-50 text-amber-800 border-amber-200')}
            >
              <FiAlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>
                {a.tipo === 'erro' && (
                  <>
                    A partir de <b>{a.ano}</b>, o saldo inicial declarado ({a.trib === 'I' ? 'IRPJ' : 'CSLL'}) difere do recalculado (fechamento do ano anterior + movimentos) em <b className="font-mono">{fmt(a.valor)}</b>. A diferen&ccedil;a se mant&eacute;m nos anos seguintes.
                  </>
                )}
                {a.tipo === 'lacuna' && (
                  <>
                    Faltam as ECFs de <b>{a.de === a.ate ? a.de : a.de + ' a ' + a.ate}</b>: a cadeia da Parte B est&aacute; interrompida nesse ponto e o salto entre o fechamento e a abertura n&atilde;o pode ser explicado.
                  </>
                )}
                {a.tipo === 'original' && (
                  <>
                    A ECF de <b>{a.ano}</b> partiu do recibo da ECF <b>{a.base}</b> original, que foi substitu&iacute;da por uma retificadora: os saldos de abertura podem estar defasados.
                  </>
                )}
              </span>
            </div>
          ))}

          <div className={card}>
            <div className={cardHead}>Resumo do LALUR por ano</div>
            <div className="overflow-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={thBase + ' text-left'}>Ano</th>
                    <th className={thBase + ' text-right'}>Lucro cont&aacute;bil (L300)</th>
                    <th className={thBase + ' text-right'}>Lucro antes do IRPJ (M300)</th>
                    <th className={thBase + ' text-right'}>Adi&ccedil;&otilde;es</th>
                    <th className={thBase + ' text-right'}>Exclus&otilde;es</th>
                    <th className={thBase + ' text-right'}>Base IRPJ (N630)</th>
                    <th className={thBase + ' text-right'}>Base CSLL (N670)</th>
                    <th className={thBase + ' text-center'}>M500 fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {anosOrdenadosCompletos.map((ano) => {
                    const r = resumo.find((x) => x.ano === ano);
                    if (!r) {
                      return (
                        <tr key={'falta-' + ano} className="bg-amber-50/60 border-b border-gray-50">
                          <td className={td + ' font-bold text-red-600'}>{ano}</td>
                          <td colSpan={7} className={td + ' text-amber-700 text-[12px]'}>Falta ECF</td>
                        </tr>
                      );
                    }
                    return (
                    <tr key={r.arquivoId} className="border-b border-gray-50">
                      <td className={td + ' font-medium text-gray-800 whitespace-nowrap'}>{r.ano} <BadgeVersao ret={r.retificadora} /></td>
                      <td className={td + ' text-right font-mono'}>{fmt(r.lucroContabil)}</td>
                      <td className={td + ' text-right font-mono'}>{fmt(r.lucroAntesIrpj)}</td>
                      <td className={td + ' text-right font-mono'}>{fmt(r.adicoes)}</td>
                      <td className={td + ' text-right font-mono'}>{fmt(r.exclusoes)}</td>
                      <td className={td + ' text-right font-mono'}>{fmt(r.baseIrpj)}</td>
                      <td className={td + ' text-right font-mono'}>{fmt(r.baseCsll)}</td>
                      <td className={td + ' text-center'}>
                        {r.m500Ok === r.m500Total ? (
                          <span className="inline-flex items-center gap-1 text-green-700"><FiCheckCircle size={13} /> {r.m500Ok}/{r.m500Total}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700"><FiAlertCircle size={13} /> {r.m500Ok}/{r.m500Total}</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {cadeia && tabelaCadeia('IRPJ — saldo de prejuízo fiscal (Parte B), positivo = saldo devedor', cadeia.I)}
          {cadeia && tabelaCadeia('CSLL — saldo de base de cálculo negativa (Parte B), positivo = saldo devedor', cadeia.C)}

          {parteBValid && (
            <div className={card}>
              <div
                className="px-4 py-2.5 text-[13px] font-bold text-blue-900"
                style={{ background: '#DBEAFE', borderLeft: '4px solid #2563EB', borderBottom: '1px solid #BFDBFE' }}
              >
                Parte B &mdash; valida&ccedil;&atilde;o completa (conta a conta, sem agrupar)
              </div>
              <p className="px-4 py-2 text-[12px] text-gray-400 border-b border-gray-100">
                Cada linha confere se o saldo inicial bate com o fechamento da mesma conta no ano anterior (continuidade), com o
                fechamento de outra conta (heran&ccedil;a, quando o contador troca de conta de controle) ou se n&atilde;o bate com nada (quebra real).
              </p>
              {(['I', 'C'] as const).map((trib) => (
                <div key={trib}>
                  <div
                    className="px-4 py-2 text-[12px] font-bold uppercase tracking-wider text-blue-800"
                    style={{ background: '#DBEAFE', borderLeft: '4px solid #2563EB' }}
                  >
                    {trib === 'I' ? 'IRPJ' : 'CSLL'}
                  </div>
                  <div className="overflow-auto">
                    <table className="w-full border-collapse">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className={thBase + ' text-left'}>Ano</th>
                          <th className={thBase + ' text-left'}>Conta</th>
                          <th className={thBase + ' text-right'}>Saldo inicial</th>
                          <th className={thBase + ' text-right'}>Parte A</th>
                          <th className={thBase + ' text-right'}>Parte B</th>
                          <th className={thBase + ' text-right'}>Saldo final</th>
                          <th className={thBase + ' text-left'}>Situa&ccedil;&atilde;o</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parteBValid[trib].map((l, i) => (
                          <tr key={trib + i} className="border-b border-gray-50">
                            <td className={td + ' font-medium text-gray-800'}>{l.ano}</td>
                            <td className={td + ' font-mono text-gray-600'}>{l.contaB}</td>
                            <td className={td + ' text-right font-mono'}>{fmt(l.saldoInicial)}</td>
                            <td className={td + ' text-right font-mono'}>{fmt(l.parteA)}</td>
                            <td className={td + ' text-right font-mono'}>{fmt(l.parteB)}</td>
                            <td className={td + ' text-right font-mono font-semibold'}>{fmt(l.saldoFinal)}</td>
                            <td className={td}>
                              {l.origem === 'primeiro_ano' && <span className="text-[12px] text-gray-400">Primeiro ano</span>}
                              {l.origem === 'continuidade' && (
                                <span className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                                  <FiCheckCircle size={12} /> Confere
                                </span>
                              )}
                              {l.origem === 'nova_conta' && (
                                <span className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                  <FiCheckCircle size={12} /> Herdou de {l.contaOrigem}
                                </span>
                              )}
                              {l.origem === 'quebra' && (
                                <span className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                                  <FiAlertCircle size={12} /> Quebra{l.diferenca !== null ? ' (' + fmt(l.diferenca) + ')' : ''}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {cadeia && (
            <div className={card}>
              <div className={cardHead}>Linhagem das ECFs (registro 0010 &times; recibo do 0000)</div>
              <div className="overflow-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className={thBase + ' text-left'}>Ano</th>
                      <th className={thBase + ' text-left'}>Recibo (0000)</th>
                      <th className={thBase + ' text-left'}>ECF anterior usada (0010)</th>
                      <th className={thBase + ' text-left'}>Partiu de</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cadeia.linhagem.map((g) => (
                      <tr key={g.ano} className="border-b border-gray-50">
                        <td className={td + ' font-medium text-gray-800'}>{g.ano} <BadgeVersao ret={g.retificadora} /></td>
                        <td className={td + ' font-mono text-gray-500'}>{(g.numRec ?? '-').substring(0, 12)}</td>
                        <td className={td + ' font-mono text-gray-500'}>{(g.hashAnterior ?? '-').substring(0, 12)}</td>
                        <td className={td + ' text-gray-700'}>
                          {g.partiuDe ? g.partiuDe + (g.baseadoNaOriginal ? ' (original substituída)' : '') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PARTE A */}
      {arquivos.length > 0 && aba === 'partea' && (
        <div className={card}>
          <div className={cardHead + ' flex items-center gap-3 flex-wrap'}>
            <span>Parte A do LALUR</span>
            {seletorArquivo}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[12px]">
              <button onClick={() => setTrib('I')} className={'px-3 py-1 ' + (trib === 'I' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>IRPJ</button>
              <button onClick={() => setTrib('C')} className={'px-3 py-1 ' + (trib === 'C' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>CSLL</button>
            </div>
            {seletorPeriodo(parteA?.periodos)}
            {loadingAba && <FiLoader className="animate-spin text-gray-400" size={14} />}
          </div>
          {parteA && (
            <div>
              <div className="px-4 py-2 border-b border-gray-100 text-[13px] flex items-center gap-4 flex-wrap">
                <span>Adi&ccedil;&otilde;es <b className="font-mono">{fmt(parteA.totais.adicoes)}</b></span>
                <span>Exclus&otilde;es <b className="font-mono">{fmt(parteA.totais.exclusoes)}</b></span>
                <span className="text-gray-400">{parteA.linhas.length} linha(s) com valor ou contas cont&aacute;beis</span>
              </div>
              {parteA.linhas.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-sm">Nenhum lan&ccedil;amento com valor neste per&iacute;odo.</div>
              ) : (
                <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className={thBase + ' text-left'}>C&oacute;digo</th>
                        <th className={thBase + ' text-left'}>Descri&ccedil;&atilde;o</th>
                        <th className={thBase + ' text-left'}>Tipo</th>
                        <th className={thBase + ' text-right'}>Valor</th>
                        <th className={thBase + ' text-left'}>Hist&oacute;rico</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parteA.linhas.map((l, i) => {
                        const chave = l.cod + '|' + i;
                        const aberta = abertas.indexOf(chave) >= 0;
                        return (
                          <React.Fragment key={chave}>
                            <tr className="border-b border-gray-50 hover:bg-blue-50/40">
                              <td className={td + ' font-mono text-gray-600 whitespace-nowrap'}>
                                {l.contas.length > 0 ? (
                                  <button
                                    onClick={() => setAbertas((p) => (p.indexOf(chave) >= 0 ? p.filter((x) => x !== chave) : p.concat([chave])))}
                                    className="mr-1 text-gray-400 hover:text-blue-600 align-middle"
                                  >
                                    {aberta ? <FiChevronDown size={13} /> : <FiChevronRight size={13} />}
                                  </button>
                                ) : (
                                  <span className="inline-block w-[17px]" />
                                )}
                                {l.cod}
                              </td>
                              <td className={td + ' text-gray-700'}>
                                {l.descricao}
                                {(l.tipo === 'A' || l.tipo === 'E') && l.valor !== 0 && l.contas.length === 0 && (
                                  <span
                                    className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 align-middle"
                                    title="Nenhuma conta contábil (M310/M360) por trás deste valor: foi digitado como ajuste livre, não derivado da escrituração."
                                  >
                                    SEM LASTRO CONTÁBIL
                                  </span>
                                )}
                              </td>
                              <td className={td}>
                                <span
                                  className={'text-[10px] font-bold px-1.5 py-0.5 rounded ' + (l.tipo === 'A' ? 'bg-green-100 text-green-700' : l.tipo === 'E' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500')}
                                  title="A = adi&ccedil;&atilde;o, E = exclus&atilde;o; L, P e R conforme o leiaute"
                                >
                                  {l.tipo || '-'}
                                </span>
                              </td>
                              <td className={td + ' text-right font-mono'}>{fmt(l.valor)}</td>
                              <td className={td + ' text-gray-500'}>{l.historico}</td>
                            </tr>
                            {aberta && (
                              <tr className="bg-gray-50">
                                <td colSpan={5} className="px-8 py-2">
                                  <table className="w-full border-collapse">
                                    <thead>
                                      <tr>
                                        <th className={thBase + ' text-left'}>Conta cont&aacute;bil</th>
                                        <th className={thBase + ' text-left'}>C. custo</th>
                                        <th className={thBase + ' text-right'}>Valor</th>
                                        <th className={thBase + ' text-left'}>D/C</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {l.contas.map((c, j) => (
                                        <tr key={j} className="border-b border-gray-100">
                                          <td className={td + ' font-mono text-gray-600'}>{c.codCta}</td>
                                          <td className={td + ' font-mono text-gray-400'}>{c.codCcus}</td>
                                          <td className={td + ' text-right font-mono'}>{fmt(c.valor)}</td>
                                          <td className={td + ' text-gray-500'}>{c.dc}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PARTE B */}
      {arquivos.length > 0 && aba === 'parteb' && (
        <div className="space-y-4">
          <div className={card}>
            <div className={cardHead + ' flex items-center gap-3 flex-wrap'}>
              <span>Parte B do LALUR</span>
              {seletorArquivo}
              {seletorPeriodo(parteB?.periodos)}
              {loadingAba && <FiLoader className="animate-spin text-gray-400" size={14} />}
            </div>
            {parteB && <div className="px-4 py-2 text-[12px] text-gray-400">M010 vale para o arquivo todo; M410, M500 e M510 s&atilde;o do per&iacute;odo escolhido.</div>}
          </div>
          {parteB && (
            <>
              <div className={card}><div className={cardHead}>M010 &mdash; contas da Parte B (identifica&ccedil;&atilde;o e saldos iniciais)</div><TabelaCampos rows={parteB.m010} /></div>
              <div className={card}><div className={cardHead}>M410 &mdash; lan&ccedil;amentos na Parte B</div><TabelaCampos rows={parteB.m410} headers={HDR.M410} /></div>
              <div className={card}><div className={cardHead}>M500 &mdash; saldos finais das contas da Parte B</div><TabelaCampos rows={parteB.m500} headers={HDR.M500} /></div>
              <div className={card}><div className={cardHead}>M510 &mdash; saldos por c&oacute;digo da tabela din&acirc;mica</div><TabelaCampos rows={parteB.m510} headers={HDR.M510} /></div>
            </>
          )}
        </div>
      )}

      {arquivos.length > 0 && aba === 'geral' && parteAValid && (
        <div className={card}>
          <div
            className="px-4 py-2.5 text-[13px] font-bold text-blue-900"
            style={{ background: '#DBEAFE', borderLeft: '4px solid #2563EB', borderBottom: '1px solid #BFDBFE' }}
          >
            Parte A &mdash; valida&ccedil;&atilde;o completa (consist&ecirc;ncia interna e IRPJ &times; CSLL)
          </div>

          <div
            className="px-4 py-2 text-[12px] font-bold uppercase tracking-wider text-blue-800"
            style={{ background: '#DBEAFE', borderLeft: '4px solid #2563EB' }}
          >
            Consist&ecirc;ncia interna: M300 (lucro antes do IRPJ) &times; L300 (DRE declarado)
          </div>
          <div className="overflow-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className={thBase + ' text-left'}>Ano</th>
                  <th className={thBase + ' text-right'}>M300 (c&oacute;d. 2)</th>
                  <th className={thBase + ' text-right'}>L300</th>
                  <th className={thBase + ' text-right'}>Diferen&ccedil;a</th>
                  <th className={thBase + ' text-left'}>Situa&ccedil;&atilde;o</th>
                </tr>
              </thead>
              <tbody>
                {parteAValid.consistencia.map((l) => (
                  <tr key={l.ano} className="border-b border-gray-50">
                    <td className={td + ' font-medium text-gray-800'}>{l.ano}</td>
                    <td className={td + ' text-right font-mono'}>{fmt(l.m300Cod2)}</td>
                    <td className={td + ' text-right font-mono'}>{fmt(l.l300)}</td>
                    <td className={td + ' text-right font-mono ' + (!l.ok ? 'text-red-700 font-semibold' : 'text-gray-400')}>{fmt(l.diferenca)}</td>
                    <td className={td}>
                      {l.ok ? (
                        <span className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200"><FiCheckCircle size={12} /> Confere</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200"><FiAlertCircle size={12} /> Diverge</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className="px-4 py-2 text-[12px] font-bold uppercase tracking-wider text-blue-800"
            style={{ background: '#DBEAFE', borderLeft: '4px solid #2563EB' }}
          >
            Cruzamento IRPJ (M300) &times; CSLL (M350), todos os anos
          </div>
          <div className="overflow-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className={thBase + ' text-left'}>Ano</th>
                  <th className={thBase + ' text-left'}>C&oacute;digo</th>
                  <th className={thBase + ' text-left'}>Descri&ccedil;&atilde;o</th>
                  <th className={thBase + ' text-right'}>IRPJ</th>
                  <th className={thBase + ' text-right'}>CSLL</th>
                  <th className={thBase + ' text-left'}>Situa&ccedil;&atilde;o</th>
                </tr>
              </thead>
              <tbody>
                {parteAValid.cruzada.map((l, i) => (
                  <tr key={i} className={'border-b border-gray-50 ' + (l.situacao !== 'igual' ? 'bg-amber-50/50' : '')}>
                    <td className={td + ' font-medium text-gray-800'}>{l.ano}</td>
                    <td className={td + ' font-mono text-gray-600'}>{l.cod}</td>
                    <td className={td + ' text-gray-700'}>
                      {l.descricao}
                      {l.semLastroIrpj && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 align-middle">IRPJ SEM LASTRO</span>}
                      {l.semLastroCsll && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 align-middle">CSLL SEM LASTRO</span>}
                    </td>
                    <td className={td + ' text-right font-mono'}>{l.valorIrpj !== null ? fmt(l.valorIrpj) : '-'}</td>
                    <td className={td + ' text-right font-mono'}>{l.valorCsll !== null ? fmt(l.valorCsll) : '-'}</td>
                    <td className={td}>
                      {l.situacao === 'igual' && <span className="text-[12px] text-gray-400">Igual</span>}
                      {l.situacao === 'diferem' && <span className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200"><FiAlertCircle size={12} /> Valores diferentes</span>}
                      {l.situacao === 'so_irpj' && <span className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"><FiAlertCircle size={12} /> S&oacute; no IRPJ</span>}
                      {l.situacao === 'so_csll' && <span className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"><FiAlertCircle size={12} /> S&oacute; na CSLL</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REGISTROS */}
      {arquivos.length > 0 && aba === 'registros' && (
        <div className={card}>
          <div className={cardHead + ' flex items-center gap-3 flex-wrap'}>
            <span>Registros do arquivo</span>
            {seletorArquivo}
            <select value={regSel} onChange={(e) => { setRegSel(e.target.value); setLimite(200); }} className="h-8 border border-gray-200 rounded-lg px-2 text-[13px] bg-white">
              {(indice?.registros ?? []).map((r) => (
                <option key={r.reg} value={r.reg}>{r.reg + ' (' + r.n + ')'}</option>
              ))}
            </select>
            <select value={perR} onChange={(e) => setPerR(e.target.value)} className="h-8 border border-gray-200 rounded-lg px-2 text-[13px] bg-white">
              <option value="">todos os per&iacute;odos</option>
              {(indice?.periodos ?? []).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar texto..."
              className="h-8 w-56 border border-gray-200 rounded-lg px-3 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {loadingAba && <FiLoader className="animate-spin text-gray-400" size={14} />}
          </div>
          {regs && (
            <div>
              <div className="px-4 py-2 border-b border-gray-100 text-[12px] text-gray-500 flex items-center gap-3">
                <span>{regs.linhas.length} de {regs.total} linha(s)</span>
                {regs.linhas.length < regs.total && (
                  <button onClick={() => setLimite((x) => x + 200)} className="text-blue-700 hover:underline">... mostrar mais</button>
                )}
              </div>
              <TabelaCampos rows={regs.linhas} headers={HDR[regs.reg]} />
            </div>
          )}
        </div>
      )}

      {/* ECD x ECF */}
      {arquivos.length > 0 && aba === 'ecdxecf' && (
        <div className={card}>
          <div className={cardHead + ' flex items-center gap-2'}>
            <span>Conferência do resultado do exercício: ECD (conta &quot;Resultado do Exercício&quot;) &times; ECF (L300)</span>
            {loadingEcdXEcf && <FiLoader className="animate-spin text-gray-400" size={14} />}
          </div>
          <p className="px-4 py-2 text-[12px] text-gray-400 border-b border-gray-100">
            Positivo = lucro, negativo = prejuízo, nos dois lados. Tolerância de R$ 0,01. Anos sem ECD ou sem ECF vigente ficam marcados &quot;sem comparação&quot;, não como divergência.
          </p>
          <div className="overflow-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className={thBase + ' text-left'}>Ano</th>
                  <th className={thBase + ' text-right'}>Resultado ECD</th>
                  <th className={thBase + ' text-right'}>Resultado ECF (L300)</th>
                  <th className={thBase + ' text-right'}>Diferença</th>
                  <th className={thBase + ' text-left'}>Situação</th>
                </tr>
              </thead>
              <tbody>
                {linhasEcdXEcf.map((l) => (
                  <React.Fragment key={l.ano}>
                    <tr
                      className={'border-b border-gray-50 ' + (l.status === 'diverge' && l.ecf ? 'cursor-pointer hover:bg-amber-50/60' : '')}
                      onClick={() => l.status === 'diverge' && l.ecf && abrirDecomposicao(l.ano, l.ecf.arquivoId)}
                    >
                      <td className={td + ' font-medium text-gray-800'}>
                        {l.ano}
                        {l.status === 'diverge' && l.ecf && (
                          <FiChevronRight size={13} className={'inline ml-1 text-gray-400 transition-transform ' + (decompAberta === l.ano ? 'rotate-90' : '')} />
                        )}
                      </td>
                      <td className={td + ' text-right font-mono'}>
                        {l.ecd && l.ecd.status === 'ok' ? fmt(l.ecd.resultado) : l.ecd ? <span className="text-amber-600 text-[12px]">{l.ecd.status === 'conta_nao_encontrada' ? 'conta não encontrada' : 'conta ambígua'}</span> : '-'}
                      </td>
                      <td className={td + ' text-right font-mono'}>{l.ecf ? fmt(l.ecf.lucroContabil) : '-'}</td>
                      <td className={td + ' text-right font-mono ' + (l.status === 'diverge' ? 'text-red-700 font-semibold' : 'text-gray-400')}>{l.dif !== null ? fmt(l.dif) : '-'}</td>
                      <td className={td}>
                        {l.status === 'ok' && <span className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200"><FiCheckCircle size={12} /> Confere</span>}
                        {l.status === 'diverge' && <span className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200"><FiAlertCircle size={12} /> Diverge</span>}
                        {(l.status === 'sem_ecd' || l.status === 'sem_ecf') && <span className="text-[12px] text-gray-400">Sem comparação ({l.status === 'sem_ecd' ? 'falta ECD' : 'falta ECF vigente'})</span>}
                        {l.status === 'ecd_indeterminado' && <span className="text-[12px] text-amber-600">Não foi possível achar a conta na ECD</span>}
                      </td>
                    </tr>
                    {decompAberta === l.ano && (
                      <tr>
                        <td colSpan={5} className="bg-amber-50/40 px-6 py-3">
                          {decompDados[l.ano] === 'loading' && <div className="text-gray-400 text-[13px] flex items-center gap-2"><FiLoader className="animate-spin" size={14} /> Carregando decomposição da Parte A...</div>}
                          {typeof decompDados[l.ano] === 'string' && decompDados[l.ano] !== 'loading' && (
                            <div className="text-red-700 text-[13px]">{decompDados[l.ano] as string}</div>
                          )}
                          {decompDados[l.ano] && typeof decompDados[l.ano] === 'object' && (
                            <div>
                              <div className="text-[12px] font-bold uppercase tracking-wider text-gray-400 mb-2">Decomposição (Parte A, IRPJ, A00)</div>
                              <table className="w-full border-collapse">
                                <thead>
                                  <tr>
                                    <th className={thBase + ' text-left'}>Código</th>
                                    <th className={thBase + ' text-left'}>Descrição</th>
                                    <th className={thBase + ' text-left'}>Tipo</th>
                                    <th className={thBase + ' text-right'}>Valor</th>
                                    <th className={thBase + ' text-left'}>Histórico</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(decompDados[l.ano] as ParteAResp).linhas.map((x, i) => (
                                    <tr key={i} className="border-b border-gray-100">
                                      <td className={td + ' font-mono text-gray-600 whitespace-nowrap'}>{x.cod}</td>
                                      <td className={td + ' text-gray-700'}>
                                        {x.descricao}
                                        {(x.tipo === 'A' || x.tipo === 'E') && x.valor !== 0 && x.contas.length === 0 && (
                                          <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 align-middle">SEM LASTRO CONTÁBIL</span>
                                        )}
                                      </td>
                                      <td className={td}>
                                        <span className={'text-[10px] font-bold px-1.5 py-0.5 rounded ' + (x.tipo === 'A' ? 'bg-green-100 text-green-700' : x.tipo === 'E' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500')}>{x.tipo || '-'}</span>
                                      </td>
                                      <td className={td + ' text-right font-mono'}>{fmt(x.valor)}</td>
                                      <td className={td + ' text-gray-500'}>{x.historico}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inconsistencias */}
      {arquivos.length > 0 && aba === 'inconsist' && (
        <div className={card}>
          <div
            className="px-4 py-2.5 text-[13px] font-bold"
            style={{ background: inconsistencias.length > 0 ? '#FEE2E2' : '#DCFCE7', borderLeft: '4px solid ' + (inconsistencias.length > 0 ? '#DC2626' : '#16A34A'), color: inconsistencias.length > 0 ? '#991B1B' : '#166534' }}
          >
            {inconsistencias.length > 0
              ? inconsistencias.length + ' inconsist\u00eancia(s) encontrada(s)'
              : 'Nenhuma inconsist\u00eancia encontrada nos dados carregados'}
          </div>
          <p className="px-4 py-2 text-[12px] text-gray-400 border-b border-gray-100">
            Lista consolidada dos achados das abas Vis\u00e3o geral, Parte A e ECD &times; ECF. Clique em &quot;Ver detalhe&quot; para abrir a aba correspondente.
          </p>
          {inconsistencias.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">Tudo confere nos dados carregados at\u00e9 agora.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={thBase + ' text-left'}>Ano</th>
                    <th className={thBase + ' text-left'}>Categoria</th>
                    <th className={thBase + ' text-left'}>Descri&ccedil;&atilde;o</th>
                    <th className={thBase + ' text-right'}>Diferen&ccedil;a</th>
                    <th className={thBase + ' text-left'}></th>
                  </tr>
                </thead>
                <tbody>
                  {inconsistencias.map((x, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-red-50/30">
                      <td className={td + ' font-bold text-red-600'}>{x.ano}</td>
                      <td className={td + ' text-gray-700 whitespace-nowrap'}>{x.categoria}</td>
                      <td className={td + ' text-gray-600'}>{x.descricao}</td>
                      <td className={td + ' text-right font-mono ' + (x.diferenca !== null ? 'text-red-700 font-semibold' : 'text-gray-300')}>
                        {x.diferenca !== null ? fmt(x.diferenca) : '-'}
                      </td>
                      <td className={td}>
                        <button
                          onClick={() => { setAba(x.aba); setErro(''); }}
                          className="text-[12px] font-medium text-blue-700 hover:underline whitespace-nowrap"
                        >
                          Ver detalhe &rarr;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
