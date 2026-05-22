// apps/api/src/modules/hr/employee.controller.ts
import { Controller, Post, Get, UseGuards, UseInterceptors, Req, UploadedFile, Body, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyInterceptor } from '@/multi-company/company.interceptor';
import { EmployeePdfParserService } from './services/employee-pdf-parser.service';
import { EmployeeService } from './services/employee.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('hr/employees')
export class EmployeeController {
  constructor(
    private readonly parser:  EmployeePdfParserService,
    private readonly service: EmployeeService,
  ) {}

  @Post('parse-pdf')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }))
  async parsePdf(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo PDF nao enviado.');
    return this.parser.parse(file.buffer);
  }

  @Post('import')
  async importEmployee(@Req() req: any, @Body() body: any) {
    return this.service.importFromParsed(req.companyId, body, req.user.id);
  }

  @Post('import-batch')
  async importBatch(@Req() req: any, @Body() body: { employees: any[] }) {
    const results = [];
    for (const emp of body.employees) {
      try {
        const r = await this.service.importFromParsed(req.companyId, emp, req.user.id);
        results.push({ success: true, name: emp.fullName, ...r });
      } catch (e: any) {
        results.push({ success: false, name: emp.fullName, error: e.message });
      }
    }
    return results;
  }

  @Get()
  list(@Req() req: any) {
    return this.service.listByCompany(req.companyId);
  }
}