/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * truffleframework.com/docs/advanced/configuration
 *
 * To deploy via Infura you'll need a wallet provider (like truffle-hdwallet-provider)
 * to sign your transactions before they're sent to a remote public node. Infura accounts
 * are available for free at: infura.io/register.
 *
 * You'll also need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. If you're publishing your code to GitHub make sure you load this
 * phrase from a file you've .gitignored so it doesn't accidentally become public.
 *
 */
const path = require("path");
require("dotenv").config();

const HDWalletProvider = require("@truffle/hdwallet-provider");
const mnemonic =
  process.env.REACT_APP_OPERATOR_MNEMONIC ||
  "myth like bonus scare over problem client lizard pioneer submit female collect";

const createInfuraEntry = (networkName, networkId, gasPrice) => ({
  [networkName]: {
    provider: () =>
      new HDWalletProvider(
        mnemonic,
        `https://${networkName}.infura.io/v3/${process.env.REACT_APP_INFURA_ID}`
      ),
    network_id: networkId,
    gasPrice,
    skipDryRun: true,
  },
});

module.exports = {
  contracts_build_directory: path.join(__dirname, "./src/abi"),

  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */

  networks: Object.assign(
    {
      sepolia: {
        provider: () =>
          new HDWalletProvider(
            "syrup meadow cradle earth short actor divide odor brush input prison annual",
            `https://11155111.rpc.thirdweb.com/${process.env.THIRDWEB_TOKEN}`
          ),
        network_id: 11155111, // Ropsten's id
        gasPrice: 12e9,
        //gas: 30000000, // Ropsten has a lower block limit than mainnet
        //confirmations: 2, // # of confs to wait between deployments. (default: 0)
        //timeoutBlocks: 200, // # of blocks before a deployment times out  (minimum/default: 50)
        skipDryRun: false, // Skip dry run before migrations? (default: false for public nets )
      },
      development: {
        host: "127.0.0.1",
        port: 8545,
        network_id: "*",
      },
      arbsep: {
        provider: () =>
          new HDWalletProvider(
            "syrup meadow cradle earth short actor divide odor brush input prison annual",
            `https://421614.rpc.thirdweb.com/${process.env.THIRDWEB_TOKEN}`
          ),
        network_id: 421614, // Ropsten's id
        //gas: 5500000, // Ropsten has a lower block limit than mainnet
        //confirmations: 2, // # of confs to wait between deployments. (default: 0)
        //timeoutBlocks: 200, // # of blocks before a deployment times out  (minimum/default: 50)
        skipDryRun: false, // Skip dry run before migrations? (default: false for public nets )
      },
      arbitrum: {
        provider: () =>
          new HDWalletProvider(
            "syrup meadow cradle earth short actor divide odor brush input prison annual",
            `https://42161.rpc.thirdweb.com/${process.env.THIRDWEB_TOKEN}`
          ),
        network_id: 42161, // Ropsten's id
        //gas: 5500000, // Ropsten has a lower block limit than mainnet
        //confirmations: 2, // # of confs to wait between deployments. (default: 0)
        //timeoutBlocks: 200, // # of blocks before a deployment times out  (minimum/default: 50)
        skipDryRun: false, // Skip dry run before migrations? (default: false for public nets )
      },
    },
    ...[
      ["mainnet", "1", 10000000002],
      ["ropsten", "3"],
      ["rinkeby", "4", 3e9],
      ["goerli", "5", 1e9],
      ["kovan", "42"],
    ].map((data) => createInfuraEntry(...data))

    // Another network with more advanced options...
    // advanced: {
    // port: 8777,             // Custom port
    // network_id: 1342,       // Custom network
    // gas: 8500000,           // Gas sent with each transaction (default: ~6700000)
    // gasPrice: 20000000000,  // 20 gwei (in wei) (default: 100 gwei)
    // from: <address>,        // Account to send txs from (default: accounts[0])
    // websockets: true        // Enable EventEmitter interface for web3 (default: false)
    // },

    // Useful for deploying to a public network.
    // NB: It's important to wrap the provider as a function.

    // Useful for private networks
    // private: {
    // provider: () => new HDWalletProvider(mnemonic, `https://network.io`),
    // network_id: 2111,   // This network is yours, in the cloud.
    // production: true    // Treats this network as if it was a public net. (default: false)
    // }
  ),

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.5.10",
      settings: {
        optimizer: {
          enabled: true,
        },
      },
    },
  },
};
