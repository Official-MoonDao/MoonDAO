# $OVERVIEW Token Delegation

Delegate $OVERVIEW tokens to a single citizen. Leaderboard ranks citizens by effective delegated amount (capped at delegator's current balance to prevent recycling).

---

## Architecture

- Storage: Existing Votes table on Tableland (voteId = 2)
- Vote format: `{ "0xCitizenOwner": amount }` (human-readable, not wei)
- Page: `overview-delegate.tsx` with `getStaticProps` (revalidate: 60)
- Citizen search: Inline, using `/api/citizens/search` (same as CitizenReferral)
- Submit: Directly to Votes contract (`insertIntoTable` / `updateTableCol`)
- Balance validation: `amount <= userBalance`, `amount > 0`
- Anti-gaming: Leaderboard caps each delegation at delegator's current balance
- Token address: Hardcoded in config (get from team before building)

---

## Anti-Gaming: Balance Check at Leaderboard Time

Users could delegate tokens then transfer them to another wallet and delegate again. To prevent this, `getStaticProps` fetches every delegator's **current** $OVERVIEW balance and computes:

```
effective_delegation = min(stored_amount, current_balance)
```

Uses `engineBatchRead` (already exists in `ui/lib/thirdweb/engine.ts`) to batch all `balanceOf` calls into a single Thirdweb Engine request. For 1,000 delegators, this is **1 API call every 60 seconds**.

Balance results come back as strings (wei). Divide by `10^decimals` (18, confirm with team) to get human-readable amounts for comparison.

---

## Pre-Build Checklist

1. Confirm Votes table controller allows voteId 2
2. Get the $OVERVIEW token address from the team and hardcode it
3. Confirm token decimals (likely 18)

---

## Files to Create / Modify

| Action | File | Purpose |
|--------|------|---------|
| Modify | `ui/const/config.ts` | Add `OVERVIEW_DELEGATION_VOTE_ID`, `OVERVIEW_TOKEN_ADDRESS` |
| Create | `ui/pages/overview-delegate.tsx` | Page: form + leaderboard (all in one file) |

Two touches total.

---

## Config (`ui/const/config.ts`)

```ts
export const OVERVIEW_DELEGATION_VOTE_ID = 2
export const OVERVIEW_TOKEN_ADDRESS = '0x...' // $OVERVIEW ERC20 — get from team
export const OVERVIEW_TOKEN_DECIMALS = 18     // confirm with team
```

---

## Page: `overview-delegate.tsx`

### `getStaticProps` (revalidate: 60)

```
1. Query delegations from Tableland
   - Use DEFAULT_CHAIN_V5 and getChainSlug (not hardcoded 'arbitrum')
   - SELECT * FROM ${VOTES_TABLE_NAMES[chainSlug]} WHERE voteId = 2
   - Parse each row's vote JSON: { delegateeAddress: amount }

2. Batch-fetch current balances (anti-gaming)
   - Collect unique delegator addresses
   - engineBatchRead(OVERVIEW_TOKEN_ADDRESS, 'balanceOf', addresses, ERC20_ABI, chain.id)
   - Parse string results, divide by 10^decimals
   - 1 API call regardless of delegator count

3. Compute leaderboard
   - For each delegation: effective = min(stored_amount, current_balance)
   - Aggregate by delegatee: sum effective amounts, count delegators
   - Sort by total descending

4. Enrich with citizen data
   - Collect unique delegatee addresses
   - Validate: each is 42-char hex (sanitize before SQL interpolation)
   - Query citizens: SELECT id, name, owner, image FROM ${CITIZEN_TABLE_NAMES[chainSlug]}
     WHERE owner IN (...)
   - Skip delegatees with no matching citizen (non-citizen addresses)

5. Return { leaderboard, tokenAddress: OVERVIEW_TOKEN_ADDRESS }

Error handling: wrap everything in try/catch, return
{ leaderboard: [], tokenAddress: OVERVIEW_TOKEN_ADDRESS } on failure.
```

### Client-Side State

- `useActiveAccount()` for connected wallet
- `useWatchTokenBalance(DEFAULT_CHAIN_V5, OVERVIEW_TOKEN_ADDRESS)` for user's $OVERVIEW balance
- Edit vs insert detection: try `insertIntoTable` first; if it reverts (unique constraint on `address, voteId`), fall back to `updateTableCol`. No need to pass all delegations to the client.

### Page Layout

```
+-----------------------------------------------+
|  Header: "Delegate $OVERVIEW"                  |
|  Subtext: Explanation                          |
+-----------------------------------------------+
|  Your Balance: 1,234 $OVERVIEW                 |
+-----------------------------------------------+
|  Search Citizen: [___________] (dropdown)      |
|  Amount: [___________]  [MAX]                  |
|  [Delegate]                                    |
+-----------------------------------------------+
|  Leaderboard (inline, not a separate file)     |
|  1. Alice (#42)     — 5,000 $OVERVIEW          |
|  2. Bob (#17)       — 3,200 $OVERVIEW          |
|  3. Carol (#91)     — 1,800 $OVERVIEW          |
|  ...                                           |
+-----------------------------------------------+
```

### Citizen Search (Inline)

Copy pattern from CitizenReferral: debounced input, `/api/citizens/search`, dropdown.

```ts
const [searchQuery, setSearchQuery] = useState('')
const [searchResults, setSearchResults] = useState([])
const [selectedCitizen, setSelectedCitizen] = useState(null)
const searchTimeoutRef = useRef(null)

const handleSearchChange = (value: string) => {
  setSearchQuery(value)
  setSelectedCitizen(null)
  if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
  searchTimeoutRef.current = setTimeout(async () => {
    if (value.length < 2) { setSearchResults([]); return }
    const res = await fetch(`/api/citizens/search?q=${encodeURIComponent(value)}`)
    const data = await res.json()
    setSearchResults(data.citizens || [])
  }, 300)
}
```

### Submit

```ts
const votesContract = useContract({
  address: VOTES_TABLE_ADDRESSES[chainSlug],
  chain: DEFAULT_CHAIN_V5,
  abi: VotesTableABI.abi,
})

const handleSubmit = async () => {
  if (!selectedCitizen) return toast.error('Select a citizen')
  if (amount <= 0) return toast.error('Enter an amount')
  if (amount > userBalance) return toast.error('Amount exceeds balance')

  const vote = JSON.stringify({ [selectedCitizen.owner]: amount })

  try {
    // Try insert first
    const tx = prepareContractCall({
      contract: votesContract,
      method: 'insertIntoTable',
      params: [OVERVIEW_DELEGATION_VOTE_ID, vote],
    })
    await sendAndConfirmTransaction({ transaction: tx, account })
  } catch (e) {
    // Row already exists — update instead
    const tx = prepareContractCall({
      contract: votesContract,
      method: 'updateTableCol',
      params: [OVERVIEW_DELEGATION_VOTE_ID, vote],
    })
    await sendAndConfirmTransaction({ transaction: tx, account })
  }

  router.reload()
}
```

### Leaderboard (Inline)

Render directly in the page. Each row: rank, citizen image/name (link to `/citizen/[id]`), total effective delegated amount, number of delegators.

```ts
type LeaderboardEntry = {
  delegateeAddress: string
  citizenId: number
  citizenName: string
  citizenImage?: string
  totalDelegated: number
  delegatorCount: number
}
```

---

## Amounts: Human-Readable

- Store amounts in human-readable form (e.g. `1000`, not `1000000000000000000000`)
- `useWatchTokenBalance` returns `displayValue` (human-readable)
- `engineBatchRead` returns raw wei strings; divide by `10^decimals` in getStaticProps
- On submit, store the display value directly in the vote JSON

---

## Known Limitations

- **No lock**: Delegation is a signal, not a custody transfer. User keeps tokens.
- **Balance capping**: If user delegates 1000 then transfers tokens away, their effective delegation drops to 0 on next leaderboard refresh (within 60s).
- **Citizen transfers**: If citizen NFT is sold, delegations still point to old owner address.
- **One citizen per user**: Each user can delegate to one citizen at a time (overwrite with update).
- **Non-citizen delegatees**: If someone calls the contract directly with a non-citizen address, the entry is silently excluded from the leaderboard.

---

## Implementation Order

1. Get token address and decimals from team; add to config along with `OVERVIEW_DELEGATION_VOTE_ID`
2. Build `getStaticProps`: query delegations, batch balance check, compute leaderboard, enrich with citizen data, try/catch with empty fallback
3. Build page: balance display, citizen search, amount input, submit (insert-then-update pattern)
4. Build inline leaderboard
5. Add nav link
