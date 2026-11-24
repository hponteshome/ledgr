// frontend/src/components/finance/InvestRedemptionModal.tsx
// EXTINV-02 (23/11/2026): resgate de aplicação pelo extrato bancário. Lista as aplicações candidatas
// (GET .../lines/:lineId/invest-options), mostra a divisão calculada pelo CDI (editável: o extrato de
// investimentos do banco prevalece) e grava o destino INVEST_REDEMPTION. Padrão visual do APPayModal.
import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const FIN = '#1A4A3A';
const FIN_ACCENT = '#3DAA7A';
const FIN_LIGHT = '#E8F5EE';

type Deducao = { principal: number; rendimentoBruto: number; iof: number; ir: number; liquido: number; fator: number; dias: number; aliqIR: number; aliqIOF: number; cdiAte: string | null; cdiCompleto: boolean };
type Candidato = {
  investmentId: string; cdb: string; tipo: string; aplicacao: string; vencimento: string; indexador: string;
  saldoCapital: number; disponivel: number; porDocumento: boolean; deducao: Deducao | null; erro: string | null; cabe: boolean; contasOk: boolean;
};
type Opcoes = {
  linha: { id: string; lineNo: number | null; data: string; valor: number; description: string; bankRef: string | null };
  atual: { investmentId: string; split: any } | null; candidatos: Candidato[]; avisos: string[];
};
interface Props { statementId: string; lineId: string; onClose: () => void; onSaved: () => void }

const brl = (v?: number | null) => (v == null || !Number.isFinite(v) ? '-' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const dmy = (s?: string | null) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '-');
const num = (s: string) => { const t = String(s ?? '').trim(); if (!t) return NaN; return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); };
const txt = (v?: number | null) => (v == null ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const msgErro = (e: any, padrao: string) => { const m = e?.response?.data?.message; return Array.isArray(m) ? m.join(', ') : (m ?? padrao); };

const inputSt: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '0.5px solid #D1D5DB', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none', background: '#fff' };
const secao: React.CSSProperties = { background: FIN_LIGHT, borderRadius: 8, padding: '12px 14px', borderLeft: `3px solid ${FIN_ACCENT}` };
const titSecao: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: FIN, marginBottom: 10 };
const pill = (bg: string, fg: string): React.CSSProperties => ({ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: bg, color: fg, marginLeft: 6, whiteSpace: 'nowrap' });
const cel: React.CSSProperties = { padding: '6px 8px', fontSize: 12 };
const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 3 }}>{children}</div>;

