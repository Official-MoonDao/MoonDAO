# Contributions table: schema, permissions and Tableland launch plan

This plan turns the onchain `Contribution` table from the
[Contributions 2.0 spec](https://github.com/ryand2d/MoonDAO/commit/53528f19ea528570001370c614deb97d6b5b9fbf)
(`docs/CONTRIBUTIONS_2.0_SPEC.md` in that commit) into concrete Tableland tables, a
permissions model, and the steps to deploy them the same way as our other tables
(contracts in `subscription-contracts/src/tables/`, a `forge script` deploy, table names in
`ui/const/config.ts`).

**In scope:** contracts, table schemas, permissions, tests and deployment. UI work appears only
where it depends on the schema.

**Out of scope:** briefings (the LLM pipeline) and the Postgres/pgvector index. Both mirror these
tables by `id` and don't change anything here.

---

## 1. Summary

- **Two contracts and four tables at launch, plus one contract and table in Phase 3.**
  - `FundingCycles` owns `FUNDING_CYCLES`, with one row per funding period and explicit start and
    end timestamps. A contribution points at its cycle by `cycleId`, so moving from quarters to
    months or weeks just means adding shorter rows. Nothing on a contribution row says "quarter".
  - `Contributions` owns three tables:
    - `CONTRIBUTIONS`: what was done.
    - `CONTRIBUTION_AUTHORS`: the author plus collaborators, each with a share and a
      confirmation status.
    - `CONTRIBUTION_RESULTS`: per-cycle scoring and payout outcomes. It can hold more than one
      scoring method, so a shadow quarter can store both the Senate result and the matchup
      result.
  - `ContributionMatchups` (Phase 3) owns `CONTRIBUTION_MATCHUPS`.
- **Every write goes through a contract function.** No Tableland controller is ever set, and each
  constructor locks its table's controller so nobody can add one later. Each rule (citizenship,
  caps, edit lock, who may confirm a share) is checked in Solidity against contract storage,
  because a contract can't read its own Tableland rows.
- **Identity comes from signatures only.** The author is `msg.sender`, or the signer of an EIP-712
  message when someone else relays the transaction. A wallet is never passed in as a parameter.
- **Roles are separated.** The Admin Safe administers. Senators moderate. A scorer wallet posts
  draft results. A Senate quorum makes them final. Nobody can edit a contribution's content
  except its author during the edit window, and nobody can delete rows.
- **Two things must differ from our existing tables.** Free text has to be escaped before it goes
  into SQL, and there must be no generic owner `updateTableCol(id, col, val)` escape hatch. See §5.5
  and §10.

---

## 2. How Tableland constrains the design

These facts come from the pinned registry (`lib/evm-tableland` at `dc35d2a`, the
`TablelandTables.sol` and `SQLHelpers.sol` files) and from our existing tables. They drive most
of the decisions below.

1. **A contract can't read its table.** A write emits a `RunSQL` event, and the validator executes
   the SQL later, off-chain. Any rule that depends on existing rows ("five per author per cycle",
   "locked after 48 hours", "only the listed collaborator can confirm") has to be enforced from
   contract storage. `JobBoardTable` already works this way with `idToTeamId` and `currId`.
2. **A rejected statement doesn't revert the transaction.** If the validator rejects the SQL
   (invalid JSON inside `json()`, a UNIQUE or CHECK violation, a syntax error), the transaction
   still succeeds, and contract storage has already been updated. Storage and table then disagree.
   The contract therefore has to validate everything the SQL would, so the validator never
   rejects anything. SQL constraints are only a backstop.
3. **Who can write directly.** When a table has no controller, `_getPolicy` returns allow-all for
   any caller. The validator then falls back to its ACL, which lets only the table owner (our
   contract) write. Once a controller contract is set, the validator applies that controller's
   policy to every caller, the owner included. That is why `CitizenRowController` has to
   allow-list `_tableOwners`. A controller is a second path to the rows that skips the contract's
   checks, and this design doesn't need one, so we lock it off. The validator half of this
   (falling back to the owner-only ACL) is confirmed on Sepolia in §8 before mainnet.
4. **`SQLHelpers.quote` doesn't escape.** It only wraps the input in single quotes
   (`SQLHelpers.sol`, `quote()`). A user string containing `'` can close the literal and append
   SQL, which the validator runs with the table owner's full privileges.
5. **Statements must be under 35,001 bytes** (`QUERY_MAX_SIZE`).
6. **Joins only work between tables on the same chain.** The Citizen NFT (`CITIZEN_ADDRESSES`) and
   `Senators` (`SENATORS_ADDRESSES`) live on Arbitrum, with copies on Sepolia, so the new tables go
   on those chains.
