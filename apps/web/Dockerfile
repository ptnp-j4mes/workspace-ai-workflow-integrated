FROM oven/bun:1

WORKDIR /app

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
RUN bun install --frozen-lockfile

COPY apps/web apps/web
WORKDIR /app/apps/web

EXPOSE 3002

CMD ["sh", "-lc", "bun run dev"]
