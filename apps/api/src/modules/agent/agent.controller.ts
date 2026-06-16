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
}