7. **Addresses are stored lowercase**, because `Strings.toHexString(address)` produces lowercase.
   Readers must lowercase before they query.
8. **Creating a table mints an ERC-721 to the creator.** The contract must inherit `ERC721Holder`,
   as every existing table contract does, and must have no function that transfers that token.

---

## 3. Tables

Types follow Tableland SQL: `integer` and `text`, with timestamps as unix seconds in UTC. The
schemas avoid NULLs (empty string or `0` means "none") so client parsing stays simple. CHECK
constraints are left out on purpose. The contract enforces the same rules, and a schema the
validator rejects fails silently at creation, so the schema stays minimal. Verify the exact
strings on Sepolia before deploying to Arbitrum (§8).

### 3.1 `FUNDING_CYCLES` (owned by `FundingCycles`)

```
id integer primary key,
label text not null,
cadence text not null,
startTime integer not null,
endTime integer not null,
submissionDeadline integer not null
```

| Column | Meaning |
| --- | --- |
| `id` | Cycle ID, assigned by the contract, counting up from 1 |
| `label` | Display name, e.g. `Q4 2026`, `Mar 2027`, `Week of May 3, 2027` |
| `cadence` | `quarter`, `month`, `week` or `custom`. Display and analytics only; no logic branches on it |
| `startTime` | Inclusive. Always equal to the previous cycle's `endTime` |
| `endTime` | Exclusive |
| `submissionDeadline` | The last moment a contribution can still be credited to this cycle. Must be ≥ `endTime`, which gives a grace period |

This table is generic on purpose. When project retroactives or distributions move to shorter
cycles, they can reference the same cycle IDs.

### 3.2 `CONTRIBUTIONS` (owned by `Contributions`)

```
id integer primary key,
cycleId integer not null,
author text not null,
citizenId integer not null,
title text not null,
description text not null,
area text not null,
links text not null,
projectId integer not null,
evidenceCid text not null,
effortHours integer not null,
source text not null,
status text not null,
statusReason text not null,
createdAt integer not null,
updatedAt integer not null,
lockedAt integer not null
```

| Column | Set by | Can change? | Rules |
| --- | --- | --- | --- |
| `id` | Contract counter, from 1 | No | The ID used everywhere: briefings, matchups, results, payouts |
| `cycleId` | Author picks one of the open cycles; contract validates it | No | See §4 |
| `author` | `msg.sender`, or the EIP-712 signer | No | Lowercase hex |
| `citizenId` | Contract, from `getOwnedToken(author)` | No | Join key to `CITIZENTABLE.id`; matches how `BLOCKED_CITIZENS` is keyed |
| `title` | Author | Until `lockedAt` | ≤ 120 bytes, escaped |
| `description` | Author | Until `lockedAt` | ≤ 2,000 bytes, escaped. Longer writeups go in `evidenceCid` |
| `area` | Author picks an index; contract writes the canonical name | Until `lockedAt` | `outreach`, `community`, `content`, `technical`, `research`, `other`. The admin can append areas |
| `links` | Author | Until `lockedAt` | JSON array built by the contract. At most 5 URLs, each ≤ 300 bytes, starting with `https://`, URL-safe characters only (§5.5) |
| `projectId` | Author | Until `lockedAt` | `0` means none. Informational: the UI only links it if the project exists |
| `evidenceCid` | Author | Until `lockedAt` | `''` means none. Alphanumeric characters only, ≤ 100 bytes |
| `effortHours` | Author | Until `lockedAt` | Author's estimate of total person-hours. Matchup cards show it as scope ("about 3 weeks") |
| `source` | Contract | No | `direct`, `relayed` or `import` |
| `status` | Author (withdraw) or moderator (hide/unhide) | Yes | `active`, `withdrawn` or `hidden` |
| `statusReason` | Same as `status` | Yes | Required when hidden. Public |
| `createdAt` / `updatedAt` | Contract (`block.timestamp`) | `updatedAt` only | |
| `lockedAt` | Contract: `createdAt + editWindow` | No | Edits are rejected after this time, and matchups only include contributions past it |

### 3.3 `CONTRIBUTION_AUTHORS` (owned by `Contributions`)

```
id integer primary key,
contributionId integer not null,
address text not null,
role text not null,
shareBps integer not null,
status text not null,
respondedAt integer not null,
unique(contributionId, address)
```

- Each contribution gets one `author` row (status `confirmed`) and up to 9 `collaborator` rows
  (status `pending` until the collaborator responds). Its rows' `shareBps` values add up to exactly
  10,000.
- Keeping participants in their own table, rather than in a JSON column on the contribution,
  serves "associate contributions to authors" directly. "Everything this address worked on" is one
  indexed lookup whatever the role. Each collaborator's confirmation is its own row, and SQL never
  has to unpack JSON.
