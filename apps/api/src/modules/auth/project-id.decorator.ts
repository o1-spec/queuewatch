import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const ProjectId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const projectId = request.headers['x-project-id'] || request.query?.projectId || request.body?.projectId;
    return projectId || undefined;
  },
);
