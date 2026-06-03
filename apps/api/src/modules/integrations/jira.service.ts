import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class JiraService {
  private readonly logger = new Logger(JiraService.name);

  async createTicket(incidentId: string, title: string, description: string): Promise<string> {
    this.logger.log(`Mocking Jira ticket creation for incident: ${incidentId}`);
    
    // Simulate API delay
    await new Promise((r) => setTimeout(r, 500));
    
    const ticketId = `QW-${Math.floor(Math.random() * 1000) + 100}`;
    return `https://queuewatch.atlassian.net/browse/${ticketId}`;
  }
}
