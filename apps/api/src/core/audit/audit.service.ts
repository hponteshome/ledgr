import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

// backend/src/core/audit/audit.service.ts

async findAll(params: any = {}) { // Adicione o = {}
  const query: any = {
    where: params?.where || {}, // Garante que não quebre se o where não existir
    include: {
      actor: {
        select: { fullName: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' }
  };

  return (this.prisma.auditLog as any).findMany(query);
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