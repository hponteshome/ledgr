// scripts/fix-existing-accounts.ts

import { PrismaClient } from '@prisma/client';
import { normalizeAccountCode } from '../apps/api/src/utils/normalize-account-code';

// 🔴 Inicializa o Prisma Client da forma mais simples possível
const prisma = new PrismaClient();

/**
 * Script para corrigir códigos de contas existentes
 * Exemplo: "111" → "1.1.1", "11101" → "1.1.1.01"
 * 
 * Uso: npx ts-node scripts/fix-existing-accounts.ts
 */

async function fixExistingAccounts() {
  console.log('🔧 Iniciando correção de códigos de contas...');
  console.log('='.repeat(60));

  try {
    // ── Testar conexão ────────────────────────────────────────────
    await prisma.$connect();
    console.log('✅ Conectado ao banco com sucesso!');
    console.log('='.repeat(60));

    // ── Buscar contas com código sem pontos ─────────────────────────
    const accounts = await prisma.chartOfAccounts.findMany({
      where: {
        NOT: {
          code: {
            contains: '.'
          }
        }
      },
      include: {
        company: {
          select: { tradeName: true }
        }
      }
    });
    
    console.log(`📊 Encontradas ${accounts.length} contas para normalizar`);
    console.log('='.repeat(60));
    
    if (accounts.length === 0) {
      console.log('✅ Nenhuma conta precisa ser normalizada!');
      return;
    }
    
    let fixed = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const account of accounts) {
      try {
        // 🔴 NORMALIZAR
        const normalizedCode = normalizeAccountCode(account.code);
        
        if (normalizedCode === account.code) {
          console.log(`⏭️  [${account.company?.tradeName || 'N/A'}] ${account.code} já está normalizado`);
          skipped++;
          continue;
        }
        
        // 🔴 VERIFICAR duplicata
        const existing = await prisma.chartOfAccounts.findFirst({
          where: {
            companyId: account.companyId,
            code: normalizedCode
          }
        });
        
        if (existing) {
          console.log(`⚠️  [${account.company?.tradeName || 'N/A'}] ${account.code} → ${normalizedCode} JÁ EXISTE`);
          skipped++;
          continue;
        }
        
        // 🔴 ATUALIZAR
        await prisma.chartOfAccounts.update({
          where: { id: account.id },
          data: { 
            code: normalizedCode,
            spedCode: account.code,
          }
        });
        
        console.log(`✅ [${account.company?.tradeName || 'N/A'}] ${account.code} → ${normalizedCode}`);
        fixed++;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error(`❌ Erro: ${account.code} - ${errorMessage}`);
        errors++;
      }
    }
    
    // ── Resumo ─────────────────────────────────────────────────────
    console.log('='.repeat(60));
    console.log('📊 RESUMO');
    console.log('='.repeat(60));
    console.log(`Total: ${accounts.length}`);
    console.log(`✅ Normalizadas: ${fixed}`);
    console.log(`⏭️  Puladas: ${skipped}`);
    console.log(`❌ Erros: ${errors}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Erro de conexão:', error);
  }
}

// ── Executar ─────────────────────────────────────────────────────

fixExistingAccounts()
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🔌 Conexão encerrada');
  });