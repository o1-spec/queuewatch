import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';
import { CorrelationService } from './correlation.service';
import { RecurringIncidentsService } from './recurring-incidents.service';
import { RunbooksService } from './runbooks.service';
import { DbModule } from '../db/db.module';

@Module({
  imports: [ConfigModule, DbModule],
  controllers: [CopilotController],
  providers: [
    CopilotService,
    CorrelationService,
    RecurringIncidentsService,
    RunbooksService,
  ],
  exports: [
    CopilotService,
    CorrelationService,
    RecurringIncidentsService,
    RunbooksService,
  ],
})
export class CopilotModule {}
