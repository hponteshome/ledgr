// frontend/src/pages/projects/workspace/FluxoContabilProjeto.tsx
// Fluxo contabil (06/10/2026), so o Master: regua de eventos numerados e quadros por empresa com os lancamentos propostos,
// valores pela trilha do LEDGR. Clicar num evento destaca os seus reflexos em todas as empresas. Nada e gravado no Contabil.
import React, { useEffect, useState } from 'react';
import api from '../../../services/api';
import { cardSt, erroSt, tituloSt, subtituloSt, fmtBRL, fmtData } from './projetoTema';
import ResgateRmModal from './ResgateRmModal';

const FAM: Record<string, [string, string]> = { origem: ['#EEEDFE', '#3C3489'], ancora: ['#E1F5EE', '#085041'], intercompany: ['#FAECE7', '#712B13'], resgate: ['#FAEEDA', '#633806'] };
const EMPRESAS: [string, string][] = [['F5', 'emissora · credora da RM'], ['SUNRISE', 'concedente da participação'], ['RM', 'Real Mouchão · fora do LEDGR (informativo)'], ['SUNSYS', 'recebedora'], ['HOTELSYS', 'beneficiária · devedora']];

export default function FluxoContabilProjeto({ projetoId }: { projetoId: string }) {
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [ativo, setAtivo] = useState<number | null>(null);
  const [resgate, setResgate] = useState(false);
  useEffect(() => {
    api.get(`/projects-relatorios/projetos/${projetoId}/fluxo-contabil`).then((r) => setD(r.data)).catch((e) => setErro(e?.response?.data?.message || 'Falha ao montar o fluxo.'));
  }, [projetoId]);
  if (erro) return <div style={erroSt}>⚠ {erro}</div>;
  if (!d) return <div style={{ color: '#6B7280' }}>Montando o fluxo...</div>;
  const famDe = (n: number) => d.eventos.find((e: any) => e.numero === n)?.familia || 'origem';
  const bola = (n: number) => { const [bg, fg] = FAM[famDe(n)]; return <span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: bg, color: fg, flexShrink: 0 }}>{n}</span>; };
  const tag = (txt: string, bg: string, fg: string) => <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '1px 7px', background: bg, color: fg, marginLeft: 6 }}>{txt}</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ ...tituloSt, flex: 1 }}>Fluxo contábil</div><button onClick={() => setResgate(true)} style={{ padding: '6px 12px', fontSize: 12, border: 'none', borderRadius: 7, background: '#1A4A3A', color: '#fff', cursor: 'pointer' }}>Resgates na F5 (prévia)</button>{resgate && <ResgateRmModal projetoId={projetoId} onClose={() => setResgate(false)} />}</div>
        <div style={subtituloSt}>Lançamentos propostos por empresa, com os valores da trilha em {fmtData(d.apuradoEm)} · roteiro para o contador · visível só para o Master</div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {d.eventos.map((e: any) => (
          <button key={e.numero} onClick={() => setAtivo(ativo === e.numero ? null : e.numero)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#fff', border: ativo === e.numero ? '1.5px solid #0F2747' : '0.5px solid #E5E7EB' }}>
            {bola(e.numero)}{e.titulo}{e.data ? <span style={{ color: '#6B7280', fontSize: 12 }}>· {fmtData(e.data)}</span> : null}{e.previsto ? tag('previsto', '#FEF3C7', '#78350F') : null}{e.quantidade ? <span style={{ color: '#6B7280', fontSize: 12 }}>· {e.quantidade}</span> : null}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, alignItems: 'start' }}>
        {EMPRESAS.map(([emp, papel]) => (
          <div key={emp} style={{ ...cardSt, padding: 14, background: emp === 'RM' ? '#FAFAF9' : '#fff' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0F2747' }}>{emp === 'RM' ? 'Real Mouchão' : emp}</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>{papel}</div>
            {d.lancamentos.filter((l: any) => l.empresa === emp).map((l: any, i: number) => (
              <div key={i} style={{ border: ativo === l.evento ? '1.5px solid #0F2747' : '0.5px solid #E5E7EB', borderRadius: 8, padding: '8px 10px', marginTop: 8, opacity: ativo && ativo !== l.evento ? 0.3 : 1, transition: 'opacity .15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {bola(l.evento)}
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{l.titulo}{l.previsto ? tag('previsto', '#FEF3C7', '#78350F') : null}{l.validar ? tag('a validar com o contador', '#FFF3DF', '#9A6A14') : null}</div>
                  {!l.semLancamento && <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtBRL(l.valor)}</div>}
                </div>
                {!l.semLancamento && <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}><b>D</b> {l.debito}<br /><b>C</b> {l.credito}</div>}
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{l.historico}</div>
              </div>
            ))}
            <div style={{ borderTop: '0.5px solid #E5E7EB', marginTop: 10, paddingTop: 8 }}>
              <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Saldos resultantes em {fmtData(d.apuradoEm)}</div>
              {(d.saldos[emp] || []).map((s: any) => (
                <div key={s.conta} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
                  <span>{s.conta}</span><span style={{ fontWeight: 600, color: s.saldo < 0 ? '#B45309' : '#111827' }}>{fmtBRL(s.saldo)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#6B7280' }}>Contas descritivas, a mapear para o plano de contas de cada empresa após a validação do contador. Os lançamentos da Real Mouchão são informativos (escrituração em Portugal, em euros, taxa histórica {String(d.taxaHistorica).replace('.', ',')}); a variação cambial de cada resgate será apurada no fechamento, com a taxa do BCE ou a PTAX.</div>
    </div>
  );
}
