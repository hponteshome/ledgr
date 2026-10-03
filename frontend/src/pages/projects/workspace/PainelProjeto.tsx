// frontend/src/pages/projects/workspace/PainelProjeto.tsx
// D8 (03/10/2026): painel da operacao - conferencia com o valor de controle, pendencias, evolucao mensal e remetentes.
import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import api from '../../../services/api';
import { PROJ, PROJ_ACCENT, Operacao, Projeto, Credito, fmtBRL, fmtData, cardSt, thSt, tdSt, erroSt, secTitle, tituloSt, subtituloSt } from './projetoTema';

interface Resumo {
  quantidadeCreditos: number; totalGeral: string; quantidadeAteDataBase: number; totalAteDataBase: string;
  valorControle: string | null; diferencaControle: string | null; conferido: boolean | null; pendentesIdentificacao: number;
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

export default function PainelProjeto({ projeto, operacao }: { projeto: Projeto; operacao: Operacao | null }) {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!operacao) return;
    setErro('');
    Promise.all([api.get(`/projects/operacoes/${operacao.id}/resumo`), api.get(`/projects/operacoes/${operacao.id}/creditos`)])
      .then(([r, c]) => { setResumo(r.data); setCreditos(c.data || []); })
      .catch((e) => setErro(e?.response?.data?.message || 'Falha ao carregar o painel.'));
  }, [operacao]);

  const mensal = useMemo(() => {
    const m = new Map<string, number>();
    creditos.forEach((c) => { const k = c.dataCredito.slice(0, 7); m.set(k, (m.get(k) || 0) + Number(c.valor)); });
    let acum = 0;
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => {
      acum += v;
      const [a, mm] = k.split('-');
      return { mes: `${mm}/${a.slice(2)}`, valor: Number(v.toFixed(2)), acumulado: Number(acum.toFixed(2)) };
    });
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
      <div>
        <div style={tituloSt}>{operacao.nome}</div>
        <div style={subtituloSt}>{projeto.nome} · data-base {fmtData(operacao.dataBase)}</div>
      </div>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      {resumo && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <Kpi titulo="Créditos até a data-base" valor={fmtBRL(resumo.totalAteDataBase)} detalhe={`${resumo.quantidadeAteDataBase} créditos`} />
          <Kpi
            titulo="Valor de controle"
            valor={fmtBRL(resumo.valorControle)}
            detalhe={resumo.conferido === null ? 'sem valor de controle' : resumo.conferido ? 'Conferido com os créditos' : `Diferença de ${fmtBRL(resumo.diferencaControle)}`}
            cor={resumo.conferido === false ? '#A32D2D' : undefined}
          />
          <Kpi
            titulo="Pendências de identificação"
            valor={String(resumo.pendentesIdentificacao)}
            detalhe="créditos sem remetente identificado"
            cor={resumo.pendentesIdentificacao > 0 ? '#B45309' : '#166534'}
          />
          <Kpi titulo="Total geral de créditos" valor={fmtBRL(resumo.totalGeral)} detalhe={`${resumo.quantidadeCreditos} créditos em todas as datas`} />
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
    </div>
  );
}
