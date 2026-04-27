import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async register(data: any) {
    return this.prisma.auditLog.create({
      data: {
        actorId: data.actor_id ?? data.actorId ?? null,
        action: data.action,
        targetId: data.target_id ?? data.targetId ?? null,
        before: data.before ?? null,
        after: data.after ?? null,
        ip: data.ip ?? null,
      },
    });
  }
}