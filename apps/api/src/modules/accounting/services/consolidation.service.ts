// apps/api/src/modules/accounting/services/consolidation.service.ts
// CRIADO 19/10/2026: Balanco Consolidado Intercompany.
// - Soma o balanco (contas ASSET/LIABILITY/EQUITY) das empresas escolhidas, conta a conta pelo codigo
//   (todas usam o plano da Matriz). O resultado do periodo ainda nao encerrado entra no PL como linha propria.
// - Eliminacoes: (1) pares intercompany cadastrados em consolidation_pairs - elimina o menor valor entre os
//   dois lados quando os sinais se opoem; a diferenca fica no consolidado e aparece no quadro de pares;
//   (2) investimento x PL a partir das participacoes da Equivalencia Patrimonial (equity_method_investments):
//   zera o investimento (conta + redutora + provisao cadastradas) e o PL da investida, reconhece a
//   participacao dos nao controladores e leva o que sobrar para "Diferenca de consolidacao".
// - Nada e gravado no Contabil: tudo e calculado na consulta.
import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { TrialBalanceService } from './trial-balance.service';
import { isMasterAdmin } from '../../../multi-company/company.interceptor';

const BP_TYPES = new Set(['ASSET', 'LIABILITY', 'EQUITY']);
const EPS = 0.005;
const r2 = (v: number) => Math.round(v * 100) / 100;

export const LINHA_RESULTADO = '~RESULTADO';
export const LINHA_MINORITARIOS = '~MINORITARIOS';
export const LINHA_DIFERENCA = '~DIFERENCA';

export interface PairDto {
  companyAId: string;
  accountACode: string;
  companyBId: string;
  accountBCode: string;
  descricao: string;
}

export interface Linha {
  code: string;
  name: string;
  type: string;
  nature: string;
  level: number;
  isAnalytic: boolean;
  parentCode: string | null;
  porEmpresa: Record<string, number>; // saldo D-C por empresa
  eliminacao: number;                // D-C
}

export interface LancamentoEliminacao {
  origem: 'PAR' | 'INVESTIMENTO';
  referencia: string;
  companyId: string | null;
  empresa: string;
  code: string;
  conta: string;
  valor: number; // D-C (positivo = debito)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ConsolidationService {
  constructor(private prisma: PrismaService, private trialBalance: TrialBalanceService) {}

  // Tabela consolidation_pairs (migracao manual 20261019) acessada por SQL direto - sem model no Prisma.
  private async paresAtivos(): Promise<any[]> {
    return this.prisma.$queryRaw<any[]>`
      SELECT id, company_a_id::text AS "companyAId", account_a_code AS "accountACode",
             company_b_id::text AS "companyBId", account_b_code AS "accountBCode", descricao, created_at AS "createdAt"
        FROM consolidation_pairs
       WHERE deleted_at IS NULL
       ORDER BY created_at, descricao`;
  }

  private async garantirAcesso(user: any, companyIds: string[]) {
    if (isMasterAdmin(user)) return;
    const userId = user?.id ?? user?.sub;
    for (const companyId of companyIds) {
      const v = await this.prisma.userCompany.findFirst({ where: { userId, companyId } });
      if (!v) throw new ForbiddenException('Você não tem acesso a uma das empresas selecionadas.');
    }
  }

  private nomeEmpresa(c: any): string {
    return c?.tradeName || c?.legalName || '';
  }

  // ── Pares intercompany ────────────────────────────────────────────────────
  async listarPares(user: any) {
    let pares = await this.paresAtivos();
    if (!isMasterAdmin(user)) {
      const vinculos = await this.prisma.userCompany.findMany({ where: { userId: user?.id ?? user?.sub }, select: { companyId: true } });
      const minhas = new Set(vinculos.map((v: any) => v.companyId as string));
      pares = pares.filter((p: any) => minhas.has(p.companyAId) && minhas.has(p.companyBId));
    }
    const ids = Array.from(new Set(pares.flatMap((p: any) => [p.companyAId, p.companyBId]))) as string[];
    const empresas = await this.prisma.company.findMany({ where: { id: { in: ids } }, select: { id: true, legalName: true, tradeName: true } });
    const nome = new Map<string, string>(empresas.map((e: any) => [e.id, this.nomeEmpresa(e)]));
    return pares.map((p: any) => ({ ...p, companyAName: nome.get(p.companyAId) ?? '', companyBName: nome.get(p.companyBId) ?? '' }));
  }

