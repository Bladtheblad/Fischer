#!/usr/bin/env bash
# Kept so the Milestone 1 command still works. Same as frontend-deploy.sh.
exec bash "$(dirname "$0")/frontend-deploy.sh" "$@"
