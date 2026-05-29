// frontend/src/components/PersonLookupField.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface Props {
  label: string;
  cpfCnpj: string;
  name: string;
  onCpfCnpjChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onFound?: (data: any) => void;
  labelCls: string;
  inputCls: string;
  tipo?: 'pessoa' | 'empresa' | 'ambos';
}

export const PersonLookupField: React.FC<Props> = ({
  label, cpfCnpj, name, onCpfCnpjChange, onNameChange, onFound,
  labelCls, inputCls, tipo = 'ambos'
}) => {
  const navigate = useNavigate();
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok'|'warn'; msg: string } | null>(null);

  const handleBlur = async () => {
    const clean = cpfCnpj.replace(/\D/g, '');
    if (clean.length !== 11 && clean.length !== 14) return;
    setSearching(true);
    setFeedback(null);
    setFound(false);
    try {
      if (clean.length === 11 && tipo !== 'empresa') {
        const r = await api.get('/persons/cpf/' + clean).catch(() => null);
        if (r?.data) {
          onNameChange(r.data.fullName || '');
          onFound?.(r.data);
          setFound(true);
          setFeedback({ type: 'ok', msg: r.data.fullName });
          return;
        }
        setFeedback({ type: 'warn', msg: 'CPF não encontrado.' });
      } else if (clean.length === 14 && tipo !== 'pessoa') {
        const r = await api.get('/companies/taxid/' + clean).catch(() => null);
        if (r?.data) {
          onNameChange(r.data.legalName || '');
          onFound?.(r.data);
          setFound(true);
          setFeedback({ type: 'ok', msg: r.data.legalName });
          return;
        }
        setFeedback({ type: 'warn', msg: 'CNPJ não encontrado.' });
      }
    } finally { setSearching(false); }
  };

  const handleClear = () => {
    onCpfCnpjChange('');
    onNameChange('');
    setFound(false);
    setFeedback(null);
  };

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>{label} — CPF/CNPJ</label>
          <div className="relative flex gap-1">
            <input value={cpfCnpj}
              onChange={e => { onCpfCnpjChange(e.target.value); setFound(false); setFeedback(null); }}
              onBlur={handleBlur}
              placeholder={tipo === 'empresa' ? '00.000.000/0000-00' : tipo === 'pessoa' ? '000.000.000-00' : 'CPF ou CNPJ'}
              className={inputCls + (found ? ' border-green-400 bg-green-50' : '')} />
            {searching && <span className="absolute right-2 top-2 text-xs text-blue-400 animate-pulse">...</span>}
            {found && (
              <button onClick={handleClear} className="text-xs text-gray-400 hover:text-red-500 px-1" title="Limpar">✕</button>
            )}
          </div>
        </div>
        <div>
          <label className={labelCls}>Nome</label>
          <input value={name} readOnly={found}
            onChange={e => !found && onNameChange(e.target.value)}
            className={inputCls + (found ? ' bg-gray-50 text-gray-500 cursor-not-allowed' : '')} />
        </div>
      </div>
      {feedback && (
        <div className={"flex items-center justify-between text-xs px-3 py-1.5 rounded-lg " +
          (feedback.type === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200")}>
          <span>{feedback.type === "ok" ? "✓ " : "⚠ "}{feedback.msg}</span>
          {feedback.type === "warn" && (
            <div className="flex gap-3">
              {tipo !== "empresa" && (
                <button onClick={() => navigate("/app/persons/new?cpf=" + cpfCnpj.replace(/\D/g,"") + "&returnTo=" + encodeURIComponent(window.location.pathname + "?tab=contabil&escritorioCnpj=" + cpfCnpj.replace(/\D/g,"")))} className="font-semibold underline">+ Cadastrar Pessoa</button>
              )}
              {tipo !== "pessoa" && (
                <button onClick={() => navigate("/app/companies/new?cnpj=" + cpfCnpj.replace(/\D/g,"") + "&returnTo=" + encodeURIComponent(window.location.pathname + "?tab=contabil&escritorioCnpj=" + cpfCnpj.replace(/\D/g,"")))} className="font-semibold underline">+ Cadastrar Empresa</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
