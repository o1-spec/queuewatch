import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { Service, Environment } from '@queuewatch/shared';

@Injectable()
export class ServiceRegistryService {
  private readonly logger = new Logger(ServiceRegistryService.name);

  constructor(private readonly dbService: DbService) {}

  async getServices(): Promise<Service[]> {
    return this.dbService.getServices();
  }

  async getServiceById(id: string): Promise<Service | null> {
    return this.dbService.getService(id);
  }

  async createService(service: Service): Promise<Service> {
    await this.dbService.saveService(service);
    return service;
  }

  async deleteService(id: string): Promise<void> {
    await this.dbService.deleteService(id);
  }

  async getEnvironments(): Promise<Environment[]> {
    return this.dbService.getEnvironments();
  }
}
