# DePrize — Terms & Conditions (superseded)

This internal draft has been superseded by the published DePrize legal documents in
`ui/content/docs/Legal/DePrize/`, which render at `/docs/Legal/DePrize/...` and are
linked from the bet flow via the constants in `ui/lib/deprize/constants.ts`:

| Document | Source | URL constant |
|---|---|---|
| DePrize Terms and Conditions | `DePrize Terms and Conditions.md` | `DEPRIZE_TERMS_URL` |
| DePrize Official Prize Rules | `DePrize Official Prize Rules.md` | `DEPRIZE_PRIZE_RULES_URL` |
| DePrize Privacy Notice | `DePrize Privacy Notice.md` | `DEPRIZE_PRIVACY_URL` |
| DePrize Risk Disclosures and Disclaimers | `DePrize Risk Disclosures and Disclaimers.md` | `DEPRIZE_RISK_DISCLOSURES_URL` |

Edit the published documents, not this file. Bump `DEPRIZE_TERMS_VERSION` and the version
table in the Terms whenever the Terms change materially, then run `yarn docs:generate` so the
committed nav tree and search index stay in sync.
