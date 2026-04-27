// D:\Projetos\Ledgr\apps\api\src\modules\assets\services\retrofit.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssetHistoryService } from './history.service';

@Injectable()
export class RetrofitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: AssetHistoryService,
  ) {}

  async findAll(companyId: string, assetId?: string) {
    return this.prisma.assetRetrofitProject.findMany({
      where: { companyId, ...(assetId && { assetId }) },
      include: {
        phases: { orderBy: { sequence: 'asc' } },
        asset:  { select: { id: true, internalCode: true, description: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const project = await this.prisma.assetRetrofitProject.findFirst({
      where: { id, companyId },
      include: { phases: { orderBy: { sequence: 'asc' } }, asset: true },
    });
    if (!project) throw new NotFoundException('Retrofit project not found');
    return project;
  }

  async create(companyId: string, dto: any, performedById?: string) {
    const asset = await this.prisma.fixedAsset.findFirst({
      where: { id: dto.assetId, companyId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    const { phases, ...projectData } = dto;

    const project = await this.prisma.assetRetrofitProject.create({
      data: {
        ...projectData,
        companyId,
        startDate:      new Date(dto.startDate),
        plannedEndDate: dto.plannedEndDate ? new Date(dto.plannedEndDate) : null,
        phases: phases?.length ? {
          create: phases.map((p: any) => ({
            ...p, plannedDate: new Date(p.plannedDate),
          })),
        } : undefined,
      },
      include: { phases: true },
    });

    await this.history.record(
      dto.assetId, companyId, 'RETROFIT_STARTED',
      `Retrofit project started: ${dto.name}`,
      undefined, undefined, performedById,
    );

    return project;
  }

  async updatePhase(
    companyId: string,
    projectId: string,
    phaseId: string,
    dto: any,
  ) {
    const project = await this.findOne(companyId, projectId);

    const phase = await this.prisma.assetRetrofitPhase.update({
      where: { id: phaseId },
      data: {
        ...dto,
        ...(dto.completionDate && { completionDate: new Date(dto.completionDate) }),
      },
    });

    const phases          = await this.prisma.assetRetrofitPhase.findMany({ where: { projectId } });
    const completedCount  = phases.filter(p => p.completed).length;
    const physicalProgress = (completedCount / phases.length) * 100;
    const executedAmount  = phases.reduce((sum, p) => sum + Number(p.executedAmount), 0);

    await this.prisma.assetRetrofitProject.update({
      where: { id: projectId },
      data: {
        physicalProgress,
        executedAmount,
        ...(physicalProgress >= 100 && { status: 'COMPLETED', actualEndDate: new Date() }),
      },
    });

    return phase;
  }

  async complete(companyId: string, id: string, performedById?: string) {
    const project = await this.findOne(companyId, id);

    await this.prisma.assetRetrofitProject.update({
      where: { id },
      data: { status: 'COMPLETED', actualEndDate: new Date(), physicalProgress: 100 },
    });

    await this.history.record(
      project.assetId, companyId, 'RETROFIT_COMPLETED',
      `Retrofit project completed: ${project.name}. Total executed: ${Number(project.executedAmount).toFixed(2)}`,
      undefined, Number(project.executedAmount), performedById,
    );

    return { ok: true };
  }
}
