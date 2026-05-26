#!/bin/bash
cd /home/z/my-project
while true; do
  > dev.log
  NODE_OPTIONS="--max-old-space-size=512" npx next dev -p 3000 -H 0.0.0.0 >> dev.log 2>&1 &
  PID=$!
  # Wait for ready
  for i in $(seq 1 60); do
    if grep -q "Ready" dev.log 2>/dev/null; then break; fi
    sleep 1
  done
  # Keep process alive by waiting
  wait $PID 2>/dev/null
  echo "[$(date)] Restarting..." >> dev.log
  sleep 2
done
