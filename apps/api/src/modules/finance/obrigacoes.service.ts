import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export type ObrigacaoStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "OVERDUE";

export interface UpsertObrigacaoDto {
  code: string;
  competence: string;
  dueDate: string;
  status: ObrigacaoStatus;
  notes?: string;
}

// ── Tabela de obrigações por regime ──────────────────────────────────────────
// formaTributacao: 1=LucroReal 2=LucroPresumido 3=SimplesNacional 4=Imune 8=MEI
interface ObrigRule {
  code: string;
  label: string;
  regimes: string[]; // [] = todos
  calcDue: (year: number, month: number) => Date;
}

function addMonth(year: number, month: number, add: number): [number, number] {
  const d = new Date(year, month - 1 + add, 1);
  return [d.getFullYear(), d.getMonth() + 1];
}

function nextWorkday(year: number, month: number, day: number): Date {
  const d = new Date(year, month - 1, day);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

function lastWorkday(year: number, month: number): Date {
  const d = new Date(year, month, 0);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d;
}

const MONTHLY_RULES: ObrigRule[] = [
  {
    code: "FGTS", label: "FGTS Mensal",
    regimes: [],
    calcDue: (y, m) => { const [ny, nm] = addMonth(y, m, 1); return nextWorkday(ny, nm, 7); },
  },
  {
    code: "GPS_INSS", label: "GPS — INSS Patronal",
    regimes: [],
    calcDue: (y, m) => { const [ny, nm] = addMonth(y, m, 1); return nextWorkday(ny, nm, 15); },
  },
  {
    code: "ESOCIAL", label: "eSocial — Folha",
    regimes: [],
    calcDue: (y, m) => { const [ny, nm] = addMonth(y, m, 1); return nextWorkday(ny, nm, 7); },
  },
  {
    code: "DARF_PIS", label: "DARF — PIS/Pasep",
    regimes: ["1", "2"],
    calcDue: (y, m) => { const [ny, nm] = addMonth(y, m, 1); return nextWorkday(ny, nm, 25); },
  },
  {
    code: "DARF_COFINS", label: "DARF — COFINS",
    regimes: ["1", "2"],
    calcDue: (y, m) => { const [ny, nm] = addMonth(y, m, 1); return nextWorkday(ny, nm, 25); },
  },
  {
    code: "DARF_CSLL", label: "DARF — CSLL",
    regimes: ["1", "2"],
    calcDue: (y, m) => { const [ny, nm] = addMonth(y, m, 1); return lastWorkday(ny, nm); },
  },
  {
    code: "DARF_IRPJ", label: "DARF — IRPJ",
    regimes: ["1", "2"],
    calcDue: (y, m) => { const [ny, nm] = addMonth(y, m, 1); return lastWorkday(ny, nm); },
  },
  {
    code: "DAS", label: "DAS — Simples Nacional",
    regimes: ["3", "8"],
    calcDue: (y, m) => { const [ny, nm] = addMonth(y, m, 1); return nextWorkday(ny, nm, 20); },
  },
  {
    code: "DCTF", label: "DCTF Mensal",
    regimes: ["1", "2"],
    calcDue: (y, m) => { const [ny, nm] = addMonth(y, m, 2); return nextWorkday(ny, nm, 15); },
  },
  {
    code: "SPED_FISCAL", label: "SPED Fiscal (EFD ICMS/IPI)",
    regimes: ["1", "2"],
    calcDue: (y, m) => { const [ny, nm] = addMonth(y, m, 1); return nextWorkday(ny, nm, 25); },
  },
];

const ANNUAL_RULES: { code: string; label: string; regimes: string[]; calcDue: (y: number) => Date }[] = [
  { code: "ECD",   label: "ECD — Escrituração Contábil Digital", regimes: ["1","2","4"], calcDue: (y) => nextWorkday(y+1, 7, 31) },
  { code: "ECF",   label: "ECF — Escrituração Contábil Fiscal",  regimes: ["1","2"],     calcDue: (y) => nextWorkday(y+1, 7, 31) },
  { code: "DIRF",  label: "DIRF — Declaração IR na Fonte",       regimes: [],            calcDue: (y) => lastWorkday(y+1, 2) },
  { code: "DEFIS", label: "DEFIS — Declaração Simples Nacional", regimes: ["3"],         calcDue: (y) => nextWorkday(y+1, 3, 31) },
  { code: "RAIS",  label: "RAIS — Relação Anual Info Sociais",   regimes: [],            calcDue: (y) => nextWorkday(y+1, 4, 5) },
];

@Injectable()
export class ObrigacoesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Buscar regime vigente da empresa na competência ───────────────────────
  private async getRegime(companyId: string, competence: string): Promise<string | null> {
    const [yearStr, monthStr] = competence.split("-");
    const refDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
    const regime = await this.prisma.companyTaxRegime.findFirst({
      where: {
        companyId,
        dtIni: { lte: refDate },
        dtFin: { gte: refDate },
      },
      orderBy: { dtIni: "desc" },
    });
    return regime?.formaTributacao ?? null;
  }

  // ── Gerar e persistir obrigações para empresa/competência ─────────────────
  async gerarObrigacoes(companyId: string, competence: string): Promise<any[]> {
    const [yearStr, monthStr] = competence.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const today = new Date();
    const regime = await this.getRegime(companyId, competence);

    const toCreate: UpsertObrigacaoDto[] = [];

    // Mensais
    for (const rule of MONTHLY_RULES) {
      const aplicavel = rule.regimes.length === 0 || (regime && rule.regimes.includes(regime));
      if (!aplicavel) continue;
      const dueDate = rule.calcDue(year, month);
      toCreate.push({
        code: rule.code,
        competence,
        dueDate: dueDate.toISOString(),
        status: dueDate < today ? "OVERDUE" : "PENDING",
      });
    }

    // Anuais — gerar no mês de dezembro do ano de competência
    if (month === 12) {
      for (const rule of ANNUAL_RULES) {
        const aplicavel = rule.regimes.length === 0 || (regime && rule.regimes.includes(regime));
        if (!aplicavel) continue;
        const dueDate = rule.calcDue(year);
        toCreate.push({
          code: rule.code,
          competence: String(year),
          dueDate: dueDate.toISOString(),
          status: dueDate < today ? "OVERDUE" : "PENDING",
        });
      }
    }

    // Upsert — não sobrescreve status já definido pelo usuário
    const results = await Promise.all(
      toCreate.map((dto) =>
        this.prisma.fiscalObligation.upsert({
          where: { companyId_code_competence: { companyId, code: dto.code, competence: dto.competence } },
          create: {
            companyId,
            code: dto.code,
            competence: dto.competence,
            dueDate: new Date(dto.dueDate),
            status: dto.status,
          },
          update: {
            dueDate: new Date(dto.dueDate),
            // Não sobrescreve status — respeita o que o usuário definiu
          },
        })
      )
    );
    return results;
  }

  async findByCompetence(companyId: string, competence: string) {
    return this.prisma.fiscalObligation.findMany({
      where: { companyId, competence },
      orderBy: { dueDate: "asc" },
    });
  }

  async findAll(companyId: string) {
    return this.prisma.fiscalObligation.findMany({
      where: { companyId },
      orderBy: [{ competence: "desc" }, { dueDate: "asc" }],
    });
  }

  async updateStatus(companyId: string, userId: string, code: string, competence: string, status: ObrigacaoStatus, notes?: string) {
    return this.prisma.fiscalObligation.upsert({
      where: { companyId_code_competence: { companyId, code, competence } },
      create: {
        companyId, code, competence,
        dueDate: new Date(),
        status,
        notes: notes ?? null,
        doneAt: status === "DONE" ? new Date() : null,
        doneById: status === "DONE" ? userId : null,
      },
      update: {
        status,
        notes: notes ?? null,
        doneAt: status === "DONE" ? new Date() : null,
        doneById: status === "DONE" ? userId : null,
      },
    });
  }

  async upsertMany(companyId: string, userId: string, items: UpsertObrigacaoDto[]) {
    return Promise.all(
      items.map((dto) =>
        this.prisma.fiscalObligation.upsert({
          where: { companyId_code_competence: { companyId, code: dto.code, competence: dto.competence } },
          create: {
            companyId, code: dto.code, competence: dto.competence,
            dueDate: new Date(dto.dueDate), status: dto.status,
            notes: dto.notes ?? null,
            doneAt: dto.status === "DONE" ? new Date() : null,
            doneById: dto.status === "DONE" ? userId : null,
          },
          update: {
            status: dto.status, dueDate: new Date(dto.dueDate),
            notes: dto.notes ?? null,
            doneAt: dto.status === "DONE" ? new Date() : null,
            doneById: dto.status === "DONE" ? userId : null,
          },
        })
      )
    );
  }
}
