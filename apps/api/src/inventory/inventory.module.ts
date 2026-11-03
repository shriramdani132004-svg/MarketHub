import { Module, Global } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryScheduler } from './inventory.scheduler';

@Global()
@Module({
  providers: [InventoryService, InventoryScheduler],
  exports: [InventoryService],
})
export class InventoryModule {}
