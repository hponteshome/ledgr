import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NfseSpParserService, NfseParsed } from './nfse-sp-parser.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class NfseImportService {
  constructor(
    private prisma: PrismaService,
    private parser: NfseSpParserService,
  ) {}

  // ── Preview: parse sem salvar ──────────────────────────────────────────────
  async preview(files: Express.Multer.File[], companyId: string) {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const cnpj    = company.taxId ?? '';
    const items: (NfseParsed & { duplicate: boolean })[] = [];

    for (const file of files) {
      const xml   = file.buffer.toString('utf-8');
      const notas = this.parser.parseXml(xml, cnpj);
      for (const n of notas) {
        const dup = await this.prisma.fiscalDocument.findFirst({
          where: { companyId, documentNumber: n.numero,
            issuerCnpj: n.mode === 'TOMADOR' ? n.prestadorCnpj : n.tomadorCnpj },
        });
        items.push({ ...n, duplicate: !!dup });
      }
    }
    return { total: items.length, items, company: { id: company.id, cnpj, name: company.legalName } };
  }

  // ── Import: salva no banco ─────────────────────────────────────────────────
  async importar(files: Express.Multer.File[], companyId: string, userId: string, skipDuplicates = true) {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const cnpj    = company.taxId ?? '';
    const created: string[] = [], skipped: string[] = [], errors: string[] = [];

    for (const file of files) {
      const xml   = file.buffer.toString('utf-8');
      const notas = this.parser.parseXml(xml, cnpj);

      for (const n of notas) {
        try {
          const issuerCnpj = n.mode === 'TOMADOR' ? n.prestadorCnpj : n.tomadorCnpj;
          const issuerName = n.mode === 'TOMADOR' ? n.prestadorNome  : n.tomadorNome;

          // Deduplicacao
          const dup = await this.prisma.fiscalDocument.findFirst({
            where: { companyId, documentNumber: n.numero, issuerCnpj },
          });
          if (dup) { skipped.push(n.numero); continue; }

          const net = n.valorLiquido || (n.valorServicos - n.valorDeducoes - n.valorIss);

          await this.prisma.fiscalDocument.create({
            data: {
              companyId,
              documentType:      'NFSE',
              documentNumber:    n.numero,
              accessKey:         (n.codigoVerificacao + '0'.repeat(44)).slice(0, 44),
              issuerCnpj,
              issuerName,
              issueDate:         new Date(n.dataEmissao + 'T12:00:00Z'),
              dueDate:           new Date(n.dataEmissao + 'T12:00:00Z'),
              competenceMonth:   n.competencia,
              grossAmount:       new Decimal(n.valorServicos),
              discountAmount:    new Decimal(n.valorDeducoes),
              netAmount:         new Decimal(net),
              irAmount:          new Decimal(n.valorIr),
              pisAmount:         new Decimal(n.valorPis),
              cofinsAmount:      new Decimal(n.valorCofins),
              csllAmount:        new Decimal(n.valorCsll),
              issAmount:         new Decimal(n.valorIss),
              inssAmount:        new Decimal(n.valorInss),
              integrationStatus: 'PENDING',
              status:            'RASCUNHO',
              notes: [
                `Modo: ${n.mode}`,
                `ISS retido: ${n.issRetido ? 'Sim' : 'Não'}`,
                `Serviço: ${n.itemListaServico}`,
                n.discriminacao.slice(0, 200),
              ].join(' | '),
              createdById: userId,
            },
          });
          created.push(n.numero);
        } catch(e: any) {
          errors.push(`NFS-e ${n.numero}: ${e.message}`);
        }
      }
    }
    return { created: created.length, skipped: skipped.length, errors, createdList: created };
  }
}
