#!/usr/bin/env bash
# Installs and secures MongoDB on the database VM (10.10.0.30):
#   - MongoDB 9.0 Community from MongoDB's official repository (9.0.4+ supports Ubuntu 26.04)
#   - listens only on localhost and the VLAN address
#   - authentication ON, with an admin user and a least-privilege app user
#   - prints the connection string (MONGO_URI) for the back-end VM
#
# Usage:  sudo bash deploy/database-setup.sh
# Needs internet (VirtualBox Adapter 1 = NAT) while it runs.
set -euo pipefail

DB_IP=10.10.0.30
DB_NAME=fischer
APP_USER=fischer_app
CREDS_FILE=/root/fischer-db-credentials.txt

if [[ $EUID -ne 0 ]]; then
  echo "Please run with sudo." >&2
  exit 1
fi

if ! ip -4 addr | grep -q "inet $DB_IP/"; then
  echo "This VM doesn't have $DB_IP yet. Run first:  sudo bash deploy/vm-init.sh database" >&2
  exit 1
fi

if [[ -f "$CREDS_FILE" ]]; then
  echo "MongoDB is already set up. Saved credentials:"
  cat "$CREDS_FILE"
  exit 0
fi

wait_for_mongo() {
  for _ in $(seq 1 45); do
    if mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok' >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "MongoDB didn't start. Check:  sudo journalctl -u mongod -n 50  and  /var/log/mongodb/mongod.log" >&2
  exit 1
}

write_config() {  # $1 = "enabled" to turn on authentication
  cat > /etc/mongod.conf <<EOF
# Fischer database VM — written by deploy/database-setup.sh
storage:
  dbPath: /var/lib/mongodb
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log
net:
  port: 27017
  bindIp: 127.0.0.1,$DB_IP
processManagement:
  timeZoneInfo: /usr/share/zoneinfo
EOF
  if [[ "${1:-}" == "enabled" ]]; then
    printf 'security:\n  authorization: enabled\n' >> /etc/mongod.conf
  fi
}

echo "==> Adding MongoDB 9.0 repository"
apt-get update
apt-get install -y gnupg curl ca-certificates openssl
curl -fsSL https://pgp.mongodb.com/server-9.asc | gpg --yes -o /usr/share/keyrings/mongodb-server-9.gpg --dearmor
CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")"
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-9.gpg ] https://repo.mongodb.org/apt/ubuntu $CODENAME/mongodb-org/9.0 multiverse" \
  > /etc/apt/sources.list.d/mongodb-org-9.0.list
apt-get update

echo "==> Installing MongoDB"
apt-get install -y mongodb-org

VERSION="$(mongod --version | sed -n 's/^db version v//p')"
echo "==> Installed MongoDB $VERSION"
if [[ "$CODENAME" == "resolute" ]] && [[ "$(printf '%s\n' 9.0.4 "$VERSION" | sort -V | head -1)" != "9.0.4" ]]; then
  echo "WARNING: Ubuntu 26.04 needs MongoDB 9.0.4 or newer; this is $VERSION. It may refuse to start." >&2
fi

# Start mongod only after the VLAN address exists, or binding to it fails at boot.
mkdir -p /etc/systemd/system/mongod.service.d
cat > /etc/systemd/system/mongod.service.d/fischer.conf <<'EOF'
[Unit]
Wants=network-online.target
After=network-online.target
EOF
systemctl daemon-reload

echo "==> Starting MongoDB (authentication off, just to create users)"
write_config
systemctl enable mongod
systemctl restart mongod
wait_for_mongo

ADMIN_PW="$(openssl rand -hex 16)"
APP_PW="$(openssl rand -hex 16)"

echo "==> Creating users"
mongosh --quiet --eval "
  db.getSiblingDB('admin').createUser({
    user: 'admin', pwd: '$ADMIN_PW',
    roles: [ { role: 'userAdminAnyDatabase', db: 'admin' }, { role: 'readWriteAnyDatabase', db: 'admin' } ]
  });
  db.getSiblingDB('$DB_NAME').createUser({
    user: '$APP_USER', pwd: '$APP_PW',
    roles: [ { role: 'readWrite', db: '$DB_NAME' } ]
  });
" >/dev/null

echo "==> Turning on authentication"
write_config enabled
systemctl restart mongod
wait_for_mongo

MONGO_URI="mongodb://$APP_USER:$APP_PW@$DB_IP:27017/$DB_NAME?authSource=$DB_NAME"

# Prove authentication works: the app user can log in, and anonymous reads are refused.
mongosh --quiet "mongodb://$APP_USER:$APP_PW@127.0.0.1:27017/$DB_NAME?authSource=$DB_NAME" \
  --eval 'db.runCommand({ ping: 1 }).ok' >/dev/null
if mongosh --quiet "mongodb://127.0.0.1:27017/$DB_NAME" --eval 'db.users.findOne()' >/dev/null 2>&1; then
  echo "WARNING: anonymous access still works — authentication is not on." >&2
fi

umask 077
cat > "$CREDS_FILE" <<EOF
# Fischer MongoDB credentials (created $(date -Is)). Keep private.
MongoDB admin user:     admin / $ADMIN_PW
App user:               $APP_USER / $APP_PW
MONGO_URI for the back end:
$MONGO_URI
EOF

echo
echo "============================================================"
echo " MongoDB is ready, with authentication ON."
echo " Copy this line. The back-end setup will ask for it:"
echo
echo " $MONGO_URI"
echo
echo " (Saved in $CREDS_FILE. See it again with: sudo cat $CREDS_FILE)"
echo "============================================================"
