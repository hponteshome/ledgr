// apps/api/src/core/documents/document-scope.interceptor.ts
// Seguranca 0A (02/10/2026): escopo de empresa nas rotas /documents/:id
//  - documento de outra empresa, excluido ou inexistente: 404
//  - template global (sem empresa): leitura liberada, alteracao so Master
//  - :signerId precisa pertencer ao documento da rota (vale tambem para o Master)
//  - Master Admin: sem checagem de empresa (comportamento inalterado)
// Roda depois do CompanyInterceptor global (request.companyId ja validado)
// e antes do FileInterceptor da rota (upload so ocorre se o escopo for valido).
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Observable, from, switchMap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { isMasterAdmin } from '../../multi-company/company.interceptor';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const METODOS_LEITURA = new Set(['GET', 'HEAD']);

@Injectable()
export class DocumentScopeInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return from(this.validar(context)).pipe(switchMap(() => next.handle()));
  }

  private async validar(context: ExecutionContext): Promise<void> {
    const request = context.switchToHttp().getRequest();
    const id: string | undefined = request.params?.id;
    if (!id) return; // rotas sem :id: tratadas no controller (empresaEfetiva)

    if (!isMasterAdmin(request.user)) {
      if (!UUID_RE.test(id)) {
        throw new NotFoundException('Documento nao encontrado.');
      }
      const doc = await this.prisma.document.findUnique({
        where: { id },
        select: { companyId: true, isTemplate: true, deletedAt: true },
      });
      if (!doc || doc.deletedAt) {
        throw new NotFoundException('Documento nao encontrado.');
      }
      if (doc.isTemplate || !doc.companyId) {
        if (!METODOS_LEITURA.has(request.method)) {
          throw new ForbiddenException('Templates globais so podem ser alterados pelo administrador.');
        }
      } else if (!request.companyId || doc.companyId !== request.companyId) {
        throw new NotFoundException('Documento nao encontrado.');
      }
    }

    const signerId: string | undefined = request.params?.signerId;
    if (signerId) {
      if (!UUID_RE.test(signerId)) {
        throw new NotFoundException('Signatario nao encontrado.');
      }
      const signer = await this.prisma.documentSigner.findFirst({
        where: { id: signerId, documentId: id },
        select: { id: true },
      });
      if (!signer) {
        throw new NotFoundException('Signatario nao encontrado.');
      }
    }
  }
}
