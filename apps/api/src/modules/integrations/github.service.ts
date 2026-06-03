import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);

  async createIssue(incidentId: string, title: string, body: string): Promise<string> {
    this.logger.log(`Mocking GitHub issue creation for incident: ${incidentId}`);
    
    // Simulate API delay
    await new Promise((r) => setTimeout(r, 500));
    
    const issueNumber = Math.floor(Math.random() * 1000) + 1;
    return `https://github.com/queuewatch/demo-repo/issues/${issueNumber}`;
  }
}
