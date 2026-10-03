// frontend/src/components/TwoFactorModal.tsx
// Seguranca 0A.6 (03/10/2026): verificacao em duas etapas (TOTP).
//  - verify: segundo passo do login (codigo do aplicativo ou codigo de recuperacao)
//  - setup : configuracao obrigatoria antes do login (QR code + ativacao)
//  - me    : usuario logado - ativacao voluntaria, situacao e novos codigos de recuperacao
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const FIN = '#1A4A3A';
const FIN_ACCENT = '#3DAA7A';
const FIN_LIGHT = '#E8F5EE';

type Modo = 'verify' | 'setup' | 'me';
type Etapa = 'carregando' | 'erro' | 'codigo' | 'qr' | 'status' | 'codigos';

interface Props {
  mode: Modo;
  email: string;
  pending?: any;
  onClose: () => void;
  onSuccess: () => void;
}

const inputSt: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '0.5px solid #E5E7EB', borderRadius: 10,
  fontSize: 18, letterSpacing: 4, textAlign: 'center', outline: 'none', boxSizing: 'border-box',
};

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{children}</div>;
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ borderLeft: `3px solid ${FIN_ACCENT}`, paddingLeft: 14, marginBottom: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: FIN, marginBottom: 10 }}>{titulo}</div>
      {children}
    </div>
  );
}

