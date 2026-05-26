#!/bin/bash
cd /home/z/my-project
while true; do
  bun run dev 2>&1 | tee -a dev.log
  echo "=== RESTART $(date) ===" >> dev.log
  sleep 2
done
