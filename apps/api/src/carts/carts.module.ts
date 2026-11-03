import { Module } from '@nestjs/common';
import { CartController } from './carts.controller';
import { CartService } from './carts.service';

@Module({
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartsModule {}
