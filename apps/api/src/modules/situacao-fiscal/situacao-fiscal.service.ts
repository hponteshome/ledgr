// apps/api/src/modules/situacao-fiscal/situacao-fiscal.service.ts
// DASH-03 (13/11/2026): situacao fiscal da empresa para o Dashboard.
// Fonte unica: fiscal_obligations (situacao por competencia), company_alerts (alertas, inclusive travados)
// e tax_darfs (DARFs em aberto). Generico: so le o que estiver cadastrado para a empresa.
import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type SituacaoObrigacao = 'ATRASADA' | 'RETIFICAR' | 'PENDENTE' | 'ENTREGUE' | 'DISPENSADA';

const ROTULOS: Record<string, string> = {
  ECF: 'ECF', ECD: 'ECD', DIMOB: 'DIMOB', EFD_CONTRIB: 'EFD-Contribuições', DCTF: 'DCTF (PGD)', DCTFWEB: 'DCTFWeb/MIT',
  PIS_COFINS: 'PIS/Cofins (DARF)', IRPJ_CSLL_TRI: 'IRPJ/CSLL trimestral', IRPJ_CSLL_AJUSTE: 'IRPJ/CSLL ajuste anual', DAS: 'DAS', DEFIS: 'DEFIS',
  ESOCIAL: 'eSocial', FGTS: 'FGTS', GPS_INSS: 'GPS/INSS', INSS_DARF: 'INSS (DCTFWeb)', DIRF: 'DIRF',
};
const ORDEM = ['ECF', 'ECD', 'DIMOB', 'EFD_CONTRIB', 'DCTF', 'DCTFWEB', 'PIS_COFINS', 'IRPJ_CSLL_TRI', 'IRPJ_CSLL_AJUSTE', 'DAS', 'DEFIS', 'ESOCIAL', 'FGTS', 'GPS_INSS', 'INSS_DARF', 'DIRF'];
const PESO: Record<SituacaoObrigacao, number> = { ATRASADA: 5, RETIFICAR: 4, PENDENTE: 3, ENTREGUE: 2, DISPENSADA: 1 };
const STATUS_VALIDOS = ['PENDING', 'IN_PROGRESS', 'DONE', 'OVERDUE', 'DISPENSED', 'RECTIFY'];

const ymd = (d: Date | null | undefined): string => (d ? d.toISOString().slice(0, 10) : '');
const rotulo = (code: string) => ROTULOS[code] ?? code;
const ordem = (code: string) => { const i = ORDEM.indexOf(code); return i < 0 ? 99 : i; };
const p2 = (v: number) => String(v).padStart(2, '0');
const local = (d: Date) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());

@Injectable()
export class SituacaoFiscalService {
  constructor(private prisma: PrismaService) {}

  private situacao(status: string, dueDate: Date, hoje: string): SituacaoObrigacao {
    if (status === 'DONE') return 'ENTREGUE';
    if (status === 'DISPENSED') return 'DISPENSADA';
    if (status === 'RECTIFY') return 'RETIFICAR';
    return ymd(dueDate) < hoje ? 'ATRASADA' : 'PENDENTE';
  }

