// frontend/src/components/finance/AccountPicker.tsx
// EXTBB-05 (23/11/2026) - Seletor de conta contabil com busca por codigo, reduzido ou nome.
// EXTBB-05B: Enter/setas escolhem; ao sair do campo, correspondencia exata (codigo/reduzido) ou unica e escolhida;
// aviso quando nada combina. Componente compartilhado (origem: BankImportPage).
import React, { useRef, useState } from 'react';

export interface PickerAccount { id: string; code: string; name: string; reducedCode?: string | null; isAnalytic?: boolean; }

export function AccountPicker({ value, onChange, accounts, placeholder, disabled }: {
  value: string; onChange: (id: string) => void; accounts: PickerAccount[]; placeholder?: string; disabled?: boolean;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const picked = useRef(false);
  const safe = Array.isArray(accounts) ? accounts : [];
  const selected = safe.find(a => a.id === value);
  const display = selected ? `${selected.reducedCode || selected.code} - ${selected.name}` : '';
  const qt = q.trim();
  const qNorm = qt.replace(/\./g, '');
  const filtered = qt.length >= 1
    ? safe.filter(a => a.code.replace(/\./g, '').includes(qNorm) || (a.reducedCode ?? '').includes(qNorm) || a.name.toLowerCase().includes(qt.toLowerCase())).slice(0, 15)
    : [];
  const exact = () => safe.find(a => (a.reducedCode ?? '') === qt || a.code === qt || a.code.replace(/\./g, '') === qNorm);

  const choose = (a?: PickerAccount) => {
    if (!a) return;
    picked.current = true;
    onChange(a.id);
    setOpen(false);
    setQ('');
  };
  // Ao sair do campo: correspondencia exata ou unica (o clique numa sugestao tem prioridade)
  const commitOnBlur = () => {
    if (picked.current) { picked.current = false; return; }
    if (!qt) return;
    const hit = exact() ?? (filtered.length === 1 ? filtered[0] : undefined);
    if (hit) onChange(hit.id);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        disabled={disabled}
        style={{ width: '100%', boxSizing: 'border-box', border: `0.5px solid ${value ? '#86EFAC' : '#D1D5DB'}`, borderRadius: 6, padding: '7px 28px 7px 10px', fontSize: 13, outline: 'none', background: disabled ? '#F9FAFB' : '#fff' }}
        value={open ? q : display}
        placeholder={placeholder ?? 'Código, reduzido ou nome...'}
        onFocus={() => { setOpen(true); setQ(''); setHi(0); picked.current = false; }}
        onBlur={() => { commitOnBlur(); setTimeout(() => setOpen(false), 200); }}
        onChange={e => { setQ(e.target.value); setHi(0); }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, Math.max(filtered.length - 1, 0))); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); choose(filtered[hi] ?? exact()); }
          else if (e.key === 'Escape') { setOpen(false); setQ(''); }
        }} />
      {value && !open && !disabled && (
        <button onClick={() => onChange('')} style={{ position: 'absolute', right: 6, top: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 13 }}>x</button>
      )}
      {open && qt.length >= 1 && (
        <div style={{ position: 'absolute', zIndex: 1100, background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 6, width: '100%', maxHeight: 220, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: 12, color: '#9CA3AF' }}>
              {safe.length === 0 ? 'Plano de contas sem contas analíticas para esta empresa.' : 'Nenhuma conta encontrada.'}
            </div>
          )}
          {filtered.map((a, i) => (
            <div key={a.id} onMouseDown={() => choose(a)}
              style={{ padding: '7px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '0.5px solid #F5F5F5', background: i === hi ? '#E8F5EE' : '#fff' }}
              onMouseEnter={() => setHi(i)}>
              <span style={{ fontWeight: 600, color: '#1A4A3A' }}>{a.reducedCode || a.code}</span>
              <span style={{ color: '#6B7280', marginLeft: 8 }}>{a.reducedCode ? `${a.code} ` : ''}{a.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
