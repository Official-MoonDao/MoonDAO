require("@nomicfoundation/hardhat-toolbox");
require("@tableland/hardhat");
require("@nomicfoundation/hardhat-foundry");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  settings: {
    viaIR: true,
    optimizer: {
      enabled: true,
      details: {
        yulDetails: {
          optimizerSteps: "u",
        },
      },
    },
  },
  localTableland: {
    silent: false,
    verbose: false,
  },
  networks: {
    hardhat: {
    },
    sepolia: {
      url: "https://public.stackup.sh/api/v1/node/ethereum-sepolia",
      accounts: ["39ff551b4720232c1fca846f53458be45350e43ab5a00939aa56b2dc2c28098f"]
    }
  },
};
