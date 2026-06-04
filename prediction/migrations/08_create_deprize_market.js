// Provision a single DePrize prediction market:
//   1. ConditionalTokens.prepareCondition(oracle, questionId, numOutcomes)
//   2. LMSRWithTWAPFactory.createLMSRWithTWAP(ctf, weth, [conditionId], fee=1e16, 0x0, funding)
//
// Reuses the existing Gnosis CTF + LMSRWithTWAP stack. Set DEPRIZE_* env vars
// (see ../deprize.config.js) to target an existing testnet deployment and to
// scope the run to one DePrize. Resolution (reportPayouts) is performed later by
// the oracle (M4) and is out of scope here.
//
// After this runs, wire the printed values into the 0.8 stack:
//   DePrizeRegistry.setCondition(deprizeId, conditionId)
//   DePrizeRegistry.open(deprizeId)
//   DePrizeMint.setMarket(deprizeId, lmsrAddress)
//
// Usage (reusing existing arbitrum-sepolia deployment):
//   DEPRIZE_ORACLE=0x<multisig> DEPRIZE_NUM_OUTCOMES=3 \
//   DEPRIZE_CTF=0xa0B1... DEPRIZE_WETH=0xA441... DEPRIZE_FACTORY=0x<factory> \
//   DEPRIZE_QUESTION_ID=0x...02 \
//   npx truffle migrate -f 8 --to 8 --network arbitrumSepolia

const BN = require("bn.js");

const deployConfig = require("./utils/deployConfig")(artifacts);
const deprizeConfig = require("../deprize.config");

const ConditionalTokens = artifacts.require("ConditionalTokens");
const WETH9 = artifacts.require("WETH9");
const LMSRWithTWAPFactory = artifacts.require("LMSRWithTWAPFactory");

module.exports = function (deployer) {
  deployer.then(async () => {
    const {
      questionId,
      numOutcomes,
      fee,
      fundingPerOutcome,
      conditionalTokensAddress,
      collateralTokenAddress,
      factoryAddress,
    } = deprizeConfig;

    const oracle = deprizeConfig.oracle || deployConfig.oracle;
    if (!oracle) throw new Error("No oracle configured (set DEPRIZE_ORACLE)");

    // Reuse existing deployments when addresses are provided, else fall back to
    // the Truffle-tracked instances on this network.
    const pmSystem = conditionalTokensAddress
      ? await ConditionalTokens.at(conditionalTokensAddress)
      : await ConditionalTokens.deployed();
    const collateralToken = collateralTokenAddress
      ? await WETH9.at(collateralTokenAddress)
      : await WETH9.deployed();
    const factory = factoryAddress
      ? await LMSRWithTWAPFactory.at(factoryAddress)
      : await LMSRWithTWAPFactory.deployed();

    // Total bounded-loss liquidity = fundingPerOutcome * numOutcomes.
    const funding = new BN(fundingPerOutcome).mul(new BN(numOutcomes)).toString();

    console.log("DePrize market provisioning");
    console.log("  oracle:          ", oracle);
    console.log("  questionId:      ", questionId);
    console.log("  numOutcomes:     ", numOutcomes);
    console.log("  fee (1e18 frac): ", fee);
    console.log("  funding (wei):   ", funding);
    console.log("  ConditionalTokens:", pmSystem.address);
    console.log("  Collateral (WETH):", collateralToken.address);
    console.log("  Factory:         ", factory.address);

    // 1. Prepare the CTF condition (oracle = MoonDAO multisig).
    await pmSystem.prepareCondition(oracle, questionId, numOutcomes);
    const conditionId = web3.utils.soliditySha3(
      { t: "address", v: oracle },
      { t: "bytes32", v: questionId },
      { t: "uint", v: numOutcomes }
    );
    console.log("  conditionId:     ", conditionId);

    // 2. Fund + create the LMSRWithTWAP market with the 1% fee.
    await collateralToken.deposit({ value: funding });
    await collateralToken.approve(factory.address, funding);

    const tx = await factory.createLMSRWithTWAP(
      pmSystem.address,
      collateralToken.address,
      [conditionId],
      fee,
      "0x0000000000000000000000000000000000000000",
      funding
    );

    const creationLog = tx.logs.find(
      ({ event }) => event === "LMSRWithTWAPCreation"
    );
    if (!creationLog) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify(tx, null, 2));
      throw new Error(
        "No LMSRWithTWAPCreation event. Check the tx above (outdated ABIs / unfunded LMSR / tx failure)."
      );
    }

    const lmsrAddress = creationLog.args.lmsrWithTWAP;
    console.log("\n=== DePrize market ready ===");
    console.log("conditionId:        ", conditionId);
    console.log("LMSRWithTWAP market:", lmsrAddress);
    console.log("Next (0.8 side):");
    console.log("  registry.setCondition(deprizeId, conditionId)");
    console.log("  registry.open(deprizeId)");
    console.log("  deprizeMint.setMarket(deprizeId, market)");
  });
};
