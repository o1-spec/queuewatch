import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { Service, Environment } from '@queuewatch/shared';

@Injectable()
export class ServiceRegistryService {
  private readonly logger = new Logger(ServiceRegistryService.name);

  constructor(private readonly dbService: DbService) {}

  async getServices(projectId?: string): Promise<Service[]> {
    return this.dbService.getServices(projectId);
  }

  async getServiceById(id: string, projectId?: string): Promise<Service | null> {
    return this.dbService.getService(id, projectId);
  }

  async createService(service: Service, projectId?: string): Promise<Service> {
    await this.dbService.saveService(service, projectId);
    return service;
  }

  async deleteService(id: string, projectId?: string): Promise<void> {
    await this.dbService.deleteService(id, projectId);
  }

  async getEnvironments(projectId?: string): Promise<Environment[]> {
    return this.dbService.getEnvironments(projectId);
  }
}
