// ============================================================
// LEDGR — src/modules/finance/agenda.service.ts
// ============================================================
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateAgendaEventDto } from './dto/create.agenda.dto';
import { UpdateAgendaEventDto } from './dto/update.agenda.dto';
import { Prisma } from '@prisma/client';


@Injectable()
export class AgendaService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Lista eventos de um mês ──────────────────────────────────
  async findByMonth(companyId: string, month: string) {
    // month = "2026-03" → filtrar dueDate
    const [year, m] = month.split('-').map(Number);
    const start = new Date(year, m - 1, 1);
    const end   = new Date(year, m, 0, 23, 59, 59);

    const events = await this.prisma.agendaEvent.findMany({
      where: {
        companyId,
        deletedAt: null,
        dueDate: { gte: start, lte: end },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Agrupa por dia para facilitar o calendário no frontend
    const byDay: Record<number, typeof events> = {};
    events.forEach((ev) => {
      const day = ev.dueDate.getDate();
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(ev);
    });

    return { events, byDay };
  }

  // ── Próximos vencimentos (painel lateral) ───────────────────
  async getUpcoming(companyId: string, days = 30) {
    const from = new Date();
    const to   = new Date();
    to.setDate(to.getDate() + days);

    return this.prisma.agendaEvent.findMany({
      where: {
        companyId,
        deletedAt:  null,
        isPaid:     false,
        dueDate:    { gte: from, lte: to },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });
  }

  // ── Create ──────────────────────────────────────────────────
  async create(companyId: string, dto: CreateAgendaEventDto, userId: string) {
    const event = await this.prisma.agendaEvent.create({
      data: {
        companyId,
        eventType:        dto.eventType,
        title:            dto.title,
        description:      dto.description,
        color:            dto.color,
        dueDate:          new Date(dto.dueDate),
        amount:           dto.amount ? new Prisma.Decimal(dto.amount) : null,
        isRecurring:      dto.isRecurring ?? false,
        recurrenceRule:   dto.recurrenceRule,
        fiscalDocumentId: dto.fiscalDocumentId,
        apEntryId:        dto.apEntryId,
        createdById:      userId,
      },
    });

    // Gera série se recorrente
    if (event.isRecurring && event.recurrenceRule) {
      await this.generateRecurringSeries(event, companyId, userId);
    }

    return event;
  }

  // ── Update ──────────────────────────────────────────────────
  async update(id: string, companyId: string, dto: UpdateAgendaEventDto) {
    const ev = await this.findOne(id, companyId);

    return this.prisma.agendaEvent.update({
      where: { id },
      data: {
        ...dto,
        amount:  dto.amount ? new Prisma.Decimal(dto.amount) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        paidAt:  dto.isPaid ? (dto.paidAt ? new Date(dto.paidAt) : new Date()) : undefined,
      },
    });
  }

  // ── Soft Delete (somente eventos manuais) ───────────────────
  async remove(id: string, companyId: string) {
    const ev = await this.findOne(id, companyId);

    if (ev.fiscalDocumentId) {
      throw new BadRequestException(
        'Eventos gerados por documentos fiscais não podem ser excluídos. ' +
        'Marque-o como pago ou exclua o documento de origem.',
      );
    }

    return this.prisma.agendaEvent.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ── FindOne ─────────────────────────────────────────────────
  async findOne(id: string, companyId: string) {
    const ev = await this.prisma.agendaEvent.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!ev) throw new NotFoundException('Evento de agenda não encontrado.');
    return ev;
  }

  // ── Gera série recorrente (próximos 12 meses) ───────────────
  private async generateRecurringSeries(
    parent: Awaited<ReturnType<AgendaService['findOne']>>,
    companyId: string,
    userId: string,
  ) {
    const MONTHS = 11; // gera mais 11 ocorrências
    const dates: Date[] = [];

    for (let i = 1; i <= MONTHS; i++) {
      const d = new Date(parent.dueDate);
      if (parent.recurrenceRule === 'MONTHLY')  d.setMonth(d.getMonth() + i);
      else if (parent.recurrenceRule === 'WEEKLY') d.setDate(d.getDate() + 7 * i);
      else if (parent.recurrenceRule === 'YEARLY') d.setFullYear(d.getFullYear() + i);
      else break;
      dates.push(d);
    }

    await this.prisma.agendaEvent.createMany({
      data: dates.map((dueDate) => ({
        companyId,
        eventType:     parent.eventType,
        title:         parent.title,
        description:   parent.description,
        color:         parent.color,
        dueDate,
        amount:        parent.amount,
        isRecurring:   true,
        recurrenceRule: parent.recurrenceRule,
        parentEventId: parent.id,
        createdById:   userId,
      })),
    });
  }
}