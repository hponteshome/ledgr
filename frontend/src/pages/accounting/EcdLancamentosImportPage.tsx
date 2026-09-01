// frontend/src/pages/accounting/EcdLancamentosImportPage.tsx
// Importa a movimentacao real da ECD (I200/I250) como lancamentos LEDGR de
// verdade, apontando para as contas Matriz via de/para ja confirmado. Ano
// extraido automaticamente do arquivo. Upload real via navegador.
import React, { useState, useRef } from 'react';
import api from '@/services/api';

interface Preview {
  ano: number;
  loteReferencia: string;
  totalLancamentos: number;
  totalItens: number;
  dataInicial: string | null;
  dataFinal: string | null;
  contasNaoMapeadas: { code: string; ocorrencias: number }[];
  podeRegistrar: boolean;
}

export const EcdLancamentosImportPage: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; mensagem: string } | null>(null);

  const handleArquivoSelecionado = async (file: File) => {
    setArquivo(file);
    setPreview(null);
    setResultado(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/accounting/ecd-lancamentos/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(r.data);
    } catch (e: any) {
      setResultado({ ok: false, mensagem: e?.response?.data?.message || 'Erro ao processar arquivo.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrar = async () => {
    if (!preview?.podeRegistrar || !arquivo) return;
    if (!confirm(`Confirma o registro de ${preview.totalLancamentos} lancamento(s) (${preview.totalItens} itens)? Se ja existir um lote "${preview.loteReferencia}", ele sera substituido.`)) return;
    setRegistrando(true);
    setResultado(null);
    try {
      const fd = new FormData();
      fd.append('file', arquivo);
      const r = await api.post('/accounting/ecd-lancamentos/registrar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResultado({ ok: true, mensagem: `${r.data.criados} lancamento(s) registrado(s) com sucesso (lote ${r.data.loteReferencia}).` });
      setPreview(null);
      setArquivo(null);
    } catch (e: any) {
      setResultado({ ok: false, mensagem: e?.response?.data?.message || 'Erro ao registrar.' });
    } finally {
      setRegistrando(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 780 }}>
      <header style={{ marginBottom: 20 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#F0F9FF', color: '#0369A1', marginBottom: 6 }}>
          ◆ Contabil
        </span>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111111', margin: 0 }}>Lancamentos ECD</h1>
        <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>
          Converte a movimentacao real da ECD (I200/I250) em lancamentos LEDGR, apontando para as contas Matriz via de/para ja confirmado. Historico padrao: "Lancamento com Origem na ECD nesta data". Ano identificado automaticamente pelo arquivo. Re-registrar sempre substitui o lote anterior do mesmo ano, nunca soma.
        </p>
      </header>

      <input
        ref={inputRef}
        type="file"
        accept=".txt"
        style={{ display: 'none' }}
        onChange={e => e.target.files?.[0] && handleArquivoSelecionado(e.target.files[0])}
      />
      <div
        onClick={() => inputRef.current?.click()}
        style={{
          border: '1.5px dashed #D1D5DB', borderRadius: 10, padding: 28, textAlign: 'center',
          cursor: 'pointer', marginBottom: 16, background: '#FAFAFA',
        }}
      >
        {loading ? (
          <span style={{ fontSize: 13, color: '#6B7280' }}>Processando arquivo...</span>
        ) : arquivo ? (
          <span style={{ fontSize: 13, color: '#374151' }}>📄 {arquivo.name} &nbsp;·&nbsp; <span style={{ color: '#2563EB' }}>trocar arquivo</span></span>
        ) : (
          <span style={{ fontSize: 13, color: '#6B7280' }}>Clique para selecionar o arquivo .txt da ECD</span>
        )}
      </div>

      {resultado && (
        <div style={{ padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13, background: resultado.ok ? '#ECFDF5' : '#FEF2F2', color: resultado.ok ? '#059669' : '#B91C1C' }}>
          {resultado.mensagem}
        </div>
      )}

      {preview && (
        <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 10, padding: 18 }}>
          <div style={{ display: 'flex', gap: 20, marginBottom: preview.contasNaoMapeadas.length > 0 ? 18 : 0 }}>
            <div>
              <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>Ano identificado</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{preview.ano}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>Lancamentos</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{preview.totalLancamentos}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>Itens</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{preview.totalItens}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>Periodo</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{preview.dataInicial ?? '—'} a {preview.dataFinal ?? '—'}</div>
            </div>
          </div>

          {preview.contasNaoMapeadas.length > 0 && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#B91C1C', marginBottom: 6 }}>
                {preview.contasNaoMapeadas.length} conta(s) sem de/para confirmado — resolva na tela Sugestao De/Para antes de registrar
              </div>
              {preview.contasNaoMapeadas.map(c => (
                <div key={c.code} style={{ fontSize: 12, color: '#7F1D1D' }}>
                  <span style={{ fontFamily: 'monospace' }}>{c.code}</span> — {c.ocorrencias} ocorrencia(s)
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleRegistrar}
            disabled={!preview.podeRegistrar || registrando}
            style={{
              padding: '10px 22px', background: preview.podeRegistrar ? '#2563EB' : '#D1D5DB', color: '#fff',
              border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
              cursor: preview.podeRegistrar ? 'pointer' : 'not-allowed',
            }}
          >
            {registrando ? 'Registrando...' : 'Registrar Lancamentos'}
          </button>
        </div>
      )}
    </div>
  );
};

export default EcdLancamentosImportPage;
