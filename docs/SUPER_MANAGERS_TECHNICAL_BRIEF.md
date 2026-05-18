# Super-Manager Operators — Technical Brief

**Branch:** `Teams-Wins`  
**Author:** Miguel 
**Date:** May 18, 2026  
**Status:** Deployed to Arbitrum One ✅

---

## Why this change exists

Pablo and Ryan need to be able to create, edit, and delete **job postings** and **marketplace listings** for any MoonDAO team — acting as super-managers who help teams populate their pages.

Before this change, the `JobBoardTable` and `MarketplaceTable` contracts only allowed two roles to write rows:

1. The **contract owner** (deployer wallet)
2. An **on-chain hat-wearer** — i.e., an address that holds the specific manager hat for that particular team

Pablo and Ryan are not the hat-wearing manager of every team, so the UI blocked them even though the intent was always for them to have global write access. A UI-only workaround was not viable because the *contracts themselves* enforce the permission check on every write.

---

## What was changed

### 1. New `operators` allowlist in both table contracts

A single new storage mapping and two functions were added to both `JobBoardTable` and `MarketplaceTable`:

```solidity
// New state
mapping(address => bool) public operators;

// New event
event OperatorSet(address indexed operator, bool enabled);

// New admin function
function setOperator(address operator, bool enabled) external onlyOwner {
    operators[operator] = enabled;
    emit OperatorSet(operator, enabled);
}
```

A private helper replaces the four inline permission checks that existed before:

```solidity
function _isAuthorized(uint256 teamId) internal view {
    if (msg.sender == owner() || operators[msg.sender]) return;
    require(_moonDaoTeam.isManager(teamId, msg.sender), "Only Manager, Operator, or Owner can write");
}
```

**Every** write path (`insertIntoTable`, `updateTable`, `updateTableCol`, `deleteFromTable`) now calls `_isAuthorized`. The logic is:

```
if caller == contract owner  → allow
if caller is a registered operator  → allow
otherwise  → require caller holds the team's manager hat on-chain
```

Nothing else changed. Row-ownership integrity checks (`idToTeamId` on update/delete) are fully preserved.

### 2. New contracts deployed on Arbitrum One

Two new contracts were deployed because the old ones had no upgrade path:

| Contract | Old address | New address | Tableland table |
|---|---|---|---|
| `JobBoardTable` | `0x9dC3…` | `0x2113341dEc8a0fB9883Ad494C589d5cdefDDBc1b` | `JOBBOARD_42161_158` |
| `MarketplaceTable` | `0xF2Ca…` | `0xF0AeE0c837943fa1919538B12b5d9AE11C5EED05` | `MARKETPLACE_42161_159` |

Pablo (`0x679d87d8640e66778c3419d164998e720d7495f6`) and Ryan (`0xb2d3900807094d4fe47405871b0c8adb58e10d42`) were immediately set as operators on both contracts after deployment.

### 3. All existing data migrated

All rows from the old tables were migrated to the new ones before the old addresses were removed from the UI:

- **11 job postings** migrated → `JOBBOARD_42161_158`
- **13 marketplace listings** migrated → `MARKETPLACE_42161_159`

Migration was verified against the live Tableland API.

### 4. UI config updated (`ui/const/config.ts`)

```ts
// Super-manager addresses checked in the UI before on-chain calls
export const SUPER_MANAGERS = [
  "0x679d87d8640e66778c3419d164998e720d7495f6", // Pablo
  "0xb2d3900807094d4fe47405871b0c8adb58e10d42", // Ryan
];

// Updated contract addresses
JOBS_TABLE_ADDRESSES.arbitrum     = "0x2113341dEc8a0fB9883Ad494C589d5cdefDDBc1b"
MARKETPLACE_TABLE_ADDRESSES.arbitrum = "0xF0AeE0c837943fa1919538B12b5d9AE11C5EED05"
```

The `useTeamData` hook checks `SUPER_MANAGERS` first so the UI shows the correct manager controls without an unnecessary RPC call. The contracts enforce the same rule independently.

---

## Security analysis

### What the change adds

| Surface | Risk | Mitigation |
|---|---|---|
| `setOperator(addr, true)` grants global write access | An operator can write to **any** team's job board / marketplace | `setOperator` is `onlyOwner` — only the deployer wallet can add or remove operators |
| Operators exist as a static list in contract storage | If a wallet is compromised, it can spam rows | `setOperator(addr, false)` revokes access in a single transaction, effective immediately |
| Two addresses now have elevated write access | Larger blast radius than before | Pablo and Ryan are existing trusted contributors; the existing Safe multisig (`0x29B0…75cB`) controls the deployer wallet and can revoke at any time |

