import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCalendar, FiTrendingUp, FiBriefcase, FiCheckCircle, FiUsers, FiFileText } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

export const LedgrHome: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ companies: 0, users: 0, obligations: 0 });

  // Redireciona usuario logado para o dashboard
  useEffect(() => {
    if (!loading && user) navigate('/app/dashboard', { replace: true });
  }, [user, loading, navigate]);

  // Busca stats reais (publicas apos login ou sem empresa)
  useEffect(() => {
    if (user) return;
    // Para usuario nao logado, mostra stats genericas do produto
  }, [user]);

  if (loading || user) return null;

  const features = [
    { icon: <FiCalendar size={24}/>, color:'#3B82F6', bg:'#EFF6FF',
      title:'Agenda Fiscal', desc:'Acompanhe todos os prazos e obrigações fiscais em um só lugar' },
    { icon: <FiTrendingUp size={24}/>, color:'#10B981', bg:'#F0FDF4',
      title:'Indicadores', desc:'Análise em tempo real do desempenho de suas empresas' },
    { icon: <FiBriefcase size={24}/>, color:'#8B5CF6', bg:'#F5F3FF',
      title:'Multiempresa', desc:'Gerencie múltiplas empresas com facilidade e eficiência' },
    { icon: <FiCheckCircle size={24}/>, color:'#F59E0B', bg:'#FFFBEB',
      title:'Compliance', desc:'Total conformidade com SPED, NF-e, NFS-e e demais obrigações' },
  ];

  const modules = [
    { label:'Contabilidade', desc:'ECD, Balancetes, Diário, Lançamentos' },
    { label:'Fiscal / SPED', desc:'ECD, ECF, EFD-Contribuições, PVA' },
    { label:'RH Completo', desc:'Folha, Férias, 13º, RAIS, DCTFWeb, eSocial' },
    { label:'Finance', desc:'AP, AR, Fluxo de Caixa, Fechamento' },
    { label:'Ativo Imobilizado', desc:'Depreciação, Melhorias, Laudos' },
    { label:'Societário', desc:'Contrato Social, QSA, AGE/AGO, Transferências' },
  ];

  return (
    <div style={{minHeight:'100vh',background:'#F8FAFC',padding:'24px 40px'}}>
      <div style={{maxWidth:1200,margin:'0 auto'}}>
        {/* Feature cards */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:32}}>
          {features.map(f=>(
            <div key={f.title} style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',
              padding:24,transition:'box-shadow .2s'}}>
              <div style={{width:48,height:48,background:f.bg,borderRadius:10,
                display:'flex',alignItems:'center',justifyContent:'center',color:f.color,marginBottom:12}}>
                {f.icon}
              </div>
              <div style={{fontWeight:700,fontSize:15,color:'#111',marginBottom:4}}>{f.title}</div>
              <div style={{fontSize:13,color:'#6B7280',lineHeight:1.5}}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Agenda Fiscal preview */}
        <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',padding:24,marginBottom:32}}>
          <div style={{fontWeight:700,fontSize:16,color:'#111',marginBottom:4,display:'flex',alignItems:'center',gap:8}}>
            <FiCalendar color="#6C63FF"/> Agenda Fiscal — {new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}
          </div>
          <p style={{fontSize:13,color:'#9CA3AF',marginBottom:16}}>
            Faça login para ver os prazos fiscais da sua empresa
          </p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {[
              {dia:'Dia 10',label:'DCTF Web',desc:'Declaração de Débitos e Créditos Tributários Federais',badge:'Próximo',bc:'#EFF6FF',bcc:'#1D4ED8'},
              {dia:'Dia 15',label:'GFIP',desc:'Guia de Recolhimento do FGTS e Informações à Previdência Social',badge:'Atenção',bc:'#FEF3C7',bcc:'#92400E'},
              {dia:'Dia 20',label:'EFD ICMS/IPI',desc:'Escrituração Fiscal Digital do ICMS e do IPI',badge:'Agendado',bc:'#F0FDF4',bcc:'#15803D'},
              {dia:'Dia 25',label:'EFD-Contribuições',desc:'Escrituração Fiscal Digital do PIS e da COFINS',badge:'Pendente',bc:'#FEF2F2',bcc:'#DC2626'},
            ].map(o=>(
              <div key={o.label} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',
                padding:'10px 14px',borderRadius:8,background:'#F9FAFB',border:'0.5px solid #E5E7EB'}}>
                <div>
                  <div style={{fontSize:11,color:'#9CA3AF',fontWeight:600}}>{o.dia}</div>
                  <div style={{fontSize:13,fontWeight:700,color:'#111'}}>{o.label}</div>
                  <div style={{fontSize:11,color:'#6B7280'}}>{o.desc}</div>
                </div>
                <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,fontWeight:600,
                  background:o.bc,color:o.bcc,whiteSpace:'nowrap'}}>{o.badge}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Modulos */}
        <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',padding:24,marginBottom:32}}>
          <div style={{fontWeight:700,fontSize:16,color:'#111',marginBottom:16}}>Módulos disponíveis</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
            {modules.map(m=>(
              <div key={m.label} style={{padding:'12px 16px',borderRadius:8,
                background:'#F9FAFB',border:'0.5px solid #E5E7EB'}}>
                <div style={{fontWeight:600,fontSize:13,color:'#374151'}}>{m.label}</div>
                <div style={{fontSize:12,color:'#9CA3AF',marginTop:2}}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{textAlign:'center',fontSize:12,color:'#9CA3AF',paddingBottom:24}}>
          LEDGR — Gestão Empresarial Inteligente · Versão 2026
        </div>
      </div>
    </div>
  );
};
