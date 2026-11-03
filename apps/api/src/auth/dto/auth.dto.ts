import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const PASSWORD_RULE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,128}$/;

export class RegisterDto {
  @ApiProperty({ example: 'Aarav Mehta' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'aarav@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'StrongPass123' })
  @IsString()
  @Matches(PASSWORD_RULE, {
    message:
      'Password must be 10-128 characters and include upper case, lower case and a number',
  })
  password!: string;

  @ApiPropertyOptional({ example: '+91 98765 43210' })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  phone?: string;
}

export class SellerApplyDto extends RegisterDto {
  @ApiProperty({ example: 'Nimbus Audio' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  storeName!: string;

  @ApiPropertyOptional({ example: 'nimbus-audio' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'storeSlug may only contain lowercase letters, numbers and hyphens',
  })
  @MaxLength(60)
  storeSlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 'support@nimbus.example' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  businessContact?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'aarav@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'StrongPass123' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class BootstrapAdminDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @Matches(PASSWORD_RULE, {
    message:
      'Password must be 10-128 characters and include upper case, lower case and a number',
  })
  password!: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(24)
  phone?: string;
}
