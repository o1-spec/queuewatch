import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(private readonly dbService: DbService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Retrieve project ID from request details
    const projectId =
      request.headers['x-project-id'] ||
      request.query?.projectId ||
      request.body?.projectId;

    // If no project ID is specified, or it is the public/demo dashboard, allow access
    if (!projectId || projectId === 'proj_demo') {
      return true;
    }

    if (!user || (!user.sub && !user.id)) {
      throw new UnauthorizedException('Authentication required to verify project membership.');
    }

    const userId = user.sub || user.id;

    // Verify user ownership in Redis
    const isOwner = await this.dbService.isProjectOwner(projectId, userId);
    if (!isOwner) {
      throw new ForbiddenException(`Access denied: You do not have permissions to access workspace project "${projectId}".`);
    }

    return true;
  }
}
