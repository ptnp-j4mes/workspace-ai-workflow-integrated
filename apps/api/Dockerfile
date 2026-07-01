FROM oven/bun:1

WORKDIR /app

ENV NODE_ENV=development
ENV PORT=3001

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
RUN bun install --frozen-lockfile

COPY apps/api apps/api
WORKDIR /app/apps/api

EXPOSE 3001

CMD ["sh", "-lc", "bunx prisma db push && bun run prisma/seed.ts && bun run start"]
