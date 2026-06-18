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