  async criarPar(user: any, dto: PairDto) {
    if (!dto?.companyAId || !dto?.companyBId || !dto?.accountACode || !dto?.accountBCode) {
      throw new BadRequestException('Informe as duas empresas e as duas contas.');
    }
    if (!UUID.test(dto.companyAId) || !UUID.test(dto.companyBId)) throw new BadRequestException('Empresa inválida.');
    if (dto.companyAId === dto.companyBId) throw new BadRequestException('As duas contas do par devem ser de empresas diferentes.');
    for (const [cid, code] of [[dto.companyAId, dto.accountACode], [dto.companyBId, dto.accountBCode]]) {
      const conta = await this.prisma.chartOfAccounts.findFirst({ where: { companyId: cid, code: String(code).trim(), deletedAt: null } });
      if (!conta) throw new BadRequestException(`Conta ${code} não encontrada no plano da empresa.`);
    }
    const criadoPor = user?.id ?? user?.sub ?? null;
    const descricao = ((dto.descricao || '').trim() || 'Par intercompany').slice(0, 200);
    const linhas = await this.prisma.$queryRaw<any[]>`
      INSERT INTO consolidation_pairs (company_a_id, account_a_code, company_b_id, account_b_code, descricao, created_by_id)
      VALUES (${dto.companyAId}::uuid, ${String(dto.accountACode).trim()}, ${dto.companyBId}::uuid, ${String(dto.accountBCode).trim()},
              ${descricao}, ${criadoPor && UUID.test(criadoPor) ? criadoPor : null}::uuid)
      RETURNING id`;
    return linhas[0];
  }

  async removerPar(id: string) {
    if (!UUID.test(id || '')) throw new NotFoundException('Par não encontrado.');
    const linhas = await this.prisma.$queryRaw<any[]>`
      UPDATE consolidation_pairs SET deleted_at = now() WHERE id = ${id}::uuid AND deleted_at IS NULL RETURNING id`;
    if (!linhas.length) throw new NotFoundException('Par não encontrado.');
    return { removido: true };
  }