  async painel(companyId: string) {
    if (!companyId) throw new BadRequestException('Empresa não informada');
    const n = new Date();
    const hoje = local(n);
    const limite30 = local(new Date(n.getFullYear(), n.getMonth(), n.getDate() + 30));

    const [alertas, obrig, darfs] = await Promise.all([
      this.prisma.companyAlert.findMany({ where: { companyId, resolvedAt: null }, orderBy: [{ locked: 'desc' }, { createdAt: 'asc' }] }),
      this.prisma.fiscalObligation.findMany({ where: { companyId } }),
      this.prisma.taxDarf.findMany({
        where: { companyId, deletedAt: null, status: { notIn: ['PAGO', 'CANCELADO'] } },
        orderBy: { vencimento: 'asc' },
      }),
    ]);

    const itens = obrig
      .map(o => ({
        id: o.id, code: o.code, label: rotulo(o.code), competence: o.competence,
        dueDate: ymd(o.dueDate), sit: this.situacao(String(o.status), o.dueDate, hoje),
        notes: o.notes ?? null, dependsOn: o.dependsOn ?? null, receiptNumber: o.receiptNumber ?? null,
        deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
      }))
      .sort((a, b) => ordem(a.code) - ordem(b.code) || a.code.localeCompare(b.code) || a.competence.localeCompare(b.competence));

    // Grupos: competencias consecutivas da mesma obrigacao, com a mesma situacao e o mesmo texto
    const grupos: Array<{ code: string; label: string; sit: SituacaoObrigacao; de: string; ate: string; qtd: number;
      dueDate: string; notes: string | null; dependsOn: string | null; _i: number }> = [];
    itens.forEach((it, i) => {
      if (it.sit === 'ENTREGUE' || it.sit === 'DISPENSADA') return;
      const g = grupos[grupos.length - 1];
      if (g && g._i === i - 1 && g.code === it.code && g.sit === it.sit && g.notes === it.notes && g.dependsOn === it.dependsOn) {
        g.ate = it.competence; g.qtd++; g._i = i; return;
      }
      grupos.push({ code: it.code, label: it.label, sit: it.sit, de: it.competence, ate: it.competence, qtd: 1,
        dueDate: it.dueDate, notes: it.notes, dependsOn: it.dependsOn, _i: i });
    });
    grupos.sort((a, b) => PESO[b.sit] - PESO[a.sit] || ordem(a.code) - ordem(b.code) || a.de.localeCompare(b.de));

    const proximas = itens
      .filter(i => i.sit === 'PENDENTE' && i.dueDate <= limite30)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map(i => ({ id: i.id, code: i.code, label: i.label, competence: i.competence, dueDate: i.dueDate, notes: i.notes }));

    // Matriz obrigacao x ano: pior situacao do ano em cada celula
    const anos = Array.from(new Set(itens.map(i => i.competence.slice(0, 4)))).sort();
    const linhasMap = new Map<string, { code: string; label: string; celulas: Record<string, { sit: SituacaoObrigacao; total: number; entregues: number }> }>();
    for (const it of itens) {
      const ano = it.competence.slice(0, 4);
      let ln = linhasMap.get(it.code);
      if (!ln) { ln = { code: it.code, label: it.label, celulas: {} }; linhasMap.set(it.code, ln); }
      const c = ln.celulas[ano] ?? (ln.celulas[ano] = { sit: it.sit, total: 0, entregues: 0 });
      c.total++;
      if (it.sit === 'ENTREGUE' || it.sit === 'DISPENSADA') c.entregues++;
      if (PESO[it.sit] > PESO[c.sit]) c.sit = it.sit;
    }
    const linhas = Array.from(linhasMap.values()).sort((a, b) => ordem(a.code) - ordem(b.code));

    const darfsAbertos = darfs.map(x => ({
      id: x.id, codigo: x.codigo, descricao: x.descricao ?? null, origem: x.origem,
      periodoApuracao: ymd(x.periodoApuracao), vencimento: ymd(x.vencimento),
      total: Number(x.total), numeroReferencia: x.numeroReferencia ?? null, vencido: ymd(x.vencimento) < hoje,
    }));

    // LASTRO-02 (17/11/2026): alerta calculado - contrato de locacao ativo (inclusive futuro) sem PDF assinado e sem ressalva.
    // Nao grava em company_alerts: some sozinho quando o contrato ganha lastro. Nao bloqueia nada (decisao do usuario: so alertar).
    const semLastro = await this.prisma.rentalContract.findMany({
      where: { companyId, deletedAt: null, status: 'ATIVO', signedDocumentId: null, lastroRessalva: null },
      select: { contractNumber: true, fixedAsset: { select: { internalCode: true } } },
      orderBy: { startDate: 'asc' },
    });
    const autoLastro = semLastro.length === 0 ? [] : [{
      id: 'auto-lastro-contratos', severity: 'WARNING',
      title: semLastro.length === 1 ? '1 contrato de locação sem assinatura' : semLastro.length + ' contratos de locação sem assinatura',
      message: 'Sem PDF assinado e sem ressalva: ' + semLastro.map(c => (c.contractNumber ?? 's/n') + ' (' + (c.fixedAsset?.internalCode ?? '?') + ')').join(', ') + '. Anexe o contrato assinado ou registre a ressalva na coluna Lastro.',
      locked: false, actionUrl: '/app/assets/rental-contracts?lastro=pendente', actionLabel: 'Ver contratos sem lastro',
      blocksAction: null, createdByName: null, createdAt: new Date().toISOString(), auto: true,
    }];

    // ATA-PL (18/11/2026): alerta calculado - vigencia de pro-labore sem ata de deliberacao vinculada,
    // ou empresa marcada com pro-labore sem nenhuma vigencia. Some sozinho quando resolvido. So alerta, nao bloqueia.
    const [plSemAta, plVig, empPl] = await Promise.all([
      this.prisma.proLaboreConfig.count({ where: { companyId, deletedAt: null, documentoId: null } }),
      this.prisma.proLaboreConfig.count({ where: { companyId, deletedAt: null } }),
      (this.prisma as any).company.findUnique({ where: { id: companyId } }),
    ]);
    const temPl = !!((empPl as any)?.temProLabore ?? (empPl as any)?.tem_pro_labore);
    const autoProLabore: any[] = [];
    if (plSemAta > 0) autoProLabore.push({
      id: 'auto-prolabore-sem-ata', severity: 'WARNING',
      title: plSemAta === 1 ? '1 vigência de pró-labore sem ata' : plSemAta + ' vigências de pró-labore sem ata',
      message: 'O valor do pró-labore deve estar deliberado pelos sócios. Prepare a ata, guarde no Arquivo Digital e vincule em Pró-labore > Configurar.',
      locked: false, actionUrl: '/app/hr/pro-labore', actionLabel: 'Ver pró-labore',
      blocksAction: null, createdByName: null, createdAt: new Date().toISOString(), auto: true,
    });
    if (temPl && plVig === 0) autoProLabore.push({
      id: 'auto-prolabore-sem-vigencia', severity: 'WARNING',
      title: 'Pró-labore sem vigência cadastrada',
      message: 'A empresa está marcada com pró-labore, mas não há vigência (valor, cargo, CBO) nem ata. Cadastre em Pró-labore > Configurar.',
      locked: false, actionUrl: '/app/hr/pro-labore', actionLabel: 'Ver pró-labore',
      blocksAction: null, createdByName: null, createdAt: new Date().toISOString(), auto: true,
    });

    return {
      hoje,
      alertas: [...alertas.map(a => ({
        id: a.id, severity: a.severity, title: a.title, message: a.message ?? null, locked: a.locked, actionUrl: (a as any).actionUrl ?? null, actionLabel: (a as any).actionLabel ?? null,
        blocksAction: a.blocksAction ?? null, createdByName: a.createdByName ?? null, createdAt: a.createdAt.toISOString(),
      })), ...autoLastro, ...autoProLabore],
      kpis: {
        atrasadas: itens.filter(i => i.sit === 'ATRASADA').length,
        retificar: itens.filter(i => i.sit === 'RETIFICAR').length,
        vencendo30: proximas.length,
        darfsAbertos: darfsAbertos.length,
        darfsTotal: Math.round(darfsAbertos.reduce((s, x) => s + x.total, 0) * 100) / 100,
        darfProxVenc: darfsAbertos.length ? darfsAbertos[0].vencimento : null,
      },
      grupos: grupos.map(g => ({ code: g.code, label: g.label, sit: g.sit, de: g.de, ate: g.ate, qtd: g.qtd, dueDate: g.dueDate, notes: g.notes, dependsOn: g.dependsOn })),
      proximas,
      darfs: darfsAbertos,
      matriz: { anos, linhas },
    };
  }

