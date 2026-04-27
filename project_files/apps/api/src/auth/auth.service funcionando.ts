import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../core/users/users.service'; // Nome e caminho atualizados
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto'; // Nome atualizado

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService, // Injeção atualizada
    private jwtService: JwtService,
  ) {}

  /**
   * Valida as credenciais do usuário comparando com o Hash do banco
   */
  async validateUser(login: string, pass: string): Promise<any> {
    // Busca no banco usando o novo serviço em inglês
    const user = await this.usersService.findByLogin(login);
    
    if (!user) {
      return null;
    }
    
    // IMPORTANTE: 'senha_hash' agora é 'passwordHash' no seu novo Schema Prisma
    const isPasswordValid = await bcrypt.compare(pass, user.passwordHash);
    
    if (!isPasswordValid) {
      return null;
    }
    
    // Retornamos o usuário completo (incluindo o perfil para pegar as permissões no login)
    return user;
  }

  /**
   * Gera o token JWT com o payload necessário para o isolamento de dados
   */
  async login(user: any) {
    // Payload em inglês e com os campos necessários para o CompanyContext
    const payload = { 
      sub: user.id, 
      email: user.email,
      name: user.fullName,       // De 'nome' para 'fullName'
      profileId: user.profileId, // Essencial para permissões
      permissions: user.profile?.permissions || {} 
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: { // Retorno padronizado para o AuthContext.tsx
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        profileId: user.profileId,
        permissions: user.profile?.permissions || {}
      },
    };
  }

  /**
   * Registra um novo usuário e já realiza o login automático
   */
  async register(data: RegisterDto) {
    const existingUser = await this.usersService.findByLogin(data.email);
    
    if (existingUser) {
      throw new UnauthorizedException('Email already registered');
    }
    
    // Chama 'create' em vez de 'criar'
    const user = await this.usersService.create(data);
    
    this.logger.log(`New user registered: ${user.email}`);
    
    return this.login(user);
  }
}