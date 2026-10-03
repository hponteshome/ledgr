// frontend/src/pages/projects/ProjetosHomePage.tsx
// D8 (03/10/2026): entrada do LEDGR para os projetos - cada projeto abre no seu espaco segregado, em nova aba.
import React, { useEffect, useState } from 'react';
import { FiExternalLink, FiFolder } from 'react-icons/fi';
import api from '../../services/api';

interface ProjetoItem { id: string; codigo: string; nome: string; status: string; }

export default function ProjetosHomePage() {
  const [lista, setLista] = useState<ProjetoItem[]>([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get('/projects')
      .then((r) => setLista(r.data || []))
      .catch((e) => setErro(e?.response?.data?.message || 'Falha ao carregar os projetos.'));
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Meus projetos</div>
      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2, marginBottom: 18 }}>Cada projeto abre em um espaço próprio, em nova aba</div>
      {erro && <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>⚠ {erro}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {lista.map((p) => (
          <div key={p.id} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: 16, borderTop: '3px solid #134E4A' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#134E4A' }}><FiFolder size={16} /><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>{p.codigo}</span></div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginTop: 6 }}>{p.nome}</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Situação: {p.status}</div>
            <button
              onClick={() => window.open(`/projetos/${p.id}`, '_blank', 'noopener')}
              style={{ marginTop: 14, padding: '8px 14px', background: '#134E4A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <FiExternalLink size={13} /> Abrir espaço do projeto
            </button>
          </div>
        ))}
        {!erro && lista.length === 0 && <div style={{ color: '#9CA3AF', fontSize: 13 }}>Nenhum projeto disponível para o seu acesso.</div>}
      </div>
    </div>
  );
}
