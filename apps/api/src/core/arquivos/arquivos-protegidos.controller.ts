// apps/api/src/core/arquivos/arquivos-protegidos.controller.ts
// Seguranca 0A (04/10/2026): a pasta uploads era servida publicamente (useStaticAssets em /uploads, sem login).
// Agora so /uploads/logos e publico; todo o resto passa por esta rota, que:
//  - exige login (JwtAuthGuard);
//  - descobre a EMPRESA DONA do arquivo pelo endereco registrado no banco (documents, document_signatures,
//    corporate_books, fiscal_documents, ap_entries, ar_entries); arquivo sem registro = 404;
//  - entrega so a quem tem vinculo com a empresa (UserCompany) ou ao Master; documento sem empresa (modelo global) = autenticado;
//  - bloqueia sair da pasta (..) e registra o acesso no AuditLog.
import { Controller, Get, Req, Res, UseGuards, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { SkipCompanyCheck, isMasterAdmin } from '../../multi-company/company.interceptor';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
@SkipCompanyCheck()
export class ArquivosProtegidosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('*')
  async servir(@Req() req: any, @Res() res: Response) {
    const negar = () => new NotFoundException('Arquivo nao encontrado.');
    let url: string;
    try { url = decodeURIComponent(String(req.path || '')); } catch { throw negar(); }
    const rel = url.replace(/^\/uploads\//, '');
    if (!rel || rel === url || rel.includes('..') || rel.includes('\\') || rel.includes('\0') || rel.startsWith('/')) throw negar();
    const base = path.resolve(process.cwd(), 'uploads');
    const caminho = path.resolve(base, rel);
    if (!caminho.startsWith(base + path.sep)) throw negar();

    const donos = await this.prisma.$queryRaw<{ company_id: string | null }[]>`
      SELECT company_id::text AS company_id FROM documents WHERE file_url = ${url} OR pdf_url = ${url}
      UNION ALL SELECT d.company_id::text FROM document_signatures s JOIN documents d ON d.id = s.document_id WHERE s.evidence_url = ${url}
      UNION ALL SELECT company_id::text FROM corporate_books WHERE content_url = ${url}
      UNION ALL SELECT company_id::text FROM fiscal_documents WHERE attachment_url = ${url}
      UNION ALL SELECT company_id::text FROM ap_entries WHERE attachment_url = ${url}
      UNION ALL SELECT company_id::text FROM ar_entries WHERE attachment_url = ${url}
      LIMIT 1`;
    if (!donos.length) throw negar();
    const companyId = donos[0].company_id;
    if (companyId && !isMasterAdmin(req.user)) {
      const vinculo = await this.prisma.userCompany.findFirst({ where: { userId: req.user.id, companyId }, select: { userId: true } });
      if (!vinculo) throw negar();
    }
    if (!fs.existsSync(caminho)) throw negar();
    await this.prisma.auditLog.create({ data: { actorId: req.user.id, action: 'ARQUIVO_ACESSADO', targetId: companyId ?? 'global', after: { arquivo: url } } });
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(caminho);
  }
}
