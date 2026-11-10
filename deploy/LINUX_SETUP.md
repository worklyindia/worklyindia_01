# Linux Server Setup (Ubuntu 22.04 / 24.04, Debian)

## 1. Domain DNS
Domain ke DNS me `A` record (`@` aur `www`) apne server ke IP par point karein.

## 2. Server me login
```bash
ssh root@YOUR_SERVER_IP
```

## 3. Code + .env
```bash
apt-get update && apt-get install -y git
git clone YOUR_GIT_REPO_URL /var/www/workly
nano /var/www/workly/.env
```
`.env` me ye daalein:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_ANON_KEY
VITE_SUPABASE_PROJECT_ID=YOUR_PROJECT
```

## 4. Ek command setup
```bash
cd /var/www/workly
sudo bash deploy/setup.sh yourdomain.com YOUR_GIT_REPO_URL you@email.com
```
Ye install karega: Node 20, Nginx, PM2, firewall, free SSL (HTTPS) — aur site live kar dega.

## 5. Naya code update
```bash
sudo bash /var/www/workly/deploy/update.sh
```

## Useful commands
| Kaam | Command |
|---|---|
| API logs | `pm2 logs workly-api` |
| API status | `pm2 status` |
| Nginx test | `nginx -t` |
| Nginx errors | `tail -f /var/log/nginx/error.log` |
| SSL renew test | `certbot renew --dry-run` |

Note: Database, login, storage aur edge functions Supabase par hi chalte hain; server sirf website aur `/api/` helper serve karta hai.
