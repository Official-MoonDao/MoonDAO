/**
 * Committed Truffle network config for the DePrize prediction stack
 * (Gnosis ConditionalTokens + LMSRWithTWAPFactory, Solidity 0.5).
 *
 * AUDIT[plan 1.2]: `prediction/.gitignore` ignores `truffle.js`, so this
 * filename (`truffle-config.js`) is the reproducible, reviewable config.
 * Truffle 5.11 prefers `truffle-config.js` when both exist and prints
 * "Both truffle-config.js and truffle.js were found" - verified 2026-08-18.
 * A local `truffle.js` therefore does not shadow this file, but it will not
 * define an `arbitrum` network either; keep mainnet runs on this config.
 *
 * Env:
 *   PRIVATE_KEY          hex key (with or without 0x) — the deployer EOA
 *   ARBITRUM_RPC_URL     defaults to the public Arb1 endpoint
 *   ARB_SEPOLIA_RPC_URL  defaults to the public Arb-Sepolia endpoint
 *
 * Phase 2 (shared infra, once):  npm run truffle -- migrate -f 2 --to 4 --network arbitrum
 *   Skip 05 (WETH9) — use canonical aeWETH via DEPRIZE_WETH on migration 08.
 * Phase 4 (per DePrize):         npm run truffle -- migrate -f 8 --to 8 --network arbitrum
 */
require("dotenv").config();

const HDWalletProvider = require("@truffle/hdwallet-provider");

function hd(rpcEnv, fallbackRpc) {
  const key = process.env.PRIVATE_KEY;
  if (!key) {
    throw new Error("PRIVATE_KEY is required for this Truffle network");
  }
  return () =>
    new HDWalletProvider(key.replace(/^0x/i, ""), process.env[rpcEnv] || fallbackRpc);
}

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },
    // AUDIT[plan Phase 2]: chain id 42161. Do not `--reset` on mainnet.
    // Truffle multiplies `gas` by the quoted price for its funds preflight, so
    // a 30M limit needs an implausible balance. Arb1 base fee sat at ~0.02 gwei
    // for the Phase 2 deploys; raise `gasPrice` if a run reports
    // "max fee per gas less than block base fee".
    arbitrum: {
      provider: hd("ARBITRUM_RPC_URL", "https://arb1.arbitrum.io/rpc"),
      network_id: 42161,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
      gas: 12_000_000,
      gasPrice: 50_000_000, // 0.05 gwei; Arb effective is ~0.02 gwei
    },
    arbitrumSepolia: {
      provider: hd("ARB_SEPOLIA_RPC_URL", "https://sepolia-rollup.arbitrum.io/rpc"),
      network_id: 421614,
      confirmations: 1,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
    // Alias used by older README / migration comments.
    arbsep: {
      provider: hd("ARB_SEPOLIA_RPC_URL", "https://sepolia-rollup.arbitrum.io/rpc"),
      network_id: 421614,
      confirmations: 1,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
  },
  compilers: {
    solc: {
      // Gnosis CTF + LMSR market makers are ^0.5.1.
      version: "0.5.1",
      settings: {
        optimizer: { enabled: true, runs: 200 },
        evmVersion: "constantinople",
      },
    },
  },
};
