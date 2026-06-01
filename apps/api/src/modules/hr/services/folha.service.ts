// apps/api/src/modules/hr/services/folha.service.ts
import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { Prisma } from "@prisma/client";

// ── Tabelas INSS 2024/2025 (progressiva) ─────────────────────────────────────
const INSS_FAIXAS = [
  { ate: 1412.00,  aliq: 0.075, deducao: 0 },
  { ate: 2666.68,  aliq: 0.09,  deducao: 21.18 },
  { ate: 4000.03,  aliq: 0.12,  deducao: 101.18 },
  { ate: 7786.02,  aliq: 0.14,  deducao: 181.18 },
];
const INSS_TETO = 7786.02;

// ── Tabelas IRRF 2024/2025 ────────────────────────────────────────────────────
const IRRF_FAIXAS = [
  { ate: 2259.20,  aliq: 0,      deducao: 0 },
  { ate: 2826.65,  aliq: 0.075,  deducao: 169.44 },
  { ate: 3751.05,  aliq: 0.15,   deducao: 381.44 },
  { ate: 4664.68,  aliq: 0.225,  deducao: 662.77 },
  { ate: Infinity, aliq: 0.275,  deducao: 896.00 },
];
const DEDUCAO_DEPENDENTE = 189.59;

function calcInss(base: number): { valor: number; aliq: number } {
  if (base <= 0) return { valor: 0, aliq: 0 };
  const baseCalc = Math.min(base, INSS_TETO);
  let total = 0;
  let anterior = 0;
  let aliqFinal = 0;
  for (const f of INSS_FAIXAS) {
    if (baseCalc <= anterior) break;
    const faixa = Math.min(baseCalc, f.ate) - anterior;
    total += faixa * f.aliq;
    aliqFinal = f.aliq;
    anterior = f.ate;
  }
  return { valor: Math.round(total * 100) / 100, aliq: aliqFinal };
}

function calcIrrf(base: number, numDep: number): { valor: number; aliq: number; deducao: number; baseIrrf: number } {
  const deducaoDep = numDep * DEDUCAO_DEPENDENTE;
  const baseIrrf = Math.max(0, base - deducaoDep);
  const faixa = IRRF_FAIXAS.find(f => baseIrrf <= f.ate)!;
  const valor = Math.max(0, Math.round((baseIrrf * faixa.aliq - faixa.deducao) * 100) / 100);
  return { valor, aliq: faixa.aliq, deducao: faixa.deducao, baseIrrf };
}

