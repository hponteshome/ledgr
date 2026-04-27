import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger('CompanyService');
  private currentCompanyId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Data Isolation Methods (Used by PrismaService)
   */
  setCompanyId(id: string): void {
    this.currentCompanyId = id;
  }

  getCompanyId(): string | null {
    return this.currentCompanyId;
  }

  async findAll() {
    return this.prisma.company.findMany();
  }

  async findById(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  async create(dto: any) {
    try {
      // Correção do erro TS2322: Incluindo campos obrigatórios do schema.prisma
      const newCompany = await this.prisma.company.create({
        data: {
          taxId: dto.taxId,
          legalName: dto.legalName,
          tradeName: dto.tradeName,
          openingDate: dto.openingDate ? new Date(dto.openingDate) : null,
          status: dto.status || 'active',
          
          // Campos obrigatórios exigidos pelo Prisma CreateInput
          legalNature: dto.legalNature || '',
          size: dto.size || '',
          taxRegime: dto.taxRegime || '',
          statusDate: dto.statusDate ? new Date(dto.statusDate) : new Date(),
          
          // Campos de endereço e financeiro
          street: dto.street,
          number: dto.number,
          neighborhood: dto.neighborhood,
          zipCode: dto.zipCode,
          city: dto.city,
          state: dto.state,
          equity: dto.equity || 0,
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
    const oldCompany = await this.findById(id);

    const updatedCompany = await this.prisma.company.update({
      where: { id },
      data: {
        taxId: data.taxId,
        legalName: data.legalName,
        tradeName: data.tradeName,
        status: data.status,
        equity: data.equity,
        street: data.street,
        number: data.number,
        neighborhood: data.neighborhood,
        zipCode: data.zipCode,
        city: data.city,
        state: data.state,
        // Incluindo atualizações para os novos campos se existirem no input
        legalNature: data.legalNature,
        size: data.size,
        taxRegime: data.taxRegime,
        statusDate: data.statusDate ? new Date(data.statusDate) : undefined,
      },
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
  }

  async remove(id: string, adminId: string) {
    const company = await this.findById(id);

    await this.auditService.register({
      actorId: adminId,
      action: 'COMPANY_DELETED',
      targetId: id,
      before: company,
    });

    this.logger.warn(`Company ${id} removed by admin ${adminId}`);

    return this.prisma.company.delete({
      where: { id },
    });
  }
}