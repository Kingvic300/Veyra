#!/usr/bin/env bash
# Declare (if needed) and deploy PayrollVault with Starknet Foundry.
# Usage: scripts/deploy-vault.sh <network> <sncast-account> <admin> <threshold> <approver>...
set -euo pipefail

if [ "$#" -lt 5 ]; then
  echo "Usage: $0 <network> <sncast-account> <admin> <threshold> <approver> [approver...]" >&2
  exit 1
fi

NETWORK="$1"; ACCOUNT="$2"; ADMIN="$3"; THRESHOLD="$4"; shift 4
APPROVERS=("$@")

if [ "$THRESHOLD" -lt 1 ] || [ "$THRESHOLD" -gt "${#APPROVERS[@]}" ]; then
  echo "Threshold must be between 1 and the number of approvers (${#APPROVERS[@]})" >&2
  exit 1
fi

cd "$(dirname "$0")/.."
scarb build

echo "Declaring PayrollVault on $NETWORK..."
DECLARE_OUT=$(sncast --account "$ACCOUNT" declare --network "$NETWORK" --contract-name PayrollVault 2>&1 || true)
CLASS_HASH=$(echo "$DECLARE_OUT" | grep -oiE 'class[_ ]hash:? *0x[0-9a-f]+' | grep -oE '0x[0-9a-fA-F]+' | head -1)
if [ -z "$CLASS_HASH" ]; then
  echo "$DECLARE_OUT" >&2
  echo "Could not determine the class hash" >&2
  exit 1
fi
echo "Class hash: $CLASS_HASH"

# Constructor calldata: admin, approvers (Span: length then items), threshold.
CALLDATA=("$ADMIN" "${#APPROVERS[@]}" "${APPROVERS[@]}" "$THRESHOLD")

echo "Deploying with ${#APPROVERS[@]} approvers and threshold $THRESHOLD..."
sncast --account "$ACCOUNT" deploy --network "$NETWORK" --class-hash "$CLASS_HASH" --constructor-calldata "${CALLDATA[@]}"
