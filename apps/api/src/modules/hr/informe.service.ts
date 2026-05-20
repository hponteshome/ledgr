// apps/api/src/modules/hr/informe.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InformeService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string, ano?: number) {
    return this.prisma.informeRendimentos.findMany({
      where: { companyId, ...(ano ? { anoCalendario: ano } : {}) },
      include: { person: { select: { id: true, fullName: true, cpf: true, street: true, number: true, complement: true, neighborhood: true, city: true, state: true, zipCode: true } } },
      orderBy: [{ anoCalendario: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string, companyId: string) {
    const inf = await this.prisma.informeRendimentos.findFirst({
      where: { id, companyId },
      include: {
        person:  { select: { id: true, fullName: true, cpf: true, street: true, number: true, complement: true, neighborhood: true, city: true, state: true, zipCode: true } },
        company: { select: { id: true, legalName: true, taxId: true, street: true, number: true, complement: true, neighborhood: true, city: true, state: true, zipCode: true } },
      },
    });
    if (!inf) throw new NotFoundException('Informe nao encontrado.');
    return inf;
  }

  async upsert(companyId: string, createdById: string, dto: any) {
    const { personId, anoCalendario, ...data } = dto;
    const clean: any = Object.fromEntries(Object.entries(data).map(([k,v]) => [k, v === '' ? null : v]));
    return this.prisma.informeRendimentos.upsert({
      where: { companyId_personId_anoCalendario: { companyId, personId, anoCalendario } },
      create: { companyId, personId, anoCalendario, createdById, ...clean },
      update: { ...clean },
    });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.informeRendimentos.delete({ where: { id } });
  }
}