- Shares are fixed at submission. To fix a mistake, the author withdraws before `lockedAt` and
  submits again. That avoids having to reset confirmations when an author edits the shares.
- Pending and declined collaborators don't appear on the collaborator's profile, aren't counted
  in "N people" on matchup cards, and aren't paid (§11 covers where their share goes).

### 3.4 `CONTRIBUTION_RESULTS` (owned by `Contributions`)

```
id integer primary key,
cycleId integer not null,
contributionId integer not null,
method text not null,
matchups integer not null,
winRateBps integer not null,
shareBps integer not null,
points integer not null,
outcome text not null,
reward text not null,
final integer not null,
updatedAt integer not null,
unique(contributionId, method)
```

| Column | Meaning |
| --- | --- |
| `method` | `senate`, `matchups-v1`, and so on. Several methods can coexist for one cycle (the shadow quarter) |
| `matchups`, `winRateBps` | Matchup statistics, weighted. `0` for the `senate` method |
| `shareBps` | The contribution's share of the cycle's Community Circle pool |
| `points` | Leaderboard points, normalized for cycle length (§4) |
| `outcome` | `paid`, `unpaid` (below the cutoff), or `review` (fewer than 5 matchups, sent to the Senate) |
| `reward` | JSON of amounts paid for the whole contribution, e.g. `{"USDC":"120.50","vMOONEY":"5000"}`. Each author's amount comes from the confirmed shares |
| `final` | `0` while the row is a draft. Set to `1` for the payout method when the cycle is finalized; immutable after that |

The `senate` method can be used from the very first cycle. The Senate's Community Circle split
gets recorded per contribution, which builds the history needed to compare it with matchups
later.

### 3.5 `CONTRIBUTION_MATCHUPS` (Phase 3, owned by `ContributionMatchups`)

```
id integer primary key,
voter text not null,
contributionA integer not null,
contributionB integer not null,
winner integer not null,
margin integer not null,
createdAt integer not null,
unique(voter, contributionA, contributionB)
```

- `contributionA < contributionB` always, so each pair has one key.
- `winner` is `contributionA`, `contributionB`, or `0` for "can't compare".
- `margin` is 1 (slightly), 2 (clearly) or 3 (far more), and `0` when skipped.
- Vote weights (1 plus a √vMOONEY boost, capped at 3×) aren't stored. The scoring script computes
  them from a vMOONEY snapshot taken at the end of the cycle and records the snapshot block in the
  results metadata (`resultsCid`).

### 3.6 How the spec's fields map to this schema

| Spec field | Here |
| --- | --- |
| `id`, `author`, `title`, `description`, `area`, `links`, `evidence_cid` | Same columns on `CONTRIBUTIONS` |
| `quarter`, `year` | `cycleId` pointing at `FUNDING_CYCLES` |
| `collaborators` (JSON) | Rows in `CONTRIBUTION_AUTHORS` |
| `project_id` | `projectId` |
| `status` Claimed → Confirmed → Paid/Unpaid/Hidden | Split into three independent facts: visibility (`CONTRIBUTIONS.status`), each collaborator's confirmation (`CONTRIBUTION_AUTHORS.status`), and the payout result (`CONTRIBUTION_RESULTS.outcome` where `final = 1`) |
| `reward` | `CONTRIBUTION_RESULTS.reward` |
| "time spent" on matchup cards | `effortHours`, plus the count of confirmed participants |

### 3.7 Example reads

A citizen's profile, grouped by cycle:

```sql
SELECT c.*, a.role, a.shareBps, f.label AS cycleLabel, r.outcome, r.points
FROM CONTRIBUTIONS_42161_x c
JOIN CONTRIBUTION_AUTHORS_42161_y a ON a.contributionId = c.id
JOIN FUNDING_CYCLES_42161_z f ON f.id = c.cycleId
LEFT JOIN CONTRIBUTION_RESULTS_42161_w r ON r.contributionId = c.id AND r.final = 1
WHERE a.address = '0xabc…' AND a.status = 'confirmed' AND c.status = 'active'
ORDER BY f.startTime DESC, c.createdAt DESC
```

The matchup pool (rolling 90-day window):

```sql
SELECT id, title, description, links, effortHours FROM CONTRIBUTIONS_42161_x
WHERE status = 'active' AND lockedAt <= :now AND createdAt >= :now - 7776000
```

---

## 4. Staying agnostic to cycle length

1. **Contributions point at cycles by ID.** No contribution row stores a quarter or year. Code
   that needs a quarter (legacy views, `formatQuarterCycleLabel`) derives it from the cycle's
   `startTime`.
