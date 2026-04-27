// frontend/src/pages/societario/ShareholdersPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useCompany } from '../../../contexts/CompanyContext';
import ShareMovementModal from './ShareMovementModal';
import { useLocation } from 'react-router-dom';
import api from '../../../services/api';
import { FiPlus, FiDownload, FiSearch, FiAlertCircle } from 'react-icons/fi';

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface ShareholderRecord {
  id: string;
  holderName: string;
  holderTaxId: string;
  holderType: string;
  shareType: 'ORDINARIA' | 'PREFERENCIAL' | 'QUOTA';
  series?: string;
  quantity: string;
  nominalValue: string;
  totalValue: string;
  percentOwned: string;
  isFullyPaid: boolean;
  integralizationDate?: string;
  subscriptionDate?: string;
  certificateNumber?: string;
  hasEncumbrance: boolean;
  isActive: boolean;
  notes?: string;
}

interface ShareTransfer {
  id: string;
  transferDate: string;
  fromRecord: { holderName: string; holderTaxId: string };
  toRecord: { holderName: string; holderTaxId: string };
  shareType: string;
  quantity: string;
  nominalValue: string;
  transferValue: string;
  reason: string;
  instrumentType?: string;
  averbacaoDate?: string;
}

interface CapitalSummary {
  holdersCount: number;
  totalShares: number;
  totalCapital: number;
  byType: Record<string, { quantity: number; value: number; holders: number }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtBRL = (v: string | number) =>
  Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const fmtQty = (v: string | number) =>
  Number(v).toLocaleString('pt-BR');
const fmtCPFCNPJ = (v: string) => {
  const d = v.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return v;
};
const fmtPct = (v: string | number) =>
  Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return new Date(d.includes("T") ? d : d + "T12:00:00").toLocaleDateString("pt-BR");
};

const REASON_LABEL: Record<string, string> = {
  COMPRA_VENDA: 'Compra e Venda', DOACAO: 'Doação', HERANCA: 'Herança',
  INTEGRALIZACAO: 'Integralização', REDUCAO_CAPITAL: 'Red. Capital',
  BONIFICACAO: 'Bonificação', CISAO: 'Cisão', INCORPORACAO: 'Incorporação', OUTRO: 'Outro',
};

// ── Componente principal ───────────────────────────────────────────────────────
interface Props { initialTab?: 'registro' | 'transferencia'; }

