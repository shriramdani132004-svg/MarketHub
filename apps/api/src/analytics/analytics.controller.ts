import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from '../admin/dto/admin.dto';
import { Roles } from '../common/decorators/auth.decorators';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Roles('CUSTOMER')
  @Get('customer')
  customer(@CurrentUser() user: AuthUser) {
    return this.analyticsService.customer(user.id);
  }

  @Roles('SELLER')
  @Get('seller')
  seller(@CurrentUser() user: AuthUser) {
    return this.analyticsService.seller(user.id);
  }

  @Roles('ADMIN')
  @Get('admin')
  admin(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.admin(query.days);
  }

  @Roles('SELLER', 'ADMIN')
  @Get('products')
  products(@CurrentUser() user: AuthUser, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.products(user.id, user.role, query.days);
  }

  @Roles('SELLER', 'ADMIN')
  @Get('sales')
  sales(@CurrentUser() user: AuthUser, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.sales(user.id, user.role, query.days);
  }
}
