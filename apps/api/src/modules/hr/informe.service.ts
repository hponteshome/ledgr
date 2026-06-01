// apps/api/src/modules/hr/informe.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InformeService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string, ano?: number) {
    return this.prisma.informeRendimentos.findMany({
      where: { companyId, ...(ano ? { anoCalendario: ano } : {}) },
      include: {
        person:  { select: { id: true, fullName: true, cpf: true, street: true, number: true, complement: true, neighborhood: true, city: true, state: true, zipCode: true } },
        company: { select: { id: true, legalName: true, taxId: true, street: true, number: true, complement: true, neighborhood: true, city: true, state: true, zipCode: true } },
      },
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
    const { personId, anoCalendario, companyId: _cid, person, company, createdById: _cbid, createdAt, updatedAt, id: _id, ...data } = dto;
    const clean: any = Object.fromEntries(Object.entries(data).map(([k,v]) => [k, v === '' ? null : v]));
    return this.prisma.informeRendimentos.upsert({
      where: { companyId_personId_anoCalendario: { companyId, personId, anoCalendario } },
      create: { companyId, personId, anoCalendario, createdById, ...clean },
      update: { ...clean },
    });
  }

  // ── Alimentar informe a partir das folhas fechadas do ano ──────────────────
  async alimentarPorFolha(companyId: string, createdById: string, anoCalendario: number) {
    const competenciaIni = anoCalendario + '-01';
    const competenciaFim = anoCalendario + '-12';

    // Buscar todas as folhas FECHADAS ou PAGA do ano
    const folhas = await this.prisma.folhaMensal.findMany({
      where: {
        companyId,
        status: { in: ['FECHADA', 'PAGA'] },
        competencia: { gte: competenciaIni, lte: competenciaFim },
        deletedAt: null,
      },
      include: {
        funcionarios: {
          include: {
            employee: {
              select: { id: true, fullName: true, taxId: true, personId: true },
            },
          },
        },
      },
    });

    if (!folhas.length) return { total: 0, funcionarios: 0, anoCalendario, aviso: 'Nenhuma folha fechada encontrada para ' + anoCalendario + '. Feche as folhas do ano antes de importar.' };

    // Agregar por funcionario
    const map = new Map<string, any>();
    for (const folha of folhas) {
      for (const ff of folha.funcionarios) {
        const emp = ff.employee;
        if (!emp.personId) continue; // funcionario sem Person vinculado — pular
        const key = emp.personId;
        if (!map.has(key)) {
          map.set(key, {
            personId: emp.personId,
            q3TotalRendimentos:      0,
            q3ContribPrevidenciaria: 0,
            q3Irrf:                  0,
            q5DecimoTerceiro:        0,
            q5IrrfDecimoTerceiro:    0,
            q4Outros:                0, // ferias + 1/3
          });
        }
        const acc = map.get(key)!;
        const bruto    = Number(ff.totalBruto);
        const decimo   = Number(ff.decimoTerceiro);
        const ferias   = Number(ff.ferias) + Number(ff.tercoFerias);
        // rendimentos tributaveis = bruto - decimo - ferias
        const tributavel = bruto - decimo - ferias;
        acc.q3TotalRendimentos      += tributavel > 0 ? tributavel : bruto;
        acc.q3ContribPrevidenciaria += Number(ff.valorInss);
        acc.q3Irrf                  += Number(ff.valorIrrf);
        acc.q5DecimoTerceiro        += decimo;
        acc.q4Outros                += ferias;
      }
    }

    const results: any[] = [];
    for (const [, dados] of map) {
      const dto = {
        personId:               dados.personId,
        anoCalendario,
        naturezaRendimento:     'Rendimentos do trabalho com vinculo empregaticio',
        q3TotalRendimentos:     dados.q3TotalRendimentos,
        q3ContribPrevidenciaria: dados.q3ContribPrevidenciaria,
        q3Irrf:                 dados.q3Irrf,
        q5DecimoTerceiro:       dados.q5DecimoTerceiro,
        q4Outros:               dados.q4Outros,
      };
      const inf = await this.upsert(companyId, createdById, { ...dto, anoCalendario });
      results.push(inf);
    }

    return { total: results.length, funcionarios: results.length, anoCalendario };
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.informeRendimentos.delete({ where: { id } });
  }
}