  // ── Consolidacao ──────────────────────────────────────────────────────────
  async consolidar(user: any, companyIds: string[], dateStr: string) {
    const ids = Array.from(new Set((companyIds || []).filter(Boolean)));
    if (ids.length < 1) throw new BadRequestException('Selecione ao menos uma empresa.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) throw new BadRequestException('Data-base inválida (AAAA-MM-DD).');
    await this.garantirAcesso(user, ids);

    const empresasDb = await this.prisma.company.findMany({ where: { id: { in: ids } }, select: { id: true, legalName: true, tradeName: true, taxId: true } });
    const empresas = ids.map(id => empresasDb.find((e: any) => e.id === id)).filter(Boolean) as any[];
    const nomeDe = new Map(empresas.map(e => [e.id, this.nomeEmpresa(e)]));

    const linhas = new Map<string, Linha>();
    const resultadoAberto: Record<string, number> = {}; // D-C por empresa
    const saldoConta = new Map<string, number>();         // `${companyId}|${code}` -> D-C
    const nomeConta = new Map<string, string>();          // `${companyId}|${code}` -> nome
    const idParaCodigo = new Map<string, string>();       // account.id -> `${companyId}|${code}`
    const equityLevel1: Record<string, number> = {};      // D-C do PL (contas EQUITY nivel 1)

    for (const emp of empresas) {
      const tb: any = await this.trialBalance.getTrialBalance(emp.id, new Date(dateStr));
      const balances: any[] = tb?.balances ?? [];
      const codigoPorId = new Map<string, string>(balances.map(b => [b.account.id, b.account.code]));
      resultadoAberto[emp.id] = 0;
      equityLevel1[emp.id] = 0;
      for (const b of balances) {
        const a = b.account;
        const v = Number(b.balance) || 0;
        const chave = `${emp.id}|${a.code}`;
        saldoConta.set(chave, v);
        nomeConta.set(chave, a.name);
        idParaCodigo.set(a.id, chave);
        if (!BP_TYPES.has(a.type)) {
          if (a.isAnalytic) resultadoAberto[emp.id] += v;
          continue;
        }
        if (a.type === 'EQUITY' && a.level === 1) equityLevel1[emp.id] += v;
        let l = linhas.get(a.code);
        if (!l) {
          l = {
            code: a.code, name: a.name, type: a.type, nature: a.nature, level: a.level,
            isAnalytic: !!a.isAnalytic, parentCode: a.parentId ? (codigoPorId.get(a.parentId) ?? null) : null,
            porEmpresa: {}, eliminacao: 0,
          };
          linhas.set(a.code, l);
        }
        l.porEmpresa[emp.id] = (l.porEmpresa[emp.id] ?? 0) + v;
      }
    }

    const lancamentos: LancamentoEliminacao[] = [];
    const elimPorCodigo = new Map<string, number>();
    const elimVirtual: Record<string, number> = { [LINHA_RESULTADO]: 0, [LINHA_MINORITARIOS]: 0, [LINHA_DIFERENCA]: 0 };
    const eliminar = (origem: 'PAR' | 'INVESTIMENTO', referencia: string, companyId: string | null, code: string, valor: number, contaNome?: string) => {
      valor = r2(valor);
      if (Math.abs(valor) < EPS) return;
      lancamentos.push({
        origem, referencia, companyId, empresa: companyId ? (nomeDe.get(companyId) ?? '') : 'Consolidado',
        code: code.startsWith('~') ? '' : code,
        conta: contaNome ?? nomeConta.get(`${companyId}|${code}`) ?? code,
        valor,
      });
      if (code.startsWith('~')) elimVirtual[code] = (elimVirtual[code] ?? 0) + valor;
      else elimPorCodigo.set(code, (elimPorCodigo.get(code) ?? 0) + valor);
    };

    // (1) Pares intercompany
    const paresDb = await this.paresAtivos();
    const pares = paresDb
      .filter((p: any) => ids.includes(p.companyAId) && ids.includes(p.companyBId))
      .map((p: any) => {
        const a = saldoConta.get(`${p.companyAId}|${p.accountACode}`) ?? 0;
        const b = saldoConta.get(`${p.companyBId}|${p.accountBCode}`) ?? 0;
        let eliminado = 0;
        if (a * b < 0) {
          eliminado = Math.min(Math.abs(a), Math.abs(b));
          eliminar('PAR', p.descricao, p.companyAId, p.accountACode, a > 0 ? -eliminado : eliminado);
          eliminar('PAR', p.descricao, p.companyBId, p.accountBCode, b > 0 ? -eliminado : eliminado);
        }
        return {
          id: p.id, descricao: p.descricao,
          companyAId: p.companyAId, empresaA: nomeDe.get(p.companyAId) ?? '', contaA: p.accountACode,
          contaANome: nomeConta.get(`${p.companyAId}|${p.accountACode}`) ?? '(conta não encontrada)', saldoA: r2(a),
          companyBId: p.companyBId, empresaB: nomeDe.get(p.companyBId) ?? '', contaB: p.accountBCode,
          contaBNome: nomeConta.get(`${p.companyBId}|${p.accountBCode}`) ?? '(conta não encontrada)', saldoB: r2(b),
          diferenca: r2(a + b), eliminado: r2(eliminado),
        };
      });

    // (2) Investimento x PL (participacoes cadastradas na Equivalencia)
    const invs = await this.prisma.equityMethodInvestment.findMany({
      where: { deletedAt: null, isActive: true, investorCompanyId: { in: ids }, investeeCompanyId: { in: ids } },
    });
    const porInvestida = new Map<string, any[]>();
    for (const i of invs) porInvestida.set(i.investeeCompanyId, [...(porInvestida.get(i.investeeCompanyId) ?? []), i]);
    const investimentos: any[] = [];
    const avisos: string[] = [];
    const contasCadastradas = new Set<string>();
    for (const i of invs) {
      ([i.investmentAccountId, (i as any).reductionAccountId, (i as any).provisionAccountId].filter(Boolean) as string[])
        .forEach(accId => { const k = idParaCodigo.get(accId); if (k) contasCadastradas.add(k); });
    }
    const investidoras = new Set(invs.map((i: any) => i.investorCompanyId as string));
    for (const [chave, v] of Array.from(saldoConta.entries())) {
      const [cid, code] = chave.split('|');
      if (!investidoras.has(cid) || Math.abs(v) < EPS || contasCadastradas.has(chave)) continue;
      const l = linhas.get(code);
      if (!l || !l.isAnalytic) continue;
      if (/provis.*perda.*invest/i.test(nomeConta.get(chave) ?? '')) {
        avisos.push(`${nomeDe.get(cid)}: a conta ${code} ${nomeConta.get(chave)} tem saldo ${r2(v)} e não está cadastrada na participação da Equivalência - não foi eliminada.`);
      }
    }
    for (const [investida, lista] of Array.from(porInvestida.entries())) {
      const plDC = equityLevel1[investida] + resultadoAberto[investida]; // D-C (negativo = PL positivo)
      const pl = -plDC;
      const pctGrupo = Math.min(100, lista.reduce((s, i) => s + Number(i.percentOwned), 0));
      const ref = `Investimento x PL - ${nomeDe.get(investida)}`;
      // zera o PL da investida (contas EQUITY analiticas) e o resultado em aberto
      for (const [chave, v] of Array.from(saldoConta.entries())) {
        const [cid, code] = chave.split('|');
        if (cid !== investida) continue;
        const l = linhas.get(code);
        if (!l || l.type !== 'EQUITY' || !l.isAnalytic) continue;
        eliminar('INVESTIMENTO', ref, investida, code, -v);
      }
      eliminar('INVESTIMENTO', ref, investida, LINHA_RESULTADO, -resultadoAberto[investida], 'Resultado do período não encerrado');
      let saldoInvestimentos = 0;
      for (const i of lista) {
        const contas = [i.investmentAccountId, (i as any).reductionAccountId, (i as any).provisionAccountId].filter(Boolean) as string[];
        for (const accId of contas) {
          const chave = idParaCodigo.get(accId);
          if (!chave) continue;
          const [cid, code] = chave.split('|');
          const v = saldoConta.get(chave) ?? 0;
          saldoInvestimentos += v;
          eliminar('INVESTIMENTO', ref, cid, code, -v);
        }
        investimentos.push({
          investidora: nomeDe.get(i.investorCompanyId), investida: nomeDe.get(investida),
          percentual: Number(i.percentOwned),
          plInvestida: r2(pl),
          valorEquivalencia: r2(pl * Number(i.percentOwned) / 100),
        });
      }
      const minoritarios = pl * (100 - pctGrupo) / 100;          // credito se PL positivo
      eliminar('INVESTIMENTO', ref, null, LINHA_MINORITARIOS, -minoritarios, 'Participação de não controladores');
      // fecha a eliminacao: o que sobrar e diferenca entre investimento registrado e PL proporcional
      const somaRef = lancamentos.filter(x => x.referencia === ref).reduce((s, x) => s + x.valor, 0);
      eliminar('INVESTIMENTO', ref, null, LINHA_DIFERENCA, -somaRef, 'Diferença de consolidação (investimento x PL)');
      const inv = investimentos.filter(x => x.investida === nomeDe.get(investida));
      inv.forEach(x => { x.saldoInvestimento = r2(saldoInvestimentos); x.minoritarios = r2(minoritarios); });
    }

    // Eliminacoes por codigo, propagadas para as contas sinteticas
    for (const [code, v] of Array.from(elimPorCodigo.entries())) {
      let c: string | null = code;
      const vistos = new Set<string>();
      while (c && !vistos.has(c)) {
        vistos.add(c);
        const l = linhas.get(c);
        if (!l) break;
        l.eliminacao += v;
        c = l.parentCode;
      }
    }

    const resultadoPorEmpresa: Record<string, number> = {};
    for (const id of ids) resultadoPorEmpresa[id] = r2(resultadoAberto[id] ?? 0);

    const linhasSaida = Array.from(linhas.values())
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(l => {
        const soma = Object.values(l.porEmpresa).reduce((s, v) => s + v, 0);
        const porEmpresa: Record<string, number> = {};
        for (const id of ids) porEmpresa[id] = r2(l.porEmpresa[id] ?? 0);
        return {
          code: l.code, name: l.name, type: l.type, nature: l.nature, level: l.level, isAnalytic: l.isAnalytic,
          parentCode: l.parentCode, porEmpresa, soma: r2(soma), eliminacao: r2(l.eliminacao), consolidado: r2(soma + l.eliminacao),
        };
      });

    const somaRes = Object.values(resultadoAberto).reduce((s, v) => s + v, 0);
    const virtuais = [
      { key: LINHA_RESULTADO, name: 'Resultado do período não encerrado', porEmpresa: resultadoPorEmpresa, soma: r2(somaRes), eliminacao: r2(elimVirtual[LINHA_RESULTADO]), consolidado: r2(somaRes + elimVirtual[LINHA_RESULTADO]) },
      { key: LINHA_MINORITARIOS, name: 'Participação de não controladores', porEmpresa: {}, soma: 0, eliminacao: r2(elimVirtual[LINHA_MINORITARIOS]), consolidado: r2(elimVirtual[LINHA_MINORITARIOS]) },
      { key: LINHA_DIFERENCA, name: 'Diferença de consolidação (investimento x PL)', porEmpresa: {}, soma: 0, eliminacao: r2(elimVirtual[LINHA_DIFERENCA]), consolidado: r2(elimVirtual[LINHA_DIFERENCA]) },
    ];

    return {
      dataBase: dateStr,
      empresas: empresas.map(e => ({ id: e.id, nome: this.nomeEmpresa(e), taxId: e.taxId })),
      linhas: linhasSaida,
      virtuais,
      pares,
      investimentos,
      lancamentos,
      avisos,
    };
  }
}
