// src/modules/sped/ecf/services/ecf-importer.service.ts
// REESCRITO 26/08/2026: era um STUB completo (nunca gravava nada no banco,
// so retornava um resultado fabricado com success:true sempre). Achado real
// durante tentativa de usar prejuizo fiscal acumulado (Parte B/e-LALUR) para
// planejar abertura 2018 da Hotelsys em Matriz - confirmado empiricamente
// (3 tabelas com 0 registros mesmo apos import "bem sucedido" na tela).
//
// Tambem corrigido no parser (ecf-parser.service.ts, mesma sessao): M300
// (Parte A) sempre foi capturado corretamente, mas a Parte B REAL (M010
// cadastro+saldo inicial, M410 lancamento do periodo, M500 saldo final -
// registro gerado pelo sistema) nunca era lida - so M350 (que na verdade e
// Parte A do e-LACS/CSLL, nao Parte B) era capturado com o nome enganoso
// "registrosParteB". Validado campo a campo contra 6 ECFs reais da Hotelsys
// (2017, 2020-2024) - ver LEDGR-contexto.md 26/08/2026.
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { EcfParsed } from './ecf-parser.service';

export interface EcfImportResult {
  importId: string;
  status: 'done' | 'partial' | 'error';
  stats: {
    accounts: number;
    accountsSkipped: number;
    balances: number;
    journalEntries: number;
    totalAccountsInDb: number;
    registrosParteA?: number;
    registrosParteB?: number;
  };
  warnings: string[];
  consistency?: any;
  message?: string;
  success: boolean;
}

@Injectable()
export class EcfImporterService {
  private readonly logger = new Logger(EcfImporterService.name);

  constructor(private prisma: PrismaService) {}

  /** Extrai o ano-calendario (period) a partir da data final do periodo (DDMMAAAA -> AAAA) */
  private extractPeriod(parsed: EcfParsed): string {
    const dtFim = parsed.periodEnd || parsed.reg0000?.periodEnd || '';
    if (dtFim.length === 8) return dtFim.slice(4, 8);
    return 'DESCONHECIDO';
  }

  /** Normaliza CNPJ (so digitos) para comparar arquivo x empresa alvo */
  private onlyDigits(v: string): string {
    return (v || '').replace(/\D/g, '');
  }

