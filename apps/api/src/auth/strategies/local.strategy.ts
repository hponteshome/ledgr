import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
// O segundo parâmetro 'local' é a chave que o AuthGuard('local') procura
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private authService: AuthService) {
    // Configuração explícita para bater com o que o Frontend (Vite) envia
    super({ 
      usernameField: 'email', 
      passwordField: 'password' 
    });
  }

  async validate(email: string, password: string): Promise<any> {
    // Chama a validação no AuthService
    const user = await this.authService.validateUser(email, password);
    
    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}