2. **Cycles are contiguous.** Each new cycle starts exactly where the previous one ended, so every
   timestamp belongs to exactly one cycle and `cycleAt(t)` always has one answer.
3. **`cadence` and `label` are for display only.** Neither contract logic nor SQL should branch on
   them.
4. **Changing cadence uses three operations.**
   - Remove any future cycles that haven't started yet.
   - Optionally shorten the active cycle with `setEndTime`. This is admin-only, and the new end
     must be in the future.
   - Append the new, shorter cycles.

   Contributions already credited keep their `cycleId`. Example:

   | id | label | cadence | startTime | endTime | submissionDeadline |
   | --- | --- | --- | --- | --- | --- |
   | 1 | Q4 2026 | quarter | 2026-10-01 | 2027-01-01 | 2027-01-15 |
   | 2 | Q1 2027 (Jan–Feb) | quarter | 2027-01-01 | 2027-03-01 (shortened from 04-01) | 2027-03-08 |
   | 3 | Mar 2027 | month | 2027-03-01 | 2027-04-01 | 2027-04-08 |
   | 4 | Apr 2027 | month | 2027-04-01 | 2027-05-01 | 2027-05-08 |

5. **Rules measured in time stay the same whatever the cadence:** the 90-day matchup window, the
   "3 matchups in 30 days" gate, the 10-a-day limit, and the edit window. Keep them in seconds,
   never in cycles.
6. **Rules counted per cycle must be revisited when the cadence changes.** The cap per author is
   the contract parameter `maxPerAuthor`. The pool size, cutoff and minimum matchup count live in
   the scoring script and are recorded in each cycle's `resultsCid`. Five claims a quarter doesn't
   mean five claims a week.
7. **Points must be normalized.** If points were a raw share of each cycle, weekly cycles would
   hand out about 13 times as many points per quarter as quarterly ones. Store
   `points = shareBps × (endTime − startTime) / 365 days` (or weight by the value of the pool) so a
   year of cycles adds up to the same total at any cadence. The scorer writes `points`, so the
   formula is fixed at scoring time.
8. **The grace period comes from `submissionDeadline`.** Work finished at the end of a cycle can
   still be credited to that cycle for a short time after it ends. During that overlap two cycles
   are open, and the author picks one (the UI defaults to the newer cycle). This matches what
   `getSubmissionQuarter` does for projects today.

---

## 5. Permissions

### 5.1 Principles

- **One way to write.** Writes only happen through contract functions. There is no controller,
  the controller is locked, and the table NFTs never leave the contracts.
- **Identity comes from signatures.** `author`, `voter` and the responding collaborator are always
  `msg.sender` or a recovered EIP-712 signer, never an argument.
- **Content belongs to its author.** Only the author can change a contribution's content, and only
  before `lockedAt`. No admin function edits content or deletes rows.
- **Duties are separated.** Moderating, scoring and finalizing are different roles. Whoever
  computes the results can't make them final alone.
- **Everything that matters is public.** Every privileged action emits an event and leaves a
  visible trace in a table (`statusReason`, `final`, `source`).
- **No EOA keeps admin.** The deploy script grants every admin role to the Admin Safe, and the
  deployer renounces its own roles in the same broadcast. This deliberately differs from
  `DeployTableOperators.s.sol`, which leaves the deployer as owner.

### 5.2 Roles

Use OpenZeppelin `AccessControl` rather than the `Ownable` plus `operators` mapping used by
`JobBoardTable`. There are five distinct roles here, and `RoleGranted`/`RoleRevoked` events are
easy to audit.

| Role | Held by | Can | Can't |
| --- | --- | --- | --- |
| Citizen (implicit) | Any address holding an unexpired Citizen NFT whose `citizenId` isn't blocked | Submit; edit or withdraw their own contribution before lock; confirm or decline a share they're listed on; record matchups (Phase 3) | Write on behalf of anyone else; edit after lock; touch results |
| `DEFAULT_ADMIN_ROLE` | Admin Safe | Grant and revoke roles; set parameters (`editWindow`, `maxPerAuthor`, `requiredMatchups`, areas); repoint the Citizen NFT, `Senators` or matchups contract; block or unblock a `citizenId`; shorten or extend the active cycle; close the import | Edit or delete contributions; write results; set a controller |
| `CYCLE_ADMIN_ROLE` | Admin Safe plus ops wallets | Append cycles; remove cycles that haven't started; extend a submission deadline that hasn't passed yet | Change an active cycle's `endTime`; move a contribution to another cycle |
| `MODERATOR_ROLE` | Any current senator (`Senators.isSenator`, so Senate rotation applies automatically) plus explicitly granted staff | Hide or unhide a contribution with a public reason | Edit content; delete; change results; block addresses |
| `SCORER_ROLE` | The wallet that runs the end-of-cycle script | Write or overwrite draft results for a cycle once its `submissionDeadline` has passed | Finalize; change results after finalization |
| Finalizer | A Senate quorum (recommended, reusing the 70% quorum from `Proposals.sol`) or a Senate Safe | Mark one method's results as final for a cycle | Change any result values |
| `IMPORTER_ROLE` | An ops wallet, used once | Import legacy rows, which are marked `source = 'import'` | Anything, once `closeImport()` has run (that call is irreversible) |
| Relayer (unprivileged) | Anyone; in practice our server | Submit a citizen's signed write and pay the gas | Change what was signed, or act without a signature |

