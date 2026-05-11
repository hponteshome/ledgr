// frontend/src/pages/finance/FechamentoPage.tsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Swal from 'sweetalert2';

const fmtBRL = (v: any) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_FECHAMENTO: Record<string, { bg: string; color: string; label: string; icon: string }> = {
  ABERTO:        { bg: '#F9FAFB', color: '#6B7280', label: 'Em aberto',     icon: '🔓' },
  EM_FECHAMENTO: { bg: '#FEFCE8', color: '#854D0E', label: 'Em fechamento', icon: '⏳' },
  FECHADO:       { bg: '#F0FDF4', color: '#15803D', label: 'Fechado',       icon: '🔒' },
  REABERTO:      { bg: '#FFF7ED', color: '#C2410C', label: 'Reaberto',      icon: '⚠️' },
};

const STATUS_ITEM: Record<string, { bg: string; color: string; label: string }> = {
  PENDENTE:  { bg: '#FEFCE8', color: '#854D0E', label: 'Pendente' },
  CONFERIDO: { bg: '#F0FDF4', color: '#15803D', label: 'Conferido' },
  GERADO:    { bg: '#EFF6FF', color: '#1D4ED8', label: 'Gerado' },
  IGNORADO:  { bg: '#F9FAFB', color: '#9CA3AF', label: 'Ignorado' },
};

const MODULO_LABEL: Record<string, string> = {
  PROVISOES:  'Provisões Recorrentes',
  PRO_LABORE: 'Pró-labore de Diretoria',
  RENDA_FIXA: 'Renda Fixa (CDB/Investimentos)',
  DEPRECIACAO:'Depreciação do Ativo Imobilizado',
  PIS_COFINS: 'PIS e COFINS',
  IRPJ_CSLL:  'IRPJ e CSLL',
};

const MODULO_COLOR: Record<string, string> = {
  PROVISOES:  '#0369A1',
  PRO_LABORE: '#0891B2',
  RENDA_FIXA: '#2563EB',
  DEPRECIACAO:'#EA580C',
  PIS_COFINS: '#7C3AED',
  IRPJ_CSLL:  '#0F766E',
};

const S = {
  page:  { padding: 24, background: '#F9FAFB', minHeight: '100vh' },
  card:  { background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: '16px 20px', marginBottom: 16 },
  badge: { display: 'inline-flex' as const, alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: '#F0F9FF', color: '#0369A1' },
  h1:    { fontSize: 18, fontWeight: 500, color: '#111' },
  btn:   { height: 30, border: '0.5px solid #D1D5DB', borderRadius: 6, padding: '0 14px', fontSize: 12, cursor: 'pointer', background: '#fff', color: '#374151' },
  btnP:  { height: 30, border: 'none', borderRadius: 6, padding: '0 14px', fontSize: 12, cursor: 'pointer', background: '#111', color: '#fff' },
  input: { height: 32, border: '0.5px solid #E5E7EB', borderRadius: 6, padding: '0 9px', fontSize: 12, width: '100%', boxSizing: 'border-box' as const },
  th:    { background: '#F9FAFB', color: '#6B7280', fontSize: 10, textTransform: 'uppercase' as const, padding: '8px 12px', borderBottom: '0.5px solid #E5E7EB', textAlign: 'left' as const },
  thR:   { background: '#F9FAFB', color: '#6B7280', fontSize: 10, textTransform: 'uppercase' as const, padding: '8px 12px', borderBottom: '0.5px solid #E5E7EB', textAlign: 'right' as const },
  td:    { padding: '10px 12px', borderBottom: '0.5px solid #F5F5F5', fontSize: 12, color: '#374151' },
  tdR:   { padding: '10px 12px', borderBottom: '0.5px solid #F5F5F5', fontSize: 12, color: '#374151', textAlign: 'right' as const },
};

