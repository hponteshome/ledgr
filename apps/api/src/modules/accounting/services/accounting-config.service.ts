import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AccountingConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(companyId: string) {
    return this.prisma.companyAccountingConfig.findUnique({
      where: { companyId },
    });
  }

  async upsertConfig(companyId: string, createdById: string, dto: any) {
    const config = await this.prisma.companyAccountingConfig.upsert({
      where: { companyId },
      create: { companyId, createdById, ...dto },
      update: { ...dto },
    });

    // Sincroniza automaticamente o vinculo real (person_companies) a partir do CPF do
    // contador informado nesta tela - decisao do usuario (03/08/2026), para nao exigir
    // cadastro duplicado (aba Contabil + PersonForm/Vinculos) do mesmo dado. So atua se
    // a Person ja existir pelo CPF - nunca inventa cadastro novo aqui (mesmo principio do
    // QsaVinculoGrid.tsx para socios). role sempre gravado em minusculo ('contador'),
    // consistente com a comparacao case-insensitive do ecd-pre-validate.service.ts.
    // Validado end-to-end em 04/08/2026 (GRB + Pontes, ambas com vinculo real criado).
    if (dto.accountantCpf) {
      const cpfDigits = String(dto.accountantCpf).replace(/\D/g, '');
      if (cpfDigits.length === 11) {
        const person = await this.prisma.person.findFirst({
          where: { cpf: cpfDigits, deletedAt: null },
        });
        if (person) {
          const existingLink = await this.prisma.personCompany.findFirst({
            where: { companyId, personId: person.id, role: { equals: 'contador', mode: 'insensitive' } },
          });
          if (existingLink) {
            await this.prisma.personCompany.update({
              where: { id: existingLink.id },
              data: { assinaEcd: true, assinaEcf: true },
            });
          } else {
            await this.prisma.personCompany.create({
              data: {
                companyId,
                personId: person.id,
                role: 'contador',
                startDate: new Date(),
                assinaEcd: true,
                assinaEcf: true,
              },
            });
          }
        }
      }
    }

    return config;
  }
}
