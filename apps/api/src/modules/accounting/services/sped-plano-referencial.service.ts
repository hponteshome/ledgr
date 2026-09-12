// apps/api/src/modules/accounting/services/sped-plano-referencial.service.ts
// NOVO (11/09/2026): importa o plano referencial oficial da Receita
// (registro I051) a partir dos arquivos brutos da pasta de instalacao do
// programa SPED Contabil (formato pipe-delimitado, encoding Latin-1,
// header "versao=N" na primeira linha). Cobertura completa: P100/P150
// (PJ geral), L100/L300 (BACEN/SUSEP), U100/U150 (variante adicional) -
// mesma estrutura de colunas confirmada em todas: CODIGO|DESCRICAO|DT_INI|
// DT_FIM|ORDEM|TIPO|COD_SUP|NIVEL|NATUREZA.
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

// Nome de arquivo esperado (ex: "SPEDCONTABIL_DINAMICO_2018$SPEDECF_DINAMICA_L100_A$1$1045")
const FILENAME_RE = /^SPEDCONTABIL_DINAMICO_(\d{4})\$SPEDECF_DINAMICA_([PLU]\d{3}(?:_[A-Z])?)\$(\d+)\$(\d+)$/;

function parseDdmmyyyy(raw: string): Date | null {
  const s = raw.trim();
  if (s.length !== 8) return null;
  const dd = parseInt(s.slice(0, 2), 10);
  const mm = parseInt(s.slice(2, 4), 10);
  const yyyy = parseInt(s.slice(4, 8), 10);
  if (isNaN(dd) || isNaN(mm) || isNaN(yyyy)) return null;
  return new Date(Date.UTC(yyyy, mm - 1, dd));
}

export interface SpedImportResult {
  file: string;
  tabela: string | null;
  anoBase: number | null;
  versao: number | null;
  inserted: number;
  error?: string;
}

@Injectable()
export class SpedPlanoReferencialService {
  private readonly logger = new Logger(SpedPlanoReferencialService.name);
  constructor(private prisma: PrismaService) {}

  async importFiles(files: { originalname: string; buffer: Buffer }[]): Promise<SpedImportResult[]> {
    const results: SpedImportResult[] = [];
    for (const file of files) {
      results.push(await this.importOne(file.originalname, file.buffer));
    }
    return results;
  }

  private async importOne(filename: string, buffer: Buffer): Promise<SpedImportResult> {
    const match = FILENAME_RE.exec(filename);
    if (!match) {
      return { file: filename, tabela: null, anoBase: null, versao: null, inserted: 0, error: 'Nome de arquivo fora do padrao esperado (SPEDCONTABIL_DINAMICO_ANO$SPEDECF_DINAMICA_TABELA$VERSAO$ID) - ignorado.' };
    }
    const [, anoStr, tabela] = match;
    const anoBase = parseInt(anoStr, 10);

    // Arquivo esta em Latin-1 (ISO-8859-1), nao UTF-8 - confirmado no teste
    // manual (acentos apareciam corrompidos quando lido como UTF-8).
    const text = buffer.toString('latin1');
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) {
      return { file: filename, tabela, anoBase, versao: null, inserted: 0, error: 'Arquivo vazio.' };
    }

    // Linha 1: "vers\u00e3o=N CODIGO, DESCRICAO, ..." - extrai so o numero da versao.
    const versaoMatch = /vers[a\u00e3]o\s*=\s*(\d+)/i.exec(lines[0]);
    const versao = versaoMatch ? parseInt(versaoMatch[1], 10) : 1;

    const rows: {
      tabela: string; anoBase: number; versao: number; codigo: string; descricao: string;
      dtIni: Date | null; dtFim: Date | null; ordem: number | null; tipo: string | null;
      codSup: string | null; nivel: number | null; natureza: string | null;
    }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split('|');
      if (parts.length < 9) continue;
      const [codigo, descricao, dtIniRaw, dtFimRaw, ordemRaw, tipo, codSup, nivelRaw, natureza] = parts;
      if (!codigo?.trim()) continue;
      rows.push({
        tabela, anoBase, versao,
        codigo: codigo.trim(),
        descricao: (descricao || '').trim(),
        dtIni: parseDdmmyyyy(dtIniRaw || ''),
        dtFim: parseDdmmyyyy(dtFimRaw || ''),
        ordem: ordemRaw?.trim() ? parseInt(ordemRaw.trim(), 10) : null,
        tipo: tipo?.trim() || null,
        codSup: codSup?.trim() || null,
        nivel: nivelRaw?.trim() ? parseInt(nivelRaw.trim(), 10) : null,
        natureza: natureza?.trim() || null,
      });
    }

    if (rows.length === 0) {
      return { file: filename, tabela, anoBase, versao, inserted: 0, error: 'Nenhuma linha de dado valida encontrada.' };
    }

    const res = await this.prisma.spedPlanoReferencial.createMany({
      data: rows,
      skipDuplicates: true,
    });

    this.logger.log(`[SpedPlanoReferencial] ${filename}: ${res.count}/${rows.length} linhas inseridas (tabela=${tabela}, ano=${anoBase}, versao=${versao})`);
    return { file: filename, tabela, anoBase, versao, inserted: res.count };
  }

  async listSummary() {
    const rows = await this.prisma.spedPlanoReferencial.groupBy({
      by: ['tabela', 'anoBase', 'versao'],
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy: [{ anoBase: 'desc' }, { tabela: 'asc' }, { versao: 'desc' }],
    });
    return rows.map(r => ({
      tabela: r.tabela, anoBase: r.anoBase, versao: r.versao,
      quantidade: r._count._all, importadoEm: r._max.createdAt,
    }));
  }

  // NOVO (12/09/2026): usado pela tela de Admin para avisar se a tabela
  // esta vazia (nenhuma importacao feita ainda) e mostrar a data da
  // ultima importacao de forma resumida (sem precisar agregar por linha).
  async getStatus() {
    const total = await this.prisma.spedPlanoReferencial.count();
    const ultima = await this.prisma.spedPlanoReferencial.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return { totalLinhas: total, ultimaImportacao: ultima?.createdAt ?? null };
  }
}