  async import(parsed: EcfParsed, companyId: string, userId: string, fileName?: string): Promise<EcfImportResult> {
    this.logger.log(`Importando ECF para empresa ${companyId}`);
    const warnings: string[] = [];
    // CORRIGIDO 26/08/2026: @CurrentUser() no controller retorna o objeto
    // completo do usuario em runtime, apesar da assinatura dizer `string` -
    // achado real ao tentar gravar createdById (Prisma exige string/null).
    // Normaliza aqui em vez de mexer no decorator (pode ter outros usos
    // legitimos do objeto completo em outros controllers).
    const createdById: string | null =
      userId && typeof userId === 'object' ? (userId as any).id ?? null : (userId ?? null);

    try {
      // ── 0. Validacao de seguranca: CNPJ do arquivo bate com a empresa alvo? ──
      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (!company) throw new BadRequestException('Empresa nao encontrada.');

      const cnpjArquivo = this.onlyDigits(parsed.reg0000?.cnpj || '');
      const cnpjEmpresa = this.onlyDigits(company.taxId || '');
      if (cnpjArquivo && cnpjEmpresa && cnpjArquivo !== cnpjEmpresa) {
        throw new BadRequestException(
          `CNPJ do arquivo (${cnpjArquivo}) nao corresponde ao CNPJ da empresa selecionada (${cnpjEmpresa}). Importacao bloqueada por seguranca.`,
        );
      }

      const period = this.extractPeriod(parsed);
      if (period === 'DESCONHECIDO') {
        warnings.push('Nao foi possivel determinar o periodo (ano) do arquivo a partir do registro 0000.');
      }

      // ── 1. Parte A (M300) - padrao substituicao: apaga o periodo e regrava ──
      // CORRIGIDO 26/08/2026: M300 se repete uma vez por sub-periodo K030/N030
      // dentro do ano (13x: anual A00 + 12 meses A01-A12) - achado real ao
      // exibir a tela de LALUR, toda conta aparecia duplicada 13x identica.
      // O bloco K030 vem ANTES do M no arquivo e a 1a repeticao de cada
      // codigo M300 corresponde ao periodo ANUAL (A00, sempre o primeiro
      // K030 do arquivo) - mantem so a 1a ocorrencia de cada codCta.
      const parteAAnual = new Map<string, typeof parsed.lalurParteA[number]>();
      for (const e of parsed.lalurParteA) {
        if (!e.codCta) continue;
        if (!parteAAnual.has(e.codCta)) parteAAnual.set(e.codCta, e);
      }

      await this.prisma.ecfPartA.deleteMany({ where: { companyId, period } });
      if (parteAAnual.size > 0) {
        await this.prisma.ecfPartA.createMany({
          data: Array.from(parteAAnual.values()).map(e => ({
            companyId,
            code: e.codCta,
            description: e.descLanc || '(sem descricao)',
            value: e.vlLanc,
            type: e.tipo || '',
            period,
          })),
        });
      }

      // ── 2. Parte B (M500 = saldo definitivo do periodo) - upsert idempotente ──
      // CORRIGIDO 26/08/2026: M500 se repete varias vezes no arquivo (um bloco
      // por K030/N030 dentro do ano) - a suposicao inicial de "pegar a ultima
      // ocorrencia" estava ERRADA (achado real: para a Hotelsys 2023, a ultima
      // ocorrencia no arquivo era uma repeticao SEM movimento, perdendo o
      // lancamento real de compensacao). Regra correta: pegar o MAIOR vlSldFin
      // por (codCta,tipoTributo) - prejuizo fiscal so cresce ou compensa dentro
      // do mesmo arquivo, nunca "recua" espontaneamente; isso tambem escolhe
      // automaticamente a versao mais corrigida quando ha duas declaracoes
      // proximas na mesma retificadora (achado real: 2023 tinha duas versoes
      // do movimento diferindo em R$100, a de maior saldo final e a corrigida).
      const saldosPorConta = new Map<string, typeof parsed.partBSaldos[number]>();
      for (const s of parsed.partBSaldos) {
        if (!s.codCta) continue;
        const chave = `${s.codCta}|${s.tipoTributo}`;
        const atual = saldosPorConta.get(chave);
        if (!atual || s.vlSldFin > atual.vlSldFin) {
          saldosPorConta.set(chave, s);
        }
      }

      let partBCount = 0;
      for (const [chave, saldo] of saldosPorConta) {
        // busca descricao no M010 (cadastro da conta) - pode haver mais de uma
        // linha M010 para a mesma conta+tributo (ex: "SALDO ANTERIOR" e
        // "PREJUIZO DO PERIODO"); usa a primeira encontrada.
        const cadastro = parsed.partBAccounts.find(
          a => a.codCta === saldo.codCta && a.tipoTributo === saldo.tipoTributo,
        );
        const descricao = cadastro?.descricao || `Conta Parte B ${saldo.codCta} (${saldo.tipoTributo})`;
        const movimento = Number((saldo.vlSldFin - saldo.vlSldIni).toFixed(2));

        await this.prisma.ecfPartB.upsert({
          where: {
            companyId_accountCode_tipoTributo_period: {
              companyId, accountCode: saldo.codCta, tipoTributo: saldo.tipoTributo, period,
            },
          },
          create: {
            companyId, accountCode: saldo.codCta, tipoTributo: saldo.tipoTributo, period,
            description: descricao, saldoInicial: saldo.vlSldIni, movimento, balance: saldo.vlSldFin,
          },
          update: {
            description: descricao, saldoInicial: saldo.vlSldIni, movimento, balance: saldo.vlSldFin,
          },
        });
        partBCount++;
      }

      if (parsed.partBSaldos.length === 0) {
        warnings.push('Nenhum registro M500 (saldo Parte B) encontrado neste arquivo.');
      }

      const totalAccountsInDb = await this.prisma.ecfPartB.count({ where: { companyId } });

      // CRIADO 26/08/2026: log de importacao (metadado, separado do dado em
      // si) - necessario para a tela de Historico. Substitui (nao acumula)
      // logs anteriores do MESMO periodo, para reimportacao ficar idempotente
      // tambem no historico, nao so no dado.
      await this.prisma.ecfImportLog.deleteMany({ where: { companyId, period } });
      await this.prisma.ecfImportLog.create({
        data: {
          companyId,
          fileName: fileName || `ECF_${period}.txt`,
          layoutVersion: parsed.reg0000?.codVer || null,
          periodStart: parsed.periodStart || '',
          periodEnd: parsed.periodEnd || '',
          period,
          accounts: parsed.accounts?.length || 0,
          journalEntries: parsed.journalEntries?.length || 0,
          registrosParteA: parsed.lalurParteA.length,
          registrosParteB: partBCount,
          status: warnings.length > 0 ? 'partial' : 'done',
          warnings: warnings.length > 0 ? warnings : undefined,
          createdById,
        },
      });

      this.logger.log(
        `ECF importada: empresa=${companyId} periodo=${period} parteA=${parsed.lalurParteA.length} parteB=${partBCount}`,
      );

      return {
        success: true,
        importId: `ecf_${companyId}_${period}_${Date.now()}`,
        status: warnings.length > 0 ? 'partial' : 'done',
        stats: {
          accounts: parsed.accounts?.length || 0,
          accountsSkipped: 0,
          balances: partBCount,
          journalEntries: parsed.journalEntries?.length || 0,
          totalAccountsInDb,
          registrosParteA: parsed.lalurParteA.length,
          registrosParteB: partBCount,
        },
        warnings,
        message: `ECF (${period}) importada com sucesso.`,
      };
    } catch (error: any) {
      this.logger.error(`Erro ao importar ECF: ${error.message}`);
      return {
        success: false,
        importId: `ecf_error_${Date.now()}`,
        status: 'error',
        stats: { accounts: 0, accountsSkipped: 0, balances: 0, journalEntries: 0, totalAccountsInDb: 0 },
        warnings,
        message: `Erro na importacao: ${error.message}`,
      };
    }
  }

