import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CheckoutDto {
  @ApiProperty()
  @IsString()
  addressId!: string;

  @ApiPropertyOptional({ description: 'Optional idempotency key (or send Idempotency-Key header)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;
}
