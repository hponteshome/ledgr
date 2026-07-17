import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from '../../auth/dto/register.dto';
import { AuditService } from '../audit/audit.service'; // Integrated local service

@Injectable()
export class UsersService {
  private readonly logger = new Logger('UsersService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService, // Replaced ClientProxy for Monolith
  ) {}

  // apps/api/src/core/users/users.service.ts

async findByDocument(document: string) {
  // Apenas números, sem formatação
  const cleanDoc = document.replace(/\D/g, '');
  
  const user = await this.prisma.user.findFirst({
    where: {
      document: cleanDoc,  // Busca apenas pelo formato sem pontuação
      deletedAt: null
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone1: true,
      document: true,
      nickname: true,
      profileId: true,
      level: true,
      profile: {
        select: {
          name: true,
          permissions: true
        }
      }
    }
  });

  return user;
}




  

  // ── Gestao de usuarios pendentes ───────────────────────────────────────────
  async listarPendentes() {
    return this.prisma.user.findMany({
      where:   { status: 'PENDENTE', deletedAt: null },
      include: { person: true, profile: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async contarPendentes(): Promise<number> {
    return this.prisma.user.count({ where: { status: 'PENDENTE', deletedAt: null } });
  }

  async aprovarUsuario(id: string, dto: {
    profileId: string; level: number; companyIds: string[];
  }, adminId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    await this.prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id },
        data:  {
          status:       'active',
          isActive:     true,
          profileId:    dto.profileId,
          level:        dto.level,
          reviewedAt:   new Date(),
          reviewedById: adminId,
        },
      });
      // Vincula empresas
      if (dto.companyIds?.length) {
        await tx.userCompany.createMany({
          data: dto.companyIds.map((cid: string) => ({
            userId:    id,
            companyId: cid,
            role:      'LEDGR_USER',
          })),
          skipDuplicates: true,
        });
      }
    });
    return { id, status: 'active', message: 'Usuário aprovado com sucesso.' };
  }

  async rejeitarUsuario(id: string, motivo: string, adminId: string) {
    await this.prisma.user.update({
      where: { id },
      data:  {
        status:          'REJEITADO',
        isActive:        false,
        reviewedAt:      new Date(),
        reviewedById:    adminId,
        rejectionReason: motivo,
      },
    });
    return { id, status: 'REJEITADO' };
  }

  async updateUser(id: string, data: any, adminId: string) {
    const oldUser = await this.prisma.user.findUnique({ 
      where: { id },
      include: { profile: true } 
    });
    
    if (!oldUser) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: data.fullName,
        nickname: data.nickname,
        email: data.email,
        phone1: data.phoneNumber,
        level: data.level !== undefined ? Number(data.level) : undefined,
        isActive: data.isActive,
        profileId: data.profileId,
        status: data.status,
      },
      include: { profile: true }
    });

    // Local Audit Registration
    await this.auditService.register({
      actorId: adminId,
      action: 'USER_UPDATED',
      targetId: id,
      before: oldUser,
      after: updatedUser,
    });

    this.logger.log(`Audit Event: User update ${id}`);
    return updatedUser;
  }


  async findByEmail(email: string) {
  return this.prisma.user.findUnique({
    where: { email },
    include: { profile: true } // se precisar das permissões
  });
}



async findByLogin(login: string) {
  if (!login) return null;

  // Limpa apenas se parecer um documento (números)
  const cleanLogin = login.trim();
  const onlyNumbers = cleanLogin.replace(/\D/g, '');

  return this.prisma.user.findFirst({
    where: {
      OR: [
        // Se tiver @, busca por email
        cleanLogin.includes('@') ? { email: cleanLogin } : null,
        // Se tiver números suficientes, busca por documento
        onlyNumbers.length >= 11 ? { document: onlyNumbers } : null,
      ].filter(Boolean), // Remove entradas nulas do array OR
    },
    include: {
      profile: true // 👈 Garante que o perfil e permissões venham junto
    }
  });
}


  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { profile: true }
    });
  }

  async create(data: RegisterDto) {
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(data.password, salt);

    try {
      const newUser = await this.prisma.user.create({
        data: {
          document: data.document.replace(/\D/g, ''),
          documentType: data.documentType,
          email: data.email,
          passwordHash: passwordHash,
          fullName: data.fullName,
          phone1: data.phoneNumber,
          status: 'active',
          level: Number(data.level),
          isActive: true,
          isEmailConfirmed: false,
          isDocumentConfirmed: false,
          isTwoFactorActive: false,
          failedAttempts: 0,
        },
        include: { profile: true }
      });

      await this.auditService.register({
        actorId: newUser.id,
        action: 'USER_CREATED',
        targetId: newUser.id,
      });

      this.logger.log(`✅ User created: ${newUser.email}`);
      return newUser;
    } catch (error) {
      this.logger.error(`❌ Error creating user: ${error.message}`);
      throw error;
    }
  }

  async findAll() {
    return this.prisma.user.findMany({
      where: { deletedAt: null, status: { not: 'deleted' } },
      include: { profile: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string, adminId: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    await this.auditService.register({
      actorId: adminId,
      action: 'USER_DELETED',
      targetId: id,
      before: user,
    });

    return this.prisma.user.update({
      where: { id },
      data: { status: 'deleted', deletedAt: new Date(), isActive: false }
    });
  }

  async updateLastAccess(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { 
        lastAccess: new Date(),
        failedAttempts: 0
      }
    });
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(newPassword, salt);
    
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: hash,
        failedAttempts: 0,
        blockedUntil: null
      }
    });
  }


  getAccessSchedule(userId: string) {
    return this.prisma.accessSchedule.findUnique({ where: { userId } });
  }

  setAccessSchedule(userId: string, dto: any, adminId: string) {
    const data = {
      mode: dto.mode ?? 'SCHEDULED',
      weekdays: dto.weekdays ?? [1,2,3,4,5],
      startTime: dto.startTime ?? '08:00',
      endTime: dto.endTime ?? '18:00',
      vacationMonths: dto.vacationMonths ?? [],
      exemptSetById: dto.mode === 'EXEMPT' ? adminId : null,
      exemptSetAt: dto.mode === 'EXEMPT' ? new Date() : null,
    };
    return this.prisma.accessSchedule.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  removeAccessSchedule(userId: string) {
    return this.prisma.accessSchedule.delete({ where: { userId } }).catch(() => null);
  }

  listUnlockRequests(status?: string) {
    return this.prisma.accessUnlockRequest.findMany({
      where: status ? { status } : {},
      include: { user: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveUnlockRequest(requestId: string, approve: boolean, adminId: string) {
    const request = await this.prisma.accessUnlockRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error('Solicitacao nao encontrada.');

    const updated = await this.prisma.accessUnlockRequest.update({
      where: { id: requestId },
      data: { status: approve ? 'APPROVED' : 'DENIED', respondedById: adminId, respondedAt: new Date() },
    });

    if (approve) {
      await this.prisma.accessSchedule.upsert({
        where: { userId: request.userId },
        create: { userId: request.userId, mode: 'EXEMPT', exemptSetById: adminId, exemptSetAt: new Date() },
        update: { mode: 'EXEMPT', exemptSetById: adminId, exemptSetAt: new Date() },
      });
    }

    return updated;
  }

}