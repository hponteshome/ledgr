// apps/api/src/core/system/export-data.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExportDataService {
  constructor(private prisma: PrismaService) {}

  // ── Constantes ────────────────────────────────────────────────────────────

  // Delimitador padrão (Ponto e vírgula é melhor para Excel/TXT no Brasil)
  private readonly DELIMITER = ';';
  
  // 🔐 Senha padrão para novos usuários (hash de "123456")
  private readonly DEFAULT_PASSWORD_HASH = '$2b$10$ot8YUc/xRSF.NtxyZst7vOvprWYIUe.wpfaDb8SxTHWvSotzluIK6';

  // ── Mapeamento de modelos para suas chaves únicas ─────────────────────────

  private readonly UNIQUE_KEYS: Record<string, string> = {
    'profile': 'name',
    'company': 'taxId',
    'person': 'cpf',
    'user': 'document',
    'user_company': 'userId_companyId',  // Composta
    'person_company': 'personId_companyId_role_startDate' // Composta
  };

  // ── Exportação ────────────────────────────────────────────────────────────

  async exportTableToTxt(modelName: string): Promise<string> {
    console.log(`\n📤 EXPORTANDO: ${modelName}`);
    
    let data: any[] = [];
    
    // ============================================
    // TRATAMENTO ESPECÍFICO POR MODELO
    // ============================================
    
    switch (modelName) {
      case 'profile':
        data = await this.prisma.profile.findMany();
        break;
        
      case 'company':
        data = await this.prisma.company.findMany();
        break;
        
      case 'person':
        data = await this.prisma.person.findMany();
        break;
        
      case 'user':
        data = await this.prisma.user.findMany({
          include: {
            profile: { select: { name: true } },
            person: { select: { cpf: true } }
          }
        });
        break;
        
      case 'user-company':
      case 'user_company':
      case 'user_companies':
        data = await this.prisma.userCompany.findMany({
          include: {
            user: { select: { email: true, fullName: true, document: true } },
            company: { select: { tradeName: true, taxId: true } }
          }
        });
        break;
        
      case 'person-company':
      case 'person_company':
      case 'person_companies':
        data = await this.prisma.personCompany.findMany({
          include: {
            person: { select: { fullName: true, cpf: true } },
            company: { select: { tradeName: true, taxId: true } }
          }
        });
        break;
        
      default:
        const model = this.prisma[modelName.toLowerCase()];
        if (!model) throw new BadRequestException(`Tabela ${modelName} não encontrada.`);
        data = await model.findMany();
    }
    
    if (data.length === 0) return '';

    // 1. Gerar Cabeçalho dinâmico
    const headers = Object.keys(data[0]);
    const headerLine = headers.join(this.DELIMITER);

    // 2. Gerar Linhas tratadas
    const rows = data.map(item => {
      return headers.map(key => {
        const value = item[key];
        
        if (value instanceof Date) return value.toISOString();
        if (typeof value === 'boolean') return value ? '1' : '0';
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        
        // Remove quebras de linha e o próprio delimitador do texto
        return String(value).replace(/[\n\r]/g, ' ').replace(/;/g, ',');
      }).join(this.DELIMITER);
    });

    console.log(`✅ Exportadas ${data.length} linhas`);
    return [headerLine, ...rows].join('\n');
  }

  // ── Importação ────────────────────────────────────────────────────────────

  async importTableFromTxt(
    modelName: string, 
    fileContent: string
  ): Promise<{ 
    imported: number; 
    updated: number;
    skipped: number;
    duplicates: Array<{ field: string; value: string; message: string }>;
  }> {
    console.log(`\n🔍 ========================================`);
    console.log(`🔍 IMPORTANDO: ${modelName}`);
    console.log(`🔍 ========================================`);
    
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return { imported: 0, updated: 0, skipped: 0, duplicates: [] };

    const headers = lines[0].split(this.DELIMITER).map(h => h.trim());
    const dataRows = lines.slice(1);

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const duplicates: Array<{ field: string; value: string; message: string }> = [];

    for (let i = 0; i < dataRows.length; i++) {
      const line = dataRows[i];
      const values = line.split(this.DELIMITER).map(v => v.trim());
      
      const record: any = {};
      
      headers.forEach((header, index) => {
        let val: any = values[index];
        if (val === '' || val === 'null') val = null;
        
        // ── Conversões de tipo ─────────────────────────────────
        if (header === 'isActive' || header === 'is_active') {
          val = val === 'true' || val === '1';
        }
        
        if (header.includes('Date') || header.includes('date') || header.includes('_at')) {
          if (val) {
            val = new Date(val);
          }
        }
        
        if (header === 'equity' || header === 'balance' || header === 'value') {
          val = val ? parseFloat(val) : 0;
        }

        if (header === 'permissions' && val) {
          try {
            val = JSON.parse(val);
          } catch {
            val = { all: true };
          }
        }
        
        record[header] = val;
      });

      // ── Remover campos gerados automaticamente ───────────────
      delete record.createdAt;
      delete record.updatedAt;
      delete record.created_at;
      delete record.updated_at;
      
      // ── Processamento específico por modelo ──────────────────

      try {
        // ============================================
        // PROFILES
        // ============================================
        if (modelName === 'profile') {
          const existing = record.id ? await this.prisma.profile.findUnique({ where: { id: record.id } }) : null;
          
          if (existing) {
            updated++;
            duplicates.push({
              field: 'id',
              value: record.id,
              message: `Perfil ID ${record.id} já existe! Registro atualizado.`
            });
            
            await this.prisma.profile.update({
              where: { id: existing.id },
              data: record
            });
            console.log(`🔄 Perfil ${record.name} (${record.id}) atualizado`);
          } else {
            const created = await this.prisma.profile.create({ data: record });
            imported++;
            console.log(`✅ Novo perfil ${created.name} (${created.id}) inserido`);
          }
        } 
        
        // ============================================
        // COMPANIES
        // ============================================
        else if (modelName === 'company' && record.taxId) {
          const existing = await this.prisma.company.findUnique({
            where: { taxId: record.taxId }
          });

          if (existing) {
            updated++;
            duplicates.push({
              field: 'taxId',
              value: record.taxId,
              message: `CNPJ ${record.taxId} já cadastrado! Registro atualizado.`
            });
            
            await this.prisma.company.update({
              where: { taxId: record.taxId },
              data: record
            });
            console.log(`🔄 Empresa ${record.tradeName} (${record.taxId}) atualizada`);
          } else {
            const created = await this.prisma.company.create({ data: record });
            imported++;
            console.log(`✅ Nova empresa ${created.tradeName} (${created.taxId}) inserida`);
          }
        } 
        
        // ============================================
        // PERSONS
        // ============================================
        else if (modelName === 'person' && record.cpf) {
          const existing = await this.prisma.person.findUnique({
            where: { cpf: record.cpf }
          });

          if (existing) {
            updated++;
            duplicates.push({
              field: 'cpf',
              value: record.cpf,
              message: `CPF ${record.cpf} já cadastrado! Registro atualizado.`
            });
            
            await this.prisma.person.update({
              where: { cpf: record.cpf },
              data: record
            });
            console.log(`🔄 Pessoa ${record.fullName} (${record.cpf}) atualizada`);
          } else {
            const created = await this.prisma.person.create({ data: record });
            imported++;
            console.log(`✅ Nova pessoa ${created.fullName} (${created.cpf}) inserida`);
          }
        } 
        
        // ============================================
        // USERS
        // ============================================
        else if (modelName === 'user' && record.document) {
          
          // 🔥 Resolver profileId a partir do nome do perfil
          if (record.profileName && !record.profileId) {
            const profile = await this.prisma.profile.findFirst({
              where: { name: record.profileName }
            });
            
            if (profile) {
              record.profileId = profile.id;
              console.log(`📋 Perfil encontrado: ${profile.name} -> ${profile.id}`);
            } else {
              console.log(`⚠️ Perfil "${record.profileName}" não encontrado!`);
            }
            delete record.profileName;
          }

          // 🔥 Resolver personId a partir do CPF
          if (record.personCpf && !record.personId) {
            const person = await this.prisma.person.findUnique({
              where: { cpf: record.personCpf }
            });
            
            if (person) {
              record.personId = person.id;
              console.log(`📋 Pessoa encontrada: ${person.fullName} -> ${person.id}`);
            } else {
              console.log(`⚠️ Pessoa com CPF "${record.personCpf}" não encontrada!`);
            }
            delete record.personCpf;
          }

          // Garantir documentType
          if (!record.documentType) {
            record.documentType = record.document.length > 11 ? 'CNPJ' : 'CPF';
          }

          // Usar hash padrão se não tiver senha
          if (!record.passwordHash) {
            record.passwordHash = this.DEFAULT_PASSWORD_HASH;
          }

          const existing = await this.prisma.user.findUnique({
            where: { document: record.document }
          });

          if (existing) {
            updated++;
            duplicates.push({
              field: 'document',
              value: record.document,
              message: `Documento ${record.document} já cadastrado! Registro atualizado.`
            });
            
            await this.prisma.user.update({
              where: { document: record.document },
              data: record
            });
            console.log(`🔄 Usuário ${record.email} (${record.document}) atualizado`);
          } else {
            const created = await this.prisma.user.create({ data: record });
            imported++;
            console.log(`✅ Novo usuário ${created.email} (${created.document}) inserido`);
          }
        }
        
        // ============================================
        // USER_COMPANIES
        // ============================================
        else if (modelName === 'user_company' || modelName === 'user_companies' || modelName === 'user-company') {
          if (!record.userId || !record.companyId) {
            skipped++;
            console.log(`⚠️ Linha ${i + 1}: userId ou companyId ausente`);
            continue;
          }

          const existing = await this.prisma.userCompany.findUnique({
            where: {
              userId_companyId: {
                userId: record.userId,
                companyId: record.companyId
              }
            }
          });

          if (existing) {
            updated++;
            await this.prisma.userCompany.update({
              where: { id: existing.id },
              data: record
            });
            console.log(`🔄 Vínculo User-Company atualizado`);
          } else {
            await this.prisma.userCompany.create({ data: record });
            imported++;
            console.log(`✅ Novo vínculo User-Company criado`);
          }
        }
        
        // ============================================
        // PERSON_COMPANIES
        // ============================================
        else if (modelName === 'person_company' || modelName === 'person_companies' || modelName === 'person-company') {
          if (!record.personId || !record.companyId || !record.role || !record.startDate) {
            skipped++;
            console.log(`⚠️ Linha ${i + 1}: campos obrigatórios ausentes`);
            continue;
          }

          const existing = await this.prisma.personCompany.findUnique({
            where: {
              personId_companyId_role_startDate: {
                personId: record.personId,
                companyId: record.companyId,
                role: record.role,
                startDate: new Date(record.startDate)
              }
            }
          });

          if (existing) {
            updated++;
            await this.prisma.personCompany.update({
              where: { id: existing.id },
              data: record
            });
            console.log(`🔄 Vínculo Person-Company atualizado`);
          } else {
            await this.prisma.personCompany.create({ data: record });
            imported++;
            console.log(`✅ Novo vínculo Person-Company criado`);
          }
        }
        
        // ============================================
        // OUTROS MODELOS
        // ============================================
        else {
          const model = this.prisma[modelName.toLowerCase()];
          if (!model) throw new BadRequestException(`Tabela ${modelName} não encontrada.`);
          
          // Tentar encontrar por ID se existir
          if (record.id) {
            const existing = await model.findUnique({ where: { id: record.id } });
            if (existing) {
              await model.update({ where: { id: record.id }, data: record });
              updated++;
            } else {
              await model.create({ data: record });
              imported++;
            }
          } else {
            await model.create({ data: record });
            imported++;
          }
        }

      } catch (error) {
        console.log(`❌ ERRO na linha ${i + 1}:`, error.message);
        console.log('📦 Registro:', JSON.stringify(record, null, 2));
        skipped++;
      }
    }
    
    console.log(`\n📊 ========================================`);
    console.log(`📊 RESULTADO DA IMPORTAÇÃO: ${modelName}`);
    console.log(`📊 ========================================`);
    console.log(`✅ Novos registros: ${imported}`);
    console.log(`🔄 Registros atualizados: ${updated}`);
    console.log(`⚠️  Registros ignorados: ${skipped}`);
    console.log(`📋 Duplicatas: ${duplicates.length}`);
    console.log(`📊 ========================================\n`);
    
    return { 
      imported, 
      updated, 
      skipped,
      duplicates 
    };
  }
}