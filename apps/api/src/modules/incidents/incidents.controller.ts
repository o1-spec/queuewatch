import { Controller, Get, Post, Patch, Delete, Param, Body, NotFoundException, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IncidentsService } from './incidents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectId } from '../auth/project-id.decorator';

@ApiTags('Incidents operational diagnostics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all incidents' })
  async getIncidents(@ProjectId() projectId: string) {
    return await this.incidentsService.getIncidents(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an incident by ID' })
  @ApiParam({ name: 'id', description: 'Incident ID' })
  async getIncidentById(@ProjectId() projectId: string, @Param('id') id: string) {
    const incident = await this.incidentsService.getIncidentById(id, projectId);
    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }
    return incident;
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Retrieve chronological SRE timeline events for an incident' })
  @ApiParam({ name: 'id', description: 'Incident ID' })
  async getTimeline(@ProjectId() projectId: string, @Param('id') id: string) {
    try {
      return await this.incidentsService.getIncidentTimeline(id, projectId);
    } catch (e) {
      throw new NotFoundException(e.message);
    }
  }

  @Post(':id/analyze')
  @ApiOperation({ summary: 'Trigger AI assisted diagnosis for an incident' })
  @ApiParam({ name: 'id', description: 'Incident ID' })
  async analyzeIncident(@ProjectId() projectId: string, @Param('id') id: string) {
    try {
      return await this.incidentsService.analyzeIncident(id, projectId);
    } catch (e) {
      throw new NotFoundException(e.message);
    }
  }

  @Patch(':id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge an incident and assign it to the caller' })
  @ApiParam({ name: 'id', description: 'Incident ID' })
  async acknowledgeIncident(
    @ProjectId() projectId: string,
    @Param('id') id: string,
    @Request() req: any
  ) {
    try {
      const userId = req.user?.sub || 'admin';
      const userName = req.user?.name || 'Admin Owner';
      return await this.incidentsService.acknowledgeIncident(id, userId, userName, projectId);
    } catch (e) {
      throw new NotFoundException(e.message);
    }
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign an incident to a developer' })
  @ApiParam({ name: 'id', description: 'Incident ID' })
  async assignIncident(
    @ProjectId() projectId: string,
    @Param('id') id: string,
    @Body('userId') userId: string,
    @Body('userName') userName: string
  ) {
    try {
      return await this.incidentsService.assignIncident(id, userId, userName, projectId);
    } catch (e) {
      throw new NotFoundException(e.message);
    }
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update status of an incident directly' })
  @ApiParam({ name: 'id', description: 'Incident ID' })
  async updateStatus(
    @ProjectId() projectId: string,
    @Param('id') id: string,
    @Body('status') status: any
  ) {
    try {
      return await this.incidentsService.updateIncident(id, { status }, projectId);
    } catch (e) {
      throw new NotFoundException(e.message);
    }
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Resolve an incident and submit a resolution summary' })
  @ApiParam({ name: 'id', description: 'Incident ID' })
  async resolveIncident(
    @ProjectId() projectId: string,
    @Param('id') id: string,
    @Body('summary') summary: string
  ) {
    try {
      return await this.incidentsService.resolveIncident(id, summary, projectId);
    } catch (e) {
      throw new NotFoundException(e.message);
    }
  }

  @Patch(':id/escalate')
  @ApiOperation({ summary: 'Escalate an incident to external alert channels' })
  @ApiParam({ name: 'id', description: 'Incident ID' })
  async escalateIncident(@ProjectId() projectId: string, @Param('id') id: string) {
    try {
      return await this.incidentsService.escalateIncident(id, projectId);
    } catch (e) {
      throw new NotFoundException(e.message);
    }
  }

  // --- Comments ---
  @Get(':id/comments')
  @ApiOperation({ summary: 'Get comments on an incident' })
  @ApiParam({ name: 'id', description: 'Incident ID' })
  async getComments(@ProjectId() projectId: string, @Param('id') id: string) {
    return this.incidentsService.getComments(id, projectId);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a comment to an incident' })
  @ApiParam({ name: 'id', description: 'Incident ID' })
  async addComment(
    @ProjectId() projectId: string,
    @Param('id') id: string,
    @Body('message') message: string,
    @Body('userId') userId?: string,
    @Body('userName') userName?: string
  ) {
    return this.incidentsService.addComment(id, message, userId, userName, projectId);
  }

  @Delete(':id/comments/:commentId')
  @ApiOperation({ summary: 'Delete a comment from an incident' })
  @ApiParam({ name: 'id', description: 'Incident ID' })
  @ApiParam({ name: 'commentId', description: 'Comment ID' })
  async deleteComment(
    @ProjectId() projectId: string,
    @Param('id') id: string,
    @Param('commentId') commentId: string
  ) {
    await this.incidentsService.deleteComment(id, commentId, projectId);
    return { success: true };
  }

  // --- Issue trackers placeholders ---
  @Post(':id/create-github-issue')
  @ApiOperation({ summary: 'Create simulated GitHub issue for an incident' })
  @ApiParam({ name: 'id', description: 'Incident ID' })
  async createGitHubIssue(@ProjectId() projectId: string, @Param('id') id: string) {
    try {
      return await this.incidentsService.createGitHubIssue(id, projectId);
    } catch (e) {
      throw new NotFoundException(e.message);
    }
  }

  @Post(':id/create-jira-ticket')
  @ApiOperation({ summary: 'Create simulated Jira ticket for an incident' })
  @ApiParam({ name: 'id', description: 'Incident ID' })
  async createJiraTicket(@ProjectId() projectId: string, @Param('id') id: string) {
    try {
      return await this.incidentsService.createJiraTicket(id, projectId);
    } catch (e) {
      throw new NotFoundException(e.message);
    }
  }
}
