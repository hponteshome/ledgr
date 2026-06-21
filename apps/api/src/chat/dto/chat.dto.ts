import { IsString, IsOptional, IsUUID, IsIn } from 'class-validator';

export class CreateConversationDto {
  @IsIn(['DIRECT', 'GROUP'])
  type: 'DIRECT' | 'GROUP';

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  // Para DIRECT: um userId. Para GROUP: array de userIds
  @IsUUID('all', { each: true })
  participantIds: string[];
}

export class SendMessageDto {
  @IsOptional()
  @IsString()
  body?: string;

  @IsIn(['TEXT', 'FILE', 'SYSTEM'])
  @IsOptional()
  type?: 'TEXT' | 'FILE' | 'SYSTEM';

  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @IsOptional()
  @IsIn(['NFE', 'OBLIGATION', 'ECD', 'COMPANY'])
  contextType?: string;

  @IsOptional()
  @IsUUID()
  contextId?: string;

  @IsOptional()
  @IsString()
  contextLabel?: string;
}

export class UpdateConversationDto {
  @IsOptional()
  @IsString()
  name?: string;
}
