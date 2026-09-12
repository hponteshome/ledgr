// frontend/src/pages/system/SpedPlanoReferencialPage.tsx
// NOVO (12/09/2026): tela de Admin para upload/atualizacao do Plano
// Referencial SPED (I051) - antes so era possivel via script PowerShell
// direto no servidor. Segue o mesmo padrao de "Tabelas Legais"
// (atualizacao 100% manual, sem busca automatica de fonte oficial).
import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';

interface Resumo {
  tabela: string;
  anoBase: number;
  versao: number;
  quantidade: number;
  importadoEm: string;
}

interface Status {
  totalLinhas: number;
  ultimaImportacao: string | null;
}

interface ImportResult {
  file: string;
  tabela: string | null;
  anoBase: number | null;
  versao: number | null;
  inserted: number;
  error?: string;
}

const fmtData = (v: string | null) =>
  v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-';

export const SpedPlanoReferencialPage: React.FC = () => {
  const [status, setStatus] = useState<Status | null>(null);
  const [resumo, setResumo] = useState<Resumo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        api.get<Status>('/accounting/sped-plano-referencial/status'),
        api.get<Resumo[]>('/accounting/sped-plano-referencial/summary'),
      ]);
      setStatus(s.data);
      setResumo(r.data);
    } catch {
      // silencioso - a tela ja mostra "0 linhas" se a chamada falhar
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const handleUpload = async (files: FileList) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setResults(null);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append('files', f);
      const r = await api.post('/accounting/sped-plano-referencial/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResults(r.data.results || []);
      await carregar();
    } catch (e: any) {
      setResults([{ file: '?', tabela: null, anoBase: null, versao: null, inserted: 0, error: e?.response?.data?.message || 'Erro ao importar.' }]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const vazio = status !== null && status.totalLinhas === 0;

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <div style={{ marginBottom: 4, fontSize: 12, color: '#9CA3AF' }}>
        Administração / Parâmetros Globais
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Plano Referencial SPED</h1>
      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
        Tabela dinâmica oficial da Receita (registro I051 — P100/P150/L100/L300/U100/U150).
        Atualização 100% manual: baixe os arquivos mais recentes da instalação do programa
        SPED Contábil e envie aqui sempre que a Receita publicar uma tabela nova.
      </div>

      {loading ? (
        <div style={{ padding: 20, color: '#9CA3AF', fontSize: 13 }}>Carregando...</div>
      ) : vazio ? (
        <div style={{ padding: 14, background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 13, marginBottom: 20 }}>
          <strong>Nenhuma tabela importada ainda.</strong> O campo "Conta Referencial (SPED)"
          não terá autocomplete até que ao menos uma tabela seja enviada abaixo.
        </div>
      ) : (
        <div style={{ padding: 14, background: '#F0FDF4', border: '0.5px solid #BBF7D0', borderRadius: 8, color: '#15803D', fontSize: 13, marginBottom: 20 }}>
          <strong>{status?.totalLinhas.toLocaleString('pt-BR')} linha(s)</strong> carregadas ·
          última importação: <strong>{fmtData(status?.ultimaImportacao ?? null)}</strong>
        </div>
      )}

      <div style={{ border: '1px dashed #D1D5DB', borderRadius: 8, padding: 24, textAlign: 'center', marginBottom: 24, background: '#FAFAFA' }}>
        <input ref={fileRef} type="file" multiple style={{ display: 'none' }}
          onChange={e => e.target.files && handleUpload(e.target.files)} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#111', color: '#fff', fontSize: 13, cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.5 : 1 }}
        >
          {uploading ? 'Importando...' : 'Selecionar arquivos SPED_DINAMICO...'}
        </button>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
          Selecione um ou mais arquivos da pasta de instalação do programa SPED Contábil
          (nome no padrão SPEDCONTABIL_DINAMICO_ANO$SPEDECF_DINAMICA_TABELA$VERSAO$ID).
        </div>
      </div>

      {results && (
        <div style={{ marginBottom: 24, border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
          {results.map((r, i) => (
            <div key={i} style={{
              padding: '8px 14px', fontSize: 12, borderBottom: i < results.length - 1 ? '0.5px solid #F3F4F6' : 'none',
              color: r.error ? '#B91C1C' : '#15803D',
            }}>
              {r.file} {r.tabela ? `(${r.tabela}/${r.anoBase} v${r.versao})` : ''} —
              {r.error ? ` ${r.error}` : ` ${r.inserted} linha(s) inserida(s)`}
            </div>
          ))}
        </div>
      )}

      <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              {['Tabela', 'Ano', 'Versão', 'Linhas', 'Importado em'].map(h => (
                <th key={h} style={{
                  padding: '8px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase',
                  textAlign: h === 'Linhas' ? 'right' : 'left', borderBottom: '1px solid #E5E7EB',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resumo.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>Nenhum dado carregado.</td></tr>
            ) : (
              resumo.map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: '8px 10px', fontSize: 13, fontFamily: 'monospace', borderBottom: '0.5px solid #F3F4F6' }}>{r.tabela}</td>
                  <td style={{ padding: '8px 10px', fontSize: 13, borderBottom: '0.5px solid #F3F4F6' }}>{r.anoBase}</td>
                  <td style={{ padding: '8px 10px', fontSize: 13, borderBottom: '0.5px solid #F3F4F6' }}>{r.versao}</td>
                  <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'right', borderBottom: '0.5px solid #F3F4F6' }}>{r.quantidade}</td>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: '#9CA3AF', borderBottom: '0.5px solid #F3F4F6' }}>{fmtData(r.importadoEm)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SpedPlanoReferencialPage;
