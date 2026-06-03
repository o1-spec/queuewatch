import { Controller, Get, Post, Param, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IncidentsService } from './incidents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Incidents operational diagnostics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all incidents' })
  @ApiResponse({ status: 200, description: 'Return incident lists.' })
  async getIncidents() {
    return await this.incidentsService.getIncidents();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an incident by ID' })
  @ApiParam({ name: 'id', description: 'Incident ID' })
  @ApiResponse({ status: 200, description: 'Successful lookup.' })
  async getIncidentById(@Param('id') id: string) {
    const incident = await this.incidentsService.getIncidentById(id);
    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }
    return incident;
  }

  @Post(':id/analyze')
  @ApiOperation({ summary: 'Trigger AI assisted diagnosis for an incident' })
  @ApiParam({ name: 'id', description: 'Incident ID' })
  @ApiResponse({ status: 200, description: 'Incident successfully analyzed.' })
  async analyzeIncident(@Param('id') id: string) {
    try {
      return await this.incidentsService.analyzeIncident(id);
    } catch (e) {
      throw new NotFoundException(e.message);
    }
  }
}
