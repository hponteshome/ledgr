// D:\Projetos\Ledgr\apps\api\src\modules\assets\controllers\assets.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, UseGuards, UseInterceptors, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard }        from '../../../auth/guards/jwt.guard';
import { CompanyInterceptor }  from '../../../multi-company/company.interceptor';
import { AssetsService }       from '../services/assets.service';
import { DepreciationService } from '../services/depreciation.service';
import { MaintenanceService }  from '../services/maintenance.service';
import { ImprovementService }  from '../services/improvement.service';
import { RetrofitService }     from '../services/retrofit.service';
import { AppraisalService }    from '../services/appraisal.service';
import { AssetHistoryService } from '../services/history.service';
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

@UseGuards(JwtAuthGuard)
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
  ) {}

  // ── Fixed Assets ─────────────────────────────────────────

  @Get()
  findAll(@Req() req: any, @Query() filters: FilterAssetDto) {
    return this.assetsService.findAll(req.companyId, filters);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateAssetDto) {
    return this.assetsService.create(req.companyId, dto, req.user?.id);
  }

  // ── Static routes BEFORE :id ──────────────────────────────

  @Get('maintenances')
  findAllMaintenances(@Req() req: any) {
    return this.maintenanceService.findAll(req.companyId);
  }

  @Get('maintenances/overdue')
  findOverdueMaintenance(@Req() req: any) {
    return this.maintenanceService.findOverdue(req.companyId);
  }
  @Post('depreciation/reprocess')
  @HttpCode(HttpStatus.OK)
  reprocessDepreciation(@Req() req: any, @Body('period') period: string) {
    return this.depreciationService.reprocessPeriod(req.companyId, period);
  }

  @Post('depreciation/run')
  @HttpCode(HttpStatus.OK)
  runDepreciation(@Req() req: any, @Body('period') period: string) {
    return this.depreciationService.processCompany(req.companyId, period);
  }

  @Post('improvements')
  createImprovement(@Req() req: any, @Body() dto: CreateImprovementDto) {
    return this.improvementService.create(req.companyId, dto, req.user?.id);
  }

  @Post('retrofits')
  createRetrofit(@Req() req: any, @Body() dto: CreateRetrofitProjectDto) {
    return this.retrofitService.create(req.companyId, dto, req.user?.id);
  }

  @Post('appraisals')
  createAppraisal(@Req() req: any, @Body() dto: CreateAppraisalDto) {
    return this.appraisalService.create(req.companyId, dto, req.user?.id);
  }

  // ── Dynamic :id routes ───────────────────────────────────

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.assetsService.findOne(req.companyId, id);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.assetsService.update(req.companyId, id, dto);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  activate(@Req() req: any, @Param('id') id: string) {
    return this.assetsService.activate(req.companyId, id, req.user?.id);
  }

  @Post(':id/write-off')
  @HttpCode(HttpStatus.OK)
  writeOff(@Req() req: any, @Param('id') id: string, @Body() dto: WriteOffAssetDto) {
    return this.assetsService.writeOff(req.companyId, id, dto, req.user?.id);
  }

  @Get(':id/depreciation')
  getDepreciationHistory(@Req() req: any, @Param('id') id: string) {
    return this.depreciationService.getAssetHistory(req.companyId, id);
  }

  @Get(':id/depreciation/projection')
  getDepreciationProjection(@Req() req: any, @Param('id') id: string) {
    return this.assetsService.getDepreciationProjection(req.companyId, id);
  }

  @Get(':assetId/maintenances')
  findMaintenanceByAsset(@Req() req: any, @Param('assetId') assetId: string) {
    return this.maintenanceService.findAll(req.companyId, assetId);
  }

  @Patch('maintenances/:id')
  updateMaintenance(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceDto,
  ) {
    return this.maintenanceService.update(req.companyId, id, dto, req.user?.id);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  deactivate(@Req() req: any, @Param('id') id: string) {
    return this.assetsService.deactivate(req.companyId, id, req.user?.id);
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  reactivate(@Req() req: any, @Param('id') id: string) {
    return this.assetsService.reactivate(req.companyId, id, req.user?.id);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.assetsService.softDelete(req.companyId, id, req.user?.id);
  }

  @Delete('maintenances/:id')
  removeMaintenance(@Req() req: any, @Param('id') id: string) {
    return this.maintenanceService.remove(req.companyId, id);
  }

  @Get(':assetId/improvements')
  findImprovementsByAsset(@Req() req: any, @Param('assetId') assetId: string) {
    return this.improvementService.findAll(req.companyId, assetId);
  }

  @Post('improvements/:id/capitalize')
  @HttpCode(HttpStatus.OK)
  capitalizeImprovement(@Req() req: any, @Param('id') id: string) {
    return this.improvementService.capitalize(req.companyId, id, req.user?.id);
  }

  @Get(':assetId/retrofits')
  findRetrofitsByAsset(@Req() req: any, @Param('assetId') assetId: string) {
    return this.retrofitService.findAll(req.companyId, assetId);
  }

  @Patch('retrofits/:projectId/phases/:phaseId')
  updateRetrofitPhase(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('phaseId')   phaseId: string,
    @Body() dto: UpdateRetrofitPhaseDto,
  ) {
    return this.retrofitService.updatePhase(req.companyId, projectId, phaseId, dto);
  }

  @Post('retrofits/:id/complete')
  @HttpCode(HttpStatus.OK)
  completeRetrofit(@Req() req: any, @Param('id') id: string) {
    return this.retrofitService.complete(req.companyId, id, req.user?.id);
  }

  @Get(':assetId/appraisals')
  findAppraisalsByAsset(@Req() req: any, @Param('assetId') assetId: string) {
    return this.appraisalService.findAll(req.companyId, assetId);
  }

  @Get(':assetId/history')
  findHistory(@Req() req: any, @Param('assetId') assetId: string) {
    return this.historyService.findByAsset(req.companyId, assetId);
  }
}


