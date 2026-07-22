import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiUser, FiMail, FiLock, FiPhone, FiFileText, FiArrowRight, FiCheckCircle, FiAtSign } from 'react-icons/fi';
import api from '../../services/api';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({document:'',fullName:'',nickname:'',email:'',phone:'',password:'',confirm:''});
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  const fmtCPF = (v:string) => {
    const d = v.replace(/\D/g,'').slice(0,11);
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4')
            .replace(/(\d{3})(\d{3})(\d{3})/,'$1.$2.$3')
            .replace(/(\d{3})(\d{3})/,'$1.$2');
  };

  const submit = async(e:React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Senhas não conferem.'); return; }
    if (form.password.length < 6) { setError('Senha mínima: 6 caracteres.'); return; }
    const cpf = form.document.replace(/\D/g,'');
    if (cpf.length !== 11) { setError('CPF inválido.'); return; }
    setLoading(true);
    try {
      const r = await api.post('/auth/register', {
        document: cpf, fullName: form.fullName, nickname: form.nickname,
        email: form.email, phone: form.phone, password: form.password,
      });
      setSuccess(r.data.message || 'Cadastro enviado! Aguarde aprovação do administrador.');
      setTimeout(() => navigate('/'), 4000);
    } catch(e:any) {
      setError(e?.response?.data?.message || 'Erro ao cadastrar. Tente novamente.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
      display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:460,
        padding:40,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>

        {/* Logo */}
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{fontSize:30,fontWeight:900,color:'#6C63FF',letterSpacing:'-1px'}}>LEDGR</div>
          <div style={{fontSize:14,color:'#6B7280',marginTop:4}}>Solicitar acesso ao sistema</div>
        </div>

        {success ? (
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <FiCheckCircle size={48} color="#15803D" style={{margin:'0 auto 12px'}}/>
            <div style={{fontSize:15,fontWeight:600,color:'#15803D',marginBottom:8}}>{success}</div>
            <div style={{fontSize:13,color:'#6B7280'}}>Redirecionando...</div>
          </div>
        ) : (
          <form onSubmit={submit}>
            {error && (
              <div style={{background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:8,
                padding:'10px 14px',fontSize:13,color:'#DC2626',marginBottom:16}}>
                {error}
              </div>
            )}
            <div style={{display:'grid',gap:14}}>
              {[
                {icon:<FiFileText/>,label:'CPF *',field:'document',placeholder:'000.000.000-00',
                  value:fmtCPF(form.document),maxLen:14},
                {icon:<FiUser/>,label:'Nome Completo *',field:'fullName',
                  placeholder:'Seu nome completo'},
                {icon:<FiAtSign/>,label:'Nickname (usuario de login) *',field:'nickname',
                  placeholder:'Como voce quer logar, ex: joaosilva'},
                {icon:<FiMail/>,label:'E-mail *',field:'email',type:'email',
                  placeholder:'seu@email.com'},
                {icon:<FiPhone/>,label:'Telefone',field:'phone',
                  placeholder:'(00) 00000-0000'},
                {icon:<FiLock/>,label:'Senha *',field:'password',type:'password',
                  placeholder:'Mínimo 6 caracteres'},
                {icon:<FiLock/>,label:'Confirmar Senha *',field:'confirm',type:'password',
                  placeholder:'Repita a senha'},
              ].map(f=>(
                <div key={f.field}>
                  <label style={{fontSize:12,fontWeight:600,color:'#374151',
                    display:'block',marginBottom:4}}>{f.label}</label>
                  <div style={{position:'relative'}}>
                    <span style={{position:'absolute',left:12,top:'50%',
                      transform:'translateY(-50%)',color:'#9CA3AF',fontSize:14}}>
                      {f.icon}
                    </span>
                    <input
                      type={(f as any).type||'text'}
                      value={(f as any).value ?? (form as any)[f.field]}
                      maxLength={(f as any).maxLen}
                      onChange={e=>setForm(prev=>({...prev,[f.field]:
                        f.field==='document'?e.target.value.replace(/\D/g,''):e.target.value}))}
                      placeholder={f.placeholder}
                      required={f.label.includes('*')}
                      style={{width:'100%',border:'1px solid #E5E7EB',borderRadius:8,
                        padding:'10px 14px 10px 36px',fontSize:14,outline:'none',
                        boxSizing:'border-box'}}
                    />
                  </div>
                </div>
              ))}
            </div>

            <button type="submit" disabled={loading}
              style={{width:'100%',marginTop:20,padding:'12px',borderRadius:10,border:'none',
                background:'linear-gradient(135deg,#667eea,#764ba2)',color:'#fff',
                fontSize:15,fontWeight:700,cursor:'pointer',opacity:loading?0.7:1,
                display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              {loading ? 'Enviando...' : <><span>Solicitar Cadastro</span><FiArrowRight/></>}
            </button>

            <div style={{textAlign:'center',marginTop:16,fontSize:13,color:'#6B7280'}}>
              Já tem conta?{' '}
              <Link to="/" style={{color:'#6C63FF',fontWeight:600,textDecoration:'none'}}>
                Fazer login
              </Link>
            </div>
          </form>
        )}

        <div style={{marginTop:20,padding:'12px 14px',background:'#F9FAFB',borderRadius:8,
          fontSize:11,color:'#9CA3AF',lineHeight:1.5}}>
          ℹ️ Seu cadastro será analisado por um administrador. Você será notificado quando aprovado.
          O CPF será comparado com a base de Pessoas Físicas cadastradas no sistema.
        </div>
      </div>
    </div>
  );
};
