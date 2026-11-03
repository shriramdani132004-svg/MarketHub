import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SellerOrdersService } from './seller-orders.service';
import {
  SellerOrderQueryDto,
  UpdateSellerOrderStatusDto,
} from './dto/seller-order.dto';
import { Roles } from '../common/decorators/auth.decorators';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';

@ApiTags('Seller Orders')
@ApiBearerAuth()
@Roles('SELLER')
@Controller('seller/orders')
export class SellerOrdersController {
  constructor(private readonly sellerOrdersService: SellerOrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: SellerOrderQueryDto) {
    return this.sellerOrdersService.list(user.id, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sellerOrdersService.getOne(user.id, id);
  }

  @Patch(':id/status')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSellerOrderStatusDto,
  ) {
    return this.sellerOrdersService.updateStatus(user.id, id, dto);
  }
}
