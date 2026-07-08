#!/usr/bin/env bash
#
# Track A of the Frank re-open rollout plan: a full, assertion-backed dry run of the
# re-open sequence against a fork of live Arbitrum, driving the REAL project 73 with
# its REAL contributor set and REAL owner Safe (impersonated). Nothing is broadcast —
# this only simulates the transactions and checks the economics before go-live.
#
# Usage:
#   export ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/<key>   # archive node
#   ./script/dry-run-reopen-arbitrum.sh
#
# Optional overrides (see test/ReopenFrankArbitrumDryRun.t.sol for the full list):
#   FORK_BLOCK=<n>            pin the fork to a specific block for reproducibility
#   TOKENS_PER_ETH=500        contributor issuance rate on the re-open
#   FUNDING_GOAL=<wei>        goal (defaults above the ~26.7 ETH raised)
#   PROJECT_ID / TERMINAL / TEAM_VESTING / MOONDAO_VESTING / POOL_DEPLOYER / ...
#
# Requires: foundry (forge) and an archive-capable Arbitrum RPC.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -z "${ARBITRUM_RPC_URL:-}" && -z "${ARB_RPC_URL:-}" ]]; then
  echo "ERROR: set ARBITRUM_RPC_URL (or ARB_RPC_URL) to an archive-capable Arbitrum RPC." >&2
  echo "       e.g. export ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/<key>" >&2
  exit 1
fi

RPC_URL="${ARBITRUM_RPC_URL:-${ARB_RPC_URL}}"

echo "=== Frank re-open Arbitrum dry run ==="
echo "Forking: ${RPC_URL%%\?*}"
echo

forge test \
  --match-contract ReopenFrankArbitrumDryRun \
  --fork-url "$RPC_URL" \
  -vvv

echo
echo "=== Dry run complete. If every assertion passed, the re-open sequence is safe"
echo "    to execute against project 73 with the real Safe. ==="