### 5.3 Permission matrix

| Action | Caller | What the contract checks |
| --- | --- | --- |
| `submit` / `submitWithSig` | Citizen | Caller is an active, unblocked citizen. The cycle has started, `now < submissionDeadline`, and the cycle isn't finalized. `count[cycleId][author] < maxPerAuthor`. Field limits and character sets (§5.5). At most 9 collaborators, all distinct, none equal to the author, each an active citizen. Every share > 0 and the shares add up to 10,000. In Phase 3, at least `requiredMatchups` matchups in the last 30 days |
| `edit` / `editWithSig` | Author | `now < lockedAt`, status is `active`, author is still an active citizen, same field checks. Content fields only |
| `withdraw` | Author | `now < lockedAt` and status is `active`. Status becomes `withdrawn` and the cap slot is freed |
| `respond(accept)` / `respondWithSig` | Listed collaborator | Active citizen; the contribution isn't withdrawn; the cycle isn't finalized. The latest answer counts until finalization |
| `setStatus(hidden or active, reason)` | Moderator | Reason is non-empty. Only toggles between `hidden` and `active`; withdrawn rows can't be changed. Allowed after finalization, but finalized results stay as they are |
| `setBlocked(citizenId, bool)` | Admin | Stops new writes from that citizen. Existing rows are untouched |
| `postResults(cycleId, method, rows)` | Scorer | `now ≥ submissionDeadline`, the cycle isn't finalized, and every contribution belongs to that cycle. The contract keeps a running `shareBps` total per (cycle, method), adjusted when a draft row is overwritten |
| `approveResults` / `finalizeCycle(cycleId, method, resultsCid)` | Senators / finalizer | Results exist for that method and their `shareBps` total exactly 10,000. Quorum is reached. Then one `UPDATE … SET final = 1 WHERE cycleId = ? AND method = ?` runs and the cycle is locked |
| `addCycle` | Cycle admin | `startTime == last.endTime` (or this is the first cycle), `endTime > startTime`, `submissionDeadline ≥ endTime` |
| `removeLastCycle` | Cycle admin | `now < startTime`, so no contribution can reference it yet |
| `extendSubmissionDeadline(id, newDeadline)` | Cycle admin | `now < current deadline` and `newDeadline > current deadline`. Deadlines can only move later |
| `setEndTime(latest, newEnd, newDeadline)` | Admin | Latest cycle only, `newEnd > now`, `newDeadline ≥ newEnd` |
| `importContribution` | Importer | The import is open. Author, cycle and `createdAt` are explicit, `source = 'import'`, collaborators are stored as confirmed, and the UI labels these rows "imported, unverified" |
| `recordMatchup` (Phase 3) | Citizen | See §5.7 |

### 5.4 What nobody can do

- Delete a contribution, author or result row. Unstarted future cycles are the only rows that can
  be deleted.
- Change `author`, `cycleId`, `citizenId`, `createdAt`, or the collaborator shares after submission.
- Edit content after `lockedAt`.
- Change results once a cycle is finalized.
- Send SQL to these tables directly, set a controller, or move a table NFT out of its contract.
- Reopen the import after `closeImport()`.

### 5.5 Input handling (the SQL injection fix)

- **Free text** (`title`, `description`, `statusReason`, `reward`, `label`) goes through
  `_sqlString()`, which doubles every `'` and rejects NUL bytes, and is capped in bytes:

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

- **Constrained fields** use allow-listed characters, so they never need escaping.
  - `links`: must start with `https://` and use only RFC 3986 characters. That excludes `'`, `"`,
    `\`, `<`, `>`, spaces and control characters; the UI percent-encodes anything else. The
    contract builds `["https://…","https://…"]` itself, so the JSON is always valid and no
    `json()` call can fail.
  - `evidenceCid`: `[A-Za-z0-9]` only.
  - `area`: an index into an admin-maintained list.
  - `method` and `cadence`: `[a-z0-9-]` only.
- **Numbers** go through `Strings.toString`. Addresses go through `Strings.toHexString`.
- **Statement size.** The worst case is 2,000 bytes of description that are all quotes, plus the
  other fields, which stays well under the 35,001-byte limit. The contract still reverts if a
  built statement reaches the limit.
- **Display safety.** The UI renders all of these fields as plain text, never as HTML, and only
  turns `https://` URLs into links.

