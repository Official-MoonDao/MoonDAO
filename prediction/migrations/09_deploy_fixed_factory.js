// Deploy a new LMSRWithTWAPFactory whose constructor mints the H-01-fixed
// implementationMaster. The Phase 2 factory (migration 04, overwrite: false)
// still points at the vulnerable implementation; do not reuse it for new markets.
//
//   cd prediction && npm run truffle -- migrate -f 9 --to 9 --network sepolia
//   cd prediction && npm run truffle -- migrate -f 9 --to 9 --network arbitrum
//
// Arbitrum reuses the live Fixed192x64Math library. Sepolia deploys a fresh one
// unless DEPRIZE_MATH is set.

const EXISTING_MATH = {
  arbitrum: "0x6cc53E9158aeFd3aB65B1B053844D083C4b7C53b",
};

module.exports = function (deployer, network) {
  const Fixed192x64Math = artifacts.require("Fixed192x64Math");
  const LMSRMarketMaker = artifacts.require("LMSRMarketMaker");
  const LMSRWithTWAP = artifacts.require("LMSRWithTWAP");
  const LMSRWithTWAPFactory = artifacts.require("LMSRWithTWAPFactory");

  deployer.then(async () => {
    const configuredMath = process.env.DEPRIZE_MATH || EXISTING_MATH[network];
    if (configuredMath) {
      Fixed192x64Math.address = configuredMath;
      console.log("Reuse Fixed192x64Math", configuredMath);
    } else {
      await deployer.deploy(Fixed192x64Math);
      console.log("Deployed Fixed192x64Math", Fixed192x64Math.address);
    }

    deployer.link(Fixed192x64Math, LMSRMarketMaker);
    deployer.link(Fixed192x64Math, LMSRWithTWAP);
    deployer.link(Fixed192x64Math, LMSRWithTWAPFactory);
    await deployer.deploy(LMSRWithTWAPFactory);

    const factory = await LMSRWithTWAPFactory.deployed();
    const impl = await factory.implementationMaster();
    console.log("=== H-01 fixed factory ===");
    console.log("  network:              ", network);
    console.log("  LMSRWithTWAPFactory:  ", factory.address);
    console.log("  implementationMaster: ", impl);
  });
};
