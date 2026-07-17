// src/auth/auth.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../core/users/users.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async debugUser(email: string) {
    return this.usersService.findByEmail(email);
  }

  async register(dto: {
    document: string; documentType?: string; fullName: string; email: string;
    phone?: string; level?: number; password: string;
  }) {
    const cleanCpf = dto.document.replace(/\D/g,'');
    const exists = await this.prisma.user.findFirst({
      where: { OR: [{ document: cleanCpf },{ email: dto.email.toLowerCase() }], deletedAt: null }
    });
    if (exists) throw new Error('CPF ou e-mail ja cadastrado.');

    const person = await this.prisma.person.findFirst({
      where: { cpf: cleanCpf, deletedAt: null }
    });
    let pendingFlags = 'OK';
    let personId: string | undefined;
    if (!person) {
      pendingFlags = 'CPF_NAO_ENCONTRADO';
    } else {
      personId = person.id;
      const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
      if (norm(dto.fullName).split(' ')[0] !== norm(person.fullName ?? '').split(' ')[0])
        pendingFlags = 'DIVERGENCIA_NOME';
    }
    const hash = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.create({
      data: {
        document: cleanCpf, documentType: dto.documentType || 'CPF',
        email: dto.email.toLowerCase(), passwordHash: hash,
        fullName: dto.fullName, phone1: dto.phone,
        status: 'PENDENTE', isActive: false, level: dto.level ?? 0,
        requestedAt: new Date(), pendingFlags,
        ...(personId ? { personId } : {}),
      },
    });
    return { status:'PENDENTE', pendingFlags, message:'Cadastro recebido. Aguarde aprovacao.' };
  }

  
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email.toLowerCase());
    if (!user) {
      return null;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (isMatch) {
      const { passwordHash, ...result } = user;
      return result;
    }
    
    return null;
  }

  private isWithinAccessWindow(schedule: any): { ok: boolean; reason?: string } {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, month: 'numeric',
    });
    const parts = fmt.formatToParts(now);
    const get = (type: string) => parts.find(p => p.type === type)?.value;
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const weekday = weekdayMap[get('weekday') as string];
    const month = parseInt(get('month') as string, 10);
    const hour = parseInt(get('hour') as string, 10);
    const minute = parseInt(get('minute') as string, 10);
    const nowMinutes = hour * 60 + minute;

    if (schedule.vacationMonths?.includes(month)) {
      return { ok: false, reason: 'Acesso bloqueado neste mes (periodo de ferias configurado).' };
    }
    if (!schedule.weekdays?.includes(weekday)) {
      return { ok: false, reason: 'Acesso nao permitido neste dia da semana.' };
    }
    const [sh, sm] = (schedule.startTime as string).split(':').map(Number);
    const [eh, em] = (schedule.endTime as string).split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;
    if (nowMinutes < startMinutes || nowMinutes > endMinutes) {
      return { ok: false, reason: `Acesso permitido apenas entre ${schedule.startTime} e ${schedule.endTime}.` };
    }
    return { ok: true };
  }

  async login(user: any) {
    // Buscar usuário com perfil E empresas (através de companies)
    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        profile: true,
        companies: {  // ← CORRETO: 'companies' (plural)
          include: {
            company: true
          }
        }
      }
    });

    const isMaster = (fullUser?.profile?.permissions as any)?.all === true;
    if (!isMaster) {
      // Prioridade: override do usuario > regra do perfil > bloqueado
      const userOverride = await this.prisma.accessSchedule.findUnique({ where: { userId: fullUser!.id } });
      const schedule = userOverride ?? (fullUser?.profile
        ? await this.prisma.profileAccessSchedule.findUnique({ where: { profileId: fullUser.profile.id } })
        : null);

      if (!schedule) {
        throw new ForbiddenException('Seu acesso ainda nao foi liberado pelo administrador. Solicite desbloqueio.');
      }
      if (schedule.mode === 'SCHEDULED') {
        const check = this.isWithinAccessWindow(schedule);
        if (!check.ok) {
          throw new ForbiddenException(check.reason ?? 'Fora da janela de acesso permitida.');
        }
      }
    }

    // Pega a primeira empresa associada ao usuário
    const firstUserCompany = fullUser?.companies?.[0];
    const firstCompany = firstUserCompany?.company;

    // Construir payload do token
    const payload = { 
      email: user.email, 
      sub: user.id,
      profileId: fullUser?.profile?.id,
      profileName: fullUser?.profile?.name,
      permissions: fullUser?.profile?.permissions || { all: false },
      // Dados da empresa
      companyId: firstCompany?.id,
      companyName: firstCompany?.legalName || firstCompany?.tradeName,
      companyTaxId: firstCompany?.taxId
    };

    console.log('🔑 Payload do token:', payload);

    const token = this.jwtService.sign(payload);

    // Retornar token + dados do usuário
    return {
      access_token: token,
      user: {
        id: fullUser.id,
        email: fullUser.email,
        fullName: fullUser.fullName,
        document: fullUser.document,
        profile: fullUser.profile,
        // Lista completa de empresas
        companies: fullUser?.companies?.map(uc => ({
          id: uc.company.id,
          taxId: uc.company.taxId,
          legalName: uc.company.legalName,
          tradeName: uc.company.tradeName,
          role: uc.role // papel do usuário na empresa (ADMIN, etc)
        })) || []
      },
    };
  }

  async requestUnlock(email: string, message: string) {
    const user = await this.usersService.findByEmail(email.toLowerCase());
    if (user) {
      await this.prisma.accessUnlockRequest.create({
        data: { userId: user.id, message },
      });
    }
    return { success: true, message: 'Solicitacao enviada. O administrador ira analisar.' };
  }

}