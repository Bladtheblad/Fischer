#!/usr/bin/env bash
# Copies the Fischer front end into nginx's web root and reloads nginx.
# Run from the repository root:  sudo ./deploy/deploy.sh
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)/frontend"
DEST="/var/www/fischer"

if [[ $EUID -ne 0 ]]; then
  echo "Please run with sudo: sudo ./deploy/deploy.sh" >&2
  exit 1
fi

echo "Deploying $SRC -> $DEST"
mkdir -p "$DEST"
rsync -a --delete "$SRC"/ "$DEST"/
chown -R www-data:www-data "$DEST"
find "$DEST" -type d -exec chmod 755 {} \;
find "$DEST" -type f -exec chmod 644 {} \;

nginx -t
systemctl reload nginx
echo "Done. Visit http://$(hostname -I | awk '{print $1}')/"
