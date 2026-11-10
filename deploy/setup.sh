#!/usr/bin/env bash
# One-time Ubuntu/Debian server setup. Usage:
#   sudo bash deploy/setup.sh <your-domain> <git-repo-url> [email-for-ssl]
set -euo pipefail

DOMAIN="${1:?domain required}"
REPO="${2:?git repo url required}"
EMAIL="${3:-admin@$DOMAIN}"
APP_DIR=/var/www/workly

echo "==> Installing packages"
apt-get update
apt-get install -y curl git nginx ufw certbot python3-certbot-nginx
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2

echo "==> Getting code"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull
else
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"

if [ ! -f .env ]; then
  echo "!! $APP_DIR/.env missing. Create it with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then re-run."
  exit 1
fi

echo "==> Building"
npm ci || npm install
npm install --no-save express
npm run build

echo "==> Starting API with PM2"
pm2 startOrReload deploy/ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null

echo "==> Configuring Nginx"
sed "s/example.com/$DOMAIN/g" deploy/nginx.conf > /etc/nginx/sites-available/workly
ln -sf /etc/nginx/sites-available/workly /etc/nginx/sites-enabled/workly
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> Firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> SSL"
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect || \
  echo "!! SSL failed — point DNS A records to this server, then run: certbot --nginx -d $DOMAIN"

echo "Done: https://$DOMAIN"
