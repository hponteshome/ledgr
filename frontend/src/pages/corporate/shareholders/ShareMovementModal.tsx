// frontend/src/pages/corporate/shareholders/ShareMovementModal.tsx
import React, { useState, useEffect } from 'react';
import { FiX, FiChevronRight, FiChevronLeft, FiSearch, FiCheck, FiAlertCircle } from 'react-icons/fi';
import api from '../../../services/api';
import { useCompany } from '../../../contexts/CompanyContext';

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface ShareholderRecord {
  id: string;
  holderName: string;
  holderTaxId: string;
  holderType: string;
  shareType: string;
  quantity: string;
  nominalValue: string;
  totalValue: string;
  percentOwned: string;
  isFullyPaid: boolean;
  series?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingRecords: ShareholderRecord[];
}

// ── Constantes ────────────────────────────────────────────────────────────────
const ADDITION_TYPES = [
  { value: 'LANCAMENTO_INICIAL', label: 'Lançamento Inicial / Abertura de Livro', desc: 'Migração de livro em papel para digital' },
  { value: 'SUBSCRICAO', label: 'Subscrição de Capital', desc: 'Novo titular entra no quadro societário' },
  { value: 'AUMENTO_CAPITAL', label: 'Aumento de Capital', desc: 'Titular existente aumenta sua participação' },
  { value: 'BONIFICACAO', label: 'Bonificação', desc: 'Emissão por incorporação de reservas' },
  { value: 'CISAO_INCORPORACAO', label: 'Cisão / Incorporação', desc: 'Reorganização societária' },
];

