// frontend/src/pages/finance/ContasAReceberPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { SmartDateInput } from '../../components/SmartDateInput';
import toast from 'react-hot-toast';

const AC = '#0369A1';
const AC_SURF = '#F0F9FF';

function fmtBRL(v: any) { return Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function fmtDate(s: any) { if (!s) return '—'; const p = String(s).split('T')[0].split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
function diffDays(d: string) { return Math.floor((new Date().getTime() - new Date(d).getTime()) / 86400000); }

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  OPEN:      { label: 'Aberto',     bg: '#DBEAFE', color: '#1D4ED8' },
  PARTIAL:   { label: 'Parcial',    bg: '#FEF3C7', color: '#92400E' },
  RECEIVED:  { label: 'Recebido',   bg: '#DCFCE7', color: '#15803D' },
  OVERDUE:   { label: 'Vencido',    bg: '#FEE2E2', color: '#B91C1C' },
  CANCELLED: { label: 'Cancelado',  bg: '#F3F4F6', color: '#6B7280' },
};

const ORIGIN_LABEL: Record<string, string> = {
  MANUAL: 'Manual', FISCAL_DOCUMENT: 'NF', ALUGUEL: 'Aluguel', RECURRING: 'Recorrente',
};

type Tab = 'titulos' | 'aging';

interface ReceiveDto { amount: string; receivedAt: string; paymentMethod: string; receiptRef: string; notes: string; receivingAccountId: string; nfNumero: string; }

export default function ContasAReceberPage() {
  const [tab, setTab]           = useState<Tab>('titulos');
  const [entries, setEntries]   = useState<any[]>([]);
  const [aging, setAging]       = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const [total, setTotal]       = useState(0);
  const [totalAmount, setTotalAmount]   = useState(0);
  const [totalReceived, setTotalReceived] = useState(0);
  const [refreshKey, setRefreshKey]     = useState(0);
  const [showModal, setShowModal]       = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [selected, setSelected]         = useState<any>(null);
  const [filters, setFilters]   = useState({ status: '', origin: '', from: '', to: '' });
  const [receiveDto, setReceiveDto] = useState<ReceiveDto>({ amount: '', receivedAt: new Date().toISOString().slice(0,10), paymentMethod: 'PIX', receiptRef: '', notes: '', receivingAccountId: '', nfNumero: '' });
  const [newDto, setNewDto] = useState({ title: '', origin: 'ALUGUEL', dueDate: '', amount: '', customerName: '', customerCnpjCpf: '', fixedAssetId: '', notes: '', competenceMonth: '' });
  const [fixedAssets, setFixedAssets] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.status) params.status = filters.status;
      if (filters.origin) params.origin = filters.origin;
      if (filters.from)   params.from   = filters.from;
      if (filters.to)     params.to     = filters.to;
      const { data } = await api.get('/finance/ar', { params });
      setEntries(data.data ?? []);
      setTotal(data.total ?? 0);
      setTotalAmount(data.totalAmount ?? 0);
      setTotalReceived(data.totalReceived ?? 0);
    } catch { }
    finally { setLoading(false); }
  }, [filters, refreshKey]);

  const loadAging = useCallback(async () => {
    try {
      const { data } = await api.get('/finance/ar/aging');
      setAging(data);
    } catch { }
  }, []);

  const loadFixedAssets = useCallback(async () => {
    try {
      const { data } = await api.get('/assets', { params: { group: 'REAL_ESTATE', status: 'ACTIVE' } });
      setFixedAssets(data?.data ?? data ?? []);
    } catch { }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'aging') loadAging(); }, [tab, loadAging]);
  useEffect(() => { loadFixedAssets(); }, [loadFixedAssets]);
  useEffect(() => {
    api.get('/chart-of-accounts', { params: { isAnalytic: true } })
      .then(r => setAccounts((r.data?.data ?? r.data ?? []).filter((a: any) => ['ASSET','LIABILITY'].includes(a.type))))
      .catch(() => {});
  }, []);

  async function handleReceive() {
    if (!selected) return;
    if (selected.origin === 'ALUGUEL' && !receiveDto.nfNumero.trim()) {
      toast.error('Para recebimentos de aluguel, o número da NF é obrigatório.');
      return;
    }
    try {
      await api.post(`/finance/ar/${selected.id}/receive`, {
        amount:        parseFloat(receiveDto.amount.replace(',','.')),
        receivedAt:    receiveDto.receivedAt,
        paymentMethod: receiveDto.paymentMethod,
        receiptRef:    receiveDto.receiptRef || null,
        notes:          receiveDto.notes || null,
        receivingAccountId: receiveDto.receivingAccountId || null,
        nfNumero:           receiveDto.nfNumero || null,
      });
      setShowModal(false);
      setRefreshKey(k => k+1);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erro ao registrar recebimento'); }
  }

  async function handleCreate() {
    try {
      await api.post('/finance/ar', {
        ...newDto,
        amount: parseFloat(newDto.amount.replace(',','.')),
        fixedAssetId: newDto.fixedAssetId || null,
      });
      setShowNewModal(false);
      setRefreshKey(k => k+1);
      setNewDto({ title: '', origin: 'ALUGUEL', dueDate: '', amount: '', customerName: '', customerCnpjCpf: '', fixedAssetId: '', notes: '', competenceMonth: '' });
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erro ao criar conta a receber'); }
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancelar esta conta a receber?')) return;
    try {
      await api.patch(`/finance/ar/${id}/cancel`);
      setRefreshKey(k => k+1);
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erro'); }
  }

  const S = {
    th: { padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB', textAlign: 'left' as const },
    td: { padding: '10px 12px', fontSize: 13, color: '#374151', borderBottom: '0.5px solid #F5F5F5' },
    input: { border: '0.5px solid #E5E7EB', borderRadius: 6, padding: '6px 10px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
    label: { fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, marginBottom: 4, display: 'block' as const },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E7EB', padding: '0 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0 0' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: AC }}>◆ Financeiro</span>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: '#111', margin: '2px 0 0' }}>Contas a Receber</h1>
          </div>
          <button onClick={() => setShowNewModal(true)} style={{ background: AC, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            + Nova Conta
          </button>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginTop: 12 }}>
          {([['titulos','Títulos'],['aging','Aging']] as [Tab,string][]).map(([k,l]) => (
            <div key={k} onClick={() => setTab(k)} style={{ padding: '10px 18px', fontSize: 13, cursor: 'pointer', borderBottom: tab===k ? `2px solid ${AC}` : '2px solid transparent', color: tab===k ? AC : '#6B7280', fontWeight: tab===k ? 600 : 400 }}>{l}</div>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, padding: '16px 24px', background: AC_SURF, flexShrink: 0 }}>
        {[
          { label: 'Total Títulos', value: total, fmt: (v: any) => v },
          { label: 'A Receber', value: totalAmount - totalReceived, fmt: fmtBRL },
          { label: 'Recebido', value: totalReceived, fmt: fmtBRL },
          { label: 'Total Emitido', value: totalAmount, fmt: fmtBRL },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: AC }}>{k.fmt(k.value)}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      {tab === 'titulos' && (
        <div style={{ display: 'flex', gap: 10, padding: '12px 24px', background: '#fff', borderBottom: '0.5px solid #E5E7EB', flexShrink: 0 }}>
          <select value={filters.status} onChange={e => setFilters(f => ({...f, status: e.target.value}))} style={{ ...S.input, width: 140 }}>
            <option value="">Todos status</option>
            {Object.entries(STATUS_LABEL).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filters.origin} onChange={e => setFilters(f => ({...f, origin: e.target.value}))} style={{ ...S.input, width: 140 }}>
            <option value="">Todas origens</option>
            {Object.entries(ORIGIN_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <SmartDateInput value={filters.from} onChange={v => setFilters(f => ({...f, from: v}))} style={{ width: 140 }} placeholder="De" />
          <SmartDateInput value={filters.to} onChange={v => setFilters(f => ({...f, to: v}))} style={{ width: 140 }} placeholder="Até" />
          <button onClick={() => setFilters({ status:'', origin:'', from:'', to:'' })} style={{ padding: '6px 14px', borderRadius: 6, border: '0.5px solid #E5E7EB', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#6B7280' }}>Limpar</button>
        </div>
      )}

      {/* Conteúdo */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>

        {/* Tab: Títulos */}
        {tab === 'titulos' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
            <thead>
              <tr>
                {['Título','Origem','Cliente / Imóvel','Vencimento','Valor','Recebido','Status',''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>Carregando...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>Nenhuma conta a receber encontrada.</td></tr>
              ) : entries.map(e => {
                const st = STATUS_LABEL[e.status] ?? STATUS_LABEL.OPEN;
                const overdue = e.status === 'OPEN' && diffDays(e.dueDate) > 0;
                return (
                  <tr key={e.id} style={{ background: overdue ? '#FFF7F7' : '#fff' }}>
                    <td style={S.td}>
                      <div style={{ fontWeight: 500 }}>{e.title}</div>
                      {e.documentNumber && <div style={{ fontSize: 11, color: '#9CA3AF' }}>Doc: {e.documentNumber}</div>}
                    </td>
                    <td style={S.td}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#F3F4F6', color: '#374151' }}>{ORIGIN_LABEL[e.origin] ?? e.origin}</span></td>
                    <td style={S.td}>
                      <div>{e.customerName ?? e.customer?.fullName ?? '—'}</div>
                      {e.fixedAsset && <div style={{ fontSize: 11, color: '#9CA3AF' }}>🏠 {e.fixedAsset.internalCode}{e.fixedAsset.city ? ' · ' + e.fixedAsset.city : ''}</div>}
                      {!e.fixedAsset && e.property && <div style={{ fontSize: 11, color: '#9CA3AF' }}>🏠 {e.property.street}, {e.property.number} — {e.property.city}</div>}
                    </td>
                    <td style={{ ...S.td, color: overdue ? '#B91C1C' : '#374151', fontWeight: overdue ? 600 : 400 }}>{fmtDate(e.dueDate)}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace' }}>{fmtBRL(e.amount)}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', color: '#15803D' }}>{fmtBRL(e.receivedAmount)}</td>
                    <td style={S.td}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: st.bg, color: st.color, fontWeight: 600 }}>{st.label}</span></td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {['OPEN','PARTIAL'].includes(e.status) && (
                          <button onClick={() => { setSelected(e); setReceiveDto(d => ({...d, amount: String(Number(e.amount)-Number(e.receivedAmount))})); setShowModal(true); }} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', background: '#15803D', color: '#fff', cursor: 'pointer' }}>Baixar</button>
                        )}
                        {['OPEN','PARTIAL'].includes(e.status) && (
                          <button onClick={() => handleCancel(e.id)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '0.5px solid #E5E7EB', background: '#fff', color: '#EF4444', cursor: 'pointer' }}>Cancelar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Tab: Aging */}
        {tab === 'aging' && aging && (
          <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
            {[
              { label: 'A Vencer', value: aging.current, color: '#15803D' },
              { label: '1-30 dias', value: aging.days30,  color: '#D97706' },
              { label: '31-60 dias', value: aging.days60, color: '#EA580C' },
              { label: '61-90 dias', value: aging.days90, color: '#DC2626' },
              { label: '90+ dias',   value: aging.over90, color: '#7F1D1D' },
            ].map(b => (
              <div key={b.label} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: '16px 20px', borderTop: `3px solid ${b.color}` }}>
                <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 8 }}>{b.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: b.color }}>{fmtBRL(b.value)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Baixa */}
      {showModal && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: 480, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>Registrar Recebimento</h2>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px' }}>{selected.title}</p>
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                { label: 'Valor Recebido', key: 'amount', type: 'text' },
                { label: 'Data Recebimento', key: 'receivedAt', type: 'date' },
                { label: 'Referência / Comprovante', key: 'receiptRef', type: 'text' },
                { label: 'Observações', key: 'notes', type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label style={S.label}>{f.label}</label>
                  <input type={f.type} value={(receiveDto as any)[f.key]} onChange={e => setReceiveDto(d => ({...d, [f.key]: e.target.value}))} style={S.input} />
                </div>
              ))}
              <div>
                <label style={S.label}>Forma de Pagamento</label>
                <select value={receiveDto.paymentMethod} onChange={e => setReceiveDto(d => ({...d, paymentMethod: e.target.value}))} style={S.input}>
                  {['PIX','TED','DOC','BOLETO','CHEQUE','DINHEIRO','TRANSFERENCIA','OUTROS'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {selected?.origin === 'ALUGUEL' && (
                <div>
                  <label style={S.label}>Número da NF <span style={{color:'#EF4444'}}>*</span></label>
                  <input type="text" value={receiveDto.nfNumero} onChange={e => setReceiveDto(d => ({...d, nfNumero: e.target.value}))} style={S.input} placeholder="Ex: 000123" />
                </div>
              )}
              <div>
                <label style={S.label}>Conta Contábil (Débito)</label>
                <select value={receiveDto.receivingAccountId} onChange={e => setReceiveDto(d => ({...d, receivingAccountId: e.target.value}))} style={S.input}>
                  <option value="">— Sem lançamento contábil —</option>
                  {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '0.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button onClick={handleReceive} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#15803D', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Conta */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: 560, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.15)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 20px' }}>Nova Conta a Receber</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>Título</label>
                <input value={newDto.title} onChange={e => setNewDto(d => ({...d, title: e.target.value}))} style={S.input} placeholder="Ex: Aluguel Janeiro 2025 — Apto 12B" />
              </div>
              <div>
                <label style={S.label}>Origem</label>
                <select value={newDto.origin} onChange={e => setNewDto(d => ({...d, origin: e.target.value}))} style={S.input}>
                  {Object.entries(ORIGIN_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Competência (MM/AAAA)</label>
                <input value={newDto.competenceMonth} onChange={e => setNewDto(d => ({...d, competenceMonth: e.target.value}))} style={S.input} placeholder="2025-01" />
              </div>
              <div>
                <label style={S.label}>Vencimento</label>
                <SmartDateInput value={newDto.dueDate} onChange={v => setNewDto(d => ({...d, dueDate: v}))} style={S.input} />
              </div>
              <div>
                <label style={S.label}>Valor</label>
                <input value={newDto.amount} onChange={e => setNewDto(d => ({...d, amount: e.target.value}))} style={S.input} placeholder="0,00" />
              </div>
              <div>
                <label style={S.label}>Locatário / Cliente</label>
                <input value={newDto.customerName} onChange={e => setNewDto(d => ({...d, customerName: e.target.value}))} style={S.input} />
              </div>
              <div>
                <label style={S.label}>CPF / CNPJ</label>
                <input value={newDto.customerCnpjCpf} onChange={e => setNewDto(d => ({...d, customerCnpjCpf: e.target.value}))} style={S.input} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>Imóvel (Ativo Imobilizado)</label>
                <select value={newDto.fixedAssetId} onChange={e => setNewDto(d => ({...d, fixedAssetId: e.target.value}))} style={S.input}>
                  <option value="">— Sem vínculo com imóvel —</option>
                  {fixedAssets.map((a: any) => <option key={a.id} value={a.id}>{a.internalCode} — {a.description}{a.city ? ' · ' + a.city : ''}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>Observações</label>
                <input value={newDto.notes} onChange={e => setNewDto(d => ({...d, notes: e.target.value}))} style={S.input} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => setShowNewModal(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '0.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button onClick={handleCreate} disabled={!newDto.title || !newDto.dueDate || !newDto.amount} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: AC, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}