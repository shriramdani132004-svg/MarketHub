import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SellerProductsService } from './seller-products.service';
import { SellersService } from './sellers.service';
import {
  CreateProductDto,
  InventoryDto,
  SellerProductQueryDto,
  StoreUpdateDto,
  UpdateProductDto,
} from './dto/seller.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/auth.decorators';
import type { AuthUser } from '../common/types/auth-user';

@ApiTags('Seller')
@ApiBearerAuth()
@Roles('SELLER')
@Controller('seller')
export class SellerController {
  constructor(private readonly sellersService: SellersService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: AuthUser) {
    return this.sellersService.getOwnProfile(user.id);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: StoreUpdateDto) {
    return this.sellersService.updateProfile(user.id, dto);
  }
}

@ApiTags('Seller Products')
@ApiBearerAuth()
@Roles('SELLER')
@Controller('seller/products')
export class SellerProductsController {
  constructor(private readonly sellerProductsService: SellerProductsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: SellerProductQueryDto) {
    return this.sellerProductsService.list(user.id, query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.sellerProductsService.create(user.id, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sellerProductsService.getOne(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.sellerProductsService.update(user.id, id, dto);
  }

  @Delete(':id')
  archive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sellerProductsService.archive(user.id, id);
  }

  @Patch(':id/inventory')
  inventory(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: InventoryDto,
  ) {
    return this.sellerProductsService.adjustInventory(user.id, id, dto);
  }
}
