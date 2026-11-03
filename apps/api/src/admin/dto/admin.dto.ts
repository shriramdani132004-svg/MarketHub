import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export const ADMIN_ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'PARTIALLY_SHIPPED',
  'SHIPPED',
  'PARTIALLY_DELIVERED',
  'DELIVERED',
  'CANCELLED',
] as const;

export class AdminListQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

export class AdminSellerQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'])
  status?: string;
}

export class AdminSellerActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AdminOrderQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsIn(ADMIN_ORDER_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED'])
  paymentStatus?: string;
}

export class AdminProductQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'OUT_OF_STOCK', 'ARCHIVED'])
  status?: string;

  @IsOptional()
  @IsString()
  sellerId?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  lowStock?: boolean;
}

export class ModerateProductDto {
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status!: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AdminPaymentQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED'])
  status?: string;
}

export class AdminInventoryQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsIn([
    'STOCK_ADDED',
    'STOCK_RESERVED',
    'STOCK_RELEASED',
    'SALE_CONFIRMED',
    'RESTOCKED',
    'ADJUSTMENT',
  ])
  movementType?: string;

  @IsOptional()
  @IsString()
  sellerId?: string;

  @IsOptional()
  @IsString()
  productId?: string;
}

export class AdminUserQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsIn(['CUSTOMER', 'SELLER', 'ADMIN'])
  role?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status?: string;
}

export class AdminUserStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status!: 'ACTIVE' | 'SUSPENDED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AnalyticsQueryDto {
  @ApiPropertyOptional({ default: 30, minimum: 7, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(90)
  days = 30;
}
