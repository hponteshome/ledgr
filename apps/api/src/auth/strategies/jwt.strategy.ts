import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // ← IMPORTAR

// Seguranca 0A (02/10/2026): sem fallback - a API nao sobe sem segredo forte
function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 64) {
    throw new Error('JWT_SECRET ausente ou fraco (minimo 64 caracteres). Configure o .env da API.');
  }
  return secret;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {  // ← INJETAR PRISMA
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: any) => (String(req?.headers?.accept || '').includes('text/event-stream') ? req?.query?.token || null : null), // Seguranca 0A.6: token na URL so para SSE
      ]),
      ignoreExpiration: false,
      secretOrKey: requireJwtSecret(),
    });
  }

  async validate(payload: any) {
    // Seguranca 0A (02/10/2026): token so vale para conta ativa e nao excluida
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { profile: true },
    });

    if (!user || user.deletedAt || !user.isActive || user.status !== 'active') {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      profile: user.profile,
    };
  }
}