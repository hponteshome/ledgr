import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

// Centralizamos o ID para facilitar a manutenção
export const GLOBAL_COMPANY_ID = '11111111-1111-1111-1111-111111111111';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger('CompanyService');
  private currentCompanyId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  setCompanyId(id: string): void {
    this.currentCompanyId = id;
  }

  getCompanyId(): string | null {
    return this.currentCompanyId;
  }

  // CORREÇÃO: Adicionado filtro para esconder a Global da listagem geral
  async findAll(role?: string) {
    return this.prisma.company.findMany({
      where: {
        id: { not: GLOBAL_COMPANY_ID },
        ...(role ? { roles: { has: role } } : {}),
      },
      orderBy: { legalName: 'asc' },
    });
  }

  // CORREÇÃO: findUnique trocado por findFirst para suportar o filtro NOT
  async findByTaxId(taxId: string) {
    const clean = taxId.replace(/\D/g, '');
    return this.prisma.company.findFirst({
      where: { taxId: { contains: clean } },
    });
  }

  async findById(id: string) {
    const company = await this.prisma.company.findFirst({
      where: {
        id: id,
        NOT: { id: GLOBAL_COMPANY_ID } // Proteção: impede acessar a Global via API de empresas
      },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada');
    }

    const companyFormatted = { ...company };

    if (companyFormatted.partners && typeof companyFormatted.partners === 'string') {
      try {
        companyFormatted.partners = JSON.parse(companyFormatted.partners);
      } catch {
        companyFormatted.partners = [];
      }
    }

    return companyFormatted;
  }

  async create(dto: any) {
    try {
      const partnersData = dto.partners && typeof dto.partners !== 'string' 
        ? JSON.stringify(dto.partners) 
        : dto.partners;

      const newCompany = await this.prisma.company.create({
        data: {
          taxId:         dto.taxId,
          legalName:     dto.legalName,
          tradeName:     dto.tradeName     || '',
          isHeadquarter: dto.isHeadquarter || false,
          openingDate:   dto.openingDate   ? new Date(dto.openingDate) : new Date(),
          zipCode:       dto.zipCode       || '',
          street:        dto.street        || '',
          number:        dto.number        || '',
          complement:    dto.complement    || '',
          neighborhood:  dto.neighborhood  || '',
          city:          dto.city          || '',
          state:         dto.state         || '',
          email:         dto.email         || '',
          phone1:        dto.phone1        || '',
          phone2:        dto.phone2        || '',
          equity:        dto.equity        ? Number(dto.equity) : 0,
          legalNature:   dto.legalNature   || '',
          size:          dto.size          || '',
          taxRegime:     dto.taxRegime     || '',
          status:        dto.status        || 'active',
          statusDate:    dto.statusDate    ? new Date(dto.statusDate) : new Date(),
          partners:      partnersData      || null,
          roles:           dto.roles           || ['LEDGR_USER'],
          nire:            dto.nire            || null,
          registerOrg:     dto.registerOrg     || null,
          codMun:          dto.codMun          || null,
          natLivro:        dto.natLivro        || null,
          ieEstadual:      dto.ieEstadual      || null,
          indEscCons:      dto.indEscCons      || 'N',
          indCentralizada: dto.indCentralizada || '0',
          tipEcd:          dto.tipEcd          || '0',
          indMoedaFunc:    dto.indMoedaFunc    || 'N',
          indNire:         dto.indNire         || '0',
          indSitEsp:       dto.indSitEsp       || null,
          codPlanRef:      dto.codPlanRef      || null,
          hashAnterior:    dto.hashAnterior    || null,
          tabelasRfbPath:  dto.tabelasRfbPath  || null,
        },
      });

      this.logger.log(`Company created: ${newCompany.id}`);
      return newCompany;
    } catch (error) {
      this.logger.error(`Error creating company: ${error.message}`);
      throw error;
    }
  }

  async quickCreate(dto: { taxId: string; legalName: string; roles: string[]; tradeName?: string; email?: string; phone1?: string }) {
    const existing = await this.prisma.company.findFirst({ where: { taxId: dto.taxId } });
    if (existing) {
      const newRoles = [...new Set([...existing.roles, ...dto.roles])];
      return this.prisma.company.update({ where: { id: existing.id }, data: { roles: newRoles } });
    }
    return this.prisma.company.create({
      data: {
        taxId:         dto.taxId,
        legalName:     dto.legalName,
        tradeName:     dto.tradeName   || '',
        roles:         dto.roles,
        email:         dto.email       || '',
        phone1:        dto.phone1      || '',
        isHeadquarter: false,
        openingDate:   new Date(),
        zipCode: '', street: '', number: '', neighborhood: '', city: '', state: '',
        equity: 0, legalNature: '', size: '', taxRegime: '',
        status: 'active', statusDate: new Date(),
      },
    });
  }

  async update(id: string, data: any, adminId: string) {
    // CORREÇÃO: findUnique aqui é OK se você já validou que não é a Global antes
    const oldCompany = await this.prisma.company.findUnique({ where: { id } });
    
    if (!oldCompany || id === GLOBAL_COMPANY_ID) {
      throw new NotFoundException('Empresa não encontrada ou protegida');
    }

    const updateData: any = {};
    const allowedFields = [
      'taxId', 'legalName', 'tradeName', 'openingDate', 'isHeadquarter', 'type',
      'mainActivity', 'secondaryActivities', 
      'street', 'number', 'complement', 'neighborhood', 'zipCode', 'city', 'state',
      'email', 'phone1', 'phone2',
      'equity', 'legalNature', 'size', 'taxRegime',
      'status', 'statusDate', 'statusReason',
      'simplesData', 'meiData', 'partners', 'lastRfbSync',
      'nire', 'registerOrg', 'codMun', 'natLivro', 'ieEstadual',
      'indEscCons', 'indCentralizada', 'tipEcd', 'indMoedaFunc',
      'indNire', 'indSitEsp', 'codPlanRef', 'hashAnterior', 'tabelasRfbPath'
    ];

    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    });

    if (data.openingDate) updateData.openingDate = new Date(data.openingDate);
    if (data.statusDate) updateData.statusDate = new Date(data.statusDate);

    if (data.partners !== undefined) {
      updateData.partners = (typeof data.partners === 'object') 
        ? JSON.stringify(data.partners) 
        : data.partners;
    }

    try {
      const updatedCompany = await this.prisma.company.update({
        where: { id },
        data: updateData,
      });

      await this.auditService.register({
        actorId: adminId,
        action: 'COMPANY_UPDATED',
        targetId: id,
        before: oldCompany,
        after: updatedCompany,
      });

      this.logger.log(`Company ${id} updated by admin ${adminId}`);
      // Auto-sync QSA: vincula socios ja cadastrados como Person
      if (data.partners && Array.isArray(data.partners) && data.partners.length > 0) {
        await this.syncQsaLinks(id, data.partners);
      }
      return updatedCompany;
    } catch (error) {
      this.logger.error(`Error updating company ${id}: ${error.message}`);
      throw error;
    }
  }

  async remove(id: string, adminId: string) {
    if (id === GLOBAL_COMPANY_ID) {
      throw new Error('A empresa Global Template não pode ser removida.');
    }

    const company = await this.findById(id);

    await this.prisma.userCompany.deleteMany({
      where: { companyId: id }
    });

    await this.auditService.register({
      actorId: adminId,
      action: 'COMPANY_DELETED',
      targetId: id,
      before: company,
    });

    // Verificar dependencias antes de deletar
    const [masks, accounts, journals, employees] = await Promise.all([
      this.prisma.companyMaskConfig.count({ where: { companyId: id } }),
      this.prisma.chartOfAccounts.count({ where: { companyId: id } }),
      this.prisma.journalEntry.count({ where: { companyId: id } }),
      this.prisma.employee.count({ where: { companyId: id } }),
    ]);
    const bloqueios: string[] = [];
    if (masks > 0)     bloqueios.push(masks + ' configuracao(oes) de mascara contabil');
    if (accounts > 0)  bloqueios.push(accounts + ' conta(s) no plano de contas');
    if (journals > 0)  bloqueios.push(journals + ' lancamento(s) contabil(is)');
    if (employees > 0) bloqueios.push(employees + ' funcionario(s) cadastrado(s)');
    if (bloqueios.length > 0) {
      throw new BadRequestException('Nao e possivel excluir esta empresa pois ela possui dados vinculados: ' + bloqueios.join(', ') + '. Desative a empresa ao inves de excluir.');
    }

    const result = await this.prisma.company.delete({ where: { id } });
    return result;
  }

