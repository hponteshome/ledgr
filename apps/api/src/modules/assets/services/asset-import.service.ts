// apps/api/src/modules/assets/services/asset-import.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AssetsService } from './assets.service';
import { AssetHistoryService } from './history.service';

export interface ImportRow {
    line: number;
    internalCode: string;
    group: string;
    description: string;
    acquisitionDate: string;
    acquisitionCost: number;
    landValuePercent?: number;
    registryNumber?: string;
    city?: string;
    state?: string;
    assetAccountCode?: string;
    depreciationAccCode?: string;
    accumDeprecAccCode?: string;
    registryOffice?: string;
    builtArea?: number;
    totalArea?: number;
    assessedValue?: number;
    landFraction?: number;
    iptuRegistration?: string;
    depreciationStart?: string;
}

export interface ImportPreview {
    rows: ImportRow[];
    errors: { line: number; message: string }[];
    duplicates: { line: number; internalCode: string }[];
}

export interface ImportResult {
    created: number;
    overwritten: number;
    ignored: number;
    errors: { line: number; internalCode: string; message: string }[];
}

const VALID_GROUPS = [
    'REAL_ESTATE', 'MACHINERY_EQUIPMENT', 'VEHICLE',
    'FURNITURE_FIXTURE', 'IT_EQUIPMENT', 'INTANGIBLE', 'OTHER',
];

const VALID_METHODS = [
    'STRAIGHT_LINE', 'SUM_OF_DIGITS', 'ACCELERATED_2X',
];

