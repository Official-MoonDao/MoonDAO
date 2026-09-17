# Navigation Simplification Plan

**Status:** Proposal, awaiting review
**Scope:** `ui/` — primary navigation, footer, global search
**Author:** Drafted from a static audit of the navigation code, September 2026

---

## Summary

The app's primary navigation presents **9 top-level groups and 41 links**. Eight destinations are reachable from two or more places under different names, three of the nine top-level slots are taken by time-bound campaigns, and every item that has a dropdown requires a double-click to actually visit its page.

This proposal reduces the bar to **5 top-level groups and 26 links**, moves per-user items into an account menu behind the avatar, and consolidates the three hand-maintained copies of the navigation structure into one config file.

The work is sequenced into five steps. The first two change no visible structure and can ship immediately; the two that change the information architecture ship together once the plumbing is in place.

---

## Where the navigation lives today

| Concern | File |
| --- | --- |
| Source of truth for nav items | `ui/lib/navigation/useNavigation.tsx` |
| Desktop bar (renders at `xl:` and up) | `ui/components/layout/TopNavBar.tsx` |
| Mobile drawer (below `xl:`) | `ui/components/layout/Sidebar/MobileSidebar.tsx` |
| Per-user Teams dropdown | `ui/components/layout/Sidebar/TeamsNavDropdown.tsx` |
| Per-user Projects dropdown | `ui/components/layout/Sidebar/ProjectsNavDropdown.tsx` |
| Footer link columns (hardcoded copy) | `ui/components/layout/ExpandedFooter.tsx` |
| Search index (hardcoded copy, 33 entries) | `ui/components/layout/GlobalSearch.tsx` |

---

## Findings

### 1. The bar has outgrown its own layout

`TopNavBar.tsx` carries comments recording that the nav row "overflowed its own box at every window size, including a 2560px one," that the spill "landed on the logo and the wallet," and that eight icons "cost 192px" and were hidden below a custom `navicons` breakpoint to reclaim the space.

These were treated as CSS bugs and fixed with CSS. They are symptoms of item count. Any future addition re-opens them.

### 2. Campaigns outrank the product

Moon Base Zero, DePrize, and Send Frank to Space each occupy a top-level slot — a third of the bar — at the same visual weight as Citizens, Teams, and Projects. Time-bound campaigns are competing for attention with the evergreen destinations that define what the product is.

### 3. Six landing pages are effectively unreachable

Any nav item with a dropdown renders as a `<button>`, not a link. Its tooltip reads, verbatim:

> Single click: open menu. Double click: go to page.

Users do not double-click navigation items. The landing pages behind Citizens, Teams, Projects, `$MOONEY`, Send Frank to Space, and Learn are reachable in practice only through a child link that happens to duplicate the parent.

### 4. Eight destinations have more than one front door

| Destination | Currently linked as | Entry points |
| --- | --- | --- |
| `/contributions` | "Submit a Contribution" (Citizens), "Submit Contribution" (Projects), plus both footer columns | 4 |
| `/network?tab=teams` | "Teams" top-level, "Explore Teams", footer "Explore Teams" | 3 |
| `/projects` | "Projects" top-level, "Explore Projects", footer "Explore Projects" | 3 |
| `/mooney` | "$MOONEY" top-level, "Token Overview", footer "Token Overview" | 3 |
| `/launch` | "Send Frank to Space" top-level, "Launchpad Explainer", footer | 3 |
| `/network?tab=citizens` | "Citizens" top-level (`/network`), "View Citizens", footer | 3 |
| `/docs` | Learn → Documentation, footer column, footer utility row | 3 |
| `/team` vs `/join` | "Create a Team" points at `/team` in the nav and `/join` in the footer | 2 |

Deduplicating these is where most of the link reduction comes from. It removes 15 links without removing a single destination.

### 5. Dropdowns mix three unrelated jobs

The Teams and Projects menus interleave public browsing ("Explore Teams"), creation actions ("Create a Team"), and per-user state ("Your Teams", "Your Projects & Proposals"). A user scanning for one of the three has to read past the other two.

The per-user entries also carry a performance cost: opening the menu triggers `useTeamWearer` / `useProjectWearer`, which run an on-chain role-hat index scan. The code already works around this by mounting the dropdowns only while open and caching results for five minutes.

### 6. The information architecture exists in three hand-maintained copies

`useNavigation.tsx`, `ExpandedFooter.tsx`, and `GlobalSearch.tsx` each hardcode their own list. `ExpandedFooter` even documents the intent — "Footer navigation mirrors the top nav structure 1:1" — but they have already drifted:

