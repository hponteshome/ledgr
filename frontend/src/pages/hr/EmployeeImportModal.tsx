// frontend/src/pages/hr/EmployeeImportModal.tsx
import React, { useState, useRef } from 'react';
import api from '../../services/api';

interface ParsedDependent { name: string; relationship: string; birthDate: string | null; salaryFamily: boolean; irDeduction: boolean; }
interface ParsedEmployee { registrationNumber: string; fullName: string; taxId: string | null; hireDate: string | null; role: string | null; salary: number | null; weeklyHours: number | null; motherName: string | null; fatherName: string | null; birthDate: string | null; maritalStatus: string | null; raceColor: string | null; educationLevel: string | null; phone: string | null; street: string | null; neighborhood: string | null; city: string | null; addressState: string | null; zipCode: string | null; rgNumber: string | null; pisNumber: string | null; ctpsNumber: string | null; ctpsSeries: string | null; lotacao: string | null; dependents: ParsedDependent[]; status: string; }

interface Props { onClose: () => void; onSuccess: () => void; }

function fmtCpf(v: string | null) { return v?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') ?? '—'; }
function fmtDate(s: string | null) { if (!s) return '—'; try { return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR'); } catch { return s ?? '—'; } }
function fmtSalary(v: number | null) { return v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'; }

const FIELDS: Array<{ key: keyof ParsedEmployee; label: string }> = [
  { key: 'fullName', label: 'Nome completo' },
  { key: 'taxId', label: 'CPF' },
  { key: 'birthDate', label: 'Nascimento' },
  { key: 'hireDate', label: 'Admissão' },
  { key: 'role', label: 'Função' },
  { key: 'salary', label: 'Salário' },
  { key: 'weeklyHours', label: 'Horas/Sem' },
  { key: 'maritalStatus', label: 'Est. Civil' },
  { key: 'motherName', label: 'Nome da Mãe' },
  { key: 'phone', label: 'Telefone' },
  { key: 'street', label: 'Endereço' },
  { key: 'neighborhood', label: 'Bairro' },
  { key: 'city', label: 'Cidade' },
  { key: 'addressState', label: 'UF' },
  { key: 'zipCode', label: 'CEP' },
  { key: 'rgNumber', label: 'RG' },
  { key: 'pisNumber', label: 'PIS' },
  { key: 'ctpsNumber', label: 'CTPS' },
  { key: 'lotacao', label: 'Lotação' },
  { key: 'educationLevel', label: 'Escolaridade' },
];

export const EmployeeImportModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [step, setStep]           = useState<'upload' | 'preview' | 'done'>('upload');
  const [file, setFile]           = useState<File | null>(null);
  const [loading, setLoading]     = useState(false);
  const [employees, setEmployees] = useState<ParsedEmployee[]>([]);
  const [openIdx, setOpenIdx]     = useState<number | null>(null);
  const [results, setResults]     = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleParse() {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/hr/employees/parse-pdf', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEmployees(data);
      setStep('preview');
    } catch (e: any) {
      alert('Erro ao processar PDF: ' + (e?.response?.data?.message ?? e.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    setLoading(true);
    try {
      const { data } = await api.post('/hr/employees/import-batch', { employees });
      setResults(data);
      setStep('done');
      onSuccess();
    } catch (e: any) {
      alert('Erro na importação: ' + (e?.response?.data?.message ?? e.message));
    } finally {
      setLoading(false);
    }
  }

  function updateField(idx: number, key: string, value: string) {
    setEmployees(prev => prev.map((e, i) => i === idx ? { ...e, [key]: value } : e));
  }

  const ok   = employees.filter(e => e.taxId && e.fullName && e.hireDate).length;
  const warn = employees.length - ok;

  const S = {
    overlay:  { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modal:    { background: '#fff', borderRadius: 14, width: 920, maxHeight: '90vh', display: 'flex', flexDirection: 'column' as const, boxShadow: '0 20px 60px rgba(0,0,0,.18)' },
    header:   { padding: '14px 20px', borderBottom: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F0F9FF', borderRadius: '14px 14px 0 0' },
    body:     { padding: 20, overflowY: 'auto' as const, flex: 1 },
    footer:   { padding: '12px 20px', borderTop: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    btn:      { padding: '8px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
    kpi:      { background: '#F9FAFB', border: '0.5px solid #E5E7EB', borderRadius: 8, padding: '10px 14px' },
    tag:      (ok: boolean) => ({ fontSize: 10, padding: '1px 8px', borderRadius: 20, background: ok ? '#F0FDF4' : '#FEF3C7', color: ok ? '#15803D' : '#92400E', fontWeight: 600 }),
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#0369A1' }}>◆ RH</span>
            <h2 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 500, color: '#111' }}>Importar Funcionários — Ficha Cadastral Kipstone</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6B7280', lineHeight: 1 }}>×</button>
        </div>

        <div style={S.body}>

          {/* ── STEP 1: Upload ── */}
          {step === 'upload' && (
            <div>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
                Selecione o PDF <strong>Relação do Cadastro de Funcionários</strong> exportado do sistema Kipstone.
                O sistema extrai automaticamente os dados de cada funcionário para revisão antes de importar.
              </p>
              <div
                onClick={() => fileRef.current?.click()}
                style={{ border: '2px dashed #D1D5DB', borderRadius: 10, padding: '48px 24px', textAlign: 'center', cursor: 'pointer', background: file ? '#F0FDF4' : '#F9FAFB', borderColor: file ? '#86EFAC' : '#D1D5DB' }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                <p style={{ fontSize: 14, color: file ? '#15803D' : '#6B7280', margin: 0, fontWeight: 500 }}>
                  {file ? file.name : 'Clique para selecionar o PDF'}
                </p>
                {file && <p style={{ fontSize: 11, color: '#9CA3AF', margin: '4px 0 0' }}>{(file.size / 1024).toFixed(1)} KB</p>}
              </div>
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>
          )}

          {/* ── STEP 2: Preview ── */}
          {step === 'preview' && (
            <div>
              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'Funcionários', value: employees.length, color: '#111' },
                  { label: 'Prontos p/ importar', value: ok, color: '#15803D' },
                  { label: 'Incompletos', value: warn, color: warn > 0 ? '#D97706' : '#15803D' },
                  { label: 'Dependentes', value: employees.reduce((s, e) => s + (e.dependents?.length ?? 0), 0), color: '#0369A1' },
                ].map(k => (
                  <div key={k.label} style={S.kpi}>
                    <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 }}>{k.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* Cards dos funcionários */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {employees.map((emp, idx) => {
                  const isOk   = !!(emp.taxId && emp.fullName && emp.hireDate);
                  const isOpen = openIdx === idx;
                  return (
                    <div key={idx} style={{ border: `0.5px solid ${isOk ? '#BBF7D0' : '#FED7AA'}`, borderRadius: 10, overflow: 'hidden' }}>
                      {/* Cabeçalho do card */}
                      <div
                        onClick={() => setOpenIdx(isOpen ? null : idx)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', background: isOpen ? '#F9FAFB' : '#fff', userSelect: 'none' }}
                      >
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#3B82F6', fontSize: 13, flexShrink: 0 }}>
                          {(emp.fullName ?? '?').split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: emp.fullName ? '#111' : '#EF4444' }}>
                            {emp.fullName || '⚠ Nome não extraído'}
                          </div>
                          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                            CPF: {fmtCpf(emp.taxId)} · {emp.role ?? '—'} · {fmtSalary(emp.salary)} · Admissão: {fmtDate(emp.hireDate)}
                            {emp.dependents?.length > 0 && <span style={{ marginLeft: 8, color: '#0369A1' }}>· {emp.dependents.length} dep.</span>}
                          </div>
                        </div>
                        <span style={S.tag(isOk)}>{isOk ? 'OK' : 'INCOMPLETO'}</span>
                        <span style={{ color: '#9CA3AF', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                      </div>

                      {/* Detalhes editáveis */}
                      {isOpen && (
                        <div style={{ padding: '14px 16px', borderTop: '0.5px solid #F3F4F6', background: '#FAFAFA' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 12 }}>
                            {FIELDS.map(({ key, label }) => (
                              <div key={key}>
                                <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 3, fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
                                <input
                                  value={String(emp[key] ?? '')}
                                  onChange={e => updateField(idx, key, e.target.value)}
                                  style={{ width: '100%', boxSizing: 'border-box', border: '0.5px solid #E5E7EB', borderRadius: 6, padding: '5px 8px', fontSize: 12, outline: 'none', background: '#fff' }}
                                />
                              </div>
                            ))}
                          </div>
                          {emp.dependents?.length > 0 && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase' }}>Dependentes</div>
                              {emp.dependents.map((d, di) => (
                                <div key={di} style={{ fontSize: 12, color: '#374151', padding: '4px 0', borderBottom: '0.5px solid #F3F4F6', display: 'flex', gap: 12 }}>
                                  <span style={{ fontWeight: 500 }}>{d.name}</span>
                                  <span style={{ color: '#6B7280' }}>{d.relationship}</span>
                                  <span style={{ color: '#6B7280' }}>{fmtDate(d.birthDate)}</span>
                                  <span style={{ color: '#0369A1' }}>SF: {d.salaryFamily ? 'S' : 'N'}</span>
                                  <span style={{ color: '#0369A1' }}>IR: {d.irDeduction ? 'S' : 'N'}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── STEP 3: Done ── */}
          {step === 'done' && (
            <div>
              <div style={{ textAlign: 'center', padding: '20px 0 24px' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                <h3 style={{ fontSize: 16, fontWeight: 500, color: '#111', margin: '0 0 4px' }}>Importação concluída</h3>
                <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
                  {results.filter(r => r.success).length} de {results.length} funcionário(s) importado(s) com sucesso.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {results.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 8, background: r.success ? '#F0FDF4' : '#FEF2F2', border: `0.5px solid ${r.success ? '#BBF7D0' : '#FECACA'}` }}>
                    <span>{r.success ? '✅' : '❌'}</span>
                    <span style={{ fontSize: 13, color: '#111', flex: 1 }}>{r.name}</span>
                    {r.error && <span style={{ fontSize: 11, color: '#EF4444' }}>{r.error}</span>}
                    {r.success && r.dependentsCreated > 0 && <span style={{ fontSize: 11, color: '#0369A1' }}>{r.dependentsCreated} dep.</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button onClick={onClose} style={{ ...S.btn, border: '0.5px solid #D1D5DB', background: '#fff', color: '#374151' }}>
            {step === 'done' ? 'Fechar' : 'Cancelar'}
          </button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {loading && <span style={{ fontSize: 12, color: '#9CA3AF' }}>Processando...</span>}
            {step === 'upload' && (
              <button onClick={handleParse} disabled={!file || loading} style={{ ...S.btn, background: file && !loading ? '#0369A1' : '#9CA3AF', color: '#fff' }}>
                Extrair Dados do PDF
              </button>
            )}
            {step === 'preview' && (
              <button onClick={handleImport} disabled={ok === 0 || loading} style={{ ...S.btn, background: ok > 0 && !loading ? '#15803D' : '#9CA3AF', color: '#fff' }}>
                Importar {ok} Funcionário{ok !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};