/**
 * Submit a reconstructed standard-JSON input to Arbiscan (Etherscan V2) and
 * poll until the verification result is known.
 *
 * Run `build-verification-input.js <Contract>` first — it proves the input
 * reproduces the deployed bytecode. This script only uploads it.
 *
 * Usage:
 *   ETHERSCAN_API_KEY=... node scripts/verify-on-arbiscan.js <Contract> <address> [Library=0xaddr ...]
 *
 * CONTRACT_NAME_OVERRIDE overrides the `path:Name` identifier. Truffle keys
 * project-local sources as `project:/contracts/X.sol`, and Etherscan splits
 * that identifier on its first colon, so the qualified form is unusable for
 * those contracts.
 */
const fs = require("fs");
const path = require("path");

const CHAIN_ID = 42161;
const API = "https://api.etherscan.io/v2/api";
const ROOT = path.join(__dirname, "..");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(params) {
  const res = await fetch(`${API}?chainid=${CHAIN_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  return res.json();
}

async function main() {
  const [name, address, ...libs] = process.argv.slice(2);
  const apikey = process.env.ETHERSCAN_API_KEY;
  if (!name || !address) throw new Error("usage: verify-on-arbiscan.js <Contract> <address> [Lib=0x...]");
  if (!apikey) throw new Error("ETHERSCAN_API_KEY is required");

  const artifact = JSON.parse(
    fs.readFileSync(path.join(ROOT, "build", "contracts", `${name}.json`), "utf8")
  );
  const metadata = JSON.parse(artifact.metadata);
  const [sourceKey] = Object.keys(metadata.settings.compilationTarget);
  const contractName = metadata.settings.compilationTarget[sourceKey];
  const inputFile = process.env.INPUT_FILE || `${name}.input.json`;
  const sourceCode = fs.readFileSync(
    path.join(ROOT, "build", "verify", inputFile),
    "utf8"
  );

  const params = {
    module: "contract",
    action: "verifysourcecode",
    apikey,
    contractaddress: address,
    sourceCode,
    codeformat: "solidity-standard-json-input",
    contractname: process.env.CONTRACT_NAME_OVERRIDE || `${sourceKey}:${contractName}`,
    compilerversion: `v${artifact.compiler.version.replace(/\.Emscripten\.clang$/, "")}`,
    constructorArguements: "",
  };
  // Library links live outside the standard-JSON input so the compiled
  // metadata hash keeps matching the unlinked deployment.
  libs.forEach((entry, i) => {
    const [libName, libAddress] = entry.split("=");
    params[`libraryname${i + 1}`] = libName;
    params[`libraryaddress${i + 1}`] = libAddress;
  });

  const submitted = await post(params);
  if (submitted.status !== "1") {
    console.error(`${name}: submit failed - ${submitted.result}`);
    process.exit(1);
  }
  const guid = submitted.result;
  console.log(`${name} submitted (guid ${guid})`);

  for (let attempt = 0; attempt < 20; attempt++) {
    await sleep(5000);
    const check = await post({
      module: "contract",
      action: "checkverifystatus",
      apikey,
      guid,
    });
    if (check.result === "Pending in queue") continue;
    const ok = check.status === "1" || /already verified/i.test(check.result);
    console.log(`${name}: ${check.result}`);
    console.log(`  https://arbiscan.io/address/${address}#code`);
    process.exit(ok ? 0 : 1);
  }
  console.error(`${name}: still pending after polling`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