const REDUCTION_TYPES = [
  { value: 'COMPRA_VENDA', label: 'Alienação (Compra e Venda)', desc: 'Cessão onerosa entre partes' },
  { value: 'DOACAO', label: 'Doação', desc: 'Transmissão gratuita' },
  { value: 'HERANCA', label: 'Herança', desc: 'Sucessão causa mortis' },
  { value: 'REDUCAO_CAPITAL', label: 'Redução de Capital', desc: 'Devolução ao titular com redução do capital social' },
  { value: 'AMORTIZACAO', label: 'Amortização de Ações', desc: 'Antecipação de haveres sem redução do capital' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtCPFCNPJ = (v: string) => {
  const d = v.replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return v;
};
const fmtNum = (v: string | number) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

// ── Componente ────────────────────────────────────────────────────────────────
const ShareMovementModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, existingRecords }) => {
  const { activeCompany } = useCompany();

  // Detectar tipo societário pelo legalName
  const entryType = activeCompany?.legalName?.toUpperCase().includes('S/A') ||
    activeCompany?.legalName?.toUpperCase().includes('S.A') ? 'SA' : 'LTDA';
  const shareLabel = entryType === 'SA' ? 'Ações' : 'Quotas';

  // ── Steps ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [operationType, setOperationType] = useState<'adicao' | 'reducao' | null>(null);
  const [movementType, setMovementType] = useState('');

  // ── Form Adição ────────────────────────────────────────────────────────────
  const [addForm, setAddForm] = useState({
    holderTaxId: '', holderName: '', holderType: 'PF',
    shareType: entryType === 'SA' ? 'ORDINARIA' : 'QUOTA',
    series: '', quantity: '', nominalValue: '1',
    percentOwned: '', subscriptionDate: '', integralizationDate: '',
    isFullyPaid: false, certificateNumber: '', shareNumberFrom: '', shareNumberTo: '',
    notes: '',
  });
  const [personLookup, setPersonLookup] = useState<'idle' | 'loading' | 'found' | 'not_found'>('idle');

  // ── Form Redução ───────────────────────────────────────────────────────────
  const [redForm, setRedForm] = useState({
    fromRecordId: '',
    quantity: '', transferValue: '', transferDate: '',
    instrumentType: '', instrumentDate: '', notaryOffice: '', bookNumber: '', pageNumber: '',
    // Cessionário
    toTaxId: '', toName: '', toHolderType: 'PF',
    toExistingRecordId: '', // se já é acionista
    notes: '',
  });
  const [toPersonLookup, setToPersonLookup] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'existing'>('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── Reset ao abrir ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setOperationType(null);
      setMovementType('');
      setAddForm({
        holderTaxId: '', holderName: '', holderType: 'PF',
        shareType: entryType === 'SA' ? 'ORDINARIA' : 'QUOTA',
        series: '', quantity: '', nominalValue: '1',
        percentOwned: '', subscriptionDate: '', integralizationDate: '',
        isFullyPaid: false, certificateNumber: '', shareNumberFrom: '', shareNumberTo: '',
        notes: '',
      });
      setRedForm({
        fromRecordId: '', quantity: '', transferValue: '', transferDate: '',
        instrumentType: '', instrumentDate: '', notaryOffice: '', bookNumber: '', pageNumber: '',
        toTaxId: '', toName: '', toHolderType: 'PF', toExistingRecordId: '', notes: '',
      });
      setPersonLookup('idle');
      setToPersonLookup('idle');
      setError('');
    }
  }, [isOpen]);

  // ── Lookup CPF adição ──────────────────────────────────────────────────────
  const handleAddCpfLookup = async (cpf: string) => {
    const clean = cpf.replace(/\D/g, '');
    if (clean.length < 11) return;
    setPersonLookup('loading');
    try {
      const res = await api.get(`/persons/cpf/${clean}`);
      setAddForm(p => ({ ...p, holderName: res.data.fullName ?? p.holderName, holderType: res.data.documentType === 'CNPJ' ? 'PJ' : 'PF' }));
      setPersonLookup('found');
    } catch {
      setPersonLookup('not_found');
    }
  };

  // ── Lookup CPF cessionário ─────────────────────────────────────────────────
  const handleToCpfLookup = async (cpf: string) => {
    const clean = cpf.replace(/\D/g, '');
    if (clean.length < 11) return;
    if (clean.length !== 11 && clean.length !== 14) return;
    setToPersonLookup('loading');
    // Verificar se já é acionista existente
    const existing = existingRecords.find(r => r.holderTaxId.replace(/\D/g, '') === clean);
    if (existing) {
      setRedForm(p => ({ ...p, toName: existing.holderName, toHolderType: existing.holderType, toExistingRecordId: existing.id }));
      setToPersonLookup('existing');
      return;
    }
    try {
      if (clean.length === 14) {
        // CNPJ — buscar em companies
        const res = await api.get('/companies/taxid/' + clean).catch(() => null);
        const company = res?.data;
        if (company) {
          setRedForm(p => ({ ...p, toName: company.legalName ?? p.toName, toHolderType: 'PJ', toExistingRecordId: '' }));
          setToPersonLookup('found');
        } else {
          setToPersonLookup('not_found');
        }
      } else {
        // CPF — buscar em persons
        const res = await api.get('/persons/cpf/' + clean);
        setRedForm(p => ({ ...p, toName: res.data.fullName ?? p.toName, toHolderType: 'PF', toExistingRecordId: '' }));
        setToPersonLookup('found');
      }
    } catch {
      setToPersonLookup('not_found');
    }
  };

  // ── Cedente selecionado ────────────────────────────────────────────────────
  const selectedCedente = existingRecords.find(r => r.id === redForm.fromRecordId);

  // ── Salvar ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (operationType === 'adicao') {
        // Criar ShareholderRecord
        await api.post('/corporate/shareholders', {
          entryType,
          holderName: addForm.holderName,
          holderTaxId: addForm.holderTaxId.replace(/\D/g, ''),
          holderType: addForm.holderType,
          shareType: addForm.shareType,
          series: addForm.series || undefined,
          quantity: Number(addForm.quantity),
          nominalValue: Number(addForm.nominalValue),
          percentOwned: Number(addForm.percentOwned),
          subscriptionDate: addForm.subscriptionDate || undefined,
          integralizationDate: addForm.integralizationDate || undefined,
          isFullyPaid: addForm.isFullyPaid,
          certificateNumber: addForm.certificateNumber || undefined,
          shareNumberFrom: addForm.shareNumberFrom ? Number(addForm.shareNumberFrom) : undefined,
          shareNumberTo: addForm.shareNumberTo ? Number(addForm.shareNumberTo) : undefined,
          notes: addForm.notes || undefined,
        });
      } else {
        // Redução — criar ou usar registro do cessionário
        let toRecordId = redForm.toExistingRecordId;

        if (!toRecordId) {
          // Criar novo ShareholderRecord zerado para o cessionário
          const res = await api.post('/corporate/shareholders', {
            entryType,
            holderName: redForm.toName,
            holderTaxId: redForm.toTaxId.replace(/\D/g, ''),
            holderType: redForm.toHolderType,
            shareType: selectedCedente?.shareType || (entryType === 'SA' ? 'ORDINARIA' : 'QUOTA'),
            quantity: 0,
            nominalValue: Number(selectedCedente?.nominalValue || 1),
            percentOwned: 0,
            isFullyPaid: false,
            notes: 'Registro criado automaticamente na transferência',
          });
          toRecordId = res.data.id;
        }

        // Criar ShareTransfer
        await api.post('/corporate/transfers', {
          entryType,
          fromRecordId: redForm.fromRecordId,
          toRecordId,
          shareType: selectedCedente?.shareType || (entryType === 'SA' ? 'ORDINARIA' : 'QUOTA'),
          quantity: Number(redForm.quantity),
          nominalValue: Number(selectedCedente?.nominalValue || 1),
          transferValue: Number(redForm.transferValue),
          transferDate: redForm.transferDate,
          reason: movementType,
          instrumentType: redForm.instrumentType || undefined,
          instrumentDate: redForm.instrumentDate || undefined,
          notaryOffice: redForm.notaryOffice || undefined,
          bookNumber: redForm.bookNumber || undefined,
          pageNumber: redForm.pageNumber || undefined,
          notes: redForm.notes || undefined,
        });
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Erro ao registrar movimento.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  // ── DS tokens ──────────────────────────────────────────────────────────────
  const inputCls = 'w-full px-3 py-2 text-[14px] border border-gray-200 rounded-lg bg-white text-gray-800 outline-none focus:border-blue-400';
  const labelCls = 'block text-[12px] text-gray-500 mb-1 font-medium';

  // ── Render Step 1 ──────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-5">
      <p className="text-[13px] text-gray-500">Selecione o tipo de operação para {activeCompany?.legalName}:</p>

      {/* Adição ou Redução */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: 'adicao', title: 'Adição', desc: 'Novo titular ou aumento de participação', color: 'blue' },
          { key: 'reducao', title: 'Redução / Transferência', desc: 'Cessão, doação, herança ou redução de capital', color: 'amber' },
        ].map(opt => (
          <button key={opt.key} onClick={() => setOperationType(opt.key as any)}
            className={[
              'p-4 rounded-lg border-2 text-left transition-all',
              operationType === opt.key
                ? opt.color === 'blue' ? 'border-blue-500 bg-blue-50' : 'border-amber-500 bg-amber-50'
                : 'border-gray-200 bg-white hover:border-gray-300',
            ].join(' ')}>
            <div className={['font-medium text-[15px]', operationType === opt.key ? (opt.color === 'blue' ? 'text-blue-700' : 'text-amber-700') : 'text-gray-800'].join(' ')}>
              {opt.title}
            </div>
            <div className="text-[12px] text-gray-500 mt-1">{opt.desc}</div>
          </button>
        ))}
      </div>

      {/* Subtipo */}
      {operationType && (
        <div>
          <label className={labelCls}>Tipo específico de {operationType === 'adicao' ? 'adição' : 'redução'}</label>
          <div className="space-y-2">
            {(operationType === 'adicao' ? ADDITION_TYPES : REDUCTION_TYPES).map(t => (
              <label key={t.value}
                className={[
                  'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                  movementType === t.value ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300',
                ].join(' ')}>
                <input type="radio" name="movType" value={t.value}
                  checked={movementType === t.value}
                  onChange={() => setMovementType(t.value)}
                  className="mt-0.5 text-blue-600" />
                <div>
                  <div className="text-[14px] font-medium text-gray-800">{t.label}</div>
                  <div className="text-[12px] text-gray-500">{t.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── Render Step 2 Adição ───────────────────────────────────────────────────
  const renderStep2Addition = () => (
    <div className="space-y-4">
      <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-[13px] text-blue-700">
        {ADDITION_TYPES.find(t => t.value === movementType)?.label} — {shareLabel} {entryType}
      </div>

      {/* CPF/CNPJ */}
      <div>
        <label className={labelCls}>CPF / CNPJ do Titular</label>
        <div className="relative">
          <input value={addForm.holderTaxId}
            onChange={e => { setAddForm(p => ({ ...p, holderTaxId: e.target.value })); setPersonLookup('idle'); }}
            onBlur={e => handleAddCpfLookup(e.target.value)}
            placeholder="000.000.000-00 ou 00.000.000/0000-00"
            className={inputCls} />
          {personLookup === 'loading' && <span className="absolute right-3 top-2.5 text-[12px] text-gray-400">Buscando...</span>}
        </div>
        {personLookup === 'found' && <p className="text-[12px] text-green-600 mt-1">✓ Pessoa encontrada — dados preenchidos automaticamente</p>}
        {personLookup === 'not_found' && (
          <div className="flex items-center gap-3 mt-1">
            <p className="text-[12px] text-amber-600">⚠ {addForm.holderTaxId.replace(/\D/g,'').length === 14 ? 'Empresa' : 'Pessoa'} não cadastrada</p>
            <button onClick={() => { const clean = addForm.holderTaxId.replace(/\D/g, ''); const isCnpj = clean.length === 14; window.open(isCnpj ? '/app/companies/new?cnpj=' + clean : '/app/persons/new?cpf=' + clean, '_blank'); }}
              className="text-[12px] text-blue-600 underline">{addForm.holderTaxId.replace(/\D/g,'').length === 14 ? 'Cadastrar Empresa →' : 'Cadastrar Pessoa Física →'}</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Nome */}
        <div className="col-span-2">
          <label className={labelCls}>Nome / Razão Social</label>
          <input value={addForm.holderName} onChange={e => setAddForm(p => ({ ...p, holderName: e.target.value }))}
            placeholder="Preenchido automaticamente pelo CPF/CNPJ"
            className={inputCls} />
        </div>

        {/* Tipo de Pessoa */}
        <div>
          <label className={labelCls}>Tipo de Pessoa</label>
          <select value={addForm.holderType} onChange={e => setAddForm(p => ({ ...p, holderType: e.target.value }))} className={inputCls}>
            <option value="PF">Pessoa Física</option>
            <option value="PJ">Pessoa Jurídica</option>
          </select>
        </div>

        {/* Tipo de ação */}
        <div>
          <label className={labelCls}>Tipo de {shareLabel.slice(0, -1)}</label>
          <select value={addForm.shareType} onChange={e => setAddForm(p => ({ ...p, shareType: e.target.value }))} className={inputCls}>
            {entryType === 'SA' ? (
              <>
                <option value="ORDINARIA">Ordinária (ON)</option>
                <option value="PREFERENCIAL">Preferencial (PN)</option>
              </>
            ) : (
              <option value="QUOTA">Quota</option>
            )}
          </select>
        </div>

        {/* Série (só SA) */}
        {entryType === 'SA' && (
          <div>
            <label className={labelCls}>Série</label>
            <input value={addForm.series} onChange={e => setAddForm(p => ({ ...p, series: e.target.value }))}
              placeholder="A, B… (opcional)" className={inputCls} />
          </div>
        )}

        {/* Quantidade */}
        <div>
          <label className={labelCls}>Quantidade de {shareLabel}</label>
          <input type="number" value={addForm.quantity} onChange={e => setAddForm(p => ({ ...p, quantity: e.target.value }))}
            className={inputCls} />
        </div>

        {/* Valor Nominal */}
        <div>
          <label className={labelCls}>Valor Nominal (R$)</label>
          <input type="number" step="0.01" value={addForm.nominalValue} onChange={e => setAddForm(p => ({ ...p, nominalValue: e.target.value }))}
            className={inputCls} />
        </div>

        {/* % Capital */}
        <div>
          <label className={labelCls}>% do Capital Social</label>
          <input type="number" step="0.01" value={addForm.percentOwned} onChange={e => setAddForm(p => ({ ...p, percentOwned: e.target.value }))}
            className={inputCls} />
        </div>

        {/* Nº Certificado (SA) */}
        {entryType === 'SA' && (
          <>
            <div>
              <label className={labelCls}>Nº Certificado</label>
              <input value={addForm.certificateNumber} onChange={e => setAddForm(p => ({ ...p, certificateNumber: e.target.value }))}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Ações nº (de)</label>
              <input type="number" value={addForm.shareNumberFrom} onChange={e => setAddForm(p => ({ ...p, shareNumberFrom: e.target.value }))}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Ações nº (até)</label>
              <input type="number" value={addForm.shareNumberTo} onChange={e => setAddForm(p => ({ ...p, shareNumberTo: e.target.value }))}
                className={inputCls} />
            </div>
          </>
        )}

        {/* Datas */}
        <div>
          <label className={labelCls}>Data de Subscrição</label>
          <input type="date" value={addForm.subscriptionDate} onChange={e => setAddForm(p => ({ ...p, subscriptionDate: e.target.value }))}
            className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Data de Integralização</label>
          <input type="date" value={addForm.integralizationDate} onChange={e => setAddForm(p => ({ ...p, integralizationDate: e.target.value }))}
            className={inputCls} />
        </div>

        {/* Integralizado */}
        <div className="col-span-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={addForm.isFullyPaid} onChange={e => setAddForm(p => ({ ...p, isFullyPaid: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <span className="text-[14px] text-gray-700">Capital totalmente integralizado</span>
          </label>
        </div>

        {/* Observações */}
        <div className="col-span-2">
          <label className={labelCls}>Observações / Gravames</label>
          <input value={addForm.notes} onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Penhor, usufruto, restrição, notas de abertura de livro…" className={inputCls} />
        </div>
      </div>
    </div>
  );

  // ── Render Step 2 Redução ──────────────────────────────────────────────────
  const renderStep2Reduction = () => (
    <div className="space-y-4">
      <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[13px] text-amber-700">
        {REDUCTION_TYPES.find(t => t.value === movementType)?.label}
      </div>

      {/* Cedente */}
      <div>
        <label className={labelCls}>Cedente (titular que cede)</label>
        <select value={redForm.fromRecordId} onChange={e => setRedForm(p => ({ ...p, fromRecordId: e.target.value }))} className={inputCls}>
          <option value="">Selecione o cedente</option>
          {existingRecords.filter(r => Number(r.quantity) > 0).map(r => (
            <option key={r.id} value={r.id}>
              {r.holderName} — {Number(r.quantity).toLocaleString('pt-BR')} {r.shareType}{r.series ? ' Série ' + r.series : ''}
            </option>
          ))}
        </select>
        {selectedCedente && (
          <div className="mt-1.5 p-2 bg-gray-50 rounded-lg text-[12px] text-gray-600 flex gap-4">
            <span>{fmtCPFCNPJ(selectedCedente.holderTaxId)}</span>
            <span>Saldo: {Number(selectedCedente.quantity).toLocaleString('pt-BR')} {shareLabel}</span>
            <span>Vl. Nominal: R$ {fmtNum(selectedCedente.nominalValue)}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Quantidade */}
        <div>
          <label className={labelCls}>Quantidade a transferir</label>
          <input type="number" value={redForm.quantity}
            onChange={e => setRedForm(p => ({ ...p, quantity: e.target.value }))}
            max={selectedCedente ? Number(selectedCedente.quantity) : undefined}
            className={inputCls} />
          {selectedCedente && redForm.quantity && Number(redForm.quantity) > Number(selectedCedente.quantity) && (
            <p className="text-[12px] text-red-600 mt-1">⚠ Excede o saldo disponível ({Number(selectedCedente.quantity).toLocaleString('pt-BR')})</p>
          )}
        </div>

        {/* Valor da cessão (não para redução de capital / amortização) */}
        {!['REDUCAO_CAPITAL', 'AMORTIZACAO'].includes(movementType) && (
          <div>
            <label className={labelCls}>Valor da Cessão / Negócio (R$)</label>
            <input type="number" step="0.01" value={redForm.transferValue}
              onChange={e => setRedForm(p => ({ ...p, transferValue: e.target.value }))}
              className={inputCls} />
          </div>
        )}

        {/* Data */}
        <div>
          <label className={labelCls}>Data do Ato</label>
          <input type="date" value={redForm.transferDate}
            onChange={e => setRedForm(p => ({ ...p, transferDate: e.target.value }))}
            className={inputCls} />
        </div>

        {/* Instrumento */}
        <div>
          <label className={labelCls}>Instrumento</label>
          <input value={redForm.instrumentType}
            onChange={e => setRedForm(p => ({ ...p, instrumentType: e.target.value }))}
            placeholder="Contrato de Cessão, Escritura Pública, Inventário…"
            className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Data do Instrumento</label>
          <input type="date" value={redForm.instrumentDate}
            onChange={e => setRedForm(p => ({ ...p, instrumentDate: e.target.value }))}
            className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Cartório / Notas</label>
          <input value={redForm.notaryOffice}
            onChange={e => setRedForm(p => ({ ...p, notaryOffice: e.target.value }))}
            placeholder="Nome do cartório"
            className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Livro nº</label>
          <input value={redForm.bookNumber}
            onChange={e => setRedForm(p => ({ ...p, bookNumber: e.target.value }))}
            className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Folha / Página</label>
          <input value={redForm.pageNumber}
            onChange={e => setRedForm(p => ({ ...p, pageNumber: e.target.value }))}
            className={inputCls} />
        </div>
      </div>

      {/* Cessionário — só para transferências, não para redução/amortização */}
      {!['REDUCAO_CAPITAL', 'AMORTIZACAO'].includes(movementType) && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-[13px] font-medium text-gray-700 mb-3">Cessionário (destinatário)</p>

          <div>
            <label className={labelCls}>CPF / CNPJ do Cessionário</label>
            <div className="relative">
              <input value={redForm.toTaxId}
                onChange={e => { setRedForm(p => ({ ...p, toTaxId: e.target.value })); setToPersonLookup('idle'); }}
                onBlur={e => handleToCpfLookup(e.target.value)}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                className={inputCls} />
              {toPersonLookup === 'loading' && <span className="absolute right-3 top-2.5 text-[12px] text-gray-400">Buscando...</span>}
            </div>
            {toPersonLookup === 'existing' && (
              <p className="text-[12px] text-blue-600 mt-1">✓ Acionista existente: {redForm.toName}</p>
            )}
            {toPersonLookup === 'found' && (
              <p className="text-[12px] text-green-600 mt-1">✓ Pessoa encontrada: {redForm.toName} — será adicionada ao quadro</p>
            )}
            {toPersonLookup === 'not_found' && (
              <div className="flex items-center gap-3 mt-1">
                <p className="text-[12px] text-amber-600">⚠ {redForm.toTaxId.replace(/\D/g,'').length === 14 ? 'Empresa' : 'Pessoa'} não cadastrada</p>
                <button onClick={() => { const clean = redForm.toTaxId.replace(/\D/g, ''); const isCnpj = clean.length === 14; window.open(isCnpj ? '/app/companies/new?cnpj=' + clean : '/app/persons/new?cpf=' + clean, '_blank'); }}
                  className="text-[12px] text-blue-600 underline">{redForm.toTaxId.replace(/\D/g,'').length === 14 ? 'Cadastrar Empresa →' : 'Cadastrar Pessoa Física →'}</button>
              </div>
            )}
          </div>

          {(toPersonLookup === 'found' || toPersonLookup === 'existing') && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Nome / Razão Social</label>
                <input value={redForm.toName} onChange={e => setRedForm(p => ({ ...p, toName: e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Tipo de Pessoa</label>
                <select value={redForm.toHolderType} onChange={e => setRedForm(p => ({ ...p, toHolderType: e.target.value }))} className={inputCls}>
                  <option value="PF">Pessoa Física</option>
                  <option value="PJ">Pessoa Jurídica</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label className={labelCls}>Observações</label>
        <input value={redForm.notes} onChange={e => setRedForm(p => ({ ...p, notes: e.target.value }))}
          placeholder="Observações adicionais sobre o ato…" className={inputCls} />
      </div>
    </div>
  );

  // ── Render Step 3 Confirmação ──────────────────────────────────────────────
  const renderStep3 = () => {
    const isAdd = operationType === 'adicao';
    const movLabel = isAdd
      ? ADDITION_TYPES.find(t => t.value === movementType)?.label
      : REDUCTION_TYPES.find(t => t.value === movementType)?.label;

    return (
      <div className="space-y-4">
        <div className={['px-4 py-3 rounded-lg border text-[13px]', isAdd ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-amber-50 border-amber-200 text-amber-700'].join(' ')}>
          <div className="font-medium">{isAdd ? 'Adição' : 'Redução / Transferência'}</div>
          <div>{movLabel}</div>
        </div>

        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {isAdd ? (
            <>
              <Row label="Empresa" value={activeCompany?.legalName ?? ''} />
              <Row label="Titular" value={`${addForm.holderName} (${fmtCPFCNPJ(addForm.holderTaxId)})`} />
              <Row label="Tipo" value={`${addForm.shareType}${addForm.series ? ' Série ' + addForm.series : ''}`} />
              <Row label="Quantidade" value={`${Number(addForm.quantity).toLocaleString('pt-BR')} ${shareLabel}`} />
              <Row label="Valor Nominal" value={`R$ ${fmtNum(addForm.nominalValue)} por ${shareLabel.slice(0, -1)}`} />
              <Row label="Total" value={`R$ ${fmtNum(Number(addForm.quantity) * Number(addForm.nominalValue))}`} />
              <Row label="Participação" value={`${addForm.percentOwned}%`} />
              {addForm.integralizationDate && <Row label="Dt. Integralização" value={new Date(addForm.integralizationDate + 'T12:00:00').toLocaleDateString('pt-BR')} />}
              <Row label="Integralizado" value={addForm.isFullyPaid ? 'Sim' : 'Parcial'} />
            </>
          ) : (
            <>
              <Row label="Empresa" value={activeCompany?.legalName ?? ''} />
              <Row label="Cedente" value={`${selectedCedente?.holderName} (${fmtCPFCNPJ(selectedCedente?.holderTaxId ?? '')})`} />
              {!['REDUCAO_CAPITAL', 'AMORTIZACAO'].includes(movementType) && (
                <Row label="Cessionário" value={`${redForm.toName} (${fmtCPFCNPJ(redForm.toTaxId)})`} />
              )}
              <Row label="Quantidade" value={`${Number(redForm.quantity).toLocaleString('pt-BR')} ${shareLabel}`} />
              {redForm.transferValue && <Row label="Valor da Cessão" value={`R$ ${fmtNum(redForm.transferValue)}`} />}
              <Row label="Data do Ato" value={redForm.transferDate ? new Date(redForm.transferDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—'} />
              {redForm.instrumentType && <Row label="Instrumento" value={redForm.instrumentType} />}
              {redForm.notaryOffice && <Row label="Cartório" value={redForm.notaryOffice} />}
            </>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">
            <FiAlertCircle size={14} /> {error}
          </div>
        )}

        <p className="text-[12px] text-gray-400">
          Ao confirmar, {isAdd
            ? 'o registro será adicionado ao Livro de Registro de ' + shareLabel
            : 'o Livro de Registro e o Livro de Transferência serão atualizados simultaneamente'}.
        </p>
      </div>
    );
  };

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex px-4 py-2.5 gap-4">
      <span className="text-[12px] text-gray-500 w-36 flex-shrink-0">{label}</span>
      <span className="text-[13px] text-gray-800 font-medium">{value}</span>
    </div>
  );

  // ── Validação por step ─────────────────────────────────────────────────────
  const canProceed = () => {
    if (step === 1) return !!operationType && !!movementType;
    if (step === 2) {
      if (operationType === 'adicao') {
        return !!addForm.holderTaxId && !!addForm.holderName && !!addForm.quantity && Number(addForm.quantity) > 0;
      } else {
        const baseOk = !!redForm.fromRecordId && !!redForm.quantity && Number(redForm.quantity) > 0 && !!redForm.transferDate;
        const saldoOk = !selectedCedente || Number(redForm.quantity) <= Number(selectedCedente.quantity);
        const cessoOk = ['REDUCAO_CAPITAL', 'AMORTIZACAO'].includes(movementType) || (!!redForm.toTaxId && !!redForm.toName);
        return baseOk && saldoOk && cessoOk;
      }
    }
    return true;
  };

  const stepTitle = step === 1 ? 'Tipo de Operação' : step === 2 ? 'Dados do Movimento' : 'Confirmar Registro';

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-[14px] border border-gray-200 w-[580px] max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-[16px] font-medium text-gray-900">Movimento de {shareLabel}</h3>
            <p className="text-[12px] text-gray-400 mt-0.5">Passo {step} de 3 — {stepTitle}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            <FiX size={18} />
          </button>
        </div>

        {/* Progress */}
        <div className="flex gap-0 px-6 pt-3">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex-1 flex items-center gap-1">
              <div className={['w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium flex-shrink-0',
                step > s ? 'bg-blue-600 text-white' : step === s ? 'bg-blue-100 text-blue-700 border-2 border-blue-400' : 'bg-gray-100 text-gray-400',
              ].join(' ')}>
                {step > s ? <FiCheck size={12} /> : s}
              </div>
              {s < 3 && <div className={['flex-1 h-0.5', step > s ? 'bg-blue-400' : 'bg-gray-200'].join(' ')} />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 1 && renderStep1()}
          {step === 2 && operationType === 'adicao' && renderStep2Addition()}
          {step === 2 && operationType === 'reducao' && renderStep2Reduction()}
          {step === 3 && renderStep3()}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100">
          <button onClick={() => step > 1 ? setStep(s => (s - 1) as any) : onClose()}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50">
            <FiChevronLeft size={14} />
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>

          {step < 3 ? (
            <button onClick={() => setStep(s => (s + 1) as any)}
              disabled={!canProceed()}
              className="flex items-center gap-1.5 px-5 py-2 text-[13px] rounded-lg font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed">
              Próximo
              <FiChevronRight size={14} />
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 text-[13px] rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
              <FiCheck size={14} />
              {saving ? 'Registrando...' : 'Confirmar e Registrar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareMovementModal;