// Modal de conferencia de item
function ConferirModal({ item, onClose, onSaved }: { item: any; onClose: () => void; onSaved: () => void }) {
  const [valor, setValor] = useState(String(item.valorConfirmado ?? item.valorCalculado));
  const [obs, setObs] = useState(item.obs && !item.obs.startsWith('{') ? item.obs : '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/finance/fechamento/itens/' + item.id + '/conferir', {
        valorConfirmado: parseFloat(valor),
        obs,
      });
      onSaved();
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Erro', text: e?.response?.data?.message ?? 'Erro ao conferir' });
    }
    setSaving(false);
  };

  // Detalhe do calculo se disponivel
  let detalhe = null;
  try { detalhe = JSON.parse(item.obs); } catch {}

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>Conferir — {MODULO_LABEL[item.modulo]}</span>
          <button style={{ ...S.btn, padding: '0 8px' }} onClick={onClose}>x</button>
        </div>
        <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>{item.descricao}</p>

        {detalhe && (
          <div style={{ background: '#F9FAFB', border: '0.5px solid #E5E7EB', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
            {Object.entries(detalhe).map(([k, v]: any) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#6B7280' }}>{k}</span>
                <span style={{ fontWeight: 500 }}>R$ {fmtBRL(v)}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 10, textTransform: 'uppercase' as const, color: '#6B7280', display: 'block', marginBottom: 3 }}>Valor calculado</label>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#374151' }}>R$ {fmtBRL(item.valorCalculado)}</div>
          </div>
          <div>
            <label style={{ fontSize: 10, textTransform: 'uppercase' as const, color: '#6B7280', display: 'block', marginBottom: 3 }}>Valor confirmado *</label>
            <input style={{ ...S.input, fontSize: 15, fontWeight: 500 }} type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 10, textTransform: 'uppercase' as const, color: '#6B7280', display: 'block', marginBottom: 3 }}>Observação</label>
            <input style={S.input} value={obs} onChange={e => setObs(e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={S.btn} onClick={onClose}>Cancelar</button>
          <button style={{ ...S.btnP, background: '#15803D' }} onClick={save} disabled={saving}>
            {saving ? 'Salvando...' : '✓ Conferido'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal de reabertura
function ReabrirModal({ competencia, onClose, onSaved }: { competencia: string; onClose: () => void; onSaved: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const reabrir = async () => {
    if (!motivo.trim()) { Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Informe o motivo da reabertura.' }); return; }
    setSaving(true);
    try {
      const r = await api.post('/finance/fechamento/' + competencia + '/reabrir', { motivo });
      Swal.fire({ icon: 'success', title: 'Reaberto', text: r.data.message });
      onSaved();
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Erro', text: e?.response?.data?.message ?? 'Erro' });
    }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>Reabrir Competência {competencia}</span>
          <button style={{ ...S.btn, padding: '0 8px' }} onClick={onClose}>x</button>
        </div>
        <div style={{ background: '#FFF7ED', border: '0.5px solid #FED7AA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#C2410C' }}>
          ⚠️ A reabertura será registrada na auditoria. Meses posteriores fechados também serão reabertos automaticamente.
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 10, textTransform: 'uppercase' as const, color: '#6B7280', display: 'block', marginBottom: 3 }}>Motivo da reabertura *</label>
          <input style={S.input} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Descreva o motivo..." />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={S.btn} onClick={onClose}>Cancelar</button>
          <button style={{ ...S.btnP, background: '#C2410C' }} onClick={reabrir} disabled={saving}>{saving ? 'Reabrindo...' : 'Reabrir'}</button>
        </div>
      </div>
    </div>
  );
}

export default function FechamentoPage() {
  const [competencia, setCompetencia] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [fechamento, setFechamento] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [conferirItem, setConferirItem] = useState<any>(null);
  const [showReabrir, setShowReabrir] = useState(false);
  const [tab, setTab] = useState<'atual' | 'historico'>('atual');

  const loadFechamento = async () => {
    try {
      const r = await api.get('/finance/fechamento/' + competencia);
      setFechamento(r.data);
    } catch { setFechamento(null); }
  };

  const loadHistorico = async () => {
    try {
      const r = await api.get('/finance/fechamento');
      setHistorico(r.data ?? []);
    } catch {}
  };

  useEffect(() => { loadFechamento(); }, [competencia]);
  useEffect(() => { if (tab === 'historico') loadHistorico(); }, [tab]);

  const calcular = async () => {
    setCalculando(true);
    try {
      const r = await api.post('/finance/fechamento/' + competencia + '/calcular');
      setFechamento(r.data);
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Erro', text: e?.response?.data?.message ?? 'Erro ao calcular' });
    }
    setCalculando(false);
  };

  const ignorarItem = async (id: string) => {
    await api.put('/finance/fechamento/itens/' + id + '/ignorar');
    loadFechamento();
  };

  const fecharMes = async () => {
    const pendentes = fechamento?.itens?.filter((i: any) => i.status === 'PENDENTE') ?? [];
    if (pendentes.length > 0) {
      Swal.fire({ icon: 'warning', title: 'Itens pendentes', text: `Existem ${pendentes.length} item(ns) ainda pendentes de conferência.` });
      return;
    }
    const r = await Swal.fire({
      icon: 'question', title: 'Fechar competência?',
      text: `Confirma o fechamento de ${competencia}? Lançamentos serão bloqueados.`,
      showCancelButton: true,
      confirmButtonText: 'Fechar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#111111',
      cancelButtonColor: '#6B7280',
    });
    if (!r.isConfirmed) return;
    setLoading(true);
    try {
      const res = await api.post('/finance/fechamento/' + competencia + '/fechar');
      Swal.fire({ icon: 'success', title: 'Fechado!', text: res.data.message });
      loadFechamento();
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Erro', text: e?.response?.data?.message ?? 'Erro' });
    }
    setLoading(false);
  };

  const stFech = fechamento ? (STATUS_FECHAMENTO[fechamento.status] ?? STATUS_FECHAMENTO.ABERTO) : null;
  const isFechado = fechamento?.status === 'FECHADO';
  const totalCalculado = fechamento?.itens?.reduce((s: number, i: any) => s + Number(i.valorCalculado), 0) ?? 0;
  const totalConfirmado = fechamento?.itens?.filter((i: any) => i.valorConfirmado).reduce((s: number, i: any) => s + Number(i.valorConfirmado), 0) ?? 0;
  const pendentes = fechamento?.itens?.filter((i: any) => i.status === 'PENDENTE').length ?? 0;
  const conferidos = fechamento?.itens?.filter((i: any) => i.status === 'CONFERIDO').length ?? 0;

  const tabStyle = (t: string) => ({ height: 30, border: `0.5px solid ${tab === t ? '#111' : '#D1D5DB'}`, borderRadius: 6, padding: '0 14px', fontSize: 12, cursor: 'pointer', background: tab === t ? '#111' : '#fff', color: tab === t ? '#fff' : '#374151' });

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={S.badge}>◆ Finance</span>
        <span style={S.h1}>Fechamento Mensal</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button style={tabStyle('atual')} onClick={() => setTab('atual')}>Competência atual</button>
          <button style={tabStyle('historico')} onClick={() => setTab('historico')}>Histórico</button>
        </div>
      </div>

      {tab === 'atual' && (
        <>
          {/* Controles */}
          <div style={S.card}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' as const }}>
              <div>
                <label style={{ fontSize: 10, textTransform: 'uppercase' as const, color: '#6B7280', display: 'block', marginBottom: 3 }}>Competência</label>
                <input style={{ ...S.input, width: 160 }} type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} />
              </div>
              {stFech && (
                <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: stFech.bg, color: stFech.color }}>
                  {stFech.icon} {stFech.label}
                </span>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button style={S.btn} onClick={calcular} disabled={calculando || isFechado}>
                  {calculando ? 'Calculando...' : '⟳ Calcular/Recalcular'}
                </button>
                {!isFechado && (
                  <button style={{ ...S.btnP, background: '#15803D' }} onClick={fecharMes} disabled={loading || pendentes > 0}>
                    🔒 Fechar mês
                  </button>
                )}
                {isFechado && (
                  <button style={{ ...S.btnP, background: '#C2410C' }} onClick={() => setShowReabrir(true)}>
                    ⚠️ Reabrir
                  </button>
                )}
              </div>
            </div>

            {fechamento?.itens?.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '0.5px solid #E5E7EB' }}>
                <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' as const, marginBottom: 4 }}>Total calculado</div>
                  <div style={{ fontSize: 16, fontWeight: 500 }}>R$ {fmtBRL(totalCalculado)}</div>
                </div>
                <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' as const, marginBottom: 4 }}>Total confirmado</div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: '#15803D' }}>R$ {fmtBRL(totalConfirmado)}</div>
                </div>
                <div style={{ background: '#FEFCE8', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' as const, marginBottom: 4 }}>Pendentes</div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: pendentes > 0 ? '#854D0E' : '#15803D' }}>{pendentes}</div>
                </div>
                <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' as const, marginBottom: 4 }}>Conferidos</div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: '#1D4ED8' }}>{conferidos}</div>
                </div>
              </div>
            )}
          </div>

          {/* Itens */}
          {!fechamento?.itens?.length ? (
            <div style={{ ...S.card, textAlign: 'center' as const, padding: '40px 20px' }}>
              <p style={{ fontSize: 13, color: '#9CA3AF' }}>Clique em "Calcular/Recalcular" para gerar os itens de fechamento.</p>
            </div>
          ) : (
            <div style={S.card}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={S.th}>Módulo</th>
                  <th style={S.th}>Descrição</th>
                  <th style={S.thR}>Calculado</th>
                  <th style={S.thR}>Confirmado</th>
                  <th style={S.th}>Status</th>
                  <th style={S.th}></th>
                </tr></thead>
                <tbody>
                  {fechamento.itens.map((item: any) => {
                    const st = STATUS_ITEM[item.status] ?? STATUS_ITEM.PENDENTE;
                    const cor = MODULO_COLOR[item.modulo] ?? '#374151';
                    return (
                      <tr key={item.id} style={{ background: item.status === 'IGNORADO' ? '#F9FAFB' : '#fff' }}>
                        <td style={S.td}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: cor + '15', color: cor }}>
                            {item.modulo}
                          </span>
                        </td>
                        <td style={{ ...S.td, maxWidth: 320, fontSize: 11, color: '#6B7280' }}>{item.descricao}</td>
                        <td style={{ ...S.tdR, fontWeight: 500 }}>R$ {fmtBRL(item.valorCalculado)}</td>
                        <td style={{ ...S.tdR, color: '#15803D' }}>
                          {item.valorConfirmado ? `R$ ${fmtBRL(item.valorConfirmado)}` : '—'}
                        </td>
                        <td style={S.td}>
                          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </td>
                        <td style={S.td}>
                          {!isFechado && item.status !== 'GERADO' && item.status !== 'IGNORADO' && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button style={{ ...S.btn, fontSize: 11, background: '#F0FDF4', color: '#15803D', borderColor: '#86EFAC' }}
                                onClick={() => setConferirItem(item)}>
                                ✓ Conferir
                              </button>
                              <button style={{ ...S.btn, fontSize: 11, color: '#9CA3AF' }}
                                onClick={() => ignorarItem(item.id)}>
                                Ignorar
                              </button>
                            </div>
                          )}
                          {item.status === 'CONFERIDO' && !isFechado && (
                            <button style={{ ...S.btn, fontSize: 11 }} onClick={() => setConferirItem(item)}>Editar</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'historico' && (
        <div style={S.card}>
          {historico.length === 0
            ? <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Nenhum fechamento registrado.</p>
            : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={S.th}>Competência</th>
                  <th style={S.th}>Status</th>
                  <th style={S.th}>Fechado em</th>
                  <th style={S.th}>Reaberto em</th>
                  <th style={S.th}>Motivo</th>
                  <th style={S.thR}>Itens</th>
                </tr></thead>
                <tbody>
                  {historico.map((h: any) => {
                    const st = STATUS_FECHAMENTO[h.status] ?? STATUS_FECHAMENTO.ABERTO;
                    return (
                      <tr key={h.id}>
                        <td style={{ ...S.td, fontWeight: 500, cursor: 'pointer', color: '#0369A1' }}
                          onClick={() => { setCompetencia(h.competencia); setTab('atual'); }}>
                          {h.competencia}
                        </td>
                        <td style={S.td}>
                          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: st.bg, color: st.color }}>
                            {st.icon} {st.label}
                          </span>
                        </td>
                        <td style={S.td}>{h.fechadoEm ? new Date(h.fechadoEm).toLocaleDateString('pt-BR') : '—'}</td>
                        <td style={S.td}>{h.reabertoEm ? new Date(h.reabertoEm).toLocaleDateString('pt-BR') : '—'}</td>
                        <td style={{ ...S.td, fontSize: 11, color: '#6B7280' }}>{h.motivoReabertura ?? '—'}</td>
                        <td style={S.tdR}>{h.itens?.length ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          }
        </div>
      )}

      {conferirItem && (
        <ConferirModal
          item={conferirItem}
          onClose={() => setConferirItem(null)}
          onSaved={() => { setConferirItem(null); loadFechamento(); }}
        />
      )}

      {showReabrir && (
        <ReabrirModal
          competencia={competencia}
          onClose={() => setShowReabrir(false)}
          onSaved={() => { setShowReabrir(false); loadFechamento(); }}
        />
      )}
    </div>
  );
}