### 5.6 Signed (gasless) writes

- `submitWithSig`, `editWithSig`, `respondWithSig` and `recordMatchupWithSig` all take an EIP-712
  message. The domain is `name: "MoonDAO Contributions"`, `version: "1"`, the chain ID and the
  verifying contract. Each message carries a per-signer `nonce` and a `deadline`.
- Signatures are verified with OpenZeppelin `SignatureChecker.isValidSignatureNow`, so both EOAs and
  ERC-1271 smart-contract wallets work.
- The relayer pays gas but can't change content: the signature covers every field, including the
  collaborator list and shares.
- Collaborator confirmation becomes the spec's "one-click signature" without the collaborator
  needing gas.
- **Put these functions in the contract from day one**, even if the relayer endpoint ships later.
  The contract owns its tables and there's no upgrade path, so adding them afterwards means a new
  contract, new tables and a data migration.

### 5.7 Matchup permissions (Phase 3)

Matchups decide money, so they get the tightest checks.

- **Voter:** an active, unblocked citizen, and not a participant in either contribution. The check
  reads `Contributions.shareBps(id, voter) == 0`, so voting on your own work or a collaborator's is
  impossible.
- **Assigned pairs only.** The server issues a ticket `{voter, contributionA, contributionB,
  expiry}` signed by `matchupSigner`. That can be the existing GCP HSM signer
  (`GCP_HSM_SIGNER_ADDRESS`, already used for the XP oracle). Without tickets, a voter could choose
  pairs to keep beating a rival.
- **Eligible contributions:** both are `active`, past `lockedAt`, and created in the last 90 days.
- **Limits:** at most 10 a day (`count[voter][block.timestamp / 1 days]`), and one vote per voter
  per pair (enforced in storage, with the UNIQUE constraint as a backstop).
- **Submission gate:** the contract keeps a ring buffer of each voter's last 8 matchup timestamps,
  and `Contributions.submit` reads it to check "N matchups in the last 30 days". `requiredMatchups`
  starts at `0`, so contributions can launch before matchups exist, and is raised once the pool is
  big enough.

### 5.8 Threats and mitigations

| Threat | Mitigation |
| --- | --- |
| Non-citizens or lapsed citizens spamming submissions | On-chain `balanceOf`, `getOwnedToken` and `expiresAt` check on every write |
| Wallet typed in, or someone impersonating an author | Author is `msg.sender` or the EIP-712 signer |
| A relayer forging or altering a submission | The signature covers every field; the relayer has no role |
| Replaying a signed message | Per-signer nonce, deadline, and a chain-bound domain |
| SQL injection through free text | §5.5 escaping, allow-listed characters, size caps, fuzz tests |
| Writing to the table directly and skipping the contract | No controller, controller locked, and the validator ACL only allows the owner. Checked on Sepolia |
| Editing a contribution after it starts winning matchups | Edits only before `lockedAt`; matchups only after `lockedAt` |
| Padding a claim with names | Collaborators must be citizens and must confirm; matchup cards count confirmed people only; unconfirmed shares aren't paid |
| Attaching a well-known citizen to junk work | Pending rows don't appear on that citizen's profile; they can decline |
| Voting on your own work or targeting rivals | Participant exclusion, server-assigned pairs, daily cap, one vote per pair |
| Sybil voters | A paid citizenship NFT is required; the vMOONEY boost is capped |
| A rogue moderator | Hiding is reversible, the reason is public, the hidden row stays in the table, and the role can be revoked |
| A rogue scorer | Results stay drafts until a Senate quorum finalizes them; `resultsCid` makes the calculation reproducible |
| Admin key compromise | The admin is a Safe and the deployer renounces its roles. No function edits content or deletes rows, so the worst case is moderation and parameter changes, all of which emit events |
| Storage and table drifting apart after a rejected statement | The contract validates everything first; the UI calls `waitForRow`; a reconciliation script compares storage counters with table counts |
| Moving work into a different cycle | `cycleId` is immutable; cycle edits only apply to the latest cycle and only from now on |
| Private data leaking | No email or contact columns. The form warns that content is public and permanent; hiding only affects the UI |

---

## 6. Contract outline

Files: `subscription-contracts/src/tables/FundingCycles.sol`,
`subscription-contracts/src/tables/Contributions.sol`, and in Phase 3
`subscription-contracts/src/tables/ContributionMatchups.sol`. Each inherits `ERC721Holder` and
`AccessControl`, and `Contributions` and `ContributionMatchups` also inherit `EIP712`.

