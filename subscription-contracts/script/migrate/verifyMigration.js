const TABLE_NAME = "CITIZENTABLE_42161_125";
const ENV = "mainnet";
const tablelandEndpoint = `https://${
  ENV != "mainnet" ? "testnets." : ""
}tableland.network/api/v1/query`;

async function verifyMigration() {
  const statement = `SELECT * FROM ${TABLE_NAME}`;
  const res = await fetch(`${tablelandEndpoint}?statement=${statement}`);
  const data = await res.json();
  console.log(data);
}

verifyMigration();
