FROM oven/bun:1

# ffmpeg: splits long meeting recordings into chunks for Typhoon ASR (src/lib/typhoon-asr.ts)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=development
ENV PORT=3011

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN bun install --frozen-lockfile

COPY apps/api apps/api
WORKDIR /app/apps/api

EXPOSE 3011

CMD ["sh", "-lc", "bunx prisma db push && bun run prisma/seed.ts && bun run start"]
