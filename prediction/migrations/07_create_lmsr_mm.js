const Decimal = require("decimal.js-light");
Decimal.config({ precision: 30 });

const deployConfig = require("./utils/deployConfig")(artifacts);

module.exports = function (deployer) {
  deployer.then(async () => {
    const markets = require("../markets.config");
    const conditionIds = markets.map(({ questionId, numOutcomes }) =>
      web3.utils.soliditySha3(
        { t: "address", v: deployConfig.oracle },
        { t: "bytes32", v: questionId },
        { t: "uint", v: numOutcomes }
      )
    );

    const WETH9 = artifacts.require("WETH9");
    const collateralToken = await WETH9.deployed();

    const lmsrMarketMakerFactory = await artifacts
      .require("LMSRWithTWAPFactory")
      .deployed();

    console.log("Collateral Token Address: ", collateralToken.address);
    const { ammFunding } = deployConfig;
    await collateralToken.deposit({ value: ammFunding });
    await collateralToken.approve(lmsrMarketMakerFactory.address, ammFunding);

    // Get conditional tokens
    const conditionalTokens = await artifacts
      .require("ConditionalTokens")
      .deployed();

    console.log("creating LMSR Market Maker");
    console.log("conditionIds: ", conditionIds);
    const lmsrFactoryTx = await lmsrMarketMakerFactory.createLMSRWithTWAP(
      conditionalTokens.address,
      collateralToken.address,
      conditionIds,
      0,
      "0x0000000000000000000000000000000000000000",
      ammFunding
    );
    console.log("LMSR Market Maker created");

    const creationLogEntry = lmsrFactoryTx.logs.find(
      ({ event }) => event === "LMSRWithTWAPCreation"
    );

    if (!creationLogEntry) {
      // eslint-disable-next-line
      console.error(JSON.stringify(lmsrFactoryTx, null, 2));
      throw new Error(
        "No LMSRWithTWAPCreation Event fired. Please check the TX above.\nPossible causes for failure:\n- ABIs outdated. Delete the build/ folder\n- Transaction failure\n- Unfunded LMSR"
      );
    }

    const lmsrAddress = creationLogEntry.args.lmsrWithTWAP;
    console.log("LMSR Market Maker Address: ", lmsrAddress);
    console.log("Conditional Tokens Address: ", conditionalTokens.address);
  });
};
