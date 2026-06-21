import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditFilter {
  actorId?: string;
  action?: string;
  targetId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: AuditFilter = {}) {
    const { actorId, action, targetId, dateFrom, dateTo, page = 1, limit = 50 } = filters;
    const where: any = {};
    if (actorId)  where.actorId  = actorId;
    if (action)   where.action   = { contains: action, mode: 'insensitive' };
    if (targetId) where.targetId = { contains: targetId };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo)   where.createdAt.lte = new Date(dateTo + 'T23:59:59Z');
    }
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { fullName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async register(data: any) {
    return this.prisma.auditLog.create({
      data: {
        actorId:  data.actor_id  ?? data.actorId  ?? null,
        action:   data.action,
        targetId: data.target_id ?? data.targetId ?? null,
        before:   data.before ?? null,
        after:    data.after  ?? null,
        ip:       data.ip     ?? null,
      },
    });
  }
}
