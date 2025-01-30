module.exports = artifacts => ({
  ammFunding: process.env.REACT_APP_FUNDING || "1" + "0".repeat(18),
  oracle:
    process.env.REACT_APP_ORACLE_ADDRESS || artifacts.require("Migrations").defaults()["from"]
});
