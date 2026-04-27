// ============================================
// LEDGR - src/modules/finance/dto/create-agenda-event.dto.ts
// ============================================

import {
    IsEnum,
    IsString,
    IsOptional,
    IsDateString,
    IsNumber,
    IsBoolean,
    IsUUID,
    Min,
} from 'class-validator';
import { AgendaEventType, AgendaColor } from '@prisma/client';

export class CreateAgendaEventDto {
    @IsEnum(AgendaEventType)
    eventType: AgendaEventType;

    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsEnum(AgendaColor)
    color: AgendaColor;

    @IsDateString()
    dueDate: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    amount?: number;

    @IsOptional()
    @IsBoolean()
    isPaid?: boolean;

    @IsOptional()
    @IsDateString()
    paidAt?: string;

    @IsOptional()
    @IsBoolean()
    isRecurring?: boolean;

    @IsOptional()
    @IsString()
    recurrenceRule?: string;

    @IsOptional()
    @IsUUID()
    parentEventId?: string;

    @IsOptional()
    @IsUUID()
    fiscalDocumentId?: string;

    @IsOptional()
    @IsUUID()
    apEntryId?: string;
}