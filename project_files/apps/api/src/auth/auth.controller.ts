import { Controller, Post, UseGuards, Request, Body, Get, UnauthorizedException, Param  } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto'; // Nome atualizado para inglês
import { JwtAuthGuard } from './guards/jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('test') // Antes: 'teste'
  test() {
    console.log('🧪 AuthController.test called!');
    return { ok: true, message: 'Auth service is operational' };
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')


  async login(@Request() req) {
    console.log('📝 AuthController.login - req.user:', req.user);
    console.log('📝 AuthController.login - req.user é undefined?', req.user === undefined);
  
    // O Passport coloca o usuário validado em req.user após o LocalStrategy
    const user = req.user?.user || req.user;
    
    if (!user) {
      throw new UnauthorizedException('User not found in request context');
    }
    
    // Chama o login do service que já retorna { access_token, user } em inglês
    return this.authService.login(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')

  async getProfile(@Request() req) {
    
    console.log('👤 [AUTH] /me called for:', req.currentUser?.email);

    // req.currentUser já vem do JwtStrategy com os dados completos
    return {
      id: req.currentUser.id,
      email: req.currentUser.email,
      fullName: req.currentUser.fullName,
      profile: req.currentUser.profileId || {
        id: null,
        permissions: {}
      }
    };
  }

// auth.controller.ts
@Get('debug-user/:email')
async debugUser(@Param('email') email: string) {
  console.log('🔍 Rota debug chamada para:', email);
  return this.authService.debugUser(email);
}

}