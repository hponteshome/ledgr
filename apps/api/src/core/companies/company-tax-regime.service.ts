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
      orderBy: { dtIni: "asc" },
    });
    return regimes.map(r => ({
      ...r,
      formaLabel: FORMA_LABEL[r.formaTributacao] ?? r.formaTributacao,
      vigente: !r.dtFin || r.dtFin >= new Date(),
    }));
  }

  // Retorna o regime vigente em uma data especifica
  async findVigenteNaData(companyId: string, data: Date) {
    return this.prisma.companyTaxRegime.findFirst({
      where: {
        companyId,
        dtIni: { lte: data },
        OR: [
          { dtFin: null },
          { dtFin: { gte: data } },
        ],
      },
      orderBy: { dtIni: "desc" },
    });
  }

  async create(companyId: string, dto: {
    dtIni: string;
    formaTributacao: string;
    periodoApuracaoIRPJ?: string;
    qualificacaoPJ?: string;
  }) {
    const ini = new Date(dto.dtIni);
    ini.setUTCHours(0,0,0,0);

    // Validar que dtIni >= openingDate da empresa
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { openingDate: true, legalName: true },
    });
    if (company?.openingDate && ini < company.openingDate) {
      throw new BadRequestException(
        `Data de inicio (${ini.toISOString().slice(0,10)}) nao pode ser anterior a data de abertura da empresa (${company.openingDate.toISOString().slice(0,10)}).`
      );
    }

    // Verificar se ja existe regime com mesma data de inicio
    const existing = await this.prisma.companyTaxRegime.findFirst({
      where: { companyId, dtIni: ini },
    });
    if (existing) {
      throw new BadRequestException(`Ja existe um regime com data de inicio ${dto.dtIni}.`);
    }

    // Fechar regime anterior vigente: dtFin = dtIni - 1 dia
    // Buscar regime anterior vigente (dtFin IS NULL) via SQL raw
    // Prisma v7 nao aceita filtro null em DateTime? diretamente
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM company_tax_regimes
      WHERE company_id = ${companyId}
        AND dt_ini < ${ini}
        AND dt_fin IS NULL
      ORDER BY dt_ini DESC
      LIMIT 1
    `;
    const regimeAnterior = rows[0] ?? null;
    if (regimeAnterior) {
      const dtFinAnterior = new Date(ini);
      dtFinAnterior.setUTCDate(dtFinAnterior.getUTCDate() - 1);
      await this.prisma.companyTaxRegime.update({
        where: { id: regimeAnterior.id },
        data: { dtFin: dtFinAnterior },
      });
    }

    return this.prisma.companyTaxRegime.create({
      data: {
        company: { connect: { id: companyId } },
        dtIni: ini,
        dtFin: null,
        formaTributacao: dto.formaTributacao,
        periodoApuracaoIRPJ: dto.periodoApuracaoIRPJ ?? null,
        qualificacaoPJ: dto.qualificacaoPJ ?? null,
      },
    });
  }

  async remove(id: string) {
    // Ao remover, reabrir o regime anterior (dtFin = null)
    const regime = await this.prisma.companyTaxRegime.findUniqueOrThrow({ where: { id } });
    await this.prisma.companyTaxRegime.delete({ where: { id } });

    // Se o regime removido nao tinha dtFin, reabrir o anterior
    if (!regime.dtFin) {
      const anteriorRows = await this.prisma.$queryRaw<any[]>`
        SELECT * FROM company_tax_regimes
        WHERE company_id = ${regime.companyId}
          AND dt_ini < ${regime.dtIni}
        ORDER BY dt_ini DESC
        LIMIT 1
      `;
      const anterior = anteriorRows[0] ?? null;
      if (anterior) {
        await this.prisma.companyTaxRegime.update({
          where: { id: anterior.id },
          data: { dtFin: null },
        });
      }
    }

    return { ok: true };
  }
}
