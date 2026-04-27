import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { AuditService } from './audit.service';

@Controller()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // @EventPattern listens exactly for the event name sent by auditClient.emit
  @EventPattern('user_updated')
  async handleUserUpdated(@Payload() data: any) {
    return this.auditService.register(data);
  }

  @EventPattern('user_deleted')
  async handleUserDeleted(@Payload() data: any) {
    return this.auditService.register(data);
  }

  // Responds to IAM request to list logs on the Frontend screen
  @MessagePattern('get_audit_logs')
  async handleGetLogs() {
    return await this.auditService.findAll();
  }
}