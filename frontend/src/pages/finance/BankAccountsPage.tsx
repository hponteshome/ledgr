// frontend/src/pages/finance/BankAccountsPage.tsx
// EXTBB-05 (23/11/2026) - Cadastro de Contas Bancarias da empresa ativa.
// Cada conta do banco ligada a conta contabil do banco e, opcionalmente, a conta da aplicacao automatica.
// EXTBB-05B: contas do plano via /bank-accounts/ledger-options; numero e digito em campos separados.
import React, { useEffect, useState } from 'react';
import { FiEye, FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import Swal from 'sweetalert2';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { AccountPicker, PickerAccount } from '../../components/finance/AccountPicker';

const FIN = '#1A4A3A';
const FIN_ACCENT = '#3DAA7A';
const FIN_LIGHT = '#E8F5EE';

const BANKS: { number: string; name: string }[] = [
  { number: '001', name: 'Banco do Brasil' },
  { number: '033', name: 'Santander' },
  { number: '077', name: 'Banco Inter' },
  { number: '104', name: 'Caixa Econômica Federal' },
  { number: '237', name: 'Bradesco' },
  { number: '260', name: 'Nubank' },
  { number: '341', name: 'Itaú' },
  { number: '748', name: 'Sicredi' },
  { number: '756', name: 'Sicoob' },
];
const bankName = (n: string) => BANKS.find(b => b.number === n)?.name ?? `Banco ${n}`;

interface AccRef { id: string; code: string; reducedCode?: string | null; name: string; }
interface BankAccount {
  id: string; bankNumber: string; bankCode: string;
  agency: string; agencyDigit?: string | null; account: string; accountDigit?: string | null;
  nickname?: string | null; ledgerAccountId?: string | null; investmentAccountId?: string | null; isActive: boolean;
  ledgerAccount?: AccRef | null; investmentAccount?: AccRef | null; _count?: { statements: number };
}
type Mode = 'new' | 'edit' | 'view';

const fmtAg = (b: { agency: string; agencyDigit?: string | null }) => b.agency + (b.agencyDigit ? `-${b.agencyDigit}` : '');
const fmtConta = (b: { account: string; accountDigit?: string | null }) =>
  Number(b.account).toLocaleString('pt-BR') + (b.accountDigit ? `-${b.accountDigit}` : '');
const fmtAcc = (a?: AccRef | null) => (a ? `${a.reducedCode || a.code} - ${a.name}` : '-');
const onlyDigits = (v: string) => v.replace(/\D/g, '');
const onlyDv = (v: string) => v.replace(/[^0-9Xx]/g, '').toUpperCase().slice(0, 1);

const inputSt: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '0.5px solid #D1D5DB', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none', background: '#fff' };
const thSt: React.CSSProperties = { padding: '9px 12px', fontSize: 11, fontWeight: 700 };
const tdSt: React.CSSProperties = { padding: '9px 12px', color: '#111827' };
const emptySt: React.CSSProperties = { padding: 24, textAlign: 'center', color: '#9CA3AF' };
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#4B5563', padding: '2px 6px' };
const btnPrimary: React.CSSProperties = { background: FIN, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnSecondary: React.CSSProperties = { background: '#fff', color: '#4B5563', border: '0.5px solid #D1D5DB', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' };
const sectionSt: React.CSSProperties = { background: FIN_LIGHT, borderRadius: 8, padding: '12px 14px', borderLeft: `3px solid ${FIN_ACCENT}` };
const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: FIN, marginBottom: 10 };
const pill = (ok: boolean): React.CSSProperties => ({ fontSize: 10, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: ok ? '#F0FDF4' : '#F3F4F6', color: ok ? '#15803D' : '#6B7280' });

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, fontWeight: 500 }}>{children}</div>;
}

