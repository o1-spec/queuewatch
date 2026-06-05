import { Injectable, BadRequestException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { Project } from '@queuewatch/shared';

@Injectable()
export class ProjectsService {
  constructor(private readonly dbService: DbService) {}

  async getProjects(userId: string): Promise<Project[]> {
    return this.dbService.getProjects(userId);
  }

  async getProject(projectId: string): Promise<Project | null> {
    return this.dbService.getProject(projectId);
  }

  async createProject(name: string, userId: string): Promise<any> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new BadRequestException('Project name cannot be empty');
    }

    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const randPart1 = Math.random().toString(36).substring(2, 10);
    const randPart2 = Math.random().toString(36).substring(2, 10);
    const apiKey = `qw_pk_${randPart1}${randPart2}`;

    const project: Project = {
      id: projectId,
      name: trimmedName,
      apiKey,
      createdAt: Date.now(),
      hasReceivedTelemetry: false,
    };

    await this.dbService.saveProject(project, userId);
    await this.dbService.saveApiKeyMapping(apiKey, { projectId, userId });

    return {
      id: project.id,
      name: project.name,
      projectId: project.id,
      apiKey: project.apiKey,
      projectName: project.name,
      createdAt: project.createdAt,
      hasReceivedTelemetry: project.hasReceivedTelemetry,
    };
  }

  async deleteProject(projectId: string, userId: string): Promise<void> {
    const project = await this.dbService.getProject(projectId);
    if (!project) {
      throw new BadRequestException('Project not found');
    }
    await this.dbService.deleteProject(projectId, userId);
  }
}
