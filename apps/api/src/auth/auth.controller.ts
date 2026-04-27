// apps/api/src/auth/auth.controller.ts

import {
  Controller,
  Post,
  Get,
  UseGuards,
  Request,
  UnauthorizedException,
  Param,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local.guard';
import { JwtAuthGuard } from './guards/jwt.guard';
import { SkipCompanyCheck } from '../multi-company/company.interceptor';

// ─────────────────────────────────────────────────────────────────────────────
// PROBLEMAS CORRIGIDOS:
//  1. PrismaService removido — rotas de profiles movidas para ProfilesController
//  2. @SkipCompanyCheck() na classe inteira — auth nunca exige empresa ativa
//  3. @Get('debug-user') protegido com JwtAuthGuard
//  4. Rotas provisórias de profiles REMOVIDAS (existem agora em ProfilesController)
// ─────────────────────────────────────────────────────────────────────────────

@Controller('auth')
@SkipCompanyCheck() // Auth nunca exige empresa ativa
export class AuthController {

  constructor(private readonly authService: AuthService) {}

  @Get('test')
  test() {
    return { ok: true, message: 'Auth service is operational.' };
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: any) {
    const user = req.user?.user || req.user;
    if (!user) throw new UnauthorizedException('Usuário não encontrado no contexto da requisição.');
    return this.authService.login(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: any) {
    const user = req.user;
    return {
      id:       user.id,
      email:    user.email,
      fullName: user.fullName,
      profile:  user.profile ?? { id: null, permissions: {} },
    };
  }

  @UseGuards(JwtAuthGuard) // Protegido — não expor sem autenticação
  @Get('debug-user/:email')
  async debugUser(@Param('email') email: string) {
    return this.authService.debugUser(email);
  }
}