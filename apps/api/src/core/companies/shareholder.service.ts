import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { CreateShareholderDto, UpdateShareholderDto } from './shareholder.dto';

@Injectable()
export class ShareholderService {
  constructor(private prisma: PrismaService) {}

  async findByCompany(companyId: string) {
    return this.prisma.companyShareholder.findMany({
      where: { companyId },
      include: {
        person: { select: { id: true, fullName: true, cpf: true } },
        shareholderCompany: { select: { id: true, legalName: true, tradeName: true, taxId: true } },
      },
      orderBy: { dataEntrada: 'asc' },
    });
  }

  async create(companyId: string, dto: CreateShareholderDto) {
    if (dto.shareholderType === 'PF' && !dto.personId)
      throw new BadRequestException('personId obrigatorio para PF');
    if (dto.shareholderType === 'PJ' && !dto.shareholderCompanyId)
      throw new BadRequestException('shareholderCompanyId obrigatorio para PJ');
    return this.prisma.companyShareholder.create({
      data: {
        companyId,
        shareholderType: dto.shareholderType,
        personId: dto.personId || null,
        shareholderCompanyId: dto.shareholderCompanyId || null,
        qualificacao: dto.qualificacao,
        dataEntrada: dto.dataEntrada ? new Date(dto.dataEntrada) : null,
        dataRetirada: dto.dataRetirada ? new Date(dto.dataRetirada) : null,
        participacaoPercent: dto.participacaoPercent ?? null,
        assinaEcd: dto.assinaEcd ?? false,
        assinaEcf: dto.assinaEcf ?? false,
        notes: dto.notes,
      },
      include: {
        person: { select: { id: true, fullName: true, cpf: true } },
        shareholderCompany: { select: { id: true, legalName: true, tradeName: true, taxId: true } },
      },
    });
  }

  async update(id: string, companyId: string, dto: UpdateShareholderDto) {
    const existing = await this.prisma.companyShareholder.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Socio nao encontrado');
    return this.prisma.companyShareholder.update({
      where: { id },
      data: {
        qualificacao: dto.qualificacao,
        dataEntrada: dto.dataEntrada ? new Date(dto.dataEntrada) : undefined,
        dataRetirada: dto.dataRetirada ? new Date(dto.dataRetirada) : undefined,
        participacaoPercent: dto.participacaoPercent ?? undefined,
        assinaEcd: dto.assinaEcd,
        assinaEcf: dto.assinaEcf,
        notes: dto.notes,
        updatedAt: new Date(),
      },
      include: {
        person: { select: { id: true, fullName: true, cpf: true } },
        shareholderCompany: { select: { id: true, legalName: true, tradeName: true, taxId: true } },
      },
    });
  }

  async remove(id: string, companyId: string) {
    const existing = await this.prisma.companyShareholder.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Socio nao encontrado');
    await this.prisma.companyShareholder.delete({ where: { id } });
    return { message: 'Removido com sucesso' };
  }

  async syncFromPartners(companyId: string, partners: any[]) {
    if (!partners?.length) return;
    for (const p of partners) {
      const cpfCnpj = (p.cpfCnpj || p.cpf_cnpj || '').replace(/\D/g, '');
      const isPJ = cpfCnpj.length === 14;
      const dataEntrada = p.dataEntrada || p.data_entrada
        ? new Date(p.dataEntrada || p.data_entrada) : null;

      if (isPJ) {
        // Busca empresa pelo CNPJ
        const shareholderCompany = await this.prisma.company.findFirst({
          where: { taxId: { contains: cpfCnpj } },
        });
        if (!shareholderCompany) continue;
        const exists = await this.prisma.companyShareholder.findFirst({
          where: { companyId, shareholderCompanyId: shareholderCompany.id },
        });
        if (!exists) {
          await this.prisma.companyShareholder.create({
            data: {
              companyId,
              shareholderType: 'PJ',
              shareholderCompanyId: shareholderCompany.id,
              qualificacao: p.qualificacao,
              dataEntrada,
              notes: 'Sincronizado via RFB',
            },
          });
        }
      } else if (cpfCnpj.length >= 4) {
        // Busca pessoa pelo CPF (pode estar mascarado)
        const persons = await this.prisma.person.findMany({
          where: { cpf: { contains: cpfCnpj } },
        });
        if (persons.length !== 1) continue;
        const exists = await this.prisma.companyShareholder.findFirst({
          where: { companyId, personId: persons[0].id },
        });
        if (!exists) {
          await this.prisma.companyShareholder.create({
            data: {
              companyId,
              shareholderType: 'PF',
              personId: persons[0].id,
              qualificacao: p.qualificacao,
              dataEntrada,
              notes: 'Sincronizado via RFB',
            },
          });
        }
      }
    }
  }
}
