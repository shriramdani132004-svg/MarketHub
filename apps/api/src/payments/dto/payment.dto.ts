import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class SimulatePaymentDto {
  @ApiProperty({ enum: ['SUCCESS', 'FAILURE'] })
  @IsIn(['SUCCESS', 'FAILURE'])
  outcome!: 'SUCCESS' | 'FAILURE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;
}
