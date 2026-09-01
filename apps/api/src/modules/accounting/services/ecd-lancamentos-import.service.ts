// apps/api/src/modules/accounting/services/ecd-lancamentos-import.service.ts
// CRIADO 01/09/2026: importa a movimentacao REAL da ECD (registros I200/I250)
// como lancamentos LEDGR de verdade, apontando para as contas MATRIZ (via
// ecd_account_mappings ja confirmado), tageados sourceModule=ECD_IMPORT.
//
// Reaproveita o EcdParserService ja existente (mesmo parser usado na
// importacao original de ECD) - so muda o DESTINO do resultado: em vez de
// gravar account_balances/journal_entry_items nas contas NATIVAS, resolve
// cada conta de origem pelo de/para ja confirmado e grava direto nas contas
// da MATRIZ.
//
// Fluxo: preview (dry-run, mostra resumo + acusa contas sem de/para
// confirmado, SEM criar nada) -> registrar (so roda se preview nao acusou
// pendencia, cria journal_entry + items de verdade).
//
// Protecao contra duplicacao (mesmo padrao do bug corrigido em
// abertura.service.ts): re-registrar o MESMO lote (mesma referencia,
// "ECD-{ano}") sempre SUBSTITUI as entradas anteriores desse lote, nunca
// soma.
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EcdParserService } from '../../sped/ecd/services/ecd-parser.service';

export interface PreviewLancamentosEcd {
  ano: number;
  loteReferencia: string;
  totalLancamentos: number;
  totalItens: number;
  dataInicial: string | null;
  dataFinal: string | null;
  contasNaoMapeadas: { code: string; ocorrencias: number }[];
  podeRegistrar: boolean;
}

interface ItemResolvido { accountId: string; value: number; type: 'DEBIT' | 'CREDIT'; }
interface EntradaResolvida { date: Date; items: ItemResolvido[]; isClosingEntry: boolean; }

@Injectable()
export class EcdLancamentosImportService {
  constructor(
    private prisma: PrismaService,
    private ecdParser: EcdParserService,
  ) {}

  // Extrai o ano direto do proprio arquivo (registro 0000, DT_FIN) - nao
  // depende do usuario informar, elimina risco de erro manual.
  private extrairAno(parsed: ReturnType<EcdParserService['parse']>): number {
    const periodEnd = parsed.reg0000?.periodEnd;
    if (!periodEnd || periodEnd.length !== 8) {
      throw new BadRequestException('Nao foi possivel identificar o ano do arquivo (registro 0000 ausente ou invalido).');
    }
    return Number(periodEnd.substring(4, 8));
  }

  private parseDataDDMMAAAA(d: string): Date {
    const dia = d.substring(0, 2);
    const mes = d.substring(2, 4);
    const ano = d.substring(4, 8);
    return new Date(`${ano}-${mes}-${dia}T12:00:00Z`);
  }

