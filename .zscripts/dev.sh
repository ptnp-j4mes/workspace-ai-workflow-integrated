#!/bin/bash
# Custom dev script that forces Webpack mode instead of Turbopack
# Turbopack causes ChunkLoadError with next-intl and large projects
cd /home/z/my-project
echo "[DEV] Starting Next.js with Webpack (Turbopack disabled for stability)..."
exec npx next dev -p 3000 --webpack 2>&1 | tee /home/z/my-project/dev.log
