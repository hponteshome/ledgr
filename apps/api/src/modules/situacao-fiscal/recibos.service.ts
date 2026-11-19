// apps/api/src/modules/situacao-fiscal/recibos.service.ts
// ALERTA-AUTO-01 (19/11/2026)
// 1) Leitura de recibos arquivados (PDF): padroes por declaracao na tabela recibo_padroes (dados, nao codigo).
//    Achou o recibo -> confere o CNPJ com a empresa -> baixa a obrigacao (fiscal_obligations) pelo codigo e competencia.
//    Cada documento e lido uma vez (documents.recibo_lido_em / recibo_dados).
// 2) Alertas com regra de baixa (company_alerts.regra_baixa): avaliados a cada abertura do painel; resolvidos
//    sozinhos quando a condicao e atendida. Alerta sem regra continua manual.
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { textoPorPagina } from './recibo-texto';

const dig = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '');
const MAX_BYTES = 8 * 1024 * 1024;

export interface ReciboLido {
  code: string; nome: string; cnpj: string | null; competence: string | null; recibo: string | null;
  tipo: string | null; recebidoEm: string | null;
}
export interface ResultadoRecibos {
  lidos: number;
  baixas: { documento: string; code: string; competence: string; recibo: string; tipo: string | null }[];
  avisos: string[];
}

@Injectable()
export class RecibosService {
  private readonly logger = new Logger(RecibosService.name);
  constructor(private readonly prisma: PrismaService) {}

  private extrair(p: any, pagina: string): ReciboLido | null {
    if (!new RegExp(p.detecta, 'i').test(pagina)) return null;
    const g = (re: string | null) => { if (!re) return null; const m = pagina.match(new RegExp(re, 'i')); return m ? m : null; };
    const mc = g(p.re_competencia);
    let competence: string | null = null;
    if (mc) {
      if (p.formato_comp === 'MES_ANO') competence = (mc[2] ?? '') + '-' + String(mc[1] ?? '').padStart(2, '0');
      else competence = mc[1] ?? null;
    }
    const mr = g(p.re_recebido_em);
    const recebidoEm = mr ? `${mr[3]}-${mr[2]}-${mr[1]}T${mr[4]}:${mr[5]}:${mr[6] ?? '00'}-03:00` : null;
    const tipo = g(p.re_tipo)?.[1] ?? null;
    return {
      code: p.code, nome: p.nome, cnpj: dig(g(p.re_cnpj)?.[1]) || null, competence,
      recibo: (g(p.re_recibo)?.[1] ?? '').replace(/\s+/g, '') || null,
      tipo: tipo ? tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase() : null, recebidoEm,
    };
  }

  /** Le os PDFs ainda nao lidos da empresa (todos=true rele tudo) e da baixa nas obrigacoes. */
  async processar(companyId: string, todos = false): Promise<ResultadoRecibos> {
    const out: ResultadoRecibos = { lidos: 0, baixas: [], avisos: [] };
    const docs: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id::text AS id, file_url AS "fileUrl", coalesce(original_file_name, title) AS nome
         FROM documents
        WHERE company_id = $1::uuid AND deleted_at IS NULL AND is_template = false
          AND type::text IN ('FISCAL', 'CONTABIL', 'TRABALHISTA')
          AND (lower(coalesce(original_file_name, '')) LIKE '%.pdf' OR lower(coalesce(file_url, '')) LIKE '%.pdf')
          AND ($2::boolean OR recibo_lido_em IS NULL)
        ORDER BY created_at
        LIMIT 200`, companyId, todos);
    if (!docs.length) return out;
    const padroes: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT code, nome, detecta, re_recibo, re_cnpj, re_competencia, formato_comp, re_tipo, re_recebido_em
         FROM recibo_padroes WHERE ativo ORDER BY code`);
    // ALERTA-AUTO-02: CNPJ pelo modelo Prisma (nao depende do nome da coluna)
    const emp = await (this.prisma as any).company.findUnique({ where: { id: companyId }, select: { taxId: true } });
    const cnpjEmpresa = dig(emp?.taxId);

