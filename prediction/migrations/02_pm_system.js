module.exports = function (deployer) {
  // Reuse the live CTF recorded in the checked-in artifact's networks entry.
  // A first deploy on a network with no recorded address still succeeds.
  deployer.deploy(artifacts.require("ConditionalTokens"), {
    overwrite: false,
  });
};
