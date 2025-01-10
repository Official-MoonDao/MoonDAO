const Fixed192x64Math = artifacts.require("Fixed192x64Math");
const LMSRWithTWAPFactory = artifacts.require("LMSRWithTWAPFactory");
const LMSRMarketMaker = artifacts.require("LMSRMarketMaker");
const LMSRWithTWAP = artifacts.require("LMSRWithTWAP");

module.exports = function (deployer) {
  deployer.link(Fixed192x64Math, LMSRMarketMaker);
  deployer.link(Fixed192x64Math, LMSRWithTWAPFactory);
  deployer.link(Fixed192x64Math, LMSRWithTWAP);
  deployer.deploy(LMSRWithTWAPFactory);
};
