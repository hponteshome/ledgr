// frontend/src/pages/accounting/investments/EquityMethodPage.tsx
import React, { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FiPlus, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import api from '../../../services/api';
import { useCompany } from '../../../contexts/CompanyContext';

interface Investment {
  id: string;
  percentOwned: string;
  initialCost: string;
  acquisitionDate: string;
  investeeCompany: { id: string; legalName: string; tradeName: string; taxId: string };
  investmentAccount: { id: string; code: string; name: string };
  gainAccount: { id: string; code: string; name: string };
  lossAccount: { id: string; code: string; name: string };
}

interface CalculoPreview {
  investment: Investment;
  referenceDate: string;
  investeeYear: number;
  investeeYearClosed: boolean;
  investeePl: number;
  percentApplied: number;
  equityValue: number;
  previousBookValue: number;
  adjustment: number;
}

const fmtNum = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + '%';

const EquityMethodPage: React.FC = () => {
  const { activeCompany, companies } = useCompany();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Investment | null>(null);

  const [fInveteeId, setFInveteeId] = useState('');
  const [fPercent, setFPercent] = useState('');
  const [fInvestAccount, setFInvestAccount] = useState('');
  const [fGainAccount, setFGainAccount] = useState('');
  const [fLossAccount, setFLossAccount] = useState('');
  const [fCost, setFCost] = useState('');
  const [fDate, setFDate] = useState('');
  const [saving, setSaving] = useState(false);

  const [refDate, setRefDate] = useState('');
  const [preview, setPreview] = useState<CalculoPreview | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [lancando, setLancando] = useState(false);
  const [historico, setHistorico] = useState<any[]>([]);
  const [revertendo, setRevertendo] = useState<string | null>(null);
  const [sugestaoForm, setSugestaoForm] = useState<{ found: boolean; percentOwned: number | null; holderName: string | null } | null>(null);
  const [sugestaoSelecionado, setSugestaoSelecionado] = useState<{ found: boolean; percentOwned: number | null; holderName: string | null } | null>(null);
  const [atualizandoPercentual, setAtualizandoPercentual] = useState(false);

  const carregar = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    try {
      const r = await api.get('/accounting/equity-method');
      setInvestments(r.data || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao carregar participações.');
    } finally { setLoading(false); }
  }, [activeCompany]);

  useEffect(() => { carregar(); }, [carregar]);

  const carregarHistorico = useCallback(async (investmentId: string) => {
    try {
      const r = await api.get(`/accounting/equity-method/${investmentId}/historico`);
      setHistorico(r.data || []);
    } catch { setHistorico([]); }
  }, []);

  // Sugere o % com base no Livro de Registro de Socios (ShareholderRecord) da
  // investida - nunca sobrescreve nada sozinho, so devolve a sugestao.
  const buscarSugestaoPercentual = useCallback(async (investeeCompanyId: string) => {
    try {
      const r = await api.get('/accounting/equity-method/percentual-sugerido', { params: { investeeCompanyId } });
      return r.data as { found: boolean; percentOwned: number | null; holderName: string | null };
    } catch { return null; }
  }, []);

  useEffect(() => {
    if (!fInveteeId) { setSugestaoForm(null); return; }
    let ativo = true;
    buscarSugestaoPercentual(fInveteeId).then(sug => {
      if (!ativo || !sug) return;
      setSugestaoForm(sug);
      if (sug.found && sug.percentOwned !== null && !fPercent) {
        setFPercent(sug.percentOwned.toString().replace('.', ','));
      }
    });
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fInveteeId]);

  const selecionar = (inv: Investment) => {
    setSelected(inv);
    setPreview(null);
    setRefDate('');
    setSugestaoSelecionado(null);
    carregarHistorico(inv.id);
    buscarSugestaoPercentual(inv.investeeCompany.id).then(sug => { if (sug) setSugestaoSelecionado(sug); });
  };

  const handleAtualizarPercentual = async () => {
    if (!selected || !sugestaoSelecionado?.found || sugestaoSelecionado.percentOwned === null) return;
    setAtualizandoPercentual(true);
    try {
      await api.post(`/accounting/equity-method/${selected.id}/atualizar-percentual`, { percentOwned: sugestaoSelecionado.percentOwned });
      toast.success('Percentual atualizado a partir do Livro de Sócios.');
      await carregar();
      setSelected(prev => prev ? { ...prev, percentOwned: String(sugestaoSelecionado.percentOwned) } : prev);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao atualizar percentual.');
    } finally { setAtualizandoPercentual(false); }
  };

  const handleCriar = async () => {
    if (!fInveteeId || !fPercent || !fInvestAccount || !fGainAccount || !fLossAccount || !fCost || !fDate) {
      toast.error('Preencha todos os campos.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/accounting/equity-method', {
        investeeCompanyId: fInveteeId,
        percentOwned: parseFloat(fPercent.replace(',', '.')),
        investmentAccountCode: fInvestAccount,
        gainAccountCode: fGainAccount,
        lossAccountCode: fLossAccount,
        initialCost: parseFloat(fCost.replace(',', '.')),
        acquisitionDate: fDate,
      });
      toast.success('Participação cadastrada.');
      setShowForm(false);
      setFInveteeId(''); setFPercent(''); setFInvestAccount(''); setFGainAccount(''); setFLossAccount(''); setFCost(''); setFDate('');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao cadastrar participação.');
    } finally { setSaving(false); }
  };

  const handleCalcular = async () => {
    if (!selected || !refDate) return;
    setCalculando(true);
    setPreview(null);
    try {
      const r = await api.get(`/accounting/equity-method/${selected.id}/calcular`, { params: { referenceDate: refDate } });
      setPreview(r.data);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao calcular.');
    } finally { setCalculando(false); }
  };

  const handleLancar = async () => {
    if (!selected || !refDate) return;
    if (!window.confirm('Confirma a geração do lançamento contábil de ajuste de Equivalência Patrimonial? Esta ação não pode ser desfeita facilmente.')) return;
    setLancando(true);
    try {
      await api.post(`/accounting/equity-method/${selected.id}/lancar`, { referenceDate: refDate });
      toast.success('Lançamento gerado com sucesso.');
      setPreview(null);
      setRefDate('');
      carregarHistorico(selected.id);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao gerar lançamento.');
    } finally { setLancando(false); }
  };

  // NOVO (20/09/2026): reverte uma apuracao ja lancada (lancamento contabil de ajuste + registro de apuracao),
  // liberando um novo calculo para a mesma data-base. O historico vem em ordem decrescente de data-base.
  const handleReverter = async (h: any) => {
    if (!selected) return;
    const dataBase = String(h.referenceDate).slice(0, 10); // date-only (UTC): AAAA-MM-DD
    const dataBR = dataBase.split('-').reverse().join('/');
    const ehUltima = historico.length > 0 && historico[0].id === h.id;
    const aviso = ehUltima
      ? ''
      : '\n\nAtenção: existem apurações POSTERIORES a esta data. Elas não são recalculadas - se for o caso, reverta antes as mais recentes.';
    if (!window.confirm(`Reverter a apuração de ${dataBR}? O lançamento contábil de ajuste será excluído (permanece no histórico como excluído) e essa data poderá ser apurada novamente.${aviso}`)) return;
    setRevertendo(h.id);
    try {
      await api.post(`/accounting/equity-method/${selected.id}/reverter`, { referenceDate: dataBase });
      toast.success('Apuração revertida.');
      setPreview(null);
      carregarHistorico(selected.id);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao reverter a apuração.');
    } finally { setRevertendo(null); }
  };

  const empresasInvestiveis = (companies || []).filter(c => c.id !== activeCompany?.id);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 4, fontSize: 12, color: '#9CA3AF' }}>Contabilidade / Investimentos</div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Equivalência Patrimonial</h1>
      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
        Cálculo e demonstração do Método de Equivalência Patrimonial (MEP) — busca o Patrimônio Líquido real da
        investida dentro do próprio LEDGR e gera o lançamento de ajuste automaticamente.
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ width: 340, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Participações</span>
            <button onClick={() => setShowForm(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#2563EB', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <FiPlus size={14} /> Nova
            </button>
          </div>

          {showForm && (
            <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: 14, marginBottom: 14, background: '#F9FAFB' }}>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: '#9CA3AF' }}>Empresa Investida</label>
                <select value={fInveteeId} onChange={e => setFInveteeId(e.target.value)} style={{ width: '100%', padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 }}>
                  <option value="">Selecione...</option>
                  {empresasInvestiveis.map(c => <option key={c.id} value={c.id}>{c.legalName || c.tradeName}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: '#9CA3AF' }}>% Participação</label>
                <input value={fPercent} onChange={e => setFPercent(e.target.value)} placeholder="Ex: 99,9204"
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 }} />
                {sugestaoForm && (
                  <div style={{ fontSize: 10, color: sugestaoForm.found ? '#16A34A' : '#9CA3AF', marginTop: 3 }}>
                    {sugestaoForm.found
                      ? `Sugerido pelo Livro de Sócios: ${Number(sugestaoForm.percentOwned).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}% (${sugestaoForm.holderName})`
                      : 'Empresa investidora não encontrada no Livro de Sócios da investida — informe manualmente.'}
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: '#9CA3AF' }}>Conta de Investimentos</label>
                <input value={fInvestAccount} onChange={e => setFInvestAccount(e.target.value)} placeholder="Código"
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: '#9CA3AF' }}>Conta de Ganho (EP)</label>
                  <input value={fGainAccount} onChange={e => setFGainAccount(e.target.value)} placeholder="Código"
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: '#9CA3AF' }}>Conta de Perda (EP)</label>
                  <input value={fLossAccount} onChange={e => setFLossAccount(e.target.value)} placeholder="Código"
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: '#9CA3AF' }}>Custo de Aquisição</label>
                  <input value={fCost} onChange={e => setFCost(e.target.value)} placeholder="0,00"
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: '#9CA3AF' }}>Data de Aquisição</label>
                  <input type="date" value={fDate} onChange={e => setFDate(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 }} />
                </div>
              </div>
              <button onClick={handleCriar} disabled={saving}
                style={{ width: '100%', padding: '8px', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Salvando...' : 'Cadastrar Participação'}
              </button>
            </div>
          )}

          {loading ? (
            <div style={{ color: '#9CA3AF', fontSize: 13 }}>Carregando...</div>
          ) : investments.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: 13, padding: 12, textAlign: 'center', border: '1px dashed #E5E7EB', borderRadius: 8 }}>
              Nenhuma participação cadastrada.
            </div>
          ) : (
            investments.map(inv => (
              <div key={inv.id} onClick={() => selecionar(inv)}
                style={{
                  padding: 10, borderRadius: 8, marginBottom: 6, cursor: 'pointer',
                  border: selected?.id === inv.id ? '1px solid #2563EB' : '1px solid #E5E7EB',
                  background: selected?.id === inv.id ? '#EFF6FF' : '#fff',
                }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{inv.investeeCompany.legalName || inv.investeeCompany.tradeName}</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>{fmtPct(Number(inv.percentOwned))} · {inv.investmentAccount.code}</div>
              </div>
            ))
          )}
        </div>

        <div style={{ flex: 1 }}>
          {!selected ? (
            <div style={{ textAlign: 'center', padding: 80, border: '0.5px dashed #E5E7EB', borderRadius: 10, color: '#9CA3AF', fontSize: 13 }}>
              Selecione uma participação à esquerda.
            </div>
          ) : (
            <>
              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                  {selected.investeeCompany.legalName || selected.investeeCompany.tradeName}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
                  Participação: {fmtPct(Number(selected.percentOwned))} · Conta Investimento: {selected.investmentAccount.code} - {selected.investmentAccount.name} · Ganho: {selected.gainAccount.code} · Perda: {selected.lossAccount.code}
                </div>

                {sugestaoSelecionado?.found && sugestaoSelecionado.percentOwned !== null &&
                  Math.abs(Number(sugestaoSelecionado.percentOwned) - Number(selected.percentOwned)) > 0.0001 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8,
                    background: '#FFFBEB', border: '1px solid #FDE68A', marginBottom: 16,
                  }}>
                    <span style={{ fontSize: 16 }}>ℹ️</span>
                    <div style={{ fontSize: 12, color: '#92400E', flex: 1 }}>
                      Livro de Sócios da investida indica {Number(sugestaoSelecionado.percentOwned).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%
                      ({sugestaoSelecionado.holderName}) — diferente do percentual cadastrado aqui ({fmtPct(Number(selected.percentOwned))}).
                    </div>
                    <button onClick={handleAtualizarPercentual} disabled={atualizandoPercentual}
                      style={{ padding: '6px 12px', background: '#92400E', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: atualizandoPercentual ? 0.6 : 1 }}>
                      {atualizandoPercentual ? 'Atualizando...' : 'Atualizar'}
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 11, color: '#9CA3AF' }}>Data-base do cálculo</label>
                    <input type="date" value={refDate} onChange={e => setRefDate(e.target.value)}
                      style={{ padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 }} />
                  </div>
                  <button onClick={handleCalcular} disabled={calculando || !refDate}
                    style={{ padding: '8px 16px', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: (calculando || !refDate) ? 0.6 : 1 }}>
                    {calculando ? 'Calculando...' : 'Calcular'}
                  </button>
                </div>

                {preview && !preview.investeeYearClosed && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderRadius: 8,
                    background: '#FEF2F2', border: '1px solid #FECACA', marginBottom: 16,
                  }}>
                    <span style={{ fontSize: 20 }}>⚠️</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#B91C1C' }}>
                      {preview.investeeYear} não foi Encerrado na Investida!!!
                    </div>
                  </div>
                )}
                {preview && (
                  <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                      <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase' }}>PL da Investida</div>
                        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace' }}>{fmtNum(preview.investeePl)}</div>
                      </div>
                      <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase' }}>% Aplicado</div>
                        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace' }}>{fmtPct(preview.percentApplied)}</div>
                      </div>
                      <div style={{ background: '#EFF6FF', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 11, color: '#1D4ED8', textTransform: 'uppercase' }}>Valor Calculado (MEP)</div>
                        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: '#1D4ED8' }}>{fmtNum(preview.equityValue)}</div>
                      </div>
                      <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase' }}>Saldo Contábil Anterior</div>
                        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace' }}>{fmtNum(preview.previousBookValue)}</div>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderRadius: 8,
                      background: preview.adjustment >= 0 ? '#F0FDF4' : '#FEF2F2',
                    }}>
                      {preview.adjustment >= 0 ? <FiTrendingUp size={20} color="#16A34A" /> : <FiTrendingDown size={20} color="#DC2626" />}
                      <div>
                        <div style={{ fontSize: 11, color: preview.adjustment >= 0 ? '#16A34A' : '#DC2626', textTransform: 'uppercase', fontWeight: 600 }}>
                          {preview.adjustment >= 0 ? 'Ganho de Equivalência Patrimonial' : 'Perda de Equivalência Patrimonial'}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: preview.adjustment >= 0 ? '#16A34A' : '#DC2626' }}>
                          {fmtNum(Math.abs(preview.adjustment))}
                        </div>
                      </div>
                      <button onClick={handleLancar} disabled={lancando || !preview.investeeYearClosed}
                        title={!preview.investeeYearClosed ? `${preview.investeeYear} não foi Encerrado na Investida!!!` : undefined}
                        style={{ marginLeft: 'auto', padding: '8px 16px', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: (lancando || !preview.investeeYearClosed) ? 'not-allowed' : 'pointer', opacity: (lancando || !preview.investeeYearClosed) ? 0.4 : 1 }}>
                        {lancando ? 'Gerando...' : 'Gerar Lançamento'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>
                  Demonstração — Apurações Anteriores
                </div>
                {historico.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Nenhuma apuração registrada ainda.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#F9FAFB' }}>
                        {['Data-base', 'PL Investida', '% Aplicado', 'Valor MEP', 'Saldo Anterior', 'Ajuste', ''].map(h => (
                          <th key={h} style={{ padding: '6px 10px', fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', textAlign: h === 'Data-base' ? 'left' : 'right' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historico.map(h => (
                        <tr key={h.id} style={{ borderTop: '0.5px solid #F3F4F6' }}>
                          <td style={{ padding: '6px 10px' }}>{new Date(h.referenceDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(Number(h.investeePl))}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtPct(Number(h.percentApplied))}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(Number(h.equityValue))}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(Number(h.previousBookValue))}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: Number(h.adjustment) >= 0 ? '#16A34A' : '#DC2626' }}>
                            {fmtNum(Number(h.adjustment))}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                            <button
                              onClick={() => handleReverter(h)}
                              disabled={revertendo !== null}
                              title="Reverte esta apuração (exclui o lançamento de ajuste) para poder apurar a data novamente"
                              style={{ padding: '3px 10px', borderRadius: 6, border: '0.5px solid #DC2626', background: '#fff', color: '#DC2626', fontSize: 11, fontWeight: 500, cursor: revertendo !== null ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: revertendo === h.id ? 0.6 : 1 }}
                            >
                              {revertendo === h.id ? 'Revertendo...' : 'Reverter'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EquityMethodPage;