    for (const doc of docs) {
      const dados: any = { recibos: [] as any[] };
      try {
        const arq = path.join(process.cwd(), String(doc.fileUrl ?? '').replace(/^\/+/, ''));
        if (!doc.fileUrl || !fs.existsSync(arq)) dados.erro = 'arquivo nao encontrado';
        else if (fs.statSync(arq).size > MAX_BYTES) dados.erro = 'arquivo grande demais para recibo';
        else {
          const paginas = await textoPorPagina(fs.readFileSync(arq), 10);
          for (const pg of paginas) for (const p of padroes) {
            const r = this.extrair(p, pg);
            if (r) dados.recibos.push(r);
          }
        }
      } catch (e: any) { dados.erro = String(e?.message ?? e); }

      for (const r of dados.recibos as ReciboLido[]) {
        const rot = `${doc.nome}: ${r.nome} ${r.competence ?? '?'}`;
        if (!r.recibo || !r.competence) { (r as any).situacao = 'incompleto'; out.avisos.push(rot + ' - recibo ou competência não identificados'); continue; }
        if (!r.cnpj || r.cnpj !== cnpjEmpresa) { (r as any).situacao = 'cnpj_divergente'; out.avisos.push(rot + ' - CNPJ do recibo diferente da empresa ativa'); continue; }
        const ob: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT id::text AS id, status::text AS status, receipt_number AS recibo FROM fiscal_obligations
            WHERE company_id = $1::uuid AND code = $2 AND competence = $3`, companyId, r.code, r.competence);
        if (!ob.length) { (r as any).situacao = 'sem_obrigacao'; out.avisos.push(rot + ' - obrigação não cadastrada na agenda'); continue; }
        const o = ob[0];
        if (o.status === 'DISPENSED') { (r as any).situacao = 'dispensada'; out.avisos.push(rot + ' - obrigação está como dispensada; nada alterado'); continue; }
        // A retificar: so um recibo de retificadora da a baixa. Recibo da original antiga so e vinculado.
        const daBaixa = o.status !== 'DONE' && !(o.status === 'RECTIFY' && r.tipo !== 'Retificadora');
        const trocaRecibo = daBaixa || !o.recibo || (o.status === 'DONE' && r.tipo === 'Retificadora' && o.recibo !== r.recibo);
        await this.prisma.$executeRawUnsafe(
          `UPDATE fiscal_obligations
              SET document_id = $2::uuid,
                  receipt_number = CASE WHEN $3::boolean THEN $4 ELSE receipt_number END,
                  delivered_at = CASE WHEN $3::boolean AND $5::timestamptz IS NOT NULL THEN ($5::timestamptz AT TIME ZONE 'UTC') ELSE delivered_at END,
                  status = CASE WHEN $6::boolean THEN 'DONE'::"FiscalObligationStatus" ELSE status END,
                  done_at = CASE WHEN $6::boolean THEN now() ELSE done_at END,
                  updated_at = now()
            WHERE id = $1::uuid`,
          o.id, doc.id, trocaRecibo, r.recibo, r.recebidoEm, daBaixa);
        (r as any).situacao = daBaixa ? 'baixada' : 'vinculada';
        if (daBaixa) out.baixas.push({ documento: doc.nome, code: r.code, competence: r.competence, recibo: r.recibo, tipo: r.tipo });
      }
      await this.prisma.$executeRawUnsafe(
        `UPDATE documents SET recibo_lido_em = now(), recibo_dados = $2::jsonb WHERE id = $1::uuid`, doc.id, JSON.stringify(dados));
      out.lidos++;
    }
    if (out.baixas.length) this.logger.log(`Recibos: ${out.baixas.map(b => b.code + ' ' + b.competence).join(', ')} baixados (empresa ${companyId})`);
    return out;
  }

  /** Avalia a regra de baixa de cada alerta aberto; resolve os atendidos. Devolve os alertas resolvidos. */
  async avaliarAlertas(companyId: string): Promise<{ id: string; title: string; motivo: string }[]> {
    const abertos: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id::text AS id, title, regra_baixa AS regra FROM company_alerts
        WHERE company_id = $1::uuid AND resolved_at IS NULL AND regra_baixa IS NOT NULL`, companyId);
    const resolvidos: { id: string; title: string; motivo: string }[] = [];
    for (const a of abertos) {
      let ok = false; let motivo = '';
      try { ({ ok, motivo } = await this.condicao(companyId, a.regra ?? {})); } catch (e: any) { this.logger.warn(`Regra do alerta ${a.id}: ${e?.message ?? e}`); }
      if (!ok) continue;
      const n = await this.prisma.$executeRawUnsafe(
        `UPDATE company_alerts SET resolved_at = now(), resolution_note = $2 WHERE id = $1::uuid AND resolved_at IS NULL`,
        a.id, 'Baixa automática: ' + motivo);
      if (n) resolvidos.push({ id: a.id, title: a.title, motivo });
    }
    return resolvidos;
  }

