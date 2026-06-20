import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NfeParserService, NfeParsed } from './nfe-parser.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class NfeImportService {
  constructor(private prisma: PrismaService, private parser: NfeParserService) {}

  async preview(files: Express.Multer.File[], companyId: string) {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const items: (NfeParsed & { duplicate: boolean })[] = [];
    for (const file of files) {
      const notas = this.parser.parseXml(file.buffer.toString('utf-8'), company.taxId ?? '');
      for (const n of notas) {
        const dup = await this.prisma.fiscalDocument.findFirst({
          where: { companyId, accessKey: n.chave || undefined, documentNumber: n.numero },
        });
        items.push({ ...n, duplicate: !!dup });
      }
    }
    return { total: items.length, items, company: { cnpj: company.taxId, name: company.legalName } };
  }

  async importar(files: Express.Multer.File[], companyId: string, userId: string) {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const created: string[] = [], skipped: string[] = [], errors: string[] = [];

    for (const file of files) {
      const notas = this.parser.parseXml(file.buffer.toString('utf-8'), company.taxId ?? '');
      for (const n of notas) {
        try {
          const dup = await this.prisma.fiscalDocument.findFirst({
            where: { companyId, accessKey: n.chave || undefined },
          });
          if (dup) { skipped.push(n.numero); continue; }

          const issuerCnpj = n.mode === 'ENTRADA' ? n.emitenteCnpj : n.destinCnpj;
          const issuerName = n.mode === 'ENTRADA' ? n.emitenteNome : n.destinNome;
          const net = n.valorNF - n.valorDesconto;

          await this.prisma.fiscalDocument.create({
            data: {
              companyId,
              documentType:    'NFE',
              documentNumber:  n.numero,
              accessKey:       n.chave ? (n.chave + '0'.repeat(44)).slice(0,44) : undefined,
              issuerCnpj, issuerName,
              issueDate:       new Date(n.dataEmissao + 'T12:00:00Z'),
              dueDate:         new Date(n.dataEmissao + 'T12:00:00Z'),
              competenceMonth: n.competencia,
              grossAmount:     new Decimal(n.valorNF),
              discountAmount:  new Decimal(n.valorDesconto),
              netAmount:       new Decimal(net),
              pisAmount:       new Decimal(n.valorPis),
              cofinsAmount:    new Decimal(n.valorCofins),
              integrationStatus: 'PENDING',
              status:          'RASCUNHO',
              notes: `Modo: ${n.mode} | Nat.Op: ${n.natOp} | ICMS: ${n.valorIcms} | IPI: ${n.valorIpi}`,
              createdById: userId,
            },
          });
          created.push(n.numero);
        } catch(e:any) { errors.push(`NF-e ${n.numero}: ${e.message}`); }
      }
    }
    return { created: created.length, skipped: skipped.length, errors };
  }
}