  // Resolve todos os itens do arquivo contra o de/para ja confirmado -
  // NAO cria nada, so calcula e acusa pendencias.
  private async resolver(companyId: string, fileContent: string) {
    const parsed = this.ecdParser.parse(fileContent);

    // mapa: codigo da conta nativa -> id da conta MATRIZ (via de/para confirmado)
    const contasNativas = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, code: true },
    });
    const idPorCodigo = new Map(contasNativas.map(c => [c.code, c.id]));

    const mapeamentos = await this.prisma.ecdAccountMapping.findMany({
      where: { companyId },
      select: { sourceAccountId: true, targetAccountId: true },
    });
    const targetPorSourceId = new Map(mapeamentos.map(m => [m.sourceAccountId, m.targetAccountId]));

    const naoMapeadas = new Map<string, number>();
    const entradas: EntradaResolvida[] = [];

    for (const { entry, items } of parsed.journalEntries) {
      const itemsResolvidos: ItemResolvido[] = [];
      let temPendencia = false;

      for (const item of items) {
        // CORRIGIDO 01/09/2026: I250.accountCode vem com pontos
        // ("2.1.03.001.126"), mas chart_of_accounts.code guarda numero bruto
        // sem formatacao ("2103001126") - regra ja estabelecida no projeto
        // (numero bruto sempre, formatacao so na exibicao). Achado real ao
        // testar com a ECD 2018 da Hotelsys: 32 contas "sem mapeamento" eram
        // na verdade so incompatibilidade de formato, nao pendencia real.
        const codigoNormalizado = item.accountCode.replace(/\D/g, '');
        const nativeId = idPorCodigo.get(item.accountCode) ?? idPorCodigo.get(codigoNormalizado);
        const targetId = nativeId ? targetPorSourceId.get(nativeId) : undefined;
        if (!targetId) {
          naoMapeadas.set(item.accountCode, (naoMapeadas.get(item.accountCode) ?? 0) + 1);
          temPendencia = true;
          continue;
        }
        itemsResolvidos.push({
          accountId: targetId,
          value: item.value,
          type: item.sign === 'D' ? 'DEBIT' : 'CREDIT',
        });
      }

      if (!temPendencia && itemsResolvidos.length > 0) {
        entradas.push({
          date: this.parseDataDDMMAAAA(entry.date),
          items: itemsResolvidos,
          isClosingEntry: entry.type === 'E',
        });
      }
    }

    return { parsed, entradas, naoMapeadas };
  }

  async preview(companyId: string, fileContent: string): Promise<PreviewLancamentosEcd> {
    const { parsed, entradas, naoMapeadas } = await this.resolver(companyId, fileContent);
    const ano = this.extrairAno(parsed);

    const datas = entradas.map(e => e.date.getTime());
    const totalItens = entradas.reduce((s, e) => s + e.items.length, 0);

    return {
      ano,
      loteReferencia: `ECD-${ano}`,
      totalLancamentos: entradas.length,
      totalItens,
      dataInicial: datas.length ? new Date(Math.min(...datas)).toISOString().slice(0, 10) : null,
      dataFinal: datas.length ? new Date(Math.max(...datas)).toISOString().slice(0, 10) : null,
      contasNaoMapeadas: Array.from(naoMapeadas.entries()).map(([code, ocorrencias]) => ({ code, ocorrencias })),
      podeRegistrar: naoMapeadas.size === 0 && entradas.length > 0,
    };
  }

  async registrar(companyId: string, fileContent: string, userId: string) {
    const { parsed, entradas, naoMapeadas } = await this.resolver(companyId, fileContent);
    const ano = this.extrairAno(parsed);

    if (naoMapeadas.size > 0) {
      throw new BadRequestException(
        `Existem ${naoMapeadas.size} conta(s) sem de/para confirmado - resolva na tela Sugestao De/Para antes de registrar.`,
      );
    }
    if (entradas.length === 0) {
      throw new BadRequestException('Nenhum lancamento valido encontrado no arquivo.');
    }

    const loteReferencia = `ECD-${ano}`;

    // CORRIGIDO (mesmo padrao do bug de abertura): apaga lote anterior com a
    // MESMA referencia antes de criar o novo - re-registrar sempre SUBSTITUI.
    const loteAnterior = await this.prisma.journalEntry.findMany({
      where: { companyId, reference: loteReferencia },
      select: { id: true },
    });
    if (loteAnterior.length > 0) {
      const idsAntigos = loteAnterior.map(e => e.id);
      await this.prisma.journalEntryItem.deleteMany({ where: { journalEntryId: { in: idsAntigos } } });
      await this.prisma.journalEntry.deleteMany({ where: { id: { in: idsAntigos } } });
    }

    let criados = 0;
    for (const entrada of entradas) {
      await this.prisma.journalEntry.create({
        data: {
          companyId,
          date: entrada.date,
          description: 'Lancamento com Origem na ECD nesta data',
          reference: loteReferencia,
          sourceModule: 'ECD_IMPORT',
          isClosingEntry: entrada.isClosingEntry,
          createdById: userId,
          items: {
            create: entrada.items.map(i => ({
              accountId: i.accountId,
              value: i.value,
              type: i.type,
            })),
          },
        },
      });
      criados++;
    }

    return { criados, loteReferencia };
  }
}
