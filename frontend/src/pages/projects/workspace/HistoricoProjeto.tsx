// frontend/src/pages/projects/workspace/HistoricoProjeto.tsx
// Pacote de auditoria (04/10/2026): trilha da operacao (AuditLog so de entidades do projeto), com filtros e Excel.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import { SmartDateInput } from '../../../components/SmartDateInput';
import { Operacao, cardSt, thSt, tdSt, erroSt, tituloSt, subtituloSt } from './projetoTema';

interface Evento { id: string; quando: string; acao: string; rotulo: string; usuario: string; motivo: string | null; detalhes: Record<string, any>; }
const quandoBR = (s: string) => new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const filtroSt: React.CSSProperties = { padding: '7px 10px', border: '0.5px solid #E5E7EB', borderRadius: 7, fontSize: 13 };

export default function HistoricoProjeto({ operacao }: { operacao: Operacao | null }) {
  const [lista, setLista] = useState<Evento[]>([]);
  const [erro, setErro] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [tipo, setTipo] = useState('');
  const [usuario, setUsuario] = useState('');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const carregar = useCallback(() => {
    if (!operacao) return;
    setErro('');
    api.get(`/projects-relatorios/operacoes/${operacao.id}/historico`, { params: { de: de || undefined, ate: ate || undefined } })
      .then((r) => setLista(r.data || [])).catch((e) => setErro(e?.response?.status === 403 ? 'A trilha de auditoria é restrita aos perfis Administrador do projeto, Contabilidade, Financeiro e Auditoria.' : e?.response?.data?.message || 'Falha ao carregar o histórico.'));
  }, [operacao, de, ate]);
  useEffect(() => { carregar(); }, [carregar]);
  const tipos = useMemo(() => [...new Set(lista.map((e) => e.rotulo))].sort(), [lista]);
  const usuarios = useMemo(() => [...new Set(lista.map((e) => e.usuario))].sort(), [lista]);
  const filtrada = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return lista.filter((e) => (!tipo || e.rotulo === tipo) && (!usuario || e.usuario === usuario) &&
      (!t || [e.rotulo, e.usuario, e.motivo, JSON.stringify(e.detalhes)].some((x) => (x || '').toLowerCase().includes(t))));
  }, [lista, tipo, usuario, busca]);

  const excel = async () => {
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Histórico');
    ws.addRow(['Quando', 'Usuário', 'Ação', 'Motivo / fonte', 'Detalhes']);
    filtrada.forEach((e) => ws.addRow([quandoBR(e.quando), e.usuario, e.rotulo, e.motivo || '', JSON.stringify(e.detalhes)]));
    [18, 28, 30, 60, 80].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    ws.getRow(1).font = { bold: true };
    const buf = await wb.xlsx.writeBuffer();
    const u = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a'); a.href = u; a.download = `historico-${operacao?.codigo || 'operacao'}.xlsx`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
  };

  if (!operacao) return <div style={{ color: '#6B7280' }}>Nenhuma operação disponível para o seu acesso.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={tituloSt}>Histórico</div>
          <div style={subtituloSt}>{operacao.nome} · trilha de auditoria: quem fez o quê, quando e por quê</div>
        </div>
        <button onClick={excel} disabled={!filtrada.length} style={{ padding: '8px 14px', background: '#134E4A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: filtrada.length ? 'pointer' : 'default', opacity: filtrada.length ? 1 : 0.6 }}>Baixar Excel</button>
      </div>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#6B7280' }}>De</span><SmartDateInput value={de} onChange={(v) => setDe(v)} style={{ ...filtroSt, width: 120 }} />
        <span style={{ fontSize: 12, color: '#6B7280' }}>até</span><SmartDateInput value={ate} onChange={(v) => setAte(v)} style={{ ...filtroSt, width: 120 }} />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={filtroSt}><option value="">Todas as ações</option>{tipos.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <select value={usuario} onChange={(e) => setUsuario(e.target.value)} style={filtroSt}><option value="">Todos os usuários</option>{usuarios.map((u) => <option key={u} value={u}>{u}</option>)}</select>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar no motivo ou nos detalhes" style={{ ...filtroSt, width: 240 }} />
        <div style={{ flex: 1 }} /><div style={{ fontSize: 13, color: '#374151' }}>{filtrada.length} evento(s)</div>
      </div>
      <div style={{ ...cardSt, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thSt}>Quando</th><th style={thSt}>Usuário</th><th style={thSt}>Ação</th><th style={thSt}>Motivo / fonte</th><th style={thSt}></th></tr></thead>
          <tbody>
            {filtrada.length === 0 && <tr><td colSpan={5} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Nenhum evento no filtro.</td></tr>}
            {filtrada.map((e) => (
              <React.Fragment key={e.id}>
                <tr>
                  <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>{quandoBR(e.quando)}</td>
                  <td style={tdSt}>{e.usuario}</td>
                  <td style={{ ...tdSt, fontWeight: 600 }}>{e.rotulo}</td>
                  <td style={{ ...tdSt, fontSize: 12, color: '#374151' }}>{e.motivo || '-'}</td>
                  <td style={{ ...tdSt, textAlign: 'right' }}><button onClick={() => setAberto(aberto === e.id ? null : e.id)} style={{ padding: '3px 9px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#134E4A', cursor: 'pointer' }}>{aberto === e.id ? 'ocultar' : 'detalhes'}</button></td>
                </tr>
                {aberto === e.id && <tr><td colSpan={5} style={{ ...tdSt, background: '#F9FAFB' }}><pre style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(e.detalhes, null, 2)}</pre></td></tr>}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
