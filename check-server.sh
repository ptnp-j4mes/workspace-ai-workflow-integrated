#!/bin/bash
cd /home/z/my-project
if ! curl -s -m 3 http://localhost:3000/ > /dev/null 2>&1; then
  pkill -f "next dev" 2>/dev/null
  sleep 1
  export NODE_OPTIONS="--max-old-space-size=512"
  nohup npx next dev -p 3000 -H 0.0.0.0 >> /home/z/my-project/dev.log 2>&1 &
  echo "[$(date)] Server restarted with PID $!" >> /home/z/my-project/server-restarts.log
fi
