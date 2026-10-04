// frontend/src/pages/projects/workspace/DemonstrativoProjeto.tsx
// Pacote de auditoria (04/10/2026): Demonstrativo da Conta Individual - posicao em uma data, PDF (servidor) e Excel.
// Cada emissao tem codigo de conferencia (SHA-256 do conteudo) e fica no AuditLog.
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { SmartDateInput } from '../../../components/SmartDateInput';
import { Operacao, fmtBRL, fmtData, cardSt, thSt, tdSt, erroSt, secTitle, tituloSt, subtituloSt } from './projetoTema';

interface Linha { data: string; tipo: string; numero: number | null; contraparte: string; documento: string | null; creditoRef: number | null; prova: string | null; provaData: string | null; valor: string; saldo: string; }
interface Dem {
  projeto: string; operacao: { codigo: string; nome: string; dataBase: string | null }; posicaoEm: string; adquirentes: string[]; linhas: Linha[];
  totais: { qtdCreditos: number; creditos: string; qtdDevolucoes: number; devolucoes: string; saldo: string };
  saldoInformado: { data: string; valor: string; fonte: string } | null; diferenca: string | null;
  desvinculados: { numero: number | null; data: string; valor: string }[]; pendentes: { quantidade: number; total: string }; hash: string; emitidoEm: string;
}
const hojeIso = () => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`; };
const movimento = (l: Linha) => (l.tipo === 'CREDITO' ? `Crédito nº ${l.numero ?? '-'}` : `Devolução${l.creditoRef ? ` (crédito nº ${l.creditoRef})` : ''}`);
const baixar = (blob: Blob, nome: string) => { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u); };

export default function DemonstrativoProjeto({ operacao }: { operacao: Operacao | null }) {
  const [ate, setAte] = useState(hojeIso());
  const [d, setD] = useState<Dem | null>(null);
  const [erro, setErro] = useState('');
  const [baixando, setBaixando] = useState('');
  const carregar = useCallback(() => {
    if (!operacao || !ate) return;
    setErro('');
    api.get(`/projects-relatorios/operacoes/${operacao.id}/demonstrativo`, { params: { ate } }).then((r) => setD(r.data)).catch((e) => setErro(e?.response?.data?.message || 'Falha ao montar o demonstrativo.'));
  }, [operacao, ate]);
  useEffect(() => { carregar(); }, [carregar]);

  const pdf = async () => {
    if (!operacao) return;
    setBaixando('pdf');
    try {
      const r = await api.get(`/projects-relatorios/operacoes/${operacao.id}/demonstrativo/pdf`, { params: { ate }, responseType: 'blob' });
      baixar(r.data, `demonstrativo-conta-individual-${ate}.pdf`);
      toast.success('PDF emitido e registrado na trilha.');
    } catch { toast.error('Falha ao gerar o PDF.'); } finally { setBaixando(''); }
  };

  const excel = async () => {
    if (!operacao) return;
    setBaixando('xlsx');
    try {
      const r = await api.get(`/projects-relatorios/operacoes/${operacao.id}/demonstrativo`, { params: { ate, registrar: 'XLSX' } });
      const x: Dem = r.data;
      const ExcelJS = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Demonstrativo');
      ws.addRow(['Demonstrativo da Conta Individual']);
      ws.addRow([`${x.projeto} · ${x.operacao.nome} (${x.operacao.codigo})`]);
      ws.addRow([`Adquirente: ${x.adquirentes.join(', ')} · Posição em ${fmtData(x.posicaoEm)}`]);
      ws.addRow([]);
      ws.addRow(['Data', 'Movimento', 'Remetente / devolvido a', 'Documento', 'Prova bancária (data)', 'Prova bancária (lançamento)', 'Valor', 'Saldo']);
      x.linhas.forEach((l) => ws.addRow([fmtData(l.data), movimento(l), l.contraparte, l.documento || '', l.provaData ? fmtData(l.provaData) : '', l.prova || 'sem prova bancária', Number(l.valor), Number(l.saldo)]));
      ws.addRow([]);
      ws.addRow(['', '', '', '', '', `Créditos vinculados (${x.totais.qtdCreditos})`, Number(x.totais.creditos)]);
      ws.addRow(['', '', '', '', '', `(−) Devoluções ao Adquirente (${x.totais.qtdDevolucoes})`, -Number(x.totais.devolucoes)]);
      ws.addRow(['', '', '', '', '', '(=) Saldo contratual', Number(x.totais.saldo)]);
      [7, 8].forEach((c) => { ws.getColumn(c).numFmt = '#,##0.00;[Red]-#,##0.00'; });
      [12, 14, 34, 14, 14, 50, 16, 16].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
      ws.getRow(1).font = { bold: true, size: 13 };
      ws.getRow(5).font = { bold: true };
      const cf = wb.addWorksheet('Conferência');
      cf.addRow(['Código de conferência (SHA-256)', x.hash]);
      cf.addRow(['Posição em', fmtData(x.posicaoEm)]);
      cf.addRow(['Emitido em', new Date(x.emitidoEm).toLocaleString('pt-BR')]);
      cf.addRow(['Saldo contratual', Number(x.totais.saldo)]);
      if (x.saldoInformado) {
        cf.addRow([`Saldo informado em ${fmtData(x.saldoInformado.data)}`, Number(x.saldoInformado.valor)]);
        cf.addRow(['Fonte do saldo informado', x.saldoInformado.fonte]);
        cf.addRow(['Diferença (calculado − informado)', Number(x.diferenca)]);
      }
      cf.addRow(['Créditos aguardando decisão (fora do demonstrativo)', `${x.pendentes.quantidade} · ${fmtBRL(x.pendentes.total)}`]);
      x.desvinculados.forEach((v) => cf.addRow(['Crédito fora da Conta Individual', `nº ${v.numero ?? '-'} · ${fmtData(v.data)} · ${fmtBRL(v.valor)}`]));
      cf.getColumn(1).width = 52; cf.getColumn(2).width = 70;
      const buf = await wb.xlsx.writeBuffer();
      baixar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `demonstrativo-conta-individual-${ate}.xlsx`);
      toast.success('Excel emitido e registrado na trilha.');
    } catch { toast.error('Falha ao gerar o Excel.'); } finally { setBaixando(''); }
  };

  if (!operacao) return <div style={{ color: '#6B7280' }}>Nenhuma operação disponível para o seu acesso.</div>;
  const btn = (ativo: boolean): React.CSSProperties => ({ padding: '8px 14px', background: '#134E4A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: ativo ? 'pointer' : 'default', opacity: ativo ? 1 : 0.6 });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={tituloSt}>Demonstrativo da Conta Individual</div>
          <div style={subtituloSt}>{operacao.nome} · créditos vinculados e devoluções, com prova bancária e saldo corrente</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 3, fontWeight: 600 }}>Posição em</div>
          <SmartDateInput value={ate} onChange={(v) => setAte(v)} style={{ padding: '7px 10px', border: '0.5px solid #E5E7EB', borderRadius: 7, fontSize: 13, width: 130 }} />
        </div>
        <button style={btn(!!d && !baixando)} disabled={!d || !!baixando} onClick={pdf}>{baixando === 'pdf' ? 'Gerando...' : 'Baixar PDF'}</button>
        <button style={btn(!!d && !baixando)} disabled={!d || !!baixando} onClick={excel}>{baixando === 'xlsx' ? 'Gerando...' : 'Baixar Excel'}</button>
      </div>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      {d && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {[['Créditos vinculados', d.totais.creditos, `${d.totais.qtdCreditos} créditos`], ['Devoluções ao Adquirente', d.totais.devolucoes, `${d.totais.qtdDevolucoes} devoluções`], ['Saldo contratual', d.totais.saldo, d.adquirentes.join(', ')]].map(([t, v, s]) => (
              <div key={t} style={{ ...cardSt, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{t}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginTop: 4 }}>{fmtBRL(v)}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{s}</div>
              </div>
            ))}
            <div style={{ ...cardSt, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>Conferência</div>
              {d.saldoInformado ? (
                <>
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: Math.abs(Number(d.diferenca)) < 0.005 ? '#166534' : '#A32D2D' }}>{fmtBRL(d.diferenca)}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>vs. informado em {fmtData(d.saldoInformado.data)} ({fmtBRL(d.saldoInformado.valor)})</div>
                </>
              ) : <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 8 }}>sem saldo informado até a data</div>}
            </div>
          </div>
          {d.pendentes.quantidade > 0 && <div style={{ background: '#FEF3C7', color: '#78350F', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{d.pendentes.quantidade} crédito(s), somando {fmtBRL(d.pendentes.total)}, aguardam decisão de vínculo e não entram no demonstrativo.</div>}
          <div style={{ ...cardSt, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={thSt}>Data</th><th style={thSt}>Movimento</th><th style={thSt}>Remetente / devolvido a</th><th style={thSt}>Prova bancária</th><th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={{ ...thSt, textAlign: 'right' }}>Saldo</th></tr></thead>
              <tbody>
                {d.linhas.length === 0 && <tr><td colSpan={6} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Sem movimentos até a data.</td></tr>}
                {d.linhas.map((l, i) => (
                  <tr key={i}>
                    <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>{fmtData(l.data)}</td>
                    <td style={tdSt}>{movimento(l)}</td>
                    <td style={tdSt}>{l.contraparte}{l.documento && <div style={{ fontSize: 11, color: '#6B7280', fontFamily: 'monospace' }}>{l.documento}</div>}</td>
                    <td style={{ ...tdSt, fontSize: 12 }}>{l.prova ? `${fmtData(l.provaData)} · ${l.prova}` : <span style={{ color: '#B45309' }}>sem prova bancária</span>}</td>
                    <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', color: Number(l.valor) < 0 ? '#A32D2D' : undefined }}>{fmtBRL(l.valor)}</td>
                    <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtBRL(l.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {d.desvinculados.length > 0 && (
            <div style={{ ...cardSt, padding: 14 }}>
              <div style={secTitle}>Fora da Conta Individual</div>
              <div style={{ fontSize: 12, color: '#374151' }}>{d.desvinculados.map((v) => `nº ${v.numero ?? '-'} de ${fmtData(v.data)}, ${fmtBRL(v.valor)}`).join('; ')} (permanecem registrados como fato bancário).</div>
            </div>
          )}
          <div style={{ fontSize: 11, color: '#6B7280' }}>Código de conferência desta posição (SHA-256): <span style={{ fontFamily: 'monospace' }}>{d.hash}</span></div>
        </>
      )}
    </div>
  );
}
