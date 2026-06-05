import { Controller, Get, Post, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class CreateProjectDto {
  name: string;
}

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List all projects for the authenticated SRE' })
  async getProjects(@Request() req: any) {
    const userId = req.user.sub;
    return this.projectsService.getProjects(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new project workspace and generate its API key' })
  async createProject(@Request() req: any, @Body() body: CreateProjectDto) {
    const userId = req.user.sub;
    return this.projectsService.createProject(body.name, userId);
  }

  @Delete(':projectId')
  @ApiOperation({ summary: 'Delete a project and revoke its API key mapping' })
  async deleteProject(@Request() req: any, @Param('projectId') projectId: string) {
    const userId = req.user.sub;
    await this.projectsService.deleteProject(projectId, userId);
    return { success: true };
  }
}
