import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';
import { Public } from '../common/decorators/auth.decorators';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('live')
  live() {
    return {
      status: 'ok',
      service: 'markethub-api',
      time: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  async ready() {
    const dbReady = await this.prisma.isReady();
    if (!dbReady) {
      throw new ServiceUnavailableException('Database is not reachable');
    }
    return {
      status: 'ok',
      service: 'markethub-api',
      database: 'connected',
      time: new Date().toISOString(),
    };
  }
}
