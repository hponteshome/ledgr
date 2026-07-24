// frontend/src/pages/documentos/DocumentEditModal.tsx
import React, { useState, useEffect } from 'react';
import { FiX, FiSave } from 'react-icons/fi';

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

interface Props {
  documentId: string;
  documentTitle: string;
  onClose: () => void;
  onSaved: () => void;
}

export const DocumentEditModal: React.FC<Props> = ({ documentId, documentTitle, onClose, onSaved }) => {
  const [content, setContent] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('@ledgr:token');
  const company = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
  const headers = { Authorization: 'Bearer ' + token, 'x-company-id': company.id ?? '' };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(API + '/documents/' + documentId, { headers });
        if (!res.ok) throw new Error();
        const d = await res.json();
        setContent(d.content ?? '');
      } catch {
        setError('Nao foi possivel carregar o conteudo do documento.');
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(API + '/documents/' + documentId, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, changeNote: changeNote || undefined }),
      });
      if (!res.ok) throw new Error();
      onSaved();
      onClose();
    } catch {
      setError('Nao foi possivel salvar as alteracoes. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 900, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

        <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #E5E7EB', background: '#ECFEFF', borderRadius: '14px 14px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#0891B2' }}>Editando (Rascunho)</span>
            <h2 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 500, color: '#111' }}>{documentTitle}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 }}><FiX size={18} /></button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', background: '#F9FAFB', padding: 16 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
              <div style={{ width: 36, height: 36, border: '3px solid #E5E7EB', borderTopColor: '#0891B2', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                style={{ width: '100%', minHeight: '55vh', fontFamily: 'monospace', fontSize: 12, border: '0.5px solid #D1D5DB', borderRadius: 8, padding: 12, background: '#fff', resize: 'vertical' }}
              />
              <div style={{ marginTop: 10 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#6B7280', marginBottom: 4 }}>Nota da edicao (opcional)</label>
                <input
                  type='text'
                  value={changeNote}
                  onChange={e => setChangeNote(e.target.value)}
                  placeholder='Ex: ajuste na clausula de reajuste'
                  style={{ width: '100%', fontSize: 12, border: '0.5px solid #D1D5DB', borderRadius: 8, padding: '8px 10px' }}
                />
              </div>
              {error && <p style={{ color: '#EF4444', fontSize: 12, marginTop: 8 }}>{error}</p>}
            </>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '0.5px solid #E5E7EB', background: '#fff', borderRadius: '0 0 14px 14px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={saving}
            style={{ padding: '8px 16px', fontSize: 13, border: '0.5px solid #D1D5DB', color: '#374151', background: '#fff', borderRadius: 8, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, border: 'none', color: '#fff', background: '#111', borderRadius: 8, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            <FiSave size={13} /> {saving ? 'Salvando...' : 'Salvar Alteracoes'}
          </button>
        </div>
      </div>
    </div>
  );
};
