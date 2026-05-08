# Contract Ownership Audit
**MoonDAO — May 8, 2026**
**Branch:** Contract-Owners-Audit

---

## Key Addresses

| Label | Address |
|---|---|
| HSM Signer (GCP Google Cloud Wallet) | `0xb206325e6562517532686dfeeead4c104d9f5d32` |
| DAO Treasury / Multisig Safe (Arbitrum) | `0xAF26a002d716508b7e375f1f620338442F5470c0` |

---

## On-Chain Results

> Queried live via `cast call` on May 8, 2026.
> ✅ = DAO Safe · ⚠️ = Unknown EOA · 🔴 = Critical

### XP System — Arbitrum

| Contract | Owner (On-Chain) | Status | Notes |
|---|---|---|---|
| XPOracle | DAO Safe | ✅ | HSM is authorized signer only (signs XP proofs, no funds) |
| XPManager (UUPS Proxy) | DAO Safe | ✅ | |
| XP Verifiers (all) | DAO Safe | ✅ | HSM is authorized signer on CitizenReferralsStaged only |
| HasCreatedATeam | Not verified | ⚠️ | Not transferred in deploy script — verify on-chain |

---

### Subscription / Core Contracts — Arbitrum

| Contract | Address | Owner (On-Chain) | Status | Notes |
|---|---|---|---|---|
| MoonDAOTeamCreator | `0xAB2C354eC32880C143e87418f80ACc06334Ff55F` | DAO Safe | ✅ | HSM is authorized signer for team creation automation — appropriate |
| VotingEscrowDepositor | `0xBE19a62384014F103686dfE6D9d50B1D3E81B2d0` | `0xAF26a002d716508b7e375f1f620338442F5470c0` | ✅ | DAO Safe — confirmed |
| **MoonDAOTeam** | `0xAB2C354eC32880C143e87418f80ACc06334Ff55F` | `0x29B0D7d7f0C88Ce0DF1De5888b37B90A6faF75cB` | ⚠️ | Unknown EOA. Can call `setTreasury()`, `setPricePerSecond()`, `setDiscount()` |
| **MoonDAOCitizen** | `0x6E464F19e0fEF3DB0f3eF9FD3DA91A297DbFE002` | `0x29B0D7d7f0C88Ce0DF1De5888b37B90A6faF75cB` | ⚠️ | Same unknown EOA as MoonDAOTeam. Can call `setTreasury()`, `setOpenAccess()` |
| **MissionCreator** | `0x7256E1d86C1A6fd9b3b91cB1bF74aC2a7562B593` | `0x5Eb5c1e6482F354CaF8C80d43dc8De18ff30aa11` | 🔴 | Unknown EOA. Controls `setMoonDAOTreasury()`, `setMissionData()`, `setFeeHookAddress()` — directly routes Juicebox funds |
| CitizenTable / CitizenRowController | `0x0Eb1dF01b34cEDAFB3148f07D013793b557470d1` | Not verified | ⚠️ | Controls Tableland metadata writes |
| MissionTable | `0x1B50781A23e32d70Be36116aAe9a21C8B4706E22` | Not verified | ⚠️ | Controls Tableland metadata writes |

---

### Fee Hook — Ethereum / Arbitrum / Base

| Contract | Chain | Address | Owner (On-Chain) | Status | Notes |
|---|---|---|---|---|---|
| **FeeHook** | Arbitrum | `0x6D9C97c94c88a67d1A93BBC8ccAe3a5322208844` | `0x5Eb5c1e6482F354CaF8C80d43dc8De18ff30aa11` | 🔴 | Same unknown EOA as MissionCreator. Holds ETH from swap fees, controls LP positions and fee distribution |
| **FeeHook** | Ethereum | `0x1b9f3544dC4915E0C08882d1C3F39B6E464E4844` | `0x5Eb5c1e6482F354CaF8C80d43dc8De18ff30aa11` | 🔴 | Same unknown EOA |
| **FeeHook** | Base | `0x3F74A92F6D68a0638802d32D40a1Cb63C49b0844` | `0x5Eb5c1e6482F354CaF8C80d43dc8De18ff30aa11` | 🔴 | Same unknown EOA |

---

### Governance / Token Contracts — Ethereum

