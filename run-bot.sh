#!/bin/bash
cd /home/z/my-project/mini-services/meeting-bot-service
while true; do
  bun --hot index.ts 2>&1 | tee -a bot.log
  sleep 2
done
