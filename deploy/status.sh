#!/usr/bin/env bash
# Health check for any Fischer VM: its VLAN address, firewall, services, and
# which other VMs it can (and can't) reach. Great for demos and troubleshooting.
#
# Usage:  sudo bash deploy/status.sh

FE=10.10.0.10
BE=10.10.0.20
DB=10.10.0.30

ok()   { printf '  \e[32m✔\e[0m %s\n' "$1"; }
bad()  { printf '  \e[31m✘\e[0m %s\n' "$1"; }
info() { printf '\n\e[1m%s\e[0m\n' "$1"; }

can_reach() { timeout 3 bash -c "</dev/tcp/$1/$2" 2>/dev/null; }

expect_open()    { if can_reach "$1" "$2"; then ok "$3 ($1:$2) reachable"; else bad "$3 ($1:$2) NOT reachable"; fi; }
expect_blocked() { if can_reach "$1" "$2"; then bad "$3 ($1:$2) is reachable but should be blocked"; else ok "$3 ($1:$2) blocked, as it should be"; fi; }

service_state() {
  if systemctl is-active --quiet "$1"; then ok "$1 is running"; else bad "$1 is NOT running (see: sudo journalctl -u $1 -n 30)"; fi
}

VLAN_IP="$(ip -4 -o addr show | awk '{print $4}' | grep '^10\.10\.0\.' | cut -d/ -f1)"

info "VM: $(hostname)   VLAN address: ${VLAN_IP:-none}"
if [[ -z "$VLAN_IP" ]]; then
  bad "No 10.10.0.x address. Run: sudo bash deploy/vm-init.sh <role>"
  exit 1
fi

info "Firewall (UFW)"
if [[ $EUID -eq 0 ]]; then
  ufw status | sed 's/^/  /'
else
  echo "  (run with sudo to see firewall rules)"
fi

info "Services and connections"
case "$VLAN_IP" in
  "$FE")
    service_state nginx
    expect_open "$BE" 3000 "Back-end API"
    expect_blocked "$DB" 27017 "Database (front end must not talk to it directly)"
    printf '  API health through nginx: %s\n' "$(curl -s -m 5 http://127.0.0.1/api/health || echo 'no response')"
    ;;
  "$BE")
    service_state fischer-api
    expect_open "$DB" 27017 "MongoDB on the database VM"
    printf '  API health: %s\n' "$(curl -s -m 5 http://127.0.0.1:3000/api/health || echo 'no response')"
    ;;
  "$DB")
    service_state mongod
    if ss -tln | grep -q "$DB:27017"; then ok "MongoDB listening on the VLAN ($DB:27017)"; else bad "MongoDB not listening on $DB:27017"; fi
    if grep -q 'authorization: enabled' /etc/mongod.conf 2>/dev/null; then ok "MongoDB authentication is ON"; else bad "MongoDB authentication is OFF"; fi
    if ip route show default | grep -q .; then
      echo "  ! Internet (NAT) is still connected. Disconnect Adapter 1 once setup is done."
    else
      ok "No internet route: the database is private"
    fi
    ;;
esac
echo