### What the change does NOT add

- **No new ownership transfer capability.** Operators cannot call `transferOwnership`, `setOperator`, or any other admin function.
- **No privilege escalation.** An operator cannot grant operator status to anyone else.
- **No row tampering protection regression.** The `idToTeamId` check is intact — an operator who inserts a row for team A cannot later delete or update it while claiming it belongs to team B.
- **No change to the Tableland controller mapping.** The on-chain ACL that governs who can mutate the Tableland SQL table directly is unchanged.
- **No change to any other contract.** `MoonDAOTeam`, `MoonDAOTeamCreator`, citizen contracts, governance, and the fee hook are untouched.

### Revoking an operator

If either address needs to be removed:

```bash
cast send 0x2113341dEc8a0fB9883Ad494C589d5cdefDDBc1b \
  "setOperator(address,bool)" 0x679d87d8640e66778c3419d164998e720d7495f6 false \
  --rpc-url arbitrum --private-key $DEPLOYER_KEY

cast send 0xF0AeE0c837943fa1919538B12b5d9AE11C5EED05 \
  "setOperator(address,bool)" 0x679d87d8640e66778c3419d164998e720d7495f6 false \
  --rpc-url arbitrum --private-key $DEPLOYER_KEY
```

Revocation takes effect on the next block. No migration or redeployment needed.

---

## Tests

A full Forge test suite was written at `subscription-contracts/test/TableOperatorsTest.t.sol`.

**37 tests, all passing.**

```
Suite result: ok. 37 passed; 0 failed; 0 skipped
```

### Test matrix

| ID | Scenario | Expected | Result |
|---|---|---|---|
| A1 | Owner inserts without being a hat-wearing manager | ✅ allowed | PASS |
| A2 | Pablo (operator) inserts for any team | ✅ allowed | PASS |
| A2b | Ryan (operator) inserts for any team | ✅ allowed | PASS |
| A3 | Hat-wearing team manager inserts for their team | ✅ allowed | PASS |
| A4 | Stranger attempts to insert | ❌ reverts | PASS |
| A5 | Owner updates a row | ✅ allowed | PASS |
| A6 | Operator updates any row | ✅ allowed | PASS |
| A7 | Stranger attempts to update | ❌ reverts | PASS |
| A8 | Owner deletes a row | ✅ allowed | PASS |
| A9 | Operator deletes any row | ✅ allowed | PASS |
| A10 | Stranger attempts to delete | ❌ reverts | PASS |
| A11 | Revoked operator attempts to insert | ❌ reverts | PASS |
| A12 | Stranger calls `setOperator` | ❌ reverts | PASS |
| A12b | Operator calls `setOperator` (self-escalation attempt) | ❌ reverts | PASS |
| A13 | `OperatorSet` event emitted on grant | ✅ event fired | PASS |
| A13b | `OperatorSet` event emitted on revoke | ✅ event fired | PASS |
| A14 | Update with mismatched `teamId` | ❌ reverts | PASS |
| A15 | Delete with mismatched `teamId` | ❌ reverts | PASS |
| A16 | `currId` increments per insert | ✅ 0→1→2→3 | PASS |
| A17 | `idToTeamId` mapping written on insert | ✅ correct | PASS |
| B1–B13 | Full mirror of A1–A13 for `MarketplaceTable` | same | PASS |
| C1 | Pablo + Ryan are operators on both contracts | ✅ | PASS |
| C2 | `_moonDaoTeam` set on both contracts | ✅ | PASS |
| C3 | `currId` starts at 0 on fresh deployment | ✅ | PASS |

---

## Summary

| Question | Answer |
|---|---|
| Can Pablo/Ryan now post jobs/listings for any team? | **Yes** — they are registered operators on both live contracts |
| Can they change contract ownership? | **No** |
| Can they grant operator access to others? | **No** |
| Can they tamper with another team's existing rows? | **No** — `idToTeamId` integrity checks are unchanged |
| Can their access be revoked? | **Yes** — one transaction by the deployer wallet |
| Was any existing data lost? | **No** — 11 jobs + 13 listings were migrated before the old addresses were removed |
| Are there tests? | **Yes** — 37 Forge tests, all passing |
