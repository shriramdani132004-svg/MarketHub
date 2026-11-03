import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import {
  AdminInventoryQueryDto,
  AdminOrderQueryDto,
  AdminPaymentQueryDto,
  AdminProductQueryDto,
  AdminSellerActionDto,
  AdminSellerQueryDto,
  AdminUserQueryDto,
  AdminUserStatusDto,
  ModerateProductDto,
} from './dto/admin.dto';
import { Roles } from '../common/decorators/auth.decorators';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';

@ApiTags('Administration')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.adminService.dashboard();
  }

  @Get('sellers')
  sellers(@Query() query: AdminSellerQueryDto) {
    return this.adminService.listSellers(query);
  }

  @Patch('sellers/:id/approve')
  approve(@Param('id') id: string, @Body() dto: AdminSellerActionDto) {
    return this.adminService.approveSeller(id, dto);
  }

  @Patch('sellers/:id/reject')
  reject(@Param('id') id: string, @Body() dto: AdminSellerActionDto) {
    return this.adminService.rejectSeller(id, dto);
  }

  @Patch('sellers/:id/suspend')
  suspend(@Param('id') id: string, @Body() dto: AdminSellerActionDto) {
    return this.adminService.suspendSeller(id, dto);
  }

  @Patch('sellers/:id/reactivate')
  reactivate(@Param('id') id: string) {
    return this.adminService.reactivateSeller(id);
  }

  @Get('orders')
  orders(@Query() query: AdminOrderQueryDto) {
    return this.adminService.listOrders(query);
  }

  @Get('orders/:id')
  order(@Param('id') id: string) {
    return this.adminService.getOrder(id);
  }

  @Post('orders/:id/cancel')
  @HttpCode(200)
  cancelOrder(@Param('id') id: string) {
    return this.adminService.cancelOrder(id);
  }

  @Get('products')
  products(@Query() query: AdminProductQueryDto) {
    return this.adminService.listProducts(query);
  }

  @Patch('products/:id/status')
  moderateProduct(@Param('id') id: string, @Body() dto: ModerateProductDto) {
    return this.adminService.moderateProduct(id, dto);
  }

  @Get('payments')
  payments(@Query() query: AdminPaymentQueryDto) {
    return this.adminService.listPayments(query);
  }

  @Get('inventory')
  inventory(@Query() query: AdminInventoryQueryDto) {
    return this.adminService.listInventory(query);
  }

  @Get('users')
  users(@Query() query: AdminUserQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id/status')
  setUserStatus(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdminUserStatusDto,
  ) {
    return this.adminService.setUserStatus(admin.id, id, dto);
  }
}
