const deployConfig = require("./utils/deployConfig")(artifacts);
const ConditionalTokens = artifacts.require("ConditionalTokens");

module.exports = function (deployer) {
  deployer.then(async () => {
    const pmSystem = await ConditionalTokens.deployed();
    const markets = require("../markets.config");
    for (const { questionId, numOutcomes } of markets) {
      await pmSystem.prepareCondition(
        deployConfig.oracle,
        questionId,
        numOutcomes
      );
    }
  });
};
