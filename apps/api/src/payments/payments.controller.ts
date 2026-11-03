import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { SimulatePaymentDto } from './dto/payment.dto';
import { Roles } from '../common/decorators/auth.decorators';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';

@ApiTags('Payments')
@ApiBearerAuth()
@Roles('CUSTOMER')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.paymentsService.get(user.id, id);
  }

  @Get(':id/events')
  events(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.paymentsService.events(user.id, id);
  }

  @Post(':id/simulate')
  @HttpCode(200)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  simulate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SimulatePaymentDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.paymentsService.simulate(user.id, id, dto, key);
  }
}
