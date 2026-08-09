// D:\Projetos\Ledgr\apps\api\src\modules\assets\controllers\assets.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, UseGuards, UseInterceptors, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard }        from '../../../auth/guards/jwt.guard';
import { CompanyInterceptor }  from '../../../multi-company/company.interceptor';
import { SidebarResourceGuard } from '../../../auth/guards/sidebar-resource.guard';
import { RequireResourceAccess } from '../../../auth/decorators/require-resource-access.decorator';
import { AssetsService }       from '../services/assets.service';
import { DepreciationService } from '../services/depreciation.service';
import { MaintenanceService }  from '../services/maintenance.service';
import { ImprovementService }  from '../services/improvement.service';
import { RetrofitService }     from '../services/retrofit.service';
import { AppraisalService }    from '../services/appraisal.service';
import { AssetHistoryService }  from '../services/history.service';
import { AssetImportService }   from '../services/asset-import.service';
import {
  CreateAssetDto,
  UpdateAssetDto,
  FilterAssetDto,
  WriteOffAssetDto,
  CreateMaintenanceDto,
  UpdateMaintenanceDto,
  CreateImprovementDto,
  CreateRetrofitProjectDto,
  UpdateRetrofitPhaseDto,
  CreateAppraisalDto,
} from '../dto/create-asset.dto';

