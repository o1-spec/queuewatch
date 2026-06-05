import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { DbService } from '../db/db.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EscalationRule } from '@queuewatch/shared';
import { ProjectId } from '../auth/project-id.decorator';

@ApiTags('Escalation rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('escalation-rules')
export class EscalationController {
  constructor(private readonly dbService: DbService) {}

  @Get()
  @ApiOperation({ summary: 'List all escalation rules' })
  async getRules(@ProjectId() projectId: string) {
    return this.dbService.getEscalationRules(projectId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new escalation rule' })
  async createRule(@ProjectId() projectId: string, @Body() data: Omit<EscalationRule, 'id'>) {
    const rule: EscalationRule = {
      ...data,
      id: `rule_${Math.random().toString(36).substr(2, 9)}`,
    };
    await this.dbService.saveEscalationRule(rule, projectId);
    return rule;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing escalation rule' })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  async updateRule(
    @ProjectId() projectId: string,
    @Param('id') id: string,
    @Body() updates: Partial<EscalationRule>
  ) {
    const existing = await this.dbService.getEscalationRule(id, projectId);
    if (!existing) {
      throw new NotFoundException(`Escalation rule with ID ${id} not found`);
    }

    const updated: EscalationRule = {
      ...existing,
      ...updates,
    };
    await this.dbService.saveEscalationRule(updated, projectId);
    return updated;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an escalation rule' })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  async deleteRule(@ProjectId() projectId: string, @Param('id') id: string) {
    const existing = await this.dbService.getEscalationRule(id, projectId);
    if (!existing) {
      throw new NotFoundException(`Escalation rule with ID ${id} not found`);
    }
    await this.dbService.deleteEscalationRule(id, projectId);
    return { success: true };
  }
}
