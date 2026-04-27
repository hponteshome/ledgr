import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class BackupService {
  constructor(private prisma: PrismaService) {}

  private TABLES = [

  'profile',        // Permissões
  'person',         // Dados do indivíduo
  'company',        // Dados da empresa
  'user',           // Login (Email/Senha)
  'userCompany',    // RELACIONAMENTO (O "vínculo" vital)
  'personCompany',  // Relacionamento (Sócios/Contatos)
  'journalEntry',
    
  
  ];

  async exportFullBackup() {
    const backup: any = {
      version: "1.0",
      createdAt: new Date().toISOString(),
      payload: {}
    };

    for (const table of this.TABLES) {
      try {
        // O segredo aqui é o acesso dinâmico via this.prisma
        // @ts-ignore
        backup.payload[table] = await this.prisma[table].findMany();
      } catch (err) {
        console.error(`Erro ao exportar tabela ${table}:`, err);
      }
    }
    return backup;
  }

  async restoreFullBackup(backupData: any) {
    return await this.prisma.$transaction(async (tx) => {
      const reversedTables = [...this.TABLES].reverse();
      for (const table of reversedTables) {
        // @ts-ignore
        await tx[table].deleteMany({});
      }

      for (const table of this.TABLES) {
        const records = backupData.payload[table];
        if (records && records.length > 0) {
          // @ts-ignore
          await tx[table].createMany({ data: records });
        }
      }
    }, { timeout: 60000 });
  }
}