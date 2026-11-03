import { Module } from '@nestjs/common';
import { SellersService } from './sellers.service';
import { SellerProductsService } from './seller-products.service';
import { PublicSellersController } from './public-sellers.controller';
import {
  SellerController,
  SellerProductsController,
} from './sellers.controller';

@Module({
  controllers: [SellerController, SellerProductsController, PublicSellersController],
  providers: [SellersService, SellerProductsService],
  exports: [SellersService, SellerProductsService],
})
export class SellersModule {}
