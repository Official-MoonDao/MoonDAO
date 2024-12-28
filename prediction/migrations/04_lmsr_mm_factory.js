const Fixed192x64Math = artifacts.require("Fixed192x64Math");
const LMSRMarketMakerFactory = artifacts.require("LMSRMarketMakerFactory");
const LMSRMarketMaker = artifacts.require("LMSRMarketMaker");

module.exports = function(deployer) {
  deployer.link(Fixed192x64Math, LMSRMarketMakerFactory);
  deployer.link(Fixed192x64Math, LMSRMarketMaker);
  deployer.deploy(LMSRMarketMakerFactory);
};
