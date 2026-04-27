// ============================================================
// LEDGR — frontend/src/pages/finance/FinancePage.tsx
// Design: Clean Minimalista · Accent Azul céu #0369A1
// ============================================================
import React, { useState, lazy, Suspense } from 'react';
import { FiscalDocumentTable } from '../../components/finance/FiscalDocumentTable';
import { FiscalDocumentModal } from '../../components/finance/FiscalDocumentModal';

const AgendaPage = lazy(() => import('./AgendaPage'));
const ContasAPagarPage = lazy(() => import('./ContasAPagarPage'));

// ── Design tokens ────────────────────────────────────────────
const T = {
  accent: '#0369A1',
  accentSurf: '#F0F9FF',
  accentText: '#075985',
  border: '#E5E7EB',
  surface: '#F9FAFB',
  text: '#111111',
  textMuted: '#6B7280',
  textHint: '#9CA3AF',
  sidebarW: 196,
};

type Section = 'fiscal' | 'contas' | 'agenda';
type FiscalTab = 'lancamento' | 'consumo' | 'integracoes';

// ── Loader ───────────────────────────────────────────────────
const Loader = () => (
  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textHint, fontSize: 13 }}>
    Carregando...
  </div>
);

// ── Tab bar item ─────────────────────────────────────────────
function Tab({ label, badge, active, onClick }: {
  label: string; badge?: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      padding: '11px 16px',
      fontSize: 13,
      fontWeight: active ? 500 : 400,
      color: active ? T.accent : T.textMuted,
      borderBottom: `2px solid ${active ? T.accent : 'transparent'}`,
      borderTop: 'none', borderLeft: 'none', borderRight: 'none',
      background: 'transparent',
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 6,
      whiteSpace: 'nowrap',
      transition: 'color .15s',
    }}>
      {label}
      {badge && (
        <span style={{
          fontSize: 10, fontWeight: 600,
          padding: '1px 7px', borderRadius: 20,
          background: active ? T.accentSurf : T.surface,
          color: active ? T.accentText : T.textHint,
          border: `0.5px solid ${T.border}`,
        }}>{badge}</span>
      )}
    </button>
  );
}

// ── Sidebar nav item ─────────────────────────────────────────
function NavItem({ label, active, soon, onClick }: {
  label: string; active: boolean; soon?: boolean; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 14px 7px 12px',
      fontSize: 13,
      color: active ? T.accentText : soon ? T.textHint : T.textMuted,
      background: active ? T.accentSurf : 'transparent',
      borderRadius: 8,
      margin: '1px 8px',
      fontWeight: active ? 500 : 400,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'background .12s',
    }}
      onMouseEnter={e => { if (!active && !soon) (e.currentTarget as HTMLDivElement).style.background = T.surface; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: active ? T.accent : T.border,
          flexShrink: 0,
        }} />
        {label}
      </div>
      {soon && (
        <span style={{ fontSize: 9, fontWeight: 600, color: T.textHint, letterSpacing: '.3px' }}>
          EM BREVE
        </span>
      )}
    </div>
  );
}

// ── Botão primário ───────────────────────────────────────────
function BtnPrimary({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: T.accent, color: '#fff', border: 'none',
      borderRadius: 8, padding: '8px 16px',
      fontSize: 13, fontWeight: 500, cursor: 'pointer',
      transition: 'opacity .15s',
    }}
      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = '.88'}
      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
    >{label}</button>
  );
}

function BtnSecondary({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: '#fff', color: T.textMuted,
      border: `0.5px solid ${T.border}`,
      borderRadius: 8, padding: '8px 16px',
      fontSize: 13, fontWeight: 400, cursor: 'pointer',
    }}>{label}</button>
  );
}

