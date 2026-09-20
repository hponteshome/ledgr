// apps/api/src/modules/accounting/services/de-para-sugestao.service.ts
// CRIADO 28/08/2026: reconstroi como funcionalidade real e reutilizavel o
// algoritmo de sugestao de mapeamento ECD -> Matriz, originalmente validado
// e usado via script Python pontual na sessao de 23/08/2026 (370 mapeamentos
// da Hotelsys: 196 SUGGESTED_CONFIRMED + 174 MANUAL), nunca antes persistido
// como codigo da aplicacao.
//
// Algoritmo documentado (23/08/2026), replicado aqui:
//   1. Filtro duro: mesma type + mesma nature entre origem (ECD) e destino (Matriz)
//   2. Grupo binario (so para ASSET/LIABILITY/EQUITY): sobe a cadeia de pais ate
//      achar substring CIRCULANTE / LONGO PRAZO / PERMANENTE / DIFERIDO /
//      IMOBILIZADO / INVESTIMENTO - candidatos fora do mesmo grupo sao descartados.
//      REVENUE/EXPENSE nao tem filtro de grupo (estrutura de DRE diverge demais
//      entre fontes).
//   3. Similaridade de nome (Levenshtein-ratio, equivalente ao difflib.SequenceMatcher
//      do Python) ranqueia os candidatos dentro do grupo.
//   4. Atalho de confianca maxima: reaproveita decisao MANUAL ja confirmada em
//      OUTRA empresa para o mesmo nome normalizado (evita re-derivar por texto
//      o que um contador ja decidiu antes).
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface ContaCandidata {
  id: string; code: string; name: string; type: string; nature: string; parentId: string | null;
}

export interface SugestaoMapeamento {
  sourceId: string; sourceCode: string; sourceName: string;
  targetId: string | null; targetCode: string | null; targetName: string | null;
  confidence: number; // 0 a 1
  matchType: 'REAPROVEITADO' | 'SIMILARIDADE' | 'SEM_SUGESTAO' | 'CONFIRMADO_AUTOMATICO' | 'CONFIRMADO_MANUAL';
  confirmado: boolean; // CRIADO 28/08/2026: ja existe em ecd_account_mappings (gravado), nao e so sugestao pendente
  sourceBalance: number | null; // CRIADO 31/08/2026: saldo declarado mais recente da conta ECD de origem
  sourceBalanceDate: string | null; // data de referencia desse saldo (ISO)
}

const GRUPOS_BP = ['CIRCULANTE', 'LONGO PRAZO', 'PERMANENTE', 'DIFERIDO', 'IMOBILIZADO', 'INVESTIMENTO'];

@Injectable()
export class DeParaSugestaoService {
  constructor(private prisma: PrismaService) {}

  private normalizarNome(nome: string): string {
    return nome
      .toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Levenshtein-ratio: 1 - (distancia / tamanho maximo) - equivalente ao
  // difflib.SequenceMatcher.ratio() do Python usado no script original.
  private similaridade(a: string, b: string): number {
    const s1 = this.normalizarNome(a);
    const s2 = this.normalizarNome(b);
    if (s1 === s2) return 1;
    if (!s1.length || !s2.length) return 0;

    const dp: number[][] = Array.from({ length: s1.length + 1 }, () => new Array(s2.length + 1).fill(0));
    for (let i = 0; i <= s1.length; i++) dp[i][0] = i;
    for (let j = 0; j <= s2.length; j++) dp[0][j] = j;
    for (let i = 1; i <= s1.length; i++) {
      for (let j = 1; j <= s2.length; j++) {
        const custo = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + custo);
      }
    }
    const distancia = dp[s1.length][s2.length];
    return 1 - distancia / Math.max(s1.length, s2.length);
  }

  // Sobe a cadeia de pais ate achar substring de um dos grupos binarios do BP.
  private grupoBalanco(conta: ContaCandidata, porId: Map<string, ContaCandidata>): string | null {
    let atual: ContaCandidata | undefined = conta;
    let profundidade = 0;
    while (atual && profundidade < 10) {
      const nomeNorm = this.normalizarNome(atual.name);
      for (const g of GRUPOS_BP) {
        if (nomeNorm.includes(g)) return g;
      }
      atual = atual.parentId ? porId.get(atual.parentId) : undefined;
      profundidade++;
    }
    return null;
  }

