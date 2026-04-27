// apps/frontend/src/components/accounting/AccountMaintenanceModal.tsx

import React, { useState, useEffect } from 'react';
import {
    Modal, Box, Typography, TextField, Button, Select, MenuItem,
    FormControl, InputLabel, Chip, Stack, Alert, AlertTitle,
    CircularProgress, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, IconButton, Collapse,
    Tooltip, FormControlLabel, Checkbox, RadioGroup, Radio, Autocomplete
} from '@mui/material';
import {
    Close as CloseIcon, Delete as DeleteIcon,
    Edit as EditIcon, Search as SearchIcon, Add as AddIcon
} from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { useCompany } from '../../contexts/CompanyContext';

// ── Interfaces ───────────────────────────────────────────────────────────────

interface Account {
    id: string;
    code: string;
    name: string;
    level: number;
    type: string;
    nature: string;
    isAnalytic: boolean;
    isActive: boolean;
    hasChildren: boolean;
    childCount: number;
    spedCode?: string;
    ifrsCode?: string;
    usgaapCode?: string;
    eSocialCode?: string;
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

const emptyCreate = {
    code: '', name: '', type: 'REVENUE', nature: 'CREDIT',
    isAnalytic: false, parentId: '',
    spedCode: '', ifrsCode: '', usgaapCode: '', eSocialCode: '',
};

// ── Inferência automática pelo código ────────────────────────────────────────
// Regras contábeis brasileiras: 1=Ativo, 2=Passivo/PL, 3=Receita, 4/5=Despesa
const inferFromCode = (
    code: string,
    allAccounts: Account[],
): Partial<typeof emptyCreate> => {
    const clean = code.trim();
    if (!clean) return {};

    // 1. Tenta encontrar a conta pai pelo código (remove último segmento)
    const segments = clean.split('.');
    const parentCode = segments.length > 1 ? segments.slice(0, -1).join('.') : null;
    const parentAccount = parentCode
        ? allAccounts.find(a => a.code === parentCode)
        : null;

    // 2. Se achou pai, herda tipo e natureza dele
    if (parentAccount) {
        const isAnalytic = segments.length >= 5; // nível 5+ = analítica por padrão
        return {
            type: parentAccount.type,
            nature: parentAccount.nature,
            parentId: parentAccount.id,
            isAnalytic,
        };
    }

    // 3. Fallback: inferir pelo primeiro dígito
    const first = clean[0];
    const typeMap: Record<string, { type: string; nature: string }> = {
        '1': { type: 'ASSET', nature: 'DEBIT' },
        '2': { type: 'LIABILITY', nature: 'CREDIT' },
        '3': { type: 'REVENUE', nature: 'CREDIT' },
        '4': { type: 'EXPENSE', nature: 'DEBIT' },
        '5': { type: 'EXPENSE', nature: 'DEBIT' },
    };
    const inferred = typeMap[first] ?? { type: 'ASSET', nature: 'DEBIT' };
    const isAnalytic = segments.length >= 5;

    return {
        type: inferred.type,
        nature: inferred.nature,
        parentId: '',
        isAnalytic,
    };
};

// Tenta aplicar máscara comparando dígitos brutos com códigos existentes no plano
const applyMaskFromPlan = (raw: string, allAccounts: Account[]): string => {
    const digits = raw.replace(/\./g, '');
    if (!digits || raw.includes('.')) return raw; // já tem pontos, não mexe

    // Procura conta no plano cujos dígitos (sem pontos) batem exatamente
    const match = allAccounts.find(a => a.code.replace(/\./g, '') === digits);
    if (match) return match.code; // achou exato — retorna o código formatado

    // Tenta encontrar irmãs com mesmo número de dígitos para extrair a máscara
    const len = digits.length;
    const sibling = allAccounts.find(a => {
        const d = a.code.replace(/\./g, '');
        return d.length === len && a.code.includes('.');
    });
    if (sibling) {
        // Aplica a mesma estrutura de pontos da conta irmã
        const template = sibling.code;
        const parts = template.split('.');
        let pos = 0;
        const result = parts.map(p => {
            const seg = digits.slice(pos, pos + p.length);
            pos += p.length;
            return seg;
        }).filter(Boolean).join('.');
        if (pos === digits.length) return result; // aplicou tudo
    }

    return raw; // fallback: retorna como digitado
};




// ── Componente ───────────────────────────────────────────────────────────────

export const AccountMaintenanceModal: React.FC<AccountMaintenanceModalProps> = ({
    open, onClose, onSuccess,
}) => {
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
    const [deleteConfirmed, setDeleteConfirmed] = useState(false);
    const [checkingBalance, setCheckingBalance] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteResult, setDeleteResult] = useState<{ success: number; failed: number; messages: string[] } | null>(null);

