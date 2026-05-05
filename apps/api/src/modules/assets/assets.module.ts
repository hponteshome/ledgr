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

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
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
  ],
  exports: [AssetsService, DepreciationService],
})
export class AssetsModule {}
