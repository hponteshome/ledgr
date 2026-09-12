// apps/frontend/src/components/accounting/AccountMaintenanceModal.tsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, Trash2, Pencil, Search, Plus, Loader2, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { useCompany } from '../../contexts/CompanyContext';

const MySwal = withReactContent(Swal);

// ── Estilo (padrão de modais do LEDGR) ─────────────────────────────────────
const ACC_ACCENT = '#2563EB'; // azul — mesma cor já usada em AccountsPage p/ Plano de Contas
const ACC_LIGHT = '#EFF6FF';

const inputSt =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none ' +
  'focus:ring-2 focus:ring-blue-100 focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-400';
const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
    {children}
  </label>
);

// ── Interfaces ──────────────────────────────────────────────────────────────

interface Account {
  id: string;
  code: string;
  name: string;
  level: number;
  type: string;
  nature: string;
  isAnalytic: boolean;
  isActive: boolean;
  hasChildren?: boolean;
  childCount?: number;
  reducedCode?: string | null;
  spedCode?: string | null;
  ifrsCode?: string | null;
  usgaapCode?: string | null;
  eSocialCode?: string | null;
  dedutibilidade?: string | null;
  percDeducao?: number | null;
  lalurTipoAjuste?: string | null;
  lalurDescricao?: string | null;
}

interface BalanceCheck {
  accountId: string;
  accountCode: string;
  accountName: string;
  balance: number;
  journalEntries: number;
  hasMovements: boolean;
  hasChildren: boolean;
}

interface AccountMaintenanceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  // NOVO (11/09/2026): abre direto no formulario de edicao/criacao, pulando
  // a tela de busca/listagem - usado pelos icones de acao direto na arvore
  // do Plano de Contas (AccountsPage/AccountTree).
  quickEditAccountId?: string | null;
  quickCreateParentId?: string | null;
}

// ── Constantes ───────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = [
  { value: 'ASSET', label: 'Ativo' },
  { value: 'LIABILITY', label: 'Passivo' },
  { value: 'EQUITY', label: 'Patrimônio Líquido' },
  { value: 'REVENUE', label: 'Receita' },
  { value: 'EXPENSE', label: 'Despesa' },
];

const ACCOUNT_NATURES = [
  { value: 'DEBIT', label: 'Devedora (D)' },
  { value: 'CREDIT', label: 'Credora (C)' },
];

const DEDUTIBILIDADE_OPTIONS = [
  { value: 'DEDUTIVEL', label: 'Dedutível' },
  { value: 'NAO_DEDUTIVEL', label: 'Não dedutível' },
  { value: 'PARCIALMENTE_DEDUTIVEL', label: 'Parcialmente dedutível' },
];

const emptyCreate = {
  code: '', name: '', type: 'REVENUE', nature: 'CREDIT',
  isAnalytic: false, parentId: '', reducedCode: '',
  spedCode: '', ifrsCode: '', usgaapCode: '', eSocialCode: '',
};

const emptyEdit = {
  name: '', isAnalytic: false, spedCode: '', reducedCode: '', ifrsCode: '', usgaapCode: '', eSocialCode: '',
  dedutibilidade: 'DEDUTIVEL', percDeducao: '100', lalurTipoAjuste: '', lalurDescricao: '',
};

// ── Inferência automática pelo código (código SEM pontos — padrão real do importador IOB) ──
// Regras contábeis brasileiras: 1=Ativo, 2=Passivo (23x=PL), 3=Receita, 4=Despesa
const CLASS_MAP: Record<string, { type: string; nature: string }> = {
  '1': { type: 'ASSET', nature: 'DEBIT' },
  '2': { type: 'LIABILITY', nature: 'CREDIT' },
  '3': { type: 'REVENUE', nature: 'CREDIT' },
  '4': { type: 'EXPENSE', nature: 'DEBIT' },
};

/** Acha o pai de um código pelo maior prefixo existente no plano — mesma lógica do ChartImporterService (backend). */
const findParentByPrefix = (code: string, allAccounts: Account[]): Account | null => {
  for (let len = code.length - 1; len >= 1; len--) {
    const candidate = code.slice(0, len);
    const found = allAccounts.find(a => a.code === candidate);
    if (found) return found;
  }
  return null;
};

const inferFromCode = (code: string, allAccounts: Account[]): Partial<typeof emptyCreate> => {
  const clean = code.trim();
  if (!clean) return {};

  const parentAccount = findParentByPrefix(clean, allAccounts);
  if (parentAccount) {
    return {
      type: parentAccount.type,
      nature: parentAccount.nature,
      parentId: parentAccount.id,
    };
  }

  const first = clean[0];
  const inferred = CLASS_MAP[first] ?? { type: 'ASSET', nature: 'DEBIT' };
  return { type: inferred.type, nature: inferred.nature, parentId: '' };
};

// ── Componente ───────────────────────────────────────────────────────────────

