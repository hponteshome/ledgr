// apps/api/src/modules/sped/efd/services/efd-exporter.service.ts
// EFD-Contribuicoes — Leiaute 1.34 (IN RFB 1252/2012 e atualizacoes)
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface EfdExportOptions {
  companyId:   string;
  periodStart: Date;
  periodEnd:   Date;
  regime?:     string;  // LUCRO_REAL | LUCRO_PRESUMIDO
  incidencia?: string;  // NAO_CUMULATIVO | CUMULATIVO
}

@Injectable()
export class EfdExporterService {
  private readonly logger = new Logger(EfdExporterService.name);
  constructor(private prisma: PrismaService) {}

  // ── Helpers ──────────────────────────────────────────────────────────
  private fmtDate(d: Date | string): string {
    const dt = d instanceof Date ? d : new Date(d);
    const dd = String(dt.getUTCDate()).padStart(2,'0');
    const mm = String(dt.getUTCMonth()+1).padStart(2,'0');
    return dd + mm + String(dt.getUTCFullYear());
  }

  private fmtDec(v: number): string {
    return Math.abs(v).toFixed(2).replace('.',',');
  }

  private monthRange(start: Date, end: Date) {
    const result: { year: number; month: number; firstDay: Date; lastDay: Date }[] = [];
    const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cur <= end) {
      const y = cur.getUTCFullYear(), m = cur.getUTCMonth();
      result.push({
        year: y, month: m+1,
        firstDay: new Date(Date.UTC(y,m,1)),
        lastDay:  new Date(Date.UTC(y,m+1,0)),
      });
      cur.setUTCMonth(cur.getUTCMonth()+1);
    }
    return result;
  }

  // ── Exportar ─────────────────────────────────────────────────────────
  async export(options: EfdExportOptions): Promise<Buffer> {
    const {
      companyId, periodStart, periodEnd,
      regime     = 'LUCRO_REAL',
      incidencia = 'NAO_CUMULATIVO',
    } = options;

    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { taxId:true, legalName:true, state:true, city:true, codMun:true },
    });

    const cnpj  = company.taxId.replace(/\D/g,'');
    const dtIni = this.fmtDate(periodStart);
    const dtFin = this.fmtDate(periodEnd);
    const P = '|';

    // Indicador de incidencia: 1=NaoCum  2=Cum  3=Ambos
    const codInc = incidencia === 'NAO_CUMULATIVO' ? '1' : incidencia === 'CUMULATIVO' ? '2' : '3';
    // Indicador de apuracao: 0=mensal  1=trimestral  2=evento especifico
    const indApur = '0';
    // Codigo de atividade: 0=outros
    const codAtiv = '0';

    const competencia = `${periodStart.getUTCFullYear()}-${String(periodStart.getUTCMonth()+1).padStart(2,'0')}`;

    // ── Buscar apuracao PIS/COFINS gravada ───────────────────────────
    const apuracao = await this.prisma.apuracaoImpostos.findFirst({
      where: { companyId, competencia, tipo: 'PIS_COFINS' as any },
    });

    const pisAliq    = incidencia === 'NAO_CUMULATIVO' ? 1.65 : 0.65;
    const cofinsAliq = incidencia === 'NAO_CUMULATIVO' ? 7.60 : 3.00;
    const receitaBase   = Number(apuracao?.receitaBruta   ?? 0);
    const pisDevido     = Number(apuracao?.pisDevido      ?? receitaBase * pisAliq    / 100);
    const cofinsDevido  = Number(apuracao?.cofinsDevido   ?? receitaBase * cofinsAliq / 100);
    const creditosPis   = Number(apuracao?.creditosPis    ?? 0);
    const creditosCofins= Number(apuracao?.creditosCofins ?? 0);

    // ── Buscar receitas do periodo por conta ─────────────────────────
    const receitaRows = await this.prisma.journalEntryItem.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: { companyId, date: { gte: periodStart, lte: periodEnd } },
        account: { type: 'REVENUE' as any },
      },
      _sum: { value: true },
    });
    const receitaIds = receitaRows.map(r => r.accountId);
    const contas = await this.prisma.chartOfAccounts.findMany({
      where: { id: { in: receitaIds } },
      select: { id:true, code:true, name:true },
    });
    const contaMap = new Map(contas.map(c => [c.id, c]));

    const lines: string[] = [];
    const add = (l: string) => lines.push(l);

    // ── BLOCO 0 ──────────────────────────────────────────────────────
    // |0000|COD_VER|COD_FIN|DT_INI|DT_FIN|NOME|CNPJ|UF|COD_MUN|SUFRAMA|IND_NATU_PJ|IND_ATIV|
    add(P+'0000'+P+'006'+P+codInc+P+dtIni+P+dtFin+P+company.legalName+P+cnpj+P+(company.state||'SP')+P+(company.codMun||'3550308')+P+P+'0'+P+codAtiv+P);
    add(P+'0001'+P+'0'+P);
    // 0100 — Dados do contabilista
    const accConfig = await this.prisma.companyAccountingConfig.findUnique({ where: { companyId } });
    if (accConfig?.accountantName) {
      const cpfCont = (accConfig.accountantCpf||'').replace(/\D/g,'');
      const crcCont = accConfig.accountantCrc||'';
      const emailCont = accConfig.accountantEmail || accConfig.escritorioEmail || '';
      const foneCont  = accConfig.accountantPhone || accConfig.escritorioTelefone || '';
      add(P+'0100'+P+(accConfig.accountantName||'')+P+cpfCont+P+cnpj+P+crcCont+P+(company.city||'')+P+P+emailCont+P+foneCont+P);
    }
    // 0110 — Regimes tributarios
    // COD_INC_TRIB: 1=LucroReal 2=LucroPresumido 3=Arbitrado
    const codIncTrib = regime === 'LUCRO_REAL' ? '1' : '2';
    add(P+'0110'+P+codIncTrib+P+indApur+P+'0'+P+'0'+P+'0'+P+'0'+P);
    // 0140 — Identificacao do estabelecimento
    add(P+'0140'+P+cnpj+P+P+P+P+P+(company.codMun||'3550308')+P+P+P+P+P+P);
    // 0150 — Tabela de cadastro do participante (vazio para aluguel puro)
    const idx0990 = lines.length;
    add(P+'0990'+P+'PLACEHOLDER'+P);

    // ── BLOCO A (vazio — sem NFS-e escriturada) ──────────────────────
    add(P+'A001'+P+'1'+P);
    add(P+'A990'+P+'2'+P);

    // ── BLOCO C (vazio — sem NF de mercadorias) ──────────────────────
    add(P+'C001'+P+'1'+P);
    add(P+'C990'+P+'2'+P);

    // ── BLOCO D (vazio — sem CT-e / transportes) ─────────────────────
    add(P+'D001'+P+'1'+P);
    add(P+'D990'+P+'2'+P);

    // ── BLOCO F — Demais documentos e operacoes ──────────────────────
    // Usado para receitas de aluguel (contratos / recibos sem NF)
    add(P+'F001'+P+'0'+P);
    add(P+'F010'+P+cnpj+P);

    // F100 — uma linha por conta de receita no periodo
    for (const row of receitaRows) {
      const conta = contaMap.get(row.accountId);
      if (!conta) continue;
      const val      = Number(row._sum.value??0);
      const pisBc    = val;
      const pisCr    = pisBc  * pisAliq    / 100;
      const cofinsBc = val;
      const cofinsCr = cofinsBc * cofinsAliq / 100;
      // COD_SIT_F100: 16=Oper.com direito a credito (nao-cum) | 01=Op.tributada (cum)
      const codSit = incidencia === 'NAO_CUMULATIVO' ? '16' : '01';
      // |F100|IND_OPER|CNPJ_EMIT|DT_OPER|VL_OPER|COD_PART|COD_SIT|COD_CONTA|VL_BC_PIS|ALIQ_PIS|VL_PIS|VL_BC_COFINS|ALIQ_COFINS|VL_COFINS|NAT_BC_CRED|IND_ORIG_CRED|COD_CTA|COD_COMP|INFO_COMPL|
      add(P+'F100'+P
        +'1'+P           // IND_OPER: 1=Saida/Receita
        +cnpj+P          // CNPJ_EMIT: proprio estabelecimento
        +dtFin+P         // DT_OPER: ultimo dia do periodo
        +this.fmtDec(val)+P
        +P               // COD_PART
        +codSit+P
        +conta.code+P    // COD_CONTA
        +this.fmtDec(pisBc)+P
        +pisAliq.toFixed(2).replace('.',',')+P
        +this.fmtDec(pisCr)+P
        +this.fmtDec(cofinsBc)+P
        +cofinsAliq.toFixed(2).replace('.',',')+P
        +this.fmtDec(cofinsCr)+P
        +P+P             // NAT_BC_CRED | IND_ORIG_CRED
        +conta.code+P    // COD_CTA
        +P               // COD_COMP
        +conta.name.substring(0,60)+P  // INFO_COMPL
      );
    }

    const idxF001 = lines.findIndex(l => l === P+'F001'+P+'0'+P);
    add(P+'F990'+P+(lines.length - idxF001 + 1)+P);

    // ── BLOCO I (vazio — sem operacoes de importacao) ────────────────
    add(P+'I001'+P+'1'+P);
    add(P+'I990'+P+'2'+P);

    // ── BLOCO M — Apuracao PIS/COFINS ────────────────────────────────
    add(P+'M001'+P+'0'+P);

    // M100 — creditos PIS (nao-cumulativo)
    if (creditosPis > 0) {
      add(P+'M100'+P
        +'1'+P                             // COD_CRED: 1=Estoque
        +P                                 // IND_CRED_ORI
        +this.fmtDec(creditosPis)+P        // VL_BC_PIS
        +pisAliq.toFixed(2).replace('.',',')+P
        +this.fmtDec(creditosPis)+P        // VL_CRED
        +this.fmtDec(0)+P+this.fmtDec(0)+P+this.fmtDec(0)+P
        +this.fmtDec(creditosPis)+P        // VL_CRED_DIS
        +this.fmtDec(0)+P+this.fmtDec(0)+P
        +this.fmtDec(creditosPis)+P        // VL_CRED_DESC
        +this.fmtDec(0)+P
      );
    }

    // M200 — Consolidacao contribuicao PIS
    // |M200|VL_TOT_CONT_NC_PER|VL_TOT_CRED_DESC|VL_TOT_CONT_NC_DEV|VL_RET_NC|VL_OUT_DED_NC|VL_CONT_NC_REC|VL_TOT_CONT_CUM_DER|VL_RET_CUM|VL_OUT_DED_CUM|VL_CONT_CUM_REC|VL_TOT_CONT_REC|
    add(P+'M200'+P
      +this.fmtDec(receitaBase * pisAliq / 100)+P  // VL_TOT_CONT_NC_PER
      +this.fmtDec(creditosPis)+P                   // VL_TOT_CRED_DESC
      +this.fmtDec(pisDevido)+P                     // VL_TOT_CONT_NC_DEV
      +'0,00'+P+'0,00'+P                            // VL_RET_NC | VL_OUT_DED_NC
      +this.fmtDec(pisDevido)+P                     // VL_CONT_NC_REC
      +'0,00'+P+'0,00'+P+'0,00'+P+'0,00'+P          // cum zeros
      +this.fmtDec(pisDevido)+P                     // VL_TOT_CONT_REC
    );

    // M400 — Receitas sujeitas ao PIS
    add(P+'M400'+P);
    // M410 — Detalhe receitas PIS
    // COD_REC: 6912=PIS nao-cumulativo | 8109=PIS cumulativo
    const codRecPis = incidencia === 'NAO_CUMULATIVO' ? '6912' : '8109';
    add(P+'M410'+P
      +codRecPis+P                         // COD_REC
      +this.fmtDec(receitaBase)+P          // VL_REC
      +P                                   // CFOP
      +this.fmtDec(receitaBase)+P          // VL_REC_BASES
      +this.fmtDec(receitaBase * pisAliq / 100)+P  // VL_REC_AGRUP
      +P                                   // QUANT_CRED
    );

    // M500 — creditos COFINS (nao-cumulativo)
    if (creditosCofins > 0) {
      add(P+'M500'+P
        +'1'+P
        +P
        +this.fmtDec(creditosCofins)+P
        +cofinsAliq.toFixed(2).replace('.',',')+P
        +this.fmtDec(creditosCofins)+P
        +this.fmtDec(0)+P+this.fmtDec(0)+P+this.fmtDec(0)+P
        +this.fmtDec(creditosCofins)+P
        +this.fmtDec(0)+P+this.fmtDec(0)+P
        +this.fmtDec(creditosCofins)+P
        +this.fmtDec(0)+P
      );
    }

    // M600 — Consolidacao contribuicao COFINS
    add(P+'M600'+P
      +this.fmtDec(receitaBase * cofinsAliq / 100)+P
      +this.fmtDec(creditosCofins)+P
      +this.fmtDec(cofinsDevido)+P
      +'0,00'+P+'0,00'+P
      +this.fmtDec(cofinsDevido)+P
      +'0,00'+P+'0,00'+P+'0,00'+P+'0,00'+P
      +this.fmtDec(cofinsDevido)+P
    );

    // M800 — Receitas sujeitas ao COFINS
    add(P+'M800'+P);
    // M810 — Detalhe receitas COFINS
    const codRecCofins = incidencia === 'NAO_CUMULATIVO' ? '5856' : '2172';
    add(P+'M810'+P
      +codRecCofins+P
      +this.fmtDec(receitaBase)+P
      +P
      +this.fmtDec(receitaBase)+P
      +this.fmtDec(receitaBase * cofinsAliq / 100)+P
      +P
    );

    const idxM001 = lines.findIndex(l => l === P+'M001'+P+'0'+P);
    add(P+'M990'+P+(lines.length - idxM001 + 1)+P);

    // ── BLOCO P (vazio — sem contrib. previdenciaria) ────────────────
    add(P+'P001'+P+'1'+P);
    add(P+'P990'+P+'2'+P);

    // ── BLOCO 1 — Complemento de apuracao ────────────────────────────
    add(P+'1001'+P+'0'+P);
    // 1010 — PIS/COFINS
    add(P+'1010'+P
      +'0'+P  // NUM_IND_REC: 0=sem retencao
      +'0'+P  // VL_REC_CAIXA (regime caixa)
      +this.fmtDec(pisDevido)+P    // VL_RET_PIS
      +this.fmtDec(cofinsDevido)+P // VL_RET_COFINS
      +'0,00'+P // VL_RET_CSLL
      +this.fmtDec(pisDevido)+P    // VL_PIS_COMP_RETIDO
      +this.fmtDec(cofinsDevido)+P // VL_COFINS_COMP_RETIDO
      +'0,00'+P // VL_CSLL_COMP_RETIDO
    );
    const idx1001 = lines.findIndex(l => l === P+'1001'+P+'0'+P);
    add(P+'1990'+P+(lines.length - idx1001 + 1)+P);

    // ── BLOCO 9 — Encerramento ────────────────────────────────────────
    add(P+'9001'+P+'0'+P);

    // Contar registros por tipo
    const regCounts = new Map<string, number>();
    for (const l of lines) {
      const r = l.split(P)[1];
      if (r) regCounts.set(r, (regCounts.get(r) ?? 0) + 1);
    }
    for (const [reg, count] of Array.from(regCounts.entries()).sort()) {
      add(P+'9900'+P+reg+P+count+P);
    }
    add(P+'9900'+P+'9001'+P+'1'+P);
    add(P+'9900'+P+'9900'+P+(regCounts.size + 2)+P);
    add(P+'9900'+P+'9990'+P+'1'+P);
    add(P+'9900'+P+'9999'+P+'1'+P);

    add(P+'9990'+P+(lines.length - lines.findIndex(l => l === P+'9001'+P+'0'+P) + 4)+P);
    add(P+'9999'+P+(lines.length + 1)+P);

    // Preencher 0990 com total do Bloco 0
    const idxA001 = lines.findIndex(l => l === P+'A001'+P+'1'+P);
    lines[idx0990] = P+'0990'+P+idxA001+P;

    this.logger.log(`EFD-Contribuicoes: ${lines.length} linhas | ${competencia} | ${regime} | ${incidencia}`);
    return Buffer.from(lines.join('\n') + '\n', 'latin1');
  }
}