// ── Componente principal ─────────────────────────────────────
export default function FinancePage() {
  const [section, setSection] = useState<Section>('fiscal');
  const [fiscalTab, setFiscalTab] = useState<FiscalTab>('lancamento');
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const SIDEBAR: { section: Section | null; label: string; soon?: boolean }[] = [
    { section: 'fiscal', label: 'Doc. Fiscal' },
    { section: 'contas', label: 'Contas a Pagar' },
    { section: 'agenda', label: 'Agenda Mensal' },
    { section: null, label: 'Fluxo de Caixa', soon: true },
    { section: null, label: 'Relatórios', soon: true },
  ];

  const OTHER = ['Contabilidade', 'Fiscal', 'Ativo Fixo', 'Documentos'];

  const sectionTitle: Record<Section, string> = {
    fiscal: 'Lançamento de Documento Fiscal',
    contas: 'Contas a Pagar',
    agenda: 'Agenda Mensal',
  };

  const sectionSub: Record<Section, string> = {
    fiscal: 'NF-e, NFS-e, Fatura, Boleto, Duplicata e outros documentos fiscais',
    contas: 'Gestão de títulos, baixas e aging de fornecedores',
    agenda: 'Vencimentos, compromissos e eventos financeiros',
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', fontFamily: 'system-ui, Arial, sans-serif',
      overflow: 'hidden', background: T.surface,
    }}>

      {/* ── Sidebar + Main ──────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <div style={{
          width: T.sidebarW,
          background: '#fff',
          borderRight: `0.5px solid ${T.border}`,
          padding: '16px 0',
          flexShrink: 0,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Módulo badge */}
          <div style={{ padding: '0 14px 14px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: T.accentSurf, color: T.accentText,
              fontSize: 12, fontWeight: 600,
              padding: '5px 12px', borderRadius: 20,
              border: `0.5px solid #BAE6FD`,
            }}>
              <span style={{ fontSize: 10 }}>◆</span>
              Financeiro
            </div>
          </div>

          {/* Nav financeiro */}
          <div style={{ fontSize: 10, fontWeight: 600, color: T.textHint, textTransform: 'uppercase', letterSpacing: '.6px', padding: '0 14px 6px' }}>
            Financeiro
          </div>
          {SIDEBAR.map(({ section: s, label, soon }) => (
            <NavItem
              key={label}
              label={label}
              active={s !== null && s === section}
              soon={soon}
              onClick={s ? () => setSection(s) : undefined}
            />
          ))}

          {/* Divisor */}
          <div style={{ height: '0.5px', background: T.border, margin: '14px 14px 10px' }} />

          {/* Outros módulos */}
          <div style={{ fontSize: 10, fontWeight: 600, color: T.textHint, textTransform: 'uppercase', letterSpacing: '.6px', padding: '0 14px 6px' }}>
            Outros módulos
          </div>
          {OTHER.map(m => (
            <div key={m} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 20px', fontSize: 12, color: T.textHint,
            }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.border }} />
              {m}
            </div>
          ))}
        </div>

        {/* ── Conteúdo principal ──────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Page header */}
          <div style={{
            background: '#fff',
            borderBottom: `0.5px solid ${T.border}`,
            padding: '14px 24px 0',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: T.text }}>
                  {sectionTitle[section]}
                </div>
                <div style={{ fontSize: 12, color: T.textHint, marginTop: 2 }}>
                  {sectionSub[section]}
                </div>
              </div>
              {section === 'fiscal' && (
                <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
                  <BtnSecondary label="Como funciona" onClick={() => { }} />
                  <BtnPrimary label="+ Novo Documento" onClick={() => setModalOpen(true)} />
                </div>
              )}
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 0, marginBottom: -1 }}>
              {section === 'fiscal' && [
                { key: 'lancamento' as FiscalTab, label: 'Lançamento de Documento' },
                { key: 'consumo' as FiscalTab, label: 'Contas de Consumo', badge: '4' },
                { key: 'integracoes' as FiscalTab, label: 'Integrações Geradas', badge: '12' },
              ].map(t => (
                <Tab key={t.key} label={t.label} badge={t.badge}
                  active={fiscalTab === t.key}
                  onClick={() => setFiscalTab(t.key)} />
              ))}
              {section === 'contas' && [
                { label: 'Títulos a Pagar' }, { label: 'Posição / Aging' },
              ].map((t, i) => (
                <Tab key={t.label} label={t.label} active={i === 0} onClick={() => { }} />
              ))}
              {section === 'agenda' && [
                { label: 'Agenda do Mês' }, { label: 'Configurar Agenda' }, { label: 'Histórico' },
              ].map((t, i) => (
                <Tab key={t.label} label={t.label} active={i === 0} onClick={() => { }} />
              ))}
            </div>
          </div>

          {/* ── Conteúdo da seção ─────────────────────────── */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: T.surface }}>

            {section === 'fiscal' && fiscalTab === 'lancamento' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                <FiscalDocumentTable key={refreshKey} onNewDocument={() => setModalOpen(true)} />
              </div>
            )}
            {section === 'fiscal' && fiscalTab === 'consumo' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                <FiscalDocumentTable key={`consumo-${refreshKey}`} onNewDocument={() => setModalOpen(true)} filterType="CONSUMO" />
              </div>
            )}
            {section === 'fiscal' && fiscalTab === 'integracoes' && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: T.accentSurf, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>◆</div>
                <div style={{ fontSize: 13, color: T.textMuted, fontWeight: 500 }}>Integrações geradas</div>
                <div style={{ fontSize: 12, color: T.textHint }}>Próxima fase — em desenvolvimento</div>
              </div>
            )}
            {section === 'contas' && (
              <Suspense fallback={<Loader />}>
                <ContasAPagarPage />
              </Suspense>
            )}
            {section === 'agenda' && (
              <Suspense fallback={<Loader />}>
                <AgendaPage />
              </Suspense>
            )}
          </div>
        </div>
      </div>

      <FiscalDocumentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setRefreshKey(k => k + 1); setModalOpen(false); }}
      />
    </div>
  );
}