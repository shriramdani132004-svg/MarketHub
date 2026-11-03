import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SellersService } from './sellers.service';
import { Public } from '../common/decorators/auth.decorators';

@ApiTags('Stores')
@Controller('sellers')
export class PublicSellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Public()
  @Get()
  list() {
    return this.sellersService.listPublic();
  }

  @Public()
  @Get(':slug')
  store(@Param('slug') slug: string) {
    return this.sellersService.getPublicStore(slug);
  }
}