async findAvailable(user: any) {
  const isMasterAdmin = (user?.profile?.permissions as any)?.all === true;

  return this.prisma.company.findMany({
    where: {
      id: { not: GLOBAL_COMPANY_ID },
      deletedAt: null,
      roles: { has: 'LEDGR_USER' },
      // Master Admin vê todas — usuário normal só vê ativas
      ...(isMasterAdmin ? {} : { status: { in: ['active', 'ATIVA'] } }),
    },
    select: {
      id:            true,
      taxId:         true,
      legalName:     true,
      tradeName:     true,
      isHeadquarter: true,
      status:        true,
    },
    orderBy: { legalName: 'asc' },
  });
}

async findHeadquarters() {
  return this.prisma.company.findFirst({
    where: {
      isHeadquarter: true,
      id: { not: GLOBAL_COMPANY_ID },
    },
  });
}


  private async syncQsaLinks(companyId: string, partners: any[]) {
    for (const socio of partners) {
      if (!socio.cpfCnpj || !socio.nome) continue;
      // Extrai digitos visiveis do CPF mascarado (ex: ***240219** -> 240219)
      const digits = socio.cpfCnpj.replace(/\*/g, '').replace(/\D/g, '');
      if (digits.length < 4) continue;
      // Busca person pelo CPF parcial
      const persons = await this.prisma.person.findMany({
        where: { cpf: { contains: digits }, deletedAt: null },
        select: { id: true, fullName: true, cpf: true },
      });
      if (persons.length !== 1) continue; // ambiguo ou nao encontrado
      const person = persons[0];
      // Verifica se vínculo já existe
      const existing = await this.prisma.personCompany.findFirst({
        where: { personId: person.id, companyId, role: socio.qualificacao },
      });
      if (existing) continue;
      // Cria vínculo automatico
      await this.prisma.personCompany.create({
        data: {
          personId: person.id,
          companyId,
          role: socio.qualificacao || 'Sócio',
          qualificacaoCvm: String(socio.codigoQualificacao || ''),
          startDate: socio.dataEntrada ? new Date(socio.dataEntrada) : undefined,
          notes: 'Vinculo criado automaticamente via QSA/RFB',
        },
      });
      this.logger.log(`QSA sync: vinculado ${person.fullName} a empresa ${companyId}`);
    }
  }
}
