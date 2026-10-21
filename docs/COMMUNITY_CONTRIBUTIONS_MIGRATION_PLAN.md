# Community Contributions: status audit and migration plan

Oct 21, 2026. This covers how project proposals and community contributions are received
today, where the data lives, what has already been built toward an in-app version, and a plan
to move `/contributions` off the Google Form and onto an onchain record that shows up on each
citizen's profile. The plan includes importing past quarters.

The goal is an onchain CV: one place, keyed to a citizen, that lists their projects, their
independent work, and what the DAO paid them for it.

---

## 1. Summary

- **Projects already work in-app.** A proposal is written from a Google Doc import, pinned to
  IPFS, and written onchain by the HSM wallet, which mints a project team and adds a row to the
  `PROJECT` table. Projects already appear on citizen profiles through Hats.
- **Contributions are still off-platform.** `/contributions` links to a public Google Form. The
  responses go into a Google Sheet, and the site reads that sheet as a published CSV. The form
  asks for name, email, "are you a citizen?" and a wallet address, all typed by hand and never
  checked.
- **Some work was started and then stopped.**
  - The `Contributions.sol` Tableland table, with tests and a deploy script, was merged on Oct 6
    (PR #1697).
  - It is **not deployed**: `CONTRIBUTIONS_ADDRESSES` and `CONTRIBUTIONS_TABLE_NAMES` in
    `ui/const/config.ts:257-264` are empty strings.
  - There is no in-app form, no profile section, and no feature flag.
  - The broader "Contributions 2.0" spec (LLM briefings and head-to-head matchups) exists only in
    closed draft PR #1696 and was never merged.
- **The current contract can't import history.** `Contributions.sol` always sets the author to
  `msg.sender` and the cycle to `currentCycleId`, and it has no import function. Its own plan says
  "no import of history" (`docs/CONTRIBUTIONS_TABLE_PLAN.md` §1.6). Because the table isn't
  deployed yet, the cheapest moment to add an import path is now, before the first deploy.
- **Recommendation:** make a small v2 of the undeployed contract (§5), ship the in-app form and
  the profile section behind a flag, close the Google Form partway through the Q4 2026 cycle, and
  import past quarters from the sheet plus the payout records (§7). The Senate keeps reviewing as
  it does today. A new evaluation model, such as matchups, is a separate decision this plan does
  not depend on.

---

## 2. How project proposals are received today

This is the reference pattern: it is already integrated and onchain.

| Step | Where | Notes |
| --- | --- | --- |
| Entry | `ui/pages/submit.tsx` → `ui/pages/proposals.tsx:200-206` | Shows "submissions closed" outside the intake window |
| Form | `ui/components/nance/ProposalEditor.tsx` | The body comes only from a Google Doc import (`/api/google/docs/fetch`). The title is auto-filled. Email is optional. The budget is parsed from a "Budget Request" section by regex. An optional AI pre-review runs on Groq. The author is the connected wallet, so nothing identity-related is typed |
| Pin | `/api/ipfs/pin` (Pinata) | JSON `{body, budget, totalBudgetUSDC, authorAddress, nonProjectProposal}` |
| Write | `ui/pages/api/proposals/submit.ts` | Checks the Privy session, then checks that the posted wallet is linked to that user (`:335-355`). The HSM wallet calls `ProjectTeamCreator.createProjectTeam`, which creates a Safe, Hats (admin, manager, member), the Project NFT and a `PROJECT` table row. A Discord thread is opened |
| Lifecycle | Senate temp check (`Proposals.sol`, senators only), then the Member Vote (quadratic, `Proposals` / `Distribution` tables), then final report (`FinalReportEditor`), then retro eligibility (`/api/operator/project-add-to-retroactives`) | Phase comes from `PROJECT_CYCLE` plus a live override in Upstash KV |
| Profile | `ui/pages/citizen/[tokenIdOrName].tsx:595` → `CitizenProjects` | Membership comes from the citizen's Hats, not from authorship |

`PROJECT` schema (`subscription-contracts/src/tables/Project.sol`): `id, name, description, image,
quarter, year, MDP, proposalIPFS, proposalLink, finalReportIPFS, finalReportLink,
rewardDistribution, upfrontPayments, active, eligible`.

Issues found in the project flow. None of them block this plan, but they are worth tickets:

1. **Submission isn't citizen-gated.** Anyone with a Privy login can submit, and neither the
   client nor the server checks citizenship. If proposals are meant to be citizen-only, add the
   server check from §6.3.
2. **Every new row is written as approved.** `ProjectTeamCreator.sol:81` inserts `active=2`
   (Approved), but every reader expects new proposals at `1` (Pending): `projects/index.tsx`,
   `advance-phase.ts` and the citizen page. Check whether the deployed bytecode matches this
   source.
3. **The `nonProjectProposal` flag is ignored on create.** Non-project proposals still mint a full
   team, Safe and table row.
4. **Proposals can disappear from the author's profile.** A project shows on a profile only when
   the citizen wears one of its Hats. If the author isn't named as lead or team member in the
   Doc, their own proposal doesn't appear.
5. **The edit deadline isn't checked server-side** for proposal updates and deletes.
6. **The next MDP number can collide.** It is computed as `max(MDP)+1` with a read and then a
   separate write, so two submissions at the same time can get the same MDP.

---

## 3. How community contributions are received today

### 3.1 Intake

- **The form.**
  - `ui/pages/contributions.tsx:15-16` hardcodes the Google Form URL. The page opens it in a new
    tab.
  - The button (`:18-104`) asks non-citizens to become citizens first. That check runs only in
    the browser, and the form URL itself is public.
  - `/submit-contribution`, `/contribute` and `/contribution` all redirect to `/contributions`
    (`ui/next.config.js:293-307`).
- **Columns in the sheet** (`ui/lib/contributions/getSheetContributions.ts:96-98`):

  | Index | Column |
  | --- | --- |
  | 0 | Timestamp |
  | 1 | Name |
  | 2 | Email |
  | 3 | Citizen? |
  | 4 | Wallet |
  | 5 | Area |
  | 6 | Description |
  | 7 | Time Commitment |
  | 8 | Links |

  Name, email, citizen status and wallet are all self-reported. None of them is checked.
- **Where the sheet is configured.** Its URL lives only in the env var
  `CONTRIBUTIONS_SHEET_CSV_URL`. It is not in the repo, and there are no CSV exports in the repo.

### 3.2 What reads the sheet

| Reader | File | Notes |
| --- | --- | --- |
| Public feed | `ui/pages/api/contributions/feed.ts` | Returns the whole sheet with no cycle filter, although the empty state says "this quarter" |
| Home activity | `ui/components/home/RecentActivity.tsx:145` | Same feed |
| Discord announcer | `.github/workflows/contribution-notifications.yml` (every 10 min) → `ui/pages/api/cron/contribution-notifications.ts` → `ui/lib/contributions/notifyNewContributions.ts` | Polls because the external form has no submit hook. Dedupes in Redis. Open to anyone when `CRON_SECRET` is unset |
| XP quest "Contributions" | `ui/pages/api/xp/has-contributed-proof.ts`, verifier `HasContributedStaged.sol` | Counts rows whose wallet matches. The tiers are 1, 3, 10, 25 and 50 contributions, paying up to 500 XP |

### 3.3 Review and payout

1. **Review.**
   - At cycle end, an AI-assisted HTML report is generated in a separate repo ("CSV_to_PDF") and
     committed to `ui/content/contributions/<yyyy>-q<n>.html`.
   - It is rendered at `/contributions/[cycle]`, which was added in PR #1739.
   - Q3 2026 had 76 submissions from 20 contributors, submitted Jul 16 to Oct 8.
2. **Allocation.** Senators allocate the Community Circle, which is 10% of the retro pool. The
   Q3 2026 report lists a pool of $2,340 USDC plus 695,000 MOONEY.
3. **Payout code.** The allocation is entered by hand as an address-to-percentage map at
   `ui/components/nance/ProjectRewards.tsx:767` (`const communityCircle = {}`, empty today).
   `getPayouts` (`ui/lib/utils/rewards.ts:376-489`) treats it as a synthetic project `-1`.
4. **Payment.** It goes out by Safe CSV airdrop plus `VotingEscrowDepositor`, following
   `docs/RETRO.md` and the per-cycle checklists. The docs still say "open a circle on Coordinape".

**Results are never written back.** Nothing records who was paid for which contribution
anywhere a profile could read it.

### 3.4 Dead and legacy code

- `ui/components/contribution/ContributionEditor.tsx` is not imported anywhere.
- `ui/pages/api/coordinape/*` and `ui/lib/coordinape/*` are reachable only from that dead editor.
- The Nance template text in `ui/lib/nance/index.ts:223-235` still says "Link to the Coordinape".
- The `/contributions` copy says rewards are paid in ETH; current cycles pay USDC.

### 3.5 Problems to fix now, independent of the migration

1. **Contributor emails are probably public.**
   - The app reads the sheet's publish-to-web CSV, and column 2 is Email.
   - If the published range includes that column, every contributor's email can be downloaded
     by anyone with the URL.
   - Check the publish settings today. If the column is included, publish only the columns the
     site uses, or a separate tab without them.
2. **Anyone can farm the XP quest.** It trusts the wallet typed into a public form, so anyone can
   submit 50 rows naming any wallet and push it to the top tier.
3. **Set `CRON_SECRET`** in every environment that serves `/api/cron/contribution-notifications`.

---

## 4. What has already been built toward an in-app version

| Piece | State | Location |
| --- | --- | --- |
| `Contributions.sol` table contract | Merged and tested (29 forge tests). **Not deployed** | `subscription-contracts/src/tables/Contributions.sol`, `test/Contributions.t.sol`, `script/Contributions.s.sol` |
| SQL escaping helper | Merged | `subscription-contracts/src/tables/SqlString.sol` |
| ABI | Merged, unused | `ui/const/abis/Contributions.json` |
| Config entries | Present, empty | `ui/const/config.ts:257-264` |
| Plan doc | Merged | `docs/CONTRIBUTIONS_TABLE_PLAN.md` |
| Contributions 2.0 spec (briefings, matchups) | Not merged. Only in closed draft PR #1696 | `docs/CONTRIBUTIONS_2.0_SPEC.md` in that PR |
| Matchup voting prototype (`/contribute-vote`) | Not merged (PR #1696) | n/a |
| In-app form, profile section, flag, dual-read | Not started | n/a |

What the merged contract does well:

- `submit` requires an unexpired Citizen NFT (`_requireCitizen`, `:239-243`). That is the
  strictest citizen gate in the repo, and it is enforced onchain.
- The author is always the sender.
- There is a cap per citizen per cycle (5).
- Authors can edit or remove their own rows only while the cycle is open.
- Operators can only hide rows.
- The payout Safe is the only address that can close a cycle or record `shareBps` and `reward`.
- All text is escaped.
- The Tableland controller is locked, so there is no second write path.

What it lacks for this goal:

1. **No way to import history.** Neither the author nor the cycle can be set by anyone.
2. **Rows are keyed by wallet only.** A profile has to join on `CITIZENTABLE.owner`. If a citizen
   moves their NFT to a new wallet, their history falls off the profile.
3. **The cycle is a bare counter** that increments by one. Imported quarters and future quarters
   need stable, readable IDs.
4. **Citizens pay their own gas.** Many citizens use Privy embedded wallets that hold no ETH on
   Arbitrum.

---

## 5. Target design

### 5.1 Contract: `Contributions` v2 (small changes to the undeployed v1)

Keep everything in v1 and add the following:

| Change | Why |
| --- | --- |
| `citizenId integer` column, set at submit from `citizenNFT.getOwnedToken(msg.sender)` | The CV stays attached to the citizen even if their wallet changes, and profiles query by token ID with no join |
| `origin integer` column: `0` = submitted onchain, `1` = imported | Profiles can label imported history as "imported from the 2024-2026 sheet" and keep it separate from rows the citizen signed |
| `closeCycle(uint256 nextCycleId)` with `nextCycleId > currentCycleId`, replacing increment-by-one | Lets cycle IDs be quarter codes: `20264` = Q4 2026, `20243` = Q4 2024. Profiles and reports read naturally, and imports can use past quarters without colliding with live cycles. Deploy with `currentCycleId = 20264` |
| `importBatch(Import[] rows)`, `onlyOwner` (the Safe) | Writes multi-row inserts with an explicit `author`, `citizenId`, `cycleId`, `createdAt`, text, `shareBps` and `reward`, and `origin = 1`. Only allowed when `cycleId <= currentCycleId`. Each statement stays under the 35 KB Tableland limit; the script splits large batches |
| `sealImports()`, `onlyOwner`, one-way | After the backfill is reviewed, imports are switched off permanently, so the Safe can't add history later |

Not added, as v1 decided: collaborators, matchups, an onchain status enum, and relayed
signatures. Each can come later as a separate table keyed by contribution ID.

**Schema after v2:**
`id, cycleId, citizenId, author, title, description, area, links, metadata, origin, hidden,
createdAt, updatedAt, shareBps, reward`

These changes are small, test-covered additions to a contract that hasn't shipped. Deploying v1
first and migrating to v2 later would cost a migration script and a second table name.

### 5.2 Submitting: what the citizen fills in

| Field | Today (Google Form) | New |
| --- | --- | --- |
| Name | typed | **removed**: comes from the citizen profile |
| Email | typed | **removed**: confirmation goes to the Privy-linked email, if there is one |
| Citizen? | typed | **removed**: enforced by the contract |
| Wallet | typed | **removed**: it is the signer |
| Quarter | implied by timestamp | **removed**: the contract assigns the open cycle |
| Title | n/a | **new**, required, up to 120 characters |
| Area | dropdown | dropdown (same categories as the Q3 report) |
| Description | long text | long text, up to 2,000 characters |
| Links | text | one or more URLs; at least one is recommended |
| Time commitment | dropdown | optional, stored in `metadata` |
| Related project | n/a | optional picker of the citizen's own projects (from their Hats), stored in `metadata.projectId` |

**What the citizen does:**

1. Open `/contributions` and click "Add contribution". A modal opens.
2. Fill in the four fields and submit with one signature.
3. See the result: "Saved to your profile."

**The submit sequence:**

1. Before signing, the client calls a gas sponsor route that tops up the citizen's wallet when it
   can't cover the transaction. This reuses the HSM top-up pattern from
   `ui/pages/api/deprize/sponsor-forecast-gas.ts`.
2. The client calls `submit`.
3. The client calls `waitForRow`.
4. The client posts the new ID to a notify route, which announces it on Discord. This replaces
   the 10-minute polling cron.

Signed-out visitors and non-citizens see the same gate as today, and the contract enforces it
regardless.

### 5.3 The onchain CV: profile section

Add a "Work" section to `ui/pages/citizen/[tokenIdOrName].tsx`, right after `CitizenProjects`
(`:595`), grouped by quarter:

- **Projects:** the existing `CitizenProjects` data, plus projects the citizen authored. Use
  `authorAddress`, the same lookup `/api/tableland/user-proposals.ts` already does, so authors
  appear even when they hold no Hat.
- **Contributions:**
  - Query: `SELECT * FROM CONTRIBUTIONS WHERE citizenId = :id AND hidden = 0 ORDER BY cycleId DESC, id DESC`.
  - Each card shows the title, area, description, links, and the reward if one was recorded
    ("Community Circle Q3 2025 · 6.6% · 158 USDC + 48k vMOONEY").
  - Imported rows get a small "imported" label.
- **Summary strip:** the number of quarters active, the number of contributions, the number of
  projects, and the total rewarded.

Then link to the record from job applications and team pages later, as the 2.0 spec suggests.

### 5.4 Review and payout using the table

- **Senate review report.** Add `/api/contributions/export?cycle=20264` (operators only). It
  returns CSV in the shape the CSV_to_PDF generator already expects, so the review report is
  built from the table instead of the sheet. Name and wallet are joined from `CITIZENTABLE`.
- **Writing results back.**
  - After the Senate allocates, an operator script builds one Safe batch containing
    `closeCycle(next)`, `recordResults(...)` for each row, the USDC airdrop and the
    `VotingEscrowDepositor` update.
  - Per-person Senate percentages become per-row `shareBps`. A person's share is split evenly
    across their rows, unless the Senate splits it per row.
  - `reward` stores what was paid, so the CV shows it.
- **Replacing the hand-edited map.** `communityCircle` in `ProjectRewards.tsx:767` becomes a
  computed map: the sum of `shareBps` per author for the cycle.

The matchup system from the 2.0 spec can later replace the Senate step, and it would write to
the same `recordResults`. None of this depends on that decision.

---

## 6. Build plan

### 6.1 Contracts (`subscription-contracts/`)

1. Make the §5.1 changes to `Contributions.sol`. Extend `test/Contributions.t.sol` to cover:
   - `citizenId` capture, including a citizen who later moves their NFT;
   - quarter-code cycles, with `closeCycle` rejecting a non-increasing ID;
   - `importBatch` (owner only, no future cycles, splitting under 35 KB, quotes escaped);
   - `sealImports` being one-way.
2. Update `script/Contributions.s.sol` to set the initial cycle to `20264`.
3. Deploy to Sepolia and run the checks from `CONTRIBUTIONS_TABLE_PLAN.md` §6 (Launch, step 3).
4. Deploy to Arbitrum. Transfer ownership to the payout Safe. Add one operator, the HSM wallet,
   which can only hide rows. Fill in `ui/const/config.ts:257-264` and regenerate the ABI.

### 6.2 UI (`ui/`)

| # | Task | Files |
| --- | --- | --- |
| 1 | Add a `contributions-onchain` flag (`ui/const/flags.ts`) so it is on in preview and staging and off in production until launch | `ui/const/flags.ts` |
| 2 | Add a read library: `getContributions({cycleId?, citizenId?, author?})` through `queryTable`, plus a cycle-label helper (`20264` → "Q4 2026") | `ui/lib/contributions/` |
| 3 | Build the submit modal: fields from §5.2, a project picker from `useProjectWearer`, gas top-up, `submit` and `waitForRow`, and edit or remove while the cycle is open | `ui/components/contribution/` (replacing the dead `ContributionEditor.tsx`) |
| 4 | Add a gas sponsor route that tops up citizen wallets, with a daily cap in Redis | `ui/pages/api/contributions/sponsor-gas.ts` |
| 5 | Add a notify route that reads the row by ID and posts to Discord. Retire the polling cron and its workflow after cutover | `ui/pages/api/contributions/notify.ts` |
| 6 | Make the feed read the table and accept `?cycle=`. During the Q4 2026 dual-read period, merge in sheet rows that haven't been imported | `ui/pages/api/contributions/feed.ts`, `RecentActivity.tsx` |
| 7 | Make the XP quest count table rows by `author`, plus any wallet linked to that citizen, instead of sheet rows | `ui/pages/api/xp/has-contributed-proof.ts` |
| 8 | Add the profile "Work" section (§5.3) | `ui/pages/citizen/[tokenIdOrName].tsx`, new `CitizenContributions.tsx` |
| 9 | Add the operator export for Senate review | `ui/pages/api/contributions/export.ts` |
| 10 | Generate the payout batch from table results and replace the hand-edited `communityCircle` | `ui/scripts/`, `ProjectRewards.tsx`, `ui/lib/utils/rewards.ts` |
| 11 | Clean-up: delete `ContributionEditor.tsx` and the Coordinape lib and routes, fix the ETH copy, update `docs/RETRO.md` and the Community Rewards docs | n/a |

### 6.3 A shared server-side citizen check

There is no reusable server helper today. Each route repeats an inline `getOwnedToken` check, and
none of them checks expiry. Add `requireActiveCitizen(req)` in `ui/lib/citizen/`. It should:

1. verify the Privy session;
2. loop over the user's linked wallets;
3. call `getOwnedToken` and `expiresAt` for each;
4. return `{ wallet, citizenId }`, or respond with 403.

Use it in the sponsor, notify and export routes, and later in `proposals/submit.ts` if proposals
become citizen-only.

---

## 7. Backfill: importing past quarters

### 7.1 Sources

| Source | Covers | Gives | Access |
| --- | --- | --- | --- |
| Google Sheet (form responses) | Every quarter since the form launched | Timestamp, name, email, wallet, area, description, time, links | Sheet owner exports a CSV. **Never commit it**: it contains emails |
| Senate review reports | Q3 2026 so far (`ui/content/contributions/2026-q3.html`) | Per-person categories, flags and summaries | In repo. Older quarters may exist in the CSV_to_PDF repo |
| Community Circle payout maps in git | Q4 2024: 55 addresses (`git show a1c2233d -- ui/lib/utils/rewards.ts`). Q3 2025: 19 addresses (`git show 0de12e3e -- ui/components/nance/ProjectRewards.tsx`) | Address → % of the circle | In repo history |
| Historical pool sizes | Q1 and Q2 2026 (`HISTORICAL_RETRO_POOLS`, `ui/lib/proposals/computeRetroactiveOutcome.ts:102-131`) | Circle totals in ETH or USDC plus MOONEY | In repo |
| Safe payout transactions | Every paid quarter | The amounts actually sent to each address | Onchain (Safe transaction history) |
| Coordinape circle 29837 | Quarters before the Google Form | Contributions and allocations | Coordinape API (`ui/lib/coordinape/client.ts`), if the key still works |

Quarters with no payout map in git need their per-address amounts rebuilt from the Safe
transactions, matched against the circle total for that quarter.

### 7.2 Steps

1. **Export.** Export the full sheet to a private location. Drop the Email column straight away.
2. **Assign cycles.**
   - Map each row's timestamp to a cycle code, using that quarter's actual submission window
     rather than calendar dates. Q3 2026, for example, ran from Jul 16 to Oct 8.
   - Get the windows from the cycle checklists and review reports, and write them down in the
     script.
3. **Resolve identity.** For each row, in order:
   1. Check that the wallet is valid, then match it to `CITIZENTABLE.owner`. That gives a
      citizen ID.
   2. If the citizen's NFT has moved, match the wallet against past owners using Citizen NFT
      `Transfer` events.
   3. Otherwise, match the name against citizen names, `DISCORD_TO_ETH_ADDRESS` and ENS.
   4. If none of these works, put the row in a manual review queue.

   Rows that resolve to someone who has never been a citizen are not imported onchain, because
   the CV lives on citizen profiles. They stay in an offline archive file, and can be imported if
   that person becomes a citizen before `sealImports`.
4. **Attach rewards.**
   - For each quarter, join the payout amounts by address.
   - Past payouts were per person, not per contribution. Put the person's quarter reward on each
     of their rows in `metadata` as `{"cycleReward":{...},"rewardScope":"person"}`, and leave
     `shareBps` at `0`.
   - The profile shows the reward once per quarter group, not once per card.
5. **Normalize.**
   - Title: the first sentence of the description, cut to 120 bytes, and marked with
     `metadata.titleGenerated: true`.
   - Area: map to the current categories.
   - Description and links: cut to the contract limits; the original length goes in `metadata`.
   - `createdAt`: the form timestamp.
6. **Dry run.**
   - Import into the Sepolia table and look at a few dozen profiles in a preview deploy.
   - Produce a manifest with the counts per quarter, resolved vs. unresolved, and the rewards
     matched vs. pool total.
7. **Review window (2 weeks).**
   - Publish the manifest to citizens: quarter, citizen, title and reward. No emails or raw
     wallets.
   - Each citizen can claim a missed row, correct a wrong match, or opt out of having a row put
     onchain. Opting out matters because onchain text is permanent.
   - Announce it on Discord and in the newsletter.
8. **Import on Arbitrum.**
   - The Safe executes `importBatch` calls, as many as the 35 KB statement limit needs; a few
     hundred rows should take only a handful of transactions.
   - After a final check, the Safe calls `sealImports()`.
9. **Retire the sheet.**
   - Remove `CONTRIBUTIONS_SHEET_CSV_URL` from Vercel.
   - Unpublish the CSV.
   - Keep the sheet read-only as an offline archive.

The import script goes in `subscription-contracts/script/backfill/` next to the existing backfill
helpers. It reads the private CSV from a path passed as an argument and writes the batch
calldata and the manifest.

---

## 8. Cutover and timeline

The Q4 2026 contribution cycle opened around Oct 8 and closes in early January. The aim is for
the Q4 Senate review to read from the table, not the sheet.

| When | Milestone |
| --- | --- |
| This week | Fix the §3.5 problems: check the email column in the published CSV and set `CRON_SECRET`. Make the decisions in §9 |
| Weeks 1-2 | Contract v2, tests, Sepolia deploy (§6.1) |
| Weeks 2-4 | UI tasks 1-8 behind the flag; preview testing against Sepolia |
| Week 5 | Arbitrum deploy. Turn on the flag. **Set the Google Form to stop accepting responses**, with a message pointing to `/contributions`. Import the Q4 sheet rows submitted so far into cycle `20264` (`origin = 1`), so all of Q4 lives in the table |
| Weeks 5-8 | Historical backfill steps 1-7 (§7.2) |
| Week 8-9 | Import on Arbitrum, then `sealImports()`, then retire the sheet |
| Q4 2026 close (Jan) | Senate reviews from `/api/contributions/export`. The Safe batch records results and pays. Rewards appear on profiles. Remove the dual-read code |

---

## 9. Decisions needed

| # | Decision | Recommendation |
| --- | --- | --- |
| 1 | Gas: top up citizen wallets from the HSM, or relay signatures (needs `submitWithSig`)? | **Top-up.** The forecast flow already does this, and it needs no contract change |
| 2 | Cycle IDs as quarter codes (`20264`) or a bare counter? | **Quarter codes**. The cycle closes whenever the Safe calls `closeCycle`, so monthly cycles later would just use codes like `202701` |
| 3 | Cap per citizen per cycle: keep 5? | Keep 5. The Safe can change it |
| 4 | Import contributors who were never citizens? | **No.** Keep them in an offline archive, importable if they become citizens before the seal |
| 5 | Allow citizens to opt out of having past rows imported? | **Yes**, during the review window |
| 6 | Which quarters to backfill? | Every quarter the sheet covers. Coordinape-era quarters only if the API export still works |
| 7 | Should proposal submission also become citizen-only? | Separate decision; §6.3 makes it a one-line change |
| 8 | Evaluation model: keep the Senate for now, with matchups (2.0 spec) as a later decision? | **Yes**: this plan works with either |

---

## 10. Adjacent findings to confirm

These are not part of this migration, but they affect how far a profile can be trusted as a CV.

1. **`CitizenTableV2` lets anyone edit or delete any profile, in source.**
   - `updateTableDynamic` and `deleteFromTable` (`CitizenTableV2.sol:122`, `:146`) have no
     access check, and the contract writes to its table as the table owner.
   - `CitizenRowController` gives the table owner allow-all, so as written, anyone can edit or
     delete any citizen's profile row.
   - Confirm against the verified code at `0x0Eb1dF01…70d1` on Arbitrum. If it matches, fix it
     before the profile becomes a CV.
2. **SQL injection** through unescaped `SQLHelpers.quote` in `Votes`, `Distribution`,
   `Forecasts`, `Proposals` and `NonProjectProposal`. This is already written up in
   `CONTRIBUTIONS_TABLE_PLAN.md` §8.
3. **`Project.getPolicy` returns allow-all** if it is ever set as a controller.
