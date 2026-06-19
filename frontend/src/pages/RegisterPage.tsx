import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

export const RegisterPage: React.FC = () => {
  const nav = useNavigate();
  const [form, setForm] = useState({document:'',fullName:'',email:'',phone:'',password:'',confirm:''});
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  const fmtCPF = (v:string) => v.replace(/\D/g,'').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4');

  const submit = async(e:React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (form.password !== form.confirm) { setError('Senhas não conferem.'); return; }
    if (form.password.length < 6) { setError('Senha deve ter ao menos 6 caracteres.'); return; }
    setLoading(true);
    try {
      const r = await api.post('/auth/register', {
        document: form.document.replace(/\D/g,''),
        fullName: form.fullName,
        email:    form.email,
        phone:    form.phone,
        password: form.password,
      });
      setSuccess(r.data.message || 'Cadastro enviado! Aguarde aprovação do administrador.');
      setTimeout(() => nav('/login'), 4000);
    } catch(e:any) {
      setError(e?.response?.data?.message || 'Erro ao cadastrar. Tente novamente.');
    } finally { setLoading(false); }
  };

  const inp = {width:'100%',border:'1px solid #E5E7EB',borderRadius:8,padding:'10px 14px',
    fontSize:14,outline:'none',boxSizing:'border-box' as const};
  const lbl = {fontSize:12,fontWeight:600 as const,color:'#374151',display:'block' as const,marginBottom:4};

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
      display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:440,
        padding:36,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{fontSize:28,fontWeight:800,color:'#6C63FF',letterSpacing:'-1px'}}>LEDGR</div>
          <div style={{fontSize:14,color:'#6B7280',marginTop:4}}>Criar nova conta</div>
        </div>
        {success ? (
          <div style={{background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:10,
            padding:20,textAlign:'center'}}>
            <div style={{fontSize:32,marginBottom:8}}>✅</div>
            <div style={{fontSize:14,color:'#15803D',fontWeight:600}}>{success}</div>
            <div style={{fontSize:12,color:'#6B7280',marginTop:8}}>Redirecionando para login...</div>
          </div>
        ) : (
          <form onSubmit={submit}>
            {error && <div style={{background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:8,
              padding:'10px 14px',fontSize:13,color:'#DC2626',marginBottom:16}}>{error}</div>}
            <div style={{display:'grid',gap:14}}>
              <div><label style={lbl}>CPF *</label>
                <input value={fmtCPF(form.document)} onChange={e=>setForm(f=>({...f,document:e.target.value}))}
                  placeholder="000.000.000-00" maxLength={14} required style={inp}/></div>
              <div><label style={lbl}>Nome Completo *</label>
                <input value={form.fullName} onChange={e=>setForm(f=>({...f,fullName:e.target.value}))}
                  placeholder="Seu nome completo" required minLength={3} style={inp}/></div>
              <div><label style={lbl}>E-mail *</label>
                <input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}
                  placeholder="seu@email.com" required style={inp}/></div>
              <div><label style={lbl}>Telefone</label>
                <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}
                  placeholder="(00) 00000-0000" style={inp}/></div>
              <div><label style={lbl}>Senha *</label>
                <input type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))}
                  placeholder="Mínimo 6 caracteres" required style={inp}/></div>
              <div><label style={lbl}>Confirmar Senha *</label>
                <input type="password" value={form.confirm} onChange={e=>setForm(f=>({...f,confirm:e.target.value}))}
                  placeholder="Repita a senha" required style={inp}/></div>
            </div>
            <button type="submit" disabled={loading}
              style={{width:'100%',marginTop:20,padding:'12px',borderRadius:10,border:'none',
                background:'#6C63FF',color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',
                opacity:loading?0.7:1}}>
              {loading ? 'Enviando...' : 'Solicitar Cadastro'}
            </button>
            <div style={{textAlign:'center',marginTop:16,fontSize:13,color:'#6B7280'}}>
              Já tem conta? <Link to="/login" style={{color:'#6C63FF',fontWeight:600}}>Entrar</Link>
            </div>
          </form>
        )}
        <div style={{marginTop:20,padding:'12px 14px',background:'#F9FAFB',borderRadius:8,fontSize:11,color:'#9CA3AF'}}>
          ℹ️ Seu cadastro será analisado por um administrador. Após aprovação você receberá acesso ao sistema.
        </div>
      </div>
    </div>
  );
};
