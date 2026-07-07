import React, { useState, useEffect } from 'react';

interface SmartDateInputProps {
  value: string; // 'YYYY-MM-DD' ou ''
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
}

function isValidCalendarDate(d: number, m: number, y: number): boolean {
  if (m < 1 || m > 12) return false;
  const test = new Date(y, m - 1, d);
  return test.getFullYear() === y && test.getMonth() === m - 1 && test.getDate() === d;
}

function parseFullDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hasSeparator = /[\/\-]/.test(trimmed);
  let dd: string, mm: string, yyyy: string;

  if (hasSeparator) {
    const parts = trimmed.split(/[\/\-]/).filter(p => p.length > 0);
    if (parts.length !== 3) return null;
    let [d, m, y] = parts;
    if (d.length > 2 || m.length > 2) return null;
    dd = d.padStart(2, '0');
    mm = m.padStart(2, '0');
    if (y.length === 2) yyyy = '20' + y;
    else if (y.length === 4) yyyy = y;
    else return null;
  } else {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length === 8) {
      dd = digits.slice(0, 2);
      mm = digits.slice(2, 4);
      yyyy = digits.slice(4, 8);
    } else if (digits.length === 6) {
      dd = digits.slice(0, 2);
      mm = digits.slice(2, 4);
      yyyy = '20' + digits.slice(4, 6);
    } else {
      return null;
    }
  }

  const ddNum = parseInt(dd, 10);
  const mmNum = parseInt(mm, 10);
  const yyyyNum = parseInt(yyyy, 10);
  if (isNaN(ddNum) || isNaN(mmNum) || isNaN(yyyyNum)) return null;
  if (yyyyNum < 1900 || yyyyNum > 2100) return null;
  if (!isValidCalendarDate(ddNum, mmNum, yyyyNum)) return null;

  return `${yyyy}-${mm}-${dd}`;
}

function formatFullDate(value: string): string {
  if (!value) return '';
  const [yyyy, mm, dd] = value.split('-');
  if (!yyyy || !mm || !dd) return value;
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Input de data completa com reconhecimento flexivel de formato na digitacao.
 * Aceita: DDMMAAAA, DDMMAA, DD/MM/AAAA, DD/MM/AA, DD-MM-AAAA, DD-MM-AA (sem mascara, sem piscar).
 * O parse so roda no blur/Enter -- durante a digitacao o texto fica livre.
 * Sempre retorna/recebe 'YYYY-MM-DD' via onChange/value.
 */
export const SmartDateInput: React.FC<SmartDateInputProps> = ({
  value, onChange, disabled, placeholder = 'DD/MM/AAAA', style, className,
}) => {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!editing) setRaw(formatFullDate(value));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    if (!raw.trim()) {
      setInvalid(false);
      onChange('');
      return;
    }
    const parsed = parseFullDate(raw);
    if (parsed) {
      setInvalid(false);
      onChange(parsed);
      setRaw(formatFullDate(parsed));
    } else {
      setInvalid(true);
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      className={className}
      placeholder={placeholder}
      value={raw}
      disabled={disabled}
      onFocus={() => setEditing(true)}
      onChange={e => { setRaw(e.target.value); setInvalid(false); }}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      title={invalid ? 'Formato invalido \u2014 use DD/MM/AAAA, DDMMAAAA ou DDMMAA' : undefined}
      style={{
        height: 28,
        border: `0.5px solid ${invalid ? '#DC2626' : 'var(--color-border-secondary)'}`,
        borderRadius: 6,
        padding: '0 8px',
        fontSize: 13,
        background: disabled ? 'var(--color-background-secondary, #F3F4F6)' : 'var(--color-background-primary)',
        color: 'var(--color-text-primary)',
        outline: 'none',
        width: 140,
        ...style,
      }}
    />
  );
};
