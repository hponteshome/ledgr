import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService, AuditFilter } from './audit.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(@Query() query: any) {
    const filters: AuditFilter = {
      actorId:  query.actorId  || undefined,
      action:   query.action   || undefined,
      targetId: query.targetId || undefined,
      dateFrom: query.dateFrom || undefined,
      dateTo:   query.dateTo   || undefined,
      page:     query.page  ? parseInt(query.page)  : 1,
      limit:    query.limit ? parseInt(query.limit) : 50,
    };
    return this.auditService.findAll(filters);
  }
}
