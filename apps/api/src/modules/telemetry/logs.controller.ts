import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { DbService } from '../db/db.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LogEntry } from '@queuewatch/shared';

@ApiTags('Logs Observability')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('logs')
export class LogsController {
  constructor(private readonly dbService: DbService) {}

  @Get()
  @ApiOperation({ summary: 'Query ingested log events' })
  @ApiQuery({ name: 'queueName', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getLogs(
    @Query('queueName') queueName?: string,
    @Query('limit') limit?: number
  ) {
    const size = limit ? Number(limit) : 100;
    return this.dbService.getLogs(queueName, size);
  }

  @Post()
  @ApiOperation({ summary: 'Bulk save logs' })
  async saveLogs(@Body() logs: LogEntry[]) {
    for (const log of logs) {
      await this.dbService.saveLog({
        ...log,
        id: log.id || `log_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: log.timestamp || Date.now(),
      });
    }
    return { success: true, count: logs.length };
  }
}
