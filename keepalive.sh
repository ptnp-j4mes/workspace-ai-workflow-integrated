#!/bin/bash
# Keep the dev server alive with continuous pings and auto-restart
while true; do
  # Check if server is alive
  if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null | grep -q "200"; then
    echo "[$(date)] Server down, restarting..."
    pkill -f "bun.*dev" 2>/dev/null
    sleep 2
    cd /home/z/my-project && nohup bun run dev > dev.log 2>&1 &
    echo "[$(date)] Restarted, waiting for ready..."
    sleep 15
    # Verify
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null | grep -q "200"; then
      echo "[$(date)] Server is up!"
    else
      echo "[$(date)] Server still not responding, will retry..."
    fi
  else
    # Keepalive ping every 3 seconds to prevent idle kill
    curl -s -o /dev/null http://localhost:3000/ > /dev/null 2>&1
  fi
  sleep 3
done
