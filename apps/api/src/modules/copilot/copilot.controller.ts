import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CopilotService } from './copilot.service';
import { RecurringIncidentsService } from './recurring-incidents.service';
import { RunbooksService } from './runbooks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectId } from '../auth/project-id.decorator';

@ApiTags('Reliability Copilot & Insights')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('copilot')
export class CopilotController {
  constructor(
    private readonly copilotService: CopilotService,
    private readonly recurringService: RecurringIncidentsService,
    private readonly runbooksService: RunbooksService
  ) {}

  @Get('suggestions')
  @ApiOperation({ summary: 'Retrieve suggested operational questions' })
  async getSuggestions() {
    return this.copilotService.getSuggestions();
  }

  @Post('query')
  @ApiOperation({ summary: 'Ask QueueWatch a reliability or diagnostic question' })
  async queryCopilot(@ProjectId() projectId: string, @Body('prompt') prompt: string) {
    return this.copilotService.queryCopilot(prompt, projectId);
  }

  @Post('incident/:id/chat')
  @ApiOperation({ summary: 'Chat with Copilot about a specific incident context' })
  @ApiParam({ name: 'id', description: 'Incident ID' })
  async chatIncident(
    @ProjectId() projectId: string,
    @Param('id') id: string,
    @Body('prompt') prompt: string
  ) {
    return this.copilotService.chatIncident(id, prompt, projectId);
  }

  // --- Runbooks ---
  @Get('runbooks')
  @ApiOperation({ summary: 'List all generated runbooks' })
  async getRunbooks(@ProjectId() projectId: string) {
    return this.runbooksService.getRunbooks(projectId);
  }

  @Get('runbooks/:id')
  @ApiParam({ name: 'id', description: 'Runbook ID' })
  async getRunbook(@ProjectId() projectId: string, @Param('id') id: string) {
    return this.runbooksService.getRunbookById(id, projectId);
  }

  @Post('runbooks/generate')
  @ApiOperation({ summary: 'Generate recovery runbook for an incident type' })
  async generateRunbook(
    @ProjectId() projectId: string,
    @Body('incidentType') incidentType: string,
    @Body('linkedIncidents') linkedIncidents: string[]
  ) {
    return this.runbooksService.generateRunbook(incidentType, linkedIncidents, projectId);
  }

  // --- Recurring Incidents ---
  @Get('recurring-incidents')
  @ApiOperation({ summary: 'List all detected recurring failure patterns' })
  async getRecurring() {
    // Note: recurringService aggregates incidents dynamically or from DB. Let's pass it if needed, or default it.
    return this.recurringService.getRecurringIncidents();
  }

  @Get('recurring-incidents/:id')
  @ApiParam({ name: 'id', description: 'Recurring Incident Pattern ID' })
  async getRecurringById(@Param('id') id: string) {
    return this.recurringService.getRecurringIncidentById(id);
  }

  @Get('knowledge-base')
  @ApiOperation({ summary: 'List all operational knowledge base entries' })
  async getKnowledgeBase(@ProjectId() projectId: string) {
    return this.copilotService.getKnowledgeBase(projectId);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Retrieve copilot investigation log history' })
  async getLogs(@ProjectId() projectId: string) {
    return this.copilotService.getCopilotLogs(projectId);
  }
}
