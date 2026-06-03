import { Module } from '@nestjs/common';
import { EscalationController } from './escalation.controller';
import { DbModule } from '../db/db.module';

@Module({
  imports: [DbModule],
  controllers: [EscalationController],
  exports: [],
})
export class EscalationModule {}
