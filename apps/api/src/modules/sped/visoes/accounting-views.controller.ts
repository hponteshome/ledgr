// apps/api/src/modules/sped/visoes/accounting-views.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AccountingViewsService } from './accounting-views.service';
import { JwtAuthGuard } from '../../../auth/guards/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('sped/visoes')
export class AccountingViewsController {
  constructor(private readonly svc: AccountingViewsService) {}

  // ── Codigos RFB ──────────────────────────────────────────────────────────
  @Post('rfb-codes/import')
  importRfbCodes(@Body() body: { codes: any[] }) {
    return this.svc.importRfbCodes(body.codes);
  }

  @Get('rfb-codes')
  findRfbCodes(
    @Query('leiaute') leiaute: string,
    @Query('anoBase') anoBase: string,
    @Query('tipo') tipo?: string,
  ) {
    return this.svc.findRfbCodes(Number(leiaute), Number(anoBase), tipo);
  }

  @Get('rfb-codes/leiautes')
  findRfbLeiauteYears() {
    return this.svc.findRfbLeiauteYears();
  }

  // ── Visoes Contabeis ─────────────────────────────────────────────────────
  @Get('views')
  findAllViews(@Req() req: any) {
    return this.svc.findAllViews(req.companyId);
  }

  @Post('views')
  createView(@Req() req: any, @Body() dto: any) {
    return this.svc.createView(req.companyId, dto);
  }

  @Delete('views/:id')
  deleteView(@Param('id') id: string) {
    return this.svc.deleteView(id);
  }

  // ── Mapeamentos ──────────────────────────────────────────────────────────
  @Get('views/:id/mappings')
  findMappings(@Param('id') viewId: string) {
    return this.svc.findMappings(viewId);
  }

        @Get('views/:id/mappings/grouped')
        findMappingsGrouped(@Param('id') viewId: string) {
          return this.svc.findMappingsGrouped(viewId);
        }


  @Put('views/:id/mappings/:accountId')
  upsertMapping(
    @Param('id') viewId: string,
    @Param('accountId') accountId: string,
    @Body() body: { aglutinationCode: string },
  ) {
    return this.svc.upsertMapping(viewId, accountId, body.aglutinationCode);
  }

  @Delete('views/:id/mappings/:accountId')
  deleteMapping(@Param('id') viewId: string, @Param('accountId') accountId: string) {
    return this.svc.deleteMapping(viewId, accountId);
  }

  @Post('views/:id/mappings/bulk')
  bulkUpsertMappings(
    @Param('id') viewId: string,
    @Body() body: { mappings: { accountId: string; aglutinationCode: string }[] },
  ) {
    return this.svc.bulkUpsertMappings(viewId, body.mappings);
  }

  @Post('views/:id/auto-match')
  autoMatch(
    @Param('id') viewId: string,
    @Req() req: any,
    @Body() body: { leiaute: number; anoBase: number },
  ) {
    return this.svc.autoMatch(viewId, req.companyId, body.leiaute, body.anoBase);
  }

  @Post('views/:id/clone-previous-year')
  clonePreviousYear(@Param('id') viewId: string) {
    return this.svc.cloneFromPreviousYear(viewId);
  }
}
