// apps/api/src/core/companies/company-history.service.ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface FieldChange {
  field: string;
  label: string;
  oldValue: string | null;
  newValue: string | null;
}

const MONITORED_FIELDS: Record<string, string> = {
  legalName:      "Razao Social",
  tradeName:      "Nome Fantasia",
  status:         "Situacao Cadastral",
  statusDate:     "Data Situacao",
  mainActivity:   "CNAE Principal",
  street:         "Logradouro",
  number:         "Numero",
  neighborhood:   "Bairro",
  city:           "Municipio",
  state:          "UF",
  zipCode:        "CEP",
  email:          "Email",
  phone1:         "Telefone 1",
  legalNature:    "Natureza Juridica",
  size:           "Porte",
};

@Injectable()
export class CompanyHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findByCompany(companyId: string) {
    return this.prisma.companyHistory.findMany({
      where: { companyId },
      include: { changedBy: { select: { fullName: true, email: true } } },
      orderBy: { changedAt: "desc" },
      take: 50,
    });
  }

  async compareWithRfb(companyId: string, rfbData: any): Promise<FieldChange[]> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return [];

    const divergences: FieldChange[] = [];
    const rfbMap: Record<string, string> = {
      legalName:    rfbData.razaoSocial ?? "",
      tradeName:    rfbData.nomeFantasia ?? "",
      status:       rfbData.situacaoCadastral ?? "",
      statusDate:   rfbData.dataSituacao ?? "",
      mainActivity: rfbData.cnaePrincipal?.descricao ?? "",
      street:       rfbData.endereco?.logradouro ?? "",
      number:       rfbData.endereco?.numero ?? "",
      neighborhood: rfbData.endereco?.bairro ?? "",
      city:         rfbData.endereco?.municipio ?? "",
      state:        rfbData.endereco?.uf ?? "",
      zipCode:      rfbData.endereco?.cep ?? "",
      email:        rfbData.contato?.email ?? "",
      phone1:       rfbData.contato?.telefone1 ?? "",
      legalNature:  rfbData.naturezaJuridica ?? "",
      size:         rfbData.porte ?? "",
    };

    for (const [field, label] of Object.entries(MONITORED_FIELDS)) {
      const currentVal = String((company as any)[field] ?? "").trim();
      const rfbVal = String(rfbMap[field] ?? "").trim();
      if (rfbVal && currentVal !== rfbVal) {
        divergences.push({ field, label, oldValue: currentVal || null, newValue: rfbVal });
      }
    }
    return divergences;
  }

  async applyRfbChanges(companyId: string, userId: string, changes: FieldChange[]) {
    if (!changes.length) return null;
    const updateData: Record<string, any> = {};
    for (const c of changes) updateData[c.field] = c.newValue;
    updateData.lastRfbSync = new Date();

    await this.prisma.$transaction([
      this.prisma.company.update({ where: { id: companyId }, data: updateData }),
      this.prisma.companyHistory.create({
        data: {
          companyId,
          changedById: userId,
          source: "RFB_SYNC",
          changes: changes as any,
          appliedAt: new Date(),
        },
      }),
    ]);
    return { applied: changes.length };
  }

  async recordManualEdit(companyId: string, userId: string, changes: FieldChange[]) {
    if (!changes.length) return null;
    return this.prisma.companyHistory.create({
      data: {
        companyId,
        changedById: userId,
        source: "MANUAL_EDIT",
        changes: changes as any,
        appliedAt: new Date(),
      },
    });
  }
}