  // ARQ-DECL-01 (19/11/2026): declaracoes por competencia (agenda de obrigacoes) com recibo, entrega e arquivos vinculados.
  // PDF do recibo: pelo que a leitura encontrou nele (recibo_dados). .REC/.DEC: pelo padrao de nome da Receita
  // (recibo_padroes.re_arquivo: grupos CNPJ, competencia, ORIGI/RETIF, extensao). .DEC: confere a base do recibo gravada no cabecalho.
  async declaracoes(companyId: string, codes: string[]) {
    const cods = codes.map(c => String(c).trim().toUpperCase()).filter(c => /^[A-Z_]{2,30}$/.test(c));
    if (!cods.length) return [];
    const obrig: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id::text AS id, code, competence, status::text AS status, to_char(due_date, 'YYYY-MM-DD') AS "dueDate",
              receipt_number AS recibo, delivered_at AS "entregaEm", notes, depends_on AS "dependsOn", document_id::text AS "documentId"
         FROM fiscal_obligations WHERE company_id = $1::uuid AND code = ANY ($2::text[])
        ORDER BY competence DESC, code`, companyId, cods);
    const docs: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id::text AS id, title, original_file_name AS nome, file_url AS "fileUrl", recibo_dados AS dados
         FROM documents
        WHERE company_id = $1::uuid AND deleted_at IS NULL AND is_template = false AND type::text IN ('FISCAL', 'CONTABIL')
          AND lower(coalesce(original_file_name, '')) ~ '\\.(pdf|rec|dec)$'`, companyId);
    const padroes: any[] = await this.prisma.$queryRawUnsafe(`SELECT code, re_arquivo, tem_copia_receita FROM recibo_padroes WHERE ativo`);
    const emp = await (this.prisma as any).company.findUnique({ where: { id: companyId }, select: { taxId: true } });
    const cnpj = dig(emp?.taxId);
    const hoje = new Date().toISOString().slice(0, 10);
    type Arq = { id: string; title: string; tipo: string | null; confere?: boolean | null };
    const mapa = new Map<string, { pdf: Arq[]; rec: Arq[]; dec: Arq[] }>();
    const slot = (k: string) => { let x = mapa.get(k); if (!x) { x = { pdf: [], rec: [], dec: [] }; mapa.set(k, x); } return x; };
    const recibos = new Map<string, string | null>(obrig.map(o => [o.code + '|' + o.competence, o.recibo] as [string, string | null]));
    for (const d of docs) {
      const nome = String(d.nome ?? '');
      if (/\.pdf$/i.test(nome)) {
        for (const r of (d.dados?.recibos ?? [])) {
          if (!r?.code || !r?.competence || !cods.includes(r.code) || (r.cnpj && r.cnpj !== cnpj)) continue;
          const x = slot(r.code + '|' + r.competence);
          if (!x.pdf.some(a => a.id === d.id)) x.pdf.push({ id: d.id, title: d.title, tipo: r.tipo ?? null });
        }
        continue;
      }
      for (const p of padroes) {
        if (!p.re_arquivo || !cods.includes(p.code)) continue;
        const m = nome.match(new RegExp(p.re_arquivo, 'i'));
        if (!m || dig(m[1]) !== cnpj) continue;
        const k = p.code + '|' + m[2];
        const tipo = /^RETIF/i.test(m[3] ?? '') ? 'Retificadora' : 'Original';
        const ext = String(m[4] ?? '').toUpperCase();
        if (ext === 'REC') slot(k).rec.push({ id: d.id, title: d.title, tipo });
        if (ext === 'DEC') slot(k).dec.push({ id: d.id, title: d.title, tipo, confere: this.decConfere(d.fileUrl, recibos.get(k) ?? null) });
      }
    }
    // Recibo que deu a baixa (fiscal_obligations.document_id), mesmo sem leitura registrada no documento
    for (const o of obrig) {
      if (!o.documentId) continue;
      const x = slot(o.code + '|' + o.competence);
      const d = docs.find(y => y.id === o.documentId);
      if (d && !x.pdf.some(a => a.id === d.id)) x.pdf.push({ id: d.id, title: d.title, tipo: null });
    }
    const copia = new Map<string, boolean>(padroes.map(p => [p.code, !!p.tem_copia_receita] as [string, boolean]));
    // ARQ-DECL-02: .REC so e cobrado nas declaracoes transmitidas pelo Receitanet (padrao de nome cadastrado)
    const comRec = new Set<string>(padroes.filter(p => p.re_arquivo).map(p => p.code));
    return obrig.map(o => {
      const arquivos = mapa.get(o.code + '|' + o.competence) ?? { pdf: [], rec: [], dec: [] };
      const sit = o.status === 'DONE' ? 'ENTREGUE' : o.status === 'DISPENSED' ? 'DISPENSADA' : o.status === 'RECTIFY' ? 'RETIFICAR'
        : (String(o.dueDate) < hoje ? 'ATRASADA' : 'PENDENTE');
      const tipo = [...arquivos.pdf, ...arquivos.rec].map(a => a.tipo).find(Boolean) ?? null;
      return { ...o, sit, tipo, temCopiaReceita: copia.get(o.code) ?? true, temRec: comRec.has(o.code), arquivos };
    });
  }

  /** .DEC: a base do recibo (10 primeiros digitos) fica gravada no cabecalho depois da transmissao. */
  private decConfere(fileUrl: string | null, recibo: string | null): boolean | null {
    const base = dig(recibo).slice(0, 10);
    if (base.length < 10 || !fileUrl) return null;
    try {
      const arq = path.join(process.cwd(), String(fileUrl).replace(/^\/+/, ''));
      const fd = fs.openSync(arq, 'r'); const b = Buffer.alloc(400); const n = fs.readSync(fd, b, 0, 400, 0); fs.closeSync(fd);
      return b.subarray(0, n).toString('latin1').split(/\r?\n/)[0].includes(base);
    } catch { return null; }
  }

  private async condicao(companyId: string, r: any): Promise<{ ok: boolean; motivo: string }> {
    const desc = r.descricao ? String(r.descricao) : '';
    switch (r.tipo) {
      case 'obrigacoes': {
        const itens: { code: string; competence: string }[] = Array.isArray(r.itens) ? r.itens : [];
        const status: string[] = Array.isArray(r.status) && r.status.length ? r.status : ['DONE'];
        if (!itens.length) return { ok: false, motivo: '' };
        const recibos: string[] = [];
        for (const it of itens) {
          const x: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT receipt_number AS recibo FROM fiscal_obligations
              WHERE company_id = $1::uuid AND code = $2 AND competence = $3 AND status::text = ANY ($4::text[])`,
            companyId, it.code, it.competence, status);
          if (!x.length) return { ok: false, motivo: '' };
          recibos.push(it.code + ' ' + it.competence + (x[0].recibo ? ' (recibo ' + x[0].recibo + ')' : ''));
        }
        return { ok: true, motivo: desc || 'obrigações cumpridas: ' + recibos.join(', ') };
      }
      case 'documento': {
        const x: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT title FROM documents
            WHERE company_id = $1::uuid AND deleted_at IS NULL
              AND ($2::text IS NULL OR subtipo = $2::text) AND ($3::text IS NULL OR type::text = $3::text)
              AND (coalesce(original_file_name, '') ~* $4::text OR title ~* $4::text)
            LIMIT 1`, companyId, r.subtipo ?? null, r.type ?? null, String(r.nome_regex ?? '.^'));
        return x.length ? { ok: true, motivo: desc || 'documento arquivado: ' + x[0].title } : { ok: false, motivo: '' };
      }
      case 'lancamentos': {
        const refs: string[] = Array.isArray(r.referencias) ? r.referencias : [];
        if (!refs.length) return { ok: false, motivo: '' };
        for (const ref of refs) {
          const x: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT 1 FROM journal_entries
              WHERE company_id = $1::uuid AND deleted_at IS NULL AND ($2::date IS NULL OR date = $2::date)
                AND (coalesce(description, '') || ' ' || coalesce(reference, '')) ~* ($3::text || '([^0-9]|$)')
              LIMIT 1`, companyId, r.data ?? null, ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
          if (!x.length) return { ok: false, motivo: '' };
        }
        return { ok: true, motivo: desc || 'lançamentos registrados: ' + refs.join(', ') };
      }
      case 'esocial_evento': {
        const x: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT nr_recibo AS recibo FROM esocial_s13_eventos
            WHERE company_id = $1::uuid AND regexp_replace(tipo, '\\D', '', 'g') = $2::text
              AND replace(coalesce(per_apur, ''), '-', '') = replace($3::text, '-', '')
              AND nr_recibo IS NOT NULL AND tp_amb = coalesce($4::smallint, tp_amb)
              AND ($5::text IS NULL OR xml ILIKE '%' || $5::text || '%')
            LIMIT 1`, companyId, dig(r.evento), String(r.per_apur ?? ''), r.tp_amb ?? null, r.xml_contem ?? null);
        return x.length ? { ok: true, motivo: desc || 'evento S-' + dig(r.evento) + ' aceito (recibo ' + x[0].recibo + ')' } : { ok: false, motivo: '' };
      }
      default:
        return { ok: false, motivo: '' };
    }
  }
}