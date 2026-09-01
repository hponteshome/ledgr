// frontend/src/pages/sped/EcdMovimentacaoPage.tsx
// CRIADO 01/09/2026: tela SOMENTE LEITURA - mostra movimentacao declarada
// (I155/account_balances) das contas ECD nativas ano a ano apos 2017, sem
// nenhuma acao de escrita. Motivacao: usuario quer visibilidade do que
// aconteceu na ECD historica sem lancar na contabilidade real.
import React, { useState, useEffect, useCallback } from 'react';
import api from '@/services/api';

interface ContaMovimentacao {
  accountId: string; code: string; name: string; type: string;
  saldosPorAno: Record<string, number | null>;
  movimentoPorAno: Record<string, number | null>;
  temMovimentoPosAbertura: boolean;
}

const fmt = (v: number | null) => v === null ? '—' : Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (v < 0 ? ' C' : v > 0 ? ' D' : '');

export const EcdMovimentacaoPage: React.FC = () => {
  const [anos, setAnos] = useState<number[]>([]);
  const [contas, setContas] = useState<ContaMovimentacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [soMovimentadas, setSoMovimentadas] = useState(true);
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/sped/ecd-movimentacao');
      setAnos(r.data?.anos || []);
      setContas(r.data?.contas || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const termoBusca = busca.toLowerCase();
  const listaExibida = contas.filter(c => {
    if (soMovimentadas && !c.temMovimentoPosAbertura) return false;
    if (termoBusca && !c.code.toLowerCase().includes(termoBusca) && !c.name.toLowerCase().includes(termoBusca)) return false;
    return true;
  });

  const thSt: React.CSSProperties = { padding: '8px 10px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#6B7280', background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB', textAlign: 'right', whiteSpace: 'nowrap' };
  const tdSt: React.CSSProperties = { padding: '6px 10px', fontSize: 11, borderBottom: '0.5px solid #F5F5F5', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

  return (
    <div style={{ padding: 24 }}>
      <header style={{ marginBottom: 20 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#F0FDF4', color: '#15803D', marginBottom: 6 }}>
          ◉ Somente leitura
        </span>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111111', margin: 0 }}>ECD — Movimentação</h1>
        <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>
          Saldo declarado (I155) ano a ano das contas nativas da ECD. Consulta pura de conferencia — nenhum lançamento e criado, alterado ou apagado nesta tela.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <input
          type="text"
          placeholder="Buscar código ou nome…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12, width: 260 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
          <input type="checkbox" checked={soMovimentadas} onChange={e => setSoMovimentadas(e.target.checked)} />
          Só contas com movimento pós-2017
        </label>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>{listaExibida.length} conta(s)</span>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Carregando…</div>
      ) : listaExibida.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
          Nenhuma conta encontrada com os filtros atuais.
        </div>
      ) : (
        <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'auto', maxHeight: 650 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ ...thSt, textAlign: 'left', position: 'sticky', left: 0, background: '#F9FAFB', zIndex: 1 }}>Conta</th>
                {anos.map((ano, i) => (
                  <React.Fragment key={ano}>
                    {i > 0 && <th style={{ ...thSt, color: '#B45309' }}>Mov. {ano}</th>}
                    <th style={thSt}>Saldo {ano}</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {listaExibida.map((c, idx) => (
                <tr key={c.accountId} style={{ background: idx % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  <td style={{ padding: '6px 10px', borderBottom: '0.5px solid #F5F5F5', fontSize: 12, position: 'sticky', left: 0, background: idx % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                    <span style={{ fontFamily: 'monospace', color: '#2563EB', marginRight: 6 }}>{c.code}</span>
                    {c.name}
                  </td>
                  {anos.map((ano, i) => (
                    <React.Fragment key={ano}>
                      {i > 0 && (
                        <td style={{ ...tdSt, color: (c.movimentoPorAno[ano] ?? 0) !== 0 ? '#B45309' : '#9CA3AF', fontWeight: (c.movimentoPorAno[ano] ?? 0) !== 0 ? 600 : 400 }}>
                          {fmt(c.movimentoPorAno[ano] ?? null)}
                        </td>
                      )}
                      <td style={tdSt}>{fmt(c.saldosPorAno[ano] ?? null)}</td>
                    </React.Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EcdMovimentacaoPage;
