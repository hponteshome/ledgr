// Linha 1 do auth.service.ts — ANTES de qualquer import
console.log('🔴🔴🔴 AUTH SERVICE CARREGANDO 🔴🔴🔴');

import { Injectable, UnauthorizedException, Logger, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../core/users/users.service'; 
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService, 
    private readonly jwtService: JwtService,
  ) {
    console.log('🔴🔴🔴 AUTH SERVICE CONSTRUTOR EXECUTANDO 🔴🔴🔴');
    console.log('🔴 usersService disponível:', !!usersService);
    console.log('🔴 jwtService disponível:', !!jwtService);
  }

  async validateUser(login: string, pass: string): Promise<any> {
    // Usamos o usersService que já tem o Prisma configurado no monólito
    const user = await this.usersService.findByLogin(login);
    
    if (!user) {
      console.log('❌ Usuário não encontrado para o login:', login);
      return null;
    }
    
    console.log('✅ Usuário encontrado:', user.email);
    console.log('📦 Campos do usuário:', Object.keys(user));
    console.log('🔐 passwordHash presente?', !!user.passwordHash);
    
    // Validação usando 'passwordHash' do Schema
    const isPasswordValid = await bcrypt.compare(pass, user.passwordHash);
    console.log('   Senha válida?', isPasswordValid);

    if (!isPasswordValid) {
      console.log('❌ Senha inválida para o usuário:', user.email);
      return null;
    }
    
    console.log('✅ Autenticação bem sucedida para:', user.email);
    return user;
  }

  async login(user: any) {
    if (!user) {
      console.error('❌ ERRO: usuário é undefined ou null');
      throw new UnauthorizedException('Usuário inválido');
    }
  
    if (!user.email) {
      console.error('❌ ERRO: usuário não tem email. Campos disponíveis:', Object.keys(user));
      throw new UnauthorizedException('Email não encontrado no usuário');
    }
      
    console.log(`🔑 Gerando token para: ${user.email}`);
    
    const payload = { 
      sub: user.id, 
      email: user.email,
      name: user.fullName, 
      profileId: user.profileId || null, 
      permissions: user.profile?.permissions || {}
    };
    
    const token = this.jwtService.sign(payload);
    
    return {
      access_token: token,
      user: { 
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        profileId: user.profileId || null, 
        permissions: user.profile?.permissions || {} 
      },
    };
  }

  async register(data: RegisterDto) {
    console.log('📝 Registro de novo usuário:', data.email);
     
    const existingUser = await this.usersService.findByLogin(data.email);
    if (existingUser) {
      throw new UnauthorizedException('Email already registered');
    }
    
    const user = await this.usersService.create(data);
    return this.login(user);
  }

  // 🔍 MÉTODO DEBUG ADICIONADO
  async debugUser(email: string) {
    console.log('🔍 DEBUG: Buscando usuário:', email);
    const user = await this.usersService.findByLogin(email);
    
    if (!user) {
      console.log('❌ Usuário não encontrado');
      return { encontrado: false };
    }
    
    console.log('✅ Usuário encontrado:', user.email);
    console.log('📦 Campos disponíveis:', Object.keys(user));
    console.log('🔐 Campo passwordHash:', user.passwordHash ? 'presente' : 'ausente');
    
    // Tenta comparar com a senha '123456'
    const senhaTeste = '123456';
    try {
      const isValid = await bcrypt.compare(senhaTeste, user.passwordHash);
      console.log('🔐 Comparação com 123456:', isValid);
      
      return {
        encontrado: true,
        email: user.email,
        hash: user.passwordHash ? user.passwordHash.substring(0, 20) + '...' : null,
        comparacao: isValid,
        mensagem: isValid ? 'Senha OK' : 'Senha incorreta'
      };
    } catch (error) {
      console.log('❌ Erro na comparação:', error.message);
      return {
        encontrado: true,
        email: user.email,
        erro: error.message
      };
    }
  }
}