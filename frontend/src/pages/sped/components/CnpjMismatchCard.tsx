// ============================================================
// LEDGR — apps/web/src/pages/sped/components/CnpjMismatchCard.tsx
// Card de erro detalhado para divergência de CNPJ no ECF
// Usar em EcfPage.tsx após receber resposta da validação
// ============================================================
import React from 'react';

interface Props {
  fileInfo: {
    cnpj: string;
    companyName: string;
    periodStart: string;
    periodEnd: string;
  };
  activeCompany: {
    taxId: string;
    name: string;
  } | null;
}

function fmtCNPJ(cnpj: string) {
  const c = cnpj.replace(/\D/g, '');
  if (c.length !== 14) return cnpj;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

function fmtDate(s: string) {
  if (!s || s.length !== 8) return s;
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

export function CnpjMismatchCard({ fileInfo, activeCompany }: Props) {
  return (
    <div style={{
      border: '1.5px solid #E57373',
      borderLeft: '5px solid #C62828',
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{
        background: '#FFCDD2',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 20 }}>⛔</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#B71C1C' }}>
            CNPJ do arquivo diverge da empresa selecionada
          </div>
          <div style={{ fontSize: 12, color: '#C62828', marginTop: 1 }}>
            Erro bloqueante — não é possível importar este arquivo para esta empresa
          </div>
        </div>
      </div>

      {/* Comparação */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 0, background: '#fff',
      }}>
        {/* Arquivo */}
        <div style={{
          padding: '14px 18px',
          borderRight: '1px solid #FFCDD2',
          borderBottom: '1px solid #FFCDD2',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            📄 Arquivo ECF
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#B71C1C', fontFamily: 'monospace' }}>
            {fmtCNPJ(fileInfo.cnpj)}
          </div>
          <div style={{ fontSize: 13, color: '#333', marginTop: 4 }}>
            {fileInfo.companyName || '—'}
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
            Período: {fmtDate(fileInfo.periodStart)} a {fmtDate(fileInfo.periodEnd)}
          </div>
        </div>

        {/* Empresa ativa */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #FFCDD2' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            🏢 Empresa selecionada no LEDGR
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1B5E20', fontFamily: 'monospace' }}>
            {activeCompany ? fmtCNPJ(activeCompany.taxId) : '—'}
          </div>
          <div style={{ fontSize: 13, color: '#333', marginTop: 4 }}>
            {activeCompany?.name || '—'}
          </div>
        </div>
      </div>

      {/* Instrução */}
      <div style={{
        background: '#FFF3E0',
        borderTop: '1px solid #FFB74D',
        padding: '10px 16px',
        fontSize: 12, color: '#7A3200',
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
        <span>
          Para importar este arquivo, troque a empresa ativa no seletor do topo da página
          e selecione a empresa com CNPJ <strong style={{ fontFamily: 'monospace' }}>{fmtCNPJ(fileInfo.cnpj)}</strong>.
        </span>
      </div>
    </div>
  );
}

// ============================================================
// Como usar em EcfPage.tsx:
// ============================================================
//
// 1. Adicionar ao estado:
//    const [validationResult, setValidationResult] = useState<any>(null);
//
// 2. Após chamada ao /sped/ecf/validate, guardar resposta:
//    setValidationResult(response.data);
//
// 3. Renderizar o card quando houver divergência:
//    {validationResult?.cnpjMismatch && (
//      <CnpjMismatchCard
//        fileInfo={validationResult.fileInfo}
//        activeCompany={validationResult.activeCompany}
//      />
//    )}
// ============================================================