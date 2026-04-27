import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RfbController } from './rfb-client.controller';
import { RfbClientService } from './rfb-client.service';


@Module({
  imports: [HttpModule],
  controllers: [RfbController],
  providers: [
    RfbClientService,
        {
      provide: 'RFB_SERVICE',
      useClass:  RfbClientService,
    },
  ],
  exports: [RfbClientService],
})
export class RfbModule {}