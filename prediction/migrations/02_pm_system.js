module.exports = function (deployer) {
  // AUDIT[plan Phase 2]: never overwrite a live CTF. First deploy still
  // succeeds when no artifact is recorded; `--reset` on mainnet is forbidden.
  deployer.deploy(artifacts.require("ConditionalTokens"), {
    overwrite: false,
  });
};
