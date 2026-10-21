# Ranked-choice elections

MoonDAO members elect people to seats, such as Executive Lead, by ranked-choice
vote on moondao.com. Each election is a standalone vote with its own page at
`/elections/<slug>`. It does not go through the proposal process, and the Senate
does not vote on it. The Senate's part is confirming the candidates beforehand.

## Why it exists

The Constitution requires ranked-choice voting in several places:

- **Executive Lead elections.** If more than one candidate is approved, the
  Member House votes using instant-runoff ranked choice, with a "none" option.
  If "none" wins, the seat stays vacant.
- **Primus selection.** If the Executive Leads cannot agree within 14 days of an
  election, the Member House picks the Primus by ranked-choice vote.
- **Signer selection.** The Executive Leads may give the Member House a list of
  people to choose from by ranked-choice vote, with a "none" option.

Before this, the site had no working ranked-choice vote. The Member House vote
on proposals only supports For / Against / Abstain.

## What it is based on

Nothing here is new governance. It follows two things MoonDAO already does.

**The last election, MDP-149 (August 2024).** "Second Elected Leader of the
Executive Branch" was a one-off ranked-choice vote on Snapshot:

- three candidates, a 10-day voting window, no quorum
- each voter's weight was the square root of their vMOONEY, summed across
  Ethereum, Polygon and Arbitrum
- votes were encrypted until the vote closed

We no longer use Snapshot. The new system keeps the same rules and runs them on
our own site.

**Our other one-off votes.** The WBA, Baikonur, Overview delegation and "Send
Frank to Space: Path Forward" votes all work the same way:

- each vote has its own number (`voteId`) in one shared on-chain table, `Votes`,
  on Arbitrum
- each vote has its own page
- results stay hidden until the vote closes
- after close, the final result is frozen into a file committed to the repo, so
  it cannot change later

Elections use the same table and the same pattern. Vote numbers 0 to 3 are
taken. The first election uses 4.

## How a vote works, start to finish

### 1. Candidates and Senate confirmation

Elections are set up in `ui/lib/elections/elections.ts`. Each election lists
its candidates. Each candidate gets:

- a permanent ID number (1, 2, 3, ...), used on ballots
- a name, and optionally a handle, a short bio and a link to their platform
- a Senate confirmation record: the date and a link

The Senate confirms each candidate off-chain, for example by a vote in Discord
or in a meeting. Someone then pastes the date and a link to that record into
the config.

**A candidate without a Senate confirmation link does not appear on the
ballot.** On the page, each confirmed candidate shows a "Senate-confirmed"
badge that links to the record, so any voter can check it.

The Senate's confirmation process itself (where it happens, what the threshold
is, what counts as the record) is not decided yet and is up to the Senate and
the Executive Branch. The site only needs the link.

### 2. Who can vote and how much a vote counts

Anyone with vMOONEY can vote, which is the same group as the Member House. A
wallet with no vMOONEY cannot submit a ballot.

Voting power is **the square root of the voter's vMOONEY**, added up across
Ethereum, Polygon, Arbitrum and Base. This is the same formula MDP-149 used and
the same one Member House proposal votes use. The square root keeps large
holders from dominating. A voter with 4x the vMOONEY gets 2x the vote.

vMOONEY is measured **at the moment voting closes**, not when the ballot was
cast. If a voter locks more MOONEY partway through the vote, the extra counts.
During the vote, the page shows each voter's power projected to the close time.

### 3. Casting a ballot

On the election page, a voter connects their wallet and taps candidates in
order of preference. They can move entries up or down and remove them.

- They do not have to rank everyone. Ranking one candidate is a valid ballot.
- "None of the above" is on the ballot as a normal choice and can be ranked
  like any candidate.
- Submitting sends one transaction on Arbitrum, which costs a small amount of
  ETH for gas. No tokens leave the wallet.
- A voter can change their ballot as many times as they like until voting
  closes. The latest version counts.

The ballot is stored on-chain as an ordered list of candidate ID numbers. For
example, `[3,1]` means "candidate 3 first, then candidate 1". Ballots use the
permanent IDs rather than positions in the list. That way, adding a candidate
or changing a candidate's display details can never change what an existing
ballot means.

### 4. While voting is open

The page shows how many people have voted, their names (when they are
citizens), and their voting power. It does not show anyone's choices or the
running tally. This matches how MDP-149 hid votes until close, and keeps people
from simply voting for whoever is ahead.

The underlying table is public, so a technical person could read the raw
ballots on-chain. Hiding them is a page-level choice, the same as for proposals,
not encryption.

### 5. Counting: instant runoff

Once voting closes, the votes are counted in rounds.

1. Each ballot counts fully for the voter's highest-ranked candidate who is
   still in the race.
2. If a candidate has **more than half** of the voting power still in play,
   they win.
3. Otherwise, the candidate in last place is eliminated. Those ballots move to
   each voter's next choice, and the count repeats.

A ballot whose ranked choices have all been eliminated is "exhausted" and drops
out. The "more than half" in step 2 is measured only against ballots still in
play.

**Example.** Alice, Bob and Carol are running. Four voters have voting power
40, 35, 30 and 10:

| Voter | Power | Ballot |
|---|---|---|
| A | 40 | Alice |
| B | 35 | Bob, Carol |
| C | 30 | Carol, Alice |
| D | 10 | None of the above, Bob |

- **Round 1:** Alice 40, Bob 35, Carol 30, None 10. Total 115. Nobody has more
  than 57.5. None is last and is eliminated, so D's ballot moves to Bob.
- **Round 2:** Alice 40, Bob 45, Carol 30. Still no majority. Carol is last and
  is eliminated, so C's ballot moves to Alice.
