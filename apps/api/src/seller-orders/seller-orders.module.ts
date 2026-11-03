import { Module } from '@nestjs/common';
import { SellerOrdersController } from './seller-orders.controller';
import { SellerOrdersService } from './seller-orders.service';
import { SellersModule } from '../sellers/sellers.module';

@Module({
  imports: [SellersModule],
  controllers: [SellerOrdersController],
  providers: [SellerOrdersService],
  exports: [SellerOrdersService],
})
export class SellerOrdersModule {}
