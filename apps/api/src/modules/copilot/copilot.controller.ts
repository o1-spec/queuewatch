import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CopilotService } from './copilot.service';
import { RecurringIncidentsService } from './recurring-incidents.service';
import { RunbooksService } from './runbooks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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
  async queryCopilot(@Body('prompt') prompt: string) {
    return this.copilotService.queryCopilot(prompt);
  }

  @Post('incident/:id/chat')
  @ApiOperation({ summary: 'Chat with Copilot about a specific incident context' })
  @ApiParam({ name: 'id', description: 'Incident ID' })
  async chatIncident(@Param('id') id: string, @Body('prompt') prompt: string) {
    return this.copilotService.chatIncident(id, prompt);
  }

  // --- Runbooks ---
  @Get('runbooks')
  @ApiOperation({ summary: 'List all generated runbooks' })
  async getRunbooks() {
    return this.runbooksService.getRunbooks();
  }

  @Get('runbooks/:id')
  @ApiParam({ name: 'id', description: 'Runbook ID' })
  async getRunbook(@Param('id') id: string) {
    return this.runbooksService.getRunbookById(id);
  }

  @Post('runbooks/generate')
  @ApiOperation({ summary: 'Generate recovery runbook for an incident type' })
  async generateRunbook(
    @Body('incidentType') incidentType: string,
    @Body('linkedIncidents') linkedIncidents: string[]
  ) {
    return this.runbooksService.generateRunbook(incidentType, linkedIncidents);
  }

  // --- Recurring Incidents ---
  @Get('recurring-incidents')
  @ApiOperation({ summary: 'List all detected recurring failure patterns' })
  async getRecurring() {
    return this.recurringService.getRecurringIncidents();
  }

  @Get('recurring-incidents/:id')
  @ApiParam({ name: 'id', description: 'Recurring Incident Pattern ID' })
  async getRecurringById(@Param('id') id: string) {
    return this.recurringService.getRecurringIncidentById(id);
  }

  @Get('knowledge-base')
  @ApiOperation({ summary: 'List all operational knowledge base entries' })
  async getKnowledgeBase() {
    return this.copilotService.getKnowledgeBase();
  }
}