    // Edição
    const [editMode, setEditMode] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [editForm, setEditForm] = useState({ name: '', isAnalytic: false, spedCode: '', ifrsCode: '', usgaapCode: '', eSocialCode: '' });
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState('');

    // Criação
    const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);
    const [createMode, setCreateMode] = useState(false);
    const [createForm, setCreateForm] = useState({ ...emptyCreate });
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState('');

    // ── Carregar ──────────────────────────────────────────────────────────────

    useEffect(() => {
        if (open && activeCompany) loadAccounts();
    }, [open, activeCompany, searchTerm, filterType, filterLevel, filterAnalytic, filterActive]);

    const loadAccounts = async () => {
        setLoading(true);
        try {
            const params: any = { page: 1, limit: 1000 };
            if (searchTerm) params.search = searchTerm;
            if (filterType !== 'all') params.types = [filterType];
            if (filterAnalytic === 'analytic') params.onlyAnalytic = true;
            if (filterAnalytic === 'synthetic') params.onlySynthetic = true;
            if (filterActive === 'active') params.showInactive = false;
            if (filterActive === 'inactive') params.showInactive = true;
            const res = await api.get('/chart-of-accounts', {
                params, headers: { 'x-company-id': activeCompany?.id },
            });
            setAccounts(res.data.items || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const filteredAccounts = accounts.filter(a =>
        filterLevel === 'all' || a.level === parseInt(filterLevel)
    );
    const syntheticAccounts = accounts.filter(a => !a.isAnalytic);

    // ── Seleção ───────────────────────────────────────────────────────────────

    const toggleSelectAll = () => setSelectedAccounts(
        selectedAccounts.size === filteredAccounts.length
            ? new Set()
            : new Set(filteredAccounts.map(a => a.id))
    );
    const toggleSelect = (id: string) => {
        const s = new Set(selectedAccounts);
        s.has(id) ? s.delete(id) : s.add(id);
        setSelectedAccounts(s);
    };

    // ── Verificação ───────────────────────────────────────────────────────────

    const checkBalances = async () => {
        setCheckingBalance(true); setShowBalanceCheck(true);
        try {
            const checks: BalanceCheck[] = [];
            for (const id of selectedAccounts) {
                const a = accounts.find(x => x.id === id);
                if (!a) continue;
                const res = await api.get(`/chart-of-accounts/${id}/balance`, {
                    headers: { 'x-company-id': activeCompany?.id },
                });
                checks.push({
                    accountId: id, accountCode: a.code, accountName: a.name,
                    balance: res.data.balance || 0,
                    journalEntries: res.data.journalEntries || 0,
                    hasMovements: (res.data.journalEntries || 0) > 0,
                    hasChildren: a.hasChildren,
                });
            }
            setBalanceChecks(checks);
            setDeleteConfirmed(!checks.some(c => c.hasMovements || c.hasChildren));
        } catch (e) { console.error(e); }
        finally { setCheckingBalance(false); }
    };

    // ── Exclusão ──────────────────────────────────────────────────────────────

    const handleDelete = async () => {
        setDeleteLoading(true); setDeleteResult(null);
        try {
            const r = { success: 0, failed: 0, messages: [] as string[] };
            if (deleteMode === 'total') {
                const res = await api.delete('/chart-of-accounts/bulk', {
                    data: { operation: 'delete', permanent: deleteType === 'physical', filters: { companyId: activeCompany?.id } },
                    headers: { 'x-company-id': activeCompany?.id },
                });
                r.success = res.data.deleted || 0;
                r.messages.push(res.data.message || 'Concluído');
            } else {
                for (const id of selectedAccounts) {
                    try {
                        await api.delete(`/chart-of-accounts/${id}`, {
                            params: { permanent: deleteType === 'physical' },
                            headers: { 'x-company-id': activeCompany?.id },
                        });
                        r.success++;
                    } catch (e: any) {
                        r.failed++;
                        r.messages.push(e.response?.data?.message || 'Erro ao excluir');
                    }
                }
            }
            setDeleteResult(r);
            if (!r.failed) { loadAccounts(); onSuccess?.(); }
        } catch (e) { console.error(e); }
        finally { setDeleteLoading(false); }
    };

    // ── Edição ────────────────────────────────────────────────────────────────

    const handleEdit = (a: Account) => {
        setEditingAccount(a);
        setEditForm({
            name: a.name, isAnalytic: a.isAnalytic,
            spedCode: a.spedCode || '', ifrsCode: a.ifrsCode || '',
            usgaapCode: a.usgaapCode || '', eSocialCode: a.eSocialCode || '',
        });
        setEditError('');
        setEditMode(true);
    };

    const handleSaveEdit = async () => {
        if (!editingAccount) return;
        setEditSaving(true); setEditError('');
        try {
            await api.put(`/chart-of-accounts/${editingAccount.id}`, editForm, {
                headers: { 'x-company-id': activeCompany?.id },
            });
            setEditMode(false); setEditingAccount(null);
            loadAccounts(); onSuccess?.();
        } catch (e: any) {
            setEditError(e.response?.data?.message || 'Erro ao salvar');
        } finally { setEditSaving(false); }
    };

    // ── Criação ───────────────────────────────────────────────────────────────

    const openCreate = () => {
        setCreateForm({ ...emptyCreate });
        setCreateError('');
        setCreateMode(true);
    };

    const handleSaveCreate = async () => {
        if (!createForm.code.trim() || !createForm.name.trim()) {
            setCreateError('Código e Nome são obrigatórios.');
            return;
        }
        setCreateLoading(true); setCreateError('');
        try {
            const payload: any = {
                code: createForm.code.trim(),
                name: createForm.name.trim(),
                type: createForm.type,
                nature: createForm.nature,
                isAnalytic: createForm.isAnalytic,
            };
            if (createForm.parentId) payload.parentId = createForm.parentId;
            if (createForm.spedCode) payload.spedCode = createForm.spedCode;
            if (createForm.ifrsCode) payload.ifrsCode = createForm.ifrsCode;
            if (createForm.usgaapCode) payload.usgaapCode = createForm.usgaapCode;
            if (createForm.eSocialCode) payload.eSocialCode = createForm.eSocialCode;

            const res = await api.post('/chart-of-accounts', payload, {
                headers: { 'x-company-id': activeCompany?.id },
            });
            const newId = res.data?.id;
            // Limpa form mas mantém modal aberto para criar próxima conta
            setCreateForm({ ...emptyCreate });
            setCreateError('');
            toast.success(`Conta "${payload.name}" criada com sucesso!`);
            await loadAccounts();
            // Highlight na linha criada
            if (newId) {
                setLastCreatedId(newId);
                setTimeout(() => setLastCreatedId(null), 3000);
                // Scroll até a linha
                setTimeout(() => {
                    const el = document.getElementById(`account-row-${newId}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            }
            onSuccess?.();
        } catch (e: any) {
            setCreateError(e.response?.data?.message || 'Erro ao criar conta.');
        } finally { setCreateLoading(false); }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
            {/* Modal principal */}
            <Modal open={open} onClose={onClose}>
                <Box sx={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '90%', maxWidth: 1200, maxHeight: '90vh',
                    bgcolor: 'background.paper', borderRadius: 2,
                    boxShadow: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column',
                }}>
                    <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6">Manutenção do Plano de Contas</Typography>
                        <IconButton onClick={onClose}><CloseIcon /></IconButton>
                    </Box>

                    <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
                        {/* Filtros */}
                        <Paper sx={{ p: 2, mb: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>Filtros</Typography>
                            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                                <TextField size="small" label="Buscar código/nome" value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)} sx={{ width: 260 }} />
                                <FormControl size="small" sx={{ width: 140 }}>
                                    <InputLabel>Tipo</InputLabel>
                                    <Select value={filterType} onChange={e => setFilterType(e.target.value)}>
                                        <MenuItem value="all">Todos</MenuItem>
                                        {ACCOUNT_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                                    </Select>
                                </FormControl>
                                <FormControl size="small" sx={{ width: 120 }}>
                                    <InputLabel>Nível</InputLabel>
                                    <Select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
                                        <MenuItem value="all">Todos</MenuItem>
                                        {[1, 2, 3, 4, 5].map(n => <MenuItem key={n} value={String(n)}>Nível {n}</MenuItem>)}
                                    </Select>
                                </FormControl>
                                <FormControl size="small" sx={{ width: 150 }}>
                                    <InputLabel>Analiticidade</InputLabel>
                                    <Select value={filterAnalytic} onChange={e => setFilterAnalytic(e.target.value)}>
                                        <MenuItem value="all">Todos</MenuItem>
                                        <MenuItem value="analytic">Analíticas</MenuItem>
                                        <MenuItem value="synthetic">Sintéticas</MenuItem>
                                    </Select>
                                </FormControl>
                                <FormControl size="small" sx={{ width: 130 }}>
                                    <InputLabel>Status</InputLabel>
                                    <Select value={filterActive} onChange={e => setFilterActive(e.target.value)}>
                                        <MenuItem value="all">Todos</MenuItem>
                                        <MenuItem value="active">Ativas</MenuItem>
                                        <MenuItem value="inactive">Inativas</MenuItem>
                                    </Select>
                                </FormControl>
                            </Stack>
                        </Paper>

                        {/* Ações */}
                        <Paper sx={{ p: 2, mb: 2 }}>
                            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                                <FormControl component="fieldset">
                                    <RadioGroup row value={deleteMode} onChange={e => setDeleteMode(e.target.value as any)}>
                                        <FormControlLabel value="partial" control={<Radio size="small" />} label="Exclusão Parcial" />
                                        <FormControlLabel value="total" control={<Radio size="small" />} label="Exclusão Total" />
                                    </RadioGroup>
                                </FormControl>
                                <FormControl component="fieldset">
                                    <RadioGroup row value={deleteType} onChange={e => setDeleteType(e.target.value as any)}>
                                        <FormControlLabel value="logical" control={<Radio size="small" />} label="Exclusão Lógica" />
                                        <FormControlLabel value="physical" control={<Radio size="small" />} label="Exclusão Física" />
                                    </RadioGroup>
                                </FormControl>
                                <Button variant="outlined" size="small" startIcon={<SearchIcon />}
                                    onClick={checkBalances} disabled={!selectedAccounts.size || checkingBalance}>
                                    Verificar Saldos
                                </Button>
                                <Button variant="contained" size="small" startIcon={<AddIcon />}
                                    onClick={openCreate}
                                    sx={{ ml: 'auto !important', bgcolor: '#111111', '&:hover': { bgcolor: '#333' } }}>
                                    Nova Conta
                                </Button>
                            </Stack>
                        </Paper>

                        {/* Verificação */}
                        <Collapse in={showBalanceCheck}>
                            <Paper sx={{ p: 2, mb: 2, bgcolor: '#f5f5f5' }}>
                                <Typography variant="subtitle2" gutterBottom>Verificação de Integridade</Typography>
                                {checkingBalance ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress /></Box>
                                ) : (
                                    <>
                                        <TableContainer sx={{ maxHeight: 200 }}>
                                            <Table size="small" stickyHeader>
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>Código</TableCell><TableCell>Nome</TableCell>
                                                        <TableCell align="right">Saldo</TableCell>
                                                        <TableCell align="right">Lançamentos</TableCell>
                                                        <TableCell>Status</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {balanceChecks.map(c => (
                                                        <TableRow key={c.accountId}>
                                                            <TableCell>{c.accountCode}</TableCell>
                                                            <TableCell>{c.accountName}</TableCell>
                                                            <TableCell align="right">
                                                                {c.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                            </TableCell>
                                                            <TableCell align="right">{c.journalEntries}</TableCell>
                                                            <TableCell>
                                                                {c.hasChildren
                                                                    ? <Chip size="small" label="Tem filhas" color="warning" />
                                                                    : c.hasMovements
                                                                        ? <Chip size="small" label="Com lançamentos" color="error" />
                                                                        : <Chip size="small" label="OK" color="success" />}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                        {!deleteConfirmed && (
                                            <Alert severity="warning" sx={{ mt: 2 }}>
                                                <AlertTitle>Atenção</AlertTitle>
                                                Algumas contas possuem lançamentos ou contas filhas.
                                            </Alert>
                                        )}
                                    </>
                                )}
                            </Paper>
                        </Collapse>

                        {/* Lista */}
                        <Paper sx={{ p: 2 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                                <Typography variant="subtitle2">Contas Encontradas ({filteredAccounts.length})</Typography>
                                <Stack direction="row" spacing={1}>
                                    <Button size="small" onClick={toggleSelectAll}>
                                        {selectedAccounts.size === filteredAccounts.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                                    </Button>
                                    <Button size="small" variant="contained" color="error"
                                        startIcon={<DeleteIcon />}
                                        disabled={!selectedAccounts.size || deleteLoading}
                                        onClick={handleDelete}>
                                        Excluir Selecionadas
                                    </Button>
                                </Stack>
                            </Stack>
                            <TableContainer sx={{ maxHeight: 400 }}>
                                <Table size="small" stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    checked={selectedAccounts.size === filteredAccounts.length && filteredAccounts.length > 0}
                                                    indeterminate={selectedAccounts.size > 0 && selectedAccounts.size < filteredAccounts.length}
                                                    onChange={toggleSelectAll}
                                                />
                                            </TableCell>
                                            <TableCell>Código</TableCell><TableCell>Nome</TableCell>
                                            <TableCell>Nível</TableCell><TableCell>Tipo</TableCell>
                                            <TableCell>Natureza</TableCell><TableCell>Analítica</TableCell>
                                            <TableCell>Status</TableCell><TableCell>Ações</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={9} align="center"><CircularProgress size={28} /></TableCell>
                                            </TableRow>
                                        ) : filteredAccounts.map(a => (
                                            <TableRow
                                                key={a.id}
                                                id={`account-row-${a.id}`}
                                                hover
                                                sx={lastCreatedId === a.id ? {
                                                    backgroundColor: '#EFF6FF !important',
                                                    outline: '2px solid #2563EB',
                                                    transition: 'background-color 0.5s',
                                                } : {}}>
                                                <TableCell padding="checkbox">
                                                    <Checkbox checked={selectedAccounts.has(a.id)} onChange={() => toggleSelect(a.id)} />
                                                </TableCell>
                                                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{a.code}</TableCell>
                                                <TableCell>{a.name}</TableCell>
                                                <TableCell>{a.level}</TableCell>
                                                <TableCell>{ACCOUNT_TYPES.find(t => t.value === a.type)?.label ?? a.type}</TableCell>
                                                <TableCell>{a.nature === 'DEBIT' ? 'D' : 'C'}</TableCell>
                                                <TableCell>{a.isAnalytic ? 'Sim' : 'Não'}</TableCell>
                                                <TableCell>
                                                    <Chip size="small" label={a.isActive ? 'Ativa' : 'Inativa'}
                                                        color={a.isActive ? 'success' : 'default'} />
                                                </TableCell>
                                                <TableCell>
                                                    <Tooltip title="Editar">
                                                        <IconButton size="small" onClick={() => handleEdit(a)}>
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>

                        {deleteResult && (
                            <Alert severity={deleteResult.failed === 0 ? 'success' : 'warning'} sx={{ mt: 2 }}>
                                <AlertTitle>{deleteResult.failed === 0 ? 'Exclusão concluída' : 'Exclusão parcial'}</AlertTitle>
                                <div>✅ Sucesso: {deleteResult.success}</div>
                                {deleteResult.failed > 0 && <div>❌ Falhas: {deleteResult.failed}</div>}
                                {deleteResult.messages.map((m, i) => <div key={i} style={{ fontSize: '0.85em' }}>{m}</div>)}
                            </Alert>
                        )}
                    </Box>

                    <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end' }}>
                        <Button onClick={onClose}>Fechar</Button>
                    </Box>
                </Box>
            </Modal>

            {/* Modal de Edição — fora do modal principal para evitar z-index */}
            <Modal open={editMode} onClose={() => setEditMode(false)}>
                <Box sx={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 480, bgcolor: 'background.paper', borderRadius: 2, boxShadow: 24, p: 3,
                }}>
                    <Typography variant="h6" gutterBottom>Editar Conta: {editingAccount?.code}</Typography>
                    <Stack spacing={2}>
                        <TextField label="Nome" fullWidth value={editForm.name}
                            onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                        <FormControlLabel
                            control={<Checkbox checked={editForm.isAnalytic}
                                onChange={e => setEditForm({ ...editForm, isAnalytic: e.target.checked })} />}
                            label="Conta Analítica" />
                        <TextField label="Código SPED" fullWidth value={editForm.spedCode}
                            onChange={e => setEditForm({ ...editForm, spedCode: e.target.value })} />
                        <TextField label="Código IFRS" fullWidth value={editForm.ifrsCode}
                            onChange={e => setEditForm({ ...editForm, ifrsCode: e.target.value })} />
                        <TextField label="Código USGAAP" fullWidth value={editForm.usgaapCode}
                            onChange={e => setEditForm({ ...editForm, usgaapCode: e.target.value })} />
                        <TextField label="Código eSocial" fullWidth value={editForm.eSocialCode}
                            onChange={e => setEditForm({ ...editForm, eSocialCode: e.target.value })} />
                        {editError && <Alert severity="error">{editError}</Alert>}
                        <Stack direction="row" spacing={2} justifyContent="flex-end">
                            <Button onClick={() => setEditMode(false)}>Cancelar</Button>
                            <LoadingButton variant="contained" loading={editSaving} onClick={handleSaveEdit}>
                                Salvar
                            </LoadingButton>
                        </Stack>
                    </Stack>
                </Box>
            </Modal>

            {/* Modal de Criação — fora do modal principal */}
            <Modal open={createMode} onClose={() => setCreateMode(false)}>
                <Box sx={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 520, bgcolor: 'background.paper', borderRadius: 2,
                    boxShadow: 24, p: 3, maxHeight: '85vh', overflow: 'auto',
                }}>
                    <Typography variant="h6" gutterBottom>Nova Conta</Typography>
                    <Stack spacing={2}>
                        <Stack direction="row" spacing={2}>
                            <TextField label="Código *" value={createForm.code} sx={{ width: 160 }}
                                placeholder="ex: 3.1.1"
                                onChange={e => setCreateForm({ ...createForm, code: e.target.value })}
                                onBlur={e => {
                                    const withMask = applyMaskFromPlan(e.target.value, accounts);
                                    const inferred = inferFromCode(e.target.value, accounts);
                                    setCreateForm(prev => ({ ...prev, ...inferred }));
                                }} />
                            <TextField label="Nome *" fullWidth value={createForm.name}
                                onChange={e => setCreateForm({ ...createForm, name: e.target.value })} />
                        </Stack>
                        <Stack direction="row" spacing={2}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Tipo *</InputLabel>
                                <Select value={createForm.type}
                                    onChange={e => setCreateForm({ ...createForm, type: e.target.value })}>
                                    {ACCOUNT_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth size="small">
                                <InputLabel>Natureza *</InputLabel>
                                <Select value={createForm.nature}
                                    onChange={e => setCreateForm({ ...createForm, nature: e.target.value })}>
                                    {ACCOUNT_NATURES.map(n => <MenuItem key={n.value} value={n.value}>{n.label}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Stack>
                        <Autocomplete
                            options={syntheticAccounts}
                            getOptionLabel={o => `${o.code} — ${o.name}`}
                            value={syntheticAccounts.find(a => a.id === createForm.parentId) ?? null}
                            onChange={(_, v) => setCreateForm({ ...createForm, parentId: v?.id ?? '' })}
                            renderInput={params => (
                                <TextField {...params} label="Conta Pai (opcional)" size="small"
                                    placeholder="Deixe em branco para conta raiz" />
                            )}
                            isOptionEqualToValue={(o, v) => o.id === v.id}
                            noOptionsText="Nenhuma conta sintética"
                        />
                        <FormControlLabel
                            control={<Checkbox checked={createForm.isAnalytic}
                                onChange={e => setCreateForm({ ...createForm, isAnalytic: e.target.checked })} />}
                            label="Conta Analítica (recebe lançamentos diretamente)" />
                        <Stack direction="row" spacing={2}>
                            <TextField label="Código SPED" fullWidth size="small" value={createForm.spedCode}
                                onChange={e => setCreateForm({ ...createForm, spedCode: e.target.value })} />
                            <TextField label="Código IFRS" fullWidth size="small" value={createForm.ifrsCode}
                                onChange={e => setCreateForm({ ...createForm, ifrsCode: e.target.value })} />
                        </Stack>
                        {createError && <Alert severity="error">{createError}</Alert>}
                        <Stack direction="row" spacing={2} justifyContent="flex-end">
                            <Button onClick={() => setCreateMode(false)}>Cancelar</Button>
                            <LoadingButton variant="contained" loading={createLoading} onClick={handleSaveCreate}
                                sx={{ bgcolor: '#111111', '&:hover': { bgcolor: '#333' } }}>
                                Criar Conta
                            </LoadingButton>
                        </Stack>
                    </Stack>
                </Box>
            </Modal>
        </>
    );
};

export default AccountMaintenanceModal;