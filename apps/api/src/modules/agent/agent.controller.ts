import {
  Controller, Get, Post, Patch, Param, Body, NotFoundException, UseGuards,
  HttpCode, HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { AgentService } from './agent.service';
import { DbService } from '../db/db.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectId } from '../auth/project-id.decorator';
import { UserId } from '../auth/user-id.decorator';

@ApiTags('Reliability Agent')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agent')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly dbService: DbService,
  ) {}

  // ─── Run a new agent investigation session ───────────────────────────────
  @Post('run')
  @ApiOperation({ summary: 'Start a new 6-stage agent investigation for an incident' })
  @ApiBody({ schema: { properties: { incidentId: { type: 'string' } } } })
  async runAgent(
    @ProjectId() projectId: string,
    @Body('incidentId') incidentId: string,
  ) {
    if (!incidentId) {
      throw new NotFoundException('incidentId is required in request body');
    }
    return this.agentService.runAgentSession(incidentId, projectId);
  }

  // ─── List all agent sessions ─────────────────────────────────────────────
  @Get('sessions')
  @ApiOperation({ summary: 'List all agent investigation sessions for the project' })
  async listSessions(@ProjectId() projectId: string) {
    return this.agentService.getAgentSessions(projectId);
  }

  // ─── Get a specific agent session ────────────────────────────────────────
  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get a specific agent session by ID' })
  @ApiParam({ name: 'id', description: 'Agent Session ID' })
  async getSession(@ProjectId() projectId: string, @Param('id') id: string) {
    return this.agentService.getAgentSession(id, projectId);
  }

  // ─── Approve / Reject / Modify an action ────────────────────────────────
  @Patch('sessions/:id/actions/:actionId/approve')
  @ApiOperation({ summary: 'Record an approval decision for a recommended action' })
  @ApiParam({ name: 'id', description: 'Agent Session ID' })
  @ApiParam({ name: 'actionId', description: 'Action ID within the session' })
  @ApiBody({
    schema: {
      properties: {
        decision: { type: 'string', enum: ['approved', 'rejected', 'modified'] },
        notes: { type: 'string' },
        modifiedPayload: { type: 'object' },
      },
    },
  })
  async approveAction(
    @ProjectId() projectId: string,
    @UserId() userId: string,
    @Param('id') sessionId: string,
    @Param('actionId') actionId: string,
    @Body('decision') decision: 'approved' | 'rejected' | 'modified',
    @Body('notes') notes?: string,
    @Body('modifiedPayload') modifiedPayload?: any,
  ) {
    return this.agentService.approveAction(
      sessionId, actionId, decision,
      userId || 'sre-engineer',
      projectId, notes, modifiedPayload,
    );
  }

  // ─── Execute approved actions ────────────────────────────────────────────
  @Post('sessions/:id/execute')
  @ApiOperation({ summary: 'Execute all approved actions in an agent session' })
  @ApiParam({ name: 'id', description: 'Agent Session ID' })
  @HttpCode(HttpStatus.OK)
  async executeApproved(
    @ProjectId() projectId: string,
    @Param('id') sessionId: string,
  ) {
    return this.agentService.executeApprovedActions(sessionId, projectId);
  }
}

// ─── Incident-scoped agent endpoints ─────────────────────────────────────────

@ApiTags('Reliability Agent')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('incidents')
export class IncidentAgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly dbService: DbService,
  ) {}

  // Legacy investigation (backward compat)
  @Post(':id/investigate')
  @ApiOperation({ summary: 'Trigger step-by-step SRE AI investigation (legacy)' })
  @ApiParam({ name: 'id', description: 'Incident ID' })
  async runInvestigation(@ProjectId() projectId: string, @Param('id') id: string) {
    try {
      return await this.agentService.runInvestigation(id, projectId);
    } catch (e) {
      throw new NotFoundException(e.message);
    }
  }

  @Get(':id/investigation')
  @ApiOperation({ summary: 'Retrieve investigation report for an incident' })
  @ApiParam({ name: 'id', description: 'Incident ID' })
  async getInvestigation(@ProjectId() projectId: string, @Param('id') id: string) {
    const report = await this.dbService.getInvestigation(id, projectId);
    if (!report) throw new NotFoundException(`No investigation report found for incident ${id}`);
    return report;
  }

  // Get agent session for a specific incident
  @Get(':id/agent-session')
  @ApiOperation({ summary: 'Get the agent session associated with a specific incident' })
  @ApiParam({ name: 'id', description: 'Incident ID' })
  async getIncidentAgentSession(@ProjectId() projectId: string, @Param('id') id: string) {
    const session = await this.agentService.getAgentSessionByIncidentId(id, projectId);
    if (!session) throw new NotFoundException(`No agent session found for incident ${id}`);
    return session;
  }
}
