import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { SellersModule } from '../sellers/sellers.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [SellersModule, AdminModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