- **Round 3:** Alice 70, Bob 45. Alice has more than half and wins.

Alice was not leading the whole time. She won because she was the second choice
of Carol's supporters.

**Ties for last place.** If two candidates tie for last, the system looks back
at earlier rounds and eliminates whichever had less there. If they were tied in
every round, both are eliminated together. Exact ties are very unlikely,
because voting power is a square root and rarely a round number.

**An unbreakable tie for the win.** If the only candidates left are exactly
tied and no earlier round separates them, the system does not pick a winner. It
reports a tie for the Senate to resolve.

**If "None of the above" wins,** the seat stays vacant, as the Constitution
requires.

### 6. Results and freezing

After voting closes, the page shows:

- the winner, or "Seat vacant" or "Tied" if that is the outcome
- the final round, with each remaining candidate's share
- every round, with who was eliminated and how much voting power ran out of
  choices
- each voter's first choice

Until the final result is frozen, the page labels the results "Preliminary".

Freezing works like the Path Forward vote. Right after close, an operator runs:

```bash
cd ui
yarn snapshot:election executive-branch-2027
```

The name "snapshot" is only the script name used for the Path Forward vote. It
has nothing to do with Snapshot.org.

The script:

- reads every ballot from the table
- reads each voter's vMOONEY at the exact block on each chain that matches the
  close time, so the result is precise however late the script runs
- counts the votes
- writes the full result to `ui/lib/elections/snapshots/<slug>.json`

It refuses to write anything if every voter comes back with zero voting power,
which almost always means a network read failed.

The operator commits that file and sets `closed: true` on the election. From
then on the page always shows the frozen result.

## Running an election: checklist

1. **Set up the election** in `ui/lib/elections/elections.ts`. A placeholder
   for the Executive Branch election already exists (`executive-branch-2027`,
   vote number 4). It stays `published: false` until it is ready, so it only
   appears on local and preview builds.
2. **Add candidates** as the Senate confirms them. Give each one a new ID number
   and the confirmation link. Never reuse or change an ID once voting opens.
3. **Set the dates.** Fill in `opensAt` and `closesAt` (ISO format, e.g.
   `2027-02-01T16:00:00Z`). MDP-149 ran for 10 days.
4. **Publish.** Set `published: true` and deploy. Share
   `moondao.com/elections/executive-branch-2027`.
5. **Close.** As soon as `closesAt` passes, run
   `yarn snapshot:election executive-branch-2027`, commit the JSON file, set
   `closed: true`, and deploy.
6. **Announce** the result. The page shows the full round-by-round breakdown to
   link to.

## Trying it out

Two demo elections exist for previews. Like every unpublished election, they
appear on local and Vercel preview builds and never on moondao.com:

- `/elections/demo` is open, with three made-up candidates, so you can rank
  and submit a ballot. A fourth candidate has no Senate confirmation, which
  shows that unconfirmed candidates are hidden.
- `/elections/demo-results` is a finished election. It shows the results view
  using the real test ballots from Sepolia, with voting power assigned for the
  demo. It is the Alice / Bob / Carol example above.

## Where the code lives

| What | File |
|---|---|
| Election setup (candidates, dates, flags) | `ui/lib/elections/elections.ts` |
| The instant-runoff count | `ui/lib/elections/rankedChoice.ts` |
| Reading ballots and voting power | `ui/lib/elections/fetchElectionResults.ts` |
| The election page | `ui/pages/elections/[slug].tsx` |
| Ballot ranking control | `ui/components/elections/RankedBallot.tsx` |
| Results display | `ui/components/elections/RankedChoiceResults.tsx` |
| Freeze script | `ui/scripts/snapshot-election.ts` |
| Tests | `ui/cypress/integration/unit/election-ranked-choice.cy.ts` |

No smart contract changes were needed. The `Votes` contract already stores any
text as a vote.

## How it was tested

- **Counting logic:** 13 automated tests, covering ballots moving to next
  choices, voting-power weighting, exhausted ballots, permanent IDs, "None of
  the above" winning, tie-breaks, an unbreakable tie and malformed ballots.
  They run with `yarn test:cypress-unit`.
- **Real ballots on testnet:** five wallets wrote real ballots to the Sepolia
  votes table. One ballot was edited and one was malformed. The app read them
  back correctly: the edit showed up, the malformed one was dropped, and the
  three-round count matched a hand count. This is the example above.
- **Voting power on mainnet:** for 11 real vMOONEY holders, the voting power the
  page shows during the vote matched the exact value the freeze script uses.
- **The page:** checked on desktop and phone with placeholder candidates.
  Ranking worked, unconfirmed candidates were hidden, results stayed hidden
  while voting was open, and the results view displayed correctly.

**Not tested yet:** submitting a ballot through the page's button with a real
wallet. That goes through Privy and needs a person in a browser. Before the
real election, someone should cast a ballot on a test election from a preview
deploy.

## Open questions and known limits

- **Senate confirmation process.** The site only needs a link per candidate.
  How the Senate confirms (where, what threshold) still needs to be agreed.
- **Edits after the deadline.** The `Votes` table has no timestamps, and the
  contract cannot enforce a deadline. The page stops accepting ballots at
  `closesAt`, but someone calling the contract directly could still change
  their ballot until the freeze script runs. Running the script promptly at
  close covers this in practice. If we want it airtight, the script can be
  extended to rebuild every ballot as it stood at the close block from the
  contract's on-chain history.
- **One seat per election.** This elects a single winner. Filling several seats
  at once, such as multiple signers, would need either separate elections or a
  multi-winner method added later.
- **Setup is a code change.** Adding candidates and dates means editing a file
  and deploying. A form for this could come later if elections become frequent.
