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

@Injectable()
export class ObrigacoesService {
  constructor(private readonly prisma: PrismaService) {}

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

  async upsertMany(companyId: string, userId: string, items: UpsertObrigacaoDto[]) {
    return Promise.all(
      items.map((dto) =>
        this.prisma.fiscalObligation.upsert({
          where: { companyId_code_competence: { companyId, code: dto.code, competence: dto.competence } },
          create: {
            companyId,
            code: dto.code,
            competence: dto.competence,
            dueDate: new Date(dto.dueDate),
            status: dto.status,
            notes: dto.notes ?? null,
            doneAt: dto.status === "DONE" ? new Date() : null,
            doneById: dto.status === "DONE" ? userId : null,
          },
          update: {
            status: dto.status,
            dueDate: new Date(dto.dueDate),
            notes: dto.notes ?? null,
            doneAt: dto.status === "DONE" ? new Date() : null,
            doneById: dto.status === "DONE" ? userId : null,
          },
        })
      )
    );
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
}
