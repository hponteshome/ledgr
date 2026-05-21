// frontend/src/pages/hr/InformeRendimentosPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../contexts/CompanyContext';
import api from '../../services/api';
import Swal from 'sweetalert2';

const S = {
  card: { background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: 20, marginBottom: 16 },
  input: { height: 32, border: '0.5px solid #E5E7EB', borderRadius: 6, padding: '0 9px', fontSize: 12, width: '100%', boxSizing: 'border-box' as const },
  btn: { height: 30, border: '0.5px solid #D1D5DB', borderRadius: 6, padding: '0 14px', fontSize: 12, cursor: 'pointer', background: '#fff', color: '#374151' },
  btnP: { height: 30, border: 'none', borderRadius: 6, padding: '0 14px', fontSize: 12, cursor: 'pointer', background: '#111', color: '#fff' },
  th: { background: '#F9FAFB', color: '#6B7280', fontSize: 10, textTransform: 'uppercase' as const, padding: '8px 12px', borderBottom: '0.5px solid #E5E7EB', textAlign: 'left' as const },
  td: { padding: '8px 12px', borderBottom: '0.5px solid #F5F5F5', fontSize: 12, color: '#374151' },
  label: { fontSize: 10, textTransform: 'uppercase' as const, color: '#6B7280', display: 'block', marginBottom: 3 },
};

const EMPTY: any = {
  personId: '', anoCalendario: new Date().getFullYear() - 1,
  naturezaRendimento: 'Rendimentos do trabalho sem vínculo empregatício',
  q3TotalRendimentos: '', q3ContribPrevidenciaria: '', q3ContribPrevidCompl: '', q3PensaoAlimenticia: '', q3Irrf: '',
  q4ParcelaIsentaAposent: '', q4ParcelaIsenta13: '', q4DiariasAjudaCusto: '', q4PensaoMolestia: '',
  q4LucrosDividendos: '', q4ValoresMEI: '', q4IndenizacaoRescisao: '', q4JurosMora: '', q4Outros: '',
  q5DecimoTerceiro: '', q5IrrfDecimoTerceiro: '', q5Outros: '',
  q6NumeroProcesso: '', q6QtdMeses: '', q6NaturezaRendimento: '',
  q6TotalRendimentos: '', q6ExclusaoDespesas: '', q6ContribPrevidenciaria: '',
  q6PensaoAlimenticia: '', q6Irrf: '', q6RendIsentoMolestia: '',
  q7InformacoesCompl: '', q8NomeResponsavel: '', q8DataAssinatura: '',
};

