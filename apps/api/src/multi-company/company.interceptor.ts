// apps/api/src/multi-company/company.interceptor.ts
// Seguranca 0A.2 (02/10/2026): x-company-id validado contra UserCompany no servidor.
//  - whitelist por request.path (sem query string)
//  - /companies/<uuid> exige vinculo com a empresa consultada
//  - rota que exige empresa sem usuario autenticado: recusada (fail closed)
//  - criterio unico de Master Admin: isMasterAdmin()
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, switchMap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

export const SKIP_COMPANY_KEY = 'skipCompanyCheck';

/**
 * Decorator para rotas que não exigem x-company-id.
 * Uso: @SkipCompanyCheck() antes do método ou controller.
 */
export const SkipCompanyCheck = () => SetMetadata(SKIP_COMPANY_KEY, true);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Criterio unico de Master Admin em todo o sistema. */
export function isMasterAdmin(user: any): boolean {
  return (user?.profile?.permissions as any)?.all === true;
}

@Injectable()
export class CompanyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return from(this.validar(context)).pipe(switchMap(() => next.handle()));
  }

  private async validar(context: ExecutionContext): Promise<void> {
    const request = context.switchToHttp().getRequest();

    // 1. Bypass por decorator (@SkipCompanyCheck)
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_COMPANY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return;

    // 2. Whitelist por PATH - request.path nao inclui query string
    const path: string = request.path ?? '';
    if (
      path.includes('/auth/') ||
      path.endsWith('/companies/available') ||
      path.endsWith('/companies/headquarters')
    ) {
      return;
    }

    // 3. Rota que exige empresa sem usuario autenticado: recusar
    const user = request.user;
    if (!user?.id) {
      throw new UnauthorizedException();
    }

    // 4. /companies/<uuid>: exige vinculo com a empresa consultada
    const rotaEmpresa = path.match(/\/companies\/([0-9a-f-]{36})$/i);
    if (rotaEmpresa) {
      await this.exigirVinculo(user, rotaEmpresa[1]);
      return;
    }

    const companyId: string | undefined = request.headers['x-company-id'];

    // 5. Master Admin: comportamento inalterado (injeta somente se enviado)
    if (isMasterAdmin(user)) {
      if (companyId) request.companyId = companyId;
      return;
    }

    // 6. Demais usuarios: header obrigatorio + vinculo em UserCompany
    if (!companyId) {
      throw new BadRequestException(
        'O header x-company-id é obrigatório para acessar este recurso.',
      );
    }
    await this.exigirVinculo(user, companyId);
    request.companyId = companyId;
  }

  private async exigirVinculo(user: any, companyId: string): Promise<void> {
    if (isMasterAdmin(user)) return;
    if (!UUID_RE.test(companyId)) {
      throw new NotFoundException('Empresa não encontrada.');
    }
    const vinculo = await this.prisma.userCompany.findFirst({
      where: { userId: user.id, companyId, company: { is: { deletedAt: null } } },
      select: { id: true },
    });
    if (!vinculo) {
      throw new NotFoundException('Empresa não encontrada.');
    }
  }
}