`Contributions` storage, which mirrors every column a rule depends on:

```solidity
struct Meta {
    address author;
    uint64 cycleId;
    uint64 createdAt;
    uint64 lockedAt;
    Status status;            // Active, Withdrawn, Hidden
    uint8 participantCount;
}
mapping(uint256 => Meta) public meta;
mapping(uint256 => mapping(address => uint16)) public shareBps;
mapping(uint256 => mapping(address => uint256)) public countByCycleAuthor;
mapping(uint256 => bool) public blockedCitizen;           // by citizenId
mapping(uint256 => uint64) public finalizedAt;            // cycleId => timestamp
mapping(uint256 => mapping(bytes32 => uint256)) public resultShareTotal; // cycleId => method => bps
mapping(address => uint256) public nonces;
uint256 public nextContributionId = 1;
uint256 public editWindow = 2 days;
uint256 public maxPerAuthor = 5;
uint256 public requiredMatchups;                          // 0 until Phase 3
bool public importOpen = true;
```

The constructor creates the three tables and calls
`TablelandDeployments.get().lockController(address(this), tableId)` for each one.

Each submission writes the contribution row and all participant rows in a single
`mutate(caller, Statement[])` call. The participant rows go in one multi-row `INSERT`.

---

## 7. Tests

Put the tests in `subscription-contracts/test/Contributions.t.sol` and
`test/FundingCycles.t.sol`. Mock the registry the way `TableOperatorsTest.t.sol` does
(`vm.etch` plus `vm.mockCall`), and use `vm.expectCall` to assert the exact SQL each function
emits.

- **Permission matrix.** One test that should succeed and at least one that should revert for
  every row in §5.3. Rejected calls must emit no SQL.
- **Citizenship edge cases:** expired NFT, no NFT, blocked `citizenId`, a citizen who lapses
  between submitting and editing.
- **Fuzzed escaping.** For any input string, `_sqlString` output starts and ends with `'`, every
  inner quote is doubled, and un-escaping gives back the input. A `submit` with a hostile title
  emits exactly one statement for the expected table.
- **Invariants:** IDs only increase; participant shares always add up to 10,000; the per-cycle cap
  holds; finalized cycles reject results; cycles stay contiguous.
- **Signatures:** EOA and ERC-1271 signatures; wrong nonce, expired deadline, and wrong chain all
  revert.
- **Fork CI.** The tests have to pass in both modes that CI runs (local, and
  `--fork-url` for Sepolia and Arbitrum in `.github/workflows/subscription-contracts.yml`), so
  assert against `address(TablelandDeployments.get())` rather than a hard-coded registry address.

---

## 8. Launch

1. **Contracts and tests PR** in `subscription-contracts/`, with no UI changes.
2. **Deploy script** `subscription-contracts/script/Contributions.s.sol`, following
   `Forecasts.s.sol` and `DeployTableOperators.s.sol`. It reads `CITIZEN_NFT`, `SENATORS`,
   `ADMIN_SAFE` and `SCORER` from the environment, then:
   - deploys `FundingCycles("FUNDING_CYCLES")` and seeds the first cycle, e.g. `Q4 2026`,
     `quarter`, `1790812800` (2026-10-01), `1798761600` (2027-01-01), `1799971200` (2027-01-15);
   - deploys `Contributions(...)` with prefixes `CONTRIBUTIONS`, `CONTRIBUTION_AUTHORS` and
     `CONTRIBUTION_RESULTS`;
   - grants the admin and cycle-admin roles to `ADMIN_SAFE` and the scorer role to `SCORER`;
   - has the deployer renounce every role on both contracts;
   - logs the addresses and `getTableName()` for each table.

   ```bash
   cd subscription-contracts
   forge script script/Contributions.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify
   ```

3. **Validator checks on Sepolia.** Script these with `@tableland/sdk` and keep the script in
   `subscription-contracts/script/`.
   - Every table exists on the validator: `SELECT * FROM <name> LIMIT 1` succeeds.
   - A direct `mutate` from an EOA to each table comes back with an ACL error in the receipt.
   - `setController` and `lockController` revert for everyone.
   - Titles and descriptions containing `'`, `');`, `--`, `"` and newlines are stored exactly as
     typed.
   - The two-table batched insert either applies completely or not at all.
   - The cross-table JOIN in §3.7 returns the expected rows.
   - `hasRole(DEFAULT_ADMIN_ROLE, deployer) == false` on both contracts.