const parseBR = (v: string) => parseFloat((v || '0').replace(/\./g, '').replace(',', '.')) || 0;
const fmtBR = (v: any) => {
  const n = typeof v === 'string' ? parseBR(v) : Number(v || 0);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtCpf = (v: string) => v?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') ?? v;
const fmtCnpj = (v: string) => v?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') ?? v;
const fmtDate = (v: any) => v ? new Date(v).toLocaleDateString('pt-BR') : '';

function Row({ num, label, k, form, set }: any) {
  const [editing, setEditing] = useState(false);
  const raw = form[k];
  const displayVal = editing ? raw : (raw === '' ? '' : fmtBR(raw));
  return (
    <tr>
      <td style={{ padding: '3px 6px', fontSize: '8pt', borderBottom: '0.5px solid #E5E7EB', width: '75%' }}>{num}. {label}</td>
      <td style={{ padding: '2px 4px', borderBottom: '0.5px solid #E5E7EB', width: '25%' }}>
        <input
          style={{ height: 24, border: '0.5px solid #D1D5DB', borderRadius: 4, padding: '0 6px', fontSize: '8.5pt', width: '100%', textAlign: 'right' as const, fontFamily: 'monospace', boxSizing: 'border-box' as const }}
          type="text" placeholder="" value={displayVal}
          onChange={e => set(k, e.target.value)}
          onFocus={() => setEditing(true)}
          onBlur={() => { setEditing(false); const n = parseBR(String(raw)); set(k, n === 0 ? '' : String(n)); }}
        />
      </td>
    </tr>
  );
}

function SecHeader({ num, title, right }: any) {
  return (
    <tr>
      <td colSpan={2} style={{ background: '#F9FAFB', padding: '4px 6px', borderTop: '1px solid #ccc', borderBottom: '0.5px solid #E5E7EB' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '8.5pt' }}>{num}. {title}</span>
          {right && <span style={{ fontSize: '7.5pt', fontStyle: 'italic', color: '#555' }}>{right}</span>}
        </div>
      </td>
    </tr>
  );
}

function PreviewRow({ num, label, val }: any) {
  return (
    <tr>
      <td style={{ padding: '2px 4px', fontSize: '8pt', borderBottom: '0.5px solid #ccc', width: '75%' }}>{num}. {label}</td>
      <td style={{ padding: '2px 4px', fontSize: '8pt', borderBottom: '0.5px solid #ccc', width: '25%', textAlign: 'right' as const, fontFamily: 'monospace' }}>{fmtBR(val)}</td>
    </tr>
  );
}

function PreviewSec({ num, title, right }: any) {
  return (
    <tr>
      <td colSpan={2} style={{ background: '#F9FAFB', padding: '3px 4px', borderTop: '1px solid #999', borderBottom: '0.5px solid #ccc' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: '8.5pt' }}>{num}. {title}</span>
          {right && <span style={{ fontSize: '7.5pt', fontStyle: 'italic', color: '#555' }}>{right}</span>}
        </div>
      </td>
    </tr>
  );
}

function PreviewModal({ informe, onClose, onPdf }: any) {
  const c = informe.company;
  const p = informe.person;
  const anoExercicio = informe.anoCalendario + 1;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 820, marginTop: 16, marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>Visualização — Informe de Rendimentos {informe.anoCalendario}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={S.btnP} onClick={onPdf}>📄 Gerar PDF</button>
            <button style={S.btn} onClick={onClose}>Fechar</button>
          </div>
        </div>
        <div style={{ border: '1px solid #999', fontSize: '8.5pt', fontFamily: 'Arial, sans-serif' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1px solid #999' }}>
            <tbody><tr>
              <td style={{ width: '55%', padding: '6px 8px', borderRight: '1px solid #999', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>{c?.legalName}</div>
                <div style={{ fontSize: '8pt' }}>{fmtCnpj(c?.taxId)}</div>
                <div style={{ fontSize: '8pt' }}>Exercício de {anoExercicio}</div>
              </td>
              <td style={{ width: '45%', padding: '6px 8px', verticalAlign: 'top', textAlign: 'right' as const }}>
                <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>Comprovante de Rendimentos Pagos e de</div>
                <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>Imposto sobre a Renda Retido na Fonte</div>
                <div style={{ fontSize: '8.5pt', marginTop: 4 }}>Ano-calendário de {informe.anoCalendario}</div>
              </td>
            </tr></tbody>
          </table>
          <div style={{ fontWeight: 'bold', padding: '2px 4px', borderBottom: '0.5px solid #ccc', background: '#F9FAFB', fontSize: '8.5pt' }}>1. Fonte Pagadora Pessoa Jurídica</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '0.5px solid #ccc' }}>
            <tbody><tr>
              <td style={{ width: '35%', padding: '2px 4px', borderRight: '0.5px solid #ccc', fontSize: '8pt' }}><span style={{ fontSize: '7pt', display: 'block', color: '#555' }}>CNPJ</span>{fmtCnpj(c?.taxId)}</td>
              <td style={{ width: '65%', padding: '2px 4px', fontSize: '8pt' }}><span style={{ fontSize: '7pt', display: 'block', color: '#555' }}>Nome Empresarial</span>{c?.legalName}</td>
            </tr></tbody>
          </table>
          <div style={{ fontWeight: 'bold', padding: '2px 4px', borderBottom: '0.5px solid #ccc', background: '#F9FAFB', fontSize: '8.5pt' }}>2. Pessoa Física Beneficiária dos Rendimentos</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '0.5px solid #ccc' }}>
            <tbody>
              <tr>
                <td style={{ width: '35%', padding: '2px 4px', borderRight: '0.5px solid #ccc', fontSize: '8pt' }}><span style={{ fontSize: '7pt', display: 'block', color: '#555' }}>CPF</span>{fmtCpf(p?.cpf)}</td>
                <td style={{ width: '65%', padding: '2px 4px', fontSize: '8pt' }}><span style={{ fontSize: '7pt', display: 'block', color: '#555' }}>Nome Completo</span>{p?.fullName}</td>
              </tr>
              <tr><td colSpan={2} style={{ padding: '2px 4px', borderTop: '0.5px solid #ccc', fontSize: '8pt' }}><span style={{ fontSize: '7pt', display: 'block', color: '#555' }}>Natureza do Rendimento</span>{informe.naturezaRendimento}</td></tr>
            </tbody>
          </table>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <PreviewSec num="3" title="Rendimentos Tributáveis, Deduções e Imposto sobre a Renda Retido da Fonte" right="Valores em reais" />
              <PreviewRow num="1" label="Total dos rendimentos (inclusive férias)" val={informe.q3TotalRendimentos} />
              <PreviewRow num="2" label="Contribuição previdenciária oficial" val={informe.q3ContribPrevidenciaria} />
              <PreviewRow num="3" label="Contribuição a entidades de previdência complementar, pública ou privada, e a fundos de aposentadoria programada individual (Fapi)(preencher também o quadro 7)" val={informe.q3ContribPrevidCompl} />
              <PreviewRow num="4" label="Pensão alimentícia (preencher também o quadro 7)" val={informe.q3PensaoAlimenticia} />
              <PreviewRow num="5" label="Imposto sobre a renda retido na fonte" val={informe.q3Irrf} />
              <PreviewSec num="4" title="Rendimentos Isentos e Não Tributáveis" right="Valores em reais" />
              <PreviewRow num="1" label="Parcela isenta dos proventos de aposentadoria, reserva remunerada, reforma e pensão (65 anos ou mais), exceto a parcela isenta do 13º (décimo terceiro) salário" val={informe.q4ParcelaIsentaAposent} />
              <PreviewRow num="2" label="Parcela isenta do 13º salário de aposentadoria, reserva remunerada, reforma e pensão (65 anos ou mais)" val={informe.q4ParcelaIsenta13} />
              <PreviewRow num="3" label="Diárias e ajuda de custo" val={informe.q4DiariasAjudaCusto} />
              <PreviewRow num="4" label="Pensão e proventos de aposentadoria ou reforma por moléstia grave; proventos de aposentadoria ou reforma por acidente em serviço" val={informe.q4PensaoMolestia} />
              <PreviewRow num="5" label="Lucros e dividendos, apurados a partir de 1996, pagos por pessoa jurídica (lucro real, presumido ou arbitrado)" val={informe.q4LucrosDividendos} />
              <PreviewRow num="6" label="Valores pagos ao titular ou sócio da microempresa ou empresa de pequeno porte, exceto pro labore, aluguéis ou serviços prestados" val={informe.q4ValoresMEI} />
              <PreviewRow num="7" label="Indenizações por rescisão de contrato de trabalho, inclusive a título de PDV e por acidente de trabalho" val={informe.q4IndenizacaoRescisao} />
              <PreviewRow num="8" label="Juros de mora recebidos, devidos pelo atraso no pagamento de remuneração por exercício de emprego, cargo ou função" val={informe.q4JurosMora} />
              <PreviewRow num="9" label="Outros:" val={informe.q4Outros} />
              <PreviewSec num="5" title="Rendimentos Sujeitos à Tributação Exclusiva (rendimento líquido)" right="Valores em reais" />
              <PreviewRow num="1" label="Décimo terceiro salário" val={informe.q5DecimoTerceiro} />
              <PreviewRow num="2" label="Imposto sobre a renda retido na fonte sobre 13º salário" val={informe.q5IrrfDecimoTerceiro} />
              <PreviewRow num="3" label="Outros" val={informe.q5Outros} />
              <PreviewSec num="6" title="Rendimentos Recebidos Acumuladamente - Art. 12-A da Lei nº 7.713, de 1988 (sujeitos à tributação exclusiva)" />
              <tr>
                <td colSpan={2} style={{ padding: '3px 6px', fontSize: '8pt', borderBottom: '0.5px solid #ccc' }}>
                  <div style={{ display: 'flex', gap: 16 }}><span>6.1 Número do processo: {informe.q6NumeroProcesso || '—'}</span><span>Quantidade de meses: {fmtBR(informe.q6QtdMeses)}</span></div>
                  <div>Natureza do rendimento: {informe.q6NaturezaRendimento || '—'}</div>
                </td>
              </tr>
              <PreviewRow num="1" label="Total dos rendimentos tributáveis (inclusive férias e décimo terceiro salário)" val={informe.q6TotalRendimentos} />
              <PreviewRow num="2" label="Exclusão: Despesas com a ação judicial" val={informe.q6ExclusaoDespesas} />
              <PreviewRow num="3" label="Dedução: Contribuição previdenciária oficial" val={informe.q6ContribPrevidenciaria} />
              <PreviewRow num="4" label="Dedução: Pensão alimentícia (preencher também o quadro 7)" val={informe.q6PensaoAlimenticia} />
              <PreviewRow num="5" label="Imposto sobre a renda retido na fonte (IRRF)" val={informe.q6Irrf} />
              <PreviewRow num="6" label="Rendimentos isentos de pensão, proventos de aposentadoria ou reforma por moléstia grave ou aposentadoria ou reforma por acidente em serviço" val={informe.q6RendIsentoMolestia} />
              <PreviewSec num="7" title="Informações Complementares" />
              <tr><td colSpan={2} style={{ padding: '4px', fontSize: '8pt', borderBottom: '0.5px solid #ccc', minHeight: 24 }}>{informe.q7InformacoesCompl || ''}</td></tr>
              <PreviewSec num="8" title="Responsável pelas Informações" />
              <tr>
                <td style={{ padding: '2px 4px', fontSize: '8pt', borderBottom: '0.5px solid #ccc', width: '50%' }}><span style={{ fontSize: '7pt', display: 'block', color: '#555' }}>Nome</span>{informe.q8NomeResponsavel || ''}</td>
                <td style={{ padding: '2px 4px', fontSize: '8pt', borderBottom: '0.5px solid #ccc', borderLeft: '0.5px solid #ccc' }}><span style={{ fontSize: '7pt', display: 'block', color: '#555' }}>Data</span>{fmtDate(informe.q8DataAssinatura)}</td>
              </tr>
            </tbody>
          </table>
          <div style={{ padding: '4px 6px', fontSize: '7.5pt', borderTop: '1px solid #999' }}>
            Gerado na Plataforma LEDGR - Aprovado pela Instrução Normativa RFB nº 2.060, de 13 de dezembro de 2021.
          </div>
        </div>
      </div>
    </div>
  );
}

