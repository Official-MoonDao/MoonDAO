# Contributions table: schema, permissions and Tableland launch plan

This plan is the first, deliberately small version of the onchain `Contribution` table from the
[Contributions 2.0 spec](https://github.com/ryand2d/MoonDAO/commit/53528f19ea528570001370c614deb97d6b5b9fbf)
(`docs/CONTRIBUTIONS_2.0_SPEC.md` in that commit). It is built and deployed the same way as our
other tables: a contract in `subscription-contracts/src/tables/`, a `forge script` deploy, and the
table name in `ui/const/config.ts`.

Start simple and add features later (§7). Each later feature is either a new table that references
contribution IDs, or a v2 contract with a row migration, as we did for `CitizenTableV2`.

---

## 1. Simplifying assumptions

1. **One author per contribution.** The author is the citizen who sends the transaction
   (`msg.sender`). There are no collaborators or shares.
2. **A cycle is just a number.** The contract stores `currentCycleId`, and every new contribution
   goes into it. When the payout script runs for that cycle, it calls `closeCycle()`, which
   increments the counter. No dates are stored. A cycle is simply the time between two payouts,
   so moving from quarterly to monthly or weekly payouts needs no change.
3. **The contract doesn't score anything.** The payout script decides each contribution's share
   and records the outcome on the contribution's row. There is one result per contribution and no
   separate Senate result.
4. **One contract and one table.** Results are columns on the contribution row, so there are no
   joins.
5. **Citizens pay their own gas.** That's a few cents on Arbitrum, the same as votes and profile
   edits today. Relayed (gasless) writes come later.
6. **No import of history.** The Google Sheet stays the record for past cycles.

---

## 2. How Tableland constrains the design

These four constraints hold even for the simple version. They come from the pinned registry
(`lib/evm-tableland` at `dc35d2a`) and our existing tables.

1. **The contract can't read its table.** SQL is emitted in an event and executed later by the
   validator. Any rule that depends on existing rows (who the author is, which cycle a
   contribution is in, whether results were already recorded) must be checked against contract
   storage. `JobBoardTable` does the same with `idToTeamId`.
2. **A rejected statement doesn't revert the transaction.** If the validator rejects the SQL, the
   transaction still succeeds and storage has already changed. The contract therefore validates
   inputs itself, and the schema has no UNIQUE or CHECK constraints that could fail.
3. **A controller would be a second way in.** With no controller set, only the table owner (the
   contract) can write. A controller contract, once set, decides access for everyone, owner
   included. We don't need one, so the constructor calls `lockController` and nobody can ever add
   one.
4. **`SQLHelpers.quote` doesn't escape.** It only wraps text in single quotes, so a title
   containing `'` could close the literal and inject SQL. Every text field goes through an
   escaping helper (§4.3). Existing tables have this problem too (§8).

---

## 3. Table

One table, `CONTRIBUTIONS`, owned by `Contributions.sol`:

```
id integer primary key,
cycleId integer not null,
author text not null,
title text not null,
description text not null,
area text not null,
links text not null,
metadata text not null,
hidden integer not null,
createdAt integer not null,
updatedAt integer not null,
shareBps integer not null,
reward text not null
```

| Column | Written by | Notes |
| --- | --- | --- |
| `id` | Contract counter, starting at 1 | Stable ID for the feed, profiles, briefings and payouts |
| `cycleId` | Contract (`currentCycleId` at submit time) | Never changes |
| `author` | Contract (`msg.sender`, lowercase hex) | Never changes. Profiles join on `CITIZENTABLE.owner` |
| `title` | Author | ≤ 120 bytes |
| `description` | Author | ≤ 2,000 bytes |
| `area` | Author | ≤ 32 bytes. The UI offers today's categories (outreach, community, content, technical, research, other); the contract doesn't enforce them |
| `links` | Author | ≤ 1,000 bytes, free text. The UI only turns `https://` URLs into links |
| `metadata` | Author | ≤ 1,000 bytes. JSON for optional fields we don't want columns for yet, such as time commitment, a related project ID or an IPFS CID. The same idea as `JobBoardTable.metadata`. Stored as plain text, so readers parse it defensively |
| `hidden` | Operators | `0` or `1`. Hidden rows stay in the table, but the UI doesn't show them |
| `createdAt`, `updatedAt` | Contract (`block.timestamp`) | These also give a cycle's rough dates if we ever need them |
| `shareBps` | Payout script | `0` until results are recorded. The contribution's share of the cycle's pool, in basis points |
| `reward` | Payout script | `''` until results are recorded, then JSON of what was paid, e.g. `{"USDC":"120.50","vMOONEY":"5000"}`. `{}` means scored but unpaid |

Example reads:

```sql
-- A citizen's profile
SELECT * FROM CONTRIBUTIONS_42161_x
WHERE author = '0xabc…' AND hidden = 0
ORDER BY cycleId DESC, createdAt DESC

-- The current cycle's submissions, for review and the payout script
SELECT * FROM CONTRIBUTIONS_42161_x WHERE cycleId = :current AND hidden = 0
```

The UI can show "Cycle 3". If we want "Q4 2026" instead, add an optional ID-to-label map in
`ui/const/config.ts`; that's display only.

---

## 4. Permissions

### 4.1 Who can do what

This follows the `Ownable` plus `operators` pattern from `JobBoardTable`.

| Who | Can | Checks |
| --- | --- | --- |
| **Citizen** (holds an unexpired Citizen NFT) | `submit` into the current cycle | `balanceOf(sender) > 0` and `expiresAt(getOwnedToken(sender)) > now`. Below `maxPerCycle` for this cycle. Field size limits |
| **Author** | `update` or `remove` their own contribution | Caller is the stored author, is still a citizen, and the contribution's cycle is still the current one |
| **Operator** (ops wallets, or the payout script's wallet) | `setHidden(id, bool)` | The contribution exists |
| **Operator** | `closeCycle()` | None. Increments `currentCycleId` and emits `CycleClosed(cycleId)` |
| **Operator** | `recordResults(cycleId, ids, shareBps, rewards)` | `cycleId < currentCycleId`. Every ID belongs to that cycle, still exists, and has no result yet |
| **Owner** (Admin Safe) | Everything operators can do, plus `setOperator`, `setCitizenNFT` and `setMaxPerCycle` | `onlyOwner` |

### 4.2 What nobody can do

- Write a contribution on someone else's behalf, or change `author`, `cycleId` or `createdAt`.
- Edit or remove a contribution once its cycle is closed. Closing a cycle locks its contributions.
- Change results once they've been recorded. Results are written once per contribution.
- Edit anyone's content, the owner included. There's no generic `updateTableCol(id, col, val)`
  like `Project.sol` has.
- Send SQL to the table directly, set a controller, or move the table NFT out of the contract.

### 4.3 Escaping

Every text field goes through one helper before it reaches SQL. It doubles each `'`, rejects NUL
bytes, and the caller enforces the byte limits from §3. Numbers go through `Strings.toString`, and
addresses go through `Strings.toHexString`.

```solidity
function _sqlString(string memory s) internal pure returns (string memory) {
    bytes memory b = bytes(s);
    uint256 quotes;
    for (uint256 i; i < b.length; ++i) {
        if (b[i] == 0x00) revert InvalidText();
        if (b[i] == 0x27) ++quotes;
    }
    bytes memory out = new bytes(b.length + quotes + 2);
    out[0] = 0x27;
    uint256 j = 1;
    for (uint256 i; i < b.length; ++i) {
        out[j++] = b[i];
        if (b[i] == 0x27) out[j++] = 0x27;
    }
    out[j] = 0x27;
    return string(out);
}
```

The UI renders every field as plain text, never as HTML.

### 4.4 The cycle and payout flow

1. Citizens submit during the cycle. Authors can fix or remove their own contributions while the
   cycle is still open.
2. The payout script reads the cycle's rows and works out shares and rewards, by Senate review
   today and by matchups later.
3. The script calls `closeCycle()`. New submissions now go into the next cycle, and the closed
   cycle's contributions are locked.
4. The script calls `recordResults(...)` for the closed cycle, in batches if needed. The batches
   use the registry's multi-statement `mutate`, one `UPDATE` per contribution.

The script can send these calls from an operator wallet, or add them to the payout Safe batch so
they land in the same transaction as the payments. If reviewers want a frozen list before the
payout, run `closeCycle()` when review starts instead; the contract works either way.

---

## 5. Contract outline

`subscription-contracts/src/tables/Contributions.sol`:

```solidity
contract Contributions is ERC721Holder, Ownable {
    struct Entry { address author; uint64 cycleId; bool hasResult; }

    uint256 public currentCycleId = 1;
    uint256 public nextId = 1;
    uint256 public maxPerCycle;
    IMoonDAOCitizen public citizenNFT;
    mapping(address => bool) public operators;
    mapping(uint256 => Entry) public entries;
    mapping(uint256 => mapping(address => uint256)) public countInCycle;

    constructor(string memory prefix, address citizenNFT_, uint256 maxPerCycle_); // creates table, locks controller

    function submit(string calldata title, string calldata description, string calldata area,
        string calldata links, string calldata metadata) external returns (uint256 id);
    function update(uint256 id, string calldata title, string calldata description,
        string calldata area, string calldata links, string calldata metadata) external;
    function remove(uint256 id) external;

    function setHidden(uint256 id, bool hidden) external;
    function closeCycle() external;
    function recordResults(uint256 cycleId, uint256[] calldata ids, uint256[] calldata shareBps,
        string[] calldata rewards) external;

    function setOperator(address operator, bool enabled) external onlyOwner;
    function setCitizenNFT(address citizenNFT_) external onlyOwner;
    function setMaxPerCycle(uint256 max) external onlyOwner;

    function getTableId() external view returns (uint256);
    function getTableName() external view returns (string memory);
}
```

Events: `ContributionSubmitted`, `ContributionUpdated`, `ContributionRemoved`, `HiddenSet`,
`CycleClosed` and `ResultRecorded`, each indexed by `id` or `cycleId`. `maxPerCycle = 0` means
no cap.

---

## 6. Tests and launch

**Tests** live in `subscription-contracts/test/Contributions.t.sol`. They mock the registry the way
`TableOperatorsTest.t.sol` does, and use `vm.expectCall` to assert the exact SQL each function
emits.

- An allowed case and a rejected case for every row of §4.1. Rejected calls must emit no SQL.
- Citizenship: no NFT, an expired NFT, and a citizen who lapses between submitting and editing.
- Cycle lock: `update` and `remove` revert after `closeCycle()`. `recordResults` reverts for the
  open cycle, for an ID from another cycle, and for a second write to the same ID.
- A fuzz test showing that, for any string, `_sqlString` output starts and ends with `'`, doubles
  every inner quote, and un-escapes back to the input.

**Launch**

1. Contract and tests PR in `subscription-contracts/`.
2. Deploy script `script/Contributions.s.sol`, following `Forecasts.s.sol` and
   `DeployTableOperators.s.sol`. It deploys `Contributions("CONTRIBUTIONS", citizenNFT, 5)`,
   enables the ops and payout wallets as operators, transfers ownership to the Admin Safe, and
   logs the address and `getTableName()`.

   ```bash
   cd subscription-contracts
   forge script script/Contributions.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify
   ```

3. Check on Sepolia that:
   - the table exists on the validator;
   - a direct `mutate` from an EOA fails with an ACL error;
   - `setController` reverts;
   - titles containing `'`, `');` and newlines are stored exactly as typed.
4. Add `CONTRIBUTIONS_ADDRESSES` and `CONTRIBUTIONS_TABLE_NAMES` to `ui/const/config.ts`, with
   `arbitrum: ''` until mainnet like `FORECASTS_TABLE_*`, and the ABI to `ui/const/abis/`.
5. Build the in-app form and the profile section against Sepolia behind a flag in
   `ui/const/flags.ts`. Call `waitForRow` after each write. During the first cycle, the feed
   (`pages/api/contributions/feed.ts`) and the XP check (`pages/api/xp/has-contributed-proof.ts`)
   read both the table and the sheet.
6. Deploy to Arbitrum with the same script, rerun the step 3 checks, and fill in the `arbitrum`
   config entries.

---

## 7. Later, when we need it

Each of these is left out on purpose and can be added when there's a reason to.

| Feature | How it would be added |
| --- | --- |
| Collaborators and split shares | A separate authors table keyed by contribution ID, with per-collaborator confirmation. Needs a v2 contract |
| Head-to-head matchups | A new matchups contract and table that reference contribution IDs. If edits must lock before matchups start, that needs a v2 contract with an edit window |
| Gasless (relayed) writes | EIP-712 `submitWithSig` and similar functions in a v2 contract, with a server relayer |
| Cycle dates or labels | A config map in the UI, or a small cycles table if other systems need it |
| Public reasons for hiding | A column or event field on `setHidden` |
| Senate quorum on results, or a separate results table | When payouts are decided by matchups rather than the Senate |
| Importing the sheet history | A one-time import function, with imported rows marked as unverified |

v2 contracts follow the existing migration path (`script/migrate/migrate*.js` and
`verifyMigration.js`), keeping IDs.

---

## 8. Side finding: unescaped SQL in existing tables

`Votes`, `Distribution`, `Forecasts`, `Proposals` and `NonProjectProposal` pass user strings
through `SQLHelpers.quote` without escaping, and the contract is the table owner. For example,
`Votes.insertIntoTable(5, "{}')),(5,'0xvictim',json('{\"1\":100}")` appears to produce a valid
two-row insert:

```sql
INSERT INTO Votes_…(voteId,address,vote)VALUES(5,'0xme',json('{}')),(5,'0xvictim',json('{"1":100}'))
```

That would plant a vote for an address that hasn't voted yet. It should be confirmed on Sepolia
and fixed in a separate PR, before `Forecasts` is deployed to Arbitrum and before the next Member
Vote.

---

## 9. Decisions needed

- [ ] **Cap:** `maxPerCycle` of 5 (from the spec), or no cap (`0`) to start?
- [ ] **When to close:** does the payout script call `closeCycle()` at payout, or when Senate
      review starts so reviewers see a frozen list?
- [ ] **Who calls it:** an operator wallet, or the payout Safe batch?
- [ ] **Starting cycle:** is cycle 1 the first cycle paid from the table (e.g. Q4 2026)?
