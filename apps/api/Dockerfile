FROM node:22-alpine
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter api

COPY apps/api apps/api
WORKDIR /app/apps/api
RUN pnpm prisma:generate && pnpm build

# Dev dependencies stay in the image because `prisma migrate deploy` runs at
# start-up. A production image would run migrations as a separate job instead.
EXPOSE 3000
CMD ["node", "dist/main.js"]