export function InvestRedemptionModal({ statementId, lineId, onClose, onSaved }: Props) {
  const [op, setOp] = useState<Opcoes | null>(null);
  const [erro, setErro] = useState('');
  const [sel, setSel] = useState('');
  const [v, setV] = useState({ principal: '', rendimentoBruto: '', ir: '', iof: '' });
  const [editado, setEditado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const aplicar = (c?: Candidato, split?: any) => {
    const d = split ?? c?.deducao;
    setV({ principal: txt(d?.principal), rendimentoBruto: txt(d?.rendimentoBruto), ir: txt(d?.ir), iof: txt(d?.iof ?? (d ? 0 : null)) });
    setEditado(!!split && split.origem === 'MANUAL');
  };

  useEffect(() => {
    api.get(`/bank-import/statements/${statementId}/lines/${lineId}/invest-options`)
      .then(r => {
        const o: Opcoes = r.data;
        setOp(o);
        const cabem = o.candidatos.filter(c => c.cabe);
        const ini = o.atual?.investmentId
          ? o.candidatos.find(c => c.investmentId === o.atual!.investmentId)
          : o.candidatos.find(c => c.porDocumento) ?? (cabem.length === 1 ? cabem[0] : undefined);
        if (ini) { setSel(ini.investmentId); aplicar(ini, o.atual?.investmentId === ini.investmentId ? o.atual.split : undefined); }
      })
      .catch(e => setErro(msgErro(e, 'Não foi possível carregar as aplicações.')));
  }, [statementId, lineId]);

  const cand = op?.candidatos.find(c => c.investmentId === sel);
  const P = num(v.principal), B = num(v.rendimentoBruto), I = num(v.ir), F = num(v.iof || '0');
  const liquido = r2(B - I);
  const soma = r2(P + liquido);
  const valor = op?.linha.valor ?? 0;
  const problemas: string[] = [];
  if (op && !cand) problemas.push('Escolha a aplicação.');
  if (cand) {
    if (!cand.contasOk) problemas.push('A ficha desta aplicação está sem as contas (aplicação, receita e IRRF): complete na Renda Fixa.');
    if ([P, B, I].some(x => !Number.isFinite(x) || x < 0)) problemas.push('Informe principal, rendimento bruto e IR.');
    else {
      if (I > B) problemas.push('IR maior que o rendimento bruto.');
      if (Math.abs(soma - valor) > 0.01) problemas.push(`Principal + rendimento líquido = ${brl(soma)}, diferente do valor da linha (${brl(valor)}).`);
      if (P > cand.disponivel + 0.01) problemas.push(`Principal maior que o saldo disponível da aplicação (${brl(cand.disponivel)}).`);
    }
  }

  const confirmar = async () => {
    if (!cand || problemas.length) return;
    setSalvando(true); setErro('');
    try {
      await api.patch(`/bank-import/statements/${statementId}/lines`, {
        ids: [lineId], destination: 'INVEST_REDEMPTION', investmentId: cand.investmentId,
        ...(editado ? { split: { principal: P, rendimentoBruto: B, ir: I, iof: Number.isFinite(F) ? F : 0 } } : {}),
      });
      onSaved();
    } catch (e: any) { setErro(msgErro(e, 'Falha ao gravar o resgate.')); }
    setSalvando(false);
  };

  const campo = (k: keyof typeof v, rotulo: string) => (
    <div>
      <Label>{rotulo}</Label>
      <input style={{ ...inputSt, textAlign: 'right' }} value={v[k]} onChange={e => { const x = e.target.value; setV(p => ({ ...p, [k]: x })); setEditado(true); }} />
    </div>
  );
  const bloqueado = !cand || problemas.length > 0 || salvando;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 880, maxWidth: '96vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ background: FIN, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Resgate de investimento</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {op ? `Linha ${op.linha.lineNo ?? '-'} · ${dmy(op.linha.data)} · R$ ${brl(op.linha.valor)} · ${op.linha.description}` : 'Carregando...'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>{'×'}</button>
        </div>

        <div style={{ padding: 18, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {erro && <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>{erro}</div>}
          {op?.avisos.map((a, i) => <div key={i} style={{ background: '#FEFCE8', color: '#854D0E', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>{a}</div>)}

          {op && (
            <div style={secao}>
              <div style={titSecao}>APLICAÇÃO</div>
              {op.candidatos.length === 0 ? (
                <div style={{ fontSize: 12 }}>Nenhuma aplicação ativa feita antes desta data.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 6 }}>
                  <thead>
                    <tr>{['', 'Aplicação', 'Aplicada em', 'Indexador', 'Disponível', 'Principal calculado', ''].map((h, i) => (
                      <th key={i} style={{ ...cel, fontSize: 11, color: FIN, textAlign: i === 4 || i === 5 ? 'right' : 'left' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {op.candidatos.map(c => (
                      <tr key={c.investmentId} onClick={() => { setSel(c.investmentId); aplicar(c); }}
                        style={{ cursor: 'pointer', background: sel === c.investmentId ? FIN_LIGHT : undefined, borderTop: '0.5px solid #F0F0F0', opacity: c.cabe || sel === c.investmentId ? 1 : 0.55 }}>
                        <td style={cel}><input type="radio" readOnly checked={sel === c.investmentId} /></td>
                        <td style={cel}>{c.tipo} {c.cdb}{c.porDocumento && <span style={pill('#F5F3FF', '#6D28D9')}>pelo documento</span>}</td>
                        <td style={cel}>{dmy(c.aplicacao)}</td>
                        <td style={cel}>{c.indexador}</td>
                        <td style={{ ...cel, textAlign: 'right' }}>{brl(c.disponivel)}</td>
                        <td style={{ ...cel, textAlign: 'right' }}>{c.deducao ? brl(c.deducao.principal) : <span style={{ color: '#A32D2D', fontSize: 11 }}>{c.erro ?? '-'}</span>}</td>
                        <td style={cel}>
                          {c.cabe ? <span style={pill('#F0FDF4', '#15803D')}>cabe</span> : c.deducao ? <span style={pill('#FCEBEB', '#A32D2D')}>não cabe</span> : null}
                          {!c.contasOk && <span style={pill('#FCEBEB', '#A32D2D')}>sem contas</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {cand && (
            <div style={secao}>
              <div style={titSecao}>
                DIVISÃO DO VALOR RECEBIDO{' '}
                {editado ? <span style={{ fontWeight: 400, color: '#854D0E' }}>(valores informados)</span>
                  : cand.deducao ? <span style={{ fontWeight: 400, color: '#6B7280' }}>(calculado pelo CDI)</span> : null}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {campo('principal', 'Principal')}
                {campo('rendimentoBruto', 'Rendimento bruto (base do IR)')}
                {campo('ir', 'IR retido')}
                {campo('iof', 'IOF (informativo)')}
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end', fontSize: 12, marginTop: 10 }}>
                <div>Rendimento líquido<br /><b>{brl(liquido)}</b></div>
                <div>Principal + líquido<br /><b style={{ color: Math.abs(soma - valor) <= 0.01 ? '#15803D' : '#A32D2D' }}>{brl(soma)}</b></div>
                <div>Valor da linha<br /><b>{brl(valor)}</b></div>
                {cand.deducao && (
                  <div style={{ color: '#6B7280' }}>
                    Fator {cand.deducao.fator.toFixed(6)} · {cand.deducao.dias} dias · IR {(cand.deducao.aliqIR * 100).toFixed(1)}%
                    {cand.deducao.aliqIOF ? ` · IOF ${(cand.deducao.aliqIOF * 100).toFixed(0)}%` : ''} · CDI até {dmy(cand.deducao.cdiAte)}
                  </div>
                )}
                {editado && cand.deducao && (
                  <button onClick={() => aplicar(cand)} style={{ background: 'none', border: 'none', color: FIN, textDecoration: 'underline', cursor: 'pointer', fontSize: 12, padding: 0 }}>voltar ao cálculo</button>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8 }}>Os valores do extrato de investimentos do banco prevalecem: se forem diferentes, edite aqui.</div>
            </div>
          )}

          {cand && problemas.length === 0 && (
            <div style={secao}>
              <div style={titSecao}>LANÇAMENTO QUE SERÁ GERADO</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 6 }}>
                <tbody>
                  <tr><td style={{ ...cel, width: 24 }}>D</td><td style={cel}>Conta contábil do banco</td><td style={{ ...cel, textAlign: 'right' }}>{brl(valor)}</td></tr>
                  {I > 0 && <tr><td style={cel}>D</td><td style={cel}>IRRF a recuperar</td><td style={{ ...cel, textAlign: 'right' }}>{brl(I)}</td></tr>}
                  <tr><td style={cel}>C</td><td style={cel}>{cand.tipo} {cand.cdb} (principal)</td><td style={{ ...cel, textAlign: 'right' }}>{brl(P)}</td></tr>
                  {B > 0 && <tr><td style={cel}>C</td><td style={cel}>Receita financeira (rendimento bruto)</td><td style={{ ...cel, textAlign: 'right' }}>{brl(B)}</td></tr>}
                </tbody>
              </table>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6 }}>Ao gerar os lançamentos (Contabilizar), o resgate também é gravado na ficha da aplicação (Renda Fixa).</div>
            </div>
          )}

          {cand && problemas.length > 0 && (
            <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>
              {problemas.map((p, i) => <div key={i}>{p}</div>)}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 18px', background: '#FAFAFA', borderTop: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ background: '#fff', color: '#374151', border: '0.5px solid #D1D5DB', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
          <button disabled={bloqueado} onClick={confirmar}
            style={{ background: FIN, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 500, cursor: bloqueado ? 'not-allowed' : 'pointer', opacity: bloqueado ? 0.5 : 1 }}>
            {salvando ? 'Gravando...' : 'Confirmar resgate'}
          </button>
        </div>
      </div>
    </div>
  );
}
