// apps/api/src/multi-company/escopo-empresa.guard.ts
// Seguranca 0A (04/10/2026): escopo pela empresa DO REGISTRO pedido (e nao so pela empresa ativa do cabecalho, que o
// CompanyInterceptor ja valida). A empresa vem de: parametro (:id, :companyId), corpo (companyId), vinculo pessoa-empresa
// (:linkId) ou documento (:documentId). Master passa; sem vinculo UserCompany = 404 (nao confirma existencia).
// Falha fechada: rota com o guard e sem @EscopoEmpresa e recusada.
import { CanActivate, ExecutionContext, Injectable, NotFoundException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { isMasterAdmin } from './company.interceptor';

export type FonteEmpresa = 'param:id' | 'param:companyId' | 'body:companyId' | 'vinculo:linkId' | 'documento:documentId' | 'regime:regimeId' | 'visao:id' | 'ecd:importId';
export const ESCOPO_EMPRESA_KEY = 'escopoEmpresa';
export const EscopoEmpresa = (fonte: FonteEmpresa) => SetMetadata(ESCOPO_EMPRESA_KEY, fonte);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class EscopoEmpresaGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const negar = () => new NotFoundException('Registro nao encontrado.');
    const fonte = this.reflector.get<FonteEmpresa>(ESCOPO_EMPRESA_KEY, ctx.getHandler());
    if (!fonte) throw negar();
    if (isMasterAdmin(req.user)) return true;
    const [tipo, campo] = fonte.split(':');
    const valor = String((tipo === 'body' ? req.body?.[campo] : req.params?.[campo]) ?? '');
    if (!UUID.test(valor)) throw negar();
    let companyId: string | null = null;
    if (tipo === 'param' || tipo === 'body') companyId = valor;
    else if (tipo === 'vinculo') companyId = (await this.prisma.personCompany.findUnique({ where: { id: valor }, select: { companyId: true } }))?.companyId ?? null;
    else if (tipo === 'documento') companyId = (await this.prisma.document.findUnique({ where: { id: valor }, select: { companyId: true } }))?.companyId ?? null;
    else if (tipo === 'regime') companyId = (await this.prisma.companyTaxRegime.findUnique({ where: { id: valor }, select: { companyId: true } }))?.companyId ?? null;
    else if (tipo === 'visao') companyId = (await this.prisma.accountingView.findUnique({ where: { id: valor }, select: { companyId: true } }))?.companyId ?? null;
    else if (tipo === 'ecd') companyId = (await this.prisma.ecdImport.findUnique({ where: { id: valor }, select: { companyId: true } }))?.companyId ?? null;
    if (!companyId || !req.user?.id) throw negar();
    const v = await this.prisma.userCompany.findFirst({ where: { userId: req.user.id, companyId }, select: { id: true } });
    if (!v) throw negar();
    return true;
  }
}
