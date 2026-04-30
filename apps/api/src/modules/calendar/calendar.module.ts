import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HolidayService } from './holiday.service';
import { HolidayController } from './holiday.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, HttpModule],
  controllers: [HolidayController],
  providers: [HolidayService],
  exports: [HolidayService],
})
export class CalendarModule {}