function parseDate(s: string): string | null {
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    const serial = parseInt(s, 10);
    if (!isNaN(serial) && serial > 40000 && serial < 60000) {
        const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
        const dd = String(d.getUTCDate()).padStart(2, String.fromCharCode(39) + String.fromCharCode(48) + String.fromCharCode(39));
        const mm = String(d.getUTCMonth() + 1).padStart(2, String.fromCharCode(39) + String.fromCharCode(48) + String.fromCharCode(39));
        const yyyy = d.getUTCFullYear();
        return `${yyyy}-${mm}-${dd}`;
    }
    return null;
}
function parseDecimal(s: string): number | undefined {
    if (!s || s.trim() === '') return undefined;
    const n = parseFloat(s.trim().replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? undefined : n;
}
@Injectable()
export class AssetImportService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly assetsService: AssetsService,
        private readonly history: AssetHistoryService,
    ) { }

    // ── Parse do arquivo ────────────────────────────────────

    parseFile(content: string): ImportPreview {
        const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) throw new BadRequestException('Arquivo vazio ou sem dados após o cabeçalho.');

        const header = lines[0].split('|').map(h => h.replace(/\t/g, '').trim().toLowerCase());
        const expectedHeader = [
            'codigo', 'grupo', 'descricao', 'data_aquisicao', 'valor_aquisicao',
            'land_pct', 'matricula', 'municipio', 'uf', 'conta_ativo', 'conta_deprec',
            'conta_acum', 'cartorio', 'area_construida', 'area_total',
            'valor_venal_itbi', 'fracao_ideal', 'inscricao iptu',
        ];

        // Validação básica do cabeçalho
        if (header[0] !== 'codigo' || header[1] !== 'grupo') {
            throw new BadRequestException('Cabeçalho inválido. Primeira coluna deve ser CODIGO e segunda GRUPO.');
        }

        const rows: ImportRow[] = [];
        const errors: { line: number; message: string }[] = [];
        const duplicates: { line: number; internalCode: string }[] = [];
        const seenCodes = new Set<string>();

        for (let i = 1; i < lines.length; i++) {
            const lineNum = i + 1;
            const cols = lines[i].split('|').map(c => c.replace(/\t/g, '').trim());

            const internalCode = cols[0];
            const group = cols[1];
            const description = cols[2];
            const acquisitionDate = parseDate(cols[3]);
            const acquisitionCost = parseDecimal(cols[4]);

            // Validações obrigatórias
            if (!internalCode) { errors.push({ line: lineNum, message: 'Código interno vazio' }); continue; }
            if (!VALID_GROUPS.includes(group)) { errors.push({ line: lineNum, message: `Grupo inválido: ${group}` }); continue; }
            if (!description) { errors.push({ line: lineNum, message: 'Descrição vazia' }); continue; }
            if (!acquisitionDate) { errors.push({ line: lineNum, message: `Data inválida: ${cols[3]}` }); continue; }
            if (!acquisitionCost || acquisitionCost <= 0) { errors.push({ line: lineNum, message: `Valor inválido: ${cols[4]}` }); continue; }

            if (seenCodes.has(internalCode)) {
                errors.push({ line: lineNum, message: `Código duplicado no arquivo: ${internalCode}` });
                continue;
            }
            seenCodes.add(internalCode);

            rows.push({
                line: lineNum,
                internalCode,
                group,
                description,
                acquisitionDate,
                acquisitionCost,
                landValuePercent: parseDecimal(cols[5]),
                registryNumber: cols[6] || undefined,
                city: cols[7] || undefined,
                state: cols[8] || undefined,
                assetAccountCode: cols[9] || undefined,
                depreciationAccCode: cols[10] || undefined,
                accumDeprecAccCode: cols[11] || undefined,
                registryOffice: cols[12] || undefined,
                builtArea: parseDecimal(cols[13]),
                totalArea: parseDecimal(cols[14]),
                assessedValue: parseDecimal(cols[15]),
                landFraction: parseDecimal(cols[16]),
                iptuRegistration: cols[17] || undefined,
                depreciationStart: parseDate(cols[18]) || undefined,
            });
        }

        return { rows, errors, duplicates };
    }

    // ── Verificar duplicatas no banco ───────────────────────

    async checkDuplicates(companyId: string, rows: ImportRow[]): Promise<string[]> {
        const codes = rows.map(r => r.internalCode);
        const existing = await this.prisma.fixedAsset.findMany({
            where: { companyId, internalCode: { in: codes }, deletedAt: null },
            select: { internalCode: true },
        });
        return existing.map(e => e.internalCode);
    }

    // ── Lookup de conta pelo código ─────────────────────────

    private async lookupAccount(companyId: string, code?: string): Promise<string | undefined> {
        if (!code) return undefined;
        const clean = code.replace(/\./g, '');
        const acc = await this.prisma.chartOfAccounts.findFirst({
            where: {
                companyId,
                deletedAt: null,
                OR: [{ code }, { code: clean }, { spedCode: clean }],
            },
            select: { id: true },
        });
        return acc?.id ?? undefined;
    }

    // ── Importar ────────────────────────────────────────────

    async importRows(
        companyId: string,
        rows: ImportRow[],
        duplicateCodes: string[],
        duplicateAction: 'overwrite' | 'ignore',
        performedById?: string,
    ): Promise<ImportResult> {
        const result: ImportResult = { created: 0, overwritten: 0, ignored: 0, errors: [] };

        for (const row of rows) {
            try {
                const isDuplicate = duplicateCodes.includes(row.internalCode);

                if (isDuplicate && duplicateAction === 'ignore') {
                    result.ignored++;
                    continue;
                }

                // Lookup contas
                const assetAccountId = await this.lookupAccount(companyId, row.assetAccountCode);
                const depreciationAccId = await this.lookupAccount(companyId, row.depreciationAccCode);
                const accumDeprecAccId = await this.lookupAccount(companyId, row.accumDeprecAccCode);

                // Calcular landValueAmount
                const landValueAmount = row.landValuePercent
                    ? (row.acquisitionCost * row.landValuePercent) / 100
                    : (row.landFraction ? row.acquisitionCost * row.landFraction : undefined);

                const data: any = {
                    companyId,
                    internalCode: row.internalCode,
                    description: row.description,
                    group: row.group,
                    acquisitionCost: row.acquisitionCost,
                    acquisitionDate: new Date(row.acquisitionDate),
                    bookValue: row.acquisitionCost,
                    residualValue: 0,
                    depreciationMethod: 'STRAIGHT_LINE',
                    usefulLifeMonths: 480,
                    remainingLifeMonths: 480,
                    annualRatePercent: '2.50',
                    nonDepreciable: false,
                    depreciationStart: row.depreciationStart ? new Date(row.depreciationStart) : new Date(row.acquisitionDate),
                    landValuePercent: row.landValuePercent ?? null,
                    landValueAmount: landValueAmount ?? null,
          // landFraction e auxiliar — nao persiste no banco
                    registryNumber: row.registryNumber ?? null,
                    registryOffice: row.registryOffice ?? null,
                    city: row.city ?? null,
                    state: row.state ?? null,
                    builtArea: row.builtArea ?? null,
                    totalArea: row.totalArea ?? null,
                    assessedValue: row.assessedValue ?? null,
                    iptuRegistration: row.iptuRegistration ?? null,
                    assetAccountId: assetAccountId ?? null,
                    depreciationAccId: depreciationAccId ?? null,
                    accumDeprecAccId: accumDeprecAccId ?? null,
                };

                if (isDuplicate && duplicateAction === 'overwrite') {
                    const existing = await this.prisma.fixedAsset.findFirst({
                        where: { companyId, internalCode: row.internalCode, deletedAt: null },
                    });
                    if (existing) {
                        await this.prisma.fixedAsset.update({ where: { id: existing.id }, data });
                        await this.history.record(existing.id, companyId, 'TRANSFER',
                            `Ativo atualizado via importação em lote`, row.acquisitionCost, row.acquisitionCost, performedById);
                        result.overwritten++;
                    }
                } else {
                    const asset = await this.prisma.fixedAsset.create({ data });
                    await this.history.record(asset.id, companyId, 'ACQUISITION',
                        `Ativo importado em lote: ${row.description}`, undefined, row.acquisitionCost, performedById);
                    result.created++;
                }
            } catch (err: any) {
                result.errors.push({ line: row.line, internalCode: row.internalCode, message: err.message });
            }
        }

        return result;
    }
}
