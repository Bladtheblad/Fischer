#!/usr/bin/env bash
# Installs (or updates) the Fischer API on the back-end VM (10.10.0.20) and runs it
# as the systemd service "fischer-api" under its own unprivileged user.
#
# Usage (from the repo folder):  sudo bash deploy/backend-deploy.sh
# The first run asks for the MONGO_URI printed by deploy/database-setup.sh.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR=/opt/fischer/backend
ENV_FILE=/etc/fischer/api.env
SERVICE=fischer-api

if [[ $EUID -ne 0 ]]; then
  echo "Please run with sudo." >&2
  exit 1
fi

if ! ip -4 addr | grep -q "inet 10.10.0.20/"; then
  echo "This VM doesn't have 10.10.0.20 yet. Run first:  sudo bash deploy/vm-init.sh backend" >&2
  exit 1
fi

# ---- Node.js ----
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "==> Installing Node.js and npm"
  apt-get update
  apt-get install -y nodejs npm
fi
if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>20||(a===20&&b>=19)?0:1)'; then
  echo "Node.js $(node -v) is too old; version 20.19 or newer is needed." >&2
  exit 1
fi
echo "==> Node.js $(node -v), npm $(npm -v)"
command -v rsync >/dev/null || apt-get install -y rsync

# ---- Service user (no login shell, no home folder) ----
if ! id "$SERVICE" >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE"
  echo "==> Created system user $SERVICE"
fi

# ---- App code ----
echo "==> Copying code to $APP_DIR"
mkdir -p "$APP_DIR"
rsync -a --delete --exclude node_modules --exclude test "$REPO/backend/" "$APP_DIR/"
cd "$APP_DIR"
npm ci --omit=dev --no-audit --no-fund
chown -R root:root /opt/fischer  # the service can read its code but not change it

# ---- Settings (database password lives here, readable only by root and the service) ----
if [[ ! -f "$ENV_FILE" ]]; then
  URI="${MONGO_URI:-}"
  while [[ "$URI" != mongodb://* ]]; do
    read -r -p "Paste the MONGO_URI from the database VM (starts with mongodb://): " URI
  done
  mkdir -p /etc/fischer
  umask 027
  cat > "$ENV_FILE" <<EOF
# Fischer API settings (read by systemd). Keep private.
MONGO_URI=$URI
DB_NAME=fischer
HOST=0.0.0.0
PORT=3000
TRUST_PROXY=10.10.0.10
SESSION_DAYS=7
EOF
  chown root:"$SERVICE" "$ENV_FILE"
  chmod 640 "$ENV_FILE"
  echo "==> Saved settings to $ENV_FILE"
fi

# ---- systemd service ----
install -m 644 "$REPO/deploy/systemd/fischer-api.service" /etc/systemd/system/fischer-api.service
systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null
systemctl restart "$SERVICE"

echo "==> Waiting for the API to start"
for _ in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo
    echo "Fischer API is running:  $(curl -fsS http://127.0.0.1:3000/api/health)"
    exit 0
  fi
  sleep 1
done

echo "The API didn't respond. Last log lines:" >&2
journalctl -u "$SERVICE" -n 30 --no-pager >&2
exit 1
