// ============================================================
// LEDGR — apps/web/src/pages/finance/components/AgendaEventModal.tsx
// ============================================================
import React, { useState, useEffect } from 'react';
import { COLOR_MAP } from './AgendaCalendar';
import { useAgenda } from '../../pages/finance/hooks/useAgenda';
import type { AgendaEvent, AgendaColor, AgendaEventType } from '../../pages/finance/types/finance';

const FIN = '#1A4A3A';
const FIN_MID = '#2E7D5C';
const FIN_LIGHT = '#E8F5EE';
const FIN_ACCENT = '#3DAA7A';

const EVENT_TYPES: { value: AgendaEventType; label: string; icon: string }[] = [
  { value: 'PAYMENT', label: 'Pagamento', icon: '💳' },
  { value: 'TAX', label: 'Obrigação Fiscal', icon: '🏛️' },
  { value: 'CLOSING', label: 'Fechamento', icon: '📊' },
  { value: 'MEETING', label: 'Reunião', icon: '👥' },
  { value: 'REMINDER', label: 'Lembrete', icon: '🔔' },
  { value: 'OTHER', label: 'Outro', icon: '📌' },
];

const COLOR_OPTIONS: { value: AgendaColor; label: string }[] = [
  { value: 'YELLOW', label: 'Amarelo — NF-e / NFS-e' },
  { value: 'BLUE', label: 'Azul — Pagamentos fixos' },
  { value: 'GREEN', label: 'Verde — Fiscal / Impostos' },
  { value: 'RED', label: 'Vermelho — Urgente / Vencido' },
  { value: 'ORANGE', label: 'Laranja — Contas de consumo' },
  { value: 'PURPLE', label: 'Roxo — Reuniões / Avisos' },
];

// Sugestão automática de cor por tipo
const TYPE_DEFAULT_COLOR: Record<AgendaEventType, AgendaColor> = {
  PAYMENT: 'YELLOW',
  TAX: 'GREEN',
  CLOSING: 'BLUE',
  MEETING: 'PURPLE',
  REMINDER: 'ORANGE',
  OTHER: 'YELLOW',
};

interface Props {
  open: boolean;
  event?: AgendaEvent | null;    // null = novo
  defaultDate?: string;          // "2026-03-20" pré-preenchido
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  eventType: AgendaEventType;
  title: string;
  description: string;
  color: AgendaColor;
  dueDate: string;
  amount: string;
  isRecurring: boolean;
  recurrenceRule: string;
  isPaid: boolean;
}

const EMPTY: FormData = {
  eventType: 'PAYMENT',
  title: '',
  description: '',
  color: 'YELLOW',
  dueDate: '',
  amount: '',
  isRecurring: false,
  recurrenceRule: 'MONTHLY',
  isPaid: false,
};