@Injectable()
export class FolhaService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Criar folha ──────────────────────────────────────────────────────────────
  async criar(companyId: string, competencia: string, userId: string) {
    const existe = await this.prisma.folhaMensal.findFirst({
      where: { companyId, competencia, deletedAt: null },
    });
    if (existe) throw new BadRequestException(`Folha ${competencia} ja existe.`);

    return this.prisma.folhaMensal.create({
      data: { companyId, competencia, createdById: userId },
    });
  }

  // ── Calcular folha ───────────────────────────────────────────────────────────
  async calcular(companyId: string, folhaId: string, userId: string) {
    const folha = await this.prisma.folhaMensal.findFirstOrThrow({
      where: { id: folhaId, companyId, deletedAt: null },
    });
    if (folha.status === "FECHADA" || folha.status === "PAGA")
      throw new BadRequestException("Folha ja fechada ou paga.");

    const employees = await this.prisma.employee.findMany({
      where: { companyId, deletedAt: null, status: "active" },
      include: { dependents: true, beneficios: { where: { ativo: true, deletedAt: null } } },
    });

    return this.prisma.$transaction(async (tx) => {
      let totalBruto = 0, totalDescontos = 0, totalLiquido = 0;
      let totalFgts = 0, totalInssEmp = 0, totalInssEmpregador = 0;
      let totalIrrf = 0, totalSindical = 0;

      for (const emp of employees) {
        const salBase = Number(emp.salary);
        const numDep  = emp.dependents.filter(d => d.irDeduction).length;

        // INSS empregado
        const inss = calcInss(salBase);

        // INSS patronal (20% + RAT 1% padrao + Sistema S 5,8%)
        const aliqEmpregador = 0.20;
        const aliqRat        = 0.01;
        const aliqTerceiros  = 0.058;
        const vrEmpregador   = Math.round(salBase * aliqEmpregador * 100) / 100;
        const vrRat          = Math.round(salBase * aliqRat * 100) / 100;
        const vrTerceiros    = Math.round(salBase * aliqTerceiros * 100) / 100;

        // IRRF
        const baseIrrfBruta = salBase - inss.valor;
        const irrf = calcIrrf(baseIrrfBruta, numDep);

        // FGTS
        const aliqFgts = (emp as any).employmentBond === "ESTAGIARIO" ? 0 : 0.08;
        const vrFgts   = Math.round(salBase * aliqFgts * 100) / 100;

        // Beneficios
        let vrVt = 0, vrVr = 0, vrVa = 0, vrPs = 0, vrPo = 0, vrSv = 0, vrOd = 0;
        for (const b of (emp as any).beneficios ?? []) {
          if (!b.descontaFuncionario) continue;
          const vb = Number(b.valor);
          switch (b.tipo) {
            case "VALE_TRANSPORTE":  vrVt += vb; break;
            case "VALE_REFEICAO":    vrVr += vb; break;
            case "VALE_ALIMENTACAO": vrVa += vb; break;
            case "PLANO_SAUDE":      vrPs += vb; break;
            case "PLANO_ODONTO":     vrPo += vb; break;
            case "SEGURO_VIDA":      vrSv += vb; break;
            default:                 vrOd += vb;
          }
        }

        const totalDesc = inss.valor + irrf.valor + vrVt + vrVr + vrVa + vrPs + vrPo + vrSv + vrOd;
        const totalLiq  = salBase - totalDesc;

        totalBruto         += salBase;
        totalDescontos     += totalDesc;
        totalLiquido       += totalLiq;
        totalFgts          += vrFgts;
        totalInssEmp       += inss.valor;
        totalInssEmpregador += vrEmpregador + vrRat + vrTerceiros;
        totalIrrf          += irrf.valor;

        // Upsert FolhaFuncionario
        const existing = await tx.folhaFuncionario.findFirst({
          where: { folhaId, employeeId: emp.id },
        });

        const data = {
          folhaId, employeeId: emp.id, companyId,
          tipoContrato: (emp as any).employmentBond === "ESTAGIARIO" ? "ESTAGIARIO" : "CLT" as any,
          salarioBase:   new Prisma.Decimal(salBase),
          baseInss:      new Prisma.Decimal(salBase),
          aliqInss:      new Prisma.Decimal(inss.aliq),
          valorInss:     new Prisma.Decimal(inss.valor),
          aliqInssEmpregador: new Prisma.Decimal(aliqEmpregador),
          valorInssEmpregador: new Prisma.Decimal(vrEmpregador),
          aliqRat:       new Prisma.Decimal(aliqRat),
          valorRat:      new Prisma.Decimal(vrRat),
          aliqTerceiros: new Prisma.Decimal(aliqTerceiros),
          valorTerceiros: new Prisma.Decimal(vrTerceiros),
          baseIrrf:      new Prisma.Decimal(irrf.baseIrrf),
          deducaoDependentes: new Prisma.Decimal(numDep * DEDUCAO_DEPENDENTE),
          numDependentes: numDep,
          aliqIrrf:      new Prisma.Decimal(irrf.aliq),
          deducaoIrrf:   new Prisma.Decimal(irrf.deducao),
          valorIrrf:     new Prisma.Decimal(irrf.valor),
          baseFgts:      new Prisma.Decimal(salBase),
          aliqFgts:      new Prisma.Decimal(aliqFgts),
          valorFgts:     new Prisma.Decimal(vrFgts),
          vrValeTransporte: new Prisma.Decimal(vrVt),
          vrValeRefeicao:   new Prisma.Decimal(vrVr),
          vrValeAlimentacao: new Prisma.Decimal(vrVa),
          vrPlanoSaude:     new Prisma.Decimal(vrPs),
          vrPlanoOdonto:    new Prisma.Decimal(vrPo),
          vrSeguroVida:     new Prisma.Decimal(vrSv),
          vrOutrosDescontos: new Prisma.Decimal(vrOd),
          totalBruto:    new Prisma.Decimal(salBase),
          totalDescontos: new Prisma.Decimal(totalDesc),
          totalLiquido:  new Prisma.Decimal(totalLiq),
        };

        if (existing) {
          await tx.folhaFuncionario.update({ where: { id: existing.id }, data });
        } else {
          await tx.folhaFuncionario.create({ data });
        }
      }

      // Atualizar totais da folha
      return tx.folhaMensal.update({
        where: { id: folhaId },
        data: {
          status: "CALCULADA",
          totalBruto:          new Prisma.Decimal(totalBruto),
          totalDescontos:      new Prisma.Decimal(totalDescontos),
          totalLiquido:        new Prisma.Decimal(totalLiquido),
          totalFgts:           new Prisma.Decimal(totalFgts),
          totalInssEmpregado:  new Prisma.Decimal(totalInssEmp),
          totalInssEmpregador: new Prisma.Decimal(totalInssEmpregador),
          totalIrrf:           new Prisma.Decimal(totalIrrf),
          totalSindical:       new Prisma.Decimal(totalSindical),
          geradoEm:            new Date(),
        },
        include: { funcionarios: true },
      });
    });
  }

  // ── Fechar folha ─────────────────────────────────────────────────────────────
  async fechar(companyId: string, folhaId: string) {
    const folha = await this.prisma.folhaMensal.findFirstOrThrow({
      where: { id: folhaId, companyId, deletedAt: null },
    });
    if (folha.status !== "CALCULADA")
      throw new BadRequestException("Folha precisa estar CALCULADA para ser fechada.");
    return this.prisma.folhaMensal.update({
      where: { id: folhaId },
      data: { status: "FECHADA", fechadoEm: new Date() },
    });
  }

  // ── Reabrir folha ────────────────────────────────────────────────────────────
  async reabrir(companyId: string, folhaId: string) {
    return this.prisma.folhaMensal.update({
      where: { id: folhaId },
      data: { status: "ABERTA", fechadoEm: null, geradoEm: null },
    });
  }

  // ── Listagem ─────────────────────────────────────────────────────────────────
  async listar(companyId: string) {
    return this.prisma.folhaMensal.findMany({
      where: { companyId, deletedAt: null },
      include: { _count: { select: { funcionarios: true } } },
      orderBy: { competencia: "desc" },
    });
  }

  // ── Detalhe ──────────────────────────────────────────────────────────────────
  async detalhe(companyId: string, folhaId: string) {
    const folha = await this.prisma.folhaMensal.findFirst({
      where: { id: folhaId, companyId, deletedAt: null },
      include: {
        funcionarios: {
          include: {
            employee: { select: { id: true, fullName: true, taxId: true, role: true } },
            eventos: true,
          },
          orderBy: { employee: { fullName: "asc" } },
        },
      },
    });
    if (!folha) throw new NotFoundException("Folha nao encontrada.");
    return folha;
  }

  // ── Beneficios por funcionario ───────────────────────────────────────────────
  async listarBeneficios(companyId: string, employeeId: string) {
    return this.prisma.folhaBeneficio.findMany({
      where: { companyId, employeeId, deletedAt: null },
      orderBy: { tipo: "asc" },
    });
  }

  async criarBeneficio(companyId: string, dto: any) {
    return this.prisma.folhaBeneficio.create({
      data: {
        companyId,
        employeeId:          dto.employeeId,
        tipo:                dto.tipo,
        descricao:           dto.descricao ?? null,
        valor:               new Prisma.Decimal(dto.valor),
        descontaFuncionario: dto.descontaFuncionario ?? true,
        percentualDesconto:  dto.percentualDesconto ? new Prisma.Decimal(dto.percentualDesconto) : null,
        competenciaIni:      dto.competenciaIni,
        competenciaFim:      dto.competenciaFim ?? null,
      },
    });
  }

  // ── Dissidios ────────────────────────────────────────────────────────────────
  async listarDissidios(companyId: string) {
    return this.prisma.folhaDissidio.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { dataVigencia: "desc" },
    });
  }

  async criarDissidio(companyId: string, dto: any, userId: string) {
    return this.prisma.folhaDissidio.create({
      data: {
        companyId,
        sindicato:       dto.sindicato,
        categoriaProf:   dto.categoriaProf,
        percentual:      new Prisma.Decimal(dto.percentual),
        dataVigencia:    new Date(dto.dataVigencia),
        dataHomologacao: dto.dataHomologacao ? new Date(dto.dataHomologacao) : null,
        pisoSalarial:    dto.pisoSalarial ? new Prisma.Decimal(dto.pisoSalarial) : null,
        observacao:      dto.observacao ?? null,
        createdById:     userId,
      },
    });
  }
}
