// apps/api/src/core/companies/company-tax-regime.service.ts
import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const FORMA_LABEL: Record<string, string> = {
  "1": "Lucro Real",
  "2": "Lucro Presumido",
  "3": "Simples Nacional",
  "4": "Imune / Isenta",
  "8": "MEI",
};

@Injectable()
export class CompanyTaxRegimeService {
  constructor(private readonly prisma: PrismaService) {}

  async findByCompany(companyId: string) {
    const regimes = await this.prisma.companyTaxRegime.findMany({
      where: { companyId },
      orderBy: { dtIni: "desc" },
    });
    return regimes.map(r => ({
      ...r,
      formaLabel: FORMA_LABEL[r.formaTributacao] ?? r.formaTributacao,
    }));
  }

  async create(companyId: string, dto: {
    dtIni: string;
    dtFin: string;
    formaTributacao: string;
    periodoApuracaoIRPJ?: string;
    qualificacaoPJ?: string;
  }) {
    // Regra RFB: regime vigora por ano civil completo
    const ini = new Date(dto.dtIni);
    const fin = new Date(dto.dtFin);
    if (ini.getFullYear() !== fin.getFullYear()) {
      throw new BadRequestException("O regime tributario deve ser definido dentro do mesmo ano civil.");
    }
    // Verificar sobreposição
    const overlap = await this.prisma.companyTaxRegime.findFirst({
      where: {
        companyId,
        AND: [
          { dtIni: { lte: fin } },
          { dtFin: { gte: ini } },
        ],
      },
    });
    if (overlap) {
      throw new BadRequestException(`Ja existe um regime cadastrado para o periodo ${overlap.dtIni.toISOString().slice(0,10)} a ${overlap.dtFin.toISOString().slice(0,10)}.`);
    }
    return this.prisma.companyTaxRegime.create({
      data: {
        companyId,
        dtIni: ini,
        dtFin: fin,
        formaTributacao: dto.formaTributacao,
        periodoApuracaoIRPJ: dto.periodoApuracaoIRPJ ?? null,
        qualificacaoPJ: dto.qualificacaoPJ ?? null,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.companyTaxRegime.delete({ where: { id } });
  }
}
