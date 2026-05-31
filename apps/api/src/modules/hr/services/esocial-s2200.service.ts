// apps/api/src/modules/hr/services/esocial-s2200.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class EsocialS2200Service {
  constructor(private readonly prisma: PrismaService) {}

  private fmtDate(d: Date | string | null | undefined): string {
    if (!d) return '';
    const dt = typeof d === 'string' ? new Date(d) : d;
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;
  }
  private digits(s: string | null | undefined): string { return (s ?? '').replace(/\D/g, ''); }
  private esc(s: string | null | undefined): string {
    return (s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  private tag(name: string, value: string | null | undefined): string {
    if (!value) return '';
    return `<${name}>${this.esc(value)}</${name}>`;
  }

  private readonly BOND_MAP: Record<string,string> = {
    URBANO_INDETERMINADO:'10', URBANO_DETERMINADO:'11', RURAL_INDETERMINADO:'12',
    RURAL_DETERMINADO:'13', DIRETOR_SEM_VINCULO:'21', AUTONOMO:'31',
    ESTAGIARIO:'35', MENOR_APRENDIZ:'41', DOMESTICO:'65',
  };
  private readonly RACE_MAP: Record<string,string> = {
    BRANCA:'1', PRETA:'2', PARDA:'3', AMARELA:'4', INDIGENA:'5', NAO_INFORMADO:'0',
  };
  private readonly EDU_MAP: Record<string,string> = {
    ANALFABETO:'1', FUNDAMENTAL_INCOMPLETO:'2', FUNDAMENTAL_COMPLETO:'3',
    MEDIO_INCOMPLETO:'4', MEDIO_COMPLETO:'5', SUPERIOR_INCOMPLETO:'6',
    SUPERIOR_COMPLETO:'7', POS_GRADUACAO:'8', MESTRADO:'9', DOUTORADO:'A',
  };

  async generateS2200(companyId: string, employeeId: string): Promise<string> {
    const company = await this.prisma.company.findFirstOrThrow({ where: { id: companyId } });
    const emp = await this.prisma.employee.findFirstOrThrow({
      where: { id: employeeId, companyId, deletedAt: null },
      include: { dependents: true },
    });

    const cnpj = this.digits(company.taxId);
    const now  = new Date();
    const dtGerac = this.fmtDate(now);
    const tpAmb = '2'; // 2=Producao Restrita

    const evtId = `ID1${cnpj.padStart(14,'0')}${dtGerac.replace(/-/g,'')}${String(now.getUTCHours()).padStart(2,'0')}${String(now.getUTCMinutes()).padStart(2,'0')}${String(now.getUTCSeconds()).padStart(2,'0')}00001`;

    const parts: string[] = [];
    parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    parts.push(`<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtAdmissao/v03_01_00_00">`);
    parts.push(`  <evtAdmissao Id="${evtId}">`);
    parts.push(`    <ideEvento>`);
    parts.push(`      <indRetif>1</indRetif>`);
    parts.push(`      <tpAmb>${tpAmb}</tpAmb>`);
    parts.push(`      <procEmi>1</procEmi>`);
    parts.push(`      <verProc>1.0.0</verProc>`);
    parts.push(`    </ideEvento>`);
    parts.push(`    <ideEmpregador>`);
    parts.push(`      <tpInsc>1</tpInsc>`);
    parts.push(`      <nrInsc>${cnpj}</nrInsc>`);
    parts.push(`    </ideEmpregador>`);
    parts.push(`    <trabalhador>`);
    parts.push(`      <cpfTrab>${this.digits(emp.taxId)}</cpfTrab>`);
    parts.push(`      <nmTrab>${this.esc(emp.fullName)}</nmTrab>`);
    parts.push(`      <sexo>M</sexo>`);
    parts.push(`      <racaCor>${this.RACE_MAP[emp.raceColor ?? 'NAO_INFORMADO'] ?? '0'}</racaCor>`);
    parts.push(`      <estCiv>0</estCiv>`);
    parts.push(`      <grauInstr>${this.EDU_MAP[emp.educationLevel ?? ''] ?? '9'}</grauInstr>`);
    if (emp.motherName) parts.push(`      ${this.tag('nmMae', emp.motherName)}`);
    parts.push(`      <nascimento>`);
    parts.push(`        <dtNascto>${this.fmtDate(emp.birthDate)}</dtNascto>`);
    parts.push(`        <paisNascto>105</paisNascto>`);
    parts.push(`        <paisNac>105</paisNac>`);
    parts.push(`      </nascimento>`);
    if (emp.pisNumber) parts.push(`      <nisPisPasep>${this.digits(emp.pisNumber)}</nisPisPasep>`);
    parts.push(`      <endereco><brasil>`);
    parts.push(`        <tpLograd>R</tpLograd>`);
    parts.push(`        ${this.tag('dscLograd', emp.street)}`);
    parts.push(`        ${this.tag('nrLograd', emp.number ?? 'SN')}`);
    if (emp.complement) parts.push(`        ${this.tag('complemento', emp.complement)}`);
    if (emp.neighborhood) parts.push(`        ${this.tag('bairro', emp.neighborhood)}`);
    parts.push(`        ${this.tag('cep', this.digits(emp.zipCode))}`);
    parts.push(`        <codMunic>3550308</codMunic>`);
    parts.push(`        <uf>${emp.addressState ?? 'SP'}</uf>`);
    parts.push(`      </brasil></endereco>`);
    parts.push(`    </trabalhador>`);
    parts.push(`    <vinculo>`);
    parts.push(`      <tpRegTrab>1</tpRegTrab>`);
    parts.push(`      <tpRegPrev>1</tpRegPrev>`);
    parts.push(`      <dtAdm>${this.fmtDate(emp.hireDate)}</dtAdm>`);
    parts.push(`      <tpAdmissao>1</tpAdmissao>`);
    parts.push(`      <indAdmissao>1</indAdmissao>`);
    parts.push(`      <cargo><nmCargo>${this.esc(emp.role)}</nmCargo></cargo>`);
    parts.push(`      <remuneracao>`);
    parts.push(`        <vrSalFx>${Number(emp.salary).toFixed(2)}</vrSalFx>`);
    parts.push(`        <undSalFixo>5</undSalFixo>`);
    parts.push(`      </remuneracao>`);
    parts.push(`      <duracao><tpContr>1</tpContr></duracao>`);
    parts.push(`      <localTrabalho><localTrabGeral>`);
    parts.push(`        <tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc>`);
    parts.push(`      </localTrabGeral></localTrabalho>`);
    parts.push(`      <horContratual>`);
    parts.push(`        <qtdHrsSem>${Number(emp.weeklyHours ?? 44).toFixed(0)}</qtdHrsSem>`);
    parts.push(`        <tpJornada>2</tpJornada>`);
    parts.push(`        <horario><codHorContrat>001</codHorContrat></horario>`);
    parts.push(`      </horContratual>`);
    parts.push(`      <filiacaoSindical><indSindic>${emp.isUnionized ? '1' : '0'}</indSindic></filiacaoSindical>`);
    parts.push(`    </vinculo>`);
    parts.push(`  </evtAdmissao>`);
    parts.push(`</eSocial>`);

    return parts.join('\n');
  }

  async generateAllS2200(companyId: string): Promise<{ employeeId: string; name: string; xml: string }[]> {
    const employees = await this.prisma.employee.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, fullName: true },
    });
    const results = [];
    for (const emp of employees) {
      const xml = await this.generateS2200(companyId, emp.id);
      results.push({ employeeId: emp.id, name: emp.fullName, xml });
    }
    return results;
  }
}
