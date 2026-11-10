#!/usr/bin/env bash
# Pull latest code, rebuild and reload. Usage: sudo bash deploy/update.sh
set -euo pipefail
cd /var/www/workly
git pull
npm ci || npm install
npm install --no-save express
npm run build
pm2 reload workly-api
systemctl reload nginx
echo "Updated."
