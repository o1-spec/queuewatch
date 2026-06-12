FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @queuewatch/shared build
RUN pnpm --filter api build

FROM base AS runner
WORKDIR /app
COPY --from=build /app /app
ENV PORT=3001
EXPOSE 3001
CMD ["pnpm", "--filter", "api", "start"]
