const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("CitizenModule", (m) => {
  const tablePrefix = m.getParameter("_table_prefix", "CITIZEN TABLELAND");

  const citizenTable = m.contract("MoonDaoCitizenTableland", [tablePrefix]);

  return { citizenTable };
});