export function AgendaEventModal({ open, event, defaultDate, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<FormData>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { createEvent, updateEvent, deleteEvent, loading, error } = useAgenda();

  const isEdit = !!event;

  useEffect(() => {
    if (!open) { setForm(EMPTY); setConfirmDelete(false); return; }

    if (event) {
      setForm({
        eventType: event.eventType,
        title: event.title,
        description: event.description ?? '',
        color: event.color,
        dueDate: event.dueDate.slice(0, 10),
        amount: event.amount ?? '',
        isRecurring: event.isRecurring,
        recurrenceRule: event.recurrenceRule ?? 'MONTHLY',
        isPaid: event.isPaid,
      });
    } else {
      setForm({ ...EMPTY, dueDate: defaultDate ?? '' });
    }
  }, [open, event, defaultDate]);

  // Auto-cor ao mudar tipo
  const handleTypeChange = (type: AgendaEventType) => {
    setForm(f => ({ ...f, eventType: type, color: TYPE_DEFAULT_COLOR[type] }));
  };

  const handleSubmit = async () => {
    try {
      if (isEdit) {
        await updateEvent(event!.id, {
          eventType: form.eventType,
          title: form.title,
          description: form.description || undefined,
          color: form.color,
          dueDate: form.dueDate,
          amount: form.amount || undefined,
          isRecurring: form.isRecurring,
          recurrenceRule: form.isRecurring ? form.recurrenceRule : undefined,
          isPaid: form.isPaid,
        });
      } else {
        await createEvent({
          eventType: form.eventType,
          title: form.title,
          description: form.description || undefined,
          color: form.color,
          dueDate: form.dueDate,
          amount: form.amount || undefined,
          isRecurring: form.isRecurring,
          recurrenceRule: form.isRecurring ? form.recurrenceRule : undefined,
        });
      }
      onSuccess();
    } catch { /* error mostrado pelo hook */ }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      await deleteEvent(event!.id);
      onSuccess();
    } catch { /* error */ }
  };

  if (!open) return null;

  const previewColor = COLOR_MAP[form.color];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: 520,
        maxHeight: '88vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        {/* Header */}
        <div style={{ background: FIN, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
              {isEdit ? 'Editar Evento' : 'Novo Evento na Agenda'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 1 }}>
              {isEdit && event?.fiscalDocumentId
                ? 'Gerado automaticamente por documento fiscal'
                : 'Evento manual — pode ser excluído'}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
            borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 15,
          }}>×</button>
        </div>

        {/* Preview do post-it */}
        <div style={{ padding: '12px 18px 0' }}>
          <div style={{
            background: previewColor.bg,
            borderLeft: `4px solid ${previewColor.border}`,
            borderRadius: '0 6px 6px 0',
            padding: '8px 12px',
            fontSize: 13, fontWeight: 600, color: previewColor.text,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>{form.title || 'Título do evento…'}</span>
            {form.amount && (
              <span style={{ fontSize: 14 }}>
                R$ {Number(form.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {error && (
            <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>
              ⚠ {error}
            </div>
          )}

          {/* Tipo de evento */}
          <div>
            <Label>Tipo de Evento</Label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              {EVENT_TYPES.map(({ value, label, icon }) => (
                <button key={value} onClick={() => handleTypeChange(value)} style={{
                  border: `1px solid ${form.eventType === value ? FIN_ACCENT : '#ddd'}`,
                  background: form.eventType === value ? FIN_LIGHT : '#fff',
                  color: form.eventType === value ? FIN : '#555',
                  borderRadius: 7, padding: '7px 8px', fontSize: 11,
                  cursor: 'pointer', fontWeight: form.eventType === value ? 600 : 400,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <span style={{ fontSize: 13 }}>{icon}</span>{label}
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div>
            <Label>Título *</Label>
            <input
              style={inputSt}
              placeholder="Ex: DARF IRPJ, Aluguel, Reunião financeira..."
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>

          {/* Data e Valor */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>Data de Vencimento *</Label>
              <input
                style={inputSt}
                type="date"
                value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>Valor (opcional)</Label>
              <input
                style={inputSt}
                type="number"
                step="0.01"
                placeholder="0,00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
          </div>

          {/* Cor */}
          <div>
            <Label>Cor do Post-it</Label>
            <div style={{ display: 'flex', gap: 6 }}>
              {COLOR_OPTIONS.map(({ value }) => {
                const c = COLOR_MAP[value];
                return (
                  <button key={value} onClick={() => setForm(f => ({ ...f, color: value }))}
                    title={COLOR_OPTIONS.find(o => o.value === value)?.label}
                    style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: c.bg, border: `2.5px solid ${form.color === value ? FIN : c.border}`,
                      cursor: 'pointer', padding: 0, flexShrink: 0,
                      boxShadow: form.color === value ? `0 0 0 2px ${FIN}44` : 'none',
                    }} />
                );
              })}
            </div>
          </div>

          {/* Descrição */}
          <div>
            <Label>Observações</Label>
            <textarea
              style={{ ...inputSt, height: 56, resize: 'vertical' }}
              placeholder="Detalhes adicionais..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Recorrência */}
          {!isEdit && (
            <div style={{ background: '#F9F9F9', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: form.isRecurring ? 10 : 0 }}>
                <input type="checkbox" id="recurring" checked={form.isRecurring}
                  onChange={e => setForm(f => ({ ...f, isRecurring: e.target.checked }))} />
                <label htmlFor="recurring" style={{ fontSize: 12, color: '#444', cursor: 'pointer' }}>
                  Evento recorrente (gera série automática)
                </label>
              </div>
              {form.isRecurring && (
                <select value={form.recurrenceRule}
                  onChange={e => setForm(f => ({ ...f, recurrenceRule: e.target.value }))}
                  style={{ ...inputSt, marginTop: 0 }}>
                  <option value="WEEKLY">Semanal</option>
                  <option value="MONTHLY">Mensal</option>
                  <option value="YEARLY">Anual</option>
                </select>
              )}
            </div>
          )}

          {/* Marcar como pago (somente edição) */}
          {isEdit && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="paid" checked={form.isPaid}
                onChange={e => setForm(f => ({ ...f, isPaid: e.target.checked }))} />
              <label htmlFor="paid" style={{ fontSize: 12, color: '#444', cursor: 'pointer' }}>
                Marcar como pago / liquidado
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '11px 18px', borderTop: '1px solid #eee',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#FAFAFA',
        }}>
          <div>
            {isEdit && !event?.fiscalDocumentId && (
              <button onClick={handleDelete} style={{
                background: confirmDelete ? '#A32D2D' : 'transparent',
                color: confirmDelete ? '#fff' : '#A32D2D',
                border: '1px solid #F09595',
                borderRadius: 7, padding: '7px 12px', fontSize: 12, cursor: 'pointer',
              }}>
                {confirmDelete ? 'Confirmar exclusão' : '🗑 Excluir'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{
              background: 'transparent', border: '1px solid #ddd',
              borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer',
            }}>Cancelar</button>
            <button onClick={handleSubmit} disabled={loading || !form.title || !form.dueDate} style={{
              background: loading || !form.title || !form.dueDate ? '#aaa' : FIN_ACCENT,
              color: '#fff', border: 'none',
              borderRadius: 7, padding: '7px 16px', fontSize: 12,
              fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            }}>
              {loading ? 'Salvando…' : isEdit ? '✓ Salvar' : '✓ Criar Evento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// helpers
function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>{children}</label>;
}

const inputSt: React.CSSProperties = {
  width: '100%', border: '1px solid #ddd', borderRadius: 6,
  padding: '7px 10px', fontSize: 13, outline: 'none', background: '#fff',
  boxSizing: 'border-box',
};