const ShareholdersPage: React.FC<Props> = ({ initialTab = 'registro' }) => {
  const { activeCompany } = useCompany();
  const location = useLocation();
  useEffect(() => {
    if (location.pathname.includes('transferencias')) setTab('transferencia');
    else setTab('registro');
  }, [location.pathname]);
  const [tab, setTab] = useState<'registro' | 'transferencia'>(initialTab);
  const [records, setRecords] = useState<ShareholderRecord[]>([]);
  const [transfers, setTransfers] = useState<ShareTransfer[]>([]);
  const [summary, setSummary] = useState<CapitalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [showModalReg, setShowModalReg] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showModalTransf, setShowModalTransf] = useState(false);
  const [expandedTransfer, setExpandedTransfer] = useState<string | null>(null);
  const [expandedHolder, setExpandedHolder] = useState<string | null>(null);
  const [holderDetail, setHolderDetail] = useState<Record<string, any>>({});

  const handleExpandHolder = async (id: string) => {
    if (expandedHolder === id) { setExpandedHolder(null); return; }
    setExpandedHolder(id);
    if (!holderDetail[id]) {
      try {
        const res = await api.get('/corporate/shareholders/' + id);
        setHolderDetail(prev => ({ ...prev, [id]: res.data }));
      } catch { }
    }
  };
  const [editingRecord, setEditingRecord] = useState<ShareholderRecord | null>(null);
  const [personLookup, setPersonLookup] = useState<"idle" | "loading" | "found" | "not_found">("idle");

  const handleCpfLookup = async (cpf: string) => {
    const clean = cpf.replace(/\D/g, "");
    if (clean.length < 11) return;
    setPersonLookup("loading");
    try {
      const res = await api.get(`/persons/cpf/${clean}`);
      const person = res.data;
      setFormReg(p => ({
        ...p,
        holderName: person.fullName ?? p.holderName,
        holderType: person.documentType === "CNPJ" ? "PJ" : "PF",
      }));
      setPersonLookup("found");
    } catch {
      setPersonLookup("not_found");
    }
  };

  const handleEditReg = (r: ShareholderRecord) => {
    setEditingRecord(r);
    setFormReg({
      entryType: r.shareType === "QUOTA" ? "LTDA" : "SA",
      holderName: r.holderName,
      holderTaxId: r.holderTaxId,
      holderType: r.holderType,
      shareType: r.shareType,
      series: r.series ?? "",
      quantity: r.quantity,
      nominalValue: r.nominalValue,
      percentOwned: r.percentOwned,
      subscriptionDate: "",
      integralizationDate: r.integralizationDate ? r.integralizationDate.split("T")[0] : "",
      paidInAmount: "",
      isFullyPaid: r.isFullyPaid,
      hasEncumbrance: r.hasEncumbrance,
      notes: r.notes ?? "",
    });
    setShowModalReg(true);
  };
  const [pdfLoading, setPdfLoading] = useState(false);

  // ── Form state registro ──────────────────────────────────────────────────────
  const [formReg, setFormReg] = useState({
    entryType: 'LTDA', holderName: '', holderTaxId: '', holderType: 'PF',
    shareType: 'QUOTA', series: '', quantity: '', nominalValue: '1',
    percentOwned: '', subscriptionDate: '', integralizationDate: '',
    paidInAmount: '', isFullyPaid: false, hasEncumbrance: false, notes: '',
  });

  // ── Form state transferência ─────────────────────────────────────────────────
  const [formTransf, setFormTransf] = useState({
    fromRecordId: '', toRecordId: '', shareType: 'QUOTA', series: '',
    quantity: '', nominalValue: '1', transferValue: '',
    transferDate: '', reason: 'COMPRA_VENDA',
    instrumentType: '', instrumentDate: '', notaryOffice: '', notes: '',
  });

  const load = useCallback(async () => {
    if (!activeCompany) return;
    setLoading(true);
    setError('');
    try {
      const [recsRes, transRes, sumRes] = await Promise.all([
        api.get('/corporate/shareholders'),
        api.get('/corporate/transfers'),
        api.get('/corporate/shareholders/capital-summary'),
      ]);
      setRecords(recsRes.data);
      setTransfers(transRes.data);
      setSummary(sumRes.data);
    } catch {
      setError('Erro ao carregar dados. Verifique se o servidor está ativo.');
    } finally {
      setLoading(false);
    }
  }, [activeCompany]);

  useEffect(() => { load(); }, [load]);

  // ── Filtros ──────────────────────────────────────────────────────────────────
  const filteredRecords = records.filter(r => {
    const matchTipo = filterTipo === 'todos' || r.shareType === filterTipo;
    const matchSearch = !search ||
      r.holderName.toLowerCase().includes(search.toLowerCase()) ||
      r.holderTaxId.includes(search);
    return r.isActive && matchTipo && matchSearch;
  });

  const filteredTransfers = transfers.filter(t =>
    !search ||
    t.fromRecord.holderName.toLowerCase().includes(search.toLowerCase()) ||
    t.toRecord.holderName.toLowerCase().includes(search.toLowerCase())
  );

  // ── Salvar registro ──────────────────────────────────────────────────────────
  const handleSaveReg = async () => {
    if (editingRecord) {
      try {
        await api.patch(`/corporate/shareholders/${editingRecord.id}`, {
          ...formReg,
          quantity: Number(formReg.quantity),
          nominalValue: Number(formReg.nominalValue),
          percentOwned: Number(formReg.percentOwned),
          paidInAmount: Number(formReg.paidInAmount) || 0,
        });
        setShowModalReg(false);
        setEditingRecord(null);
        load();
      } catch (e: any) {
        alert(e.response?.data?.message ?? "Erro ao atualizar registro.");
      }
      return;
    }
    if (!formReg.holderName || !formReg.holderTaxId || !formReg.quantity) {
      alert('Preencha nome, CPF/CNPJ e quantidade.'); return;
    }
    try {
      await api.post('/corporate/shareholders', {
        ...formReg,
        quantity: Number(formReg.quantity),
        nominalValue: Number(formReg.nominalValue),
        percentOwned: Number(formReg.percentOwned),
        paidInAmount: Number(formReg.paidInAmount) || 0,
      });
      setShowModalReg(false);
      load();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Erro ao salvar registro.');
    }
  };

  // ── Salvar transferência ─────────────────────────────────────────────────────
  const handleSaveTransf = async () => {
    if (!formTransf.fromRecordId || !formTransf.toRecordId || !formTransf.quantity || !formTransf.transferDate) {
      alert('Preencha todos os campos obrigatórios.'); return;
    }
    if (formTransf.fromRecordId === formTransf.toRecordId) {
      alert('Cedente e cessionário devem ser diferentes.'); return;
    }
    try {
      await api.post('/corporate/transfers', {
        ...formTransf,
        quantity: Number(formTransf.quantity),
        nominalValue: Number(formTransf.nominalValue),
        transferValue: Number(formTransf.transferValue),
        entryType: records.find(r => r.id === formTransf.fromRecordId)?.shareType === 'QUOTA' ? 'LTDA' : 'SA',
      });
      setShowModalTransf(false);
      load();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Erro ao registrar transferência.');
    }
  };

  // ── Averbar ──────────────────────────────────────────────────────────────────
  const handleAverbar = async (id: string) => {
    try {
      await api.patch(`/corporate/transfers/${id}/averbar`);
      load();
    } catch (e: any) {
      alert(e.response?.data?.message ?? 'Erro ao averbar.');
    }
  };

  // ── Gerar PDF ────────────────────────────────────────────────────────────────
  const handlePdf = async () => {
    setPdfLoading(true);
    try {
      const endpoint = tab === 'registro'
        ? '/corporate/pdf/share-register'
        : '/corporate/pdf/transfer-register';
      const res = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = tab === 'registro' ? 'livro-registro-acionistas.pdf' : 'livro-transferencia.pdf';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao gerar PDF. Verifique se o Puppeteer está instalado no servidor.');
    } finally {
      setPdfLoading(false);
    }
  };

  // ── DS tokens ────────────────────────────────────────────────────────────────
  const DS = {
    accent: '#2563EB', accentBg: '#EFF6FF', accentText: '#1D4ED8',
    border: '0.5px solid #E5E7EB', radius: '10px',
    th: 'bg-[#F9FAFB] text-[15px] uppercase tracking-wide text-[#6B7280] font-medium px-3.5 py-2.5 border-b border-[#E5E7EB] text-left',
    td: 'px-3.5 py-2.5 text-[15px] text-[#374151] border-b border-[#F5F5F5]',
  };

  if (!activeCompany) return (
    <div className="p-8 text-center text-gray-500">
      <FiAlertCircle size={32} className="mx-auto mb-3 text-gray-300" />
      Selecione uma empresa para continuar.
    </div>
  );

  // ── Componente auxiliar: extrato de movimentações por titular ────────────
  const HolderExtratoRow = ({ record, detail }: { record: ShareholderRecord; detail: any }) => {
    if (!detail) return <div className="text-[13px] text-gray-400 italic">Carregando...</div>;
    type Mov = { date: string; hist: string; entrada: number; saida: number; saldo: number };
    const initial: Mov = {
      date: record.subscriptionDate || record.integralizationDate || "",
      hist: record.notes || "Lançamento Inicial",
      entrada: Number(record.quantity) + (detail.transfersAsFrom?.reduce((s: number, t: any) => s + Number(t.quantity), 0) || 0),
      saida: 0,
      saldo: 0,
    };
    const fromMovs: Mov[] = (detail.transfersAsFrom || []).map((t: any) => ({
      date: t.transferDate,
      hist: "Alienação → " + t.toRecord.holderName,
      entrada: 0,
      saida: Number(t.quantity),
      saldo: 0,
    }));
    const toMovs: Mov[] = (detail.transfersAsTo || []).map((t: any) => ({
      date: t.transferDate,
      hist: "Recebimento ← " + t.fromRecord.holderName,
      entrada: Number(t.quantity),
      saida: 0,
      saldo: 0,
    }));
    let saldo = 0;
    const movs = [initial, ...fromMovs, ...toMovs]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(m => { saldo += m.entrada - m.saida; return { ...m, saldo }; });
    return (
      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr>
            <th className="text-left py-1.5 px-2 text-gray-500 font-medium border-b border-gray-200 w-24">Data</th>
            <th className="text-left py-1.5 px-2 text-gray-500 font-medium border-b border-gray-200">Histórico</th>
            <th className="text-right py-1.5 px-2 text-gray-500 font-medium border-b border-gray-200 w-28">Entrada</th>
            <th className="text-right py-1.5 px-2 text-gray-500 font-medium border-b border-gray-200 w-28">Saída</th>
            <th className="text-right py-1.5 px-2 text-gray-500 font-medium border-b border-gray-200 w-28">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {movs.map((m, mi) => (
            <tr key={mi} className="border-b border-gray-100 hover:bg-white">
              <td className="py-1.5 px-2 text-gray-500">{fmtDate(m.date)}</td>
              <td className="py-1.5 px-2 text-gray-800 font-medium">{m.hist}</td>
              <td className="py-1.5 px-2 text-right text-green-700">{m.entrada > 0 ? fmtQty(m.entrada) : "—"}</td>
              <td className="py-1.5 px-2 text-right text-red-600">{m.saida > 0 ? fmtQty(m.saida) : "—"}</td>
              <td className="py-1.5 px-2 text-right font-semibold">{fmtQty(m.saldo)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-300 bg-gray-50">
            <td colSpan={4} className="py-1.5 px-2 text-[12px] font-medium text-gray-600">Saldo Atual</td>
            <td className="py-1.5 px-2 text-right font-semibold text-[13px]">{fmtQty(record.quantity)}</td>
          </tr>
        </tfoot>
      </table>
    );
  };

  return (
    <div className="p-6 w-full">

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span style={{ background: DS.accentBg, color: DS.accentText }}
              className="text-[15px] font-semibold px-3 py-1 rounded-full">
              ◆ Societário
            </span>
          </div>
          <h1 className="text-xl font-medium text-gray-900">Acionistas e Participações</h1>
          <p className="text-[15px] text-gray-400 mt-0.5">
            Livro de Registro · Livro de Transferência · {activeCompany.legalName}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePdf} disabled={pdfLoading}
            className="flex items-center gap-2 px-3.5 py-2 text-[15px] border rounded-lg border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <FiDownload size={14} />
            {pdfLoading ? 'Gerando...' : 'Gerar PDF'}
          </button>
          <button onClick={() => tab === 'registro' ? setShowMovementModal(true) : setShowModalTransf(true)}
            className="flex items-center gap-2 px-4 py-2 text-[15px] rounded-lg font-medium text-white"
            style={{ background: '#111' }}>
            <FiPlus size={14} />
            {tab === 'registro' ? 'Novo Registro' : 'Nova Transferência'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      {summary && (
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Titulares Ativos', value: summary.holdersCount, sub: '' },
            { label: 'Total de Quotas/Ações', value: fmtQty(summary.totalShares), sub: '' },
            { label: 'Capital Social', value: `R$ ${fmtBRL(summary.totalCapital)}`, sub: '' },
            { label: 'Transferências', value: transfers.length, sub: `${transfers.filter(t => t.averbacaoDate).length} averbada(s)` },
          ].map(k => (
            <div key={k.label} className="bg-[#F9FAFB] rounded-[10px] px-4 py-3.5">
              <div className="text-[15px] uppercase tracking-wide text-gray-400">{k.label}</div>
              <div className="text-[22px] font-medium text-gray-900 mt-0.5">{k.value}</div>
              {k.sub && <div className="text-[14px] text-gray-400 mt-0.5">{k.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[15px] flex items-center gap-2">
          <FiAlertCircle size={16} /> {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab("registro")}
          className={["flex items-center gap-2 px-5 py-2.5 rounded-lg text-[15px] font-medium transition-all border", tab === "registro" ? "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"].join(" ")}>
          Livro de Registro
        </button>
        <button onClick={() => setTab("transferencia")}
          className={["flex items-center gap-2 px-5 py-2.5 rounded-lg text-[15px] font-medium transition-all border", tab === "transferencia" ? "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"].join(" ")}>
          Livro de Transferência
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="relative flex-1 max-w-xs">
          <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou CPF/CNPJ..."
            className="w-full pl-8 pr-3 py-1.5 text-[15px] border border-gray-200 rounded-lg bg-white text-gray-800 outline-none focus:border-blue-400" />
        </div>
        {tab === 'registro' && (
          <div className="flex gap-1.5">
            {['todos', 'QUOTA', 'ORDINARIA', 'PREFERENCIAL'].map(f => (
              <button key={f} onClick={() => setFilterTipo(f)}
                className={`px-3 py-1 rounded-full text-[14px] border transition-colors ${filterTipo === f
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                {f === 'todos' ? 'Todos' : f === 'QUOTA' ? 'Quotas' : f === 'ORDINARIA' ? 'ON' : 'PN'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Tab Registro ────────────────────────────────────────────────────── */}
      {tab === 'registro' && (
        <div className="border border-gray-200 rounded-[10px] overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400 text-[15px]">Carregando...</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={DS.th}>#</th>
                  <th className={DS.th}>Titular</th>
                  <th className={DS.th}>Tipo</th>
                  <th className={`${DS.th} text-right`}>Quantidade</th>
                  <th className={`${DS.th} text-right`}>Vl. Nominal</th>
                  <th className={`${DS.th} text-right`}>Total (R$)</th>
                  <th className={`${DS.th} text-center`}>Participação</th>
                  <th className={`${DS.th} text-center`}>Integr.</th>
                  <th className={`${DS.th} text-center`}>Dt. Integr.</th>
                  <th className={`${DS.th} text-center`}>Dt. Subscr.</th>
                  <th className={`${DS.th} text-center`}>Nº Certif.</th>
                  <th className={`${DS.th} text-center`}>Gravame</th>
                  <th className={DS.th}></th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-[15px] text-gray-400">
                    Nenhum registro encontrado
                  </td></tr>
                ) : filteredRecords.map((r, i) => (
                  <React.Fragment key={r.id}>
                    <tr onClick={() => handleExpandHolder(r.id)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                      <td className={`${DS.td} text-gray-400`}>{i + 1}</td>
                      <td className={DS.td}>
                        <div className="font-medium text-gray-900">{r.holderName}</div>
                        <div className="text-[15px] text-gray-400 font-mono">{fmtCPFCNPJ(r.holderTaxId)} · {r.holderType}</div>
                        {r.notes && <div className="text-[13px] text-amber-700 italic mt-0.5">⚠ {r.notes}</div>}
                      </td>
                      <td className={DS.td}>
                        <span className={["px-2 py-0.5 rounded-full text-[15px] font-semibold", r.shareType === "QUOTA" ? "bg-[#ECFEFF] text-[#0E7490]" : r.shareType === "ORDINARIA" ? "bg-[#EFF6FF] text-[#1D4ED8]" : "bg-[#FAF5FF] text-[#6D28D9]"].join(" ")}>
                          {r.shareType === "QUOTA" ? "Quota" : r.shareType === "ORDINARIA" ? "ON" : "PN"}
                        </span>
                        {r.series && <span className="ml-1 text-[15px] text-gray-400">Série {r.series}</span>}
                      </td>
                      <td className={`${DS.td} text-right font-mono`}>{fmtQty(r.quantity)}</td>
                      <td className={`${DS.td} text-right`}>R$ {fmtBRL(r.nominalValue)}</td>
                      <td className={`${DS.td} text-right font-medium`}>R$ {fmtBRL(r.totalValue)}</td>
                      <td className={`${DS.td} text-center`}>
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(Number(r.percentOwned), 100)}%` }} />
                          </div>
                          <span className="text-[14px] font-medium">{fmtPct(r.percentOwned)}%</span>
                        </div>
                      </td>
                      <td className={`${DS.td} text-center`}>
                        <span className={["px-2 py-0.5 rounded-full text-[15px] font-semibold", r.isFullyPaid ? "bg-[#F0FDF4] text-[#15803D]" : "bg-[#FEFCE8] text-[#854D0E]"].join(" ")}>
                          {r.isFullyPaid ? "Sim" : "Parcial"}
                        </span>
                      </td>
                      <td className={`${DS.td} text-center text-[13px] text-gray-500`}>{fmtDate(r.integralizationDate)}</td>
                      <td className={`${DS.td} text-center text-[13px] text-gray-500`}>{fmtDate(r.subscriptionDate)}</td>
                      <td className={`${DS.td} text-center text-[13px] text-gray-500`}>{r.certificateNumber ?? "—"}</td>
                      <td className={`${DS.td} text-center`}>
                        {r.hasEncumbrance
                          ? <span className="px-2 py-0.5 rounded-full text-[15px] font-semibold bg-[#FEF2F2] text-[#B91C1C]">Sim</span>
                          : <span className="text-[14px] text-gray-400">Não</span>}
                      </td>
                      <td className={DS.td}>
                        <button onClick={(e) => { e.stopPropagation(); handleEditReg(r); }}
                          className="px-2.5 py-1 text-[13px] border border-gray-200 rounded-md bg-white hover:bg-gray-50 text-gray-600">
                          Editar
                        </button>
                      </td>
                    </tr>
                    {expandedHolder === r.id && (
                      <tr className="bg-[#F0F9FF] border-b border-blue-100">
                        <td colSpan={11} className="px-6 py-4">
                          <HolderExtratoRow record={r} detail={holderDetail[r.id]} />

                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
              {filteredRecords.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td className="px-3.5 py-2.5 text-[14px] text-gray-400" colSpan={3}>{filteredRecords.length} titular(es)</td>
                    <td className="px-3.5 py-2.5 text-[15px] font-medium text-right font-mono">{fmtQty(filteredRecords.reduce((s, r) => s + Number(r.quantity), 0))}</td>
                    <td />
                    <td className="px-3.5 py-2.5 text-[15px] font-medium text-right">R$ {fmtBRL(filteredRecords.reduce((s, r) => s + Number(r.totalValue), 0))}</td>
                    <td className="px-3.5 py-2.5 text-[15px] font-medium text-center">{fmtPct(filteredRecords.reduce((s, r) => s + Number(r.percentOwned), 0))}%</td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      )}

      {/* ── Tab Transferência ───────────────────────────────────────────────── */}
      {tab === 'transferencia' && (
        <div className="border border-gray-200 rounded-[10px] overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400 text-[15px]">Carregando...</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={DS.th}>No</th>
                  <th className={DS.th}>Data</th>
                  <th className={DS.th}>Cedente</th>
                  <th className={DS.th} />
                  <th className={DS.th}>Cessionário</th>
                  <th className={`${DS.th} text-right`}>Qtd.</th>
                  <th className={`${DS.th} text-right`}>Vl. Cessão</th>
                  <th className={`${DS.th} text-center`}>Motivo</th>
                  <th className={`${DS.th} text-center`}>Averbação</th>
                  <th className={DS.th} />
                </tr>
              </thead>
              <tbody>
                {filteredTransfers.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-12 text-[15px] text-gray-400">Nenhuma transferência registrada</td></tr>
                ) : filteredTransfers.map((t, i) => (
                  <React.Fragment key={t.id}>
                    <tr onClick={() => setExpandedTransfer(expandedTransfer === t.id ? null : t.id)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                      <td className={`${DS.td} text-gray-400`}>{i + 1}</td>
                      <td className={`${DS.td} text-[14px]`}>{fmtDate(t.transferDate)}</td>
                      <td className={DS.td}>
                        <div className="font-medium text-[15px]">{t.fromRecord.holderName}</div>
                        <div className="text-[15px] text-gray-400 font-mono">{t.fromRecord.holderTaxId}</div>
                      </td>
                      <td className={`${DS.td} text-gray-400 text-center`}>→</td>
                      <td className={DS.td}>
                        <div className="font-medium text-[15px]">{t.toRecord.holderName}</div>
                        <div className="text-[15px] text-gray-400 font-mono">{t.toRecord.holderTaxId}</div>
                      </td>
                      <td className={`${DS.td} text-right font-mono`}>{fmtQty(t.quantity)}</td>
                      <td className={`${DS.td} text-right font-medium`}>R$ {fmtBRL(t.transferValue)}</td>
                      <td className={`${DS.td} text-center`}>
                        <span className="px-2 py-0.5 rounded-full text-[15px] border border-gray-200 bg-gray-50 text-gray-600">
                          {REASON_LABEL[t.reason] ?? t.reason}
                        </span>
                      </td>
                      <td className={`${DS.td} text-center`}>
                        {t.averbacaoDate
                          ? <span className="px-2 py-0.5 rounded-full text-[15px] font-semibold bg-[#F0FDF4] text-[#15803D]">✓ {fmtDate(t.averbacaoDate)}</span>
                          : <span className="px-2 py-0.5 rounded-full text-[15px] font-semibold bg-[#FEFCE8] text-[#854D0E]">Pendente</span>}
                      </td>
                      <td className={DS.td}>
                        {!t.averbacaoDate && (
                          <button onClick={(e) => { e.stopPropagation(); handleAverbar(t.id); }}
                            className="px-2.5 py-1 text-[14px] border border-gray-200 rounded-md bg-white hover:bg-gray-50 text-gray-600">
                            Averbar
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedTransfer === t.id && (
                      <tr className="bg-blue-50 border-b border-blue-100">
                        <td colSpan={10} className="px-6 py-4">
                          <div className="grid grid-cols-4 gap-4 text-[13px]">
                            <div><span className="text-gray-500 block text-[11px] uppercase tracking-wide mb-1">Nº Ordem</span><span className="font-medium">{String(i + 1).padStart(4, '0')}</span></div>
                            <div><span className="text-gray-500 block text-[11px] uppercase tracking-wide mb-1">Data do Ato</span><span className="font-medium">{fmtDate(t.transferDate)}</span></div>
                            <div><span className="text-gray-500 block text-[11px] uppercase tracking-wide mb-1">Motivo</span><span className="font-medium">{REASON_LABEL[t.reason] ?? t.reason}</span></div>
                            <div><span className="text-gray-500 block text-[11px] uppercase tracking-wide mb-1">Valor da Cessão</span><span className="font-medium">R$ {fmtBRL(t.transferValue)}</span></div>
                            <div><span className="text-gray-500 block text-[11px] uppercase tracking-wide mb-1">Cedente</span><span className="font-medium">{t.fromRecord.holderName}</span><div className="text-[11px] text-gray-400 font-mono">{fmtCPFCNPJ(t.fromRecord.holderTaxId)}</div></div>
                            <div><span className="text-gray-500 block text-[11px] uppercase tracking-wide mb-1">Cessionário</span><span className="font-medium">{t.toRecord.holderName}</span><div className="text-[11px] text-gray-400 font-mono">{fmtCPFCNPJ(t.toRecord.holderTaxId)}</div></div>
                            <div><span className="text-gray-500 block text-[11px] uppercase tracking-wide mb-1">Quantidade</span><span className="font-medium">{fmtQty(t.quantity)} ações</span></div>
                            <div><span className="text-gray-500 block text-[11px] uppercase tracking-wide mb-1">Averbação</span><span className="font-medium">{t.averbacaoDate ? fmtDate(t.averbacaoDate) : 'Pendente'}</span></div>
                            {t.instrumentType && <div className="col-span-2"><span className="text-gray-500 block text-[11px] uppercase tracking-wide mb-1">Instrumento</span><span className="font-medium">{t.instrumentType}</span></div>}
                            {t.notaryOffice && <div className="col-span-2"><span className="text-gray-500 block text-[11px] uppercase tracking-wide mb-1">Cartório</span><span className="font-medium">{t.notaryOffice}</span></div>}
                            {t.notes && <div className="col-span-4"><span className="text-gray-500 block text-[11px] uppercase tracking-wide mb-1">Observações</span><span className="font-medium">{t.notes}</span></div>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <ShareMovementModal
        isOpen={showMovementModal}
        onClose={() => setShowMovementModal(false)}
        onSuccess={load}
        existingRecords={records}
      />

      {showModalReg && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={e => { if (e.target === e.currentTarget) { setShowModalReg(false); setEditingRecord(null); } }}>
          <div className="bg-white rounded-[14px] border border-gray-200 p-6 w-[520px] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-[16px] font-medium text-gray-900">{editingRecord ? "Editar Registro" : "Novo Registro de Titular"}</h3>
              <button onClick={() => { setShowModalReg(false); setEditingRecord(null); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              {[
                {
                  label: 'Tipo de Sociedade', col: 2, el: (
                    <select value={formReg.entryType} onChange={e => setFormReg(p => ({ ...p, entryType: e.target.value }))}
                      className="w-full px-3 py-1.5 text-[15px] border border-gray-200 rounded-lg">
                      <option value="LTDA">Ltda — Quotas</option>
                      <option value="SA">S/A — Ações</option>
                    </select>
                  )
                },
                {
                  label: 'Nome do Titular', col: 2, el: (
                    <input value={formReg.holderName} onChange={e => setFormReg(p => ({ ...p, holderName: e.target.value }))}
                      placeholder="Nome completo ou Razão Social"
                      className="w-full px-3 py-1.5 text-[15px] border border-gray-200 rounded-lg" />
                  )
                },

                {
                  label: 'CPF / CNPJ', col: 1, el: (
                    <div>
                      <div className="relative">
                        <input value={formReg.holderTaxId}
                          onChange={e => { setFormReg(p => ({ ...p, holderTaxId: e.target.value })); setPersonLookup('idle'); }}
                          onBlur={e => handleCpfLookup(e.target.value)}
                          placeholder="000.000.000-00"
                          className="w-full px-3 py-1.5 text-[15px] border border-gray-200 rounded-lg" />
                        {personLookup === 'loading' && <span className="absolute right-3 top-2 text-[12px] text-gray-400">Buscando...</span>}
                      </div>
                      {personLookup === 'found' && <p className="text-[12px] text-green-600 mt-1">✓ Pessoa encontrada — dados preenchidos automaticamente</p>}
                      {personLookup === 'not_found' && (
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-[13px] text-amber-600">⚠ Pessoa não cadastrada</p>
                        <button type="button"
                          onClick={() => window.open('/app/persons/new?cpf=' + formReg.holderTaxId.replace(/\D/g, ''), '_blank')}
                          className="text-[13px] text-blue-600 underline hover:text-blue-800">
                          Cadastrar em Pessoas Físicas →
                        </button>
                      </div>
                    )}
                    </div>
                  )
                },
                {
                  label: 'Tipo de Pessoa', col: 1, el: (
                    <select value={formReg.holderType} onChange={e => setFormReg(p => ({ ...p, holderType: e.target.value }))}
                      className="w-full px-3 py-1.5 text-[15px] border border-gray-200 rounded-lg">
                      <option value="PF">Pessoa Física</option>
                      <option value="PJ">Pessoa Jurídica</option>
                    </select>
                  )
                },
                {
                  label: 'Tipo de Ação/Quota', col: 1, el: (
                    <select value={formReg.shareType} onChange={e => setFormReg(p => ({ ...p, shareType: e.target.value }))}
                      className="w-full px-3 py-1.5 text-[15px] border border-gray-200 rounded-lg">
                      <option value="QUOTA">Quota</option>
                      <option value="ORDINARIA">Ordinária (ON)</option>
                      <option value="PREFERENCIAL">Preferencial (PN)</option>
                    </select>
                  )
                },
                {
                  label: 'Série', col: 1, el: (
                    <input value={formReg.series} onChange={e => setFormReg(p => ({ ...p, series: e.target.value }))}
                      placeholder="A, B… (opcional)"
                      className="w-full px-3 py-1.5 text-[15px] border border-gray-200 rounded-lg" />
                  )
                },
                {
                  label: 'Quantidade', col: 1, el: (
                    <input type="number" value={formReg.quantity} onChange={e => setFormReg(p => ({ ...p, quantity: e.target.value }))}
                      className="w-full px-3 py-1.5 text-[15px] border border-gray-200 rounded-lg" />
                  )
                },
                {
                  label: 'Valor Nominal (R$)', col: 1, el: (
                    <input type="number" step="0.01" value={formReg.nominalValue} onChange={e => setFormReg(p => ({ ...p, nominalValue: e.target.value }))}
                      className="w-full px-3 py-1.5 text-[15px] border border-gray-200 rounded-lg" />
                  )
                },
                {
                  label: '% do Capital', col: 1, el: (
                    <input type="number" step="0.01" value={formReg.percentOwned} onChange={e => setFormReg(p => ({ ...p, percentOwned: e.target.value }))}
                      className="w-full px-3 py-1.5 text-[15px] border border-gray-200 rounded-lg" />
                  )
                },
                {
                  label: 'Data de Integralização', col: 1, el: (
                    <input type="date" value={formReg.integralizationDate} onChange={e => setFormReg(p => ({ ...p, integralizationDate: e.target.value }))}
                      className="w-full px-3 py-1.5 text-[15px] border border-gray-200 rounded-lg" />
                  )
                },
                {
                  label: 'Capital Integralizado?', col: 2, el: (
                    <div className="flex items-center gap-3 mt-1">
                      <input type="checkbox" id="isFullyPaid" checked={formReg.isFullyPaid}
                        onChange={e => setFormReg(p => ({ ...p, isFullyPaid: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer" />
                      <label htmlFor="isFullyPaid" className="text-[15px] text-gray-700 cursor-pointer">
                        Sim — capital totalmente integralizado
                      </label>
                    </div>
                  )
                },

                {
                  label: 'Observações / Gravames', col: 2, el: (
                    <input value={formReg.notes} onChange={e => setFormReg(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Penhor, usufruto, restrição..."
                      className="w-full px-3 py-1.5 text-[15px] border border-gray-200 rounded-lg" />
                  )
                },
              ].map(({ label, col, el }) => (
                <div key={label} className={col === 2 ? 'col-span-2' : ''}>
                  <label className="block text-[14px] text-gray-500 mb-1">{label}</label>
                  {el}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
              <button onClick={() => { setShowModalReg(false); setEditingRecord(null); }}
                className="px-4 py-2 text-[15px] border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSaveReg}
                className="px-4 py-2 text-[15px] rounded-lg font-medium text-white bg-gray-900 hover:bg-gray-800">
                Salvar Registro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Nova Transferência ────────────────────────────────────────── */}
      {showModalTransf && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={e => e.target === e.currentTarget && setShowModalTransf(false)}>
          <div className="bg-white rounded-[14px] border border-gray-200 p-6 w-[520px] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-[16px] font-medium text-gray-900">Nova Transferência</h3>
              <button onClick={() => setShowModalTransf(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              {[
                {
                  label: 'Cedente (de)', col: 2, el: (
                    <select value={formTransf.fromRecordId} onChange={e => setFormTransf(p => ({ ...p, fromRecordId: e.target.value }))}
                      className="w-full px-3 py-1.5 text-[15px] border border-gray-200 rounded-lg">
                      <option value="">Selecione o cedente</option>
                      {records.filter(r => r.isActive).map(r => (
                        <option key={r.id} value={r.id}>{r.holderName} ({fmtQty(r.quantity)} {r.shareType})</option>
                      ))}
                    </select>
                  )
                },
                {
                  label: 'Cessionário (para)', col: 2, el: (
                    <select value={formTransf.toRecordId} onChange={e => setFormTransf(p => ({ ...p, toRecordId: e.target.value }))}
                      className="w-full px-3 py-1.5 text-[15px] border border-gray-200 rounded-lg">
                      <option value="">Selecione o cessionário</option>
                      {records.filter(r => r.isActive).map(r => (
                        <option key={r.id} value={r.id}>{r.holderName}</option>
                      ))}
                    </select>
                  )
                },
                {
                  label: 'Quantidade', col: 1, el: (
                    <input type="number" value={formTransf.quantity} onChange={e => setFormTransf(p => ({ ...p, quantity: e.target.value }))}
                      className="w-full px-3 py-1.5 text-[15px] border border-gray-200 rounded-lg" />
                  )
                },
                {
                  label: 'Valor da Cessão (R$)', col: 1, el: (
                    <input type="number" step="0.01" value={formTransf.transferValue} onChange={e => setFormTransf(p => ({ ...p, transferValue: e.target.value }))}
                      className="w-full px-3 py-1.5 text-[15px] border border-gray-200 rounded-lg" />
                  )
                },
                {
                  label: 'Data da Transferência', col: 1, el: (
                    <input type="date" value={formTransf.transferDate} onChange={e => setFormTransf(p => ({ ...p, transferDate: e.target.value }))}
                      className="w-full px-3 py-1.5 text-[15px] border border-gray-200 rounded-lg" />
                  )
                },
                {
                  label: 'Motivo', col: 1, el: (
                    <select value={formTransf.reason} onChange={e => setFormTransf(p => ({ ...p, reason: e.target.value }))}
                      className="w-full px-3 py-1.5 text-[15px] border border-gray-200 rounded-lg">
                      {Object.entries(REASON_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  )
                },
                {
                  label: 'Instrumento', col: 1, el: (
                    <input value={formTransf.instrumentType} onChange={e => setFormTransf(p => ({ ...p, instrumentType: e.target.value }))}
                      placeholder="Contrato de Cessão, Escritura..."
                      className="w-full px-3 py-1.5 text-[15px] border border-gray-200 rounded-lg" />
                  )
                },
                {
                  label: 'Data do Instrumento', col: 1, el: (
                    <input type="date" value={formTransf.instrumentDate} onChange={e => setFormTransf(p => ({ ...p, instrumentDate: e.target.value }))}
                      className="w-full px-3 py-1.5 text-[15px] border border-gray-200 rounded-lg" />
                  )
                },
                {
                  label: 'Cartório / Observações', col: 2, el: (
                    <input value={formTransf.notes} onChange={e => setFormTransf(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Cartório, livro, página..."
                      className="w-full px-3 py-1.5 text-[15px] border border-gray-200 rounded-lg" />
                  )
                },
              ].map(({ label, col, el }) => (
                <div key={label} className={col === 2 ? 'col-span-2' : ''}>
                  <label className="block text-[14px] text-gray-500 mb-1">{label}</label>
                  {el}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
              <button onClick={() => setShowModalTransf(false)}
                className="px-4 py-2 text-[15px] border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSaveTransf}
                className="px-4 py-2 text-[15px] rounded-lg font-medium text-white bg-gray-900 hover:bg-gray-800">
                Registrar Transferência
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShareholdersPage;







































