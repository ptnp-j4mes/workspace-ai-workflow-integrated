#!/bin/bash
while true; do
  if ! ss -tlnp | grep -q ':3000'; then
    echo "$(date): Restarting server..." >> /tmp/watchdog.log
    cd /home/z/my-project
    NODE_OPTIONS="--max-old-space-size=256" ./node_modules/.bin/next dev -p 3000 >> /tmp/next.log 2>&1 &
    sleep 15
  fi
  sleep 5
done