export const AccountMaintenanceModal: React.FC<AccountMaintenanceModalProps> = ({
  open, onClose, onSuccess, quickEditAccountId, quickCreateParentId,
}) => {
  const quickMode = !!quickEditAccountId || !!quickCreateParentId;
  // Fecha tudo (nao so o sub-modal) quando estiver em modo rapido, ja que
  // a lista principal nunca chega a ser mostrada nesse caso.
  const closeQuickOrSub = () => {
    setEditMode(false);
    setCreateMode(false);
    if (quickMode) onClose();
  };
  const { activeCompany } = useCompany();

  // Lista
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterAnalytic, setFilterAnalytic] = useState('all');
  const [filterActive, setFilterActive] = useState('active');

  // Exclusão
  const [deleteMode, setDeleteMode] = useState<'partial' | 'total'>('partial');
  const [deleteType, setDeleteType] = useState<'logical' | 'physical'>('logical');
  const [balanceChecks, setBalanceChecks] = useState<BalanceCheck[]>([]);
  const [showBalanceCheck, setShowBalanceCheck] = useState(false);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Edição
  const [editMode, setEditMode] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyEdit });
  const [showLalur, setShowLalur] = useState(false);
  // NOVO (11/09/2026): autocomplete do Codigo Referencial SPED (I051),
  // contra a tabela sped_plano_referencial ja importada (P100/P150 por
  // padrao - PJ geral).
  const [spedSuggestions, setSpedSuggestions] = useState<any[]>([]);
  const [spedShowDrop, setSpedShowDrop] = useState(false);
  const [spedSearching, setSpedSearching] = useState(false);
  const spedSearchTimeout = useRef<any>(null);

  const searchSpedCodes = (query: string) => {
    clearTimeout(spedSearchTimeout.current);
    if (!query || query.trim().length < 2) { setSpedSuggestions([]); setSpedShowDrop(false); return; }
    spedSearchTimeout.current = setTimeout(async () => {
      setSpedSearching(true);
      try {
        const r = await api.get('/chart-of-accounts/rfb-codes/search', { params: { q: query.trim() } });
        setSpedSuggestions(r.data || []);
        setSpedShowDrop((r.data || []).length > 0);
      } catch { setSpedSuggestions([]); }
      finally { setSpedSearching(false); }
    }, 300);
  };
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Criação
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [createForm, setCreateForm] = useState({ ...emptyCreate });
  const [parentQuery, setParentQuery] = useState('');
  const [suggestingCode, setSuggestingCode] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // ── Carregar ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (open && activeCompany) loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeCompany, searchTerm, filterType, filterLevel, filterAnalytic, filterActive]);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const params: any = { page: 1, limit: 1000 };
      if (searchTerm) params.search = searchTerm;
      if (filterType !== 'all') params.types = [filterType];
      if (filterLevel !== 'all') params.level = filterLevel; // filtrado no cliente também, ver abaixo
      if (filterAnalytic === 'analytic') params.onlyAnalytic = true;
      if (filterAnalytic === 'synthetic') params.onlySynthetic = true;
      if (filterActive === 'active') params.showInactive = false;
      if (filterActive === 'inactive') params.showInactive = true;
      const res = await api.get('/chart-of-accounts', { params });
      setAccounts(res.data.items || res.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar plano de contas.');
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = useMemo(
    () => accounts.filter(a => filterLevel === 'all' || a.level === parseInt(filterLevel, 10)),
    [accounts, filterLevel],
  );
  const syntheticAccounts = useMemo(() => accounts.filter(a => !a.isAnalytic), [accounts]);
  const filteredParentOptions = useMemo(() => {
    if (!parentQuery.trim()) return syntheticAccounts.slice(0, 50);
    const q = parentQuery.trim().toLowerCase();
    return syntheticAccounts
      .filter(a => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
      .slice(0, 50);
  }, [syntheticAccounts, parentQuery]);

  // NOVO: "vizinhanca" de codigo reduzido - contas do mesmo grupo (mesmo
  // prefixo de code da conta pai escolhida; sem pai, usa so a classe = 1o
  // digito do code digitado) com reducedCode preenchido. Ajuda o usuario a
  // ver a sequencia ja em uso e escolher o proximo numero de forma
  // estruturalmente coerente, em vez de digitar as cegas.
  const selectedParentAccount = useMemo(
    () => accounts.find(a => a.id === createForm.parentId) ?? null,
    [accounts, createForm.parentId],
  );

  const neighborAccounts = useMemo(() => {
    if (selectedParentAccount) {
      return accounts.filter(a =>
        a.code.startsWith(selectedParentAccount.code) &&
        a.code !== selectedParentAccount.code &&
        a.reducedCode,
      );
    }
    const classe = createForm.code.trim()[0];
    if (!classe) return [];
    return accounts.filter(a => a.code.startsWith(classe) && a.reducedCode);
  }, [accounts, selectedParentAccount, createForm.code]);

  const neighborReducedCodes = useMemo(() => {
    return neighborAccounts
      .map(a => ({ code: a.code, name: a.name, reducedCode: a.reducedCode as string, num: parseInt((a.reducedCode || '').replace(/^0+/, '') || '0', 10) }))
      .filter(x => !isNaN(x.num) && x.num > 0)
      .sort((a, b) => a.num - b.num);
  }, [neighborAccounts]);

  // NOVO: mapa de lacunas na numeracao da CLASSE inteira (1o digito do
  // codigo), nao so do grupo pai - mostra de onde veio a ultima conta usada,
  // o vazio imediatamente anterior a ela, e os 2 proximos vazios adiante.
  const classeDigit = (selectedParentAccount?.code || createForm.code).trim()[0];

  // CORRIGIDO: exclui 8888 (excecao fixa da conta "Apuracao de Resultado",
  // documentada e permanente - nunca faz parte da sequencia normal da
  // classe, distorcia o mapa de lacunas inteiro).
  const RESERVED_CODES = new Set([8888]);

  const classeUsedNums = useMemo(() => {
    if (!classeDigit) return [];
    const nums = accounts
      .filter(a => a.reducedCode && a.code.startsWith(classeDigit))
      .map(a => parseInt((a.reducedCode || '').replace(/^0+/, '') || '0', 10))
      .filter(n => n > 0 && !RESERVED_CODES.has(n));
    return Array.from(new Set(nums)).sort((a, b) => a - b);
  }, [accounts, classeDigit]);

  const lastUsedNum = classeUsedNums.length ? classeUsedNums[classeUsedNums.length - 1] : null;

  // Teto natural da classe (ex: classe 2 vai ate 2999, classe 4 ate 4999).
  const classeCeiling = classeDigit ? parseInt(classeDigit, 10) * 1000 + 999 : null;

  const classeGaps = useMemo(() => {
    const gaps: { start: number; end: number }[] = [];
    for (let i = 1; i < classeUsedNums.length; i++) {
      const prev = classeUsedNums[i - 1], curr = classeUsedNums[i];
      if (curr - prev > 1) gaps.push({ start: prev + 1, end: curr - 1 });
    }
    if (classeUsedNums.length > 0 && classeCeiling !== null) {
      const last = classeUsedNums[classeUsedNums.length - 1];
      if (last < classeCeiling) gaps.push({ start: last + 1, end: classeCeiling });
    }
    return gaps;
  }, [classeUsedNums, classeCeiling]);

  const gapBeforeLast = useMemo(() => {
    if (classeUsedNums.length < 2) return null;
    const idx = classeUsedNums.length - 1;
    const prev = classeUsedNums[idx - 1], curr = classeUsedNums[idx];
    return curr - prev > 1 ? { start: prev + 1, end: curr - 1 } : null;
  }, [classeUsedNums]);

  const gapsAfterLast = useMemo(() => {
    if (lastUsedNum === null) return [];
    return classeGaps.filter(g => g.start > lastUsedNum).slice(0, 2);
  }, [classeGaps, lastUsedNum]);

  // CORRIGIDO: "proximo livre" agora sempre calculado pela CLASSE inteira
  // (nao mais pelo grupo pai). Movido pra depois das const acima (bug de
  // ordem de declaracao - usava classeDigit/gapsAfterLast antes de existirem).
  // CORRIGIDO: reduced_code nao segue sequencia unica pra classe inteira -
  // segue BLOCOS DE 100 por grupo principal (21xx=Passivo Circulante,
  // 23xx=Exigivel LP, 24xx=PL, etc - convencao ja definida quando o usuario
  // reatribuiu os codigos manualmente nesta sessao). "Proximo livre" precisa
  // continuar o bloco do GRUPO PAI (maior numero usado nas contas irmas do
  // mesmo grupo, +1), nao pular pro fim da classe nem pra bloco reservado
  // de outro grupo.
  // CORRIGIDO (dado real confirmado pelo usuario): o bloco de numeracao NAO
  // e por grupo de 5 digitos (22101) - grupos-irmaos de 5 digitos sob o
  // MESMO prefixo de 2 digitos (22101, 22102, 22501, todos sob "22")
  // compartilham uma sequencia CONTINUA sem vazio entre eles (2301..2315).
  // O vazio de verdade so aparece na fronteira do prefixo de 2 digitos
  // (21->22 tem vazio 2154-2299; 22->23 tem vazio 2316-2400). Escopo correto
  // = 2 primeiros digitos do code do pai, nao 5.
  const grupoPaiPrefix = useMemo(() => {
    if (!selectedParentAccount) return null;
    return selectedParentAccount.code.slice(0, 2);
  }, [selectedParentAccount]);

  const grupoUsedNums = useMemo(() => {
    if (!grupoPaiPrefix) return [];
    const nums = accounts
      .filter(a => a.reducedCode && a.code.startsWith(grupoPaiPrefix))
      .map(a => parseInt((a.reducedCode || '').replace(/^0+/, '') || '0', 10))
      .filter(n => n > 0 && !RESERVED_CODES.has(n));
    return Array.from(new Set(nums)).sort((a, b) => a - b);
  }, [accounts, grupoPaiPrefix]);

  const grupoLastUsedNum = grupoUsedNums.length ? grupoUsedNums[grupoUsedNums.length - 1] : null;

  // Teto do bloco do grupo pai: o proximo numero usado na CLASSE inteira que
  // fica acima do maior numero do grupo pai, menos 1 (fronteira real do
  // proximo grupo-irmao de 2 digitos); se nao houver nenhum acima, usa o
  // teto da classe inteira.
  const grupoBlockCeiling = useMemo(() => {
    if (grupoLastUsedNum === null) return classeCeiling;
    const next = classeUsedNums.find(n => n > grupoLastUsedNum);
    return next !== undefined ? next - 1 : classeCeiling;
  }, [grupoLastUsedNum, classeUsedNums, classeCeiling]);

  const grupoGapAfterLast = useMemo(() => {
    if (grupoLastUsedNum === null || grupoBlockCeiling === null) return null;
    return grupoLastUsedNum < grupoBlockCeiling
      ? { start: grupoLastUsedNum + 1, end: grupoBlockCeiling }
      : null;
  }, [grupoLastUsedNum, grupoBlockCeiling]);

  // Nome + numero da ultima conta EXIBIDOS SEMPRE JUNTOS, do mesmo escopo
  // (grupo pai se houver, senao classe inteira) - corrige inconsistencia
  // anterior onde o numero vinha de um calculo e o nome de outro.
  const escopoLastUsedNum = grupoPaiPrefix ? grupoLastUsedNum : lastUsedNum;
  const nomeUltimaConta = useMemo(() => {
    if (escopoLastUsedNum === null) return null;
    const padded4 = String(escopoLastUsedNum).padStart(4, '0');
    const found = accounts.find(a => a.reducedCode &&
      (a.reducedCode.replace(/^0+/, '') === String(escopoLastUsedNum) || a.reducedCode === padded4));
    return found?.name ?? null;
  }, [accounts, escopoLastUsedNum]);

  const suggestedReducedCode = useMemo(() => {
    if (grupoPaiPrefix) {
      if (grupoLastUsedNum !== null) return String(grupoLastUsedNum + 1);
      if (grupoBlockCeiling !== null) return String((grupoBlockCeiling - 99));
    }
    if (gapsAfterLast.length > 0) return String(gapsAfterLast[0].start);
    if (lastUsedNum === null && classeDigit) return String(parseInt(classeDigit, 10) * 1000 + 1);
    return null;
  }, [grupoPaiPrefix, grupoLastUsedNum, grupoBlockCeiling, gapsAfterLast, lastUsedNum, classeDigit]);

  // ── Seleção ───────────────────────────────────────────────────────────────

  const toggleSelectAll = () => setSelectedAccounts(
    selectedAccounts.size === filteredAccounts.length
      ? new Set()
      : new Set(filteredAccounts.map(a => a.id)),
  );
  const toggleSelect = (id: string) => {
    const s = new Set(selectedAccounts);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedAccounts(s);
  };

  // ── Verificação de integridade ───────────────────────────────────────────

  const checkBalances = async () => {
    setCheckingBalance(true);
    setShowBalanceCheck(true);
    try {
      const targets = [...selectedAccounts]
        .map(id => accounts.find(a => a.id === id))
        .filter((a): a is Account => !!a);

      const results = await Promise.all(targets.map(async a => {
        const res = await api.get(`/chart-of-accounts/${a.id}/balance`);
        return {
          accountId: a.id, accountCode: a.code, accountName: a.name,
          balance: res.data.balance || 0,
          journalEntries: res.data.journalEntries || 0,
          hasMovements: (res.data.journalEntries || 0) > 0,
          hasChildren: !!a.hasChildren,
        } as BalanceCheck;
      }));
      setBalanceChecks(results);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao verificar saldos.');
    } finally {
      setCheckingBalance(false);
    }
  };

  const blockedByCheck = balanceChecks.some(c => c.hasMovements || c.hasChildren);

  // ── Exclusão ──────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    const targetIds = deleteMode === 'total'
      ? filteredAccounts.map(a => a.id)
      : [...selectedAccounts];

    if (targetIds.length === 0) {
      toast.error('Nenhuma conta selecionada.');
      return;
    }

    const confirm = await MySwal.fire({
      title: deleteMode === 'total' ? 'Excluir TODO o plano filtrado?' : 'Excluir contas selecionadas?',
      text: `${targetIds.length} conta(s) serão ${deleteType === 'physical' ? 'excluídas permanentemente' : 'desativadas'}. Esta ação ${deleteType === 'physical' ? 'não pode ser desfeita' : 'pode ser revertida reativando as contas'}.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#111111',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar',
    });
    if (!confirm.isConfirmed) return;

    setDeleteLoading(true);
    try {
      const res = await api.post('/chart-of-accounts/bulk', {
        accountIds: targetIds,
        operation: 'delete',
        permanent: deleteType === 'physical',
      });
      const failed = res.data?.failed ?? 0;
      const success = res.data?.success ?? targetIds.length;
      if (failed > 0) {
        toast.error(`${success} excluída(s), ${failed} falharam (verifique lançamentos vinculados).`);
      } else {
        toast.success(`${success} conta(s) excluída(s) com sucesso.`);
      }
      setSelectedAccounts(new Set());
      setShowBalanceCheck(false);
      setBalanceChecks([]);
      await loadAccounts();
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao excluir contas.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Edição ────────────────────────────────────────────────────────────────

  const handleEdit = (a: Account) => {
    setEditingAccount(a);
    setEditForm({
      name: a.name, isAnalytic: a.isAnalytic,
      spedCode: a.spedCode || '', reducedCode: a.reducedCode || '', ifrsCode: a.ifrsCode || '',
      usgaapCode: a.usgaapCode || '', eSocialCode: a.eSocialCode || '',
      dedutibilidade: a.dedutibilidade || 'DEDUTIVEL',
      percDeducao: a.percDeducao != null ? String(a.percDeducao) : '100',
      lalurTipoAjuste: a.lalurTipoAjuste || '',
      lalurDescricao: a.lalurDescricao || '',
    });
    setShowLalur(false);
    setEditError('');
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    if (!editingAccount) return;
    if (!editForm.name.trim()) {
      setEditError('Nome é obrigatório.');
      return;
    }
    setEditSaving(true);
    setEditError('');
    try {
      await api.put(`/chart-of-accounts/${editingAccount.id}`, {
        name: editForm.name.trim(),
        isAnalytic: editForm.isAnalytic,
        spedCode: editForm.spedCode || undefined,
        reducedCode: editForm.reducedCode || undefined,
        ifrsCode: editForm.ifrsCode || undefined,
        usgaapCode: editForm.usgaapCode || undefined,
        eSocialCode: editForm.eSocialCode || undefined,
      });

      // Dedutibilidade/LALUR só se a conta é analítica (é onde faz sentido lançar despesa)
      if (editingAccount.isAnalytic) {
        await api.patch(`/chart-of-accounts/${editingAccount.id}/deducibilidade`, {
          dedutibilidade: editForm.dedutibilidade,
          percDeducao: editForm.dedutibilidade === 'PARCIALMENTE_DEDUTIVEL'
            ? Number(editForm.percDeducao) : undefined,
          lalurTipoAjuste: editForm.dedutibilidade !== 'DEDUTIVEL' ? editForm.lalurTipoAjuste || undefined : undefined,
          lalurDescricao: editForm.dedutibilidade !== 'DEDUTIVEL' ? editForm.lalurDescricao || undefined : undefined,
        });
      }

      toast.success('Conta atualizada com sucesso.');
      setEditMode(false);
      setEditingAccount(null);
      await loadAccounts();
      onSuccess?.();
      if (quickMode) onClose();
    } catch (e: any) {
      setEditError(e.response?.data?.message || 'Erro ao salvar alterações.');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Criação ───────────────────────────────────────────────────────────────

  const openCreate = () => {
    setCreateForm({ ...emptyCreate });
    setParentQuery('');
    setCreateError('');
    setCreateMode(true);
  };

  const handleCodeBlur = () => {
    const inferred = inferFromCode(createForm.code, accounts);
    setCreateForm(prev => ({ ...prev, ...inferred }));
  };

  const handlePickParent = async (parent: Account | null) => {
    setCreateForm(prev => ({
      ...prev,
      parentId: parent?.id ?? '',
      type: parent?.type ?? prev.type,
      nature: parent?.nature ?? prev.nature,
    }));
    if (!parent) return;
    // Sugere o próximo código disponível sob essa conta pai (endpoint já existe no backend)
    setSuggestingCode(true);
    try {
      const res = await api.get(`/chart-of-accounts/suggest-code/${parent.code}`);
      const suggested = res.data?.code || res.data?.suggestedCode;
      if (suggested) setCreateForm(prev => ({ ...prev, code: suggested }));
    } catch (e) {
      // sugestão é auxiliar — se falhar, usuário digita manualmente
      console.warn('Não foi possível sugerir código automaticamente.', e);
    } finally {
      setSuggestingCode(false);
    }
  };

  const handleSaveCreate = async () => {
    if (!createForm.code.trim() || !createForm.name.trim()) {
      setCreateError('Código e Nome são obrigatórios.');
      return;
    }
    setCreateLoading(true);
    setCreateError('');
    try {
      const payload: any = {
        code: createForm.code.trim(),
        name: createForm.name.trim(),
        type: createForm.type,
        nature: createForm.nature,
        isAnalytic: createForm.isAnalytic,
      };
      if (createForm.parentId) payload.parentId = createForm.parentId;
      if (createForm.reducedCode) payload.reducedCode = createForm.reducedCode;
      if (createForm.spedCode) payload.spedCode = createForm.spedCode;
      if (createForm.ifrsCode) payload.ifrsCode = createForm.ifrsCode;
      if (createForm.usgaapCode) payload.usgaapCode = createForm.usgaapCode;
      if (createForm.eSocialCode) payload.eSocialCode = createForm.eSocialCode;

      const res = await api.post('/chart-of-accounts', payload);
      const newId = res.data?.id;

      setCreateForm({ ...emptyCreate });
      setParentQuery('');
      toast.success(`Conta "${payload.name}" criada com sucesso!`);
      await loadAccounts();

      if (newId) {
        setLastCreatedId(newId);
        setTimeout(() => setLastCreatedId(null), 3000);
        setTimeout(() => {
          document.getElementById(`account-row-${newId}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
      onSuccess?.();
      if (quickMode) onClose();
    } catch (e: any) {
      setCreateError(e.response?.data?.message || 'Erro ao criar conta.');
    } finally {
      setCreateLoading(false);
    }
  };

  // NOVO (11/09/2026): modo rapido - busca a conta completa e abre direto
  // no formulario certo, sem exigir que o usuario navegue a lista antes.
  useEffect(() => {
    if (!quickEditAccountId) return;
    (async () => {
      try {
        const r = await api.get(`/chart-of-accounts/${quickEditAccountId}`);
        handleEdit(r.data);
      } catch { toast.error('Erro ao carregar conta para edição.'); onClose(); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickEditAccountId]);

  useEffect(() => {
    if (!quickCreateParentId) return;
    (async () => {
      try {
        const r = await api.get(`/chart-of-accounts/${quickCreateParentId}`);
        openCreate();
        await handlePickParent(r.data);
        setParentQuery(`${r.data.code} — ${r.data.name}`);
      } catch { toast.error('Erro ao carregar conta pai.'); onClose(); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickCreateParentId]);

  if (!open) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {!quickMode && (
      <>
      {/* Modal principal */}
      <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-[#111111] text-white px-6 py-4 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-base font-semibold">Manutenção do Plano de Contas</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {activeCompany ? activeCompany.tradeName : 'Nenhuma empresa selecionada'}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-300 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {/* Filtros */}
            <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 border-l-4" style={{ borderLeftColor: ACC_ACCENT }}>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Filtros</p>
              <div className="flex flex-wrap gap-3">
                <div className="w-64">
                  <Label>Buscar código/nome</Label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input className={inputSt + ' pl-8'} value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)} placeholder="Ex: Caixa, 111..." />
                  </div>
                </div>
                <div className="w-40">
                  <Label>Tipo</Label>
                  <select className={inputSt} value={filterType} onChange={e => setFilterType(e.target.value)}>
                    <option value="all">Todos</option>
                    {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="w-32">
                  <Label>Nível</Label>
                  <select className={inputSt} value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
                    <option value="all">Todos</option>
                    {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={String(n)}>Nível {n}</option>)}
                  </select>
                </div>
                <div className="w-40">
                  <Label>Analiticidade</Label>
                  <select className={inputSt} value={filterAnalytic} onChange={e => setFilterAnalytic(e.target.value)}>
                    <option value="all">Todos</option>
                    <option value="analytic">Analíticas</option>
                    <option value="synthetic">Sintéticas</option>
                  </select>
                </div>
                <div className="w-32">
                  <Label>Status</Label>
                  <select className={inputSt} value={filterActive} onChange={e => setFilterActive(e.target.value)}>
                    <option value="all">Todos</option>
                    <option value="active">Ativas</option>
                    <option value="inactive">Inativas</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Ações */}
            <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 border-l-4" style={{ borderLeftColor: ACC_ACCENT }}>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Modo:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" checked={deleteMode === 'partial'} onChange={() => setDeleteMode('partial')} />
                    Exclusão parcial (selecionadas)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" checked={deleteMode === 'total'} onChange={() => setDeleteMode('total')} />
                    Exclusão total (filtro atual)
                  </label>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Tipo:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" checked={deleteType === 'logical'} onChange={() => setDeleteType('logical')} />
                    Lógica (desativar)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" checked={deleteType === 'physical'} onChange={() => setDeleteType('physical')} />
                    Física (definitiva)
                  </label>
                </div>
                <button
                  onClick={checkBalances}
                  disabled={!selectedAccounts.size || checkingBalance}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-full border border-blue-200 transition-colors">
                  {checkingBalance ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  Verificar Saldos
                </button>
                <button
                  onClick={openCreate}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#111111] hover:bg-[#333] rounded-full ml-auto transition-colors">
                  <Plus size={14} /> Nova Conta
                </button>
              </div>
            </section>

            {/* Verificação de integridade */}
            {showBalanceCheck && (
              <section className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Verificação de Integridade</p>
                {checkingBalance ? (
                  <div className="flex justify-center py-6"><Loader2 className="animate-spin text-gray-400" /></div>
                ) : (
                  <>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr className="text-left text-gray-500 uppercase tracking-wide">
                            <th className="px-3 py-2">Código</th><th className="px-3 py-2">Nome</th>
                            <th className="px-3 py-2 text-right">Saldo</th>
                            <th className="px-3 py-2 text-right">Lançamentos</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {balanceChecks.map(c => (
                            <tr key={c.accountId}>
                              <td className="px-3 py-2 font-mono">{c.accountCode}</td>
                              <td className="px-3 py-2">{c.accountName}</td>
                              <td className="px-3 py-2 text-right font-mono">
                                {c.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-2 text-right">{c.journalEntries}</td>
                              <td className="px-3 py-2">
                                {c.hasChildren
                                  ? <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-medium">Tem filhas</span>
                                  : c.hasMovements
                                    ? <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-medium">Com lançamentos</span>
                                    : <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-medium">OK</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {blockedByCheck && (
                      <div className="mt-3 flex items-start gap-2 bg-[#FCEBEB] text-red-700 text-xs rounded-lg px-3 py-2">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        Algumas contas possuem lançamentos ou contas filhas — a exclusão física dessas vai falhar; considere exclusão lógica.
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

            {/* Lista */}
            <section className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Contas encontradas ({filteredAccounts.length})
                </p>
                <div className="flex gap-2">
                  <button onClick={toggleSelectAll} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors">
                    {selectedAccounts.size === filteredAccounts.length && filteredAccounts.length > 0 ? 'Desmarcar todos' : 'Selecionar todos'}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={(deleteMode === 'partial' && !selectedAccounts.size) || deleteLoading}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    {deleteLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Excluir {deleteMode === 'total' ? 'todas (filtro)' : 'selecionadas'}
                  </button>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr className="text-left text-gray-400 text-[11px] uppercase tracking-wide">
                      <th className="px-3 py-2 w-8">
                        <input type="checkbox"
                          checked={selectedAccounts.size === filteredAccounts.length && filteredAccounts.length > 0}
                          ref={el => { if (el) el.indeterminate = selectedAccounts.size > 0 && selectedAccounts.size < filteredAccounts.length; }}
                          onChange={toggleSelectAll} />
                      </th>
                      <th className="px-3 py-2">Código</th><th className="px-3 py-2">Nome</th>
                      <th className="px-3 py-2">Nível</th><th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Nat.</th><th className="px-3 py-2">Analítica</th>
                      <th className="px-3 py-2">Status</th><th className="px-3 py-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={9} className="text-center py-8"><Loader2 className="animate-spin inline text-gray-400" /></td></tr>
                    ) : filteredAccounts.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-8 text-gray-400 text-xs">Nenhuma conta encontrada.</td></tr>
                    ) : filteredAccounts.map(a => (
                      <tr key={a.id} id={`account-row-${a.id}`}
                        className={'hover:bg-gray-50 transition-colors ' + (lastCreatedId === a.id ? 'bg-blue-50 outline outline-2 outline-blue-500' : '')}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selectedAccounts.has(a.id)} onChange={() => toggleSelect(a.id)} />
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{a.code}</td>
                        <td className="px-3 py-2">{a.name}</td>
                        <td className="px-3 py-2">{a.level}</td>
                        <td className="px-3 py-2 text-xs">{ACCOUNT_TYPES.find(t => t.value === a.type)?.label ?? a.type}</td>
                        <td className="px-3 py-2">{a.nature === 'DEBIT' ? 'D' : 'C'}</td>
                        <td className="px-3 py-2 text-xs">{a.isAnalytic ? 'Sim' : 'Não'}</td>
                        <td className="px-3 py-2">
                          <span className={'px-2 py-0.5 rounded-full text-[11px] font-medium ' + (a.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                            {a.isActive ? 'Ativa' : 'Inativa'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => handleEdit(a)} title="Editar" className="text-gray-400 hover:text-blue-600 transition-colors">
                            <Pencil size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="bg-[#FAFAFA] border-t border-gray-100 px-6 py-3 flex justify-end shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:border-gray-400 transition-colors">
              Fechar
            </button>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Modal de Edição */}
      {editMode && editingAccount && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-[#111111] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-semibold">Editar Conta</h3>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{editingAccount.code}</p>
              </div>
              <button onClick={closeQuickOrSub} className="text-gray-300 hover:text-white"><X size={18} /></button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex gap-2 text-xs text-gray-500">
                <span className="px-2 py-1 bg-gray-100 rounded">
                  {ACCOUNT_TYPES.find(t => t.value === editingAccount.type)?.label ?? editingAccount.type}
                </span>
                <span className="px-2 py-1 bg-gray-100 rounded">
                  {editingAccount.nature === 'DEBIT' ? 'Devedora (D)' : 'Credora (C)'}
                </span>
                <span className="px-2 py-1 bg-gray-100 rounded">Nível {editingAccount.level}</span>
              </div>

              <div>
                <Label>Nome</Label>
                <input className={inputSt} value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={editForm.isAnalytic}
                  onChange={e => setEditForm({ ...editForm, isAnalytic: e.target.checked })} />
                Conta analítica (recebe lançamentos diretamente)
              </label>

              <div>
                <Label>Código Reduzido</Label>
                <input className={inputSt} value={editForm.reducedCode}
                  onChange={e => setEditForm({ ...editForm, reducedCode: e.target.value })}
                  placeholder="ex: 1050" />
              </div>

              <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                <Label>Conta Referencial (SPED)</Label>
                <div className="relative">
                  <input className={inputSt} value={editForm.spedCode}
                    onChange={e => { setEditForm({ ...editForm, spedCode: e.target.value }); searchSpedCodes(e.target.value); }}
                    onFocus={() => spedSuggestions.length > 0 && setSpedShowDrop(true)}
                    onBlur={() => setTimeout(() => setSpedShowDrop(false), 200)}
                    placeholder="ex: 1.01.01.01.01 - digite para buscar" />
                  {spedSearching && <span className="absolute right-2 top-2 text-[10px] text-gray-400">buscando...</span>}
                  {spedShowDrop && spedSuggestions.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                      {spedSuggestions.map((s, i) => (
                        <button key={i} type="button"
                          onMouseDown={() => { setEditForm({ ...editForm, spedCode: s.codigo }); setSpedShowDrop(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 border-b border-gray-50 last:border-0 flex justify-between gap-2">
                          <span><span className="font-mono text-blue-600">{s.codigo}</span> — {s.descricao}</span>
                          <span className="text-gray-400 flex-shrink-0">{s.tabela} · N{s.nivel} · {s.tipo}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Código da tabela dinâmica SPED (P100/P150). Contas analíticas devem referenciar
                  uma folha (P100: 5 níveis / P150: 6 níveis); contas sintéticas devem referenciar
                  um código de agrupamento, nunca uma folha.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Código IFRS</Label>
                  <input className={inputSt} value={editForm.ifrsCode}
                    onChange={e => setEditForm({ ...editForm, ifrsCode: e.target.value })} />
                </div>
                <div>
                  <Label>Código USGAAP</Label>
                  <input className={inputSt} value={editForm.usgaapCode}
                    onChange={e => setEditForm({ ...editForm, usgaapCode: e.target.value })} />
                </div>
                <div>
                  <Label>Código eSocial</Label>
                  <input className={inputSt} value={editForm.eSocialCode}
                    onChange={e => setEditForm({ ...editForm, eSocialCode: e.target.value })} />
                </div>
              </div>

              {editingAccount.isAnalytic && (
                <div className="border-t border-gray-100 pt-4">
                  <button type="button" onClick={() => setShowLalur(v => !v)}
                    className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                    {showLalur ? '− Ocultar' : '+ Dedutibilidade fiscal (LALUR/LACS)'}
                  </button>
                  {showLalur && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <Label>Dedutibilidade</Label>
                        <select className={inputSt} value={editForm.dedutibilidade}
                          onChange={e => setEditForm({ ...editForm, dedutibilidade: e.target.value })}>
                          {DEDUTIBILIDADE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      {editForm.dedutibilidade === 'PARCIALMENTE_DEDUTIVEL' && (
                        <div>
                          <Label>% Dedutível</Label>
                          <input type="number" min={0} max={100} className={inputSt} value={editForm.percDeducao}
                            onChange={e => setEditForm({ ...editForm, percDeducao: e.target.value })} />
                        </div>
                      )}
                      {editForm.dedutibilidade !== 'DEDUTIVEL' && (
                        <>
                          <div>
                            <Label>Tipo de ajuste LALUR</Label>
                            <select className={inputSt} value={editForm.lalurTipoAjuste}
                              onChange={e => setEditForm({ ...editForm, lalurTipoAjuste: e.target.value })}>
                              <option value="">Selecione…</option>
                              <option value="ADICAO">Adição</option>
                              <option value="EXCLUSAO">Exclusão</option>
                            </select>
                          </div>
                          <div>
                            <Label>Descrição do ajuste (LALUR)</Label>
                            <input className={inputSt} value={editForm.lalurDescricao}
                              onChange={e => setEditForm({ ...editForm, lalurDescricao: e.target.value })} />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {editError && (
                <div className="flex items-start gap-2 bg-[#FCEBEB] text-red-700 text-xs rounded-lg px-3 py-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {editError}
                </div>
              )}
            </div>

            <div className="bg-[#FAFAFA] border-t border-gray-100 px-6 py-3 flex justify-end gap-2 shrink-0">
              <button onClick={closeQuickOrSub} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:border-gray-400 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSaveEdit} disabled={editSaving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#111111] hover:bg-[#333] disabled:opacity-50 rounded-lg transition-colors">
                {editSaving && <Loader2 size={14} className="animate-spin" />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação */}
      {createMode && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-[#111111] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-semibold">Nova Conta</h3>
              <button onClick={closeQuickOrSub} className="text-gray-300 hover:text-white"><X size={18} /></button>
            </div>

            <div className="p-6 overflow-y-auto flex gap-6">
            <div className="flex-1 space-y-4 min-w-0">
              <div>
                <Label>Conta pai (opcional — deixe em branco para conta raiz)</Label>
                <input className={inputSt} value={parentQuery}
                  placeholder="Buscar por código ou nome…"
                  onChange={e => setParentQuery(e.target.value)} />
                {parentQuery.trim() && (
                  <div className="mt-1 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                    {filteredParentOptions.length === 0 ? (
                      <p className="text-xs text-gray-400 px-3 py-2">Nenhuma conta sintética encontrada.</p>
                    ) : filteredParentOptions.map(a => (
                      <button key={a.id} type="button"
                        onClick={() => { handlePickParent(a); setParentQuery(`${a.code} — ${a.name}`); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 border-b border-gray-50 last:border-0">
                        <span className="font-mono text-gray-500">{a.code}</span> — {a.name}
                      </button>
                    ))}
                  </div>
                )}
                {createForm.parentId && (
                  <button type="button" onClick={() => { handlePickParent(null); setParentQuery(''); }}
                    className="text-[11px] text-red-500 mt-1">Limpar conta pai</button>
                )}
              </div>

              <div className="flex gap-3">
                <div className="w-40">
                  <Label>Código *{suggestingCode && ' (sugerindo…)'}</Label>
                  <input className={inputSt} value={createForm.code} placeholder="ex: 11101010050"
                    onChange={e => setCreateForm({ ...createForm, code: e.target.value })}
                    onBlur={handleCodeBlur} />
                </div>
                <div className="flex-1">
                  <Label>Nome *</Label>
                  <input className={inputSt} value={createForm.name}
                    onChange={e => setCreateForm({ ...createForm, name: e.target.value })} />
                </div>
              </div>

              <div className="flex gap-3 items-end">
                <div className="w-40">
                  <Label>Código Reduzido</Label>
                  <input className={inputSt} value={createForm.reducedCode}
                    onChange={e => setCreateForm({ ...createForm, reducedCode: e.target.value })}
                    placeholder="ex: 1050" />
                </div>
                {suggestedReducedCode && (
                  <button type="button"
                    onClick={() => setCreateForm(prev => ({ ...prev, reducedCode: suggestedReducedCode }))}
                    className="text-xs px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors mb-0.5">
                    Usar sugerido: {suggestedReducedCode}
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <Label>Tipo *</Label>
                  <select className={inputSt} value={createForm.type}
                    onChange={e => setCreateForm({ ...createForm, type: e.target.value })}>
                    {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <Label>Natureza *</Label>
                  <select className={inputSt} value={createForm.nature}
                    onChange={e => setCreateForm({ ...createForm, nature: e.target.value })}>
                    {ACCOUNT_NATURES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={createForm.isAnalytic}
                  onChange={e => setCreateForm({ ...createForm, isAnalytic: e.target.checked })} />
                Conta analítica (recebe lançamentos diretamente)
              </label>

              <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                <Label>Conta Referencial (SPED)</Label>
                <div className="relative">
                  <input className={inputSt} value={createForm.spedCode}
                    onChange={e => { setCreateForm({ ...createForm, spedCode: e.target.value }); searchSpedCodes(e.target.value); }}
                    onFocus={() => spedSuggestions.length > 0 && setSpedShowDrop(true)}
                    onBlur={() => setTimeout(() => setSpedShowDrop(false), 200)}
                    placeholder="ex: 1.01.01.01.01 - digite para buscar" />
                  {spedSearching && <span className="absolute right-2 top-2 text-[10px] text-gray-400">buscando...</span>}
                  {spedShowDrop && spedSuggestions.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                      {spedSuggestions.map((s, i) => (
                        <button key={i} type="button"
                          onMouseDown={() => { setCreateForm({ ...createForm, spedCode: s.codigo }); setSpedShowDrop(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 border-b border-gray-50 last:border-0 flex justify-between gap-2">
                          <span><span className="font-mono text-blue-600">{s.codigo}</span> — {s.descricao}</span>
                          <span className="text-gray-400 flex-shrink-0">{s.tabela} · N{s.nivel} · {s.tipo}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Se marcar "conta analítica" abaixo, use um código folha (P100: 5 níveis / P150:
                  6 níveis); se deixar sintética, use um código de agrupamento.
                </p>
              </div>

              <div>
                <Label>Código IFRS</Label>
                <input className={inputSt} value={createForm.ifrsCode}
                  onChange={e => setCreateForm({ ...createForm, ifrsCode: e.target.value })} />
              </div>

              {createError && (
                <div className="flex items-start gap-2 bg-[#FCEBEB] text-red-700 text-xs rounded-lg px-3 py-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {createError}
                </div>
              )}
            </div>

            {/* NOVO: painel de vizinhanca de codigo reduzido - mostra os ja
                usados no grupo (conta pai escolhida, ou classe pelo 1o digito
                do codigo) com o proximo numero livre em destaque. */}
            <div className="w-64 shrink-0 border-l border-gray-100 pl-6">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                Códigos Reduzidos — Vizinhança
              </p>
              {!classeDigit ? (
                <p className="text-xs text-gray-400">
                  Escolha uma conta pai ou digite o código para ver os intervalos de código reduzido disponíveis nessa classe.
                </p>
              ) : (
                <>
                  {suggestedReducedCode && (
                    <div className="mb-3 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
                      <p className="text-[10px] text-green-600 uppercase font-bold tracking-wide">Próximo livre</p>
                      <p className="text-lg font-bold text-green-700 font-mono">{suggestedReducedCode}</p>
                    </div>
                  )}

                  {lastUsedNum !== null && (
                    <div className="mb-3 text-[11px] text-gray-500">
                      Última conta anterior: <span className="font-mono font-semibold text-gray-700">{lastUsedNum}</span>
                      {nomeUltimaConta && <span className="block text-gray-400 mt-0.5">{nomeUltimaConta}</span>}
                    </div>
                  )}

                  {gapBeforeLast && (
                    <div className="mb-3 px-2 py-1.5 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-700">
                      Lacuna antes: <span className="font-mono font-semibold">
                        {gapBeforeLast.start}{gapBeforeLast.end > gapBeforeLast.start ? `…${gapBeforeLast.end}` : ''}
                      </span>
                    </div>
                  )}

                  {gapsAfterLast.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-400 mb-1">Próximos intervalos disponíveis:</p>
                      {gapsAfterLast.map((g, i) => (
                        <button key={i} type="button"
                          onClick={() => setCreateForm(prev => ({ ...prev, reducedCode: String(g.start) }))}
                          className="w-full text-left px-2 py-1.5 rounded bg-blue-50 border border-blue-200 text-[11px] text-blue-700 hover:bg-blue-100 transition-colors font-mono">
                          {g.start}{g.end > g.start ? `…${g.end}` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            </div>

            <div className="bg-[#FAFAFA] border-t border-gray-100 px-6 py-3 flex justify-end gap-2 shrink-0">
              <button onClick={closeQuickOrSub} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:border-gray-400 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSaveCreate} disabled={createLoading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#111111] hover:bg-[#333] disabled:opacity-50 rounded-lg transition-colors">
                {createLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Criar Conta
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AccountMaintenanceModal;
