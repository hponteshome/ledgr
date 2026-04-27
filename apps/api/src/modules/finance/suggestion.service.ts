// ============================================================
// LEDGR — apps/api/src/modules/bank-import/suggestion.service.ts
// Motor de sugestão de conta contábil — 3 camadas
// ============================================================
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { normalizeText } from './parsers/bank-parser.service';

export interface SuggestionResult {
  accountId:   string | null;
  memoTemplate: string | null;
  source:      'FIXED' | 'LEARNED' | 'FUZZY' | null;
  confidence:  number;  // 0–100
}

// ── Regras fixas do sistema (keywords → conta padrão) ────────
// Ajuste os accountIds conforme o Plano de Contas do projeto
const FIXED_RULES: {
  patterns: string[];
  type?:    'DEBIT' | 'CREDIT';
  memo:     string;
  category: string; // para diagnóstico
}[] = [
  // Impostos e tributos
  { patterns: ['DARF', 'RECEITA FEDERAL', 'RFB'],             type: 'DEBIT',  memo: 'Recolhimento DARF',           category: 'IMPOSTOS' },
  { patterns: ['GPS', 'INSS', 'PREVIDENCIA'],                  type: 'DEBIT',  memo: 'Recolhimento INSS/GPS',       category: 'IMPOSTOS' },
  { patterns: ['FGTS', 'CAIXA ECON FED FGTS'],                 type: 'DEBIT',  memo: 'Recolhimento FGTS',           category: 'IMPOSTOS' },
  { patterns: ['SIMPLES NACIONAL', 'DAS '],                    type: 'DEBIT',  memo: 'Pagamento DAS Simples',       category: 'IMPOSTOS' },
  { patterns: ['ISS ', 'ISSQN'],                               type: 'DEBIT',  memo: 'Pagamento ISS',               category: 'IMPOSTOS' },
  // Folha / RH
  { patterns: ['FOLHA', 'SALARIO', 'PGTO FUNC', 'VENCIMENTO'], type: 'DEBIT',  memo: 'Pagamento de Salários',       category: 'FOLHA' },
  { patterns: ['13 SALARIO', 'DECIMO TERCEIRO'],               type: 'DEBIT',  memo: 'Pagamento 13º Salário',       category: 'FOLHA' },
  { patterns: ['FERIAS', 'FÉRIAS'],                            type: 'DEBIT',  memo: 'Pagamento de Férias',         category: 'FOLHA' },
  // Contas de consumo
  { patterns: ['ENEL', 'CPFL', 'LIGHT', 'CEMIG', 'COELBA', 'CELPE', 'ENERGISA'], type: 'DEBIT', memo: 'Conta de Energia Elétrica', category: 'CONSUMO' },
  { patterns: ['SABESP', 'SANEAGO', 'CAGECE', 'EMBASA', 'COPASA', 'CORSAN'],      type: 'DEBIT', memo: 'Conta de Água e Esgoto',    category: 'CONSUMO' },
  { patterns: ['CLARO', 'VIVO', 'TIM ', 'OI ', 'NEXTEL', 'TELEFONICA'],           type: 'DEBIT', memo: 'Conta Telefonia',          category: 'CONSUMO' },
  { patterns: ['CONDOMINIO', 'CONDOM'],                        type: 'DEBIT',  memo: 'Taxa de Condomínio',          category: 'CONSUMO' },
  { patterns: ['ALUGUEL', 'LOCACAO', 'LOCAÇÃO'],               type: 'DEBIT',  memo: 'Aluguel',                    category: 'ALUGUEL' },
  // Serviços financeiros
  { patterns: ['TARIFA', 'TAR ', 'MANUTENCAO CC', 'PACOTE SERV'], type: 'DEBIT', memo: 'Tarifas Bancárias',         category: 'BANCARIO' },
  { patterns: ['IOF '],                                        type: 'DEBIT',  memo: 'IOF',                         category: 'BANCARIO' },
  { patterns: ['JUROS', 'MORA'],                               type: 'DEBIT',  memo: 'Juros e Encargos',            category: 'BANCARIO' },
  { patterns: ['REND ', 'RENDIMENTO', 'APLIC', 'SELIC', 'INVEST'], type: 'CREDIT', memo: 'Rendimento de Aplicação', category: 'RENDIMENTO' },
  // Receitas
  { patterns: ['RECEBIMENTO', 'COBR', 'BOLETO REC'],           type: 'CREDIT', memo: 'Recebimento de Cliente',     category: 'RECEITA' },
  { patterns: ['PIX REC', 'PIX RECEB'],                        type: 'CREDIT', memo: 'Recebimento via PIX',        category: 'RECEITA' },
  // Transferências (aguarda classificação)
  { patterns: ['PIX TRANSF', 'TED ', 'DOC '],                  memo: 'Transferência bancária',                     category: 'TRANSFERENCIA' },
];

