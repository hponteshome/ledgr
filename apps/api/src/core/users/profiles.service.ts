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

  getAccessSchedule(profileId: string) {
    return this.prisma.profileAccessSchedule.findUnique({ where: { profileId } });
  }

  setAccessSchedule(profileId: string, dto: any, userId: string) {
    const data = {
      mode: dto.mode ?? 'SCHEDULED',
      weekdays: dto.weekdays ?? [1,2,3,4,5],
      startTime: dto.startTime ?? '08:00',
      endTime: dto.endTime ?? '18:00',
      vacationMonths: dto.vacationMonths ?? [],
      updatedById: userId,
    };
    return this.prisma.profileAccessSchedule.upsert({
      where: { profileId },
      create: { profileId, ...data },
      update: data,
    });
  }

  removeAccessSchedule(profileId: string) {
    return this.prisma.profileAccessSchedule.delete({ where: { profileId } }).catch(() => null);
  }
}