| Contract | Address | Owner / Admin (On-Chain) | Status | Notes |
|---|---|---|---|---|
| **MOONEY Token** | `0x20d4DB1946859E2Adb0e5ACC2eac58047aD41395` | `0xee2eBCcB7CDb34a8A822b589F9E8427C24351bfc` | ⚠️ | Unknown address — not in repo, not HSM, not DAO Safe |
| **vMOONEY** (admin) | `0xCc71C80d803381FD6Ee984FAff408f8501DB1740` | `0x4C66D1beA9647C7C7D73f3CDd20C700aE85cd3ef` | ⚠️ | Address appears in `whitelist.ts` but identity unknown — verify |
| vMOONEY (admin) | `0xB255c74F8576f18357cE6184DA033c6d93C71899` | `0xAF26a002d716508b7e375f1f620338442F5470c0` | ✅ | DAO Safe — confirmed |
| SmartWalletWhitelist | Not in deployments | operator: `0x5DA2a965FDd9f20B1b9bd2bA033fCb1f50E75e18` | ⚠️ | Controls which wallets can lock MOONEY in vMOONEY — verify identity |

---

## Unknown Addresses — Needs Identification

These addresses appeared as owners on-chain and are **not** the HSM, not the DAO Safe, and not documented anywhere in the repo. Ownership needs to be identified and transferred.

### `0x5Eb5c1e6482F354CaF8C80d43dc8De18ff30aa11`
- **Owns:** MissionCreator (Arbitrum), FeeHook (Arbitrum), FeeHook (Ethereum), FeeHook (Base)
- **Risk:** 🔴 CRITICAL — controls ETH fee distribution, LP positions, and Juicebox fund routing across 3 chains
- **Action:** Identify who controls this wallet. Transfer ownership to DAO Safe immediately.

### `0x29B0D7d7f0C88Ce0DF1De5888b37B90A6faF75cB`
- **Owns:** MoonDAOTeam (Arbitrum), MoonDAOCitizen (Arbitrum)
- **Risk:** ⚠️ MEDIUM — can change treasury address and subscription pricing on both NFT contracts
- **Action:** Identify who controls this wallet. Transfer ownership to DAO Safe.

### `0xee2eBCcB7CDb34a8A822b589F9E8427C24351bfc`
- **Owns:** MOONEY Token (Ethereum)
- **Risk:** ⚠️ MEDIUM-HIGH — core token contract
- **Action:** Identify who controls this wallet. Verify what admin powers remain on the token contract.

### `0x4C66D1beA9647C7C7D73f3CDd20C700aE85cd3ef`
- **Owns:** vMOONEY admin (Ethereum)
- **Risk:** ⚠️ MEDIUM — controls vMOONEY vote-locking on Ethereum mainnet
- **Note:** Address appears in `ui/const/tts/whitelist.ts` — may be a known multisig or Safe. Verify.
- **Action:** Confirm identity. If not DAO Safe, coordinate transfer.

---

## HSM Usage Assessment

> The HSM wallet (`0xb206325e6562517532686dfeeead4c104d9f5d32`) does **not** own any contract with money-handling functions. No immediate HSM-related emergency.

| Contract | HSM Role | Appropriate? |
|---|---|---|
| XPOracle | `authorizedSigner` — signs off-chain XP proofs | ✅ Yes — no funds involved |
| MoonDAOTeamCreator | `authorizedSigner` — automates `createMoonDAOTeamFor()` | ✅ Yes — no direct fund movement |
| CitizenReferralsStaged | `authorizedSigner` — signs referral proofs | ✅ Yes — no funds involved |

---

## Priority Action Items

### 🔴 High Priority
1. **Identify `0x5Eb5c1e6482F354CaF8C80d43dc8De18ff30aa11`** — this EOA owns MissionCreator and FeeHook on all 3 chains. If it's a team member's personal wallet, coordinate `transferOwnership()` to the DAO Safe immediately.

2. **Transfer FeeHook ownership to DAO Safe** — FeeHook holds live ETH from swap fees and controls LP positions. This should be owned by the DAO Safe, not any individual.

3. **Transfer MissionCreator ownership to DAO Safe** — controls Juicebox treasury routing and fund hook addresses.

### ⚠️ Medium Priority
4. **Identify `0x29B0D7d7f0C88Ce0DF1De5888b37B90A6faF75cB`** — owns MoonDAOTeam and MoonDAOCitizen. Transfer to DAO Safe.

5. **Identify `0xee2eBCcB7CDb34a8A822b589F9E8427C24351bfc`** — owns MOONEY Token on Ethereum.

6. **Confirm `0x4C66D1beA9647C7C7D73f3CDd20C700aE85cd3ef`** — vMOONEY admin on Ethereum. Appears in whitelist — may already be a known Safe.

7. **Verify CitizenTable, MissionTable, HasCreatedATeam** owners — not yet queried.

### 📋 Process Improvements
8. Update all deploy scripts to always call `transferOwnership(DAO_SAFE_ADDRESS)` at the end.
9. Add a post-deploy checklist to the repo enforcing ownership transfer as a required step.
10. Document rule: any contract with a money function (`transfer`, `withdraw`, `setTreasury`, `returnTokens`, `distributeFees`) must be owned by the DAO Safe — never an EOA or the HSM.
