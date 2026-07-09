import React, { useState, useEffect } from 'react';

interface SmartMonthInputProps {
  value: string; // 'YYYY-MM' ou ''
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
}

function parseCompetence(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  let mm: string, yyyy: string;

  if (digits.length === 3) {
    mm = digits.slice(0, 1).padStart(2, '0');
    yyyy = '20' + digits.slice(1, 3);
  } else if (digits.length === 4) {
    mm = digits.slice(0, 2);
    yyyy = '20' + digits.slice(2, 4);
  } else if (digits.length === 5) {
    mm = digits.slice(0, 1).padStart(2, '0');
    yyyy = digits.slice(1, 5);
  } else if (digits.length === 6) {
    mm = digits.slice(0, 2);
    yyyy = digits.slice(2, 6);
  } else {
    return null;
  }

  const mmNum = parseInt(mm, 10);
  if (isNaN(mmNum) || mmNum < 1 || mmNum > 12) return null;

  const yyyyNum = parseInt(yyyy, 10);
  if (isNaN(yyyyNum) || yyyyNum < 1900 || yyyyNum > 2100) return null;

  return `${yyyy}-${mm}`;
}

function formatCompetence(value: string): string {
  if (!value) return '';
  const [yyyy, mm] = value.split('-');
  if (!yyyy || !mm) return value;
  return `${mm}/${yyyy}`;
}

/**
 * Input de competencia (mes/ano) com reconhecimento flexivel de formato na digitacao.
 * Aceita: MMAAAA, MMAA, MM/AAAA, MM/AA, MM-AAAA, MM-AA, M/AA (sem mascara, sem piscar).
 * O parse so roda no blur/Enter -- durante a digitacao o texto fica livre.
 * Sempre retorna/recebe 'YYYY-MM' via onChange/value.
 */
export const SmartMonthInput: React.FC<SmartMonthInputProps> = ({
  value, onChange, placeholder = 'MM/AAAA', style, className, disabled,
}) => {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!editing) setRaw(formatCompetence(value));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    if (!raw.trim()) {
      setInvalid(false);
      onChange('');
      return;
    }
    const parsed = parseCompetence(raw);
    if (parsed) {
      setInvalid(false);
      onChange(parsed);
      setRaw(formatCompetence(parsed));
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
      title={invalid ? 'Formato invalido \u2014 use MM/AAAA, MMAAAA ou MMAA' : undefined}
      style={{
        height: 28,
        border: `0.5px solid ${invalid ? '#DC2626' : 'var(--color-border-secondary)'}`,
        borderRadius: 6,
        padding: '0 8px',
        fontSize: 13,
        background: 'var(--color-background-primary)',
        color: 'var(--color-text-primary)',
        outline: 'none',
        width: 110,
        ...style,
      }}
    />
  );
};
