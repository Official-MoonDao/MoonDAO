# Prevent Proposal Authors From Voting on Their Own Proposals

## Summary

This document outlines the changes required to prevent proposal authors from voting on their own proposals, following the same pattern used for **retroactive rewards** (where contributors cannot allocate to their own project—they see "Contributed" / "Ineligible" and have no vote control).

There are **two voting contexts** to cover:

1. **Senate vote (temp check)** – Senators approve/deny proposals via `voteTempCheck(mdp, approve)` on-chain.
2. **Member vote (distribution)** – Members allocate percentages across proposals via `insertIntoTable` / `updateTableCol` (quarter, year, distribution).

Author identity today comes from **proposal JSON** (IPFS): `authorAddress` is set in the editor when the user submits. It is **not** stored on-chain, so the contract cannot enforce author checks until we add a registry.

---

## Current State

### Smart contract (`subscription-contracts/src/tables/Proposals.sol`)

- **Senate vote:** `voteTempCheck(uint256 mdp, bool approve)` – any senator can vote; no notion of “proposal author.”
- **Distribution:** `insertIntoTable(quarter, year, distribution)` and `updateTableCol(quarter, year, distribution)` – no check that the sender is not the author of any project in their distribution.
- There is no on-chain storage of “who is the author of proposal MDP.”

### UI

- **Retroactive rewards pattern** (in `ProjectCard.tsx`): `userContributed` is derived from hat wearers + `rewardDistribution`. If the user contributed to a project, they see “Contributed” and **cannot** use the NumberStepper to allocate; otherwise they can. So “ineligible” = no voting control for that project.
- **Proposal author:** Only in `proposalJSON.authorAddress` (from IPFS), used in `ProposalInfo.tsx` and set in `ProposalEditor.tsx` when submitting.
- **Senate vote:** `SenateVoteButtons` in `ProjectCard.tsx` and `TempCheck.tsx` call `voteTempCheck`; they only check `isSenator` and do not consider whether the wallet is the proposal author.
- **Distribution submit:** `ProjectRewards.tsx` calls `insertIntoTable` / `updateTableCol` with `[quarter, year, JSON.stringify(proposalDistribution)]`; no author check.

### Proposal creation flow

- `ProposalEditor` submits to `/api/proposals/submit`; the API uses an HSM wallet to call `ProjectTeamCreator.createProjectTeam(..., proposalId, ...)`. The **user’s** address is the author (and is stored in proposal JSON as `authorAddress`). The Proposals contract is never involved in creation.

---

## Required Changes

### 1. Smart contract: Proposals.sol

- **Add author registry**
  - `mapping(uint256 => address) public proposalAuthor;`
  - Only used when non-zero; existing proposals stay `address(0)` and remain unrestricted for backward compatibility.

- **Add registration (author-only, once per MDP)**
  - `function registerProposalAuthor(uint256 mdp, address author) external`
  - Require `proposalAuthor[mdp] == address(0)` and `msg.sender == author`.
  - So only the author can register themselves for a given MDP, and only once.

- **Senate vote**
  - In `voteTempCheck(mdp, approve)` add:
    - `require(proposalAuthor[mdp] == address(0) || proposalAuthor[mdp] != msg.sender, "Cannot vote on own proposal");`
  - Proposals that never had an author registered (e.g. legacy) keep current behavior.

- **Distribution vote**
  - Today the contract cannot know which project IDs are in the JSON. So either:
    - **Option A (recommended):** Add an explicit parameter for project IDs and enforce in the contract:
      - `insertIntoTable(quarter, year, distribution, uint256[] calldata projectIds)`
      - `updateTableCol(quarter, year, distribution, uint256[] calldata projectIds)`
      - Before performing the insert/update, loop:  
        `for (uint256 i; i < projectIds.length; i++) require(proposalAuthor[projectIds[i]] == address(0) || proposalAuthor[projectIds[i]] != msg.sender, "Cannot vote on own proposal");`
    - **Option B:** Enforce only in the UI (no contract change for distribution). Contract would still need `proposalAuthor` and `registerProposalAuthor` for the Senate vote.

  Recommendation: **Option A** so both Senate and distribution are enforced on-chain.

### 2. UI: Senate vote (temp check)

- **ProjectCard.tsx**
  - In `ProjectCardContent`, `useProposalJSON(project)` already provides `proposalJSON`.
  - Compute:  
    `isProposalAuthor = proposalJSON?.authorAddress?.toLowerCase() === account?.address?.toLowerCase()`
  - Pass `isProposalAuthor` into the block that renders `SenateVoteButtons` (or into `SenateVoteButtons` as a prop).
  - In `SenateVoteButtons`: if `isProposalAuthor`, do **not** show the approve/deny buttons; show the same counts in a disabled/grayed state and a label like “Author” (same UX pattern as when the user is not a senator).

