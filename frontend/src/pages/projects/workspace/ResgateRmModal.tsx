// frontend/src/pages/projects/workspace/ResgateRmModal.tsx
// Resgate da divida da RM na F5 - E1 (08/10/2026): previa mensal, sem gravar nada na contabilidade. Base: 10% da parte
// de cada pagamento feita com dinheiro do Cliente Ancora (PEPS). A gravacao e o estorno entram na E2.
import React, { useEffect, useState } from 'react';
import api from '../../../services/api';
import { thSt, tdSt, erroSt, fmtBRL, fmtData } from './projetoTema';
import { ModalProjeto, BotaoSec, erroApi } from './ModalProjeto';

const num: React.CSSProperties = { ...tdSt, textAlign: 'right', whiteSpace: 'nowrap' };
const dir: React.CSSProperties = { ...thSt, textAlign: 'right' };

export default function ResgateRmModal({ projetoId, onClose }: { projetoId: string; onClose: () => void }) {
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState('');
  useEffect(() => {
    api.get(`/projects-relatorios/projetos/${projetoId}/resgate-rm/previa`).then((r) => setD(r.data)).catch((e) => setErro(erroApi(e, 'Falha ao calcular a prévia.')));
  }, [projetoId]);
  const card = (rot: string, val: string, sub?: string, cor?: string) => (
    <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 10, padding: '8px 12px' }}><div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{rot}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: cor || '#0F2747' }}>{val}</div>{sub && <div style={{ fontSize: 11, color: '#6B7280' }}>{sub}</div>}</div>);
  return (
    <ModalProjeto titulo="Resgate da dívida da RM na F5 - prévia" subtitulo="10% da parte de cada pagamento feita com dinheiro do Cliente Âncora (PEPS) · um lançamento por mês" largura={1000} onClose={onClose}
      rodape={<><span style={{ flex: 1, fontSize: 12, color: '#6B7280' }}>Prévia: nada é gravado na contabilidade nesta etapa.</span><BotaoSec onClick={onClose}>Fechar</BotaoSec></>}>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      {!d && !erro && <div style={{ color: '#6B7280' }}>Calculando...</div>}
      {d && (<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {card('Aportes do Âncora', fmtBRL(d.aportes), `limite do resgate (10%): ${fmtBRL(d.limite)}`)}
          {card('Resgate calculado', fmtBRL(d.totalResgate), d.totalResgate <= d.limite + 0.01 ? 'dentro do limite' : 'ACIMA do limite', d.totalResgate <= d.limite + 0.01 ? '#166534' : '#A32D2D')}
          {card('Dívida confessada', fmtBRL(d.divida), `em ${fmtData(d.dataConfissao)}`)}
          {card('Dívida após os resgates', fmtBRL(d.divida - d.totalResgate))}
        </div>
        <div style={{ fontSize: 12, background: '#F0FDF4', border: '0.5px solid #BBF7D0', borderRadius: 8, padding: '8px 12px' }}>
          <b>Lançamento proposto em cada competência ({d.empresa}):</b> D <b>{d.contas.debito.codigo}</b> {d.contas.debito.nome} · C <b>{d.contas.credito.codigo}</b> {d.contas.credito.nome}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thSt}>Competência</th><th style={thSt}>Data do lançamento</th><th style={dir}>Pagamentos</th><th style={dir}>Base (dinheiro do Âncora)</th><th style={dir}>Resgate (10%)</th><th style={dir}>Acumulado</th><th style={dir}>Saldo da dívida</th></tr></thead>
          <tbody>{(d.meses as any[]).map((m) => (
            <React.Fragment key={m.competencia}>
              <tr onClick={() => setAberto(aberto === m.competencia ? '' : m.competencia)} style={{ cursor: 'pointer', background: aberto === m.competencia ? '#E6F4F1' : undefined }} title="Clique para ver por natureza">
                <td style={{ ...tdSt, fontWeight: 600 }}>{aberto === m.competencia ? '▼ ' : '▶ '}{m.rotulo}{m.emCurso ? ' (em curso)' : ''}</td><td style={tdSt}>{fmtData(m.data)}</td>
                <td style={num}>{m.qtd}</td><td style={num}>{fmtBRL(m.base)}</td><td style={{ ...num, fontWeight: 700 }}>{fmtBRL(m.resgate)}</td><td style={num}>{fmtBRL(m.acumulado)}</td><td style={num}>{fmtBRL(m.saldoDivida)}</td>
              </tr>
              {aberto === m.competencia && m.porNatureza.map((n: any) => (
                <tr key={m.competencia + n.natureza} style={{ background: '#F9FAFB' }}><td style={{ ...tdSt, paddingLeft: 28, fontSize: 12 }} colSpan={3}>{n.natureza}</td>
                  <td style={{ ...num, fontSize: 12 }}>{fmtBRL(n.base)}</td><td style={{ ...num, fontSize: 12 }}>{fmtBRL(n.resgate)}</td><td style={tdSt} colSpan={2}></td></tr>))}
            </React.Fragment>))}</tbody>
          <tfoot><tr style={{ borderTop: '1.5px solid #134E4A' }}><td style={{ ...tdSt, fontWeight: 700 }} colSpan={3}>Total ({(d.meses as any[]).length} competência(s))</td>
            <td style={{ ...num, fontWeight: 700 }}>{fmtBRL((d.meses as any[]).reduce((s, m) => s + m.base, 0))}</td><td style={{ ...num, fontWeight: 700 }}>{fmtBRL(d.totalResgate)}</td><td style={tdSt} colSpan={2}></td></tr></tfoot>
        </table>
      </div>)}
    </ModalProjeto>
  );
}
