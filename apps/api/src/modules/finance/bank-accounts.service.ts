// apps/api/src/modules/finance/bank-accounts.service.ts
// EXTBB-05 (23/11/2026) - Cadastro centralizado de Contas Bancarias por empresa.
// Liga o extrato a contabilidade: ledgerAccount = conta contabil do banco;
// investmentAccount = conta da aplicacao automatica (ex.: BB Rende Facil), opcional.
// Agencia/conta gravadas so com digitos e sem zeros a esquerda (casamento com qualquer extrato).
import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface BankAccountDto {
  bankNumber: string;
  agency: string;
  agencyDigit?: string;
  account: string;
  accountDigit?: string;
  nickname?: string;
  ledgerAccountId?: string;
  investmentAccountId?: string;
  openedAt?: string;
  isActive?: boolean;
}

// Codigo FEBRABAN -> enum BankCode (demais bancos: GENERIC)
const BANK_CODE_BY_NUMBER: Record<string, string> = {
  '001': 'BB', '033': 'SANTANDER', '077': 'INTER', '104': 'CAIXA', '237': 'BRADESCO',
  '260': 'NUBANK', '341': 'ITAU', '748': 'SICREDI', '756': 'SICOOB',
};

const onlyDigits = (v?: string) => (v ?? '').replace(/\D/g, '');
const stripZeros = (v: string) => v.replace(/^0+(?=\d)/, '');
const dv = (v?: string) => (v ?? '').replace(/[^0-9Xx]/g, '').toUpperCase().slice(0, 2) || null;
const ACCOUNT_SELECT = { id: true, code: true, reducedCode: true, name: true };

@Injectable()
export class BankAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string) {
    return this.prisma.bankAccount.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ isActive: 'desc' }, { bankNumber: 'asc' }, { agency: 'asc' }, { account: 'asc' }],
      include: {
        ledgerAccount: { select: ACCOUNT_SELECT },
        investmentAccount: { select: ACCOUNT_SELECT },
        _count: { select: { statements: { where: { deletedAt: null } } } },
      },
    });
  }

  async get(companyId: string, id: string) {
    const row = await this.prisma.bankAccount.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { ledgerAccount: { select: ACCOUNT_SELECT }, investmentAccount: { select: ACCOUNT_SELECT } },
    });
    if (!row) throw new NotFoundException('Conta bancária não encontrada.');
    return row;
  }

  async create(companyId: string, userId: string, dto: BankAccountDto) {
    const data = await this.normalize(companyId, dto);
    await this.assertUnique(companyId, data.bankNumber, data.agency, data.account);
    return this.prisma.bankAccount.create({ data: { ...data, companyId, createdById: userId } });
  }

  async update(companyId: string, id: string, dto: BankAccountDto) {
    await this.get(companyId, id);
    const data = await this.normalize(companyId, dto);
    await this.assertUnique(companyId, data.bankNumber, data.agency, data.account, id);
    return this.prisma.bankAccount.update({ where: { id }, data });
  }

  // Soft-delete; conta com extrato importado nao e excluida (desativar em vez disso)
  async remove(companyId: string, id: string) {
    await this.get(companyId, id);
    const extratos = await this.prisma.bankStatement.count({ where: { bankAccountId: id, deletedAt: null } });
    if (extratos > 0) {
      throw new BadRequestException(`Esta conta tem ${extratos} extrato(s) importado(s) - desative a conta em vez de excluir.`);
    }
    await this.prisma.bankAccount.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    return { deleted: true, id };
  }

  // EXTBB-05B: contas analiticas ativas do plano da empresa, para os seletores da tela (sem paginacao)
  // EXTBB-09B: Regra 13 - havendo Plano Matriz na empresa, so as contas da Matriz (base dos lancamentos);
  // evita escolher a conta nativa da ECD de mesmo nome
  async ledgerOptions(companyId: string) {
    const temMatriz = await this.prisma.chartOfAccounts.count({ where: { companyId, deletedAt: null, origin: 'MATRIZ' } });
    return this.prisma.chartOfAccounts.findMany({
      where: { companyId, deletedAt: null, isAnalytic: true, isActive: true, ...(temMatriz ? { origin: 'MATRIZ' as const } : {}) },
      select: { id: true, code: true, reducedCode: true, name: true },
      orderBy: { code: 'asc' },
    });
  }

  // Usado pela importacao de extratos: agencia e conta SEM o digito verificador
  async findByAgencyAccount(companyId: string, bankNumber: string, agency: string, account: string) {
    return this.prisma.bankAccount.findFirst({
      where: {
        companyId, deletedAt: null, isActive: true,
        bankNumber: onlyDigits(bankNumber).padStart(3, '0'),
        agency: stripZeros(onlyDigits(agency)),
        account: stripZeros(onlyDigits(account)),
      },
    });
  }

  private async normalize(companyId: string, dto: BankAccountDto) {
    const bankNumber = onlyDigits(dto.bankNumber).padStart(3, '0');
    if (bankNumber.length !== 3 || bankNumber === '000') throw new BadRequestException('Informe o código do banco (3 dígitos).');
    const agency = stripZeros(onlyDigits(dto.agency));
    const account = stripZeros(onlyDigits(dto.account));
    if (!agency) throw new BadRequestException('Informe a agência.');
    if (!account) throw new BadRequestException('Informe a conta.');
    const ledgerAccountId = dto.ledgerAccountId || null;
    const investmentAccountId = dto.investmentAccountId || null;
    if (ledgerAccountId) await this.assertAnalytic(companyId, ledgerAccountId, 'Conta contábil do banco');
    if (investmentAccountId) await this.assertAnalytic(companyId, investmentAccountId, 'Conta da aplicação automática');
    if (ledgerAccountId && ledgerAccountId === investmentAccountId) {
      throw new BadRequestException('A conta da aplicação automática deve ser diferente da conta do banco.');
    }
    return {
      bankNumber,
      bankCode: (BANK_CODE_BY_NUMBER[bankNumber] ?? 'GENERIC') as any,
      agency,
      agencyDigit: dv(dto.agencyDigit),
      account,
      accountDigit: dv(dto.accountDigit),
      nickname: dto.nickname?.trim() || null,
      ledgerAccountId,
      investmentAccountId,
      openedAt: dto.openedAt ? new Date(`${dto.openedAt.slice(0, 10)}T00:00:00Z`) : null,
      isActive: dto.isActive ?? true,
    };
  }

  private async assertAnalytic(companyId: string, id: string, rotulo: string) {
    const c = await this.prisma.chartOfAccounts.findFirst({
      where: { id, deletedAt: null, OR: [{ companyId }, { companyId: null }] },
      select: { isAnalytic: true },
    });
    if (!c) throw new BadRequestException(`${rotulo}: conta não encontrada no plano da empresa.`);
    if (!c.isAnalytic) throw new BadRequestException(`${rotulo}: escolha uma conta analítica.`);
  }

  private async assertUnique(companyId: string, bankNumber: string, agency: string, account: string, ignoreId?: string) {
    const dup = await this.prisma.bankAccount.findFirst({
      where: { companyId, bankNumber, agency, account, deletedAt: null, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
      select: { id: true },
    });
    if (dup) throw new ConflictException('Esta agência/conta já está cadastrada para a empresa.');
  }
}
