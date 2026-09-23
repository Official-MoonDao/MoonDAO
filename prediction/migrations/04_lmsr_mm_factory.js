const Fixed192x64Math = artifacts.require("Fixed192x64Math");
const LMSRMarketMakerFactory = artifacts.require("LMSRMarketMakerFactory");
const LMSRMarketMaker = artifacts.require("LMSRMarketMaker");

// Deploys the UNMODIFIED Gnosis LMSRMarketMakerFactory
// (@gnosis.pm/conditional-tokens-market-makers 1.8.1, solc 0.5.1). DePrize v2
// has no market-maker subclass; every market is a stock clone from this factory.
module.exports = function (deployer) {
  deployer.link(Fixed192x64Math, LMSRMarketMaker);
  deployer.link(Fixed192x64Math, LMSRMarketMakerFactory);
  // Reuse the factory recorded in the artifact's networks entry so a rerun never
  // diverges from the address in fee-hook/script/base/Config.sol and
  // ui/const/config.ts.
  deployer.deploy(LMSRMarketMakerFactory, { overwrite: false });
};