  /** Resolve (encerra) um alerta. Alerta travado exige o motivo registrado. */
  async resolverAlerta(companyId: string, userId: string, id: string, nota: string, master = false) {
    if (!nota || !String(nota).trim()) throw new BadRequestException('Informe o motivo da resolução do alerta.');
    const a = await this.prisma.companyAlert.findFirst({ where: { id, companyId } });
    if (!a) throw new NotFoundException('Alerta não encontrado');
    if (a.resolvedAt) throw new BadRequestException('Alerta já resolvido');
    if (a.locked && !master) throw new ForbiddenException('Alerta travado: só o administrador registra a resolução.');
    return this.prisma.companyAlert.update({
      where: { id },
      data: { resolvedAt: new Date(), resolvedById: userId || null, resolutionNote: String(nota).trim() },
    });
  }

  /** Atualiza a situacao de uma obrigacao (entregue, a retificar, dispensada...) com recibo e data de entrega. */
  async atualizarObrigacao(companyId: string, userId: string, id: string,
    dto: { status?: string; receiptNumber?: string | null; deliveredAt?: string | null; notes?: string | null; dependsOn?: string | null }) {
    const o = await this.prisma.fiscalObligation.findFirst({ where: { id, companyId } });
    if (!o) throw new NotFoundException('Obrigação não encontrada');
    const data: any = {};
    if (dto.status !== undefined) {
      if (!STATUS_VALIDOS.includes(String(dto.status))) throw new BadRequestException('Situação inválida: ' + dto.status);
      data.status = dto.status;
      if (dto.status === 'DONE') { data.doneAt = new Date(); data.doneById = userId || null; }
    }
    if (dto.receiptNumber !== undefined) data.receiptNumber = dto.receiptNumber ? String(dto.receiptNumber).trim() : null;
    if (dto.deliveredAt !== undefined) data.deliveredAt = dto.deliveredAt ? new Date(dto.deliveredAt) : null;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.dependsOn !== undefined) data.dependsOn = dto.dependsOn;
    return this.prisma.fiscalObligation.update({ where: { id }, data });
  }

  /** Alerta aberto que bloqueia uma acao (ex.: ECF_EXPORT). Para os geradores consultarem antes de produzir o arquivo. */
  async bloqueio(companyId: string, acao: string) {
    return this.prisma.companyAlert.findFirst({ where: { companyId, blocksAction: acao, resolvedAt: null } });
  }
}