- **TempCheck.tsx** (if used on project pages)
  - If this component is used in a context where the same “author cannot vote” rule applies, it should also receive `isProposalAuthor` (or proposal/proposalJSON) and hide or disable the vote buttons when the current wallet is the author.

### 3. UI: Member vote (distribution)

- **ProjectCard.tsx**
  - Reuse the same `isProposalAuthor` from proposal JSON.
  - For the member-vote column (the one that shows either “Contributed” + loading, or the NumberStepper, or “Ineligible”):
    - If `isProposalAuthor`, treat like “ineligible”: show “Author” or “Ineligible” and **do not** show the NumberStepper for that project (same pattern as `userContributed`).

- **ProjectRewards.tsx**
  - When calling the contract for **proposal** distribution (`handleProposalSubmit`):
    - If using **Option A** above, pass the list of project IDs in the distribution:  
      `Object.keys(proposalDistribution).map((id) => Number(id))`  
      and call `insertIntoTable(quarter, year, JSON.stringify(proposalDistribution), projectIds)` and similarly for `updateTableCol`.
  - No need to strip the author’s project from the distribution on the client if the contract enforces it; the contract will revert if they include their own project. The UI already prevents them from allocating to their own project (no NumberStepper), so normally the distribution won’t include it.

### 4. Register author after proposal creation

- **Constraint:** `registerProposalAuthor` must be called by the author (`msg.sender == author`). The submit API uses an HSM wallet, so the API **cannot** register the author on the user’s behalf.
- **Flow:** After the submit API returns success with `proposalId`, the **frontend** (user’s wallet) should call `registerProposalAuthor(proposalId, address)`.
- **Where:** In `ProposalEditor.tsx`, after `setSubmittedProposalId(response.proposalId)` (and before or after showing the success CTA), trigger a second transaction with the user’s account:  
  `prepareContractCall(proposalContract, 'registerProposalAuthor', [response.proposalId, address])` then `sendAndConfirmTransaction` with the user’s account. Alternatively, this could be done from the success modal (e.g. “Register as author” step) so the user sees it as part of the post-submit flow.
- **Contract:** Ensure the Proposals contract and chain are available in the client (same as for other proposal contract calls), and add `registerProposalAuthor` to the ABI after the contract is updated.

### 5. ABI and tests

- **ABI:** After changing `Proposals.sol`, regenerate or update `ui/const/abis/Proposals.json` to include:
  - `proposalAuthor(uint256)`
  - `registerProposalAuthor(uint256,address)`
  - Updated `insertIntoTable` / `updateTableCol` signatures if you add `projectIds` (Option A).
- **Tests:** In `subscription-contracts/test/Proposals.t.sol`:
  - Add a test that an author cannot call `voteTempCheck` for their own MDP (after registering as author).
  - If Option A: add a test that an author cannot call `insertIntoTable` / `updateTableCol` with a distribution that includes their own project ID.

---

## File checklist

| Area            | File(s)                                                                 | Change |
|-----------------|-------------------------------------------------------------------------|--------|
| Contract        | `subscription-contracts/src/tables/Proposals.sol`                       | Author mapping, `registerProposalAuthor`, check in `voteTempCheck`, optional `projectIds` + check in insert/update |
| Contract tests  | `subscription-contracts/test/Proposals.t.sol`                           | Tests for author cannot vote (temp check and, if applicable, distribution) |
| ABI             | `ui/const/abis/Proposals.json`                                         | Regenerate after contract changes |
| Senate vote UI  | `ui/components/project/ProjectCard.tsx`                                | `isProposalAuthor`, pass to `SenateVoteButtons`, author sees disabled state / “Author” |
| Senate vote UI  | `ui/components/project/TempCheck.tsx`                                  | If used in same context, add author check and disable/hide vote when author |
| Member vote UI  | `ui/components/project/ProjectCard.tsx`                               | Use `isProposalAuthor` to show “Author”/“Ineligible” and no NumberStepper for own proposal |
| Distribution    | `ui/components/nance/ProjectRewards.tsx`                               | Pass `projectIds` to `insertIntoTable` / `updateTableCol` if Option A |
| Post-submit     | `ui/components/nance/ProposalEditor.tsx` (and/or success CTA/modal)   | After submit success, call `registerProposalAuthor(proposalId, address)` with user wallet |

---

## Backward compatibility

- **Existing proposals:** `proposalAuthor[mdp]` remains `address(0)`, so:
  - Senate: no one is blocked by the new check.
  - Distribution: no project is blocked by the new check for those MDPs.
- **New proposals:** Authors should register after creation so that both Senate and distribution enforce “author cannot vote on own proposal.”

This keeps existing behavior for old proposals while applying the new rule for newly created ones once the author registration step is in place.
