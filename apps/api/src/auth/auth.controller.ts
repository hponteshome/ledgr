// apps/api/src/auth/auth.controller.ts

import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  UnauthorizedException,
  Param, HttpCode,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local.guard';
import { JwtAuthGuard } from './guards/jwt.guard';
import { SkipCompanyCheck } from '../multi-company/company.interceptor';
import { TwoFactorService } from './two-factor/two-factor.service';
import { MasterOnlyGuard } from './guards/master-only.guard';

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

  constructor(private readonly authService: AuthService, private readonly twoFactor: TwoFactorService) {}

  @Get('test')
  test() {
    return { ok: true, message: 'Auth service is operational.' };
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: any) {
    const user = req.user?.user || req.user;
    if (!user) throw new UnauthorizedException('Usuário não encontrado no contexto da requisição.');
    return this.twoFactor.avaliarLogin(user, req.body?.trustToken); // Seguranca 0A.6: 2FA
  }

  @Post('request-unlock')
  async requestUnlock(@Body() body: { email: string; message: string }) {
    return this.authService.requestUnlock(body.email, body.message);
  }
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }
  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; password: string }) {
    return this.authService.resetPassword(body.token, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: any) {
    const user = req.user;
    return {
      id:       user.id,
      email:    user.email,
      fullName: user.fullName,
      phone:    user.phone,
      level:    user.level,
      profile:  user.profile ?? { id: null, permissions: {} },
    };
  }

  @UseGuards(JwtAuthGuard) // Protegido — não expor sem autenticação
  @Get('debug-user/:email')
  async debugUser(@Param('email') email: string) {
    return this.authService.debugUser(email);
  }

  @Post('register')
  async register(@Body() body: any) {
    try {
      return await this.authService.register({
        document:     body.document,
        documentType: body.documentType,
        fullName:     body.fullName,
        email:        body.email,
        phone:        body.phone,
        level:        body.level,
        password:     body.password,
        nickname:     body.nickname,
      });
    } catch(e: any) {
      throw new (require('@nestjs/common').BadRequestException)(e.message);
    }
  }

  // -- Sessao (Seguranca 0A.6, 03/10/2026) -------------------------------------
  @Post('refresh')
  @HttpCode(200)
  renovarSessao(@Body() body: { refreshToken: string }) {
    return this.authService.renovarSessao(body?.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  encerrarSessao(@Body() body: { refreshToken: string }) {
    return this.authService.encerrarSessao(body?.refreshToken);
  }

  // -- 2FA (Seguranca 0A.6, 03/10/2026) --------------------------------------
  @Post('2fa/verify')
  verificar2fa(@Body() body: { challengeToken: string; code: string; trustDevice?: boolean }) {
    return this.twoFactor.verificarLogin(body?.challengeToken, body?.code, body?.trustDevice === true);
  }

  @Post('2fa/setup')
  setup2fa(@Body() body: { setupToken: string }) {
    return this.twoFactor.setupPreLogin(body?.setupToken);
  }

  @Post('2fa/activate')
  ativar2fa(@Body() body: { setupToken: string; code: string; trustDevice?: boolean }) {
    return this.twoFactor.ativarPreLogin(body?.setupToken, body?.code, body?.trustDevice === true);
  }

  @UseGuards(JwtAuthGuard)
  @Get('2fa/me')
  status2fa(@Request() req: any) {
    return this.twoFactor.status(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/me/setup')
  setupMe2fa(@Request() req: any) {
    return this.twoFactor.iniciarSetup(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/me/activate')
  async ativarMe2fa(@Request() req: any, @Body() body: { code: string }) {
    return { recoveryCodes: await this.twoFactor.ativar(req.user.id, body?.code) };
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/me/recovery-codes')
  async regenerar2fa(@Request() req: any, @Body() body: { code: string }) {
    return { recoveryCodes: await this.twoFactor.regenerarCodigos(req.user.id, body?.code) };
  }

  @UseGuards(JwtAuthGuard, MasterOnlyGuard)
  @Post('2fa/reset/:userId')
  resetar2fa(@Param('userId') userId: string, @Request() req: any) {
    return this.twoFactor.resetar(req.user.id, userId);
  }
}
