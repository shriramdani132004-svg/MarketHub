import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
const PRODUCT_STATUSES = ['DRAFT', 'PUBLISHED', 'OUT_OF_STOCK', 'ARCHIVED'] as const;

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  description!: string;

  @ApiProperty()
  @IsString()
  categoryId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[A-Za-z0-9._-]{3,40}$/, {
    message: 'SKU must be 3-40 letters, numbers, dots, dashes or underscores',
  })
  sku!: string;

  @ApiProperty({ example: '1299.00' })
  @Transform(({ value }) => String(value))
  @IsString()
  @Matches(MONEY_PATTERN, { message: 'price must be a positive amount' })
  price!: string;

  @ApiPropertyOptional({ example: '1799.00' })
  @IsOptional()
  @Transform(({ value }) => (value === null || value === '' ? undefined : String(value)))
  @IsString()
  @Matches(MONEY_PATTERN, { message: 'compareAtPrice must be a positive amount' })
  compareAtPrice?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stockOnHand?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'PUBLISHED'], default: 'DRAFT' })
  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED'])
  status?: 'DRAFT' | 'PUBLISHED';
}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9._-]{3,40}$/, {
    message: 'SKU must be 3-40 letters, numbers, dots, dashes or underscores',
  })
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === null ? undefined : String(value)))
  @IsString()
  @Matches(MONEY_PATTERN)
  price?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === null || value === '' ? undefined : String(value)))
  @IsString()
  @Matches(MONEY_PATTERN)
  compareAtPrice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;

  @ApiPropertyOptional({ enum: PRODUCT_STATUSES })
  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: (typeof PRODUCT_STATUSES)[number];
}

export class InventoryDto {
  @ApiProperty({ description: 'Absolute stock on hand after this adjustment' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stockOnHand!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class SellerProductQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ enum: PRODUCT_STATUSES })
  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: (typeof PRODUCT_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  lowStock?: boolean;
}

export class StoreUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  storeName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  businessContact?: string;
}