4. **Register on Sepolia.** Add `FUNDING_CYCLES_ADDRESSES`, `FUNDING_CYCLES_TABLE_NAMES`,
   `CONTRIBUTIONS_ADDRESSES`, `CONTRIBUTIONS_TABLE_NAMES`, `CONTRIBUTION_AUTHORS_TABLE_NAMES` and
   `CONTRIBUTION_RESULTS_TABLE_NAMES` to `ui/const/config.ts`. Leave `arbitrum: ''` until mainnet,
   the way `FORECASTS_TABLE_*` is set up. Add the ABIs to `ui/const/abis/`.
5. **Build the UI against Sepolia** behind a flag in `ui/const/flags.ts` (§9).
6. **Deploy to Arbitrum** with the same script once Sepolia is signed off. Verify on Arbiscan,
   rerun the step 3 checks against Arbitrum, and fill in the `arbitrum` config entries.
7. **Optional import.** Import historical sheet rows with `source = 'import'`, then call
   `closeImport()` from the Admin Safe.
8. **Transition.** For one cycle, run the in-app form and the Google Form side by side. The feed
   (`pages/api/contributions/feed.ts`) and the XP check (`pages/api/xp/has-contributed-proof.ts`)
   read the union of the table and the sheet during that cycle.
9. **Phase 3.** Deploy `ContributionMatchups`, point `Contributions` at it with
   `setMatchups(address)`, and raise `requiredMatchups` once the pool has enough locked
   contributions.

Upgrades follow the existing pattern: deploy a new contract, then copy rows over with IDs kept
(`script/migrate/migrate*.js` and `verifyMigration.js`). That path is why the signed-write
functions go in from day one (§5.6).

---

## 9. UI follow-ups that depend on the schema

- Read helpers in `ui/lib/contributions/` that use `queryTable` and `useTablelandQuery`, plus
  `ui/lib/contributions/cycles.ts` with `getCycleAt(t)`, `getOpenCycles()` and
  `cycleToQuarter(cycle)` for legacy views.
- A submission form in `ui/components/contributions/` with byte counters, link validation that
  matches §5.5, a collaborator picker that searches citizens, and `waitForRow` after each write.
- A "Contributions" section on citizen profiles next to `CitizenProjects`, showing only
  `status = 'active'` rows where the citizen's own participant row is `confirmed`, plus a "pending
  your confirmation" list visible only to that citizen.
- Every reader (feed, profile, matchup pool, briefing index) filters on `status = 'active'`.

---

## 10. Side finding: unescaped SQL in existing tables

`Votes`, `Distribution`, `Forecasts`, `Proposals` and `NonProjectProposal` pass user-supplied
strings through `SQLHelpers.quote`, which doesn't escape. The contract is the table owner, so the
validator runs whatever SQL comes out of that with full privileges.

For example, `Votes.insertIntoTable(5, "{}')),(5,'0xvictim',json('{\"1\":100}")` appears to
produce:

```sql
INSERT INTO Votes_…(voteId,address,vote)VALUES(5,'0xme',json('{}')),(5,'0xvictim',json('{"1":100}'))
```

That is a valid multi-row insert, and it would plant a vote for an address that hasn't voted yet.
This should be confirmed on Sepolia and fixed in a separate PR, by escaping or rejecting `'` in
those inputs, before `Forecasts` is deployed to Arbitrum and before the next Member Vote. The new
contracts shouldn't copy that pattern.

---

## 11. Decisions needed

- [ ] **Edit window:** a fixed `editWindow` (48 hours proposed), or the spec's "until the first
      matchup"? A fixed window keeps the contribution and matchup contracts independent and makes
      the lock time predictable.
- [ ] **Per-author cap:** `maxPerAuthor` per cycle (5 proposed for quarterly cycles), and what it
      becomes if cadence shortens.
- [ ] **Collaborators:** must they be citizens? This plan says yes, both when listed and when they
      confirm.
- [ ] **Unconfirmed shares:** redistribute them pro rata to the confirmed participants (proposed),
      or return them to the pool?
- [ ] **Finalizer:** an on-chain Senate quorum (proposed, reusing `Proposals.sol`'s 70% quorum) or a
      Senate Safe?
- [ ] **Moderators:** every senator through `Senators.isSenator` (proposed), or only explicitly
      granted addresses?
- [ ] **Grace period:** how long after a cycle ends `submissionDeadline` should be (14 days
      proposed for quarters).
- [ ] **Legacy import:** import the Google Sheet history as `source = 'import'`, or start fresh?
- [ ] **Matchup storage:** on Tableland with server-signed tickets (this plan), or in Postgres?
- [ ] **Points formula:** duration-weighted share (proposed) or the value of the pool.
- [ ] **Gas sponsorship:** whether to run the relayer at launch. The signed-write functions ship in
      the contract either way.
