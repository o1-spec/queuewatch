import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { DbService } from '../db/db.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LogEntry } from '@queuewatch/shared';
import { ProjectId } from '../auth/project-id.decorator';

@ApiTags('Logs Observability')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('logs')
export class LogsController {
  constructor(private readonly dbService: DbService) {}

  @Get()
  @ApiOperation({ summary: 'Query ingested log events with server-side filtering' })
  @ApiQuery({ name: 'queueName', required: false })
  @ApiQuery({ name: 'serviceName', required: false })
  @ApiQuery({ name: 'level', required: false })
  @ApiQuery({ name: 'traceId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getLogs(
    @ProjectId() projectId: string,
    @Query('queueName') queueName?: string,
    @Query('serviceName') serviceName?: string,
    @Query('level') level?: string,
    @Query('traceId') traceId?: string,
    @Query('limit') limit?: number
  ) {
    const size = limit ? Number(limit) : 150;
    let logs = await this.dbService.getLogs(queueName, size * 4, projectId);

    // Server-side filtering for serviceName, level, traceId
    if (serviceName) {
      logs = logs.filter(l => l.serviceName === serviceName);
    }
    if (level) {
      logs = logs.filter(l => l.level === level);
    }
    if (traceId) {
      logs = logs.filter(l => l.traceId?.toLowerCase().includes(traceId.toLowerCase()));
    }

    return logs.slice(0, size);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get log level counts for the current project' })
  async getLogStats(@ProjectId() projectId: string) {
    const logs = await this.dbService.getLogs(undefined, 500, projectId);
    const stats = { total: logs.length, error: 0, warn: 0, info: 0 };
    for (const log of logs) {
      if (log.level === 'error') stats.error++;
      else if (log.level === 'warn') stats.warn++;
      else stats.info++;
    }
    return stats;
  }

  @Post()
  @ApiOperation({ summary: 'Bulk save logs' })
  async saveLogs(@ProjectId() projectId: string, @Body() logs: LogEntry[]) {
    for (const log of logs) {
      await this.dbService.saveLog({
        ...log,
        id: log.id || `log_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: log.timestamp || Date.now(),
      }, projectId);
    }
    return { success: true, count: logs.length };
  }
}
