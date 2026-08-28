const Fixed192x64Math = artifacts.require("Fixed192x64Math");
const LMSRWithTWAPFactory = artifacts.require("LMSRWithTWAPFactory");
const LMSRMarketMaker = artifacts.require("LMSRMarketMaker");
const LMSRWithTWAP = artifacts.require("LMSRWithTWAP");

module.exports = function (deployer) {
  deployer.link(Fixed192x64Math, LMSRMarketMaker);
  deployer.link(Fixed192x64Math, LMSRWithTWAPFactory);
  deployer.link(Fixed192x64Math, LMSRWithTWAP);
  // Match migrations 02 and 03: reuse the factory recorded in the artifact's
  // networks entry. Redeploying would silently diverge from the address in
  // fee-hook/script/base/Config.sol and ui/const/config.ts.
  deployer.deploy(LMSRWithTWAPFactory, { overwrite: false });
};
