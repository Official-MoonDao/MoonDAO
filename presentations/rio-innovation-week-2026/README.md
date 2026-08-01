# MoonDAO — Rio Innovation Week / 2nd Space Industry Workshop Brazil

Presentation deck for the **"Deep Space and the Lunar Economy"** panel (GRU, MoonDAO,
UNOOSA), moderated by Dr. Paolo Gessini for the Brazilian Space Agency (AEB). Built for
Pablo Moncada-Larrotiz's ~8-minute opening remarks slot.

**Final files:**
- [`dist/MoonDAO_Rio_Innovation_Week.pptx`](dist/MoonDAO_Rio_Innovation_Week.pptx)
- [`dist/MoonDAO_Rio_Innovation_Week.pdf`](dist/MoonDAO_Rio_Innovation_Week.pdf)

## What's in the deck (13 slides)

1. Title
2. About the speaker — Pablo Moncada-Larrotiz
3. What is MoonDAO (mission + headline stats)
4. Our story — milestones timeline, 2021–2025
5. Core initiatives
6. Section divider — "Go to Space with Frank White"
7. Who is Frank White
8. Fly to Space with Frank White — funding progress + **QR code** to contribute (`moondao.com/mission/4`)
9. Fly with Frank — **live leaderboard** (real top candidates, photos, $OVERVIEW totals) + **QR code** to back a candidate (`moondao.com/overview-vote`)
10. DePrize — the prediction-market mechanism, illustrated with a real capability race (fission surface power, 354-hour lunar night)
11. Moonbase Zero — a full-bleed visualization of the real `/moonbase` capability-race board
12. Why this matters for emerging space nations
13. Contact / call to action + **QR code** to join MoonDAO (`moondao.com/join`)

Speaker notes with suggested per-slide timing (targeting ~8 minutes total) are embedded
in the PPTX — open the Notes pane in PowerPoint/Keynote/Google Slides to see them.

## QR codes

Three QR codes are generated and verified (decoded back with OpenCV to confirm they
encode the intended URL) by `build/generate_deck.py`'s companion assets in `assets/qr/`:

| File | Links to | Used on |
|---|---|---|
| `qr_support_frank.png` | `moondao.com/mission/4` | Slide 8 |
| `qr_leaderboard.png` | `moondao.com/overview-vote` | Slide 9 |
| `qr_join_moondao.png` | `moondao.com/join` | Slide 13 |

All three target URLs were checked live (HTTP 200) before generating the codes. Rerun
the check with:

```bash
python3 -c "
import cv2
for f, url in [
    ('assets/qr/qr_support_frank.png', 'https://www.moondao.com/mission/4'),
    ('assets/qr/qr_leaderboard.png', 'https://www.moondao.com/overview-vote'),
    ('assets/qr/qr_join_moondao.png', 'https://www.moondao.com/join'),
]:
    data, _, _ = cv2.QRCodeDetector().detectAndDecode(cv2.imread(f))
    print(f, '->', data, 'OK' if data == url else 'MISMATCH')
"
```

## Leaderboard data

Slide 9's "Fly with Frank" leaderboard and candidate photos were pulled live from
`moondao.com/overview-vote`'s `$OVERVIEW` delegation leaderboard (same data source as
`ui/pages/overview-vote.tsx` / `ui/lib/overview-delegate/fetchLeaderboard.ts`) at build
time. Since this leaderboard changes as people back candidates, re-pull it before
reusing this deck for a later event — see `assets/leaderboard/` for the cached photos.

## Content sourcing

All facts, figures, and quotes (mission statement, fundraising numbers, timeline
milestones, DePrize mechanics, Frank White bio, Pablo's bio) were pulled from the
MoonDAO codebase (`ui/`, `docs/DEPRIZE.md`, `.cursor/plans/`) and MoonDAO's own public
sites (`moondao.com`, `docs.moondao.com`) — not invented. Where a figure is
approximate/time-sensitive, the deck uses "~" or "≈" to match the source docs' own
hedging.

Slides 10–11 (DePrize / Moonbase Zero) are pulled directly from the real, implemented
`/moonbase` feature in `ui/` (`ui/pages/moonbase/`, `ui/lib/lunar-atlas/`,
`ui/lib/lunar-atlas/seed/atlas.dataset.json`) — the capability-race list, competitor
names/odds, the fission-surface-power criteria, and the underlying NASA sourcing are
all read from that dataset. Rendering the actual live page for a literal screenshot
would require real `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` / `NEXT_PUBLIC_PRIVY_APP_ID`
secrets this environment doesn't have (confirmed by running `yarn install` + `next dev`
locally); slide 11 instead uses a generated illustrative 3D moonbase render as the
background, with the real capability-race data overlaid in a HUD card styled after the
in-app legend.

## Images

Most photos/graphics are pulled from MoonDAO's own repo (`ui/public/`) or MoonDAO's
public citizen NFT profile images (IPFS) — no third-party/stock imagery. See `assets/`
for the source files used. The one exception is `assets/moonbase_zero_render.png`
(slide 11's background), which is an AI-generated illustrative lunar-base render used
as a stand-in since the real `/moonbase` 3D scene couldn't be rendered in this
environment (see above) — the data overlaid on top of it is real.

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
