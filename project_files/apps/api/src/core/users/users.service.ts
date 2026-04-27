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
        email: data.email,
        phone: data.phoneNumber,
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
          phone: data.phoneNumber,
          status: 'active',
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
      include: { profile: true }
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
}