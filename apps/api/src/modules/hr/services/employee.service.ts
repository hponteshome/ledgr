// apps/api/src/modules/hr/services/employee.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ParsedEmployee } from './employee-pdf-parser.service';

const GFIP_CAT: Record<string,string> = { '01':'EMPREGADO','02':'TRABALHADOR_AVULSO','03':'MEDICO_RESIDENTE','05':'MENOR_APRENDIZ','11':'DIRETOR_SEM_VINCULO' };
const EMP_BOND: Record<string,string> = { '10':'URBANO_INDETERMINADO','11':'URBANO_DETERMINADO','12':'RURAL_INDETERMINADO','13':'RURAL_DETERMINADO','21':'DIRETOR_SEM_VINCULO','31':'AUTONOMO','35':'ESTAGIARIO','41':'MENOR_APRENDIZ','65':'DOMESTICO' };

function digits(s: string | null | undefined): string | undefined {
  if (!s) return undefined;
  const d = s.replace(/\D/g, '');
  return d.length > 0 ? d : undefined;
}

function str(s: string | null | undefined): string | undefined {
  return s ?? undefined;
}

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  async importFromParsed(companyId: string, data: ParsedEmployee, userId: string) {
    if (!data.taxId) throw new BadRequestException('CPF ausente.');
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
            fullName:     data.fullName,
            nickname:     str(data.nickname),
            birthDate:    data.birthDate ? new Date(data.birthDate) : undefined,
            street:       str(data.street),
            neighborhood: str(data.neighborhood),
            city:         str(data.city),
            state:        str(data.addressState),
            zipCode:      digits(data.zipCode),
            phone1:       str(data.phone),
            phone2:       str(data.cellPhone),
            rgNumber:     digits(data.rgNumber),
            rgIssuer:     data.rgIssuer ? data.rgIssuer.substring(0,10) : undefined,
          },
        });
      }

      // 2. Verificar duplicata
      const existing = await tx.employee.findFirst({ where: { companyId, taxId: cpf, deletedAt: null } });
      if (existing) throw new BadRequestException(`CPF ${data.taxId} ja cadastrado nesta empresa.`);

      // 3. Criar Employee
      const employee = await tx.employee.create({
        data: {
          companyId,
          personId:          person.id,
          fullName:          data.fullName,
          taxId:             cpf,
          birthDate:         data.birthDate ? new Date(data.birthDate) : new Date('1900-01-01'),
          hireDate:          new Date(data.hireDate!),
          role:              data.role ?? 'NAO_INFORMADO',
          salary:            data.salary ?? 0,
          registrationNumber: str(data.registrationNumber),
          nickname:          str(data.nickname),
          motherName:        str(data.motherName),
          fatherName:        str(data.fatherName),
          phone:             str(data.phone),
          cellPhone:         str(data.cellPhone),
          street:            str(data.street),
          neighborhood:      str(data.neighborhood),
          city:              str(data.city),
          addressState:      str(data.addressState),
          zipCode:           digits(data.zipCode),
          maritalStatus:     str(data.maritalStatus),
          raceColor:         data.raceColor as any ?? undefined,
          nationality:       data.nationality ?? '10',
          hasDisability:     data.hasDisability,
          educationLevel:    data.educationLevel as any ?? undefined,
          birthCity:         str(data.birthCity),
          birthState:        str(data.birthState),
          rgNumber:          digits(data.rgNumber),
          rgIssuer:          data.rgIssuer ? data.rgIssuer.substring(0,10) : undefined,
          rgState:           str(data.rgState),
          rgDate:            data.rgDate ? new Date(data.rgDate) : undefined,
          pisNumber:         digits(data.pisNumber),
          pisDate:           data.pisDate ? new Date(data.pisDate) : undefined,
          ctpsNumber:        str(data.ctpsNumber),
          ctpsSeries:        data.ctpsSeries ? data.ctpsSeries.substring(0,10) : undefined,
          voterTitle:        str(data.voterTitle),
          voterZone:         str(data.voterZone),
          voterSection:      str(data.voterSection),
          weeklyHours:       data.weeklyHours ?? undefined,
          lotacao:           str(data.lotacao),
          paymentBank:       str(data.paymentBank),
          gfipCategory:      data.gfipCategory ? GFIP_CAT[data.gfipCategory] as any : undefined,
          gfipOccurrence:    data.gfipOccurrence ?? '00',
          inssOption:        data.inssOption ?? '1',
          employmentBond:    data.employmentBond ? EMP_BOND[data.employmentBond] as any : undefined,
          cagedCode:         str(data.cagedCode),
          isUnionized:       data.isUnionized,
          unionCode:         str(data.unionCode),
          unionName:         data.unionName ? data.unionName.substring(0,100) : undefined,
          experienceDays:    data.experienceDays ?? undefined,
          status:            data.status,
        },
      });

      // 4. Criar Dependentes
      if (data.dependents?.length > 0) {
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

      return { employee, person, dependentsCreated: data.dependents?.length ?? 0 };
    });
  }

  async listByCompany(companyId: string) {
    return this.prisma.employee.findMany({
      where: { companyId, deletedAt: null },
      include: { dependents: true, person: { select: { id: true, cpf: true } } },
      orderBy: { fullName: 'asc' },
    });
  }

  // ── findOne ──────────────────────────────────────────────────────────────────
  async findOne(companyId: string, id: string) {
    const emp = await this.prisma.employee.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        dependents: true,
        person: { select: { id: true, cpf: true, fullName: true } },
        contratoHistorico: { where: { deletedAt: null }, orderBy: { dataAlteracao: 'desc' } },
        ocorrencias: { where: { deletedAt: null }, orderBy: { data: 'desc' } },
        afastamentos: { where: { deletedAt: null }, orderBy: { dataInicio: 'desc' } },
        bancoHoras: { include: { lancamentos: { orderBy: { data: 'desc' }, take: 20 } } },
      },
    });
    if (!emp) throw new Error('Funcionario nao encontrado.');
    return emp;
  }

  // ── update ───────────────────────────────────────────────────────────────────
  async update(companyId: string, id: string, dto: any, userId: string) {
    await this.prisma.employee.findFirstOrThrow({ where: { id, companyId, deletedAt: null } });
    return this.prisma.employee.update({
      where: { id },
      data: {
        fullName:    dto.fullName,
        role:        dto.role,
        salary:      dto.salary ? new (require('@prisma/client').Prisma.Decimal)(dto.salary) : undefined,
        weeklyHours: dto.weeklyHours ? new (require('@prisma/client').Prisma.Decimal)(dto.weeklyHours) : undefined,
        department:  dto.department,
        lotacao:     dto.lotacao,
        phone:       dto.phone,
        cellPhone:   dto.cellPhone,
        street:      dto.street,
        number:      dto.number,
        complement:  dto.complement,
        neighborhood: dto.neighborhood,
        city:        dto.city,
        addressState: dto.addressState,
        zipCode:     dto.zipCode,
        maritalStatus: dto.maritalStatus,
        educationLevel: dto.educationLevel,
        status:      dto.status,
      },
    });
  }

  // ── desligar ─────────────────────────────────────────────────────────────────
  async desligar(companyId: string, id: string, dto: any, userId: string) {
    await this.prisma.employee.findFirstOrThrow({ where: { id, companyId, deletedAt: null } });
    return this.prisma.employee.update({
      where: { id },
      data: {
        status: 'inactive',
        terminationDate: dto.dataDesligamento ? new Date(dto.dataDesligamento) : new Date(),
      },
    });
  }

  // ── Historico contratual ─────────────────────────────────────────────────────
  async listarHistorico(companyId: string, employeeId: string) {
    return this.prisma.employeeContractHistory.findMany({
      where: { companyId, employeeId, deletedAt: null },
      orderBy: { dataAlteracao: 'desc' },
    });
  }

  async addHistorico(companyId: string, employeeId: string, dto: any, userId: string) {
    const { Prisma } = require('@prisma/client');
    return this.prisma.$transaction(async (tx: any) => {
      const hist = await tx.employeeContractHistory.create({
        data: {
          companyId, employeeId,
          tipo:          dto.tipo,
          dataAlteracao: new Date(dto.dataAlteracao),
          funcaoAnterior: dto.funcaoAnterior ?? null,
          funcaoNova:    dto.funcaoNova ?? null,
          salarioAnterior: dto.salarioAnterior ? new Prisma.Decimal(dto.salarioAnterior) : null,
          salarioNovo:   dto.salarioNovo ? new Prisma.Decimal(dto.salarioNovo) : null,
          percentualReajuste: dto.percentualReajuste ? new Prisma.Decimal(dto.percentualReajuste) : null,
          setorAnterior: dto.setorAnterior ?? null,
          setorNovo:     dto.setorNovo ?? null,
          motivo:        dto.motivo ?? null,
          observacao:    dto.observacao ?? null,
          createdById:   userId,
        },
      });
      // Atualizar dados do funcionario se houver alteracao
      const upd: any = {};
      if (dto.funcaoNova)    upd.role   = dto.funcaoNova;
      if (dto.salarioNovo)   upd.salary = new Prisma.Decimal(dto.salarioNovo);
      if (dto.setorNovo)     upd.department = dto.setorNovo;
      if (Object.keys(upd).length > 0) {
        await tx.employee.update({ where: { id: employeeId }, data: upd });
      }
      return hist;
    });
  }

  // ── Ocorrencias ──────────────────────────────────────────────────────────────
  async listarOcorrencias(companyId: string, employeeId: string) {
    return this.prisma.employeeOccurrence.findMany({
      where: { companyId, employeeId, deletedAt: null },
      orderBy: { data: 'desc' },
    });
  }

  async addOcorrencia(companyId: string, employeeId: string, dto: any, userId: string) {
    return this.prisma.employeeOccurrence.create({
      data: {
        companyId, employeeId,
        tipo:         dto.tipo,
        data:         new Date(dto.data),
        motivo:       dto.motivo,
        descricao:    dto.descricao ?? null,
        testemunha:   dto.testemunha ?? null,
        diasSuspensao: dto.diasSuspensao ?? null,
        createdById:  userId,
      },
    });
  }

  // ── Afastamentos ─────────────────────────────────────────────────────────────
  async listarAfastamentos(companyId: string, employeeId: string) {
    return this.prisma.employeeLeave.findMany({
      where: { companyId, employeeId, deletedAt: null },
      orderBy: { dataInicio: 'desc' },
    });
  }

  async addAfastamento(companyId: string, employeeId: string, dto: any, userId: string) {
    return this.prisma.employeeLeave.create({
      data: {
        companyId, employeeId,
        tipo:       dto.tipo,
        dataInicio: new Date(dto.dataInicio),
        dataFim:    dto.dataFim ? new Date(dto.dataFim) : null,
        diasTotal:  dto.diasTotal ?? null,
        cid:        dto.cid ?? null,
        beneficioINSS: dto.beneficioINSS ?? false,
        nrBeneficioINSS: dto.nrBeneficioINSS ?? null,
        observacao: dto.observacao ?? null,
        createdById: userId,
      },
    });
  }

  // ── Banco de horas ───────────────────────────────────────────────────────────
  async getBancoHoras(companyId: string, employeeId: string) {
    return this.prisma.bancoHoras.findFirst({
      where: { companyId, employeeId },
      include: { lancamentos: { orderBy: { data: 'desc' }, take: 30 } },
    });
  }

  async addLancamentoBH(companyId: string, employeeId: string, dto: any, userId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      let bh = await tx.bancoHoras.findFirst({ where: { companyId, employeeId } });
      if (!bh) {
        bh = await tx.bancoHoras.create({ data: { companyId, employeeId, saldoMinutos: 0 } });
      }
      const minutos = dto.tipo === 'CREDITO' || dto.tipo === 'AJUSTE'
        ? Math.abs(dto.minutos)
        : -Math.abs(dto.minutos);
      const saldoApos = bh.saldoMinutos + minutos;
      await tx.bancoHorasLancamento.create({
        data: {
          bancoHorasId: bh.id, companyId, employeeId,
          tipo:        dto.tipo,
          data:        new Date(dto.data),
          minutos,
          saldoApos,
          competencia: dto.competencia,
          descricao:   dto.descricao ?? null,
          createdById: userId,
        },
      });
      return tx.bancoHoras.update({
        where: { id: bh.id },
        data: { saldoMinutos: saldoApos },
      });
    });
  }
}
