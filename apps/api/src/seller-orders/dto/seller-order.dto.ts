import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class SellerOrderQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;
}

export class UpdateSellerOrderStatusDto {
  @ApiPropertyOptional({
    enum: ['PROCESSING', 'SHIPPED', 'DELIVERED'],
  })
  @IsIn(['PROCESSING', 'SHIPPED', 'DELIVERED'])
  status!: 'PROCESSING' | 'SHIPPED' | 'DELIVERED';

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @MaxLength(120)
  trackingReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  trackingUrl?: string;
}
