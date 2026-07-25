#!/usr/bin/env bash
#
# Track B (Option A): broadcast the Frank re-open onto a running fork node
# (started by script/start-arbitrum-fork.sh). Funds the owner Safe with gas ETH on
# the fork, then deploys the hook, seeds backers, locks the ledger, queues the
# re-open ruleset, and resets the deadline — all impersonating the Safe.
#
# Usage:
#   ./script/run-reopen-on-fork.sh
#
# Optional:
#   FORK_RPC=http://localhost:8545   fork node RPC (default localhost:8545)
#   PROJECT_OWNER=0x...              owner Safe to impersonate (default Frank's Safe)
set -euo pipefail

cd "$(dirname "$0")/.."

FORK_RPC="${FORK_RPC:-http://localhost:8545}"
PROJECT_OWNER="${PROJECT_OWNER:-0xaA1Bd6d001C0000420090EDb36bEAE0D9393B5EA}"

if ! cast chain-id --rpc-url "$FORK_RPC" >/dev/null 2>&1; then
  echo "ERROR: no fork node at $FORK_RPC. Start it first with:" >&2
  echo "       ./script/start-arbitrum-fork.sh" >&2
  exit 1
fi

echo "=== Broadcast Frank re-open to fork at $FORK_RPC ==="
echo "Impersonated Safe: $PROJECT_OWNER"

# Give the Safe gas ETH on the fork (impersonated sends still pay gas).
cast rpc anvil_setBalance "$PROJECT_OWNER" 0x21e19e0c9bab2400000 --rpc-url "$FORK_RPC" >/dev/null
echo "Funded Safe with 10000 ETH (fork-only) for gas."
echo

forge script script/SetupReopenOnFork.s.sol \
  --rpc-url "$FORK_RPC" \
  --broadcast --unlocked \
  --sender "$PROJECT_OWNER" \
  -vvv

echo
echo "=== Re-open is live on the fork ==="
echo "Point the UI at it (from repo root):"
echo "  cd ui && NEXT_PUBLIC_CHAIN=mainnet \\"
echo "    NEXT_PUBLIC_ARBITRUM_RPC_URL=$FORK_RPC yarn dev"
echo "Then open http://localhost:3000/mission/4"
