// apps/api/src/modules/corporate/transfers/dto/create-transfer.dto.ts
import {
  IsString, IsEnum, IsOptional, IsNumber,
  IsDateString, IsUUID, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ShareType, ShareEntryType } from '../../shareholders/dto/create-shareholder.dto';

export enum TransferReason {
  COMPRA_VENDA = 'COMPRA_VENDA',
  DOACAO = 'DOACAO',
  HERANCA = 'HERANCA',
  INTEGRALIZACAO = 'INTEGRALIZACAO',
  REDUCAO_CAPITAL = 'REDUCAO_CAPITAL',
  BONIFICACAO = 'BONIFICACAO',
  CISAO = 'CISAO',
  INCORPORACAO = 'INCORPORACAO',
  OUTRO = 'OUTRO',
}

export class CreateTransferDto {
  @IsEnum(ShareEntryType)
  entryType: ShareEntryType;

  @IsUUID()
  fromRecordId: string;

  @IsUUID()
  toRecordId: string;

  @IsEnum(ShareType)
  shareType: ShareType;

  @IsString()
  @IsOptional()
  series?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  nominalValue: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  transferValue: number;

  @IsNumber()
  @IsOptional()
  shareNumberFrom?: number;

  @IsNumber()
  @IsOptional()
  shareNumberTo?: number;

  @IsDateString()
  transferDate: string;

  @IsEnum(TransferReason)
  reason: TransferReason;

  @IsString()
  @IsOptional()
  instrumentType?: string;

  @IsDateString()
  @IsOptional()
  instrumentDate?: string;

  @IsString()
  @IsOptional()
  notaryOffice?: string;

  @IsString()
  @IsOptional()
  bookNumber?: string;

  @IsString()
  @IsOptional()
  pageNumber?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  @IsOptional()
  bookId?: string;
}