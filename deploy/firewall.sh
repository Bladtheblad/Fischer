#!/usr/bin/env bash
# UFW firewall rules for each Fischer VM. Each VM accepts only the traffic it needs:
#
#   front end  (10.10.0.10): SSH + HTTP from anywhere (it's the public-facing VM)
#   back end   (10.10.0.20): API port 3000 + SSH, only from the front end
#   database   (10.10.0.30): MongoDB port 27017 only from the back end; SSH only from the front end
#
# Usage:  sudo bash deploy/firewall.sh frontend|backend|database
set -euo pipefail

ROLE="${1:-}"
FE=10.10.0.10
BE=10.10.0.20

if [[ $EUID -ne 0 ]]; then
  echo "Please run with sudo." >&2
  exit 1
fi
case "$ROLE" in
  frontend|backend|database) ;;
  *) echo "Usage: sudo bash deploy/firewall.sh frontend|backend|database" >&2; exit 1 ;;
esac

echo "==> Resetting UFW and applying $ROLE rules"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw logging low  # blocked connections are logged (basic system log)

case "$ROLE" in
  frontend)
    ufw allow 22/tcp comment 'SSH'
    ufw allow 80/tcp comment 'HTTP website'
    ;;
  backend)
    ufw allow from "$FE" to any port 3000 proto tcp comment 'API from front-end nginx'
    ufw allow from "$FE" to any port 22 proto tcp comment 'SSH via front end'
    ;;
  database)
    ufw allow from "$BE" to any port 27017 proto tcp comment 'MongoDB from back end'
    ufw allow from "$FE" to any port 22 proto tcp comment 'SSH via front end'
    ;;
esac

ufw --force enable
echo
ufw status verbose
