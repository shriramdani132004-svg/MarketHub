import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { ProductQueryDto, ReviewDto } from './dto/product.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Public, Roles } from '../common/decorators/auth.decorators';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  list(@Query() query: ProductQueryDto) {
    return this.productsService.list(query);
  }

  @Public()
  @Get(':id')
  get(@Param('id') id: string) {
    return this.productsService.getById(id);
  }

  @Public()
  @Get(':id/reviews')
  reviews(@Param('id') id: string, @Query() pagination: PaginationDto) {
    return this.productsService.listReviews(
      id,
      pagination.page,
      pagination.pageSize,
    );
  }

  @Roles('CUSTOMER')
  @ApiBearerAuth()
  @Post(':id/reviews')
  createReview(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReviewDto,
  ) {
    return this.productsService.createReview(id, user.id, dto);
  }
}
