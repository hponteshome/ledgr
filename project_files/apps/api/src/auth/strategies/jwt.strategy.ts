import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() { 
  super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'secretKey',
    });
  }

  async validate(payload: any) {
    // IMPORTANTE: O que você retorna aqui se torna o 'req.user' no NestJS.
    // Vamos padronizar com os nomes que o seu Schema Prisma e o Seed usam.
    return {
      id: payload.sub,
      email: payload.email,
      fullName: payload.name, // Mapeado de 'name' no payload do token
      profileId: payload.profileId,
      };
  }
}