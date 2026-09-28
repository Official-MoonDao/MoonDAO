# NewCo — Pre-seed deck

Investor deck for the for-profit spin-out described in
[`docs/MOONDAO_LABS_VENTURE_CASE.md`](../../docs/MOONDAO_LABS_VENTURE_CASE.md).
**Part VII of that document is the plan of record and this deck matches it.** "NewCo" is a
placeholder name.

**Output:**
- [`dist/NewCo_Seed_Deck.pdf`](dist/NewCo_Seed_Deck.pdf) — 18 pages, landscape 16:9
- [`dist/NewCo_Seed_Deck_Phone.pdf`](dist/NewCo_Seed_Deck_Phone.pdf) — 18 pages, portrait letter, for reading on a phone

Sources of truth are the two HTML files in `build/`. Rebuild either PDF with Chrome:

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=20000 \
  --print-to-pdf="$PWD/dist/NewCo_Seed_Deck.pdf" "file://$PWD/build/deck.html"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=20000 \
  --print-to-pdf="$PWD/dist/NewCo_Seed_Deck_Phone.pdf" "file://$PWD/build/deck-phone.html"
```

> **`build/generate_deck.py` is stale.** It generates the earlier formation-led PPTX ("constitution
> layer," Form/Fund/Operate/Settle, 16 slides) and has not been ported to the mission model. The
> PPTX it produced was deleted from `dist/` so there is no artifact contradicting the current deck.
> Port it only if someone needs speaker notes in PowerPoint; otherwise the HTML is the deck.

## The argument

The spine is a trend claim, not a product tour: agents are getting faster at execution, human
approval capacity is flat, so companies will have to move the human from approving each action to
setting goals and funding missions. The unit of sale is a **mission** — a goal, a budget,
limits, write-protected telemetry, and an abort. The worst case is what you funded, and you know
it before anything starts, which is what makes per-action approval unnecessary.

| # | Slide | The one idea |
|---|---|---|
| 1 | Title | Set a goal. Fund the mission. Let the agents run. |
| 2 | Where this goes | Agents are getting faster; human approval capacity is flat |
| 3 | Problem | Agents already spend real money and nobody can bound it (Amazon, Uber, tokenmaxxing) |
| 4 | The trap | "Give agents a target and let them optimize" is what broke Hugging Face — and what stopped them was where the record lived |
| 5 | Solution | The mission: goal, budget, limits, roster, telemetry, abort — funded ceiling, money moved once |
| 6 | Product | Set, Fund, Run, Prove — all four already run with a human in every step; the round builds the programmatic version |
| 7 | What it looks like | 200 qualified meetings in 90 days at no more than $450 each |
| 8 | Why on-chain | Four properties a database lacks; no token, no custody |
| 9 | Proof of operation | The loop runs in production with the contracts named (`MoonDAOTeamCreator`, `LaunchPadPayHook`, `ReopenPayHook`, Safe+Hats, `XPOracle`) — and exactly one thing changes when the worker is a machine |
| 10 | Market | Every company where agents already spend money or take irreversible action |
| 11 | Business model | Per mission, growing with the budget |
| 12 | Competition | Six layers, six funded owners (Okta, Sapiom, Olas, Revenium/av9n, Within); we are late to four and claim the principal's side |
| 13 | Category | The agent economy built judges and every measured one is failing — Olas, x402, Bittensor, on-chain reputation |
| 14 | Go-to-market | One funded mission, one measurable goal, ninety days — plus the goals we refuse |
| 15 | Team | One operator with four years on the problem; founding team under construction, technical co-founder as the gating hire |
| 16 | The ask | $5M seed over 24 months for nine people; use of funds built from the milestones |
| 17 | Closing | Three numbers reported every quarter; we do not sell autonomy |
| 18 | Appendix | What would make us wrong, and what we do about it |

## Deck-craft sources

Sequoia's "Writing a Business Plan" template; YC (Kevin Hale, Michael Seibel, Geoff Ralston);
Kawasaki's 10/20/30 rule; DocSend's seed-deck attention studies; and the published early decks of
Airbnb, Uber, LinkedIn (Series B, with Reid Hoffman's annotations), Coinbase and YouTube.

What that research changed here: every headline is a full declarative sentence that carries the idea
without a speaker, because investors read the deck before they hear it; body text stays at 11pt or
larger; the demo is seven numbered steps rather than a diagram; competition names everyone,
including the incumbents who beat us to adjacent layers; and slide 4 states the strongest objection
to our own architecture before an investor can raise it, which is the Hoffman move.

## Before sending

- **Slide 9 names five deployed contracts.** An investor can and will read them on Arbiscan, so
  confirm the addresses in the deploy scripts are the live ones and that `ReopenPayHook` is deployed
  rather than only scripted before claiming it in the present tense. The component-by-component map
  and honest status of each is in §VIII.8 of the venture case.
- **Verify the loop claim on slide 9.** Pull ten real project proposals with their outcome reports
  and check whether the goals were genuinely measurable and whether the retro rewards tracked the
  outcomes. If they did, publish three redacted examples — no competitor can produce that artifact.
  If most goals were qualitative deliverables, narrow the claim to what the loop taught you rather
  than what it measured. The proposals are public, so an investor can check this themselves. This is
  the one open item that changes how strongly the slide can be written.
- Decide the company name and replace `NEWCO` throughout `build/deck.html` and `build/deck-phone.html`.
- Confirm slide 9's figures against the current financial disclosure and the press kit.
- Re-verify the third-party facts on slides 3, 4 and 12 against primary sources before an investor
  sees them; they are load-bearing and all are from 2026. The Amazon figures come from reported
  internal documents rather than a company statement, which is worth knowing before citing them.
- **Slide 12 and 13 competitor and evidence claims.** Sapiom, Revenium, Circle, Within, Wonderful,
  Olas and Virtuals/ERC-8183 are well sourced, as are the arXiv findings on slide 13 (x402
  2607.12575, Bittensor 2507.02951, ERC-8004 reputation 2606.26028) and the METR/Redwood quote on
  slide 4. Contro1, botanu, Nexus, ELI and av9n come from vendor marketing — confirm they are real
  at the scale implied before naming them. The Olas APR/ROI figures are Olas's own Q1 2026
  reporting. See §3.5 and **Part VIII** of the venture case for the full landscape and sourcing.
- **The baseline claim is now split on purpose** (Part VIII.5). The verified claim is that the
  outcome occurred, read from a system of record the agent cannot write to. The baseline it is
  compared against is a *declared, jointly signed construct* — never present it as measured.
  Counterfactual savings cannot be adversarially verified and the deck must not imply otherwise.
- Add a contact line and data-room link to slide 16.
- No valuation anywhere in the deck. At $5M, dilution against a $20–25M post is 20–25%, so the
  valuation conversation matters as much as the amount; see Part VII.19 of the venture case.
- If a live mission demo exists, it replaces slide 7.
