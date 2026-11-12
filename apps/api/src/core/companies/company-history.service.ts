// apps/api/src/core/companies/company-history.service.ts
// IMPL-RFB-01 (12/11/2026): o RfbClientService e a fonte unica dos dados da RFB. O mapeamento RFB -> empresa
// fica so aqui (comparar, aplicar, sincronizar uma empresa ou todas); as telas apenas exibem e confirmam.
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RfbClientService } from "../../modules/rfb/rfb-client.service";

export interface FieldChange {
  field: string;
  label: string;
  oldValue: string | null;
  newValue: string | null;
}

const MONITORED_FIELDS: Record<string, string> = {
  legalName:           "Razao Social",
  tradeName:           "Nome Fantasia",
  status:              "Situacao Cadastral",
  statusDate:          "Data Situacao",
  mainActivity:        "CNAE Principal",
  secondaryActivities: "CNAEs Secundarios",
  street:              "Logradouro",
  number:              "Numero",
  complement:          "Complemento",
  neighborhood:        "Bairro",
  city:                "Municipio",
  state:               "UF",
  zipCode:             "CEP",
  codMun:              "Codigo do Municipio (IBGE)",
  email:               "Email",
  phone1:              "Telefone 1",
  phone2:              "Telefone 2",
  legalNature:         "Natureza Juridica",
  size:                "Porte",
};
const DATE_FIELDS = new Set(["statusDate"]);
const JSON_FIELDS = new Set(["secondaryActivities"]);
const DIGIT_FIELDS = new Set(["zipCode", "phone1", "phone2", "codMun"]);
const cnae7 = (v: any) => String(v ?? "").replace(/\D/g, "").padStart(7, "0");

@Injectable()
export class CompanyHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rfb: RfbClientService,
  ) {}

  async findByCompany(companyId: string) {
    return this.prisma.companyHistory.findMany({
      where: { companyId },
      include: { changedBy: { select: { fullName: true, email: true } } },
      orderBy: { changedAt: "desc" },
      take: 50,
    });
  }

  /** Mapeamento unico: retorno do RfbClientService -> campos da empresa, ja normalizados. */
  rfbToCompany(d: any): Record<string, string> {
    const sit = String(d?.situacaoCadastral || "").toUpperCase();
    const status = sit === "ATIVA" ? "active" : sit === "BAIXADA" ? "inactive" : sit === "SUSPENSA" ? "suspended" : sit.toLowerCase();
    const cp = d?.cnaePrincipal;
    const sec = (d?.cnaesSecundarios || [])
      .filter((c: any) => c?.codigo && String(c.codigo).replace(/\D/g, "") !== "0")
      .map((c: any) => ({ codigo: cnae7(c.codigo), descricao: c.descricao || "" }));
    const dig = (v: any) => String(v ?? "").replace(/\D/g, "");
    return {
      legalName:           d?.razaoSocial ?? "",
      tradeName:           d?.nomeFantasia ?? "",
      status,
      statusDate:          String(d?.dataSituacao || "").slice(0, 10),
      mainActivity:        cp?.codigo ? cnae7(cp.codigo) + " - " + (cp.descricao || "") : "",
      secondaryActivities: sec.length ? JSON.stringify(sec) : "",
      street:              d?.endereco?.logradouro ?? "",
      number:              d?.endereco?.numero ?? "",
      complement:          d?.endereco?.complemento ?? "",
      neighborhood:        d?.endereco?.bairro ?? "",
      city:                d?.endereco?.municipio ?? "",
      state:               d?.endereco?.uf ?? "",
      zipCode:             dig(d?.endereco?.cep),
      codMun:              dig(d?.codMun),
      email:               String(d?.contato?.email || "").trim(),
      phone1:              dig(d?.contato?.telefone1),
      phone2:              dig(d?.contato?.telefone2),
      legalNature:         d?.naturezaJuridica ?? "",
      size:                d?.porte ?? "",
    };
  }

  private currentValue(company: any, field: string): string {
    const v = company?.[field];
    if (v == null) return "";
    if (DATE_FIELDS.has(field)) return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
    if (JSON_FIELDS.has(field)) {
      try {
        const a = typeof v === "string" ? JSON.parse(v) : v;
        return Array.isArray(a) && a.length ? JSON.stringify(a.map((c: any) => ({ codigo: cnae7(c.codigo), descricao: c.descricao || "" }))) : "";
      } catch { return ""; }
    }
    const s = String(v).trim();
    return DIGIT_FIELDS.has(field) ? s.replace(/\D/g, "") : s;
  }

  private diff(company: any, rfbData: any): FieldChange[] {
    const m = this.rfbToCompany(rfbData);
    const out: FieldChange[] = [];
    for (const [field, label] of Object.entries(MONITORED_FIELDS)) {
      const cur = this.currentValue(company, field);
      const nv = String(m[field] ?? "").trim();
      const igual = field === "email" ? cur.toLowerCase() === nv.toLowerCase() : cur === nv;
      if (nv && !igual) out.push({ field, label, oldValue: cur || null, newValue: nv });
    }
    return out;
  }

  private async consultarRfb(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException("Empresa nao encontrada.");
    const rfbData = await this.rfb.consultarCNPJ(company.taxId);
    return { company, rfbData };
  }

  async compareWithRfb(companyId: string): Promise<{ divergences: FieldChange[]; rfbData: any }> {
    const { company, rfbData } = await this.consultarRfb(companyId);
    return { divergences: this.diff(company, rfbData), rfbData };
  }

  async applyRfbChanges(companyId: string, userId: string, changes: FieldChange[]) {
    if (!changes?.length) return null;
    const updateData: Record<string, any> = {};
    for (const c of changes) {
      if (!(c.field in MONITORED_FIELDS)) continue;
      let v: any = c.newValue;
      if (DATE_FIELDS.has(c.field)) v = v ? new Date(v) : null;
      else if (JSON_FIELDS.has(c.field)) { try { v = JSON.parse(v); } catch { continue; } }
      updateData[c.field] = v;
    }
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

  /** Sincroniza uma empresa com a RFB: aplica todas as divergencias e registra no historico. */
  async syncFromRfb(companyId: string, userId: string) {
    const { company, rfbData } = await this.consultarRfb(companyId);
    const changes = this.diff(company, rfbData);
    if (changes.length) await this.applyRfbChanges(companyId, userId, changes);
    else await this.prisma.company.update({ where: { id: companyId }, data: { lastRfbSync: new Date() } });
    return { companyId, taxId: company.taxId, legalName: company.legalName, applied: changes.map(c => c.label) };
  }

  /** Sincroniza todas as empresas (uma por vez, com pausa para respeitar o limite da BrasilAPI). */
  async syncAll(userId: string) {
    const companies = await this.prisma.company.findMany({
      where: { deletedAt: null }, select: { id: true, taxId: true, legalName: true }, orderBy: { legalName: "asc" },
    });
    const results: any[] = [];
    for (const c of companies) {
      if ((c.taxId || "").replace(/\D/g, "").length !== 14) {
        results.push({ companyId: c.id, taxId: c.taxId, legalName: c.legalName, skipped: "CNPJ invalido" });
        continue;
      }
      try { results.push(await this.syncFromRfb(c.id, userId)); }
      catch (e: any) { results.push({ companyId: c.id, taxId: c.taxId, legalName: c.legalName, error: e?.message || String(e) }); }
      await new Promise(r => setTimeout(r, 1200));
    }
    return { total: companies.length, results };
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
