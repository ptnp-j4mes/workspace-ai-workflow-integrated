#!/bin/bash
cd /home/z/my-project
while true; do
  # Check if server is already running
  if ! pgrep -f "next-server" > /dev/null 2>&1; then
    echo "[$(date)] Starting Next.js dev server..." >> /home/z/my-project/dev-watchdog.log
    NODE_OPTIONS="--max-old-space-size=4096" npx next dev -p 3000 >> /home/z/my-project/dev.log 2>&1 &
    NEXT_PID=$!
    echo "[$(date)] Started with PID $NEXT_PID" >> /home/z/my-project/dev-watchdog.log
    # Wait for server to be ready
    sleep 10
    # Keep checking if process is alive
    while kill -0 $NEXT_PID 2>/dev/null; do
      sleep 5
    done
    echo "[$(date)] Process $NEXT_PID died, restarting..." >> /home/z/my-project/dev-watchdog.log
    sleep 2
  else
    sleep 5
  fi
done
