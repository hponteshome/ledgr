// frontend/src/pages/projects/workspace/VisaoExecutiva.tsx
// Fase 1.13 (04/10/2026): visao executiva no topo do Painel - indicadores consolidados, pendencias por gravidade
// (cada uma leva a tela onde se resolve), aplicacoes por natureza e documentos vigentes.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { Operacao, fmtBRL, cardSt, tdSt, secTitle } from './projetoTema';

interface Pend { nivel: 'CRITICA' | 'ATENCAO'; titulo: string; detalhe: string; destino: string; }
interface Exec {
  totais: { vinculados: string; aplicacoes: string; devolucoes: string; saldoContratual: string; intercompanyEsperado: string };
  novosCreditos: { quantidade: number; total: string };
  aplicacoesPorNatureza: { nome: string; tipo: string; quantidade: number; total: string }[];
  documentos: { vigentes: number; porTipo: { nome: string; quantidade: number }[] };
  pendencias: Pend[];
}

export default function VisaoExecutiva({ operacao, versao }: { operacao: Operacao | null; versao: number }) {
  const [d, setD] = useState<Exec | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (!operacao) return;
    api.get(`/projects-relatorios/operacoes/${operacao.id}/painel-executivo`).then((r) => setD(r.data)).catch(() => setD(null));
  }, [operacao, versao]);
  if (!d) return null;
  const criticas = d.pendencias.filter((p) => p.nivel === 'CRITICA').length;
  const kpi = (titulo: string, valor: string, detalhe: string, cor?: string) => (
    <div style={{ ...cardSt, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{titulo}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: cor || '#111827', marginTop: 4 }}>{valor}</div>
      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{detalhe}</div>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        {kpi('Saldo contratual', fmtBRL(d.totais.saldoContratual), `vinculados ${fmtBRL(d.totais.vinculados)} − devoluções ${fmtBRL(d.totais.devolucoes)}`, '#134E4A')}
        {kpi('Intercompany esperado', fmtBRL(d.totais.intercompanyEsperado), 'o que a recebedora deve à beneficiária')}
        {kpi('Total aplicado', fmtBRL(d.totais.aplicacoes), 'por conta da beneficiária')}
        {kpi('Novos créditos', fmtBRL(d.novosCreditos.total), `${d.novosCreditos.quantidade} após a data-base`)}
      </div>
      <div style={{ ...cardSt, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ ...secTitle, flex: 1, marginBottom: 0 }}>Pendências</div>
          {d.pendencias.length > 0 && <span style={{ fontSize: 12, color: '#6B7280' }}>{criticas} crítica(s) · {d.pendencias.length - criticas} de atenção</span>}
        </div>
        {d.pendencias.length === 0
          ? <div style={{ fontSize: 13, color: '#166534', background: '#DCFCE7', borderRadius: 8, padding: '10px 14px' }}>Nenhuma pendência: tudo conferido.</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {d.pendencias.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 8, background: p.nivel === 'CRITICA' ? '#FEF2F2' : '#FFFBEB', borderLeft: `3px solid ${p.nivel === 'CRITICA' ? '#DC2626' : '#D97706'}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{p.titulo}</div>
                    <div style={{ fontSize: 12, color: '#4B5563' }}>{p.detalhe}</div>
                  </div>
                  {p.destino && <button onClick={() => navigate(p.destino)} style={{ padding: '4px 12px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#134E4A', cursor: 'pointer' }}>Abrir</button>}
                </div>
              ))}
            </div>
          )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <div style={{ ...cardSt, padding: 16 }}>
          <div style={secTitle}>Aplicações por natureza</div>
          {d.aplicacoesPorNatureza.length === 0
            ? <div style={{ fontSize: 13, color: '#9CA3AF' }}>Nenhuma aplicação classificada ainda.</div>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {d.aplicacoesPorNatureza.map((n) => (
                    <tr key={n.nome}>
                      <td style={tdSt}>{n.nome}{n.tipo === 'DEVOLUCAO' && <span style={{ marginLeft: 6, fontSize: 10, color: '#92400E', background: '#FEF3C7', borderRadius: 999, padding: '1px 6px' }}>Conta Individual</span>}</td>
                      <td style={{ ...tdSt, textAlign: 'right', color: '#6B7280' }}>{n.quantidade}</td>
                      <td style={{ ...tdSt, textAlign: 'right', fontWeight: 600 }}>{fmtBRL(n.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
        <div style={{ ...cardSt, padding: 16 }}>
          <div style={secTitle}>Documentos vigentes ({d.documentos.vigentes})</div>
          {d.documentos.porTipo.length === 0
            ? <div style={{ fontSize: 13, color: '#9CA3AF' }}>Nenhum documento enviado.</div>
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{d.documentos.porTipo.map((t) => <span key={t.nome} style={{ fontSize: 12, background: '#F0FDFA', color: '#134E4A', border: '0.5px solid #99F6E4', borderRadius: 999, padding: '3px 10px' }}>{t.nome}: <b>{t.quantidade}</b></span>)}</div>}
        </div>
      </div>
    </div>
  );
}
