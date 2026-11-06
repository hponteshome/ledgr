// frontend/src/pages/assets/modals/AgentIniciar.tsx
// Aviso do LEDGR Agent (A3) com botao "Iniciar Agent" via protocolo ledgr-agent:// (registrado por B-AGENT-AUTO).
// Nao renderiza nada enquanto o Agent responde em http://localhost:7778/health.
import { useEffect, useRef, useState } from 'react';

const HEALTH = 'http://localhost:7778/health';

export function AgentIniciar({ ativo = true }: { ativo?: boolean }) {
  const [estado, setEstado] = useState<'verificando' | 'online' | 'offline' | 'iniciando' | 'iniciado'>('verificando');
  const anterior = useRef<string>('verificando');

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    const checar = async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 1500);
        const r = await fetch(HEALTH, { signal: ctrl.signal });
        clearTimeout(t);
        if (!vivo) return;
        if (r.ok) {
          setEstado(e => (e === 'iniciando' || anterior.current === 'offline' ? 'iniciado' : e === 'iniciado' ? 'iniciado' : 'online'));
        } else setEstado(e => (e === 'iniciando' ? e : 'offline'));
      } catch {
        if (vivo) setEstado(e => (e === 'iniciando' ? e : 'offline'));
      }
    };
    checar();
    const id = setInterval(checar, 3000);
    return () => { vivo = false; clearInterval(id); };
  }, [ativo]);

  useEffect(() => { if (estado === 'offline') anterior.current = 'offline'; }, [estado]);

  if (!ativo || estado === 'online' || estado === 'verificando') return null;

  if (estado === 'iniciado') {
    return (
      <div className="rounded-lg px-3 py-2 text-[12px] text-green-800" style={{ background: '#EAF6EC' }}>
        LEDGR Agent no ar. Feche e abra o modal de novo para listar o certificado A3 (token).
      </div>
    );
  }

  return (
    <div className="rounded-lg px-3 py-2 text-[12px] text-amber-800 flex items-center gap-3" style={{ background: '#FFF6E5' }}>
      <span>
        {estado === 'iniciando'
          ? 'Iniciando o LEDGR Agent... (se o navegador perguntar, permita abrir o LEDGR Agent)'
          : 'LEDGR Agent fora do ar (necessário só para certificado A3).'}
      </span>
      {estado === 'offline' && (
        <button
          type="button"
          className="underline font-medium"
          onClick={() => { setEstado('iniciando'); window.location.href = 'ledgr-agent://iniciar'; setTimeout(() => setEstado(e => (e === 'iniciando' ? 'offline' : e)), 20000); }}
        >
          Iniciar Agent
        </button>
      )}
    </div>
  );
}