@UseGuards(JwtAuthGuard, SidebarResourceGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('assets')
export class AssetsController {
  constructor(
    private readonly assetsService:       AssetsService,
    private readonly depreciationService: DepreciationService,
    private readonly maintenanceService:  MaintenanceService,
    private readonly improvementService:  ImprovementService,
    private readonly retrofitService:     RetrofitService,
    private readonly appraisalService:    AppraisalService,
    private readonly historyService:      AssetHistoryService,
    private readonly importService:       AssetImportService,
  ) {}

  @RequireResourceAccess('fixed-assets', 'VIEW')
  @Get()
  findAll(@Req() req: any, @Query() filters: FilterAssetDto) {
    return this.assetsService.findAll(req.companyId, filters);
  }

  @RequireResourceAccess('fixed-assets', 'EDIT')
  @Post()
  create(@Req() req: any, @Body() dto: CreateAssetDto) {
    return this.assetsService.create(req.companyId, dto, req.user?.id);
  }

  @RequireResourceAccess('asset-maintenances', 'VIEW')
  @Get('maintenances')
  findAllMaintenances(@Req() req: any) {
    return this.maintenanceService.findAll(req.companyId);
  }

  @RequireResourceAccess('asset-maintenances', 'EDIT')
  @Post('maintenances')
  createMaintenance(@Req() req: any, @Body() dto: CreateMaintenanceDto) {
    return this.maintenanceService.create(req.companyId, dto, req.user?.id);
  }

  @RequireResourceAccess('asset-maintenances', 'VIEW')
  @Get('maintenances/overdue')
  findOverdueMaintenance(@Req() req: any) {
    return this.maintenanceService.findOverdue(req.companyId);
  }

  @RequireResourceAccess('fixed-assets', 'EDIT')
  @Post('depreciation/reprocess')
  @HttpCode(HttpStatus.OK)
  reprocessDepreciation(@Req() req: any, @Body('period') period: string) {
    return this.depreciationService.reprocessPeriod(req.companyId, period);
  }

  @RequireResourceAccess('fixed-assets', 'EDIT')
  @Post('depreciation/backfill')
  @HttpCode(HttpStatus.OK)
  backfillAll(@Req() req: any) {
    return this.depreciationService.backfillAll(req.companyId);
  }

  @RequireResourceAccess('fixed-assets', 'EDIT')
  @Post(':id/depreciation/backfill')
  @HttpCode(HttpStatus.OK)
  backfillAsset(@Req() req: any, @Param('id') id: string, @Body() body: { dateFrom?: string; dateTo?: string }) {
    return this.depreciationService.backfillAsset(req.companyId, id, body?.dateFrom, body?.dateTo);
  }

  @RequireResourceAccess('fixed-assets', 'EDIT')
  @Post('depreciation/run')
  @HttpCode(HttpStatus.OK)
  runDepreciation(@Req() req: any, @Body('period') period: string) {
    return this.depreciationService.processCompany(req.companyId, period);
  }

  @RequireResourceAccess('fixed-assets', 'EDIT')
  @Post('improvements')
  createImprovement(@Req() req: any, @Body() dto: CreateImprovementDto) {
    return this.improvementService.create(req.companyId, dto, req.user?.id);
  }

  @RequireResourceAccess('fixed-assets', 'EDIT')
  @Post('retrofits')
  createRetrofit(@Req() req: any, @Body() dto: CreateRetrofitProjectDto) {
    return this.retrofitService.create(req.companyId, dto, req.user?.id);
  }

  @RequireResourceAccess('fixed-assets', 'EDIT')
  @Post('appraisals')
  createAppraisal(@Req() req: any, @Body() dto: CreateAppraisalDto) {
    return this.appraisalService.create(req.companyId, dto, req.user?.id);
  }

  @RequireResourceAccess('fixed-assets', 'EDIT')
  @Post('depreciation-journal')
  generateDepreciationJournal(@Req() req: any, @Body() body: { yearMonth: string }) {
    return this.depreciationService.generateDepreciationJournalEntries(req.companyId, body.yearMonth, req.user?.id);
  }

  @RequireResourceAccess('fixed-assets', 'VIEW')
  @Get('depreciation-monthly-totals')
  getDepreciationMonthlyTotals(@Req() req: any, @Query('year') year: string) {
    return this.assetsService.getDepreciationMonthlyTotals(req.companyId, parseInt(year));
  }

  @RequireResourceAccess('fixed-assets', 'VIEW')
  @Get('depreciation-report')
  getDepreciationReport(@Req() req: any, @Query('yearFrom') yearFrom?: string, @Query('yearTo') yearTo?: string) {
    return this.assetsService.getDepreciationReport(req.companyId, yearFrom ? parseInt(yearFrom) : undefined, yearTo ? parseInt(yearTo) : undefined);
  }

  @RequireResourceAccess('fixed-assets', 'VIEW')
  @Get('properties')
  findProperties(@Req() req: any) {
    return this.assetsService.findProperties(req.companyId);
  }

  @RequireResourceAccess('fixed-assets', 'VIEW')
  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.assetsService.findOne(req.companyId, id);
  }

  @RequireResourceAccess('fixed-assets', 'EDIT')
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.assetsService.update(req.companyId, id, dto);
  }

  @RequireResourceAccess('fixed-assets', 'EDIT')
  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  activate(@Req() req: any, @Param('id') id: string) {
    return this.assetsService.activate(req.companyId, id, req.user?.id);
  }

  @RequireResourceAccess('fixed-assets', 'EDIT')
  @Post(':id/write-off')
  @HttpCode(HttpStatus.OK)
  writeOff(@Req() req: any, @Param('id') id: string, @Body() dto: WriteOffAssetDto) {
    return this.assetsService.writeOff(req.companyId, id, dto, req.user?.id);
  }

  @RequireResourceAccess('fixed-assets', 'VIEW')
  @Get(':id/depreciation')
  getDepreciationHistory(@Req() req: any, @Param('id') id: string) {
    return this.depreciationService.getAssetHistory(req.companyId, id);
  }

  @RequireResourceAccess('fixed-assets', 'VIEW')
  @Get(':id/depreciation/projection')
  getDepreciationProjection(@Req() req: any, @Param('id') id: string) {
    return this.assetsService.getDepreciationProjection(req.companyId, id);
  }

  @RequireResourceAccess('asset-maintenances', 'VIEW')
  @Get(':assetId/maintenances')
  findMaintenanceByAsset(@Req() req: any, @Param('assetId') assetId: string) {
    return this.maintenanceService.findAll(req.companyId, assetId);
  }

  @RequireResourceAccess('asset-maintenances', 'EDIT')
  @Patch('maintenances/:id')
  updateMaintenance(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateMaintenanceDto) {
    return this.maintenanceService.update(req.companyId, id, dto, req.user?.id);
  }

  @RequireResourceAccess('fixed-assets', 'EDIT')
  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  deactivate(@Req() req: any, @Param('id') id: string) {
    return this.assetsService.deactivate(req.companyId, id, req.user?.id);
  }

  @RequireResourceAccess('fixed-assets', 'EDIT')
  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  reactivate(@Req() req: any, @Param('id') id: string) {
    return this.assetsService.reactivate(req.companyId, id, req.user?.id);
  }

  @RequireResourceAccess('fixed-assets', 'DELETE')
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.assetsService.softDelete(req.companyId, id, req.user?.id);
  }

  @RequireResourceAccess('asset-maintenances', 'DELETE')
  @Delete('maintenances/:id')
  removeMaintenance(@Req() req: any, @Param('id') id: string) {
    return this.maintenanceService.remove(req.companyId, id);
  }

  @RequireResourceAccess('fixed-assets', 'VIEW')
  @Get(':assetId/improvements')
  findImprovementsByAsset(@Req() req: any, @Param('assetId') assetId: string) {
    return this.improvementService.findAll(req.companyId, assetId);
  }

  @RequireResourceAccess('fixed-assets', 'EDIT')
  @Post('improvements/:id/capitalize')
  @HttpCode(HttpStatus.OK)
  capitalizeImprovement(@Req() req: any, @Param('id') id: string) {
    return this.improvementService.capitalize(req.companyId, id, req.user?.id);
  }

  @RequireResourceAccess('fixed-assets', 'VIEW')
  @Get(':assetId/retrofits')
  findRetrofitsByAsset(@Req() req: any, @Param('assetId') assetId: string) {
    return this.retrofitService.findAll(req.companyId, assetId);
  }

  @RequireResourceAccess('fixed-assets', 'EDIT')
  @Patch('retrofits/:projectId/phases/:phaseId')
  updateRetrofitPhase(@Req() req: any, @Param('projectId') projectId: string, @Param('phaseId') phaseId: string, @Body() dto: UpdateRetrofitPhaseDto) {
    return this.retrofitService.updatePhase(req.companyId, projectId, phaseId, dto);
  }

  @RequireResourceAccess('fixed-assets', 'EDIT')
  @Post('retrofits/:id/complete')
  @HttpCode(HttpStatus.OK)
  completeRetrofit(@Req() req: any, @Param('id') id: string) {
    return this.retrofitService.complete(req.companyId, id, req.user?.id);
  }

  @RequireResourceAccess('fixed-assets', 'VIEW')
  @Get(':assetId/appraisals')
  findAppraisalsByAsset(@Req() req: any, @Param('assetId') assetId: string) {
    return this.appraisalService.findAll(req.companyId, assetId);
  }

  @RequireResourceAccess('fixed-assets', 'VIEW')
  @Post('import/preview')
  @HttpCode(HttpStatus.OK)
  async previewImport(@Req() req: any, @Body('content') content: string) {
    const preview = this.importService.parseFile(content);
    const duplicates = await this.importService.checkDuplicates(req.companyId, preview.rows);
    return { ...preview, duplicates };
  }

  @RequireResourceAccess('fixed-assets', 'EDIT')
  @Post('import')
  @HttpCode(HttpStatus.OK)
  async bulkImport(@Req() req: any, @Body() body: { content: string; duplicateAction: 'overwrite' | 'ignore' }) {
    const preview = this.importService.parseFile(body.content);
    const duplicates = await this.importService.checkDuplicates(req.companyId, preview.rows);
    return this.importService.importRows(req.companyId, preview.rows, duplicates, body.duplicateAction, req.user?.id);
  }

  @RequireResourceAccess('fixed-assets', 'VIEW')
  @Get(':assetId/history')
  findHistory(@Req() req: any, @Param('assetId') assetId: string) {
    return this.historyService.findByAsset(req.companyId, assetId);
  }
}
