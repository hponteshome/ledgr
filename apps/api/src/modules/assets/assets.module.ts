// D:\Projetos\Ledgr\apps\api\src\modules\assets\assets.module.ts
import { Module }         from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule }   from '../../prisma/prisma.module';
import { AssetsController }    from './controllers/assets.controller';
import { AssetsService }       from './services/assets.service';
import { DepreciationService } from './services/depreciation.service';
import { MaintenanceService }  from './services/maintenance.service';
import { ImprovementService }  from './services/improvement.service';
import { RetrofitService }     from './services/retrofit.service';
import { AppraisalService }    from './services/appraisal.service';
import { AssetHistoryService } from './services/history.service';
import { AssetImportService }  from './services/asset-import.service';
import { SidebarPermissionsModule } from '../sidebar-permissions/sidebar-permissions.module';
import { SidebarResourceGuard } from '../../auth/guards/sidebar-resource.guard';

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
    SidebarPermissionsModule,
  ],
  controllers: [AssetsController],
  providers: [
    AssetsService,
    DepreciationService,
    MaintenanceService,
    ImprovementService,
    RetrofitService,
    AppraisalService,
    AssetHistoryService,
    AssetImportService,
    SidebarResourceGuard,
  ],
  exports: [AssetsService, DepreciationService],
})
export class AssetsModule {}
