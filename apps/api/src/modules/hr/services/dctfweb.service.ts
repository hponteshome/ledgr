import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class DctfWebService {
  constructor(private prisma: PrismaService) {}

  // ── Consolida dados mensais para DCTFWeb ─────────────────────────────────────
  // DCTFWeb = Declaracao de Debitos e Creditos Tributarios Federais Previdenciarios
  // Alimentada pelo eSocial: S-1200 + S-1299 geram os calculos
  async consolidar(companyId: string, competencia: string) {
    // Busca folha mensal da competencia
    const folha = await this.prisma.folhaMensal.findFirst({
      where: { companyId, competencia },
      include: { funcionarios: true },
    });

    // Busca pro-labore da competencia
    const proLabores = await this.prisma.proLaboreCalculo.findMany({
      where: { companyId, competencia },
    });

    const funcionarios = (folha?.funcionarios ?? []) as any[];
    const totalSalarios        = funcionarios.reduce((s,f) => s + Number(f.totalBruto ?? 0), 0);
    const totalInssEmpregado   = funcionarios.reduce((s,f) => s + Number(f.valorInss ?? 0), 0);
    const totalInssEmpregador  = funcionarios.reduce((s,f) => s + Number(f.valorInssEmpregador ?? 0), 0);
    const totalRat             = funcionarios.reduce((s,f) => s + Number(f.valorRat ?? 0), 0);
    const totalTerceiros       = funcionarios.reduce((s,f) => s + Number(f.valorTerceiros ?? 0), 0);
    const totalIrrf            = funcionarios.reduce((s,f) => s + Number(f.valorIrrf ?? 0), 0);
    const totalFgts            = funcionarios.reduce((s,f) => s + Number(f.valorFgts ?? 0), 0);

    const totalProLaboreInss   = proLabores.reduce((s,p) => s + Number((p as any).inss ?? 0), 0);

    const inssTotal = totalInssEmpregado + totalInssEmpregador + totalRat
                    + totalTerceiros + totalProLaboreInss;

    return {
      competencia,
      folhaId:          folha?.id,
      folhaStatus:      folha?.status ?? 'NAO_CALCULADA',
      numFuncionarios:  funcionarios.length,

      // Grupo 1 — CP (Contribuicao Previdenciaria)
      cp: {
        baseCalculo:          Math.round(totalSalarios * 100) / 100,
        inssEmpregado:        Math.round(totalInssEmpregado * 100) / 100,
        inssEmpregador:       Math.round(totalInssEmpregador * 100) / 100,
        rat:                  Math.round(totalRat * 100) / 100,
        terceiros:            Math.round(totalTerceiros * 100) / 100,
        proLabore:            Math.round(totalProLaboreInss * 100) / 100,
        totalCP:              Math.round(inssTotal * 100) / 100,
      },

      // Grupo 2 — IRRF
      irrf: {
        baseCalculo:  Math.round(totalSalarios * 100) / 100,
        totalIRRF:    Math.round(totalIrrf * 100) / 100,
      },

      // FGTS (nao integra DCTFWeb — informativo)
      fgts: {
        totalFGTS: Math.round(totalFgts * 100) / 100,
        obs: 'FGTS recolhido via GRRF/FGTS Digital (nao integra DCTFWeb)',
      },

      // Total a recolher via DARF
      totalDarf: Math.round((inssTotal + totalIrrf) * 100) / 100,
    };
  }

  // ── Lista competencias com folha calculada ────────────────────────────────────
  async listarCompetencias(companyId: string) {
    const folhas = await this.prisma.folhaMensal.findMany({
      where: { companyId },
      select: { competencia: true, status: true, totalBruto: true,
                totalInssEmpregado: true, totalIrrf: true, totalFgts: true },
      orderBy: { competencia: 'desc' },
    });
    return folhas;
  }
}
