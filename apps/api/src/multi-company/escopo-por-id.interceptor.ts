// apps/api/src/multi-company/escopo-por-id.interceptor.ts
// Seguranca 0A (03/10/2026): escopo de empresa generico para rotas com :id.
// Uso (na classe do controller): @UseInterceptors(EscopoPorId('journalEntry'))
//   ou EscopoPorId('equityMethodInvestment', 'investorCompanyId') quando o campo tem outro nome.
//  - registro de outra empresa ou inexistente: 404
//  - registro global (campo de empresa nulo): leitura liberada, alteracao so Master
//  - Master Admin: sem checagem (comportamento inalterado)
//  - rotas sem :id (ou com outros parametros) nao sao afetadas
// Roda depois do CompanyInterceptor global (request.companyId ja validado contra UserCompany).
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  NotFoundException,
  ForbiddenException,
  Type,
  mixin,
} from '@nestjs/common';
import { Observable, from, switchMap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { isMasterAdmin } from './company.interceptor';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const METODOS_LEITURA = new Set(['GET', 'HEAD']);

export function EscopoPorId(modelo: string, campoEmpresa = 'companyId'): Type<NestInterceptor> {
  @Injectable()
  class EscopoPorIdInterceptor implements NestInterceptor {
    constructor(private readonly prisma: PrismaService) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
      return from(this.validar(context)).pipe(switchMap(() => next.handle()));
    }

    private async validar(context: ExecutionContext): Promise<void> {
      const request = context.switchToHttp().getRequest();
      const id: string | undefined = request.params?.id;
      if (!id || isMasterAdmin(request.user)) return;
      if (!UUID_RE.test(id)) throw new NotFoundException('Registro nao encontrado.');
      const registro = await (this.prisma as any)[modelo].findUnique({
        where: { id },
        select: { [campoEmpresa]: true },
      });
      if (!registro) throw new NotFoundException('Registro nao encontrado.');
      const dono = registro[campoEmpresa];
      if (dono === null || dono === undefined) {
        if (!METODOS_LEITURA.has(request.method)) {
          throw new ForbiddenException('Registros globais so podem ser alterados pelo administrador.');
        }
        return;
      }
      if (!request.companyId || dono !== request.companyId) {
        throw new NotFoundException('Registro nao encontrado.');
      }
    }
  }
  return mixin(EscopoPorIdInterceptor);
}
