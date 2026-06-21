import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // JWT guard attaches user object to request
    return request.user?.username || request.user?.id || request.user?.sub || 'sre-engineer';
  },
);
