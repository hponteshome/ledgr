// apps/api/src/core/documents/document-templates.service.ts
// Templates de documentos (30/09/2026): lista, duplicar, editar (versionado), ativar/desativar,
// padrao por tipo e abrangencia, exclusao logica e Word nos dois sentidos.
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentsService } from './documents.service';
import * as Handlebars from 'handlebars';

// Marcadores de bloco: {{#if ...}}, {{/if}}, {{#each ...}}, {{^...}}, {{else}}
const TOKEN = '\\{\\{(?:[#/^][^}]*|else)\\}\\}';

@Injectable()
export class DocumentTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
  ) {}

  private scope(companyId: string): any[] {
    return companyId ? [{ companyId: null }, { companyId }] : [{ companyId: null }];
  }

  // Seguranca 0A (04/10/2026): modelos GLOBAIS (companyId nulo) sao compartilhados por todas as empresas;
  // so o Master os altera. Modelos da empresa: quem tem vinculo (o getOrFail ja restringe a global + empresa ativa).
  private exigirPodeEditar(t: { companyId: string | null }, master: boolean) {
    if (!t.companyId && !master) throw new ForbiddenException('Modelos globais so podem ser alterados pelo Master.');
  }

  private async getOrFail(id: string, companyId: string) {
    const t = await this.prisma.documentTemplate.findFirst({
      where: { id, deletedAt: null, OR: this.scope(companyId) },
    });
    if (!t) throw new NotFoundException('Template nao encontrado.');
    return t;
  }

  private validateSyntax(content: string) {
    try {
      Handlebars.precompile(content);
    } catch (e: any) {
      throw new BadRequestException(`Erro na sintaxe dos marcadores: ${e?.message ?? e}`);
    }
  }

  async list(companyId: string, type?: string) {
    const rows = await this.prisma.documentTemplate.findMany({
      where: { deletedAt: null, OR: this.scope(companyId), ...(type ? { type: type as any } : {}) },
      select: {
        id: true, type: true, name: true, description: true, companyId: true,
        isActive: true, isDefault: true, version: true, createdAt: true, updatedAt: true,
      },
      orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    });
    const usos = rows.length
      ? await this.prisma.document.groupBy({
          by: ['templateId'],
          where: { templateId: { in: rows.map((r) => r.id) } },
          _count: { _all: true },
        })
      : [];
    const mapa = new Map(usos.map((u: any) => [u.templateId, u._count._all]));
    return rows.map((r) => ({ ...r, escopo: r.companyId ? 'EMPRESA' : 'GLOBAL', documentosGerados: mapa.get(r.id) ?? 0 }));
  }

  async get(id: string, companyId: string) {
    const t = await this.getOrFail(id, companyId);
    const versions = await this.prisma.documentTemplateVersion.findMany({
      where: { templateId: id },
      select: { version: true, changeNote: true, createdAt: true },
      orderBy: { version: 'desc' },
    });
    return { ...t, escopo: t.companyId ? 'EMPRESA' : 'GLOBAL', versions };
  }

  async duplicate(id: string, companyId: string, userId: string, body: { name?: string; description?: string; escopo?: string }, master = false) {
    const src = await this.getOrFail(id, companyId);
    const name = (body?.name ?? '').trim();
    if (!name) throw new BadRequestException('Informe o nome do novo template.');
    const daEmpresa = body?.escopo === 'EMPRESA';
    if (daEmpresa && !companyId) throw new BadRequestException('Selecione uma empresa para criar um template da empresa.');
    if (!daEmpresa && !master) throw new ForbiddenException('Somente o Master cria modelos globais (compartilhados por todas as empresas).');
    const novo = await this.prisma.documentTemplate.create({
      data: {
        type: src.type,
        name,
        description: body?.description ?? src.description,
        content: src.content,
        variables: (src.variables ?? undefined) as any,
        companyId: daEmpresa ? companyId : null,
        isActive: true,
        isDefault: false,
        version: 1,
        createdById: userId,
      },
    });
    await this.prisma.documentTemplateVersion.create({
      data: { templateId: novo.id, version: 1, content: novo.content, changeNote: `Duplicado de "${src.name}" v${src.version}`, createdById: userId },
    });
    return novo;
  }

  async update(id: string, companyId: string, userId: string, body: { name?: string; description?: string; content?: string; changeNote?: string }, master = false) {
    const t = await this.getOrFail(id, companyId);
    this.exigirPodeEditar(t, master);
    const data: any = { updatedById: userId };
    if (body?.name !== undefined) {
      if (!body.name.trim()) throw new BadRequestException('O nome do template nao pode ficar vazio.');
      data.name = body.name.trim();
    }
    if (body?.description !== undefined) data.description = body.description;
    let novaVersao: number | null = null;
    if (body?.content !== undefined && body.content !== t.content) {
      if (!body.content.trim()) throw new BadRequestException('O conteudo do template nao pode ficar vazio.');
      this.validateSyntax(body.content);
      novaVersao = t.version + 1;
      data.content = body.content;
      data.version = novaVersao;
    }
    const upd = await this.prisma.documentTemplate.update({ where: { id }, data });
    if (novaVersao) {
      await this.prisma.documentTemplateVersion.create({
        data: { templateId: id, version: novaVersao, content: body.content as string, changeNote: body.changeNote?.trim() || null, createdById: userId },
      });
    }
    return upd;
  }

  async setActive(id: string, companyId: string, active: boolean, master = false) {
    const t = await this.getOrFail(id, companyId);
    this.exigirPodeEditar(t, master);
    if (!active && t.isDefault) {
      throw new BadRequestException('Este e o template padrao. Defina outro como padrao antes de desativa-lo.');
    }
    return this.prisma.documentTemplate.update({ where: { id }, data: { isActive: !!active } });
  }

  async setDefault(id: string, companyId: string, master = false) {
    const t = await this.getOrFail(id, companyId);
    this.exigirPodeEditar(t, master);
    if (!t.isActive) throw new BadRequestException('Ative o template antes de defini-lo como padrao.');
    await this.prisma.$transaction([
      this.prisma.documentTemplate.updateMany({
        where: { type: t.type, companyId: t.companyId, isDefault: true, deletedAt: null },
        data: { isDefault: false },
      }),
      this.prisma.documentTemplate.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return { ok: true };
  }

  async remove(id: string, companyId: string, master = false) {
    const t = await this.getOrFail(id, companyId);
    this.exigirPodeEditar(t, master);
    if (t.isDefault) throw new BadRequestException('Nao e possivel excluir o template padrao.');
    const usos = await this.prisma.document.count({ where: { templateId: id } });
    if (usos > 0) {
      throw new BadRequestException(`Este template gerou ${usos} documento(s) e nao pode ser excluido. Desative-o.`);
    }
    return this.prisma.documentTemplate.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  // Word: marcadores de bloco em paragrafos proprios (ou linhas proprias dentro de tabelas),
  // para o Word preservar a posicao deles.
  private toWordSource(content: string): string {
    let h = content;
    let prev = '';
    while (prev !== h) {
      prev = h;
      h = h
        .replace(new RegExp(`(<table[^>]*>|</tr>)(\\s*)(${TOKEN})`, 'gi'), '$1$2<tr><td colspan="2"><p>$3</p></td></tr>')
        .replace(new RegExp(`(</p>|</h\\d>|</table>)(${TOKEN})`, 'gi'), '$1<p>$2</p>')
        .replace(new RegExp(`^(\\s*)(${TOKEN})(?=\\s*(?:<(?:p|h\\d|table)\\b|$))`, 'gim'), '$1<p>$2</p>');
    }
    return h;
  }

  async exportDocx(id: string, companyId: string): Promise<{ buffer: Buffer; fileName: string }> {
    const t = await this.getOrFail(id, companyId);
    const fileName = `Template_${t.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\-]+/g, '_')}_v${t.version}.docx`;
    const virtual = {
      type: t.type, companyId: t.companyId ?? companyId, status: 'RASCUNHO', visibility: 'PUBLICO',
      title: t.name, content: this.toWordSource(t.content), signatures: [],
    };
    return { buffer: await this.documents.renderDocx(virtual, fileName), fileName };
  }

  // Word -> texto do template (NAO grava: volta para o editor, para pre-visualizar e salvar)
  async importDocx(id: string, companyId: string, file: Express.Multer.File, master = false) {
    const t = await this.getOrFail(id, companyId);
    this.exigirPodeEditar(t, master);
    if (!/\.docx$/i.test(file?.originalname ?? '')) throw new BadRequestException('Envie um arquivo Word (.docx).');
    const mammoth = require('mammoth');
    const r = await mammoth.convertToHtml({ buffer: file.buffer });
    const corpo = String(r?.value ?? '')
      .trim()
      .replace(new RegExp(`<tr>\\s*<td[^>]*>\\s*<p>(${TOKEN})</p>\\s*</td>\\s*</tr>`, 'gi'), '$1')
      .replace(new RegExp(`<p>(${TOKEN})</p>`, 'gi'), '$1');
    if (!corpo) throw new BadRequestException('O arquivo nao tem conteudo legivel.');
    const estilo = t.content.match(/<style[\s\S]*?<\/style>/i)?.[0] ?? '';
    const content = (estilo ? estilo + '\n\n' : '') + corpo;
    this.validateSyntax(content);
    return { content };
  }
}