- "Create a Team" goes to `/team` in the nav and `/join` in the footer.
- The footer has no Moon Base Zero or DePrize columns at all.
- The footer's Launchpad column omits "Path Forward Vote", which the nav includes.

Any change to the navigation currently requires three coordinated edits, and nothing enforces that they stay in sync.

---

## Proposed structure

### Primary navigation — 5 groups

**Network** → `/network`
Citizens · Teams · Map · Jobs · Marketplace

**Projects** → `/projects`
Explore Projects · Propose a Project · Submit a Contribution · How the project system works

**$MOONEY** → `/mooney`
Get $MOONEY · Lock & vote · Bridge · Governance

**Missions** → `/launch`
Send Frank to Space · Moon Base Zero · DePrize

**Learn** → `/info`
Documentation · News & Updates · Town Hall · Roadmap · Constitution

### Account menu — behind the avatar, next to the wallet

Your Profile · Your Teams · Your Projects & Proposals · Create a Team · Submit a Contribution

Signed-out visitors see a single primary **Join** button in that slot instead of the current "Join" nav item.

### What changed and why

**Citizens and Teams merge into Network.** Both already point into `/network` under different tabs. They were two doors onto one page.

**The three campaigns become Missions.** They keep their own pages and their own prominence inside the group, but they stop consuming a third of the top-level bar. As campaigns start and end, they are added and removed from one group rather than from the global structure.

**Per-user items leave the public menus.** "Your Teams" and "Your Projects" belong next to the user's identity, not in a menu a logged-out visitor also sees. This also takes the on-chain hat scans out of the public dropdowns.

**Every duplicate child is removed.** Each destination gets exactly one canonical entry point with one canonical name.

**Deep reference material moves to search and the footer.** Press, Resources, Proposal Template, and Projects Overview stay fully reachable — through the footer, through in-page links, and through global search — but stop occupying top-bar real estate.

---

## Sequencing

Each step is independently shippable. Steps 1 and 2 change no visible structure.

### Step 1 — Single source of truth *(no visible change)*

Extract `ui/lib/navigation/nav-config.ts` describing every group, its children, and which surfaces each entry appears on. `useNavigation`, `ExpandedFooter`, and `GlobalSearch` all derive from it.

This removes the existing drift and makes every later step a one-file edit. Doing it first means steps 3 and 4 are config changes rather than three-file refactors.

### Step 2 — Make parent items behave like links *(no visible change)*

Replace the double-click affordance with a normal link plus a separate chevron control that opens the menu. Hover-to-open behavior stays as it is. The tooltip instructions go away.

### Step 3 — Collapse 9 groups into 5 *(visible change)*

Merge Citizens and Teams into Network, fold the three campaigns into Missions, and drop every duplicate child. Once the count is down, the `navicons` breakpoint hack in `TopNavBar` can be removed and the icons restored at full size.

### Step 4 — Move per-user items into the account menu *(visible change)*

Your Profile, Your Teams, and Your Projects move behind the avatar. `TeamsNavDropdown` and `ProjectsNavDropdown` shed their public-browsing links and become purely personal lists.

Ship steps 3 and 4 together — step 4 removes items that step 3's grouping assumes are already gone.

### Step 5 — Promote search and prune the tail *(follow-up)*

`GlobalSearch` already indexes 33 destinations, including several the nav never exposes: Treasury, Quests, FAQ, Final Reports, Project System Docs. It currently sits behind a small unlabeled icon in the top-right corner.

Give it a visible affordance with a keyboard shortcut. That is what makes it safe to keep the long tail out of the bar.

---

## Risks and mitigations

**People have muscle memory for the current items.** No URLs change in this plan — only the labels and grouping that lead to them. Nothing needs a redirect.

**"Where did DePrize go?"** The three campaigns are one click deeper than before. If any of them is in an active push where that click matters, it can be surfaced temporarily via the existing `MissionBanner` / `ProjectBanner` components rather than by re-adding a top-level slot.

**Removing items without traffic data.** This audit is structural — no analytics were available. Before step 3 ships, it is worth confirming against real traffic that the demoted pages (Press, Resources, Proposal Template, Projects Overview) are in fact low-traffic. If any is not, it moves back up.

---

## Open questions

1. Should the signed-in landing page stay at `/` as it is now, or move to the `/dashboard` page that already exists?
2. Do Jobs and Marketplace belong under Network, or should they form their own group if either is a growth priority?
3. Is there analytics access that could validate the demotions in step 3 before they ship?
