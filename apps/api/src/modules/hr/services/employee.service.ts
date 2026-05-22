// apps/api/src/modules/hr/services/employee.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ParsedEmployee } from './employee-pdf-parser.service';

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  async importFromParsed(companyId: string, data: ParsedEmployee, userId: string) {
    if (!data.taxId) throw new BadRequestException('CPF ausente — nao foi possivel importar este funcionario.');
    if (!data.fullName) throw new BadRequestException('Nome ausente.');
    if (!data.hireDate) throw new BadRequestException('Data de admissao ausente.');

    const cpf = data.taxId.replace(/\D/g, '');

    return this.prisma.$transaction(async (tx) => {
      // 1. Criar ou atualizar Person
      let person = await tx.person.findFirst({ where: { cpf, deletedAt: null } });
      if (!person) {
        person = await tx.person.create({
          data: {
            cpf,
            fullName:  data.fullName,
            nickname:  data.nickname ?? undefined,
            birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
            street:    data.street ?? undefined,
            neighborhood: data.neighborhood ?? undefined,
            city:      data.city ?? undefined,
            state:     data.addressState ?? undefined,
            zipCode:   data.zipCode ?? undefined,
            phone1:    data.phone ?? undefined,
            phone2:    data.cellPhone ?? undefined,
            rgNumber:  data.rgNumber ?? undefined,
            rgIssuer:  data.rgIssuer ?? undefined,
          },
        });
      }

      // 2. Verificar se funcionario ja existe nesta empresa
      const existing = await tx.employee.findFirst({
        where: { companyId, taxId: cpf, deletedAt: null },
      });
      if (existing) throw new BadRequestException(`Funcionario com CPF ${data.taxId} ja cadastrado nesta empresa.`);

      // 3. Criar Employee
      const employee = await tx.employee.create({
        data: {
          companyId,
          personId:          person.id,
          fullName:          data.fullName,
          taxId:             cpf,
          birthDate:         data.birthDate ? new Date(data.birthDate) : new Date('1900-01-01'),
          hireDate:          new Date(data.hireDate!),
          // terminationDate: omitido — nao consta na ficha de admissao
          role:              data.role ?? 'NAO_INFORMADO',
          salary:            data.salary ?? 0,
          registrationNumber: data.registrationNumber ?? undefined,
          nickname:          data.nickname ?? undefined,
          motherName:        data.motherName ?? undefined,
          fatherName:        data.fatherName ?? undefined,
          phone:             data.phone ?? undefined,
          cellPhone:         data.cellPhone ?? undefined,
          street:            data.street ?? undefined,
          neighborhood:      data.neighborhood ?? undefined,
          city:              data.city ?? undefined,
          addressState:      data.addressState ?? undefined,
          zipCode:           data.zipCode ?? undefined,
          maritalStatus:     data.maritalStatus ?? undefined,
          raceColor:         data.raceColor as any ?? undefined,
          nationality:       data.nationality ?? '10',
          hasDisability:     data.hasDisability,
          educationLevel:    data.educationLevel as any ?? undefined,
          birthCity:         data.birthCity ?? undefined,
          birthState:        data.birthState ?? undefined,
          rgNumber:          data.rgNumber ?? undefined,
          rgIssuer:          data.rgIssuer ?? undefined,
          rgState:           data.rgState ?? undefined,
          rgDate:            data.rgDate ? new Date(data.rgDate) : undefined,
          pisNumber:         data.pisNumber ?? undefined,
          pisDate:           data.pisDate ? new Date(data.pisDate) : undefined,
          ctpsNumber:        data.ctpsNumber ?? undefined,
          ctpsSeries:        data.ctpsSeries ?? undefined,
          voterTitle:        data.voterTitle ?? undefined,
          voterZone:         data.voterZone ?? undefined,
          voterSection:      data.voterSection ?? undefined,
          weeklyHours:       data.weeklyHours ?? undefined,
          lotacao:           data.lotacao ?? undefined,
          paymentBank:       data.paymentBank ?? undefined,
          gfipCategory:      data.gfipCategory as any ?? undefined,
          gfipOccurrence:    data.gfipOccurrence ?? '00',
          inssOption:        data.inssOption ?? '1',
          employmentBond:    data.employmentBond as any ?? undefined,
          cagedCode:         data.cagedCode ?? undefined,
          isUnionized:       data.isUnionized,
          unionCode:         data.unionCode ?? undefined,
          unionName:         data.unionName ?? undefined,
          experienceDays:    data.experienceDays ?? undefined,
          status:            data.status,
        },
      });

      // 4. Criar Dependentes
      if (data.dependents.length > 0) {
        await tx.employeeDependent.createMany({
          data: data.dependents.map(d => ({
            employeeId:   employee.id,
            companyId,
            name:         d.name,
            relationship: d.relationship as any,
            birthDate:    d.birthDate ? new Date(d.birthDate) : undefined,
            salaryFamily: d.salaryFamily,
            irDeduction:  d.irDeduction,
          })),
        });
      }

      return { employee, person, dependentsCreated: data.dependents.length };
    });
  }

  async listByCompany(companyId: string) {
    return this.prisma.employee.findMany({
      where: { companyId, deletedAt: null },
      include: { dependents: true, person: { select: { id: true, cpf: true } } },
      orderBy: { fullName: 'asc' },
    });
  }
}
