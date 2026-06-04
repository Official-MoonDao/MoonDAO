// Per-DePrize market provisioning config, consumed by
// migrations/08_create_deprize_market.js.
//
// Each DePrize needs its own CTF condition + LMSRWithTWAP market. Bump
// `questionId` for every new DePrize so conditions never collide, and set
// `numOutcomes` to the number of competing teams (the DePrize's outcome slots,
// in the same order as `DePrizeRegistry.teamIds`).
//
// Overridable via env vars so the same migration can provision against a fresh
// deployment or reuse existing CTF/WETH/factory deployments on a testnet.

const ONE_ETH = "1" + "0".repeat(18);

module.exports = {
  // bytes32 question id, unique per DePrize.
  questionId:
    process.env.DEPRIZE_QUESTION_ID ||
    "0x0000000000000000000000000000000000000000000000000000000000000001",

  // Number of competing teams = CTF outcome slots.
  numOutcomes: parseInt(process.env.DEPRIZE_NUM_OUTCOMES || "3", 10),

  // LMSR fee as a fraction of 1e18. 1e16 = 1% (the DePrize swap/protocol fee).
  fee: process.env.DEPRIZE_FEE || "10000000000000000",

  // Treasury seed for the market maker (bounded-loss liquidity). The design doc
  // targets ~1 ETH per team; scaled by numOutcomes unless DEPRIZE_FUNDING is set.
  fundingPerOutcome: process.env.DEPRIZE_FUNDING_PER_OUTCOME || ONE_ETH,

  // Oracle that will call reportPayouts at resolution (MoonDAO multisig/EOA).
  // Falls back to deployConfig.oracle (REACT_APP_ORACLE_ADDRESS or deployer).
  oracle: process.env.DEPRIZE_ORACLE || process.env.REACT_APP_ORACLE_ADDRESS || null,

  // Optional: reuse already-deployed prediction-market contracts (testnet).
  // When unset, the migration uses the Truffle `.deployed()` artifacts.
  conditionalTokensAddress: process.env.DEPRIZE_CTF || null,
  collateralTokenAddress: process.env.DEPRIZE_WETH || null,
  factoryAddress: process.env.DEPRIZE_FACTORY || null,
};
