// Provision a single DePrize prediction market (v2):
//   1. ConditionalTokens.prepareCondition(oracle = admin Safe, questionId, numOutcomes)
//   2. LMSRMarketMakerFactory.createLMSRMarketMaker(ctf, weth, [conditionId], fee=1e16, 0x0, funding)
//   3. market.transferOwnership(admin Safe)
//
// Uses the UNMODIFIED Gnosis CTF + LMSRMarketMaker stack. The Safe is both the
// CTF oracle (reportPayouts) and the market owner (pause/close/withdrawFees);
// there is no fee router and no TWAP subclass.
//
// After this runs, wire the printed values into the 0.8 stack with
// subscription-contracts/script/deprize/DePrizeWire.s.sol:
//   registry.setCondition(deprizeId, conditionId)
//   mint.setMarket(deprizeId, lmsrAddress)      (write-once)
//   registry.open(deprizeId)
//
// Usage (reusing an existing deployment):
//   DEPRIZE_ORACLE=0x<admin-safe> DEPRIZE_NUM_OUTCOMES=6 \
//   DEPRIZE_CTF=0x... DEPRIZE_WETH=0x... DEPRIZE_FACTORY=0x<stock-factory> \
//   DEPRIZE_QUESTION_ID=0x... \
//   npm run truffle -- migrate -f 8 --to 8 --network sepolia

const BN = require("bn.js");

const deployConfig = require("./utils/deployConfig")(artifacts);
const deprizeConfig = require("../deprize.config");

const ConditionalTokens = artifacts.require("ConditionalTokens");
const WETH9 = artifacts.require("WETH9");
const LMSRMarketMakerFactory = artifacts.require("LMSRMarketMakerFactory");
const LMSRMarketMaker = artifacts.require("LMSRMarketMaker");

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
    if (!oracle) throw new Error("No oracle configured (set DEPRIZE_ORACLE to the admin Safe)");

    const pmSystem = conditionalTokensAddress
      ? await ConditionalTokens.at(conditionalTokensAddress)
      : await ConditionalTokens.deployed();
    const collateralToken = collateralTokenAddress
      ? await WETH9.at(collateralTokenAddress)
      : await WETH9.deployed();
    const factory = factoryAddress
      ? await LMSRMarketMakerFactory.at(factoryAddress)
      : await LMSRMarketMakerFactory.deployed();

    // Total bounded-loss liquidity = fundingPerOutcome * numOutcomes.
    const funding = new BN(fundingPerOutcome).mul(new BN(numOutcomes)).toString();

    console.log("DePrize market provisioning (v2, stock Gnosis LMSR)");
    console.log("  oracle / owner:  ", oracle);
    console.log("  questionId:      ", questionId);
    console.log("  numOutcomes:     ", numOutcomes);
    console.log("  fee (1e18 frac): ", fee);
    console.log("  funding (wei):   ", funding);
    console.log("  ConditionalTokens:", pmSystem.address);
    console.log("  Collateral (WETH):", collateralToken.address);
    console.log("  Factory:         ", factory.address);

    // 1. Prepare the CTF condition. The oracle is baked into the conditionId and
    //    can never be changed, so it MUST be the admin Safe.
    await pmSystem.prepareCondition(oracle, questionId, numOutcomes);
    const conditionId = web3.utils.soliditySha3(
      { t: "address", v: oracle },
      { t: "bytes32", v: questionId },
      { t: "uint", v: numOutcomes }
    );
    console.log("  conditionId:     ", conditionId);

    // 2. Fund + create the stock market with the 1% fee and no trade whitelist.
    await collateralToken.deposit({ value: funding });
    await collateralToken.approve(factory.address, funding);

    const tx = await factory.createLMSRMarketMaker(
      pmSystem.address,
      collateralToken.address,
      [conditionId],
      fee,
      "0x0000000000000000000000000000000000000000",
      funding
    );

    const creationLog = tx.logs.find(({ event }) => event === "LMSRMarketMakerCreation");
    if (!creationLog) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify(tx, null, 2));
      throw new Error(
        "No LMSRMarketMakerCreation event. Check the tx above (outdated ABIs / unfunded LMSR / tx failure)."
      );
    }
    const lmsrAddress = creationLog.args.lmsrMarketMaker;

    // 3. The factory makes the deployer the owner. Hand the market to the Safe:
    //    pause()/close()/withdrawFees() are onlyOwner and only the Safe may run them.
    const lmsr = await LMSRMarketMaker.at(lmsrAddress);
    await lmsr.transferOwnership(oracle);
    console.log("  LMSR ownership transferred to the Safe:", oracle);

    console.log("\n=== DePrize market ready ===");
    console.log("conditionId:     ", conditionId);
    console.log("LMSR market:     ", lmsrAddress);
    console.log("RECORD the questionId with the conditionId - resolution");
    console.log("(DePrizeResolve.s.sol) needs it and it is not stored on-chain.");
    console.log("Next (0.8 side): forge script script/deprize/DePrizeWire.s.sol");
  });
};
