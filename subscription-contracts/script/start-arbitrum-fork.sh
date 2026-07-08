#!/usr/bin/env bash
#
# Track B (Option A): start a local anvil node forking live Arbitrum, with account
# impersonation enabled so we can broadcast the re-open sequence as the project owner
# Safe (no private key needed). Leave this running in its own terminal.
#
# Usage:
#   export ARBITRUM_RPC_URL=https://arbitrum-mainnet.infura.io/v3/<key>
#   ./script/start-arbitrum-fork.sh
#
# Then, in a second terminal, run ./script/run-reopen-on-fork.sh
#
# Optional:
#   FORK_BLOCK=<n>   pin the fork to a block for reproducibility
#   FORK_PORT=8545   port anvil listens on (default 8545)
set -euo pipefail

RPC="${ARBITRUM_RPC_URL:-${ARB_RPC_URL:-}}"
if [[ -z "$RPC" ]]; then
  echo "ERROR: set ARBITRUM_RPC_URL to an Arbitrum RPC to fork from." >&2
  exit 1
fi

PORT="${FORK_PORT:-8545}"
ARGS=(--fork-url "$RPC" --auto-impersonate --port "$PORT" --chain-id 42161)
if [[ -n "${FORK_BLOCK:-}" ]]; then
  ARGS+=(--fork-block-number "$FORK_BLOCK")
fi

echo "=== Starting anvil fork of Arbitrum on http://localhost:$PORT ==="
echo "Impersonation: ON (broadcast as any address, incl. the owner Safe)"
echo "Leave this running; broadcast the re-open from another terminal."
echo
exec anvil "${ARGS[@]}"
