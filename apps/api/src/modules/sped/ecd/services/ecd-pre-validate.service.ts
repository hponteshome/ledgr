// apps/api/src/modules/sped/ecd/services/ecd-pre-validate.service.ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "@prisma/prisma.service";

export interface PreValidateResult {
  type: "error" | "warning";
  code: string;
  message: string;
  detail: string;
}

@Injectable()
export class EcdPreValidateService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(companyId: string, periodStart: Date, periodEnd: Date): Promise<PreValidateResult[]> {
    const errors: PreValidateResult[] = [];

    // Meses do periodo
    const months: { year: number; month: number }[] = [];
    const cur = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), 1));
    const end = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), 1));
    while (cur <= end) {
      months.push({ year: cur.getUTCFullYear(), month: cur.getUTCMonth() + 1 });
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }

    // ── 1. Fechamento mensal (warning apenas) ────────────────────────
    const fechamentos = await this.prisma.fechamentoMensal.findMany({
      where: { companyId },
      select: { competencia: true, status: true },
    });
    const fechMap = new Map(fechamentos.map(f => [f.competencia.slice(0, 7), f.status]));

    for (const { year, month } of months) {
      const key = year + "-" + String(month).padStart(2, "0");
      const status = fechMap.get(key);
      if (!status) {
        errors.push({
          type: "warning", code: "FECHAMENTO_NAO_ENCONTRADO",
          message: "Fechamento de " + key + " nao registrado",
          detail: "Recomendado registrar o fechamento mensal antes de transmitir a RFB.",
        });
      } else if (!["FECHADO", "FECHADO_PREVIO"].includes(status)) {
        errors.push({
          type: "warning", code: "FECHAMENTO_NAO_FECHADO",
          message: "Fechamento de " + key + " com status " + status,
          detail: "Recomendado fechar o periodo antes de transmitir a RFB.",
        });
      }
    }

    // ── 2. Equilibrio dos lancamentos ────────────────────────────────
    const items = await this.prisma.journalEntryItem.findMany({
      where: { journalEntry: { companyId, date: { gte: periodStart, lte: periodEnd }, deletedAt: null } },
      select: { type: true, value: true },
    });
    let totalDeb = 0; let totalCre = 0;
    for (const i of items) {
      if (i.type === "DEBIT") totalDeb += Number(i.value);
      else totalCre += Number(i.value);
    }
    const diff = Math.abs(totalDeb - totalCre);
    if (diff > 0.02) {
      errors.push({
        type: "error", code: "DESEQUILIBRIO_LANCAMENTOS",
        message: "Lancamentos desequilibrados: D=" + totalDeb.toFixed(2) + " C=" + totalCre.toFixed(2),
        detail: "A soma dos debitos deve ser igual a soma dos creditos no periodo.",
      });
    }

    // ── 3. Saldo inicial equilibrado ─────────────────────────────────
    const saldoIniRows = await this.prisma.accountBalance.findMany({
      where: { companyId, referenceDate: { lt: periodStart } },
      include: { account: { select: { isAnalytic: true } } },
    });
    let saldoIniTotal = 0;
    for (const r of saldoIniRows) {
      if (r.account?.isAnalytic) saldoIniTotal += Number(r.balance);
    }
    if (Math.abs(saldoIniTotal) > 0.02) {
      errors.push({
        type: "warning", code: "SALDO_INICIAL_DESEQUILIBRADO",
        message: "Saldo inicial desequilibrado: " + saldoIniTotal.toFixed(2),
        detail: "A soma dos saldos iniciais analiticos deve ser zero (D=C).",
      });
    }

    // ── 4. Plano de contas vazio ─────────────────────────────────────
    const totalAnaliticas = await this.prisma.chartOfAccounts.count({
      where: { companyId, isAnalytic: true, deletedAt: null },
    });
    if (totalAnaliticas === 0) {
      errors.push({
        type: "error", code: "PLANO_CONTAS_VAZIO",
        message: "Plano de contas sem contas analiticas",
        detail: "Importe ou cadastre o plano de contas antes de gerar a ECD.",
      });
    }

    // ── 5. Lancamentos sem conta valida ──────────────────────────────
    const allItems = await this.prisma.journalEntryItem.findMany({
      where: { journalEntry: { companyId, date: { gte: periodStart, lte: periodEnd }, deletedAt: null } },
      select: { accountId: true },
    });
    const accountIds = [...new Set(allItems.map(i => i.accountId))];
    const validAccounts = await this.prisma.chartOfAccounts.findMany({
      where: { id: { in: accountIds }, companyId },
      select: { id: true },
    });
    const validIds = new Set(validAccounts.map(a => a.id));
    const semConta = allItems.filter(i => !validIds.has(i.accountId)).length;
    if (semConta > 0) {
      errors.push({
        type: "error", code: "ITEM_SEM_CONTA",
        message: semConta + " partidas sem conta contabil vinculada",
        detail: "Acesse Contabilidade -> Lancamentos e corrija as partidas sem conta.",
      });
    }

    // ── AVISOS ───────────────────────────────────────────────────────

    // A. Bloco J sem visoes contabeis
    const views = await this.prisma.accountingView.count({
      where: { companyId, anoBase: periodStart.getUTCFullYear(), isActive: true },
    });
    if (views === 0) {
      errors.push({
        type: "warning", code: "SEM_VISOES_CONTABEIS",
        message: "Balanco Patrimonial e DRE (Bloco J) nao serao incluidos",
        detail: "O arquivo gerado nao contera demonstracoes contabeis. Sera necessario incluir manualmente antes de transmitir a RFB.",
      });
    }

    // B. Contas com data de criacao posterior ao periodo
    const contasPosteriores = await this.prisma.chartOfAccounts.count({
      where: { companyId, deletedAt: null, createdAt: { gt: periodEnd } },
    });
    if (contasPosteriores > 0) {
      errors.push({
        type: "warning", code: "CONTAS_POSTERIORES",
        message: contasPosteriores + " contas criadas apos " + periodEnd.toLocaleDateString("pt-BR"),
        detail: "O PGE emitira advertencias de data para essas contas. Nao impede a transmissao.",
      });
    }

    // C. Orgao de registro
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { nire: true },
    });
    if (!company?.nire) {
      errors.push({
        type: "warning", code: "SEM_ORGAO_REGISTRO",
        message: "Codigo da entidade registral (Junta Comercial) nao cadastrado",
        detail: "Acesse Cadastro da Empresa e preencha o campo Orgao de Registro antes de transmitir.",
      });
    }

    return errors;
  }
}
