import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';

@Injectable()
export class SidebarPermissionsService {
  constructor(private prisma: PrismaService) {}

  // Todos os itens cadastrados
  async listItems() {
    return this.prisma.sidebarItem.findMany({ orderBy: { ordem: 'asc' } });
  }

  // Permissoes de um perfil
  async getProfilePermissions(profileId: string) {
    return this.prisma.profileSidebarPermission.findMany({
      where: { profileId },
      include: { item: true },
    });
  }

  // Salvar permissoes de um perfil (substituicao completa)
  async setProfilePermissions(profileId: string, itemIds: string[]) {
    await this.prisma.profileSidebarPermission.deleteMany({ where: { profileId } });
    if (itemIds.length === 0) return;
    await this.prisma.profileSidebarPermission.createMany({
      data: itemIds.map(itemId => ({ profileId, itemId, canView: true })),
    });
    return this.getProfilePermissions(profileId);
  }

  // Permissoes de um usuario (overrides)
  async getUserPermissions(userId: string) {
    return this.prisma.userSidebarPermission.findMany({
      where: { userId },
      include: { item: true },
    });
  }

  // Salvar override de usuario
  async setUserPermission(userId: string, itemId: string, canView: boolean, companyId?: string) {
    return this.prisma.userSidebarPermission.upsert({
      where: { userId_itemId_companyId: { userId, itemId, companyId: companyId ?? null } },
      create: { userId, itemId, canView, companyId: companyId ?? null },
      update: { canView },
    });
  }

  // Remover override de usuario
  async removeUserPermission(userId: string, itemId: string) {
    await this.prisma.userSidebarPermission.deleteMany({ where: { userId, itemId } });
  }

  // Resolver permissoes efetivas para um usuario/empresa
  async resolvePermissions(userId: string, companyId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profileId: true, profile: { select: { permissions: true } } },
    });
    if (!user) return [];

    // Master Admin ve tudo
    const perms = user.profile?.permissions as any;
    if (perms?.all === true) {
      const all = await this.prisma.sidebarItem.findMany({ select: { path: true } });
      return all.map(i => i.path);
    }

    // Base: permissoes do perfil
    const profilePerms = user.profileId
      ? await this.prisma.profileSidebarPermission.findMany({
          where: { profileId: user.profileId, canView: true },
          include: { item: { select: { path: true } } },
        })
      : [];
    const allowed = new Set(profilePerms.map(p => p.item.path));

    // Overrides do usuario (global + empresa especifica)
    const userOverrides = await this.prisma.userSidebarPermission.findMany({
      where: { userId, companyId: { in: [companyId, null] } },
      include: { item: { select: { path: true } } },
    });
    for (const o of userOverrides) {
      if (o.canView) allowed.add(o.item.path);
      else allowed.delete(o.item.path);
    }

    return [...allowed];
  }
}
