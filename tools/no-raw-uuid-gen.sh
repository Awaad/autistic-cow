#!/usr/bin/env bash
# ADR-001 guard: IDs are minted ONLY in core/ids.py.
set -uo pipefail
hits=$(grep -rn "uuid4()\|uuid_utils" server/app --include="*.py" | grep -v "core/ids.py" || true)
if [ -n "$hits" ]; then
  echo "ADR-001 violated — raw uuid generation outside core/ids.py:"
  echo "$hits"
  exit 1
fi
echo "ADR-001 OK — id generation is centralized"