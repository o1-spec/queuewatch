import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('AI Observability & Remediation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('analyze')
  @ApiOperation({ summary: 'Trigger a live AI diagnostic review of system health, latencies, and queues' })
  @ApiResponse({ status: 200, description: 'Return AI analysis report containing root cause, severity, impact and copyable code repair blocks.' })
  async getAnalysis() {
    return this.aiService.analyzeSystemState();
  }

  @Get('timeline')
  @ApiOperation({ summary: 'Get chronological history of AI-logged incidents from Redis memory streams' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit timeline snapshots returned' })
  @ApiResponse({ status: 200, description: 'Return list of past critical AI reports.' })
  async getTimeline(@Query('limit') limit?: number) {
    const size = limit ? Number(limit) : 30;
    return this.aiService.getTimeline(size);
  }
}
