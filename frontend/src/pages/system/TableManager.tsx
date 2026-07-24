// apps/frontend/src/components/TableManager.tsx

import React, { useState } from "react";
import api from "../../services/api";
// Certifique-se de instalar: npm install lucide-react
import { Download, Upload, Database, CheckCircle, AlertCircle, Loader2, List, X, Copy, Check } from "lucide-react";

// ── CONSTANTES ──────────────────────────────────────────────────────────────

const TABLES = [
  // Tabelas principais (ordem de dependência)
  { id: 'profiles', name: 'Perfis de Acesso' },
  { id: 'companies', name: 'Empresas/CNPJs' },
  { id: 'persons', name: 'Pessoas (Base)' },
  { id: 'users', name: 'Usuários do Sistema' },
  // Tabelas de relacionamento (dependentes das anteriores)
  { id: 'user_companies', name: 'Vínculo Usuário-Empresa' },
  { id: 'person_companies', name: 'Vínculo Pessoa-Empresa' },
  // Contabilidade e RH
  { id: 'employees', name: 'Funcionários (RH)' },
  { id: 'chart_of_accounts', name: 'Plano de Contas' },
  { id: 'journal_entries', name: 'Lançamentos Contábeis' },
  { id: 'journal_entry_items', name: 'Itens de Lançamento' },
  { id: 'fixed_assets', name: 'Ativos Imobilizados' },
  { id: 'fixed_income_investments', name: 'Investimentos Renda Fixa' },
  { id: 'employee_dependents', name: 'Dependentes de Funcionários' },
  { id: 'ap_entries', name: 'Contas a Pagar' },
  { id: 'bank_statements', name: 'Extratos Bancários' },
  { id: 'bank_transactions', name: 'Transações Bancárias' },
  { id: 'fiscal_documents', name: 'Documentos Fiscais' },
  { id: 'agenda_events', name: 'Agenda Financeira' },
  { id: 'provisao_configs', name: 'Provisões Recorrentes' },
  { id: 'pro_labore_configs', name: 'Configurações Pró-labore' },
  { id: 'pro_labore_calculos', name: 'Cálculos Pró-labore' },
  { id: 'informes_rendimentos', name: 'Informes de Rendimentos' },
  { id: 'ecd_imports', name: 'Importações ECD' },
  { id: 'documents', name: 'Documentos Societários' },
  { id: 'holidays', name: 'Feriados' },
  { id: 'cdi_daily_rates', name: 'Taxas CDI' },
];

// Mapeamento para os endpoints (plural → singular)
const ENDPOINT_MAP: Record<string, string> = {
  'profiles': 'profile',
  'companies': 'company',
  'persons': 'person',
  'users': 'user',
  'user_companies': 'user-company',
  'person_companies': 'person-company'
};

// ── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────

