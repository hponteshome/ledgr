// apps/api/src/modules/hr/services/esocial-events.service.ts
// S-2205 Alteracao Contratual | S-2299 Desligamento | S-1200 Remuneracao
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class EsocialEventsService {
  constructor(private readonly prisma: PrismaService) {}

  private fmtDate(d: Date | string | null | undefined): string {
    if (!d) return '';
    const dt = typeof d === 'string' ? new Date(d) : d;
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;
  }
  private digits(s: string | null | undefined): string { return (s ?? '').replace(/\D/g,''); }
  private esc(s: string | null | undefined): string {
    return (s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  private evtId(cnpj: string, seq = '00001'): string {
    const now = new Date();
    const dt  = `${now.getUTCFullYear()}${String(now.getUTCMonth()+1).padStart(2,'0')}${String(now.getUTCDate()).padStart(2,'0')}`;
    const hr  = `${String(now.getUTCHours()).padStart(2,'0')}${String(now.getUTCMinutes()).padStart(2,'0')}${String(now.getUTCSeconds()).padStart(2,'0')}`;
    return `ID1${cnpj.padStart(14,'0')}${dt}${hr}${seq}`;
  }

  // ── S-2205 Alteracao Contratual ──────────────────────────────────────────────
  async generateS2205(companyId: string, employeeId: string, changes: {
    dtAlteracao: string;
    novaFuncao?: string;
    novoSalario?: number;
    novaCargaHoraria?: number;
  }): Promise<string> {
    const company = await this.prisma.company.findFirstOrThrow({ where: { id: companyId } });
    const emp     = await this.prisma.employee.findFirstOrThrow({ where: { id: employeeId, companyId, deletedAt: null } });
    const cnpj    = this.digits(company.taxId);
    const id      = this.evtId(cnpj);

    const parts: string[] = [];
    parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    parts.push(`<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtAltContratual/v03_01_00_00">`);
    parts.push(`  <evtAltContratual Id="${id}">`);
    parts.push(`    <ideEvento><indRetif>1</indRetif><tpAmb>2</tpAmb><procEmi>1</procEmi><verProc>1.0.0</verProc></ideEvento>`);
    parts.push(`    <ideEmpregador><tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc></ideEmpregador>`);
    parts.push(`    <ideVinculo>`);
    parts.push(`      <cpfTrab>${this.digits(emp.taxId)}</cpfTrab>`);
    parts.push(`      <matricula>${emp.registrationNumber ?? emp.taxId}</matricula>`);
    parts.push(`    </ideVinculo>`);
    parts.push(`    <altContratual>`);
    parts.push(`      <dtAlteracao>${changes.dtAlteracao}</dtAlteracao>`);
    if (changes.novaFuncao) {
      parts.push(`      <cargo><nmCargo>${this.esc(changes.novaFuncao)}</nmCargo></cargo>`);
    }
    if (changes.novoSalario) {
      parts.push(`      <remuneracao><vrSalFx>${changes.novoSalario.toFixed(2)}</vrSalFx><undSalFixo>5</undSalFixo></remuneracao>`);
    }
    if (changes.novaCargaHoraria) {
      parts.push(`      <horContratual><qtdHrsSem>${changes.novaCargaHoraria}</qtdHrsSem><tpJornada>2</tpJornada><horario><codHorContrat>001</codHorContrat></horario></horContratual>`);
    }
    parts.push(`    </altContratual>`);
    parts.push(`  </evtAltContratual>`);
    parts.push(`</eSocial>`);
    return parts.join('\n');
  }

  // ── Mapeamentos eSocial ─────────────────────────────────────────────────────
  private mtvDesligMap: Record<string, string> = {
    SEM_JUSTA_CAUSA:               '01',
    JUSTA_CAUSA:                   '02',
    PEDIDO_DEMISSAO:               '04',
    TERMINO_CONTRATO_DETERMINADO:  '06',
    RESCISAO_INDIRETA:             '10',
    ACORDO_484A:                   '40',
    APOSENTADORIA:                 '63',
    FALECIMENTO:                   '65',
    OUTROS:                        '80',
  };

  private indAvisoMap: Record<string, string> = {
    TRABALHADO:         '1', // aviso trabalhado integralmente
    DISPENSADO:         '1', // dispensado mas contado como trabalhado
    INDENIZADO:         '2', // aviso indenizado (nao trabalhou)
    TRABALHADO_PARCIAL: '2', // misto: parte trabalhada + parte indenizada
    NAO_CUMPRIDO:       '3', // nao cumpriu aviso (desconto)
    NAO_SE_APLICA:      '3', // justa causa, falecimento etc
  };

  // ── S-2299 Desligamento — gera a partir da rescisao confirmada ───────────────
  async generateS2299FromTermination(companyId: string, employeeId: string, tpAmb: '1'|'2' = '2'): Promise<string> {
    const company = await this.prisma.company.findFirstOrThrow({ where: { id: companyId } });
    const emp     = await this.prisma.employee.findFirstOrThrow({
      where: { id: employeeId, companyId, deletedAt: null },
    });

    // Busca a rescisao mais recente nao cancelada
    const term = await this.prisma.employeeTermination.findFirst({
      where: { companyId, employeeId, status: { not: 'CANCELADA' }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!term) throw new Error('Nenhuma rescisao confirmada encontrada para este funcionario. Confirme o TRCT antes de gerar o S-2299.');

    const cnpj       = this.digits(company.taxId);
    const id         = this.evtId(cnpj, '00002');
    const dtDeslig   = this.fmtDate(term.dataAfastamento);
    const mtvDeslig  = this.mtvDesligMap[term.motivo] ?? '80';
    const indAviso   = this.indAvisoMap[term.tipoAvisoPrevio] ?? '3';
    const temProjecao = ['INDENIZADO','TRABALHADO_PARCIAL'].includes(term.tipoAvisoPrevio) && term.dataProjecaoFim;
    const dtProjecao  = temProjecao ? this.fmtDate(term.dataProjecaoFim) : null;

    const parts: string[] = [];
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtDeslig/v03_01_00_00">');
    parts.push(`  <evtDeslig Id="${id}">`);
    parts.push('    <ideEvento>');
    parts.push('      <indRetif>1</indRetif>');
    parts.push(`      <tpAmb>${tpAmb}</tpAmb>`);
    parts.push('      <procEmi>1</procEmi>');
    parts.push('      <verProc>1.0.0</verProc>');
    parts.push('    </ideEvento>');
    parts.push('    <ideEmpregador>');
    parts.push('      <tpInsc>1</tpInsc>');
    parts.push(`      <nrInsc>${cnpj}</nrInsc>`);
    parts.push('    </ideEmpregador>');
    parts.push('    <ideVinculo>');
    parts.push(`      <cpfTrab>${this.digits(emp.taxId)}</cpfTrab>`);
    parts.push(`      <matricula>${this.esc(emp.registrationNumber ?? emp.taxId)}</matricula>`);
    parts.push('    </ideVinculo>');
    parts.push('    <infoDeslig>');
    parts.push(`      <dtDeslig>${dtDeslig}</dtDeslig>`);
    parts.push(`      <mtvDeslig>${mtvDeslig}</mtvDeslig>`);
    if (dtProjecao) {
      parts.push(`      <dtProjFimAPI>${dtProjecao}</dtProjFimAPI>`);
    }
    parts.push('      <pensaoAlim>N</pensaoAlim>');
    parts.push(`      <indAviso>${indAviso}</indAviso>`);
    parts.push('    </infoDeslig>');
    // Verbas rescisórias (resumo TRCT)
    parts.push('    <!-- TRCT gerado no LEDGR -->');
    parts.push(`    <!-- Motivo: ${term.motivo} | Aviso: ${term.tipoAvisoPrevio} | Dias indenizados: ${term.diasAvisoIndenizados ?? 0} -->`);
    parts.push(`    <!-- Saldo Salario: ${Number(term.saldoSalarioValor).toFixed(2)} | Aviso Indenizado: ${Number(term.avisoPrevioValor).toFixed(2)} -->`);
    parts.push(`    <!-- 13o Prop (${term.decimoTerceiroMeses}/12): ${Number(term.decimoTerceiroValor).toFixed(2)} | Ferias Prop (${term.feriasPropMeses}/12): ${Number(term.feriasPropValor).toFixed(2)} -->`);
    parts.push(`    <!-- INSS: ${Number(term.valorInss).toFixed(2)} | IRRF: ${Number(term.valorIrrf).toFixed(2)} | Liquido: ${Number(term.totalLiquido).toFixed(2)} -->`);
    parts.push('  </evtDeslig>');
    parts.push('</eSocial>');
    return parts.join('\n');
  }

  // ── S-2299 parametrizado (legado) ───────────────────────────────────────────
  async generateS2299(companyId: string, employeeId: string, params: {
    dtDeslig: string;
    mtvDeslig: string;
    dtProjFimAPI?: string;
    pensaoAlimenticia?: boolean;
    indAviso?: string;
    tpAmb?: '1'|'2';
  }): Promise<string> {
    const company = await this.prisma.company.findFirstOrThrow({ where: { id: companyId } });
    const emp     = await this.prisma.employee.findFirstOrThrow({ where: { id: employeeId, companyId, deletedAt: null } });
    const cnpj    = this.digits(company.taxId);
    const id      = this.evtId(cnpj, '00002');

    const parts: string[] = [];
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtDeslig/v03_01_00_00">');
    parts.push(`  <evtDeslig Id="${id}">`);
    parts.push(`    <ideEvento><indRetif>1</indRetif><tpAmb>${params.tpAmb ?? '2'}</tpAmb><procEmi>1</procEmi><verProc>1.0.0</verProc></ideEvento>`);
    parts.push(`    <ideEmpregador><tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc></ideEmpregador>`);
    parts.push('    <ideVinculo>');
    parts.push(`      <cpfTrab>${this.digits(emp.taxId)}</cpfTrab>`);
    parts.push(`      <matricula>${this.esc(emp.registrationNumber ?? emp.taxId)}</matricula>`);
    parts.push('    </ideVinculo>');
    parts.push('    <infoDeslig>');
    parts.push(`      <dtDeslig>${params.dtDeslig}</dtDeslig>`);
    parts.push(`      <mtvDeslig>${params.mtvDeslig}</mtvDeslig>`);
    if (params.dtProjFimAPI) parts.push(`      <dtProjFimAPI>${params.dtProjFimAPI}</dtProjFimAPI>`);
    parts.push(`      <pensaoAlim>${params.pensaoAlimenticia ? 'S' : 'N'}</pensaoAlim>`);
    if (params.indAviso) parts.push(`      <indAviso>${params.indAviso}</indAviso>`);
    parts.push('    </infoDeslig>');
    parts.push('  </evtDeslig>');
    parts.push('</eSocial>');
    return parts.join('\n');
  }


  // ── S-1299 Fechamento de Eventos Periodicos ──────────────────────────────────
  async generateS1299(companyId: string, perApur: string, tpAmb: '1'|'2' = '2'): Promise<string> {
    const company = await this.prisma.company.findFirstOrThrow({ where: { id: companyId } });
    const cnpj    = this.digits(company.taxId);
    const id      = this.evtId(cnpj, '00099');
    const now     = new Date();
    const dtFech  = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(now.getUTCDate()).padStart(2,'0')}`;

    const parts: string[] = [];
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtFechaEvtsPer/v01_01_00_00">');
    parts.push(`  <evtFechaEvtsPer Id="${id}">`);
    parts.push('    <ideEvento>');
    parts.push('      <indRetif>1</indRetif>');
    parts.push(`      <perApur>${perApur}</perApur>`);
    parts.push(`      <tpAmb>${tpAmb}</tpAmb>`);
    parts.push('      <procEmi>1</procEmi>');
    parts.push('      <verProc>1.0.0</verProc>');
    parts.push('    </ideEvento>');
    parts.push('    <ideEmpregador>');
    parts.push('      <tpInsc>1</tpInsc>');
    parts.push(`      <nrInsc>${cnpj}</nrInsc>`);
    parts.push('    </ideEmpregador>');
    parts.push('    <infoFech>');
    parts.push(`      <dtFech>${dtFech}</dtFech>`);
    parts.push('      <indApuracao>1</indApuracao>');
    parts.push('    </infoFech>');
    parts.push('  </evtFechaEvtsPer>');
    parts.push('</eSocial>');
    return parts.join('\n');
  }

  // ── S-1200 Remuneracao Mensal ────────────────────────────────────────────────
  async generateS1200(companyId: string, employeeId: string, params: {
    perApur: string; // YYYY-MM
    vrBcCpMensal: number;
    vrRemunOE?: number;
  }): Promise<string> {
    const company = await this.prisma.company.findFirstOrThrow({ where: { id: companyId } });
    const emp     = await this.prisma.employee.findFirstOrThrow({ where: { id: employeeId, companyId, deletedAt: null } });
    const cnpj    = this.digits(company.taxId);
    const id      = this.evtId(cnpj, '00003');

    const parts: string[] = [];
    parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    parts.push(`<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtRemun/v02_01_00_00">`);
    parts.push(`  <evtRemun Id="${id}">`);
    parts.push(`    <ideEvento>`);
    parts.push(`      <indRetif>1</indRetif>`);
    parts.push(`      <perApur>${params.perApur}</perApur>`);
    parts.push('      <tpAmb>2</tpAmb><procEmi>1</procEmi><verProc>1.0.0</verProc>');
    parts.push(`    </ideEvento>`);
    parts.push(`    <ideEmpregador><tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc></ideEmpregador>`);
    parts.push(`    <ideVinculo>`);
    parts.push(`      <cpfTrab>${this.digits(emp.taxId)}</cpfTrab>`);
    parts.push(`      <matricula>${emp.registrationNumber ?? emp.taxId}</matricula>`);
    parts.push(`    </ideVinculo>`);
    parts.push(`    <dmDev>`);
    parts.push(`      <ideDmDev>1</ideDmDev>`);
    parts.push(`      <codCateg>01</codCateg>`);
    parts.push(`      <infoPerApur>`);
    parts.push(`        <ideEstabLot>`);
    parts.push(`          <tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc>`);
    parts.push(`          <codLotacao>001</codLotacao>`);
    parts.push(`          <detVerbas>`);
    parts.push(`            <codRubr>0001</codRubr>`);
    parts.push(`            <ideTabRubr>S</ideTabRubr>`);
    parts.push(`            <qtdRubr>1.00</qtdRubr>`);
    parts.push(`            <vrRubr>${Number(emp.salary).toFixed(2)}</vrRubr>`);
    parts.push(`          </detVerbas>`);
    parts.push(`        </ideEstabLot>`);
    parts.push(`      </infoPerApur>`);
    parts.push(`      <infoComplCont>`);
    parts.push(`        <vrBcCpMensal>${params.vrBcCpMensal.toFixed(2)}</vrBcCpMensal>`);
    parts.push(`      </infoComplCont>`);
    parts.push(`    </dmDev>`);
    parts.push(`  </evtRemun>`);
    parts.push(`</eSocial>`);
    return parts.join('\n');
  }


  // ── S-2230 Afastamento Temporario ───────────────────────────────────────────
  // codMotAfast: 01=Acidente trabalho, 02=Doenca, 06=Lic.Maternidade,
  //   10=Lic.Paternidade, 17=Ferias, 19=Lic.Sem Vencimento, 99=Outros
  async generateS2230(companyId: string, employeeId: string, params: {
    dtIniAfast: string;
    codMotAfast: string;
    dtTermAfast?: string;
    tpAmb?: '1'|'2';
  }): Promise<string> {
    const company = await this.prisma.company.findFirstOrThrow({ where: { id: companyId } });
    const emp     = await this.prisma.employee.findFirstOrThrow({ where: { id: employeeId, companyId, deletedAt: null } });
    const cnpj    = this.digits(company.taxId);
    const id      = this.evtId(cnpj, '00230');
    const tpAmb   = params.tpAmb ?? '2';

    const parts: string[] = [];
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtAfastTemp/v03_00_00_00">');
    parts.push(`  <evtAfastTemp Id="${id}">`);
    parts.push('    <ideEvento>');
    parts.push('      <indRetif>1</indRetif>');
    parts.push(`      <tpAmb>${tpAmb}</tpAmb>`);
    parts.push('      <procEmi>1</procEmi>');
    parts.push('      <verProc>1.0.0</verProc>');
    parts.push('    </ideEvento>');
    parts.push('    <ideEmpregador>');
    parts.push('      <tpInsc>1</tpInsc>');
    parts.push(`      <nrInsc>${cnpj}</nrInsc>`);
    parts.push('    </ideEmpregador>');
    parts.push('    <ideVinculo>');
    parts.push(`      <cpfTrab>${this.digits(emp.taxId)}</cpfTrab>`);
    parts.push(`      <matricula>${this.esc(emp.registrationNumber ?? emp.taxId)}</matricula>`);
    parts.push('    </ideVinculo>');
    parts.push('    <infoAfastamento>');
    parts.push('      <iniAfastamento>');
    parts.push(`        <dtIniAfast>${params.dtIniAfast}</dtIniAfast>`);
    parts.push(`        <codMotAfast>${params.codMotAfast}</codMotAfast>`);
    parts.push('      </iniAfastamento>');
    if (params.dtTermAfast) {
      parts.push('      <fimAfastamento>');
      parts.push(`        <dtTermAfast>${params.dtTermAfast}</dtTermAfast>`);
      parts.push('      </fimAfastamento>');
    }
    parts.push('    </infoAfastamento>');
    parts.push('  </evtAfastTemp>');
    parts.push('</eSocial>');
    return parts.join('\n');
  }


  // ── S-2240 Condicoes Ambientais do Trabalho (NR-15/NR-16) ───────────────────
  // condAmb: 1=Normal, 2=Insalubre, 3=Perigoso
  // localAmb: 1=No estabelecimento, 2=Em outro estabelecimento
  async generateS2240(companyId: string, employeeId: string, params: {
    dscSetor:    string;
    condAmb:     '1'|'2'|'3';
    dscAtivDes:  string;
    utilizEpc:   'S'|'N';
    utilizEpi:   'S'|'N';
    tpAmb?:      '1'|'2';
  }): Promise<string> {
    const company = await this.prisma.company.findFirstOrThrow({ where: { id: companyId } });
    const emp     = await this.prisma.employee.findFirstOrThrow({ where: { id: employeeId, companyId, deletedAt: null } });
    const cnpj    = this.digits(company.taxId);
    const id      = this.evtId(cnpj, '00240');
    const tpAmb   = params.tpAmb ?? '2';
    const parts: string[] = [];
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtCondicaoAmb/v03_00_00_00">');
    parts.push(`  <evtCondicaoAmb Id="${id}">`);
    parts.push(`    <ideEvento><indRetif>1</indRetif><tpAmb>${tpAmb}</tpAmb><procEmi>1</procEmi><verProc>1.0.0</verProc></ideEvento>`);
    parts.push(`    <ideEmpregador><tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc></ideEmpregador>`);
    parts.push('    <ideVinculo>');
    parts.push(`      <cpfTrab>${this.digits(emp.taxId)}</cpfTrab>`);
    parts.push(`      <matricula>${this.esc(emp.registrationNumber ?? emp.taxId)}</matricula>`);
    parts.push('    </ideVinculo>');
    parts.push('    <infoCondicaoAmb>');
    parts.push('      <localAmb>1</localAmb>');
    parts.push(`      <dscSetor>${this.esc(params.dscSetor)}</dscSetor>`);
    parts.push('      <tpInsc>1</tpInsc>');
    parts.push(`      <nrInsc>${cnpj}</nrInsc>`);
    parts.push(`      <condAmb>${params.condAmb}</condAmb>`);
    parts.push(`      <dscAtivDes>${this.esc(params.dscAtivDes)}</dscAtivDes>`);
    parts.push('      <epcEpi>');
    parts.push(`        <utilizEpc>${params.utilizEpc}</utilizEpc>`);
    parts.push(`        <utilizEpi>${params.utilizEpi}</utilizEpi>`);
    parts.push('      </epcEpi>');
    parts.push('    </infoCondicaoAmb>');
    parts.push('  </evtCondicaoAmb>');
    parts.push('</eSocial>');
    return parts.join('\n');
  }

  // ── S-2210 Comunicacao de Acidente de Trabalho (CAT) ────────────────────────
  // tpAcid: 1=Tipico, 2=Trajeto, 3=Doenca Ocupacional
  // tpCat:  1=Inicial, 2=Reabertura, 3=Comunicacao de Obito
  async generateS2210(companyId: string, employeeId: string, params: {
    dtAcid:      string;  // YYYY-MM-DD
    hrAcid:      string;  // HH:MM
    tpAcid:      '1'|'2'|'3';
    tpCat:       '1'|'2'|'3';
    dscLoc:      string;
    codCID:      string;
    dscLesao:    string;
    descricao:   string;
    dtAtend:     string;
    nmMedico:    string;
    nrOC:        string;  // CRM
    ufCRM:       string;
    tpAmb?:      '1'|'2';
  }): Promise<string> {
    const company = await this.prisma.company.findFirstOrThrow({ where: { id: companyId } });
    const emp     = await this.prisma.employee.findFirstOrThrow({ where: { id: employeeId, companyId, deletedAt: null } });
    const cnpj    = this.digits(company.taxId);
    const id      = this.evtId(cnpj, '00210');
    const tpAmb   = params.tpAmb ?? '2';
    const parts: string[] = [];
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtCAT/v03_00_00_00">');
    parts.push(`  <evtCAT Id="${id}">`);
    parts.push(`    <ideEvento><indRetif>1</indRetif><tpAmb>${tpAmb}</tpAmb><procEmi>1</procEmi><verProc>1.0.0</verProc></ideEvento>`);
    parts.push(`    <ideEmpregador><tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc></ideEmpregador>`);
    parts.push('    <ideVinculo>');
    parts.push(`      <cpfTrab>${this.digits(emp.taxId)}</cpfTrab>`);
    parts.push(`      <matricula>${this.esc(emp.registrationNumber ?? emp.taxId)}</matricula>`);
    parts.push('    </ideVinculo>');
    parts.push('    <cat>');
    parts.push(`      <dtAcid>${params.dtAcid}</dtAcid>`);
    parts.push(`      <tpAcid>${params.tpAcid}</tpAcid>`);
    parts.push(`      <hrAcid>${params.hrAcid}</hrAcid>`);
    parts.push(`      <tpCat>${params.tpCat}</tpCat>`);
    parts.push(`      <dscLoc>${this.esc(params.dscLoc)}</dscLoc>`);
    parts.push(`      <codCID>${this.esc(params.codCID)}</codCID>`);
    parts.push(`      <descricao>${this.esc(params.descricao)}</descricao>`);
    parts.push('      <atestado>');
    parts.push(`        <dtAtendimento>${params.dtAtend}</dtAtendimento>`);
    parts.push('        <indInternacao>N</indInternacao>');
    parts.push('        <durTrat>0</durTrat>');
    parts.push('        <indAfast>N</indAfast>');
    parts.push(`        <dscLesao>${this.esc(params.dscLesao)}</dscLesao>`);
    parts.push(`        <codCID>${this.esc(params.codCID)}</codCID>`);
    parts.push(`        <diagProvavel>${this.esc(params.dscLesao)}</diagProvavel>`);
    parts.push(`        <nmMedico>${this.esc(params.nmMedico)}</nmMedico>`);
    parts.push(`        <nrOC>${this.esc(params.nrOC)}</nrOC>`);
    parts.push(`        <ufCRM>${this.esc(params.ufCRM)}</ufCRM>`);
    parts.push('      </atestado>');
    parts.push('    </cat>');
    parts.push('  </evtCAT>');
    parts.push('</eSocial>');
    return parts.join('\n');
  }

  // ── S-1210 Pagamento de Rendimentos do Trabalho ──────────────────────────────
  // tpPgto: 1=Normal, 2=13o salario, 3=Ferias, 4=PLR, 5=Rescisao
  async generateS1210(companyId: string, employeeId: string, params: {
    perApur:  string;  // YYYY-MM
    dtPgto:   string;  // YYYY-MM-DD
    tpPgto:   '1'|'2'|'3'|'4'|'5';
    tpAmb?:   '1'|'2';
  }): Promise<string> {
    const company = await this.prisma.company.findFirstOrThrow({ where: { id: companyId } });
    const emp     = await this.prisma.employee.findFirstOrThrow({ where: { id: employeeId, companyId, deletedAt: null } });
    const cnpj    = this.digits(company.taxId);
    const id      = this.evtId(cnpj, '00210');
    const tpAmb   = params.tpAmb ?? '2';
    const parts: string[] = [];
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtPgtos/v02_00_00_00">');
    parts.push(`  <evtPgtos Id="${id}">`);
    parts.push('    <ideEvento>');
    parts.push('      <indRetif>1</indRetif>');
    parts.push(`      <perApur>${params.perApur}</perApur>`);
    parts.push(`      <tpAmb>${tpAmb}</tpAmb>`);
    parts.push('      <procEmi>1</procEmi>');
    parts.push('      <verProc>1.0.0</verProc>');
    parts.push('    </ideEvento>');
    parts.push(`    <ideEmpregador><tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc></ideEmpregador>`);
    parts.push('    <ideVinculo>');
    parts.push(`      <cpfBenef>${this.digits(emp.taxId)}</cpfBenef>`);
    parts.push(`      <matricula>${this.esc(emp.registrationNumber ?? emp.taxId)}</matricula>`);
    parts.push('    </ideVinculo>');
    parts.push('    <dmDev>');
    parts.push('      <ideDmDev>1</ideDmDev>');
    parts.push(`      <dtPgto>${params.dtPgto}</dtPgto>`);
    parts.push(`      <tpPgto>${params.tpPgto}</tpPgto>`);
    parts.push('    </dmDev>');
    parts.push('  </evtPgtos>');
    parts.push('</eSocial>');
    return parts.join('\n');
  }


  // ── S-2190 Admissao Preliminar ───────────────────────────────────────────────
  async generateS2190(companyId: string, employeeId: string, params: {
    dtAdm: string; codCateg?: string; tpContr?: '1'|'2'; tpAmb?: '1'|'2';
  }): Promise<string> {
    const company = await this.prisma.company.findFirstOrThrow({ where: { id: companyId } });
    const emp     = await this.prisma.employee.findFirstOrThrow({ where: { id: employeeId, companyId, deletedAt: null } });
    const cnpj = this.digits(company.taxId);
    const id   = this.evtId(cnpj, '00190');
    const tpAmb = params.tpAmb ?? '2';
    const parts: string[] = [];
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtAdmissaoPreliminar/v03_00_00_00">');
    parts.push(`  <evtAdmissaoPreliminar Id="${id}">`);
    parts.push(`    <ideEvento><indRetif>1</indRetif><tpAmb>${tpAmb}</tpAmb><procEmi>1</procEmi><verProc>1.0.0</verProc></ideEvento>`);
    parts.push(`    <ideEmpregador><tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc></ideEmpregador>`);
    parts.push('    <trabalhador>');
    parts.push(`      <cpfTrab>${this.digits(emp.taxId)}</cpfTrab>`);
    parts.push(`      <nisTrab>${this.digits(emp.pisNumber ?? '')}</nisTrab>`);
    parts.push(`      <nmTrab>${this.esc(emp.fullName)}</nmTrab>`);
    parts.push('    </trabalhador>');
    parts.push('    <vinculo>');
    parts.push(`      <matricula>${this.esc(emp.registrationNumber ?? emp.taxId)}</matricula>`);
    parts.push(`      <codCateg>${params.codCateg ?? '01'}</codCateg>`);
    parts.push(`      <dtAdm>${params.dtAdm}</dtAdm>`);
    parts.push('      <tmpParc>0</tmpParc>');
    parts.push('      <duracao>');
    parts.push(`        <tpContr>${params.tpContr ?? '1'}</tpContr>`);
    parts.push('      </duracao>');
    parts.push('    </vinculo>');
    parts.push('  </evtAdmissaoPreliminar>');
    parts.push('</eSocial>');
    return parts.join('\n');
  }

  // ── S-1202 Remuneracao Trabalhador Sem Vinculo (Pro-labore / Autonomo) ────────
  // codCateg: 701=Contrib.Individual Pro-labore, 711=Autonomo, 722=Diretor
  async generateS1202(companyId: string, employeeId: string, params: {
    perApur: string; vrBcCp: number; codCateg?: string; tpAmb?: '1'|'2';
  }): Promise<string> {
    const company = await this.prisma.company.findFirstOrThrow({ where: { id: companyId } });
    const emp     = await this.prisma.employee.findFirstOrThrow({ where: { id: employeeId, companyId, deletedAt: null } });
    const cnpj  = this.digits(company.taxId);
    const id    = this.evtId(cnpj, '01202');
    const tpAmb = params.tpAmb ?? '2';
    const cat   = params.codCateg ?? '701';
    const parts: string[] = [];
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtRemuneracao/v04_00_00_00">');
    parts.push(`  <evtRemuneracao Id="${id}">`);
    parts.push('    <ideEvento>');
    parts.push('      <indRetif>1</indRetif>');
    parts.push(`      <perApur>${params.perApur}</perApur>`);
    parts.push(`      <tpAmb>${tpAmb}</tpAmb>`);
    parts.push('      <procEmi>1</procEmi><verProc>1.0.0</verProc>');
    parts.push('    </ideEvento>');
    parts.push(`    <ideEmpregador><tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc></ideEmpregador>`);
    parts.push('    <ideTrabSemVinculo>');
    parts.push(`      <cpfTrab>${this.digits(emp.taxId)}</cpfTrab>`);
    parts.push(`      <codCateg>${cat}</codCateg>`);
    parts.push('    </ideTrabSemVinculo>');
    parts.push('    <dmDev>');
    parts.push('      <ideDmDev>1</ideDmDev>');
    parts.push(`      <codCateg>${cat}</codCateg>`);
    parts.push('      <infoComplPer>');
    parts.push('        <ideEstabLot>');
    parts.push(`          <tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc>`);
    parts.push('          <codLotacao>001</codLotacao>');
    parts.push('          <detVerbas>');
    parts.push('            <codRubr>0001</codRubr>');
    parts.push('            <ideTabRubr>S</ideTabRubr>');
    parts.push('            <qtdRubr>1.00</qtdRubr>');
    parts.push(`            <vrRubr>${params.vrBcCp.toFixed(2)}</vrRubr>`);
    parts.push('          </detVerbas>');
    parts.push('        </ideEstabLot>');
    parts.push('        <infoComplCont>');
    parts.push(`          <vrBcCpMensal>${params.vrBcCp.toFixed(2)}</vrBcCpMensal>`);
    parts.push('        </infoComplCont>');
    parts.push('      </infoComplPer>');
    parts.push('    </dmDev>');
    parts.push('  </evtRemuneracao>');
    parts.push('</eSocial>');
    return parts.join('\n');
  }

  // ── S-2220 Monitoramento Saude do Trabalhador (ASO/PCMSO) ────────────────────
  // resAso: 1=Apto, 2=Inapto Temporario, 3=Inapto Permanente, 4=Inapto p/ func.
  // tpAso: 0=Admissional, 1=Periodico, 2=Retorno, 3=Mudanca risco, 9=Demissional
  async generateS2220(companyId: string, employeeId: string, params: {
    dtAso: string; resAso: '1'|'2'|'3'|'4'; tpAso: string;
    nmMedico: string; nrCRM: string; ufCRM: string;
    exames?: { dtExm: string; procRealizado: string }[];
    tpAmb?: '1'|'2';
  }): Promise<string> {
    const company = await this.prisma.company.findFirstOrThrow({ where: { id: companyId } });
    const emp     = await this.prisma.employee.findFirstOrThrow({ where: { id: employeeId, companyId, deletedAt: null } });
    const cnpj  = this.digits(company.taxId);
    const id    = this.evtId(cnpj, '02220');
    const tpAmb = params.tpAmb ?? '2';
    const parts: string[] = [];
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtMonit/v01_00_00_00">');
    parts.push(`  <evtMonit Id="${id}">`);
    parts.push(`    <ideEvento><indRetif>1</indRetif><tpAmb>${tpAmb}</tpAmb><procEmi>1</procEmi><verProc>1.0.0</verProc></ideEvento>`);
    parts.push(`    <ideEmpregador><tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc></ideEmpregador>`);
    parts.push('    <ideVinculo>');
    parts.push(`      <cpfTrab>${this.digits(emp.taxId)}</cpfTrab>`);
    parts.push(`      <matricula>${this.esc(emp.registrationNumber ?? emp.taxId)}</matricula>`);
    parts.push('    </ideVinculo>');
    parts.push('    <aso>');
    parts.push(`      <dtAso>${params.dtAso}</dtAso>`);
    parts.push(`      <resAso>${params.resAso}</resAso>`);
    parts.push(`      <tpAso>${params.tpAso}</tpAso>`);
    const exames = params.exames?.length ? params.exames : [{ dtExm: params.dtAso, procRealizado: '0001' }];
    for (const ex of exames) {
      parts.push('      <exame>');
      parts.push(`        <dtExm>${ex.dtExm}</dtExm>`);
      parts.push(`        <procRealizado>${ex.procRealizado}</procRealizado>`);
      parts.push('      </exame>');
    }
    parts.push('      <medico>');
    parts.push(`        <nmMed>${this.esc(params.nmMedico)}</nmMed>`);
    parts.push(`        <nrCRM>${this.esc(params.nrCRM)}</nrCRM>`);
    parts.push(`        <ufCRM>${this.esc(params.ufCRM)}</ufCRM>`);
    parts.push('      </medico>');
    parts.push('    </aso>');
    parts.push('  </evtMonit>');
    parts.push('</eSocial>');
    return parts.join('\n');
  }

  // ── S-1070 Processos Administrativos/Judiciais ────────────────────────────────
  // tpProc: 1=Administrativo, 2=Judicial
  async generateS1070(companyId: string, params: {
    tpProc: '1'|'2'; nrProc: string; origem: '1'|'2'|'3';
    obsSusp: string; tpAmb?: '1'|'2';
  }): Promise<string> {
    const company = await this.prisma.company.findFirstOrThrow({ where: { id: companyId } });
    const cnpj  = this.digits(company.taxId);
    const id    = this.evtId(cnpj, '01070');
    const tpAmb = params.tpAmb ?? '2';
    const parts: string[] = [];
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtTabProcesso/v09_01_00_00">');
    parts.push(`  <evtTabProcesso Id="${id}">`);
    parts.push(`    <ideEvento><indRetif>1</indRetif><tpAmb>${tpAmb}</tpAmb><procEmi>1</procEmi><verProc>1.0.0</verProc></ideEvento>`);
    parts.push(`    <ideEmpregador><tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc></ideEmpregador>`);
    parts.push('    <infoProcesso>');
    parts.push('      <inclusao>');
    parts.push('        <ideProcesso>');
    parts.push(`          <tpProc>${params.tpProc}</tpProc>`);
    parts.push(`          <nrProc>${this.esc(params.nrProc)}</nrProc>`);
    parts.push('        </ideProcesso>');
    parts.push('        <dadosProc>');
    parts.push(`          <origem>${params.origem}</origem>`);
    parts.push(`          <nrProcJud>${this.esc(params.nrProc)}</nrProcJud>`);
    parts.push(`          <obsSusp>${this.esc(params.obsSusp)}</obsSusp>`);
    parts.push('        </dadosProc>');
    parts.push('      </inclusao>');
    parts.push('    </infoProcesso>');
    parts.push('  </evtTabProcesso>');
    parts.push('</eSocial>');
    return parts.join('\n');
  }

  // ── S-2298 Reintegracao ───────────────────────────────────────────────────────
  // motivo: 1=Reint.Judicial, 2=Conversao Susp.->Rescisao, 3=Outros
  async generateS2298(companyId: string, employeeId: string, params: {
    dtReintegr: string; motivo: '1'|'2'|'3'; tpAmb?: '1'|'2';
  }): Promise<string> {
    const company = await this.prisma.company.findFirstOrThrow({ where: { id: companyId } });
    const emp     = await this.prisma.employee.findFirstOrThrow({ where: { id: employeeId, companyId, deletedAt: null } });
    const cnpj  = this.digits(company.taxId);
    const id    = this.evtId(cnpj, '02298');
    const tpAmb = params.tpAmb ?? '2';
    const parts: string[] = [];
    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtReintegr/v02_00_00_00">');
    parts.push(`  <evtReintegr Id="${id}">`);
    parts.push(`    <ideEvento><indRetif>1</indRetif><tpAmb>${tpAmb}</tpAmb><procEmi>1</procEmi><verProc>1.0.0</verProc></ideEvento>`);
    parts.push(`    <ideEmpregador><tpInsc>1</tpInsc><nrInsc>${cnpj}</nrInsc></ideEmpregador>`);
    parts.push('    <ideVinculo>');
    parts.push(`      <cpfTrab>${this.digits(emp.taxId)}</cpfTrab>`);
    parts.push(`      <matricula>${this.esc(emp.registrationNumber ?? emp.taxId)}</matricula>`);
    parts.push('    </ideVinculo>');
    parts.push('    <reintegr>');
    parts.push(`      <dtReintegr>${params.dtReintegr}</dtReintegr>`);
    parts.push(`      <motivo>${params.motivo}</motivo>`);
    parts.push('    </reintegr>');
    parts.push('  </evtReintegr>');
    parts.push('</eSocial>');
    return parts.join('\n');
  }

  // ── Listar eventos disponiveis por funcionario ───────────────────────────────
  async listEvents(companyId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { companyId, deletedAt: null },
      select: {
        id: true, fullName: true, taxId: true,
        hireDate: true, terminationDate: true,
        salary: true, role: true, status: true,
        weeklyHours: true, registrationNumber: true,
      },
      orderBy: { fullName: 'asc' },
    });

    return employees.map(e => ({
      ...e,
      events: [
        { tipo: 'S-2200', descricao: 'Admissão', status: 'DISPONIVEL' },
        { tipo: 'S-2205', descricao: 'Alteração Contratual', status: 'DISPONIVEL' },
        { tipo: 'S-1200', descricao: `Remuneração ${new Date().toISOString().slice(0,7)}`, status: 'DISPONIVEL' },
        ...(e.terminationDate ? [{ tipo: 'S-2299', descricao: 'Desligamento', status: 'DISPONIVEL' }] : []),
      ],
    }));
  }
}
