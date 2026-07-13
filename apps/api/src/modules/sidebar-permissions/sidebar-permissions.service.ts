import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';

type Level = 'NONE' | 'VIEW' | 'EDIT' | 'DELETE';

@Injectable()
export class SidebarPermissionsService {
  constructor(private prisma: PrismaService) {}

  async listItems() {
    return this.prisma.sidebarItem.findMany({ orderBy: { ordem: 'asc' } });
  }

  async getTree() {
    const all = await this.prisma.sidebarItem.findMany({ orderBy: { ordem: 'asc' } });
    const byId = new Map(all.map(i => [i.id, { ...i, children: [] as any[] }]));
    const roots: any[] = [];
    for (const item of byId.values()) {
      if (item.parentId && byId.has(item.parentId)) {
        byId.get(item.parentId)!.children.push(item);
      } else {
        roots.push(item);
      }
    }
    return roots;
  }

  async getProfilePermissions(profileId: string) {
    return this.prisma.profileSidebarPermission.findMany({
      where: { profileId },
      include: { item: true },
    });
  }

  async setProfilePermissions(profileId: string, items: { itemId: string; accessLevel: Level }[]) {
    await this.prisma.profileSidebarPermission.deleteMany({ where: { profileId } });
    const toCreate = items.filter(i => i.accessLevel !== 'NONE');
    if (toCreate.length === 0) return this.getProfilePermissions(profileId);
    await this.prisma.profileSidebarPermission.createMany({
      data: toCreate.map(i => ({ profileId, itemId: i.itemId, accessLevel: i.accessLevel as any })),
    });
    return this.getProfilePermissions(profileId);
  }

  async getUserPermissions(userId: string) {
    return this.prisma.userSidebarPermission.findMany({
      where: { userId },
      include: { item: true },
    });
  }

  async setUserPermission(userId: string, itemId: string, accessLevel: Level, companyId?: string) {
    return this.prisma.userSidebarPermission.upsert({
      where: { userId_itemId_companyId: { userId, itemId, companyId: companyId ?? null } },
      create: { userId, itemId, accessLevel: accessLevel as any, companyId: companyId ?? null },
      update: { accessLevel: accessLevel as any },
    });
  }

  async removeUserPermission(userId: string, itemId: string) {
    await this.prisma.userSidebarPermission.deleteMany({ where: { userId, itemId } });
  }

  // Salvar overrides de usuario em lote (substituicao completa do escopo userId+companyId)
  async setUserPermissionsBulk(userId: string, items: { itemId: string; accessLevel: Level }[], companyId?: string) {
    await this.prisma.userSidebarPermission.deleteMany({ where: { userId, companyId: companyId ?? null } });
    const toCreate = items.filter(i => i.accessLevel !== "NONE");
    if (toCreate.length === 0) return this.getUserPermissions(userId);
    await this.prisma.userSidebarPermission.createMany({
      data: toCreate.map(i => ({ userId, itemId: i.itemId, accessLevel: i.accessLevel as any, companyId: companyId ?? null })),
    });
    return this.getUserPermissions(userId);
  }

  async resolvePermissions(userId: string, companyId: string): Promise<{ path: string; level: Level }[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profileId: true, profile: { select: { permissions: true } } },
    });
    if (!user) return [];

    const perms = user.profile?.permissions as any;
    if (perms?.all === true) {
      return [{ path: '*', level: 'DELETE' }];
    }

    if (!user.profileId) return [];

    const profilePerms = await this.prisma.profileSidebarPermission.findMany({
      where: { profileId: user.profileId },
      include: { item: { select: { path: true } } },
    });

    const userOverrides = await this.prisma.userSidebarPermission.findMany({
      where: { userId, companyId: { in: [companyId, null] } },
      include: { item: { select: { path: true } } },
    });

    if (profilePerms.length === 0 && userOverrides.length === 0) {
      return [];
    }

    const map = new Map<string, Level>();
    for (const p of profilePerms) map.set(p.item.path, p.accessLevel as Level);
    for (const o of userOverrides) map.set(o.item.path, o.accessLevel as Level);

    return [...map.entries()].map(([path, level]) => ({ path, level }));
  }

  async resolveResourceLevel(userId: string, companyId: string, resource: string): Promise<Level> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profileId: true, profile: { select: { permissions: true } } },
    });
    if (!user) return 'NONE';

    const perms = user.profile?.permissions as any;
    if (perms?.all === true) return 'DELETE';

    if (!user.profileId) return 'NONE';

    const item = await this.prisma.sidebarItem.findFirst({ where: { resource } });
    if (!item) return 'NONE';

    const profileCount = await this.prisma.profileSidebarPermission.count({
      where: { profileId: user.profileId },
    });

    const override = await this.prisma.userSidebarPermission.findFirst({
      where: { userId, itemId: item.id, companyId: { in: [companyId, null] } },
      orderBy: { companyId: 'desc' },
    });

    if (profileCount === 0) {
      return override ? (override.accessLevel as Level) : 'EDIT';
    }

    const profilePerm = await this.prisma.profileSidebarPermission.findUnique({
      where: { profileId_itemId: { profileId: user.profileId, itemId: item.id } },
    });

    let level: Level = (profilePerm?.accessLevel as Level) ?? 'NONE';
    if (override) level = override.accessLevel as Level;
    return level;
  }
}
