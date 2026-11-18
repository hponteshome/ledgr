// apps/api/src/modules/hr/services/pro-labore.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ProLaboreService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Diretoria a partir do QSA (17/11/2026) ──────────────────────────────
  // A tela de pro-labore nao cadastra pessoas: le company_shareholders (PF com Pessoa vinculada)
  // e guarda aqui so o que e proprio do pro-labore (cargo, CBO, categoria, dia e vigencias de valor).
  async diretoria(companyId: string) {
    const socios = await this.prisma.companyShareholder.findMany({
      where: { companyId, shareholderType: 'PF', personId: { not: null } },
      include: { person: { select: { id: true, cpf: true, fullName: true, birthDate: true } } },
      orderBy: { dataEntrada: 'asc' },
    });
    const cfgs = socios.length ? await this.prisma.proLaboreConfig.findMany({
      where: { companyId, deletedAt: null, shareholderId: { in: socios.map(s => s.id) } },
      orderBy: { competenciaIni: 'asc' },
    }) : [];
    return socios.map(s => {
      const q = (s.qualificacao || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const vigencias = cfgs.filter(c => c.shareholderId === s.id);
      return {
        shareholderId: s.id, qualificacao: s.qualificacao, dataEntrada: s.dataEntrada, dataRetirada: s.dataRetirada,
        participacao: s.participacaoPercent, administra: /administr|diretor|president|gerente/.test(q),
        person: s.person, recebeProLabore: vigencias.length > 0, vigencias,
      };
    });
  }

  async salvarDiretoria(companyId: string, shareholderId: string, dto: any) {
    const sh = await this.prisma.companyShareholder.findFirst({
      where: { id: shareholderId, companyId },
      select: { id: true, personId: true, shareholderType: true, dataEntrada: true, dataRetirada: true },
    });
    if (!sh || !sh.personId || sh.shareholderType !== 'PF') throw new NotFoundException('Socio pessoa fisica nao encontrado no QSA desta empresa.');
    const personId = sh.personId;
    const ym = (d: Date | null) => (d ? d.toISOString().slice(0, 7) : null);
    const recebe = !!dto?.recebe;
    const vigs: { competenciaIni: string; competenciaFim: string | null; valorBruto: number; documentoId: string | null }[] = recebe && Array.isArray(dto?.vigencias)
      ? dto.vigencias.map((v: any) => ({ competenciaIni: String(v.competenciaIni || ''), competenciaFim: v.competenciaFim ? String(v.competenciaFim) : null, valorBruto: Number(v.valorBruto), documentoId: v.documentoId ? String(v.documentoId) : null }))
      : [];
    let cargo = '', cbo: string | null = null, categoriaEsocial = '723', diaPagamento: number | null = null;
    if (recebe) {
      cargo = String(dto.cargo || '').trim();
      if (!cargo) throw new BadRequestException('Informe o cargo.');
      categoriaEsocial = String(dto.categoriaEsocial || '723');
      if (!['721', '722', '723'].includes(categoriaEsocial)) throw new BadRequestException('Categoria eSocial invalida (721, 722 ou 723).');
      const c = String(dto.cbo || '').replace(/\D/g, '');
      if (c && c.length !== 6) throw new BadRequestException('CBO deve ter 6 digitos.');
      cbo = c || null;
      diaPagamento = dto.diaPagamento ? Number(dto.diaPagamento) : null;
      if (diaPagamento !== null && !(diaPagamento >= 1 && diaPagamento <= 31)) throw new BadRequestException('Dia de pagamento deve estar entre 1 e 31.');
      if (!vigs.length) throw new BadRequestException('Informe ao menos uma vigencia.');
      vigs.sort((a, b) => a.competenciaIni.localeCompare(b.competenciaIni));
      const re = /^\d{4}-(0[1-9]|1[0-2])$/;
      const ini = ym(sh.dataEntrada), fim = ym(sh.dataRetirada);
      vigs.forEach((v, i) => {
        const n = i + 1;
        if (!re.test(v.competenciaIni)) throw new BadRequestException(`Vigencia ${n}: competencia inicial invalida.`);
        if (v.competenciaFim && !re.test(v.competenciaFim)) throw new BadRequestException(`Vigencia ${n}: competencia final invalida.`);
        if (v.competenciaFim && v.competenciaFim < v.competenciaIni) throw new BadRequestException(`Vigencia ${n}: fim anterior ao inicio.`);
        if (!(v.valorBruto > 0)) throw new BadRequestException(`Vigencia ${n}: valor bruto deve ser maior que zero.`);
        if (ini && v.competenciaIni < ini) throw new BadRequestException(`Vigencia ${n}: inicio anterior a entrada no QSA (${ini}).`);
        if (fim && (!v.competenciaFim || v.competenciaFim > fim)) throw new BadRequestException(`Vigencia ${n}: ultrapassa a retirada do QSA (${fim}).`);
        const prox = vigs[i + 1];
        if (prox) {
          if (!v.competenciaFim) throw new BadRequestException(`Vigencia ${n}: informe o fim, pois ha vigencia posterior.`);
          if (v.competenciaFim >= prox.competenciaIni) throw new BadRequestException(`Vigencias ${n} e ${n + 1} sobrepostas.`);
        }
      });
    }
    // ata de deliberacao (18/11/2026): o documento precisa ser da propria empresa
    for (const docId of Array.from(new Set(vigs.map(v => v.documentoId).filter(Boolean))) as string[]) {
      const doc = await (this.prisma as any).document.findFirst({ where: { id: docId, companyId }, select: { id: true } });
      if (!doc) throw new BadRequestException('Ata vinculada nao encontrada no Arquivo Digital desta empresa.');
    }
    const atuais = await this.prisma.proLaboreConfig.findMany({
      where: { companyId, shareholderId, deletedAt: null },
      include: { _count: { select: { calculos: true } } },
    });
    const manter = new Set(vigs.map(v => v.competenciaIni));
    const remover = atuais.filter(a => !manter.has(a.competenciaIni));
    const travada = remover.find(a => a._count.calculos > 0)
      || atuais.find(a => a._count.calculos > 0 && vigs.some(v => v.competenciaIni === a.competenciaIni && (v.valorBruto !== Number(a.valorBruto) || v.competenciaFim !== a.competenciaFim)));
    if (travada) throw new BadRequestException(`A vigencia ${travada.competenciaIni} ja tem calculos gerados e nao pode ser alterada ou removida.`);
    return this.prisma.$transaction(async tx => {
      for (const a of remover) await tx.proLaboreConfig.update({ where: { id: a.id }, data: { deletedAt: new Date(), ativo: false } });
      for (const v of vigs) {
        const ex = atuais.find(a => a.competenciaIni === v.competenciaIni);
        const data = { cargo, cbo, categoriaEsocial, diaPagamento, valorBruto: v.valorBruto, competenciaFim: v.competenciaFim, documentoId: v.documentoId, ativo: true };
        if (ex) await tx.proLaboreConfig.update({ where: { id: ex.id }, data });
        else await tx.proLaboreConfig.create({ data: { ...data, companyId, personId, shareholderId, competenciaIni: v.competenciaIni } });
      }
      return { ok: true, vigencias: vigs.length, removidas: remover.length };
    });
  }
}
