import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class HolidayService {
  constructor(
    private prisma: PrismaService,
    private http: HttpService,
  ) {}

  async findAll(year?: number, type?: string) {
    const where: any = {};
    if (year) {
      where.date = {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31),
      };
    }
    if (type) where.type = type;
    return this.prisma.holiday.findMany({ where, orderBy: { date: 'asc' } });
  }

  async isBusinessDay(date: Date): Promise<boolean> {
    const dow = date.getDay();
    if (dow === 0 || dow === 6) return false;
    const holiday = await this.prisma.holiday.findFirst({
      where: {
        date: { gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
                lte: new Date(date.getFullYear(), date.getMonth(), date.getDate()) },
        type: { in: ['NACIONAL', 'ESTADUAL'] as any },
      },
    });
    return !holiday;
  }

  async countBusinessDays(from: Date, to: Date): Promise<number> {
    // Contar dias uteis entre duas datas
    const holidays = await this.prisma.holiday.findMany({
      where: {
        date: { gte: from, lte: to },
        type: { in: ['NACIONAL'] as any },
      },
      select: { date: true },
    });
    const holidayDates = new Set(holidays.map(h => h.date.toISOString().slice(0,10)));
    let count = 0;
    const cursor = new Date(from);
    while (cursor <= to) {
      const dow = cursor.getDay();
      const ds = cursor.toISOString().slice(0,10);
      if (dow !== 0 && dow !== 6 && !holidayDates.has(ds)) count++;
      cursor.setDate(cursor.getDate() + 1);
    }
    return count;
  }

  async importFromBrasilApi(year: number) {
    const url = `https://brasilapi.com.br/api/feriados/v1/${year}`;
    try {
      const { data } = await firstValueFrom(this.http.get(url));
      let imported = 0, skipped = 0;
      for (const f of data) {
        try {
          await this.prisma.holiday.upsert({
            where: { date_type_state_city: {
              date: new Date(f.date + 'T12:00:00Z'),
              type: 'NACIONAL',
              state: '',
              city: '',
            }},
            update: { name: f.name },
            create: {
              date: new Date(f.date + 'T12:00:00Z'),
              name: f.name,
              type: 'NACIONAL',
              recurring: true,
            },
          });
          imported++;
        } catch { skipped++; }
      }
      return { year, imported, skipped };
    } catch (e) {
      throw new Error('Erro ao importar da BrasilAPI: ' + e.message);
    }
  }

  async create(dto: any) {
    return this.prisma.holiday.create({
      data: {
        date: new Date(dto.date + 'T12:00:00Z'),
        name: dto.name,
        type: dto.type,
        state: dto.state || null,
        city: dto.city || null,
        recurring: dto.recurring ?? false,
        hebrewName: dto.hebrewName || null,
        hebrewDate: dto.hebrewDate || null,
        erevStart: dto.erevStart ?? false,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.holiday.delete({ where: { id } });
  }
}
