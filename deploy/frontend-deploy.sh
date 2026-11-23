#!/usr/bin/env bash
# Deploys the Fischer front end on the front-end VM: installs the nginx site config
# (pages + /api reverse proxy) and copies the pages into /var/www/fischer.
#
# Usage (from the repo folder):  sudo bash deploy/frontend-deploy.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DEST=/var/www/fischer

if [[ $EUID -ne 0 ]]; then
  echo "Please run with sudo: sudo bash deploy/frontend-deploy.sh" >&2
  exit 1
fi

command -v nginx >/dev/null || { apt-get update && apt-get install -y nginx; }
command -v rsync >/dev/null || apt-get install -y rsync

echo "==> Installing nginx site config"
install -m 644 "$REPO/deploy/nginx/fischer.conf" /etc/nginx/sites-available/fischer
ln -sf /etc/nginx/sites-available/fischer /etc/nginx/sites-enabled/fischer
rm -f /etc/nginx/sites-enabled/default

echo "==> Copying pages to $DEST"
mkdir -p "$DEST"
rsync -a --delete "$REPO/frontend/" "$DEST/"
chown -R www-data:www-data "$DEST"
find "$DEST" -type d -exec chmod 755 {} \;
find "$DEST" -type f -exec chmod 644 {} \;

nginx -t
systemctl reload nginx || systemctl restart nginx

echo
echo "Done. Pages are live. API check through nginx:"
curl -s -m 5 http://127.0.0.1/api/health || echo "(back end not reachable yet: that's expected until the back-end VM is set up)"
echo
