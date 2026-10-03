// frontend/src/pages/projects/workspace/ParticipantesProjeto.tsx
// D8 (03/10/2026): quem faz o que na operacao - empresas do grupo e contrapartes, com o papel de cada uma.
import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../services/api';
import { Operacao, cardSt, thSt, tdSt, erroSt, tituloSt, subtituloSt } from './projetoTema';

interface Participacao {
  id: string; companyId: string | null; empresaNome?: string | null; observacao: string | null;
  papel: { codigo: string; nome: string }; contraparte: { id: string; nome: string; tipoPessoa: string | null } | null;
}

export default function ParticipantesProjeto({ operacao }: { operacao: Operacao | null }) {
  const [lista, setLista] = useState<Participacao[]>([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!operacao) return;
    setErro('');
    api.get(`/projects/operacoes/${operacao.id}/participacoes`)
      .then((r) => setLista(r.data || []))
      .catch((e) => setErro(e?.response?.data?.message || 'Falha ao carregar os participantes.'));
  }, [operacao]);

  const ordenada = useMemo(() => [...lista].sort((a, b) => {
    const ta = a.companyId ? 0 : 1; const tb = b.companyId ? 0 : 1;
    if (ta !== tb) return ta - tb;
    const p = a.papel.nome.localeCompare(b.papel.nome);
    if (p !== 0) return p;
    return (a.empresaNome || a.contraparte?.nome || '').localeCompare(b.empresaNome || b.contraparte?.nome || '');
  }), [lista]);

  if (!operacao) return <div style={{ color: '#6B7280' }}>Nenhuma operação disponível para o seu acesso.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={tituloSt}>Participantes</div>
        <div style={subtituloSt}>{operacao.nome} · papéis por operação (controle societário não se confunde com titularidade econômica)</div>
      </div>
      {erro && <div style={erroSt}>⚠ {erro}</div>}
      <div style={{ ...cardSt, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thSt}>Papel</th><th style={thSt}>Participante</th><th style={thSt}>Tipo</th><th style={thSt}>Observação</th></tr></thead>
          <tbody>
            {ordenada.map((p) => (
              <tr key={p.id}>
                <td style={{ ...tdSt, fontWeight: 600 }}>{p.papel.nome}</td>
                <td style={tdSt}>{p.empresaNome || p.contraparte?.nome || '-'}</td>
                <td style={tdSt}>{p.companyId ? 'Empresa do grupo' : p.contraparte?.tipoPessoa === 'PF' ? 'Contraparte (pessoa física)' : 'Contraparte (pessoa jurídica)'}</td>
                <td style={{ ...tdSt, fontSize: 12, color: '#374151' }}>{p.observacao || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
