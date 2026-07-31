# MoonDAO — Rio Innovation Week / 2nd Space Industry Workshop Brazil

Presentation deck for the **"Deep Space and the Lunar Economy"** panel (GRU, MoonDAO,
UNOOSA), moderated by Dr. Paolo Gessini for the Brazilian Space Agency (AEB). Built for
Pablo Moncada-Larrotiz's ~8-minute opening remarks slot.

**Final files:**
- [`dist/MoonDAO_Rio_Innovation_Week.pptx`](dist/MoonDAO_Rio_Innovation_Week.pptx)
- [`dist/MoonDAO_Rio_Innovation_Week.pdf`](dist/MoonDAO_Rio_Innovation_Week.pdf)

## What's in the deck (12 slides)

1. Title
2. About the speaker — Pablo Moncada-Larrotiz
3. What is MoonDAO (mission + headline stats)
4. Our story — milestones timeline, 2021–2025
5. Core initiatives
6. Section divider — "Go to Space with Frank White"
7. Who is Frank White
8. Fly to Space with Frank White (funding progress + candidate-selection process)
9. DePrize — the prediction-market funding mechanism
10. Lunar Atlas — mapping (and wagering on) the lunar economy
11. Why this matters for emerging space nations
12. Contact / call to action

Speaker notes with suggested per-slide timing (targeting ~8 minutes total) are embedded
in the PPTX — open the Notes pane in PowerPoint/Keynote/Google Slides to see them.

## Content sourcing

All facts, figures, and quotes (mission statement, fundraising numbers, timeline
milestones, DePrize mechanics, Frank White bio, Pablo's bio) were pulled from the
MoonDAO codebase (`ui/`, `docs/DEPRIZE.md`, `.cursor/plans/`) and MoonDAO's own public
sites (`moondao.com`, `docs.moondao.com`) — not invented. Where a figure is
approximate/time-sensitive (e.g. ETH-denominated goals), the deck uses "~" or "≈" to
match the source docs' own hedging.

## Images

All photos/graphics are pulled from MoonDAO's own repo (`ui/public/`) or MoonDAO's
public citizen NFT profile images (IPFS) — no third-party/stock imagery. See
`assets/` for the source files used.

## Rebuilding the deck

```bash
cd presentations/rio-innovation-week-2026
pip install -r requirements.txt
python3 build/generate_deck.py
# -> dist/MoonDAO_Rio_Innovation_Week.pptx
```

### Editing content

- **Slide content/layout:** edit `build/generate_deck.py` (one `slide_NN()` function per
  slide).
- **Design system** (colors, fonts, header/footer, cards, charts): `build/deckutil.py`.
- **Image preprocessing** (aspect-ratio cropping, circular headshot badges, darkened
  backgrounds): `build/imgutil.py`. Processed images are cached in `build/_cache/`
  (gitignored) — delete that folder to force a clean re-render of all images.

### Visual QA (optional)

Requires LibreOffice + poppler-utils:

```bash
soffice --headless --convert-to pdf --outdir dist/preview dist/MoonDAO_Rio_Innovation_Week.pptx
pdftoppm -png -r 110 dist/preview/MoonDAO_Rio_Innovation_Week.pdf dist/preview/slide
```