  async sugerirMapeamento(companyId: string, dataFechamentoISO?: string): Promise<{ sugestoes: SugestaoMapeamento[]; destinosDisponiveis: ContaCandidata[] }> {
    // NOVO (16/09/2026): quando dataFechamento e informada, restringe as
    // origens ao LOTE de importacao ECD cujo period_end bate com essa data
    // (mesmo criterio ja usado por abertura.service.ts) e usa o saldo
    // declarado EXATAMENTE nessa data - nao mais "o mais recente de
    // qualquer data". Achado real: conta "CIM A PAGAR" so existe a partir
    // do lote 2018 mas aparecia no De/Para com saldo de 2025 (o mais
    // recente), dando a falsa impressao de que deveria constar na
    // Abertura de 2017.
    let loteIds: string[] | null = null;
    if (dataFechamentoISO) {
      const lotes = await this.prisma.ecdImport.findMany({
        where: { companyId, periodEnd: new Date(dataFechamentoISO + 'T00:00:00Z'), deletedAt: null },
        select: { id: true },
      });
      loteIds = lotes.map(l => l.id);
    }

    const todasContas = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, deletedAt: null, isAnalytic: true },
      include: { ecdImportLinks: { select: { id: true, ecdImportId: true } } },
    });

    // Saldo declarado - se dataFechamento foi informada, so aceita saldo
    // EXATAMENTE naquela data; senao mantem o comportamento antigo (mais
    // recente de qualquer data), para nao quebrar chamadores existentes.
    const saldosRecentes = await this.prisma.accountBalance.findMany({
      where: dataFechamentoISO
        ? { companyId, referenceDate: { gte: new Date(dataFechamentoISO + 'T00:00:00Z'), lte: new Date(dataFechamentoISO + 'T23:59:59Z') } }
        : { companyId },
      orderBy: { referenceDate: 'desc' },
    });
    const saldoPorConta = new Map<string, { balance: number; date: Date }>();
    for (const s of saldosRecentes) {
      if (!saldoPorConta.has(s.accountId)) {
        saldoPorConta.set(s.accountId, { balance: Number(s.balance), date: s.referenceDate });
      }
    }
    const porId = new Map<string, ContaCandidata>(
      todasContas.map(c => [c.id, { id: c.id, code: c.code, name: c.name, type: c.type, nature: c.nature, parentId: c.parentId }]),
    );

    // Origem = tem vinculo ECD (nasceu de importacao real). Destino = Matriz (sem vinculo).
    // Quando dataFechamento foi informada, so entram contas vinculadas ao
    // LOTE daquela data especifica - nao qualquer lote da empresa. Tambem
    // oculta contas com saldo zerado (ou sem registro) naquela data - nao
    // ha nada a mapear ali, e a Abertura (abertura.service.ts) ja ignora
    // saldo zero do mesmo jeito, entao a contagem desta tela fica alinhada
    // com o que de fato vira lancamento.
    const origens = todasContas.filter(c => {
      if (c.ecdImportLinks.length === 0) return false;
      if (!loteIds) return true;
      return c.ecdImportLinks.some(l => loteIds!.includes(l.ecdImportId));
    }).filter(c => {
      if (!dataFechamentoISO) return true;
      const saldo = saldoPorConta.get(c.id);
      return saldo !== undefined && Math.abs(saldo.balance) > 0.004;
    });
    const destinos = todasContas.filter(c => c.ecdImportLinks.length === 0)
      .map(c => ({ id: c.id, code: c.code, name: c.name, type: c.type, nature: c.nature, parentId: c.parentId }));

    // CRIADO 28/08/2026: mapa completo (nao so o Set de ids) - permite exibir
    // os JA CONFIRMADOS na tela tambem (com destaque automatico/manual),
    // nao so os pendentes. Achado real: mapeamento manual errado (CSLL
    // Diferida -> Refeicao/Copa/Cozinha) so foi encontrado via consulta SQL
    // direta, porque a tela escondia tudo que ja estava confirmado.
    const mapeamentosExistentes = await this.prisma.ecdAccountMapping.findMany({
      where: { companyId },
      include: { targetAccount: { select: { id: true, code: true, name: true } } },
    });
    const jaMapeadasMap = new Map(mapeamentosExistentes.map(m => [m.sourceAccountId, m]));

    // Atalho: decisoes MANUAL ja confirmadas em QUALQUER empresa, por nome normalizado de origem -> nome do destino escolhido.
    const decisoesAnteriores = await this.prisma.ecdAccountMapping.findMany({
      where: { matchType: 'MANUAL' },
      include: { sourceAccount: { select: { name: true } }, targetAccount: { select: { name: true } } },
    });
    const reaproveitamento = new Map<string, string>(); // nome normalizado origem -> nome do destino
    for (const d of decisoesAnteriores) {
      const chave = this.normalizarNome(d.sourceAccount.name);
      if (!reaproveitamento.has(chave)) reaproveitamento.set(chave, this.normalizarNome(d.targetAccount.name));
    }

    const sugestoes: SugestaoMapeamento[] = [];

    for (const origem of origens) {
      const saldoOrigem = saldoPorConta.get(origem.id);
      const existente = jaMapeadasMap.get(origem.id);
      if (existente) {
        sugestoes.push({
          sourceId: origem.id, sourceCode: origem.code, sourceName: origem.name,
          targetId: existente.targetAccount.id, targetCode: existente.targetAccount.code, targetName: existente.targetAccount.name,
          confidence: 1, confirmado: true,
          matchType: existente.matchType === 'MANUAL' ? 'CONFIRMADO_MANUAL' : 'CONFIRMADO_AUTOMATICO',
          sourceBalance: saldoOrigem?.balance ?? null, sourceBalanceDate: saldoOrigem?.date.toISOString() ?? null,
        });
        continue;
      }
      const origemConta: ContaCandidata = { id: origem.id, code: origem.code, name: origem.name, type: origem.type, nature: origem.nature, parentId: origem.parentId };

      const candidatos = destinos.filter(d => d.type === origem.type && d.nature === origem.nature);

      let candidatosFiltrados = candidatos;
      if (['ASSET', 'LIABILITY', 'EQUITY'].includes(origem.type)) {
        const grupoOrigem = this.grupoBalanco(origemConta, porId);
        if (grupoOrigem) {
          const comMesmoGrupo = candidatos.filter(c => this.grupoBalanco(c, porId) === grupoOrigem);
          if (comMesmoGrupo.length > 0) candidatosFiltrados = comMesmoGrupo;
        }
      }

      // Atalho de reaproveitamento de decisao anterior
      const chaveOrigem = this.normalizarNome(origem.name);
      const nomeDestinoReaproveitado = reaproveitamento.get(chaveOrigem);
      if (nomeDestinoReaproveitado) {
        const match = candidatosFiltrados.find(c => this.normalizarNome(c.name) === nomeDestinoReaproveitado);
        if (match) {
          sugestoes.push({
            sourceId: origem.id, sourceCode: origem.code, sourceName: origem.name,
            targetId: match.id, targetCode: match.code, targetName: match.name,
            confidence: 1, matchType: 'REAPROVEITADO', confirmado: false,
            sourceBalance: saldoOrigem?.balance ?? null, sourceBalanceDate: saldoOrigem?.date.toISOString() ?? null,
          });
          continue;
        }
      }

      // Similaridade de nome
      let melhor: { conta: ContaCandidata; score: number } | null = null;
      for (const c of candidatosFiltrados) {
        const score = this.similaridade(origem.name, c.name);
        if (!melhor || score > melhor.score) melhor = { conta: c, score };
      }

      if (melhor && melhor.score >= 0.75) {
        sugestoes.push({
          sourceId: origem.id, sourceCode: origem.code, sourceName: origem.name,
          targetId: melhor.conta.id, targetCode: melhor.conta.code, targetName: melhor.conta.name,
          confidence: melhor.score, matchType: 'SIMILARIDADE', confirmado: false,
          sourceBalance: saldoOrigem?.balance ?? null, sourceBalanceDate: saldoOrigem?.date.toISOString() ?? null,
        });
      } else {
        sugestoes.push({
          sourceId: origem.id, sourceCode: origem.code, sourceName: origem.name,
          targetId: melhor?.conta.id ?? null, targetCode: melhor?.conta.code ?? null, targetName: melhor?.conta.name ?? null,
          confidence: melhor?.score ?? 0, matchType: 'SEM_SUGESTAO', confirmado: false,
          sourceBalance: saldoOrigem?.balance ?? null, sourceBalanceDate: saldoOrigem?.date.toISOString() ?? null,
        });
      }
    }

    sugestoes.sort((a, b) => a.sourceCode.localeCompare(b.sourceCode));
    // CRIADO 28/08/2026: expoe a lista de destinos (so contas Matriz, sem
    // vinculo ECD) junto da resposta - achado real na Sunrise: autocomplete
    // do frontend estava oferecendo contas ECD nativas tambem, quando so
    // Matriz faz sentido como destino de mapeamento.
    const destinosOrdenados = [...destinos].sort((a, b) => a.code.localeCompare(b.code));
    return { sugestoes, destinosDisponiveis: destinosOrdenados };
  }

  // NOVO (16/09/2026): lista os exercicios (lotes ECD, sempre 31/12)
  // disponiveis pra essa empresa, com quantas contas relevantes (com
  // saldo != 0 naquela data) ja tem De/Para confirmado - mesmo criterio
  // de "relevante" usado em sugerirMapeamento (saldo zerado nao conta).
  async listarExercicios(companyId: string) {
    const lotes = await this.prisma.ecdImport.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, periodEnd: true },
      orderBy: { periodEnd: 'asc' },
    });

    const resultado: { periodEnd: string; totalContas: number; confirmadas: number; pendentes: number; completo: boolean }[] = [];

    for (const lote of lotes) {
      const dataISO = lote.periodEnd.toISOString().slice(0, 10);
      const contasDoLote = await this.prisma.chartOfAccounts.findMany({
        where: { companyId, deletedAt: null, isAnalytic: true, ecdImportLinks: { some: { ecdImportId: lote.id } } },
        select: { id: true },
      });
      const ids = contasDoLote.map(c => c.id);
      if (ids.length === 0) {
        resultado.push({ periodEnd: dataISO, totalContas: 0, confirmadas: 0, pendentes: 0, completo: false });
        continue;
      }

      const saldos = await this.prisma.accountBalance.findMany({
        where: {
          accountId: { in: ids },
          referenceDate: { gte: new Date(dataISO + 'T00:00:00Z'), lte: new Date(dataISO + 'T23:59:59Z') },
        },
        select: { accountId: true, balance: true },
      });
      const comSaldo = new Set(saldos.filter(s => Math.abs(Number(s.balance)) > 0.004).map(s => s.accountId));
      const relevantes = ids.filter(id => comSaldo.has(id));

      const totalContas = relevantes.length;
      const confirmadas = totalContas === 0 ? 0 : await this.prisma.ecdAccountMapping.count({
        where: { sourceAccountId: { in: relevantes } },
      });

      resultado.push({
        periodEnd: dataISO,
        totalContas,
        confirmadas,
        pendentes: totalContas - confirmadas,
        completo: totalContas > 0 && confirmadas === totalContas,
      });
    }

    return resultado;
  }

  async confirmarMapeamento(
    companyId: string,
    mapeamentos: { sourceId: string; targetId: string; matchType: 'SUGGESTED_CONFIRMED' | 'MANUAL' }[],
    userId: string,
  ) {
    let criados = 0;
    for (const m of mapeamentos) {
      // CORRIGIDO: sourceAccountId e @unique sozinho no schema (nao composto
      // com companyId) - where deve usar so esse campo. createdById e
      // obrigatorio (sem default), precisa vir do usuario autenticado.
      await this.prisma.ecdAccountMapping.upsert({
        where: { sourceAccountId: m.sourceId },
        create: { companyId, sourceAccountId: m.sourceId, targetAccountId: m.targetId, matchType: m.matchType as any, createdById: userId },
        update: { targetAccountId: m.targetId, matchType: m.matchType as any, updatedAt: new Date() },
      });
      criados++;
    }
    return { criados };
  }
}
