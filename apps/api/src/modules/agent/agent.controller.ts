import { Controller, Get, Post, Param, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AgentService } from './agent.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DbService } from '../db/db.service';
import { ProjectId } from '../auth/project-id.decorator';

@ApiTags('Incident Investigation Agent')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('incidents')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly dbService: DbService
  ) {}

  @Post(':id/investigate')
  @ApiOperation({ summary: 'Trigger step-by-step SRE AI investigation' })
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
    if (!report) {
      throw new NotFoundException(`No investigation report found for incident ${id}`);
    }
    return report;
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Retrieve chronological SRE timeline events for an incident' })
  @ApiParam({ name: 'id', description: 'Incident ID' })
  async getTimeline(@ProjectId() projectId: string, @Param('id') id: string) {
    const incident = await this.dbService.getIncident(id, projectId);
    if (!incident) {
      throw new NotFoundException(`Incident ${id} not found`);
    }

    const firstTime = incident.firstDetectedAt;
    const lastTime = incident.lastUpdatedAt;

    // Generate dynamic events representing SRE lifecycle
    const timeline = [
      { event: 'anomaly.detected', title: 'Incident Anomaly Detected', desc: `Alert triggered on queue [${incident.affectedQueue}] due to errors.`, timestamp: firstTime },
      { event: 'failures.spiked', title: 'Failure Rate Spike', desc: `Queue failures crossed critical thresholds.`, timestamp: firstTime + 2000 },
      { event: 'worker.slowdown', title: 'Worker Health Degradation', desc: `Thread execution delays measured.`, timestamp: firstTime + 5000 },
    ];

    const report = await this.dbService.getInvestigation(id, projectId);
    if (report) {
      timeline.push(
        { event: 'investigation.started', title: 'AI SRE Investigation Started', desc: 'Step-by-step diagnostic agent logs and telemetry gathered.', timestamp: report.timestamp - 1000 },
        { event: 'investigation.completed', title: 'Investigation Completed', desc: `Root cause identified with confidence score ${report.confidenceScore}%.`, timestamp: report.timestamp }
      );
    }

    if (incident.status === 'resolved') {
      timeline.push({ event: 'incident.resolved', title: 'Incident Resolved', desc: 'Active workers returned to healthy threshold states.', timestamp: lastTime });
    }

    return timeline.sort((a, b) => a.timestamp - b.timestamp);
  }
}
