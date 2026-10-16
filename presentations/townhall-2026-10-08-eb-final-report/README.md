# Executive Branch Final Report (MDP-249) — Town Hall, 8 October 2026

A 10-minute deck summarising the Q2 2026 – Q3 2026 Executive Branch final report
(`docs/reports/eb-mdp-249/`). Every figure and chart comes from that report and its
`data/metrics.json`; numbers are measured as of 7 October 2026.

**Files:**
- [`dist/EB_Final_Report_Q2_Q3_2026_Townhall.pptx`](dist/EB_Final_Report_Q2_Q3_2026_Townhall.pptx) — editable, with speaker notes
- [`dist/EB_Final_Report_Q2_Q3_2026_Townhall.pdf`](dist/EB_Final_Report_Q2_Q3_2026_Townhall.pdf)

## Running order (about 10 minutes)

| # | Slide | Time |
| -: | :- | -: |
| 1 | Title | 0:20 |
| 2 | What we committed to | 0:40 |
| 3 | The term in six numbers | 0:50 |
| 4 | DePrize is live on Arbitrum | 1:00 |
| 5 | Moon Base Zero (optional live demo) | 0:50 |
| 6 | Overview Flight path vote and fundraising | 0:50 |
| 7 | Network growth | 0:50 |
| 8 | Utilization | 0:40 |
| 9 | Discovery calls and the two enhancements | 0:50 |
| 10 | Operations and governance | 0:50 |
| 11 | Budget and treasury | 0:50 |
| 12 | Provisional grades and bonus | 0:40 |
| 13 | Learnings, next term, questions | 0:40 |

The speaker notes hold a script for each slide, with its time.

## Rebuilding

The deck reuses the design system from `presentations/rio-innovation-week-2026/build/deckutil.py`.

```bash
pip install python-pptx==1.0.2 Pillow
python3 build/generate_deck.py
cd dist && soffice --headless --convert-to pdf EB_Final_Report_Q2_Q3_2026_Townhall.pptx
```

If the report's charts change, rerun `docs/reports/eb-mdp-249/scripts/build_charts.py` first.
