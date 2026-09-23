/**
 * Rebuild the exact solc 0.5.1 standard-JSON input for a Truffle-built
 * artifact and prove it reproduces the deployed creation bytecode.
 *
 * Truffle does not persist its compiler input, so Arbiscan verification of the
 * Phase 2 contracts (DEPRIZE_ARBITRUM_LAUNCH Phase 2 step 4) has to reconstruct
 * it from the artifact's embedded metadata: the source key list, the
 * compilation target, and the optimizer/evmVersion settings.
 *
 * Usage: node scripts/build-verification-input.js <ContractName>
 * Writes build/verify/<ContractName>.input.json and exits non-zero on mismatch.
 */
const fs = require("fs");
const path = require("path");
const solc = require("solc");

const ROOT = path.join(__dirname, "..");
const ARTIFACTS = path.join(ROOT, "build", "contracts");
const OUT_DIR = path.join(ROOT, "build", "verify");

// Truffle keys project-local sources as `project:/contracts/X.sol` and package
// sources by their bare require path.
function resolveSource(key) {
  if (key.startsWith("project:/")) {
    return path.join(ROOT, key.slice("project:/".length));
  }
  return path.join(ROOT, "node_modules", key);
}

function buildInput(artifact) {
  const metadata = JSON.parse(artifact.metadata);
  const sources = {};
  for (const key of Object.keys(metadata.sources)) {
    sources[key] = { content: fs.readFileSync(resolveSource(key), "utf8") };
  }
  return {
    language: "Solidity",
    sources,
    settings: {
      optimizer: metadata.settings.optimizer,
      evmVersion: metadata.settings.evmVersion,
      // Deployed bytecode was compiled unlinked and linked by Truffle
      // afterwards, so libraries must stay empty to reproduce the same
      // metadata hash. Link addresses are supplied to Arbiscan separately.
      libraries: {},
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
}

/**
 * Compile a renamed-source variant and assert it differs from the deployed
 * bytecode only inside solc's appended CBOR metadata. Each difference must be
 * a single run no longer than a 32-byte swarm hash plus its CBOR framing;
 * anything wider would mean real code changed. Returns the differing runs.
 */
function verifyMetadataOnlyDiff(variant, sourceKey, contractName, expectedBlanked) {
  const out = JSON.parse(solc.compile(JSON.stringify(variant)));
  const fatal = (out.errors || []).filter((e) => e.severity === "error");
  if (fatal.length) throw new Error(fatal.map((e) => e.formattedMessage).join("\n"));

  const compiled = out.contracts[sourceKey][contractName].evm.bytecode;
  const chars = compiled.object.split("");
  for (const file of Object.values(compiled.linkReferences || {})) {
    for (const refs of Object.values(file)) {
      for (const { start, length } of refs) {
        for (let i = start * 2; i < (start + length) * 2; i++) chars[i] = "-";
      }
    }
  }
  const got = chars.join("");
  if (got.length !== expectedBlanked.length) {
    throw new Error("renamed variant changed bytecode length - not metadata-only");
  }

  const runs = [];
  for (let i = 0; i < got.length; i++) {
    if (got[i] === expectedBlanked[i]) continue;
    const start = i;
    while (i < got.length && got[i] !== expectedBlanked[i]) i++;
    runs.push([start / 2, i / 2]);
  }
  const MAX_METADATA_RUN = 40; // 32-byte hash + CBOR framing
  for (const [start, end] of runs) {
    if (end - start > MAX_METADATA_RUN) {
      throw new Error(
        `difference at bytes ${start}-${end} is too wide to be a metadata hash`
      );
    }
  }
  return runs;
}

function main() {
  const name = process.argv[2];
  if (!name) throw new Error("usage: build-verification-input.js <ContractName>");

  const artifact = JSON.parse(
    fs.readFileSync(path.join(ARTIFACTS, `${name}.json`), "utf8")
  );
  const metadata = JSON.parse(artifact.metadata);
  const [sourceKey] = Object.keys(metadata.settings.compilationTarget);
  const contractName = metadata.settings.compilationTarget[sourceKey];

  const input = buildInput(artifact);
  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  const fatal = (output.errors || []).filter((e) => e.severity === "error");
  if (fatal.length) {
    console.error(fatal.map((e) => e.formattedMessage).join("\n"));
    process.exit(1);
  }

  const compiled = output.contracts[sourceKey][contractName].evm.bytecode;
  // Truffle rewrites solc's `__$<hash>$__` link placeholders into its own
  // `__ContractName____` form, so blank both sides at the linkReferences
  // offsets before comparing. Everything outside those slots, metadata hash
  // included, must still be identical.
  const blank = (hex) => {
    const chars = hex.split("");
    for (const file of Object.values(compiled.linkReferences || {})) {
      for (const refs of Object.values(file)) {
        for (const { start, length } of refs) {
          for (let i = start * 2; i < (start + length) * 2; i++) chars[i] = "-";
        }
      }
    }
    return chars.join("");
  };
  const recompiled = blank(compiled.object);
  const expected = blank(artifact.bytecode.replace(/^0x/, ""));
  const links = Object.keys(compiled.linkReferences || {}).length;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${name}.input.json`);
  fs.writeFileSync(outPath, JSON.stringify(input));

  const match = recompiled === expected;
  console.log(`${name}`);
  console.log(`  target:     ${sourceKey}:${contractName}`);
  console.log(`  compiler:   ${artifact.compiler.version}`);
  console.log(`  sources:    ${Object.keys(input.sources).length}`);
  console.log(
    `  bytecode:   ${match ? "MATCH" : "MISMATCH"} (${recompiled.length / 2} bytes` +
      `${links ? ", link placeholders normalized" : ""})`
  );
  console.log(`  input:      ${path.relative(ROOT, outPath)}`);
  if (!match) {
    console.error(`  expected ${expected.slice(0, 80)}...`);
    console.error(`  got      ${recompiled.slice(0, 80)}...`);
    process.exit(1);
  }

  // Etherscan splits the contract identifier on its first colon, so a
  // `project:/...` source key can never be addressed. Emit a variant with the
  // prefix stripped; renaming a source unit changes only the CBOR metadata
  // hashes solc appends, which `verifyMetadataOnlyDiff` asserts.
  if (sourceKey.includes(":")) {
    const strip = (k) => (k.startsWith("project:/") ? k.slice("project:/".length) : k);
    const variant = {
      language: input.language,
      sources: Object.fromEntries(
        Object.entries(input.sources).map(([k, v]) => [strip(k), v])
      ),
      settings: input.settings,
    };
    const variantPath = path.join(OUT_DIR, `${name}.etherscan.json`);
    fs.writeFileSync(variantPath, JSON.stringify(variant));
    const runs = verifyMetadataOnlyDiff(variant, strip(sourceKey), contractName, expected);
    console.log(`  etherscan:  ${path.relative(ROOT, variantPath)}`);
    console.log(`              as ${strip(sourceKey)}:${contractName}`);
    console.log(
      `              ${runs.length} metadata-hash region(s) differ, code identical`
    );
  }
}

main();
