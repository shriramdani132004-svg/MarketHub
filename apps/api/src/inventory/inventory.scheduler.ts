import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InventoryService } from './inventory.service';

@Injectable()
export class InventoryScheduler {
  private readonly logger = new Logger(InventoryScheduler.name);

  constructor(private readonly inventoryService: InventoryService) {}

  @Cron('*/2 * * * *')
  async expireReservations(): Promise<void> {
    try {
      await this.inventoryService.expireOverdueReservations(20);
    } catch (error) {
      this.logger.warn(
        `Scheduled reservation cleanup failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async closeStaleCarts(): Promise<void> {
    try {
      await this.inventoryService.releaseStaleCarts();
    } catch (error) {
      this.logger.warn(
        `Scheduled cart cleanup failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }
}