@Injectable()
export class SuggestionService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Sugere conta para uma lista de transações ───────────────
  async suggestBatch(
    companyId: string,
    transactions: { descriptionNorm: string; type: 'DEBIT' | 'CREDIT' }[],
  ): Promise<SuggestionResult[]> {
    // Carrega todas as regras aprendidas da empresa de uma vez
    const learnedRules = await this.prisma.bankImportRule.findMany({
      where: { companyId },
      orderBy: { usageCount: 'desc' },
    });

    return Promise.all(
      transactions.map(tx =>
        this.suggest(tx.descriptionNorm, tx.type, learnedRules),
      ),
    );
  }

  // ── Sugere conta para uma transação ─────────────────────────
  async suggest(
    descNorm:     string,
    type:         'DEBIT' | 'CREDIT',
    learnedRules: any[],
  ): Promise<SuggestionResult> {
    // CAMADA 1 — Regras aprendidas da empresa (maior prioridade)
    const learned = this.matchLearned(descNorm, type, learnedRules);
    if (learned) return learned;

    // CAMADA 2 — Regras fixas por keyword
    const fixed = this.matchFixed(descNorm, type);
    if (fixed) return fixed;

    // CAMADA 3 — Similaridade fuzzy com regras aprendidas
    const fuzzy = this.matchFuzzy(descNorm, type, learnedRules);
    if (fuzzy) return fuzzy;

    return { accountId: null, memoTemplate: null, source: null, confidence: 0 };
  }

  // ── Aprende: registra/incrementa regra após confirmação ─────
  async learn(
    companyId:   string,
    descNorm:    string,
    type:        'DEBIT' | 'CREDIT',
    accountId:   string,
    memo:        string,
    userId:      string,
    bankCode?:   string,
  ) {
    const pattern = this.extractPattern(descNorm);

    await this.prisma.bankImportRule.upsert({
      where: {
        companyId_textPattern_bankCode_type: {
          companyId,
          textPattern: pattern,
          bankCode:    (bankCode ?? null) as any,
          type:        type as any,
        },
      },
      update: {
        accountId,
        memoTemplate: memo,
        usageCount:   { increment: 1 },
        lastUsedAt:   new Date(),
      },
      create: {
        companyId,
        textPattern:  pattern,
        bankCode:     (bankCode ?? null) as any,
        type:         type as any,
        accountId,
        memoTemplate: memo,
        usageCount:   1,
        lastUsedAt:   new Date(),
        isFixed:      false,
        createdById:  userId,
      },
    });
  }

  // ── CAMADA 1: Regras aprendidas ──────────────────────────────
  private matchLearned(
    descNorm:  string,
    type:      'DEBIT' | 'CREDIT',
    rules:     any[],
  ): SuggestionResult | null {
    // Filtra por tipo e ordena por usageCount
    const candidates = rules.filter(r =>
      (!r.type || r.type === type) &&
      descNorm.includes(r.textPattern),
    );
    if (candidates.length === 0) return null;

    const best = candidates[0]; // já ordenado por usageCount desc
    return {
      accountId:    best.accountId,
      memoTemplate: best.memoTemplate,
      source:       'LEARNED',
      confidence:   Math.min(50 + best.usageCount * 5, 95),
    };
  }

  // ── CAMADA 2: Regras fixas por keyword ───────────────────────
  private matchFixed(
    descNorm: string,
    type:     'DEBIT' | 'CREDIT',
  ): SuggestionResult | null {
    for (const rule of FIXED_RULES) {
      if (rule.type && rule.type !== type) continue;
      const hit = rule.patterns.some(p => descNorm.includes(normalizeText(p)));
      if (hit) {
        return {
          accountId:    null, // será resolvido pelo serviço com o plano de contas
          memoTemplate: rule.memo,
          source:       'FIXED',
          confidence:   80,
        };
      }
    }
    return null;
  }

  // ── CAMADA 3: Fuzzy / similaridade ──────────────────────────
  private matchFuzzy(
    descNorm:  string,
    type:      'DEBIT' | 'CREDIT',
    rules:     any[],
  ): SuggestionResult | null {
    const descTokens = new Set(descNorm.split(' ').filter(t => t.length > 3));
    let bestScore = 0;
    let bestRule:  any = null;

    for (const rule of rules) {
      if (rule.type && rule.type !== type) continue;
      const ruleTokens = rule.textPattern.split(' ').filter((t: string) => t.length > 3);
      const matches = ruleTokens.filter((t: string) => descTokens.has(t)).length;
      const score   = ruleTokens.length > 0 ? matches / ruleTokens.length : 0;
      if (score > bestScore && score >= 0.5) {
        bestScore = score;
        bestRule  = rule;
      }
    }

    if (!bestRule) return null;
    return {
      accountId:    bestRule.accountId,
      memoTemplate: bestRule.memoTemplate,
      source:       'FUZZY',
      confidence:   Math.round(bestScore * 70),
    };
  }

  // ── Extrai padrão representativo do texto normalizado ────────
  private extractPattern(descNorm: string): string {
    // Remove datas, valores, números de documentos longos
    return descNorm
      .replace(/\d{5,}/g, '')   // remove números longos (doc, CPF, etc.)
      .replace(/\d{2}\/\d{2}/, '') // remove datas
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60);             // limita o padrão a 60 chars
  }

  // ── Retorna categoria/memo da regra fixa para log ────────────
  getCategoryFromFixed(descNorm: string, type: 'DEBIT' | 'CREDIT'): string | null {
    for (const rule of FIXED_RULES) {
      if (rule.type && rule.type !== type) continue;
      if (rule.patterns.some(p => descNorm.includes(normalizeText(p)))) {
        return (rule as any).category ?? null;
      }
    }
    return null;
  }
}
