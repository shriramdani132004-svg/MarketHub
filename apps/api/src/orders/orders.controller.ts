import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { OrdersService } from './orders.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Roles } from '../common/decorators/auth.decorators';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';

class OrderQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn([
    'PENDING_PAYMENT',
    'PAID',
    'PROCESSING',
    'PARTIALLY_SHIPPED',
    'SHIPPED',
    'PARTIALLY_DELIVERED',
    'DELIVERED',
    'CANCELLED',
  ])
  status?: string;
}

@ApiTags('Customer Orders')
@ApiBearerAuth()
@Roles('CUSTOMER')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('me')
  listMine(@CurrentUser() user: AuthUser, @Query() query: OrderQueryDto) {
    return this.ordersService.listMine(
      user.id,
      query.page,
      query.pageSize,
      query.status,
    );
  }

  @Get(':id')
  getMine(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.getMine(user.id, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.cancel(user.id, id);
  }
}
