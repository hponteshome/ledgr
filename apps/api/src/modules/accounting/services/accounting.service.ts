import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

interface ImportBalanceDto {
  lines: string[];
  companyId: string;
  referenceDate: string;
  userId: string;
}

@Injectable()
export class AccountingService {
  private readonly GLOBAL_COMPANY_ID = '11111111-1111-1111-1111-111111111111';

  constructor(private prisma: PrismaService) {}

  // Método para buscar todas as contas
  async findAllAccounts(companyId?: string) {
    const targetId = (!companyId || companyId === 'global' || companyId === 'undefined') 
      ? this.GLOBAL_COMPANY_ID 
      : companyId;

    console.log('--- DEBUG ACCOUNTING ---');
    console.log('ID Solicitado:', companyId);
    console.log('ID Alvo (UUID):', targetId);

    const results = await this.prisma.chartOfAccounts.findMany({
      where: { companyId: targetId },
      orderBy: { code: 'asc' },
    });

    console.log('Quantidade de registros encontrados:', results.length);
    if (results.length > 0) {
      console.log('Primeiro registro:', results[0].code, results[0].name);
    }
    console.log('-------------------------');

    return results;
  }

  // Método para importar saldos
  async importBalances(data: ImportBalanceDto) {
    const { lines, companyId, referenceDate, userId } = data;
    
    const results = {
      total: lines.length,
      success: 0,
      errors: [] as any[],
      balances: [] as any[]
    };

    // Verificar se a empresa existe
    const company = await this.prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      throw new BadRequestException('Empresa não encontrada');
    }

    for (const line of lines) {
      try {
        const [code, balanceStr] = line.split('|').map(s => s.trim());
        
        if (!code || !balanceStr) {
          throw new Error('Formato inválido. Use: CÓDIGO|VALOR');
        }

        const balance = parseFloat(balanceStr.replace(',', '.'));
        
        if (isNaN(balance)) {
          throw new Error('Valor inválido');
        }

        // Buscar a conta pelo código
        const account = await this.prisma.chartOfAccounts.findFirst({
          where: {
            code,
            companyId
          }
        });

        if (!account) {
          throw new Error(`Conta ${code} não encontrada`);
        }

        if (!account.isAnalytic) {
          throw new Error(`Conta ${code} é sintética. Importe apenas contas analíticas.`);
        }

        // Criar ou atualizar o saldo
        const balance_entry = await this.prisma.accountBalance.upsert({
          where: {
            accountId_referenceDate: {
              accountId: account.id,
              referenceDate: new Date(referenceDate)
            }
          },
          update: {
            balance,
            updatedBy: userId
          },
          create: {
            accountId: account.id,
            companyId,
            balance,
            referenceDate: new Date(referenceDate),
            createdBy: userId,
            updatedBy: userId
          }
        });

        results.balances.push({
          code: account.code,
          name: account.name,
          balance: balance_entry.balance
        });

        results.success++;
        
      } catch (error) {
        results.errors.push({
          line,
          error: error.message
        });
      }
    }

    // ✅ AUDIT LOG CORRIGIDO - baseado no schema fornecido
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,  // Mapeado para actor_id no banco
        action: 'IMPORT_BALANCES',  // Mapeado para acao no banco
        targetId: companyId,  // target_id
        before: null,
        after: {
          total: results.total,
          success: results.success,
          errors: results.errors.length,
          importedAt: new Date().toISOString()
        } as any,  // Json
        ip: null,  // Opcional, pode ser passado se tiver
        createdAt: new Date()  // created_at
      }
    });

    return {
      message: `Importação concluída. ${results.success} de ${results.total} linhas processadas.`,
      results
    };
  }
}