// frontend/src/pages/projects/workspace/PainelProjeto.tsx
// D8 (03/10/2026): painel da operacao - conferencia com o valor de controle, Contas Individuais, prova bancaria,
// pendencias, evolucao mensal (todos os meses) e principais remetentes.
// Fase 1.4-1.5 (04/10/2026): edicao de projeto e operacao (Master); data-base e valor de controle exigem motivo.
import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { SmartDateInput } from '../../../components/SmartDateInput';
import { PROJ, PROJ_ACCENT, PROJ_LIGHT, Operacao, Projeto, Credito, fmtBRL, fmtData, cardSt, thSt, tdSt, erroSt, secTitle, tituloSt, subtituloSt } from './projetoTema';
import { ModalProjeto, Secao, ErroModal, Campo, BotaoSec, BotaoPri, inputModal, erroApi } from './ModalProjeto';
import SaldoInformadoModal from './SaldoInformadoModal';

interface Resumo {
  quantidadeCreditos: number; totalGeral: string; quantidadeAteDataBase: number; totalAteDataBase: string;
  valorControle: string | null; diferencaControle: string | null; conferido: boolean | null; pendentesIdentificacao: number;
  contasIndividuais: { adquirenteId: string; nome: string; quantidade: number; total: string }[];
  desvinculados: { quantidade: number; total: string }; semVinculo: number; semVinculoTotal: string;
  comProvaBancaria: number; semProvaBancaria: number;
  aplicacoes: { quantidade: number; total: string }; devolucoesAdquirente: { quantidade: number; total: string };
  saldoContratual: string; saldoInformado: { data: string; valor: string; fonte: string } | null;
}

function Kpi({ titulo, valor, detalhe, cor }: { titulo: string; valor: string; detalhe?: string; cor?: string }) {
  return (
    <div style={{ ...cardSt, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{titulo}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: cor || '#111827', marginTop: 6 }}>{valor}</div>
      {detalhe && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{detalhe}</div>}
    </div>
  );
}

