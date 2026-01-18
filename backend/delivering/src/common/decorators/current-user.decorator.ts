import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { User } from '@prisma/client';

interface GraphQLContext {
  req: {
    user: User;
  };
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const gqlCtx = GqlExecutionContext.create(ctx);
    const context = gqlCtx.getContext<GraphQLContext>();
    return context.req.user;
  },
);
