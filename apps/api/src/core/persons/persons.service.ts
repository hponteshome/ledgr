// apps/api/src/core/persons/persons.service.ts

import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePersonDto, UpdatePersonDto, CreatePersonCompanyDto, UpdatePersonCompanyDto } from './persons.dto';

// ── Validador de CPF ──────────────────────────────────────────
function validarCpf(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let s = 0;
    for (let i = 0; i < len; i++) s += parseInt(d[i]) * (len + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(d[9]) && calc(10) === parseInt(d[10]);
}

@Injectable()
export class PersonsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── PERSONS CRUD ──────────────────────────────────────────

  async findAll(query: {
    search?: string;
    isActive?: string;
    page?: string;
    limit?: string;
  }) {
    const page  = Math.max(1, parseInt(query.page  ?? '1'));
    const limit = Math.min(100, parseInt(query.limit ?? '20'));
    const skip  = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { cpf:      { contains: query.search.replace(/\D/g, '') } },
        { email:    { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.person.findMany({
        where,
        skip,
        take: limit,
        orderBy: { fullName: 'asc' },
        include: {
          companyLinks: {
            where: { endDate: null },
            include: { company: { select: { id: true, tradeName: true, legalName: true } } },
          },
        },
      }),
      this.prisma.person.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const person = await this.prisma.person.findFirst({
      where: { id, deletedAt: null },
      include: {
        companyLinks: {
          orderBy: { startDate: 'desc' },
          include: { company: { select: { id: true, tradeName: true, legalName: true, taxId: true } } },
        },
      },
    });
    if (!person) throw new NotFoundException('Pessoa não encontrada.');
    return person;
  }



async findByCpf(cpf: string) {
  // 1. Garante que a busca seja feita apenas com números puros
  // Isso remove qualquer máscara que venha do frontend por acidente
  const apenasNumeros = cpf.replace(/\D/g, '');

  // 2. Realiza a busca direta na coluna 'cpf' da tabela 'person'
  const person = await this.prisma.person.findFirst({
    where: {
      cpf: apenasNumeros, // Busca exata pelo número limpo
      deletedAt: null     // Garante que a pessoa não foi excluída logicamente
    },
    include: {
      companyLinks: {
        where: { endDate: null },
        include: { 
          company: { 
            select: { 
              id: true, 
              tradeName: true, 
              legalName: true 
            } 
          } 
        },
      },
    },
  });

  // 3. Se não encontrar, retorna null ou lança a exceção
  // O 404 aqui é o que avisa o frontend para seguir com o cadastro manual
  if (!person) {
    throw new NotFoundException(`Pessoa com CPF ${cpf} não encontrada.`);
  }

  return person;
}



  // ✅ MÉTODO CREATE CORRETO (com validação de CPF e formatação)
  async create(dto: CreatePersonDto) {
    if (!validarCpf(dto.document)) {
      throw new BadRequestException('CPF inválido — dígitos verificadores não conferem.');
    }

    const exists = await this.prisma.person.findFirst({
      where: { cpf: dto.document, deletedAt: null },
    });
    if (exists) throw new ConflictException(`CPF ${dto.document} já cadastrado.`);

    // Normaliza o CPF para o formato com pontos/traço
    const formattedCpf = dto.document.replace(/\D/g, '').length === 11 
      ? dto.document.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
      : dto.document;

    // Desestrutura otherRegistrations para cast explícito (Json do Prisma)
    const { otherRegistrations, birthDate, rgIssueDate, document, ...rest } = dto;
    
    return this.prisma.person.create({
      data: {
        ...rest,
        cpf: formattedCpf,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        rgIssueDate: rgIssueDate ? new Date(rgIssueDate) : undefined,
        otherRegistrations: otherRegistrations
          ? (otherRegistrations as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  async update(id: string, dto: UpdatePersonDto) {
    await this.findOne(id); // garante que existe

    if (dto.document && !validarCpf(dto.document)) {
      throw new BadRequestException('CPF inválido — dígitos verificadores não conferem.');
    }

    // Verifica conflito de CPF em outro registro
    if (dto.document) {
      const conflict = await this.prisma.person.findFirst({
        where: { cpf: dto.document, deletedAt: null, NOT: { id } },
      });
      if (conflict) throw new ConflictException(`CPF ${dto.document} já cadastrado em outra pessoa.`);
    }

    const { otherRegistrations: otherRegs, birthDate: bd, rgIssueDate: rgd, ...restDto } = dto;
    return this.prisma.person.update({
      where: { id },
      data: {
        ...restDto,
        birthDate:          bd  ? new Date(bd)  : undefined,
        rgIssueDate:        rgd ? new Date(rgd) : undefined,
        otherRegistrations: otherRegs
          ? (otherRegs as unknown as Prisma.InputJsonValue)
          : undefined,
        updatedAt: new Date(),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Soft delete
    await this.prisma.person.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, updatedAt: new Date() },
    });
    return { message: 'Pessoa removida com sucesso.' };
  }

  // ── VÍNCULOS PESSOA ↔ EMPRESA ─────────────────────────────

  async createLink(dto: CreatePersonCompanyDto) {
    await this.findOne(dto.personId);
    return this.prisma.personCompany.create({
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate:   dto.endDate   ? new Date(dto.endDate)   : undefined,
      },
      include: {
        company: { select: { id: true, tradeName: true, legalName: true } },
        person:  { select: { id: true, fullName: true, cpf: true } },
      },
    });
  }

  async updateLink(linkId: string, dto: UpdatePersonCompanyDto) {
    const link = await this.prisma.personCompany.findUnique({ where: { id: linkId } });
    if (!link) throw new NotFoundException('Vínculo não encontrado.');
    return this.prisma.personCompany.update({
      where: { id: linkId },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate:   dto.endDate   ? new Date(dto.endDate)   : undefined,
        updatedAt: new Date(),
      },
    });
  }

  async removeLink(linkId: string) {
    const link = await this.prisma.personCompany.findUnique({ where: { id: linkId } });
    if (!link) throw new NotFoundException('Vínculo não encontrado.');
    await this.prisma.personCompany.delete({ where: { id: linkId } });
    return { message: 'Vínculo removido.' };
  }

  // ── Qualificação completa para uso em documentos ──────────
  async qualificacao(id: string): Promise<string> {
    const p = await this.findOne(id);

    // Determina gênero para flexão gramatical
    const gen: 'M' | 'F' | null =
      (p as any).gender === 'Masculino' ? 'M' :
      (p as any).gender === 'Feminino'  ? 'F' : null;

    // Retorna forma masculina, feminina ou neutra (com /a)
    const g = (masc: string, fem: string, neutro?: string): string =>
      gen === 'M' ? masc : gen === 'F' ? fem : (neutro ?? `${masc}(a)`);

    const partes: string[] = [p.fullName];

    // Nacionalidade — flexiona automaticamente palavras terminadas em "o/a"
    // Ex: "Brasileiro(a)" → "Brasileiro" (M) ou "Brasileira" (F)
    if (p.nationality) {
      const nat = p.nationality.trim();
      const natLow = nat.toLowerCase();
      if (gen === 'M' && natLow.endsWith('(a)')) {
        partes.push(nat.replace(/\(a\)$/i, ''));
      } else if (gen === 'F' && natLow.endsWith('o')) {
        partes.push(nat.slice(0, -1) + 'a');
      } else if (gen === 'F' && natLow.endsWith('o(a)')) {
        partes.push(nat.replace(/o\(a\)$/i, 'a'));
      } else {
        partes.push(nat);
      }
    }

    // Estado civil — flexionado por gênero
    if (p.maritalStatus) {
      const ec = ESTADO_CIVIL_FLEX[p.maritalStatus as keyof typeof ESTADO_CIVIL_FLEX];
      if (ec) partes.push(g(ec.M, ec.F, ec.N));

      // Regime de bens — só para casados/união estável
      if (
        (p.maritalStatus === 'CASADO' || p.maritalStatus === 'UNIAO_ESTAVEL') &&
        p.matrimonialRegime
      ) {
        const regime = REGIME[p.matrimonialRegime as keyof typeof REGIME] ?? p.matrimonialRegime;
        partes.push(`${g('casado', 'casada')} sob o regime da ${regime}`);
      }
    }

    // Registro profissional — inscrito/inscrita, advogado/advogada etc.
    const insc  = g('inscrito',  'inscrita');
    const port  = g('portador',  'portadora');
    const resid = g('com domicilio', 'com domicílio');

    if (p.oabNumber) {
      const adv = g('advogado', 'advogada');
      partes.push(`${adv}, ${insc} na OAB/${p.oabState ?? ''} sob o nº ${p.oabNumber}`);
    } else if (p.crcNumber) {
      const cont = g('contador', 'contadora');
      partes.push(`${cont}, ${insc} no CRC/${p.crcState ?? ''} sob o nº ${p.crcNumber}`);
    } else if (p.creaNumber) {
      const eng = g('engenheiro', 'engenheira');
      partes.push(`${eng}, ${insc} no CREA/${p.creaState ?? ''} sob o nº ${p.creaNumber}`);
    } else if (p.coreconNumber) {
      partes.push(`economista, ${insc} no CORECON/${p.coreconState ?? ''} sob o nº ${p.coreconNumber}`);
    }

    if (p.rgNumber)
      partes.push(`${port} da Cédula de Identidade RG nº ${p.rgNumber}${p.rgIssuer ? ' ' + p.rgIssuer : ''}`);

    partes.push(`CPF nº ${p.cpf}`);

    const endereco = [
  p.street && p.number ? `${p.street}, ${p.number}` : p.street,
  p.complement,
  p.neighborhood,
  p.city && p.state ? `${p.city}-${p.state}` : p.city,
  p.zipCode ? `CEP ${p.zipCode}` : null,
].filter(Boolean).join(', ');

if (endereco) partes.push(`com domicílio na ${endereco}`);

    return partes.join(', ');
  }
}

// ── Mapeamentos para qualificação ─────────────────────────────

// Estado civil com três formas: M (masculino), F (feminino), N (neutro/genérico)
const ESTADO_CIVIL_FLEX = {
  SOLTEIRO:      { M: 'solteiro',      F: 'solteira',      N: 'solteiro(a)'      },
  CASADO:        { M: 'casado',        F: 'casada',        N: 'casado(a)'        },
  UNIAO_ESTAVEL: { M: 'em união estável', F: 'em união estável', N: 'em união estável' },
  SEPARADO:      { M: 'separado',      F: 'separada',      N: 'separado(a)'      },
  DIVORCIADO:    { M: 'divorciado',    F: 'divorciada',    N: 'divorciado(a)'    },
  VIUVO:         { M: 'viúvo',         F: 'viúva',         N: 'viúvo(a)'         },
};

const REGIME = {
  COMUNHAO_PARCIAL:            'comunhão parcial de bens',
  COMUNHAO_UNIVERSAL:          'comunhão universal de bens',
  SEPARACAO_TOTAL:             'separação total de bens',
  SEPARACAO_OBRIGATORIA:       'separação obrigatória de bens',
  PARTICIPACAO_FINAL_AQUESTOS: 'participação final nos aquestos',
};
