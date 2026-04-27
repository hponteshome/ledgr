// *********** apps\api\src\core\users\ProfilesController.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.profile.findMany({
      where: { isActive: true },
      select: { id: true, name: true, permissions: true },
      orderBy: { name: 'asc' },
    });
  }

  findById(id: string) {
    return this.prisma.profile.findUnique({ where: { id } });
  }

  update(id: string, data: any) {
    return this.prisma.profile.update({
      where: { id },
      data: {
        name: data.name,
        permissions: data.permissions,
      },
    });
  }

  remove(id: string) {
    return this.prisma.profile.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });
  }
}