function InformeModal({ informe, onClose, onSaved }: any) {
  const isEdit = !!informe?.id;
  const [form, setForm] = useState<any>({ ...EMPTY, ...informe });
  const [saving, setSaving] = useState(false);
  const [cpfInput, setCpfInput] = useState(informe?.person?.cpf ?? '');
  const [personName, setPersonName] = useState(informe?.person?.fullName ?? '');
  const navigate = useNavigate();

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const lookupCpf = async (cpf: string) => {
    const doc = cpf.replace(/\D/g, '');
    if (doc.length !== 11) return;
    try {
      const r = await api.get('/persons/document/' + doc);
      setPersonName(r.data.fullName);
      set('personId', r.data.id);
      setCpfInput(fmtCpf(doc));
    } catch {
      setPersonName('Não encontrado');
      set('personId', '');
    }
  };

  const save = async () => {
    if (!form.personId) { Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Selecione um beneficiário válido.' }); return; }
    setSaving(true);
    try {
      const pf = (v: any) => parseBR(String(v));
      const dto = {
        ...form,
        q3TotalRendimentos: pf(form.q3TotalRendimentos), q3ContribPrevidenciaria: pf(form.q3ContribPrevidenciaria),
        q3ContribPrevidCompl: pf(form.q3ContribPrevidCompl), q3PensaoAlimenticia: pf(form.q3PensaoAlimenticia),
        q3Irrf: pf(form.q3Irrf), q4ParcelaIsentaAposent: pf(form.q4ParcelaIsentaAposent),
        q4ParcelaIsenta13: pf(form.q4ParcelaIsenta13), q4DiariasAjudaCusto: pf(form.q4DiariasAjudaCusto),
        q4PensaoMolestia: pf(form.q4PensaoMolestia), q4LucrosDividendos: pf(form.q4LucrosDividendos),
        q4ValoresMEI: pf(form.q4ValoresMEI), q4IndenizacaoRescisao: pf(form.q4IndenizacaoRescisao),
        q4JurosMora: pf(form.q4JurosMora), q4Outros: pf(form.q4Outros),
        q5DecimoTerceiro: pf(form.q5DecimoTerceiro), q5IrrfDecimoTerceiro: pf(form.q5IrrfDecimoTerceiro),
        q5Outros: pf(form.q5Outros), q6QtdMeses: pf(form.q6QtdMeses),
        q6TotalRendimentos: pf(form.q6TotalRendimentos), q6ExclusaoDespesas: pf(form.q6ExclusaoDespesas),
        q6ContribPrevidenciaria: pf(form.q6ContribPrevidenciaria), q6PensaoAlimenticia: pf(form.q6PensaoAlimenticia),
        q6Irrf: pf(form.q6Irrf), q6RendIsentoMolestia: pf(form.q6RendIsentoMolestia),
      };
      if (isEdit) {
        await api.put(`/hr/informes/${informe.id}`, dto);
      } else {
        await api.post('/hr/informes', dto);
      }
      onSaved();
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Erro', text: e?.response?.data?.message ?? 'Erro ao salvar' });
    }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 780, marginTop: 16, marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>{isEdit ? 'Editar' : 'Novo'} Informe de Rendimentos</span>
          <button style={{ ...S.btn, padding: '0 8px' }} onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={S.label}>Ano-Calendário *</label>
            <input style={S.input} type="number" value={form.anoCalendario} onChange={e => set('anoCalendario', parseInt(e.target.value))} />
          </div>
          <div>
            <label style={S.label}>Natureza do Rendimento</label>
            <input style={S.input} value={form.naturezaRendimento} onChange={e => set('naturezaRendimento', e.target.value)} />
          </div>
        </div>
        <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 6, padding: '8px 10px', marginBottom: 12, background: '#FAFAFA' }}>
          <label style={S.label}>CPF do Beneficiário *</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input style={{ ...S.input, fontFamily: 'monospace', width: 160 }} value={cpfInput}
              onChange={e => setCpfInput(e.target.value)}
              onBlur={e => lookupCpf(e.target.value)}
              placeholder="000.000.000-00" maxLength={14} />
            <span style={{ fontSize: 13, fontWeight: 500, color: personName === 'Não encontrado' ? '#DC2626' : '#111', flex: 1 }}>{personName}</span>
            {personName === 'Não encontrado' && (
              <button style={{ ...S.btn, fontSize: 11, color: '#2563EB', borderColor: '#2563EB' }}
                onClick={() => navigate('/app/persons/new?cpf=' + cpfInput.replace(/\D/g, '') + '&returnTo=/app/hr/informe-rendimentos')}>
                + Cadastrar Beneficiário
              </button>
            )}
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ccc', fontSize: '8.5pt' }}>
          <tbody>
            <SecHeader num="3" title="Rendimentos Tributáveis, Deduções e Imposto sobre a Renda Retido da Fonte" right="Valores em reais" />
            <Row num="1" label="Total dos rendimentos (inclusive férias)" k="q3TotalRendimentos" form={form} set={set} />
            <Row num="2" label="Contribuição previdenciária oficial" k="q3ContribPrevidenciaria" form={form} set={set} />
            <Row num="3" label="Contribuição a entidades de previdência complementar, pública ou privada, e a fundos de aposentadoria programada individual (Fapi)(preencher também o quadro 7)" k="q3ContribPrevidCompl" form={form} set={set} />
            <Row num="4" label="Pensão alimentícia (preencher também o quadro 7)" k="q3PensaoAlimenticia" form={form} set={set} />
            <Row num="5" label="Imposto sobre a renda retido na fonte" k="q3Irrf" form={form} set={set} />
            <SecHeader num="4" title="Rendimentos Isentos e Não Tributáveis" right="Valores em reais" />
            <Row num="1" label="Parcela isenta dos proventos de aposentadoria, reserva remunerada, reforma e pensão (65 anos ou mais), exceto a parcela isenta do 13º (décimo terceiro) salário" k="q4ParcelaIsentaAposent" form={form} set={set} />
            <Row num="2" label="Parcela isenta do 13º salário de aposentadoria, reserva remunerada, reforma e pensão (65 anos ou mais)" k="q4ParcelaIsenta13" form={form} set={set} />
            <Row num="3" label="Diárias e ajuda de custo" k="q4DiariasAjudaCusto" form={form} set={set} />
            <Row num="4" label="Pensão e proventos de aposentadoria ou reforma por moléstia grave; proventos de aposentadoria ou reforma por acidente em serviço" k="q4PensaoMolestia" form={form} set={set} />
            <Row num="5" label="Lucros e dividendos, apurados a partir de 1996, pagos por pessoa jurídica (lucro real, presumido ou arbitrado)" k="q4LucrosDividendos" form={form} set={set} />
            <Row num="6" label="Valores pagos ao titular ou sócio da microempresa ou empresa de pequeno porte, exceto pro labore, aluguéis ou serviços prestados" k="q4ValoresMEI" form={form} set={set} />
            <Row num="7" label="Indenizações por rescisão de contrato de trabalho, inclusive a título de PDV e por acidente de trabalho" k="q4IndenizacaoRescisao" form={form} set={set} />
            <Row num="8" label="Juros de mora recebidos, devidos pelo atraso no pagamento de remuneração por exercício de emprego, cargo ou função" k="q4JurosMora" form={form} set={set} />
            <Row num="9" label="Outros:" k="q4Outros" form={form} set={set} />
            <SecHeader num="5" title="Rendimentos Sujeitos à Tributação Exclusiva (rendimento líquido)" right="Valores em reais" />
            <Row num="1" label="Décimo terceiro salário" k="q5DecimoTerceiro" form={form} set={set} />
            <Row num="2" label="Imposto sobre a renda retido na fonte sobre 13º salário" k="q5IrrfDecimoTerceiro" form={form} set={set} />
            <Row num="3" label="Outros" k="q5Outros" form={form} set={set} />
            <SecHeader num="6" title="Rendimentos Recebidos Acumuladamente - Art. 12-A da Lei nº 7.713, de 1988 (sujeitos à tributação exclusiva)" />
            <tr>
              <td style={{ padding: '3px 6px', fontSize: '8pt', borderBottom: '0.5px solid #E5E7EB' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span>6.1 Número do processo:</span>
                  <input style={{ height: 24, border: '0.5px solid #D1D5DB', borderRadius: 4, padding: '0 6px', fontSize: '8pt', width: 160, boxSizing: 'border-box' as const }}
                    value={form.q6NumeroProcesso} onChange={e => set('q6NumeroProcesso', e.target.value)} />
                </div>
              </td>
              <td style={{ padding: '3px 6px', fontSize: '8pt', borderBottom: '0.5px solid #E5E7EB' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                  <span>Quantidade de meses</span>
                  <input style={{ height: 24, border: '0.5px solid #D1D5DB', borderRadius: 4, padding: '0 6px', fontSize: '8pt', width: 60, textAlign: 'right' as const, boxSizing: 'border-box' as const }}
                    type="number" value={form.q6QtdMeses} onChange={e => set('q6QtdMeses', e.target.value)} />
                </div>
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ padding: '3px 6px', fontSize: '8pt', borderBottom: '0.5px solid #E5E7EB' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                    <span style={{ whiteSpace: 'nowrap' as const }}>Natureza do rendimento:</span>
                    <input style={{ height: 24, border: '0.5px solid #D1D5DB', borderRadius: 4, padding: '0 6px', fontSize: '8pt', flex: 1, boxSizing: 'border-box' as const }}
                      value={form.q6NaturezaRendimento} onChange={e => set('q6NaturezaRendimento', e.target.value)} />
                  </div>
                  <span style={{ fontSize: '7.5pt', fontStyle: 'italic', color: '#555', whiteSpace: 'nowrap' as const }}>Valores em reais</span>
                </div>
              </td>
            </tr>
            <Row num="1" label="Total dos rendimentos tributáveis (inclusive férias e décimo terceiro salário)" k="q6TotalRendimentos" form={form} set={set} />
            <Row num="2" label="Exclusão: Despesas com a ação judicial" k="q6ExclusaoDespesas" form={form} set={set} />
            <Row num="3" label="Dedução: Contribuição previdenciária oficial" k="q6ContribPrevidenciaria" form={form} set={set} />
            <Row num="4" label="Dedução: Pensão alimentícia (preencher também o quadro 7)" k="q6PensaoAlimenticia" form={form} set={set} />
            <Row num="5" label="Imposto sobre a renda retido na fonte (IRRF)" k="q6Irrf" form={form} set={set} />
            <Row num="6" label="Rendimentos isentos de pensão, proventos de aposentadoria ou reforma por moléstia grave ou aposentadoria ou reforma por acidente em serviço" k="q6RendIsentoMolestia" form={form} set={set} />
            <SecHeader num="7" title="Informações Complementares" />
            <tr>
              <td colSpan={2} style={{ padding: '4px 6px', borderBottom: '0.5px solid #E5E7EB' }}>
                <textarea style={{ width: '100%', height: 48, border: '0.5px solid #D1D5DB', borderRadius: 4, padding: '4px 6px', fontSize: '8pt', resize: 'vertical' as const, boxSizing: 'border-box' as const }}
                  value={form.q7InformacoesCompl} onChange={e => set('q7InformacoesCompl', e.target.value)} />
              </td>
            </tr>
            <SecHeader num="8" title="Responsável pelas Informações" />
            <tr>
              <td style={{ padding: '4px 6px', fontSize: '8pt', borderBottom: '0.5px solid #E5E7EB' }}>
                <label style={{ fontSize: '7pt', display: 'block', color: '#666', marginBottom: 2 }}>Nome</label>
                <input style={{ height: 24, border: '0.5px solid #D1D5DB', borderRadius: 4, padding: '0 6px', fontSize: '8pt', width: '100%', boxSizing: 'border-box' as const }}
                  value={form.q8NomeResponsavel} onChange={e => set('q8NomeResponsavel', e.target.value)} />
              </td>
              <td style={{ padding: '4px 6px', fontSize: '8pt', borderBottom: '0.5px solid #E5E7EB' }}>
                <label style={{ fontSize: '7pt', display: 'block', color: '#666', marginBottom: 2 }}>Data da assinatura</label>
                <input style={{ height: 24, border: '0.5px solid #D1D5DB', borderRadius: 4, padding: '0 6px', fontSize: '8pt', width: '100%', boxSizing: 'border-box' as const }}
                  type="date" value={form.q8DataAssinatura} onChange={e => set('q8DataAssinatura', e.target.value)} />
              </td>
            </tr>
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button style={S.btn} onClick={onClose}>Cancelar</button>
          <button style={S.btnP} onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}

export default function InformeRendimentosPage() {
  const { activeCompany } = useCompany();
  const [informes, setInformes] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editInforme, setEditInforme] = useState<any>(null);
  const [previewInforme, setPreviewInforme] = useState<any>(null);
  const [anoFiltro, setAnoFiltro] = useState('');
  const anoAtual = new Date().getFullYear();

  const load = async () => {
    try {
      const r = await api.get('/hr/informes', { params: anoFiltro ? { ano: anoFiltro } : {} });
      setInformes(r.data ?? []);
    } catch { }
  };

  useEffect(() => { load(); }, [activeCompany?.id, anoFiltro]);

  const downloadPdf = async (id: string, ano: number, cpf: string) => {
    try {
      const r = await api.get(`/hr/informes/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url; a.download = `informe-${ano}-${cpf}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { Swal.fire({ icon: 'error', title: 'Erro', text: 'Não foi possível gerar o PDF.' }); }
  };

  const remove = async (id: string) => {
    const r = await Swal.fire({ icon: 'warning', title: 'Excluir informe?', showCancelButton: true, confirmButtonColor: '#111', cancelButtonText: 'Cancelar', confirmButtonText: 'Excluir' });
    if (!r.isConfirmed) return;
    await api.delete(`/hr/informes/${id}`);
    load();
  };

  const fmtVal = (v: any) => Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#0891B2', background: '#ECFEFF', padding: '2px 8px', borderRadius: 4 }}>RH</span>
            <h1 style={{ fontSize: 18, fontWeight: 500, color: '#111' }}>Informe de Rendimentos</h1>
          </div>
          <p style={{ fontSize: 12, color: '#6B7280' }}>Comprovante de Rendimentos Pagos e IRRF Retido na Fonte</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 2 }}>Ano-calendário</label>
            <select style={{ ...S.input, width: 130 }} value={anoFiltro} onChange={e => setAnoFiltro(e.target.value)}>
              <option value="">Todos</option>
              {[0, 1, 2, 3, 4].map(i => {
                const a = String(anoAtual - i);
                return <option key={a} value={a}>{a}</option>;
              })}
            </select>
          </div>
          <button style={{ ...S.btnP, marginTop: 14 }} onClick={() => setShowModal(true)}>+ Novo Informe</button>
        </div>
      </div>
      <div style={S.card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={S.th}>Beneficiário</th>
              <th style={S.th}>CPF</th>
              <th style={S.th}>Ano</th>
              <th style={{ ...S.th, textAlign: 'right' as const }}>Rend. Tributáveis</th>
              <th style={{ ...S.th, textAlign: 'right' as const }}>IRRF</th>
              <th style={{ ...S.th, textAlign: 'right' as const }}>Lucros/Div.</th>
              <th style={S.th}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {informes.length === 0
              ? <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center' as const, color: '#9CA3AF', fontStyle: 'italic', padding: 24 }}>Nenhum informe encontrado.</td></tr>
              : informes.map(i => (
                <tr key={i.id}>
                  <td style={S.td}>{i.person?.fullName}</td>
                  <td style={{ ...S.td, fontFamily: 'monospace' }}>{fmtCpf(i.person?.cpf)}</td>
                  <td style={S.td}>{i.anoCalendario}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const }}>R$ {fmtVal(i.q3TotalRendimentos)}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const }}>R$ {fmtVal(i.q3Irrf)}</td>
                  <td style={{ ...S.td, textAlign: 'right' as const }}>R$ {fmtVal(i.q4LucrosDividendos)}</td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={{ ...S.btn, fontSize: 11 }} onClick={() => setPreviewInforme(i)}>👁 Ver</button>
                      <button style={{ ...S.btn, fontSize: 11 }} onClick={() => setEditInforme(i)}>✏️ Editar</button>
                      <button style={{ ...S.btn, fontSize: 11 }} onClick={() => downloadPdf(i.id, i.anoCalendario, i.person?.cpf)}>📄 PDF</button>
                      <button style={{ ...S.btn, fontSize: 11, color: '#DC2626', borderColor: '#FCA5A5' }} onClick={() => remove(i.id)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
      {showModal && (
        <InformeModal
          informe={null}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
      {editInforme && (
        <InformeModal
          informe={editInforme}
          onClose={() => setEditInforme(null)}
          onSaved={() => { setEditInforme(null); load(); }}
        />
      )}
      {previewInforme && (
        <PreviewModal
          informe={previewInforme}
          onClose={() => setPreviewInforme(null)}
          onPdf={() => downloadPdf(previewInforme.id, previewInforme.anoCalendario, previewInforme.person?.cpf)}
        />
      )}
    </div>
  );
}