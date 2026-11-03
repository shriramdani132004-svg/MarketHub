import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminCategoriesController } from './admin-categories.controller';
import { AdminService } from './admin.service';
import { OrdersModule } from '../orders/orders.module';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [OrdersModule, CategoriesModule],
  controllers: [AdminController, AdminCategoriesController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