const btnPrim: React.CSSProperties = {
  background: FIN, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const btnSec: React.CSSProperties = {
  background: '#fff', color: '#374151', border: '0.5px solid #E5E7EB', borderRadius: 10,
  padding: '9px 18px', fontSize: 13, cursor: 'pointer',
};

export function TwoFactorModal({ mode, email, pending, onClose, onSuccess }: Props) {
  const { verify2fa, setup2fa, activate2fa } = useAuth();
  const [etapa, setEtapa] = useState<Etapa>(mode === 'verify' ? 'codigo' : 'carregando');
  const [codigo, setCodigo] = useState('');
  const [confiar, setConfiar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [qr, setQr] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [codigos, setCodigos] = useState<string[]>([]);
  const [situacao, setSituacao] = useState<any>(null);

  const fechar = () => (etapa === 'codigos' ? onSuccess() : onClose());

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  });

  useEffect(() => {
    const iniciar = async () => {
      try {
        if (mode === 'setup') {
          setQr(await setup2fa(pending?.setupToken));
          setEtapa('qr');
        } else if (mode === 'me') {
          const s = (await api.get('/auth/2fa/me')).data;
          setSituacao(s);
          if (s?.ativo) setEtapa('status');
          else { setQr(await setup2fa()); setEtapa('qr'); }
        }
      } catch (e: any) {
        setErro(e?.response?.data?.message || 'Falha ao iniciar a configuração.');
        setEtapa('erro');
      }
    };
    if (mode !== 'verify') iniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enviar = async () => {
    if (enviando || codigo.trim().length < 6) return;
    setErro('');
    setEnviando(true);
    try {
      if (etapa === 'codigo') {
        await verify2fa(pending?.challengeToken, codigo, confiar, email);
        onSuccess();
        return;
      }
      if (etapa === 'qr') {
        const lista = await activate2fa(codigo, mode === 'setup' ? pending?.setupToken : undefined, confiar, email);
        setCodigos(lista);
        setEtapa('codigos');
      } else if (etapa === 'status') {
        const lista = (await api.post('/auth/2fa/me/recovery-codes', { code: codigo })).data?.recoveryCodes || [];
        setCodigos(lista);
        setEtapa('codigos');
      }
      setCodigo('');
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Código inválido. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const quebra = String.fromCharCode(13, 10);
  const copiar = () => { navigator.clipboard?.writeText(codigos.join(quebra)); };
  const baixar = () => {
    const texto = 'LEDGR - códigos de recuperação (' + email + ')' + quebra + quebra + codigos.join(quebra) + quebra;
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ledgr-codigos-recuperacao.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const campoCodigo = (
    <input
      autoFocus
      value={codigo}
      onChange={(e) => setCodigo(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') enviar(); }}
      placeholder="000000"
      maxLength={9}
      inputMode="text"
      autoComplete="one-time-code"
      style={inputSt}
    />
  );

  const caixaConfiar = (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#374151', marginTop: 12, cursor: 'pointer' }}>
      <input type="checkbox" checked={confiar} onChange={(e) => setConfiar(e.target.checked)} />
      Confiar neste navegador por 24 horas
    </label>
  );

  const subtitulo: Record<Etapa, string> = {
    carregando: 'Preparando...',
    erro: 'Não foi possível continuar',
    codigo: 'Confirme sua identidade',
    qr: 'Configure o aplicativo autenticador',
    status: 'Situação da sua conta',
    codigos: 'Guarde estes códigos agora',
  };
  const acao: Partial<Record<Etapa, string>> = { codigo: 'Verificar', qr: 'Ativar', status: 'Gerar novos códigos' };

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div style={{ width: 460, maxWidth: '100%', maxHeight: '90vh', background: '#fff', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ background: FIN, color: '#fff', padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Verificação em duas etapas</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{subtitulo[etapa]}</div>
          </div>
          <button onClick={fechar} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto' }}>
          {etapa === 'carregando' && <div style={{ fontSize: 13, color: '#6B7280' }}>Preparando a configuração...</div>}

          {etapa === 'codigo' && (
            <Secao titulo="Código de verificação">
              <Label>Digite o código de 6 dígitos do aplicativo autenticador</Label>
              {campoCodigo}
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8 }}>
                Sem acesso ao aplicativo? Use um dos códigos de recuperação (formato XXXX-XXXX).
              </div>
              {caixaConfiar}
            </Secao>
          )}

          {etapa === 'qr' && qr && (
            <>
              <Secao titulo="1. Escaneie o QR code">
                <div style={{ fontSize: 12, color: '#374151', marginBottom: 10 }}>
                  Use o Google Authenticator, Microsoft Authenticator ou similar.
                </div>
                <div style={{ textAlign: 'center' }}>
                  <img src={qr.qrDataUrl} alt="QR code do 2FA" style={{ width: 180, height: 180 }} />
                </div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8 }}>Ou digite a chave manualmente:</div>
                <div style={{ fontFamily: 'Courier New, monospace', fontSize: 13, background: FIN_LIGHT, borderRadius: 10, padding: '8px 10px', wordBreak: 'break-all', marginTop: 4 }}>
                  {qr.secret}
                </div>
              </Secao>
              <Secao titulo="2. Confirme o código gerado">
                <Label>Código de 6 dígitos</Label>
                {campoCodigo}
                {mode === 'setup' && caixaConfiar}
              </Secao>
            </>
          )}

          {etapa === 'status' && situacao && (
            <>
              <Secao titulo="Situação">
                <div style={{ fontSize: 13, color: '#374151' }}>
                  Ativa desde {situacao.ativadoEm ? new Date(situacao.ativadoEm).toLocaleString('pt-BR') : '-'}
                </div>
                <div style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>
                  Códigos de recuperação restantes: <b>{situacao.codigosRestantes}</b>
                </div>
              </Secao>
              <Secao titulo="Gerar novos códigos de recuperação">
                <Label>Confirme com o código atual do aplicativo</Label>
                {campoCodigo}
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8 }}>Os códigos atuais deixam de valer.</div>
              </Secao>
            </>
          )}

          {etapa === 'codigos' && (
            <Secao titulo="Códigos de recuperação">
              <div style={{ fontSize: 12, color: '#374151', marginBottom: 10 }}>
                Guarde estes códigos em local seguro (por exemplo, no gerenciador de senhas). Eles <b>não serão exibidos novamente</b>, e cada um vale uma única vez.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: FIN_LIGHT, borderRadius: 10, padding: 12 }}>
                {codigos.map((c) => (
                  <div key={c} style={{ fontFamily: 'Courier New, monospace', fontSize: 14, textAlign: 'center' }}>{c}</div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={copiar} style={btnSec}>Copiar</button>
                <button onClick={baixar} style={btnSec}>Baixar .txt</button>
              </div>
            </Secao>
          )}

          {erro && (
            <div style={{ background: '#FCEBEB', color: '#991B1B', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginTop: 8 }}>{erro}</div>
          )}
        </div>

        <div style={{ background: '#FAFAFA', borderTop: '0.5px solid #E5E7EB', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          {etapa === 'codigos' ? (
            <button onClick={onSuccess} style={btnPrim}>Já guardei os códigos</button>
          ) : (
            <>
              <button onClick={fechar} style={btnSec}>{acao[etapa] ? 'Cancelar' : 'Fechar'}</button>
              {acao[etapa] && (
                <button onClick={enviar} disabled={enviando || codigo.trim().length < 6} style={{ ...btnPrim, opacity: enviando || codigo.trim().length < 6 ? 0.6 : 1 }}>
                  {enviando ? 'Aguarde...' : acao[etapa]}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