export default function BankAccountsPage() {
  const [rows, setRows] = useState<BankAccount[]>([]);
  const [accounts, setAccounts] = useState<PickerAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ mode: Mode; row?: BankAccount } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/bank-accounts');
      setRows(Array.isArray(r.data) ? r.data : []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Falha ao carregar as contas bancárias.');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    api.get('/bank-accounts/ledger-options')
      .then(r => setAccounts(Array.isArray(r.data) ? r.data : []))
      .catch((e: any) => { setAccounts([]); toast.error(e?.response?.data?.message ?? 'Falha ao carregar o plano de contas.'); });
  }, []);

  const handleDelete = async (b: BankAccount) => {
    const ok = await Swal.fire({
      title: 'Excluir conta bancária?',
      text: `${bankName(b.bankNumber)} - Ag. ${fmtAg(b)} / C/C ${fmtConta(b)}`,
      icon: 'warning', showCancelButton: true,
      confirmButtonText: 'Excluir', cancelButtonText: 'Cancelar', confirmButtonColor: '#A32D2D',
    });
    if (!ok.isConfirmed) return;
    try {
      await api.delete(`/bank-accounts/${b.id}`);
      toast.success('Conta bancária excluída.');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Falha ao excluir.');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: FIN }}>Contas Bancárias</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Cada conta do banco ligada à sua conta contábil - base da importação e conciliação de extratos</div>
        </div>
        <button onClick={() => setModal({ mode: 'new' })} style={btnPrimary}><FiPlus size={14} /> Nova Conta</button>
      </div>

      <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: FIN_LIGHT, color: FIN, textAlign: 'left' }}>
              {['Banco', 'Agência', 'Conta', 'Apelido', 'Conta contábil do banco', 'Aplicação automática', 'Extratos', 'Situação', 'Ações'].map(h => <th key={h} style={thSt}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} style={emptySt}>Carregando...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={9} style={emptySt}>Nenhuma conta bancária cadastrada para esta empresa.</td></tr>}
            {!loading && rows.map(b => (
              <tr key={b.id} style={{ borderTop: '0.5px solid #F0F0F0', opacity: b.isActive ? 1 : 0.55 }}>
                <td style={tdSt}>{b.bankNumber} - {bankName(b.bankNumber)}</td>
                <td style={tdSt}>{fmtAg(b)}</td>
                <td style={tdSt}>{fmtConta(b)}</td>
                <td style={tdSt}>{b.nickname || '-'}</td>
                <td style={tdSt}>{fmtAcc(b.ledgerAccount)}</td>
                <td style={tdSt}>{fmtAcc(b.investmentAccount)}</td>
                <td style={tdSt}>{b._count?.statements ?? 0}</td>
                <td style={tdSt}><span style={pill(b.isActive)}>{b.isActive ? 'Ativa' : 'Inativa'}</span></td>
                <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>
                  <button title="Ver" onClick={() => setModal({ mode: 'view', row: b })} style={iconBtn}><FiEye size={16} /></button>
                  <button title="Editar" onClick={() => setModal({ mode: 'edit', row: b })} style={iconBtn}><FiEdit2 size={16} /></button>
                  <button title="Excluir" onClick={() => handleDelete(b)} style={{ ...iconBtn, color: '#A32D2D' }}><FiTrash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <BankAccountModal mode={modal.mode} row={modal.row} accounts={accounts}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}

function BankAccountModal({ mode, row, accounts, onClose, onSaved }: {
  mode: Mode; row?: BankAccount; accounts: PickerAccount[]; onClose: () => void; onSaved: () => void;
}) {
  const ro = mode === 'view';
  const [bankNumber, setBankNumber] = useState(row?.bankNumber ?? '001');
  const [agency, setAgency] = useState(row?.agency ?? '');
  const [agencyDigit, setAgencyDigit] = useState(row?.agencyDigit ?? '');
  const [account, setAccount] = useState(row?.account ?? '');
  const [accountDigit, setAccountDigit] = useState(row?.accountDigit ?? '');
  const [nickname, setNickname] = useState(row?.nickname ?? '');
  const [ledgerAccountId, setLedgerAccountId] = useState(row?.ledgerAccountId ?? '');
  const [investmentAccountId, setInvestmentAccountId] = useState(row?.investmentAccountId ?? '');
  const [isActive, setIsActive] = useState(row?.isActive ?? true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError('');
    if (!onlyDigits(agency)) { setError('Informe a agência.'); return; }
    if (!onlyDigits(account)) { setError('Informe a conta.'); return; }
    if (!ledgerAccountId) { setError('Informe a conta contábil do banco.'); return; }
    const body = {
      bankNumber, agency: onlyDigits(agency), agencyDigit: agencyDigit || undefined,
      account: onlyDigits(account), accountDigit: accountDigit || undefined,
      nickname: nickname.trim() || undefined, ledgerAccountId, investmentAccountId: investmentAccountId || undefined, isActive,
    };
    setSaving(true);
    try {
      if (mode === 'edit' && row) await api.put(`/bank-accounts/${row.id}`, body);
      else await api.post('/bank-accounts', body);
      toast.success('Conta bancária salva.');
      onSaved();
    } catch (e: any) {
      const m = e?.response?.data?.message;
      setError(Array.isArray(m) ? m.join(', ') : (m ?? 'Falha ao salvar.'));
    } finally { setSaving(false); }
  };

  const title = mode === 'new' ? 'Nova Conta Bancária' : mode === 'edit' ? 'Editar Conta Bancária' : 'Conta Bancária';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 600, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ background: FIN, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{title}</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 1 }}>Cadastro da empresa ativa</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 15 }}>&times;</button>
        </div>

        <div style={{ padding: 18, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>{error}</div>}

          <div style={sectionSt}>
            <div style={sectionTitle}>BANCO E CONTA</div>
            <div>
              <Label>Banco *</Label>
              <select style={inputSt} disabled={ro} value={bankNumber} onChange={e => setBankNumber(e.target.value)}>
                {BANKS.map(b => <option key={b.number} value={b.number}>{b.number} - {b.name}</option>)}
                {!BANKS.some(b => b.number === bankNumber) && <option value={bankNumber}>{bankNumber}</option>}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 56px 1.4fr 56px', gap: 10, marginTop: 10 }}>
              <div>
                <Label>Agência *</Label>
                <input style={inputSt} disabled={ro} placeholder="1192" value={agency} onChange={e => setAgency(onlyDigits(e.target.value))} />
              </div>
              <div>
                <Label>Dígito</Label>
                <input style={{ ...inputSt, textAlign: 'center' }} disabled={ro} placeholder="4" value={agencyDigit} onChange={e => setAgencyDigit(onlyDv(e.target.value))} />
              </div>
              <div>
                <Label>Conta *</Label>
                <input style={inputSt} disabled={ro} placeholder="38340" value={account} onChange={e => setAccount(onlyDigits(e.target.value))} />
              </div>
              <div>
                <Label>Dígito</Label>
                <input style={{ ...inputSt, textAlign: 'center' }} disabled={ro} placeholder="6" value={accountDigit} onChange={e => setAccountDigit(onlyDv(e.target.value))} />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <Label>Apelido</Label>
              <input style={inputSt} disabled={ro} placeholder="Ex.: BB conta movimento" value={nickname} onChange={e => setNickname(e.target.value)} />
            </div>
          </div>

          <div style={sectionSt}>
            <div style={sectionTitle}>CONTABILIDADE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <Label>Conta contábil do banco *</Label>
                <AccountPicker value={ledgerAccountId} onChange={setLedgerAccountId} accounts={accounts} disabled={ro} />
              </div>
              <div>
                <Label>Conta da aplicação automática (opcional)</Label>
                <AccountPicker value={investmentAccountId} onChange={setInvestmentAccountId} accounts={accounts} disabled={ro} />
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>Ex.: BB Rende Fácil - as aplicações e resgates automáticos do extrato vão para esta conta.</div>
              </div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>Digite o reduzido (ex.: 001012) ou parte do nome e tecle Enter, ou clique na sugestão.</div>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#374151' }}>
            <input type="checkbox" disabled={ro} checked={isActive} onChange={e => setIsActive(e.target.checked)} /> Conta ativa
          </label>
        </div>

        <div style={{ background: '#FAFAFA', borderTop: '0.5px solid #E5E7EB', padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={btnSecondary}>{ro ? 'Fechar' : 'Cancelar'}</button>
          {!ro && <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Salvando...' : 'Salvar'}</button>}
        </div>
      </div>
    </div>
  );
}
