import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/client';

@Injectable()
export class RaisService {
  constructor(private prisma: PrismaService) {}

  // ── Gera/atualiza declaracao RAIS para empresa/ano ──────────────────────────
  async gerarDeclaracao(companyId: string, anoBase: number, userId: string) {
    const emps = await this.prisma.employee.findMany({
      where: { companyId },
      include: {
        terminations: { where: { companyId } },
        folhas: { include: { folha: true } },
      },
    });

    // Busca ou cria declaracao
    let decl = await this.prisma.raisDeclaracao.findFirst({ where: { companyId, anoBase } });
    if (!decl) {
      decl = await this.prisma.raisDeclaracao.create({
        data: { companyId, anoBase, status: 'RASCUNHO', createdById: userId },
      });
    }

    // Remove vinculos antigos e regera
    await this.prisma.raisVinculo.deleteMany({ where: { raisId: decl.id } });

    let totalMassa = 0;
    let totalVinculos = 0;

    for (const emp of emps) {
      const term     = (emp.terminations as any[])[0];
      const admissao = new Date(emp.hireDate);
      const deslig   = term ? new Date(term.dataDesligamento ?? term.lastWorkingDay) : null;

      // So inclui se estava ativo em algum momento do ano
      const anoIni = new Date(anoBase, 0, 1);
      const anoFim = new Date(anoBase, 11, 31);
      if (admissao > anoFim) continue;
      if (deslig && deslig < anoIni) continue;

      // Calcula meses e remuneracao total no ano pelas folhas
      const folhasAno = ((emp as any).folhas ?? []).filter((ff: any) => {
        const comp = ff.folha?.competencia ?? '';
        return comp.startsWith(String(anoBase));
      });
      const totalRem = folhasAno.reduce((s: number, ff: any) => s + Number(ff.totalBruto ?? 0), 0);

      let meses = 12;
      if (admissao.getFullYear() === anoBase) {
        meses = 12 - admissao.getMonth();
        if (admissao.getDate() > 15) meses--;
      }
      if (deslig && deslig.getFullYear() === anoBase) {
        meses = deslig.getMonth() + 1;
        if (deslig.getDate() < 16) meses--;
      }
      meses = Math.max(0, Math.min(12, meses));

      const salMesRef = Number(emp.salary);
      totalMassa  += salMesRef;
      totalVinculos++;

      await this.prisma.raisVinculo.create({
        data: {
          raisId:           decl.id,
          companyId,
          employeeId:       emp.id,
          dataAdmissao:     admissao,
          dataDesligamento: deslig,
          mesesTrabalhados: meses,
          salarioMesRef:    new Decimal(salMesRef),
          totalRemuneracao: new Decimal(Math.round(totalRem * 100) / 100),
          horasSemanais:    emp.weeklyHours ?? 44,
          createdById:      userId,
        } as any,
      });
    }

    return this.prisma.raisDeclaracao.update({
      where:  { id: decl.id },
      data:   {
        status:            'RASCUNHO',
        totalVinculos,
        totalMassaSalarial: new Decimal(Math.round(totalMassa * 100) / 100),
      },
      include: { vinculos: { include: { employee: { select: { fullName: true, taxId: true, role: true } } } } },
    });
  }

  async listar(companyId: string) {
    return this.prisma.raisDeclaracao.findMany({
      where:   { companyId },
      include: { vinculos: { include: { employee: { select: { fullName: true, taxId: true } } } } },
      orderBy: { anoBase: 'desc' },
    });
  }

  async registrarEnvio(companyId: string, id: string, protocolo: string) {
    return this.prisma.raisDeclaracao.update({
      where: { id },
      data:  { status: 'ENVIADA', dataEnvio: new Date(), protocoloRais: protocolo },
    });
  }
}
