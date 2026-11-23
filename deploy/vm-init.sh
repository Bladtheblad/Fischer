#!/usr/bin/env bash
# Gives a VM its role on the Fischer VLAN: hostname, static VLAN IP, /etc/hosts.
# On cloned VMs (backend, database) it also resets the machine ID and SSH host keys
# so the clone doesn't share an identity with the VM it was copied from.
#
# Usage (from the repo folder):  sudo bash deploy/vm-init.sh frontend|backend|database
set -euo pipefail

ROLE="${1:-}"
case "$ROLE" in
  frontend) IP=10.10.0.10 ;;
  backend)  IP=10.10.0.20 ;;
  database) IP=10.10.0.30 ;;
  *) echo "Usage: sudo bash deploy/vm-init.sh frontend|backend|database" >&2; exit 1 ;;
esac
NEW_HOSTNAME="fischer-$ROLE"

if [[ $EUID -ne 0 ]]; then
  echo "Please run with sudo." >&2
  exit 1
fi

# ---- Find the VLAN network card (VirtualBox Adapter 2) ----
# It's the ethernet interface that is NOT carrying the default route (Adapter 1 / NAT).
DEFAULT_IF="$(ip route show default 2>/dev/null | awk '{print $5; exit}')"
if [[ -n "${VLAN_IF:-}" ]]; then
  IFACE="$VLAN_IF"
else
  CANDIDATES=()
  for dev in /sys/class/net/*; do
    name="${dev##*/}"
    [[ -e "$dev/device" ]] || continue          # real network cards only (skips lo, bridges)
    [[ "$name" == "${DEFAULT_IF:-}" ]] && continue
    CANDIDATES+=("$name")
  done
  if [[ ${#CANDIDATES[@]} -ne 1 ]]; then
    echo "Couldn't tell which network card is the VLAN one (found: ${CANDIDATES[*]:-none})." >&2
    echo "Check that Adapter 2 is enabled as 'Internal Network' in VirtualBox, then rerun." >&2
    echo "Or name it yourself, for example:  sudo VLAN_IF=enp0s8 bash deploy/vm-init.sh $ROLE" >&2
    exit 1
  fi
  IFACE="${CANDIDATES[0]}"
fi
echo "==> VLAN interface: $IFACE  ->  $IP/24"

# ---- Static IP on the VLAN (netplan) ----
cat > /etc/netplan/60-fischer-vlan.yaml <<EOF
# Fischer VLAN (VirtualBox internal network "fischer-vlan")
network:
  version: 2
  ethernets:
    $IFACE:
      dhcp4: false
      dhcp6: false
      addresses: [$IP/24]
EOF
chmod 600 /etc/netplan/60-fischer-vlan.yaml
netplan generate
netplan apply

# ---- Hostname ----
OLD_HOSTNAME="$(hostname)"
if [[ "$OLD_HOSTNAME" != "$NEW_HOSTNAME" ]]; then
  echo "==> Hostname: $OLD_HOSTNAME -> $NEW_HOSTNAME"
  hostnamectl set-hostname "$NEW_HOSTNAME"
fi
# Make sure the hostname resolves locally (avoids "sudo: unable to resolve host").
if grep -q '^127\.0\.1\.1' /etc/hosts; then
  sed -i "s/^127\.0\.1\.1\s.*/127.0.1.1 $NEW_HOSTNAME/" /etc/hosts
else
  echo "127.0.1.1 $NEW_HOSTNAME" >> /etc/hosts
fi
if [[ -d /etc/cloud/cloud.cfg.d ]]; then
  echo "preserve_hostname: true" > /etc/cloud/cloud.cfg.d/99-fischer-hostname.cfg
fi

# ---- Names for every VM on the VLAN ----
sed -i '/# fischer-vlan$/d' /etc/hosts
cat >> /etc/hosts <<'EOF'
10.10.0.10 fischer-frontend   # fischer-vlan
10.10.0.20 fischer-backend    # fischer-vlan
10.10.0.30 fischer-database   # fischer-vlan
EOF

# ---- Clones only: new identity ----
if [[ "$ROLE" != "frontend" ]]; then
  echo "==> Resetting machine ID and SSH host keys (this VM is a clone)"
  rm -f /etc/machine-id /var/lib/dbus/machine-id
  systemd-machine-id-setup >/dev/null
  rm -f /etc/ssh/ssh_host_*
  ssh-keygen -A >/dev/null
  systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || true

  # The clone inherited nginx from the front end; only the front end serves web pages.
  if systemctl list-unit-files nginx.service >/dev/null 2>&1; then
    systemctl disable --now nginx >/dev/null 2>&1 || true
    echo "==> Disabled nginx (not needed on the $ROLE VM)"
  fi
fi

echo
echo "Done: this VM is $NEW_HOSTNAME at $IP on the Fischer VLAN."
ip -4 -brief addr show "$IFACE"