export const TableManager: React.FC = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  // 🔴 NOVO: Estado para seleção em massa
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());

  // Layout (DMMF) de uma tabela
  const [layoutTable, setLayoutTable] = useState<string | null>(null);
  const [layoutData, setLayoutData] = useState<any>(null);
  const [loadingLayout, setLoadingLayout] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Handlers de seleção ───────────────────────────────────────────────────

  const toggleAll = () => {
    if (selectedTables.size === TABLES.length) {
      // Desmarcar todas
      setSelectedTables(new Set());
    } else {
      // Marcar todas
      setSelectedTables(new Set(TABLES.map(t => t.id)));
    }
  };

  const toggleTable = (tableId: string) => {
    const newSelected = new Set(selectedTables);
    if (newSelected.has(tableId)) {
      newSelected.delete(tableId);
    } else {
      newSelected.add(tableId);
    }
    setSelectedTables(newSelected);
  };

  // ── Handlers de exportação/importação ─────────────────────────────────────

  const handleViewLayout = async (table: string) => {
    setLayoutTable(table);
    setLayoutData(null);
    setCopied(false);
    setLoadingLayout(true);
    try {
      const res = await api.get(`/system/layout/${table}`);
      setLayoutData(res.data);
    } catch (err) {
      console.error('Erro ao buscar layout:', err);
      setLayoutData({ error: true });
    } finally {
      setLoadingLayout(false);
    }
  };

  const handleCopyHeader = () => {
    if (!layoutData?.fields) return;
    const header = layoutData.fields.map((f: any) => f.name).join(';');
    navigator.clipboard.writeText(header);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const handleExport = async (table: string) => {
    setLoading(`export-${table}`);
    setStatus(null);
    try {
      const endpointTable = ENDPOINT_MAP[table] || table;
      const endpoint = `/system/export/${endpointTable}`;
      const companyId = localStorage.getItem('@ledgr:companyId');

      console.log(`📡 Exportando: ${table} → ${endpoint}`);

      const response = await api.get(endpoint, {
        responseType: 'blob',
        headers: {
          'x-company-id': companyId
        }
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ledgr_${table}_${new Date().toISOString().slice(0, 10)}.txt`);
      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(url);

      setStatus({ type: 'success', msg: `✅ Exportação de ${table} concluída com sucesso!` });
    } catch (err) {
      console.error('Erro na exportação:', err);
      setStatus({ type: 'error', msg: `❌ Falha ao exportar a tabela ${table}.` });
    } finally {
      setLoading(null);
    }
  };

  // 🔴 NOVO: Exportação em massa
  const handleExportAll = async () => {
    if (selectedTables.size === 0) {
      setStatus({ type: 'error', msg: '❌ Selecione pelo menos uma tabela para exportar.' });
      return;
    }

    setLoading('export-all');
    setStatus(null);

    const results = [];
    let hasError = false;

    for (const tableId of selectedTables) {
      try {
        const endpointTable = ENDPOINT_MAP[tableId] || tableId;
        const endpoint = `/system/export/${endpointTable}`;
        const companyId = localStorage.getItem('@ledgr:companyId');

        console.log(`📡 Exportando: ${tableId} → ${endpoint}`);

        const response = await api.get(endpoint, {
          responseType: 'blob',
          headers: {
            'x-company-id': companyId
          }
        });

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `ledgr_${tableId}_${new Date().toISOString().slice(0, 10)}.txt`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        results.push(`✅ ${tableId}`);
      } catch (err) {
        console.error(`Erro na exportação de ${tableId}:`, err);
        results.push(`❌ ${tableId}`);
        hasError = true;
      }
    }

    setStatus({
      type: hasError ? 'error' : 'success',
      msg: hasError
        ? '⚠️ Algumas exportações falharam. Verifique o console.'
        : '✅ Todas as exportações foram concluídas com sucesso!'
    });

    setLoading(null);
  };

  const handleImport = async (table: string, file: File) => {
    setLoading(`import-${table}`);
    setStatus(null);

    try {
      const endpointTable = ENDPOINT_MAP[table] || table;
      const endpoint = `/system/import/${endpointTable}`;

      const formData = new FormData();
      formData.append('file', file);

      const companyId = localStorage.getItem('@ledgr:companyId');

      const response = await api.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-company-id': companyId
        }
      });

      const data = response.data;

      // Construir mensagem detalhada
      let msg = '';
      if (data.imported > 0) msg += `${data.imported} novo(s) registro(s) inserido(s). `;
      if (data.updated > 0) msg += `${data.updated} registro(s) atualizado(s). `;
      if (data.skipped > 0) msg += `${data.skipped} registro(s) ignorado(s). `;

      // Mostrar duplicatas específicas
      if (data.duplicates && data.duplicates.length > 0) {
        msg += '\n\n⚠️ Registros duplicados:\n';
        data.duplicates.forEach((dup: any) => {
          msg += `• ${dup.message}\n`;
        });
      }

      setStatus({
        type: 'success',
        msg: msg || `✅ Importação finalizada.`
      });

    } catch (err: any) {
      console.error('Erro na importação:', err);
      const errorMsg = err.response?.data?.message || `❌ Erro na importação de ${table}.`;
      setStatus({ type: 'error', msg: errorMsg });
    } finally {
      setLoading(null);
    }
  };

  // ── RENDERIZAÇÃO ──────────────────────────────────────────────────────────

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      {/* ── Cabeçalho ───────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8 border-b border-gray-50 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Database className="text-blue-600" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Manutenção de Dados</h2>
            <p className="text-sm text-gray-500">Importação e Exportação via arquivos estruturados (TXT)</p>
          </div>
        </div>
      </div>

      {/* ── Status Messages ─────────────────────────────────── */}
      {status && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 animate-in fade-in duration-300 ${status.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-100'
            : 'bg-red-50 text-red-700 border border-red-100'
          }`}>
          {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-medium whitespace-pre-line">{status.msg}</span>
        </div>
      )}

      {/* ── Ações em Massa ──────────────────────────────────── */}
      <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedTables.size === TABLES.length}
                ref={(input) => {
                  if (input) {
                    input.indeterminate = selectedTables.size > 0 && selectedTables.size < TABLES.length;
                  }
                }}
                onChange={toggleAll}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                {selectedTables.size === TABLES.length
                  ? 'Desmarcar Todas'
                  : selectedTables.size === 0
                    ? 'Marcar Todas'
                    : `${selectedTables.size} tabelas selecionadas`}
              </span>
            </label>
          </div>

          <button
            onClick={handleExportAll}
            disabled={loading !== null || selectedTables.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
          >
            {loading === 'export-all' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {loading === 'export-all' ? 'Exportando...' : 'Exportar Selecionadas'}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">
          Selecione as tabelas para exportação em massa. A ordem recomendada é: Perfis → Empresas → Pessoas → Usuários → Vínculos.
        </p>
      </div>

      {/* ── Lista de Tabelas ────────────────────────────────── */}
      <div className="grid gap-3">
        {TABLES.map((table) => (
          <div key={table.id} className="flex items-center justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all group">
            <div className="flex items-center gap-3">
              {/* 🔴 Checkbox individual */}
              <input
                type="checkbox"
                checked={selectedTables.has(table.id)}
                onChange={() => toggleTable(table.id)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-bold text-gray-700 group-hover:text-blue-700 transition-colors">
                  {table.name}
                </span>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5 uppercase tracking-tighter">
                  Database: {table.id}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleViewLayout(table.id)}
                disabled={!!loading}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-sm disabled:opacity-50 transition-all"
              >
                <List size={14} /> Ver Layout
              </button>
              <button
                onClick={() => handleExport(table.id)}
                disabled={!!loading}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:text-blue-600 hover:border-blue-200 hover:shadow-sm disabled:opacity-50 transition-all"
              >
                {loading === `export-${table.id}` ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {loading === `export-${table.id}` ? 'Gerando...' : 'Exportar'}
              </button>

              <label className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm
                ${loading === `import-${table.id}` ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100'}`}>
                {loading === `import-${table.id}` ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {loading === `import-${table.id}` ? 'Enviando...' : 'Importar TXT'}
                <input
                  type="file"
                  className="hidden"
                  accept=".txt"
                  disabled={!!loading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImport(table.id, file);
                    e.target.value = ''; // Reset para permitir re-upload do mesmo arquivo
                  }}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* ── Modal de Layout ─────────────────────────────────── */}
      {layoutTable && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setLayoutTable(null); }}
        >
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Layout: {TABLES.find(t => t.id === layoutTable)?.name}</h3>
                {layoutData?.model && <p className="text-[11px] text-gray-400 font-mono mt-0.5">model {layoutData.model} · database: {layoutTable}</p>}
              </div>
              <button onClick={() => setLayoutTable(null)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-auto px-5 py-4">
              {loadingLayout ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-300" size={28} /></div>
              ) : layoutData?.error ? (
                <p className="text-sm text-red-600">Não foi possível carregar o layout desta tabela.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-400 uppercase text-[10px]">
                      <th className="pb-2">Campo (usar no cabeçalho do TXT)</th>
                      <th className="pb-2">Tipo</th>
                      <th className="pb-2">Obrigatório</th>
                    </tr>
                  </thead>
                  <tbody>
                    {layoutData?.fields?.map((f: any) => (
                      <tr key={f.name} className="border-t border-gray-50">
                        <td className="py-1.5 font-mono text-gray-700">{f.name}</td>
                        <td className="py-1.5 text-gray-500">{f.type}</td>
                        <td className="py-1.5">{f.required ? <span className="text-red-500 font-semibold">sim</span> : <span className="text-gray-300">não</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {!loadingLayout && layoutData?.fields && (
              <div className="px-5 py-3 border-t border-gray-100">
                <button
                  onClick={handleCopyHeader}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-all"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copiado!' : 'Copiar Linha de Cabeçalho'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Notas de Segurança ──────────────────────────────── */}
      <div className="mt-10 p-5 bg-blue-50/50 border border-blue-100 rounded-2xl">
        <div className="flex gap-3">
          <AlertCircle className="text-blue-500 shrink-0" size={20} />
          <div className="text-sm text-blue-900/80 leading-relaxed">
            <p className="font-bold text-blue-900 mb-1">Notas de Segurança:</p>
            <ul className="list-disc ml-4 space-y-1">
              <li>A importação utiliza <strong>Upsert</strong>: registros com IDs existentes serão atualizados.</li>
              <li>O delimitador esperado no arquivo é o ponto e vírgula <strong>(;)</strong>.</li>
              <li><strong className="text-red-600">Ordem recomendada para importação:</strong> Perfis → Empresas → Pessoas → Usuários → Vínculos.</li>
              <li>Recomendado realizar um backup antes de importações massivas.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};