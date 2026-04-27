import { Injectable, NotFoundException, Logger } from '@nestjs/common';
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
  async findAll() {
    return this.prisma.company.findMany({
      where: {
        id: { not: GLOBAL_COMPANY_ID }
      }
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
        },
      });

      this.logger.log(`Company created: ${newCompany.id}`);
      return newCompany;
    } catch (error) {
      this.logger.error(`Error creating company: ${error.message}`);
      throw error;
    }
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
      'simplesData', 'meiData', 'partners', 'lastRfbSync'
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

    const result = await this.prisma.company.delete({
      where: { id },
    });

    return result;
  }

async findAvailable(user: any) {
  const isMasterAdmin = user?.profile?.isMasterAdmin === true;

  return this.prisma.company.findMany({
    where: {
      id: { not: GLOBAL_COMPANY_ID },
      deletedAt: null,
      // Master Admin vê todas — usuário normal só vê ativas
      ...(isMasterAdmin ? {} : { status: 'active' }),
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

}
