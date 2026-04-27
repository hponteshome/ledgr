import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // ← IMPORTAR

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {  // ← INJETAR PRISMA
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'secretKey',
    });
  }

  async validate(payload: any) {
    // Buscar o usuário completo no banco com o perfil
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        profile: true  // ← INCLUIR O PERFIL!
      }
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    console.log('🔍 [JwtStrategy] Usuário encontrado:', {
      id: user.id,
      email: user.email,
      profileId: user.profile?.id,
      profileName: user.profile?.name,
      permissions: user.profile?.permissions
    });

    // Retornar o usuário COMPLETO com o perfil
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      profile: user.profile  // ← AGORA É O OBJETO COMPLETO!
    };
  }
}