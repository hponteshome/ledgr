// apps/api/src/modules/menu-usage/menu-usage.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';

@Injectable()
export class MenuUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async track(path: string, label?: string, moduleLabel?: string) {
    return this.prisma.menuUsageStat.upsert({
      where: { path },
      update: {
        hitCount: { increment: 1 },
        lastUsedAt: new Date(),
        ...(label ? { label } : {}),
        ...(moduleLabel ? { moduleLabel } : {}),
      },
      create: { path, label, moduleLabel, hitCount: 1, lastUsedAt: new Date() },
    });
  }

  // Cruza o catalogo real de rotas (sidebar_items) com os contadores de uso -
  // itens do catalogo sem contador aparecem com hitCount 0 ("nunca utilizados"),
  // em vez de simplesmente nao aparecerem no relatorio.
  async report() {
    const [items, stats] = await Promise.all([
      this.prisma.sidebarItem.findMany({
        where: { disabled: false, actionType: 'link' },
        select: { path: true, label: true, module: true },
      }),
      this.prisma.menuUsageStat.findMany(),
    ]);

    const statByPath = new Map(stats.map(s => [s.path, s]));
    const catalogPaths = new Set(items.map(i => i.path));

    const fromCatalog = items.map(i => {
      const s = statByPath.get(i.path);
      return {
        path: i.path,
        label: i.label,
        moduleLabel: i.module,
        hitCount: s?.hitCount ?? 0,
        lastUsedAt: s?.lastUsedAt ?? null,
      };
    });

    // Rotas com uso registrado mas fora do catalogo atual (item renomeado/removido
    // do menu depois de ja ter sido usado) - mantidas visiveis pra nao perder o dado.
    const orphanStats = stats
      .filter(s => !catalogPaths.has(s.path))
      .map(s => ({
        path: s.path,
        label: s.label ?? s.path,
        moduleLabel: s.moduleLabel ?? '—',
        hitCount: s.hitCount,
        lastUsedAt: s.lastUsedAt,
      }));

    const all = [...fromCatalog, ...orphanStats].sort((a, b) => b.hitCount - a.hitCount);

    return {
      items: all,
      totalCatalogRoutes: items.length,
      neverUsedCount: all.filter(i => i.hitCount === 0).length,
    };
  }
}