// Aceita 3.495.791,15 / 3495791,15 / 3495791.15 e devolve no formato com virgula decimal (o servidor remove os pontos).
function normalizarValor(s: string): string {
  const t = s.trim().replace(/\s|R\$/g, '');
  if (!t) return '';
  if (t.includes(',')) return t.replace(/\./g, '');
  if (/^\d+\.\d{1,2}$/.test(t)) return t.replace('.', ',');
  return t.replace(/\./g, '');
}
const valorParaTela = (v: string | null) => (v ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
const botaoEdicao: React.CSSProperties = { padding: '6px 12px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#134E4A', cursor: 'pointer' };

export default function PainelProjeto({ projeto, operacao, master, onAlterado }: { projeto: Projeto; operacao: Operacao | null; master: boolean; onAlterado: () => void }) {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [erro, setErro] = useState('');
  const [editandoOp, setEditandoOp] = useState(false);
  const [editandoProj, setEditandoProj] = useState(false);
  const [registrandoSaldo, setRegistrandoSaldo] = useState(false);
  const [versaoResumo, setVersaoResumo] = useState(0);

  useEffect(() => {
    if (!operacao) return;
    setErro('');
    Promise.all([api.get(`/projects/operacoes/${operacao.id}/resumo`), api.get(`/projects/operacoes/${operacao.id}/creditos`)])
      .then(([r, c]) => { setResumo(r.data); setCreditos(c.data || []); })
      .catch((e) => setErro(e?.response?.data?.message || 'Falha ao carregar o painel.'));
  }, [operacao, versaoResumo]);

  const mensal = useMemo(() => {
    if (!creditos.length) return [];
    const m = new Map<string, number>();
    creditos.forEach((c) => { const k = c.dataCredito.slice(0, 7); m.set(k, (m.get(k) || 0) + Number(c.valor)); });
    const chaves = [...m.keys()].sort();
    let [a, mm] = chaves[0].split('-').map(Number);
    const [af, mf] = chaves[chaves.length - 1].split('-').map(Number);
    const out: { mes: string; valor: number; acumulado: number }[] = [];
    let acum = 0;
    while (a < af || (a === af && mm <= mf)) {
      const k = `${a}-${String(mm).padStart(2, '0')}`;
      const v = m.get(k) || 0;
      acum += v;
      out.push({ mes: `${String(mm).padStart(2, '0')}/${String(a).slice(2)}`, valor: Number(v.toFixed(2)), acumulado: Number(acum.toFixed(2)) });
      mm += 1; if (mm > 12) { mm = 1; a += 1; }
    }
    return out;
  }, [creditos]);

  const totalCreditos = useMemo(() => creditos.reduce((s, c) => s + Number(c.valor), 0), [creditos]);
  const remetentes = useMemo(() => {
    const m = new Map<string, { nome: string; total: number; qtd: number }>();
    creditos.forEach((c) => {
      const nome = c.remetente?.nome || 'Não identificado';
      const r = m.get(nome) || { nome, total: 0, qtd: 0 };
      r.total += Number(c.valor); r.qtd += 1; m.set(nome, r);
    });
    return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 6);
  }, [creditos]);

  if (!operacao) return <div style={{ color: '#6B7280' }}>Nenhuma operação disponível para o seu acesso.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={tituloSt}>{operacao.nome}</div>
          <div style={subtituloSt}>{projeto.nome} · data-base {fmtData(operacao.dataBase)} · situação {operacao.status}</div>
        </div>
        {master && <button style={botaoEdicao} onClick={() => setEditandoProj(true)}>Editar projeto</button>}
        {master && <button style={botaoEdicao} onClick={() => setEditandoOp(true)}>Editar operação</button>}
      </div>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      {resumo && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <Kpi titulo="Créditos até a data-base" valor={fmtBRL(resumo.totalAteDataBase)} detalhe={`${resumo.quantidadeAteDataBase} créditos`} />
          <Kpi titulo="Valor de controle" valor={fmtBRL(resumo.valorControle)}
            detalhe={resumo.conferido === null ? 'sem valor de controle' : resumo.conferido ? 'Conferido com os créditos' : `Diferença de ${fmtBRL(resumo.diferencaControle)}`}
            cor={resumo.conferido === false ? '#A32D2D' : undefined} />
          <Kpi titulo="Pendências de identificação" valor={String(resumo.pendentesIdentificacao)} detalhe="créditos sem remetente identificado"
            cor={resumo.pendentesIdentificacao > 0 ? '#B45309' : '#166534'} />
          <Kpi titulo="Total geral de créditos" valor={fmtBRL(resumo.totalGeral)} detalhe={`${resumo.quantidadeCreditos} créditos em todas as datas`} />
          <Kpi titulo="Prova bancária" valor={`${resumo.comProvaBancaria} de ${resumo.quantidadeCreditos}`}
            detalhe={resumo.semProvaBancaria === 0 ? 'todos comprovados no extrato' : `${resumo.semProvaBancaria} sem prova bancária`}
            cor={resumo.semProvaBancaria === 0 ? '#166534' : '#B45309'} />
        </div>
      )}
      {resumo && (
        <div style={{ ...cardSt, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ ...secTitle, flex: 1 }}>Contas Individuais</div>
            {master && <button style={botaoEdicao} onClick={() => setRegistrandoSaldo(true)}>Registrar saldo informado</button>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {resumo.contasIndividuais.map((c) => (
              <div key={c.adquirenteId} style={{ display: 'flex', alignItems: 'center', gap: 14, background: PROJ_LIGHT, borderLeft: `3px solid ${PROJ_ACCENT}`, borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{c.nome}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>Adquirente · {c.quantidade} créditos vinculados</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: PROJ }}>{fmtBRL(c.total)}</div>
              </div>
            ))}
            {resumo.contasIndividuais.length === 0 && <div style={{ fontSize: 13, color: '#9CA3AF' }}>Nenhum crédito vinculado a Conta Individual.</div>}
            {resumo.desvinculados.quantidade > 0 && (
              <div style={{ fontSize: 12, color: '#6B7280' }}>
                Fora da Conta Individual: <b>{resumo.desvinculados.quantidade}</b> crédito(s), {fmtBRL(resumo.desvinculados.total)} (permanecem registrados como fato bancário).
              </div>
            )}
            {resumo.semVinculo > 0 && <div style={{ fontSize: 12, color: '#B45309' }}>{resumo.semVinculo} crédito(s) aguardando decisão de vínculo ({fmtBRL(resumo.semVinculoTotal)}).</div>}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
              <tbody>
                <tr><td style={tdSt}>Créditos vinculados (aportes)</td><td style={{ ...tdSt, textAlign: 'right' }}>{fmtBRL(resumo.contasIndividuais.reduce((s, c) => s + Number(c.total), 0))}</td></tr>
                <tr><td style={tdSt}>(−) Devoluções ao Adquirente{resumo.devolucoesAdquirente.quantidade ? ` (${resumo.devolucoesAdquirente.quantidade})` : ''}</td><td style={{ ...tdSt, textAlign: 'right' }}>{fmtBRL(resumo.devolucoesAdquirente.total)}</td></tr>
                <tr><td style={{ ...tdSt, fontWeight: 700 }}>(=) Saldo contratual</td><td style={{ ...tdSt, textAlign: 'right', fontWeight: 700, color: PROJ }}>{fmtBRL(resumo.saldoContratual)}</td></tr>
                {resumo.saldoInformado && (
                  <>
                    <tr><td style={tdSt}>Saldo informado em {fmtData(resumo.saldoInformado.data)}<div style={{ fontSize: 11, color: '#6B7280' }}>{resumo.saldoInformado.fonte}</div></td><td style={{ ...tdSt, textAlign: 'right' }}>{fmtBRL(resumo.saldoInformado.valor)}</td></tr>
                    <tr><td style={{ ...tdSt, fontWeight: 600 }}>Diferença (calculado − informado)</td><td style={{ ...tdSt, textAlign: 'right', fontWeight: 700, color: Math.abs(Number(resumo.saldoContratual) - Number(resumo.saldoInformado.valor)) < 0.005 ? '#166534' : '#A32D2D' }}>{fmtBRL(Number(resumo.saldoContratual) - Number(resumo.saldoInformado.valor))}</td></tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div style={{ ...cardSt, padding: 16 }}>
        <div style={secTitle}>Créditos por mês e acumulado</div>
        <div style={{ height: 290 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={mensal} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="m" tick={{ fontSize: 11 }} tickFormatter={(v) => (Number(v) / 1000).toFixed(0) + 'k'} />
              <YAxis yAxisId="a" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => (Number(v) / 1000000).toFixed(1) + 'M'} />
              <Tooltip formatter={(v: any) => fmtBRL(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="m" dataKey="valor" name="Créditos no mês" fill={PROJ_ACCENT} radius={[4, 4, 0, 0]} />
              <Line yAxisId="a" type="monotone" dataKey="acumulado" name="Acumulado" stroke={PROJ} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{ ...cardSt, padding: 16 }}>
        <div style={secTitle}>Principais remetentes</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr><th style={thSt}>Remetente</th><th style={{ ...thSt, textAlign: 'right' }}>Créditos</th><th style={{ ...thSt, textAlign: 'right' }}>Total</th><th style={{ ...thSt, textAlign: 'right' }}>Participação</th></tr>
          </thead>
          <tbody>
            {remetentes.map((r) => (
              <tr key={r.nome}>
                <td style={tdSt}>{r.nome}</td>
                <td style={{ ...tdSt, textAlign: 'right' }}>{r.qtd}</td>
                <td style={{ ...tdSt, textAlign: 'right' }}>{fmtBRL(r.total)}</td>
                <td style={{ ...tdSt, textAlign: 'right' }}>{totalCreditos ? ((r.total / totalCreditos) * 100).toFixed(1) + '%' : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editandoOp && <EditarOperacaoModal operacao={operacao} onClose={() => setEditandoOp(false)} onFeito={() => { setEditandoOp(false); onAlterado(); }} />}
      {registrandoSaldo && <SaldoInformadoModal operacaoId={operacao.id} tipoInicial="CONTA_INDIVIDUAL" onClose={() => setRegistrandoSaldo(false)} onFeito={() => { setRegistrandoSaldo(false); setVersaoResumo((v) => v + 1); }} />}
      {editandoProj && <EditarProjetoModal projeto={projeto} onClose={() => setEditandoProj(false)} onFeito={() => { setEditandoProj(false); onAlterado(); }} />}
    </div>
  );
}

function EditarOperacaoModal({ operacao, onClose, onFeito }: { operacao: Operacao; onClose: () => void; onFeito: () => void }) {
  const [nome, setNome] = useState(operacao.nome);
  const [descricao, setDescricao] = useState((operacao as any).descricao || '');
  const [status, setStatus] = useState(operacao.status);
  const [dataBase, setDataBase] = useState(operacao.dataBase ? operacao.dataBase.slice(0, 10) : '');
  const [valor, setValor] = useState(valorParaTela(operacao.valorControle));
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valorNovo = normalizarValor(valor);
  const valorAntigo = normalizarValor(valorParaTela(operacao.valorControle));
  const critico = dataBase !== (operacao.dataBase ? operacao.dataBase.slice(0, 10) : '') || valorNovo !== valorAntigo;
  const valido = nome.trim().length >= 3 && (!critico || motivo.trim().length >= 10);
  const enviar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      await api.post(`/projects-cadastros/operacoes/${operacao.id}`, { nome: nome.trim(), descricao: descricao.trim(), status, dataBase: dataBase || null, valorControle: valorNovo || null, motivo: motivo.trim() });
      toast.success('Operação atualizada.');
      onFeito();
    } catch (e: any) { setErro(erroApi(e, 'Falha ao salvar.')); } finally { setEnviando(false); }
  };
  return (
    <ModalProjeto titulo="Editar operação" subtitulo={operacao.nome} onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Cancelar</BotaoSec><BotaoPri onClick={enviar} ativo={valido && !enviando}>{enviando ? 'Aguarde...' : 'Salvar'}</BotaoPri></>}>
      <ErroModal msg={erro} />
      <Secao titulo="IDENTIFICAÇÃO">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Campo rotulo="Nome *"><input style={inputModal} value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
          <Campo rotulo="Situação">
            <select style={inputModal} value={status} onChange={(e) => setStatus(e.target.value)}><option value="ATIVA">Ativa</option><option value="SUSPENSA">Suspensa</option><option value="ENCERRADA">Encerrada</option></select>
          </Campo>
          <Campo rotulo="Descrição" largo><textarea style={{ ...inputModal, minHeight: 56, resize: 'vertical' }} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Campo>
        </div>
      </Secao>
      <Secao titulo="CONFERÊNCIA">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Campo rotulo="Data-base"><SmartDateInput style={inputModal} value={dataBase} onChange={(v) => setDataBase(v)} /></Campo>
          <Campo rotulo="Valor de controle (R$)"><input style={inputModal} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex.: 3.495.791,15" /></Campo>
        </div>
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8 }}>A conferência do Painel compara os créditos até a data-base com o valor de controle. Alterar qualquer um dos dois exige motivo.</div>
      </Secao>
      {critico && (
        <Secao titulo="MOTIVO DA ALTERAÇÃO *">
          <textarea style={{ ...inputModal, minHeight: 64, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres. Ex.: planilha auditada em 10/2026." />
        </Secao>
      )}
    </ModalProjeto>
  );
}

function EditarProjetoModal({ projeto, onClose, onFeito }: { projeto: Projeto; onClose: () => void; onFeito: () => void }) {
  const [nome, setNome] = useState(projeto.nome);
  const [descricao, setDescricao] = useState(projeto.descricao || '');
  const [status, setStatus] = useState(projeto.status);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valido = nome.trim().length >= 3;
  const enviar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      await api.post(`/projects-cadastros/projetos/${projeto.id}`, { nome: nome.trim(), descricao: descricao.trim(), status });
      toast.success('Projeto atualizado.');
      onFeito();
    } catch (e: any) { setErro(erroApi(e, 'Falha ao salvar.')); } finally { setEnviando(false); }
  };
  return (
    <ModalProjeto titulo="Editar projeto" subtitulo={projeto.nome} onClose={onClose}
      rodape={<><BotaoSec onClick={onClose}>Cancelar</BotaoSec><BotaoPri onClick={enviar} ativo={valido && !enviando}>{enviando ? 'Aguarde...' : 'Salvar'}</BotaoPri></>}>
      <ErroModal msg={erro} />
      <Secao titulo="PROJETO">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Campo rotulo="Nome *"><input style={inputModal} value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
          <Campo rotulo="Situação">
            <select style={inputModal} value={status} onChange={(e) => setStatus(e.target.value)}><option value="ATIVO">Ativo</option><option value="SUSPENSO">Suspenso</option><option value="ENCERRADO">Encerrado</option></select>
          </Campo>
          <Campo rotulo="Descrição" largo><textarea style={{ ...inputModal, minHeight: 56, resize: 'vertical' }} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Campo>
        </div>
      </Secao>
    </ModalProjeto>
  );
}
