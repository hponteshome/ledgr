// src/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
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
}