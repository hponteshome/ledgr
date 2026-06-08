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
  // Normalizar string para latin1 — remover acentos e caracteres especiais
  private norm(s: string): string {
    return (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')  // remove diacriticos
      .replace(/[^\x00-\xFF]/g, '?');    // substitui chars fora latin1
  }
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

  // ── Versao do leiaute por periodo (ADE Cofis 34/2010 e atualizacoes) ──
  // Ref: https://www.sped.rfb.gov.br/pagina/show/964
  private getCodVer(dtFin: Date): string {
    const ano = dtFin.getUTCFullYear();
    const mes = dtFin.getUTCMonth() + 1; // 1-12
    const anoMes = ano * 100 + mes;
    // Tabela de versoes vigentes por periodo de apuracao
    if (anoMes >= 202501) return '006'; // leiaute 006 - PA >= 01/2025 (Nota Tecnica 009/2024)
    if (anoMes >= 202001) return '005'; // leiaute 005 - PA >= 01/2020
    if (anoMes >= 201806) return '004'; // leiaute 004 - PA >= 06/2018
    if (anoMes >= 201501) return '003'; // leiaute 003 - PA >= 01/2015
    if (anoMes >= 201301) return '002'; // leiaute 002 - PA >= 01/2013
    return '001';                        // leiaute 001 - PA < 01/2013
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
    // 0000: COD_VER|COD_FIN|DT_INI|DT_FIN|NOME|CNPJ|CPF|UF|IE|COD_MUN|IM|SUFRAMA|IND_PERFIL|IND_ATIV
    // 14 campos conforme leiaute RFB (Guia Pratico EFD-Contribuicoes)
    // COD_FIN: 0=Original 1=Retificadora
    // IND_PERFIL: A=Perfil A (completo) B=Perfil B C=Perfil C
    // IND_ATIV: 0=Outros
    // Leiaute 0000 confirmado pelo Guia Pratico EFD-Contribuicoes v1.35 e exemplo real RFB:
    // |0000|COD_VER|COD_FIN|IND_SIT|NR_REC|DT_INI|DT_FIN|NOME|CNPJ|UF|COD_MUN|IE|IND_NATU_PJ|IND_ATIV|
    // IND_SIT: vazio=normal 0=abertura 1=cisao 2=fusao 3=incorporacao 4=encerramento
    // NR_REC: numero recibo anterior (apenas retificadora, senao vazio)
    // IND_NATU_PJ: 00=PJ em geral 01=PF 02=PJ imune/isenta 03=SCP-socia ostensiva 04=SCP-nao ostensiva 05=outros
    // IND_ATIV: 0=Industrial/equiparado 1=Outros
    add(P+'0000'+P
      +this.getCodVer(periodEnd)+P  // 01 COD_VER
      +'0'+P                        // 02 COD_FIN: 0=Original
      +P                            // 03 IND_SIT (vazio=normal)
      +P                            // 04 NR_REC (vazio para original)
      +dtIni+P                      // 05 DT_INI
      +dtFin+P                      // 06 DT_FIN
      +this.norm(company.legalName)+P // 07 NOME (sem acentos)
      +cnpj+P                       // 08 CNPJ
      +(company.state||'SP')+P      // 09 UF
      +(company.codMun||'3550308')+P// 10 COD_MUN (7 digitos IBGE)
      +P                            // 11 IE (inscricao estadual)
      +'00'+P                       // 12 IND_NATU_PJ: 00=PJ em geral
      +codAtiv+P                    // 13 IND_ATIV: 0=industrial 1=outros
    );
    add(P+'0001'+P+'0'+P);
    // 0100 — Dados do contabilista
    const accConfig = await this.prisma.companyAccountingConfig.findUnique({ where: { companyId } });
    if (accConfig?.accountantName) {
      const cpfCont = (accConfig.accountantCpf||'').replace(/\D/g,'');
      const crcCont = accConfig.accountantCrc||'';
      const emailCont = accConfig.accountantEmail || accConfig.escritorioEmail || '';
      const foneCont  = accConfig.accountantPhone || accConfig.escritorioTelefone || '';
      add(P+'0100'+P+this.norm(accConfig.accountantName||'')+P+cpfCont+P+cnpj+P+crcCont+P+(company.city||'')+P+P+emailCont+P+foneCont+P);
    }
    // 0110 — Regimes tributarios
    // COD_INC_TRIB: 1=LucroReal 2=LucroPresumido 3=Arbitrado
    const codIncTrib = regime === 'LUCRO_REAL' ? '1' : '2';
    // 0110: |0110|COD_INC_TRIB|IND_APRO_CRED|COD_TIPO_CONT|IND_REG_CUM|IND_APUR_EXTMP|
    // 5 campos de dados
    // 0110: leiaute dinamico por regime
    // LR nao-cumulativo (COD_INC_TRIB=1): |0110|1|IND_APRO_CRED|COD_TIPO_CONT| = 3 dados
    // LP cumulativo    (COD_INC_TRIB=2): |0110|2|IND_APRO_CRED|COD_TIPO_CONT|IND_REG_CUM| = 4 dados
    // Ambos           (COD_INC_TRIB=3): |0110|3|IND_APRO_CRED|COD_TIPO_CONT| = 3 dados
    if (codInc === '2') {
      // Lucro Presumido cumulativo: inclui IND_REG_CUM
      add(P+'0110'+P
        +codInc+P    // 01 COD_INC_TRIB: 2=Cumulativo
        +'1'+P       // 02 IND_APRO_CRED: 1=Apropriacao Direta
        +'1'+P       // 03 COD_TIPO_CONT: 1=Aliquota Basica
        +'9'+P       // 04 IND_REG_CUM: 9=Competencia detalhada (Blocos A/C/D/F)
      );
    } else {
      // Lucro Real nao-cumulativo ou Ambos: IND_REG_CUM vazio (campo obrigatorio no PVA 6.1.2)
      add(P+'0110'+P
        +codInc+P    // 01 COD_INC_TRIB: 1=NaoCum 3=Ambos
        +'1'+P       // 02 IND_APRO_CRED: 1=Apropriacao Direta
        +'1'+P       // 03 COD_TIPO_CONT: 1=Aliquota Basica
        +P           // 04 IND_REG_CUM: vazio para nao-cumulativo
      );
    }
    // 0140 — Identificacao do estabelecimento
    // 0140: |0140|COD_EST|NOME|CNPJ|UF|IE|COD_MUN|IM|SUFRAMA| — 9 campos
    add(P+'0140'+P
      +P                            // 02 COD_EST (codigo interno - vazio)
      +this.norm(company.legalName)+P // 03 NOME
      +cnpj+P                       // 04 CNPJ
      +(company.state||'SP')+P      // 05 UF
      +P                            // 06 IE (inscricao estadual)
      +(company.codMun||'3550308')+P// 07 COD_MUN
      +P                            // 08 IM (inscricao municipal)
      +P                            // 09 SUFRAMA
    );
    // 0500 — Plano de contas contabeis (obrigatorio para LR nao-cumulativo FG >= nov/2017)
    // |0500|DT_ALT|COD_NAT_CC|IND_CTA|NIVEL|COD_CTA|NOME_CTA|COD_CTA_REF|CNPJ_EST|
    const contasReceita = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, type: 'REVENUE' as any, isAnalytic: true, deletedAt: null },
      select: { code: true, name: true, level: true },
    });
    for (const cta of contasReceita) {
      add(P+'0500'+P
        +dtFin+P                              // 02 DT_ALT
        +'04'+P                               // 03 COD_NAT_CC: 04=contas de resultado
        +'A'+P                                // 04 IND_CTA: A=analitica
        +String(cta.level)+P                  // 05 NIVEL
        +cta.code+P                           // 06 COD_CTA
        +this.norm(cta.name).substring(0,60)+P // 07 NOME_CTA
        +P                                    // 08 COD_CTA_REF (vazio)
        +P                                    // 09 CNPJ_EST (vazio - matriz)
      );
    }
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
      // F100: 19 campos — Guia Pratico v1.35
      // |F100|IND_OPER|COD_PART|COD_ITEM|DT_OPER|VL_OPER|CST_PIS|VL_BC_PIS|ALIQ_PIS|VL_PIS|
      //       CST_COFINS|VL_BC_COFINS|ALIQ_COFINS|VL_COFINS|NAT_BC_CRED|IND_ORIG_CRED|COD_CTA|COD_CCUS|DESC_DOC_OPER|
      // IND_OPER=1: receita auferida tributada (CST 01, 02, 03 ou 05)
      // CST 01: operacao tributavel a aliquota basica nao-cumulativa
      add(P+'F100'+P
        +'1'+P                                    // 02 IND_OPER: 1=Receita tributada
        +P                                        // 03 COD_PART: vazio para receitas
        +P                                        // 04 COD_ITEM: vazio
        +dtFin+P                                  // 05 DT_OPER
        +this.fmtDec(val)+P                       // 06 VL_OPER
        +'01'+P                                   // 07 CST_PIS: 01=tributavel nao-cum
        +this.fmtDec(pisBc)+P                     // 08 VL_BC_PIS
        +pisAliq.toFixed(4).replace('.',',')+P    // 09 ALIQ_PIS (ex: 1,6500)
        +this.fmtDec(pisCr)+P                     // 10 VL_PIS
        +'01'+P                                   // 11 CST_COFINS: 01=tributavel nao-cum
        +this.fmtDec(cofinsBc)+P                  // 12 VL_BC_COFINS
        +cofinsAliq.toFixed(4).replace('.',',')+P // 13 ALIQ_COFINS (ex: 7,6000)
        +this.fmtDec(cofinsCr)+P                  // 14 VL_COFINS
        +P                                        // 15 NAT_BC_CRED: vazio (receita)
        +P                                        // 16 IND_ORIG_CRED: vazio
        +conta.code+P                             // 17 COD_CTA: codigo cadastrado no 0500
        +P                                        // 18 COD_CCUS: vazio
        +this.norm(conta.name).substring(0,60)+P  // 19 DESC_DOC_OPER
      );
    }

    const idxF001 = lines.findIndex(l => l === P+'F001'+P+'0'+P);
    add(P+'F990'+P+(lines.length - idxF001 + 1)+P);

    // ── BLOCO I (vazio — sem operacoes de importacao) ────────────────
    add(P+'I001'+P+'1'+P);
    add(P+'I990'+P+'2'+P);

    // ── BLOCO M — Apuracao PIS/COFINS ────────────────────────────────────────────
    add(P+'M001'+P+'0'+P);

    if (incidencia === 'CUMULATIVO') {
      // ── LP CUMULATIVO: M200 -> M205 -> M400 -> M410 / M600 -> M605 -> M800 -> M810 ──
      // M200 — Consolidacao PIS cumulativo (campo 09=VL_TOT_CONT_CUM_PER)
      add(P+'M200'+P
        +'0,00'+P  // 02 VL_TOT_CONT_NC_PER (nao-cum=zero)
        +'0,00'+P  // 03 VL_TOT_CRED_DESC
        +'0,00'+P  // 04 VL_TOT_CRED_DESC_ANT
        +'0,00'+P  // 05 VL_TOT_CONT_NC_DEV
        +'0,00'+P  // 06 VL_RET_NC
        +'0,00'+P  // 07 VL_OUT_DED_NC
        +'0,00'+P  // 08 VL_CONT_NC_REC
        +this.fmtDec(pisDevido)+P  // 09 VL_TOT_CONT_CUM_PER (cumulativo aqui!)
        +'0,00'+P  // 10 VL_RET_CUM
        +'0,00'+P  // 11 VL_OUT_DED_CUM
        +this.fmtDec(pisDevido)+P  // 12 VL_CONT_CUM_REC
        +this.fmtDec(pisDevido)+P  // 13 VL_TOT_CONT_REC
      );
      // M205 — Detalhamento PIS cumulativo (campo 12 do M200)
      if (pisDevido > 0) {
        add(P+'M205'+P
          +'12'+P       // NUM_CAMPO: campo 12 do M200 (cumulativo)
          +'810902'+P   // COD_REC: PIS faturamento cumulativo
          +this.fmtDec(pisDevido)+P
        );
      }
      // M400 — Receitas PIS cumulativo (isentas/tributadas)
      add(P+'M400'+P);
      add(P+'M410'+P
        +'99'+P                      // NAT_REC: outras receitas
        +this.fmtDec(receitaBase)+P  // VL_REC
        +P                           // COD_CTA
        +P                           // DESC_COMPL
      );
      // M600 — Consolidacao COFINS cumulativo
      add(P+'M600'+P
        +'0,00'+P
        +'0,00'+P
        +'0,00'+P
        +'0,00'+P
        +'0,00'+P
        +'0,00'+P
        +'0,00'+P
        +this.fmtDec(cofinsDevido)+P  // 09 VL_TOT_CONT_CUM_PER
        +'0,00'+P
        +'0,00'+P
        +this.fmtDec(cofinsDevido)+P  // 12 VL_CONT_CUM_REC
        +this.fmtDec(cofinsDevido)+P  // 13 VL_TOT_CONT_REC
      );
      // M605 — Detalhamento COFINS cumulativo
      if (cofinsDevido > 0) {
        add(P+'M605'+P
          +'12'+P
          +'217201'+P   // COD_REC: COFINS faturamento cumulativo
          +this.fmtDec(cofinsDevido)+P
        );
      }
      // M800 — Receitas COFINS cumulativo
      add(P+'M800'+P);
      add(P+'M810'+P
        +'99'+P
        +this.fmtDec(receitaBase)+P
        +P
        +P
      );
    } else {
    // ── LR NAO-CUMULATIVO: M200 -> M210 -> M600 -> M610 ─────────────────────

    // M200 — Consolidacao PIS (13 campos) — pai do M210
    // |M200|VL_TOT_CONT_NC_PER|VL_TOT_CRED_DESC|VL_TOT_CRED_DESC_ANT|VL_TOT_CONT_NC_DEV|
    //       VL_RET_NC|VL_OUT_DED_NC|VL_CONT_NC_REC|VL_TOT_CONT_CUM_PER|
    //       VL_RET_CUM|VL_OUT_DED_CUM|VL_CONT_CUM_REC|VL_TOT_CONT_REC|
    add(P+'M200'+P
      +this.fmtDec(pisDevido)+P                           // 02 VL_TOT_CONT_NC_PER
      +this.fmtDec(creditosPis)+P                         // 03 VL_TOT_CRED_DESC
      +'0,00'+P                                           // 04 VL_TOT_CRED_DESC_ANT
      +this.fmtDec(Math.max(0,pisDevido-creditosPis))+P  // 05 VL_TOT_CONT_NC_DEV
      +'0,00'+P                                           // 06 VL_RET_NC
      +'0,00'+P                                           // 07 VL_OUT_DED_NC
      +this.fmtDec(Math.max(0,pisDevido-creditosPis))+P  // 08 VL_CONT_NC_REC
      +'0,00'+P                                           // 09 VL_TOT_CONT_CUM_PER
      +'0,00'+P                                           // 10 VL_RET_CUM
      +'0,00'+P                                           // 11 VL_OUT_DED_CUM
      +'0,00'+P                                           // 12 VL_CONT_CUM_REC
      +this.fmtDec(Math.max(0,pisDevido-creditosPis))+P  // 13 VL_TOT_CONT_REC
    );

    // M205 — Detalhamento PIS a recolher por codigo de receita (obrigatorio quando M200.campo08 > 0)
    // |M205|NUM_CAMPO|COD_REC|VL_DEBITO|
    // COD_REC 6912: PIS/Pasep nao-cumulativo (DCTF)
    if (pisDevido > creditosPis) {
      add(P+'M205'+P
        +'08'+P                                             // 02 NUM_CAMPO: campo 08 do M200
        +'691201'+P                                         // 03 COD_REC: PIS nao-cumulativo (DCTF 6 digitos)
        +this.fmtDec(Math.max(0,pisDevido-creditosPis))+P  // 04 VL_DEBITO
      );
    }

    // M210 — Detalhamento PIS (filho do M200, 16 campos, FG >= 01/2019)
    // |M210|COD_CONT|VL_REC_BRT|VL_BC_CONT|VL_AJUS_ACRES_BC_PIS|VL_AJUS_REDUC_BC_PIS|
    //       VL_BC_CONT_AJUS|ALIQ_PIS|QUANT_BC_PIS|ALIQ_PIS_QUANT|VL_CONT_APUR|
    //       VL_AJUS_ACRES|VL_AJUS_REDUC|VL_CONT_DIFER|VL_CONT_DIFER_ANT|VL_CONT_PER|
    // COD_CONT: 01=nao-cum aliq basica (CST 01, COD_INC_TRIB=1, ALIQ_PIS=1,65%)
    add(P+'M210'+P
      +'01'+P                                             // 02 COD_CONT
      +this.fmtDec(receitaBase)+P                         // 03 VL_REC_BRT
      +this.fmtDec(receitaBase)+P                         // 04 VL_BC_CONT
      +'0,00'+P                                           // 05 VL_AJUS_ACRES_BC_PIS
      +'0,00'+P                                           // 06 VL_AJUS_REDUC_BC_PIS
      +this.fmtDec(receitaBase)+P                         // 07 VL_BC_CONT_AJUS
      +pisAliq.toFixed(4).replace('.',',')+P              // 08 ALIQ_PIS (ex: 1,6500)
      +P                                                  // 09 QUANT_BC_PIS (vazio)
      +P                                                  // 10 ALIQ_PIS_QUANT (vazio)
      +this.fmtDec(receitaBase*pisAliq/100)+P             // 11 VL_CONT_APUR
      +'0,00'+P                                           // 12 VL_AJUS_ACRES
      +'0,00'+P                                           // 13 VL_AJUS_REDUC
      +'0,00'+P                                           // 14 VL_CONT_DIFER
      +'0,00'+P                                           // 15 VL_CONT_DIFER_ANT
      +this.fmtDec(pisDevido)+P                           // 16 VL_CONT_PER
    );

    // M600 — Consolidacao COFINS (13 campos) — pai do M610
    add(P+'M600'+P
      +this.fmtDec(cofinsDevido)+P                            // 02 VL_TOT_CONT_NC_PER
      +this.fmtDec(creditosCofins)+P                         // 03 VL_TOT_CRED_DESC
      +'0,00'+P                                              // 04 VL_TOT_CRED_DESC_ANT
      +this.fmtDec(Math.max(0,cofinsDevido-creditosCofins))+P// 05 VL_TOT_CONT_NC_DEV
      +'0,00'+P                                              // 06 VL_RET_NC
      +'0,00'+P                                              // 07 VL_OUT_DED_NC
      +this.fmtDec(Math.max(0,cofinsDevido-creditosCofins))+P// 08 VL_CONT_NC_REC
      +'0,00'+P                                              // 09 VL_TOT_CONT_CUM_PER
      +'0,00'+P                                              // 10 VL_RET_CUM
      +'0,00'+P                                              // 11 VL_OUT_DED_CUM
      +'0,00'+P                                              // 12 VL_CONT_CUM_REC
      +this.fmtDec(Math.max(0,cofinsDevido-creditosCofins))+P// 13 VL_TOT_CONT_REC
    );

    // M605 — Detalhamento COFINS a recolher por codigo de receita (obrigatorio quando M600.campo08 > 0)
    // COD_REC 5856: COFINS nao-cumulativa (DCTF)
    if (cofinsDevido > creditosCofins) {
      add(P+'M605'+P
        +'08'+P
        +'585601'+P                                             // COD_REC: COFINS nao-cumulativa (DCTF 6 digitos)
        +this.fmtDec(Math.max(0,cofinsDevido-creditosCofins))+P
      );
    }

    // M610 — Detalhamento COFINS (filho do M600, 16 campos, FG >= 01/2019)
    add(P+'M610'+P
      +'01'+P                                             // 02 COD_CONT
      +this.fmtDec(receitaBase)+P                         // 03 VL_REC_BRT
      +this.fmtDec(receitaBase)+P                         // 04 VL_BC_CONT
      +'0,00'+P                                           // 05 VL_AJUS_ACRES_BC_COFINS
      +'0,00'+P                                           // 06 VL_AJUS_REDUC_BC_COFINS
      +this.fmtDec(receitaBase)+P                         // 07 VL_BC_CONT_AJUS
      +cofinsAliq.toFixed(4).replace('.',',')+P           // 08 ALIQ_COFINS (ex: 7,6000)
      +P                                                  // 09 QUANT_BC_COFINS (vazio)
      +P                                                  // 10 ALIQ_COFINS_QUANT (vazio)
      +this.fmtDec(receitaBase*cofinsAliq/100)+P          // 11 VL_CONT_APUR
      +'0,00'+P                                           // 12 VL_AJUS_ACRES
      +'0,00'+P                                           // 13 VL_AJUS_REDUC
      +'0,00'+P                                           // 14 VL_CONT_DIFER
      +'0,00'+P                                           // 15 VL_CONT_DIFER_ANT
      +this.fmtDec(cofinsDevido)+P                        // 16 VL_CONT_PER
    );

    } // fim else nao-cumulativo

    const idxM001 = lines.findIndex(l => l === P+'M001'+P+'0'+P);
    add(P+'M990'+P+(lines.length - idxM001 + 1)+P);
    // ── BLOCO P (vazio — sem contrib. previdenciaria) ────────────────
    add(P+'P001'+P+'1'+P);
    add(P+'P990'+P+'2'+P);

    // ── BLOCO 1 (vazio — sem processos judiciais referenciados) ─────────────────
    add(P+'1001'+P+'1'+P);  // IND_MOV=1: sem dados
    add(P+'1990'+P+'2'+P);
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
    add(P+'9900'+P+'9900'+P+(regCounts.size + 2)+P);
    add(P+'9900'+P+'9990'+P+'1'+P);
    add(P+'9900'+P+'9999'+P+'1'+P);

    add(P+'9990'+P+(lines.length - lines.findIndex(l => l === P+'9001'+P+'0'+P) + 2)+P);
    add(P+'9999'+P+(lines.length + 1)+P);

    // Preencher 0990 com total do Bloco 0
    const idxA001 = lines.findIndex(l => l === P+'A001'+P+'1'+P);
    lines[idx0990] = P+'0990'+P+idxA001+P;

    this.logger.log(`EFD-Contribuicoes: ${lines.length} linhas | ${competencia} | ${regime} | ${incidencia}`);
    return Buffer.from(lines.join('\n') + '\n', 'latin1');
  }
}