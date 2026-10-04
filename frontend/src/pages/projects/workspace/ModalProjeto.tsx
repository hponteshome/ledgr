// frontend/src/pages/projects/workspace/ModalProjeto.tsx
// Fase 1.4-1.5 (04/10/2026): componentes de modal do espaco do projeto, no padrao APPayModal (cores FIN, cabecalho
// escuro, secoes com borda, erro #FCEBEB, rodape #FAFAFA, Esc e clique fora fecham).
import React, { useEffect } from 'react';

export const FIN = '#1A4A3A';
export const FIN_ACCENT = '#3DAA7A';
export const FIN_LIGHT = '#E8F5EE';
export const inputModal: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '0.5px solid #E5E7EB', borderRadius: 7, fontSize: 13, boxSizing: 'border-box', background: '#fff' };

export function ModalProjeto({ titulo, subtitulo, largura = 560, onClose, rodape, children }: {
  titulo: string; subtitulo?: string; largura?: number; onClose: () => void; rodape: React.ReactNode; children: React.ReactNode;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: largura, maxWidth: '94vw', maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ background: FIN, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{titulo}</div>
            {subtitulo && <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 1 }}>{subtitulo}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 15 }}>×</button>
        </div>
        <div style={{ padding: 18, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
        <div style={{ background: '#FAFAFA', borderTop: '0.5px solid #E5E7EB', padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>{rodape}</div>
      </div>
    </div>
  );
}

export function Secao({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: FIN_LIGHT, borderRadius: 8, padding: '12px 14px', borderLeft: `3px solid ${FIN_ACCENT}` }}>
      {titulo && <div style={{ fontSize: 11, fontWeight: 700, color: FIN, marginBottom: 10 }}>{titulo}</div>}
      {children}
    </div>
  );
}

export function ErroModal({ msg }: { msg: string }) {
  if (!msg) return null;
  return <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>⚠ {msg}</div>;
}

export function Campo({ rotulo, largo, children }: { rotulo: string; largo?: boolean; children: React.ReactNode }) {
  return (
    <div style={largo ? { gridColumn: '1 / -1' } : undefined}>
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, fontWeight: 600 }}>{rotulo}</div>
      {children}
    </div>
  );
}

export function BotaoSec({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ padding: '8px 14px', background: '#fff', color: '#374151', border: '0.5px solid #E5E7EB', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>{children}</button>;
}

export function BotaoPri({ onClick, ativo, perigo, children }: { onClick: () => void; ativo: boolean; perigo?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={!ativo}
      style={{ padding: '8px 16px', background: perigo ? '#A32D2D' : FIN, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: ativo ? 'pointer' : 'default', opacity: ativo ? 1 : 0.6 }}>
      {children}
    </button>
  );
}

export function erroApi(e: any, padrao: string): string {
  return e?.response?.data?.message || e?.message || padrao;
}
