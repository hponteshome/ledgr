import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

export const SKIP_COMPANY_KEY = 'skipCompanyCheck';

/**
 * Decorator para rotas que não exigem x-company-id.
 * Uso: @SkipCompanyCheck() antes do método ou controller.
 */
export const SkipCompanyCheck = () =>
  Reflect.metadata(SKIP_COMPANY_KEY, true);

@Injectable()
export class CompanyInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // ── 1. Bypass por decorator (@SkipCompanyCheck) ─────────────────────────
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_COMPANY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return next.handle();

    // ── 2. Bypass por URL (whitelist de rotas públicas) ──────────────────────
    const url: string = request.url ?? '';
    const isPublicRoute =
      url.includes('/auth/') ||
      url.includes('/companies/available') ||
      url.includes('/companies/headquarters');

    if (isPublicRoute) return next.handle();

    // ── 3. Bypass para Master Admin (vê e opera todas as empresas) ───────────
    const user = request.user;
    const isMasterAdmin = user?.profile?.isMasterAdmin === true;

    const companyId: string | undefined = request.headers['x-company-id'];

    if (isMasterAdmin) {
      // Master não precisa de company ativa — injeta somente se enviado
      if (companyId) request.companyId = companyId;
      return next.handle();
    }

    // ── 4. Validação normal: header obrigatório para demais usuários ─────────
    if (!companyId) {
      throw new BadRequestException(
        'O header x-company-id é obrigatório para acessar este recurso.',
      );
    }

    request.companyId = companyId;
    return next.handle();
  }
}