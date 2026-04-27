import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

console.log('📦 ARQUIVO LOCAL STRATEGY SENDO CARREGADO');

@Injectable()
// O segundo parâmetro 'local' é a chave que o AuthGuard('local') procura
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private authService: AuthService) {
    console.log('🔴 LOCAL STRATEGY: CONSTRUTOR EXECUTANDO');
    
    // Configuração explícita para bater com o que o Frontend (Vite) envia
    super({ 
      usernameField: 'email', 
      passwordField: 'password' 
    });

    console.log('✅ LOCAL STRATEGY: CONSTRUTOR FINALIZADO (Registrada como "local")');
  }

  async validate(email: string, password: string): Promise<any> {
    console.log(`📍 LOCAL STRATEGY: VALIDATE CHAMADO PARA: ${email}`);
    
    // Chama a validação no AuthService que você está debugando
    const user = await this.authService.validateUser(email, password);
    
    if (!user) {
      console.log('❌ LOCAL STRATEGY: Usuário não encontrado ou senha inválida');
      throw new UnauthorizedException();
    }

    console.log('✔️ LOCAL STRATEGY: Validação bem-sucedida');
    return user;
  }
}