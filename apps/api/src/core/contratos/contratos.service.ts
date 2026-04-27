// apps/api/src/core/contratos/contratos.service.ts
import {
  Injectable, Logger, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { PrismaService }   from '../../prisma/prisma.service';
import { DocumentType, DocumentStatus, DocumentVisibility } from '@prisma/client';
import * as crypto from 'crypto';
import {
  CreateContratoDto, UpdateContratoDto, ContratoFilters,
} from './contratos.dto';

@Injectable()
export class ContratosService {
  private readonly logger = new Logger(ContratosService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ───────────────────────────────────────────────

  private sha256(text: string): string {
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
  }

  private validateUuid(value: string, field: string) {
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!re.test(value))
      throw new BadRequestException(`${field} inválido: "${value}". Esperado UUID v4.`);
  }

  private async getOrFail(id: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
    });
    if (!doc) throw new NotFoundException(`Documento ${id} não encontrado.`);
    return doc;
  }

  // ── findAll ───────────────────────────────────────────────
  // GET /contratos?companyId=&type=CONTRATO_SOCIAL&status=&search=
  async findAll(filters: ContratoFilters) {
    const where: any = { deletedAt: null };

    if (filters.companyId) {
      this.validateUuid(filters.companyId, 'companyId');
      where.companyId = filters.companyId;
    }

    // type único ou todos os tipos do módulo
    if (filters.type) {
      where.type = filters.type as DocumentType;
    } else {
      // sem filtro de type → retorna ambos CONTRATO_SOCIAL e ADITIVO_CONTRATUAL
      where.type = { in: [DocumentType.CONTRATO_SOCIAL, DocumentType.ADITIVO_CONTRATUAL] };
    }

    if (filters.status) {
      where.status = filters.status as DocumentStatus;
    }

    if (filters.search) {
      where.title = { contains: filters.search, mode: 'insensitive' };
    }

    const docs = await this.prisma.document.findMany({
      where,
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, type: true, title: true, status: true,
        date: true, bookNumber: true, description: true,
        notes: true, createdAt: true, updatedAt: true,
      },
    });

    return { data: docs, total: docs.length };
  }

  // ── findOne ───────────────────────────────────────────────
  async findOne(id: string) {
    const doc = await this.getOrFail(id);

    // busca versões ordenadas
    const versions = await this.prisma.documentVersion.findMany({
      where:   { documentId: id },
      orderBy: { version: 'desc' },
      select:  { id: true, version: true, createdAt: true, changeNote: true,
                 createdById: true },
    });

    return { ...doc, versions };
  }

  // ── create ────────────────────────────────────────────────
  async create(dto: CreateContratoDto, userId: string) {
    this.validateUuid(dto.companyId, 'companyId');

    // Verifica empresa
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });
    if (!company) throw new NotFoundException(`Empresa ${dto.companyId} não encontrada.`);

    // Para CONTRATO_SOCIAL: só pode haver um por empresa
    if (dto.type === 'CONTRATO_SOCIAL') {
      const exists = await this.prisma.document.findFirst({
        where: {
          companyId: dto.companyId,
          type:      DocumentType.CONTRATO_SOCIAL,
          deletedAt: null,
        },
      });
      if (exists)
        throw new ConflictException(
          `A empresa já possui um Contrato Social (id: ${exists.id}). ` +
          `Para alterar, crie um ADITIVO_CONTRATUAL ou edite o existente.`,
        );
    }

    const content     = dto.content ?? '';
    const contentHash = this.sha256(content);

    const doc = await this.prisma.document.create({
      data: {
        companyId:   dto.companyId,
        type:        dto.type as DocumentType,
        title:       dto.title,
        content,
        contentHash,
        status:      (dto.status ?? 'RASCUNHO') as DocumentStatus,
        visibility:  DocumentVisibility.RESERVADO,
        date:        dto.date ? new Date(dto.date) : null,
        bookNumber:  dto.bookNumber ? Number(dto.bookNumber) : null,
        description: dto.styleId ?? null,
        notes:       dto.notes ?? null,
        isTemplate:  false,
        createdById: userId,
      },
    });

    // Versão inicial
    await this.prisma.documentVersion.create({
      data: {
        documentId:  doc.id,
        version:     1,
        content,
        contentHash,
        changeNote:  dto.changeNote ?? 'Versão inicial',
        createdById: userId,
      },
    });

    this.logger.log(
      `Contrato criado: ${doc.id} | tipo: ${doc.type} | empresa: ${doc.companyId}`,
    );
    return doc;
  }

  // ── update ────────────────────────────────────────────────
  async update(id: string, dto: UpdateContratoDto, userId: string) {
    const current = await this.getOrFail(id);

    const newContent = dto.content ?? current.content;
    const newHash    = this.sha256(newContent);

    // Nova versão só se o conteúdo mudou
    let nextVersion = 1;
    if (newHash !== current.contentHash) {
      const last = await this.prisma.documentVersion.findFirst({
        where:   { documentId: id },
        orderBy: { version: 'desc' },
        select:  { version: true },
      });
      nextVersion = (last?.version ?? 0) + 1;

      await this.prisma.documentVersion.create({
        data: {
          documentId:  id,
          version:     nextVersion,
          content:     newContent,
          contentHash: newHash,
          changeNote:  dto.changeNote ?? `Versão ${nextVersion}`,
          createdById: userId,
        },
      });
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        title:        dto.title       ?? current.title,
        content:      newContent,
        contentHash:  newHash,
        status:       (dto.status     ?? current.status) as DocumentStatus,
        date:         dto.date        ? new Date(dto.date) : current.date,
        bookNumber:   dto.bookNumber  !== undefined ? Number(dto.bookNumber) : current.bookNumber,
        description:  dto.styleId    ?? current.description,
        notes:        dto.notes       ?? current.notes,
      },
    });

    this.logger.log(`Contrato atualizado: ${id} | versão: ${nextVersion}`);
    return updated;
  }

  // ── remove (soft-delete) ──────────────────────────────────
  async remove(id: string) {
    await this.getOrFail(id);
    await this.prisma.document.update({
      where: { id },
      data:  { deletedAt: new Date() },
    });
    return { message: `Documento ${id} removido.` };
  }

  // ── getVersions ───────────────────────────────────────────
  async getVersions(id: string) {
    await this.getOrFail(id);
    return this.prisma.documentVersion.findMany({
      where:   { documentId: id },
      orderBy: { version: 'desc' },
    });
  }

  // ── Qualificação dos sócios vinculados ────────────────────
  // Utilitário: retorna a qualificação completa de uma Person
  // para uso no frontend ao montar a lista de sócios do contrato.
  async qualificacaoSocio(personId: string) {
    const p = await this.prisma.person.findFirst({
      where: { id: personId, deletedAt: null },
    });
    if (!p) throw new NotFoundException(`Pessoa ${personId} não encontrada.`);

    const parts: string[] = [];
    if (p.nationality)   parts.push(p.nationality);
    if (p.maritalStatus) parts.push(p.maritalStatus.toLowerCase());
    if ((p as any).oabNumber)  parts.push(`advogado, inscrito na OAB/${(p as any).oabState} sob nº ${(p as any).oabNumber}`);
    if ((p as any).crcNumber)  parts.push(`contador, inscrito no CRC/${(p as any).crcState} sob nº ${(p as any).crcNumber}`);
    if ((p as any).creaNumber) parts.push(`engenheiro, inscrito no CREA/${(p as any).creaState} sob nº ${(p as any).creaNumber}`);
    if (p.street && p.city)
      parts.push(`residente e domiciliado em ${p.street}, ${(p as any).number ?? 's/n'}${(p as any).complement ? ` ${(p as any).complement}` : ''}, ${p.neighborhood ?? ''}, ${p.city}/${p.state}`);
    parts.push(`CPF: ${p.cpf}`);
    if (p.rgNumber) parts.push(`RG: ${p.rgNumber}${p.rgIssuer ? `/${p.rgIssuer}` : ''}`);

    return {
      personId: p.id,
      nome:     p.fullName,
      cpf:      p.cpf,
      qualificacao: parts.filter(Boolean).join(', '),
    };
  }
}