  async getImports(companyId: string): Promise<any[]> {
    const logs = await this.prisma.ecfImportLog.findMany({
      where: { companyId },
      orderBy: { period: 'desc' },
    });
    return logs.map(l => ({
      id: l.id,
      fileName: l.fileName,
      layoutVersion: l.layoutVersion,
      periodStart: l.periodStart,
      periodEnd: l.periodEnd,
      status: l.status,
      importedAt: l.createdAt,
      stats: {
        accounts: l.accounts,
        journalEntries: l.journalEntries,
        registrosParteA: l.registrosParteA,
        registrosParteB: l.registrosParteB,
      },
    }));
  }

  async getImportById(companyId: string, id: string): Promise<any> {
    return null; // nao ha registro de "importId" persistido individualmente ainda
  }

  async deleteImport(companyId: string, id: string): Promise<any> {
    return { message: 'Operacao nao implementada - use exclusao por periodo se necessario.' };
  }

  async getSummary(companyId: string): Promise<any> {
    const [totalPartA, totalPartB, periodos] = await Promise.all([
      this.prisma.ecfPartA.count({ where: { companyId } }),
      this.prisma.ecfPartB.count({ where: { companyId } }),
      this.prisma.ecfPartB.findMany({ where: { companyId }, distinct: ['period'], select: { period: true }, orderBy: { period: 'asc' } }),
    ]);
    return {
      totalImports: periodos.length,
      lastImport: periodos.length > 0 ? periodos[periodos.length - 1].period : null,
      accountsCount: 0,
      balancesCount: totalPartB,
      totalRegistrosParteA: totalPartA,
      totalRegistrosParteB: totalPartB,
      periodosImportados: periodos.map(p => p.period),
    };
  }

  async getBalances(companyId: string, periodEnd?: string): Promise<any[]> {
    return this.prisma.ecfPartB.findMany({
      where: { companyId, ...(periodEnd ? { period: periodEnd } : {}) },
      orderBy: [{ period: 'asc' }, { accountCode: 'asc' }],
    });
  }

  // CRIADO 26/08/2026: visualizacao do LALUR (Parte A + Parte B) para tela
  // dedicada - Parte B como pivot (conta x periodo, mesmo padrao usado na
  // Tabela Comparativa ECD x Matriz e no Comparativo de Saldos, 24-25/08/2026).
  async getLalurView(companyId: string) {
    const [parteA, parteB] = await Promise.all([
      this.prisma.ecfPartA.findMany({
        where: { companyId },
        orderBy: [{ period: 'desc' }, { code: 'asc' }],
      }),
      this.prisma.ecfPartB.findMany({
        where: { companyId },
        orderBy: [{ period: 'asc' }, { accountCode: 'asc' }],
      }),
    ]);

    const periodos = Array.from(new Set(parteB.map(b => b.period))).sort();

    const porConta = new Map<string, any>();
    for (const b of parteB) {
      const chave = `${b.accountCode}|${b.tipoTributo}`;
      if (!porConta.has(chave)) {
        porConta.set(chave, {
          accountCode: b.accountCode,
          tipoTributo: b.tipoTributo,
          descricao: b.description,
          saldos: {},
        });
      }
      porConta.get(chave).saldos[b.period] = {
        saldoInicial: Number(b.saldoInicial),
        movimento: Number(b.movimento),
        balance: Number(b.balance),
      };
    }

    return {
      periodos,
      parteB: Array.from(porConta.values()),
      parteA: parteA.map(a => ({
        period: a.period, code: a.code, description: a.description,
        value: Number(a.value), type: a.type,
      })),
    };
  }
}
