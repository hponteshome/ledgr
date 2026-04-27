// ============================================================
// LEDGR — src/modules/finance/dto/update-agenda-event.dto.ts
// ============================================================

import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsBoolean, IsDateString } from 'class-validator';
import { CreateAgendaEventDto } from './create.agenda.dto';

export class UpdateAgendaEventDto extends PartialType(CreateAgendaEventDto) {
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsDateString()
  paidAt?: string;
}