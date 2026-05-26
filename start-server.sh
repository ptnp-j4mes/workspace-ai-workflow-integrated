#!/bin/bash
# Next.js Dev Server with Keepalive
# The sandbox kills idle processes, so we need to keep pinging
cd /home/z/my-project

while true; do
  > dev.log
  NODE_OPTIONS="--max-old-space-size=768" npx next dev -p 3000 -H 0.0.0.0 >> dev.log 2>&1 &
  NEXT_PID=$!
  
  # Wait for server to be ready
  for i in $(seq 1 30); do
    if curl -s -m 2 http://localhost:3000/ > /dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  
  # Keepalive: ping every 3 seconds while process is alive
  while kill -0 $NEXT_PID 2>/dev/null; do
    curl -s -m 2 http://localhost:3000/ > /dev/null 2>&1
    sleep 3
  done
  
  echo "[$(date)] Server died, restarting in 2s..." >> dev.log
  sleep 2
done
