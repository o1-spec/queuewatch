import {
  Controller, Get, Post, Patch, Param, Body, Request,
  UseGuards, NotFoundException, BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { RemediationService } from './remediation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectId } from '../auth/project-id.decorator';
import { AgentAction } from '@queuewatch/shared';

class CreateRemediationDto {
  action: AgentAction;
  incidentId: string;
  sessionId?: string;
}

class ApproveRejectDto {
  notes?: string;
}

@ApiTags('Remediation Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('remediation')
export class RemediationController {
  constructor(private readonly remediationService: RemediationService) {}

  // ─── List all records ────────────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'List all remediation records for the project' })
  async getRecords(@ProjectId() projectId: string) {
    return this.remediationService.getRecords(projectId);
  }

  // ─── Get by incident ─────────────────────────────────────────────────────────
  @Get('incident/:incidentId')
  @ApiOperation({ summary: 'Get remediation records for a specific incident' })
  @ApiParam({ name: 'incidentId', description: 'Incident ID' })
  async getByIncident(@ProjectId() projectId: string, @Param('incidentId') incidentId: string) {
    return this.remediationService.getRecordsByIncident(incidentId, projectId);
  }

  // ─── Get by session ──────────────────────────────────────────────────────────
  @Get('session/:sessionId')
  @ApiOperation({ summary: 'Get remediation records for an agent session' })
  @ApiParam({ name: 'sessionId', description: 'Agent Session ID' })
  async getBySession(@ProjectId() projectId: string, @Param('sessionId') sessionId: string) {
    return this.remediationService.getRecordsBySession(sessionId, projectId);
  }

  // ─── Get one ─────────────────────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Get a specific remediation record by ID' })
  @ApiParam({ name: 'id', description: 'Remediation Record ID' })
  async getRecord(@ProjectId() projectId: string, @Param('id') id: string) {
    return this.remediationService.getRecord(id, projectId);
  }

  // ─── Create ──────────────────────────────────────────────────────────────────
  @Post()
  @ApiOperation({ summary: 'Create a remediation record (with rollback plan) from an action' })
  @ApiBody({ type: CreateRemediationDto })
  async createRecord(
    @ProjectId() projectId: string,
    @Body() body: CreateRemediationDto,
  ) {
    if (!body.action || !body.incidentId) {
      throw new BadRequestException('action and incidentId are required');
    }
    return this.remediationService.createRecord(
      body.action,
      body.incidentId,
      projectId,
      body.sessionId,
    );
  }

  // ─── Approve ─────────────────────────────────────────────────────────────────
  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a pending remediation action' })
  @ApiParam({ name: 'id', description: 'Remediation Record ID' })
  async approve(
    @ProjectId() projectId: string,
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: ApproveRejectDto,
  ) {
    const approvedBy = req.user?.name || req.user?.username || req.user?.sub || 'engineer';
    return this.remediationService.approveRecord(id, approvedBy, projectId);
  }

  // ─── Reject ──────────────────────────────────────────────────────────────────
  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a pending remediation action' })
  @ApiParam({ name: 'id', description: 'Remediation Record ID' })
  async reject(
    @ProjectId() projectId: string,
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: ApproveRejectDto,
  ) {
    const rejectedBy = req.user?.name || req.user?.username || req.user?.sub || 'engineer';
    return this.remediationService.rejectRecord(id, rejectedBy, body.notes || '', projectId);
  }

  // ─── Execute ─────────────────────────────────────────────────────────────────
  @Post(':id/execute')
  @ApiOperation({ summary: 'Execute an approved remediation action' })
  @ApiParam({ name: 'id', description: 'Remediation Record ID' })
  async execute(@ProjectId() projectId: string, @Param('id') id: string) {
    return this.remediationService.executeRecord(id, projectId);
  }

  // ─── Rollback ────────────────────────────────────────────────────────────────
  @Post(':id/rollback')
  @ApiOperation({ summary: 'Execute the rollback plan for a remediation record' })
  @ApiParam({ name: 'id', description: 'Remediation Record ID' })
  async rollback(@ProjectId() projectId: string, @Param('id') id: string) {
    return this.remediationService.rollbackRecord(id, projectId);
  }

  // ─── Verification result ─────────────────────────────────────────────────────
  @Get(':id/verify')
  @ApiOperation({ summary: 'Get the verification result for a remediation record' })
  @ApiParam({ name: 'id', description: 'Remediation Record ID' })
  async getVerification(@ProjectId() projectId: string, @Param('id') id: string) {
    const record = await this.remediationService.getRecord(id, projectId);
    return {
      recordId: id,
      status: record.status,
      verificationResult: record.verificationResult || null,
      executionLog: record.executionLog,
    };
  }
}
