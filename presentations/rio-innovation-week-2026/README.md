# MoonDAO — Rio Innovation Week / 2nd Space Industry Workshop Brazil

Presentation deck for the **"Deep Space and the Lunar Economy"** panel (GRU, MoonDAO,
UNOOSA), moderated by Dr. Paolo Gessini for the Brazilian Space Agency (AEB). Built for
Pablo Moncada-Larrotiz's ~8-minute opening remarks slot.

**Final files:**
- [`dist/MoonDAO_Rio_Innovation_Week.pptx`](dist/MoonDAO_Rio_Innovation_Week.pptx)
- [`dist/MoonDAO_Rio_Innovation_Week.pdf`](dist/MoonDAO_Rio_Innovation_Week.pdf)

## What's in the deck (13 slides)

1. Title — real launch photo of Coby Cotton (MoonDAO's first astronaut) on the right panel
2. About the speaker — Pablo Moncada-Larrotiz
3. What is MoonDAO (mission + headline stats)
4. Our story — milestones timeline, 2021–2025
5. Core initiatives
6. Section divider — "Go to Space with Frank White"
7. Who is Frank White — real photo of Frank + real "The Overview Effect" book cover
8. Fly to Space with Frank White — funding progress, top-3 leaderboard, and **one QR code**
   covering both actions (`moondao.com/overview-vote`)
9. DePrize — the prediction-market mechanism (3-step) plus a worked math example of an
   actual bet, as its own dedicated slide
10. Technical deep dive — surviving the 354-hour lunar night (physics, thermal extremes,
    and the battery-mass math that rules out solar/batteries alone)
11. Moonbase Zero — two **real screenshots captured live from the running app**
    (`/moonbase`), not a mockup or illustration
12. Why this matters for emerging space nations — includes the real Space Acceleration
    Network graphic
13. Contact / call to action + **QR code** to join MoonDAO (`moondao.com/join`)

Speaker notes with suggested per-slide timing (targeting ~8 minutes total) are embedded
in the PPTX — open the Notes pane in PowerPoint/Keynote/Google Slides to see them.

## QR codes

Three QR codes are generated and verified (decoded back with OpenCV to confirm they
encode the intended URL) by `build/generate_deck.py`'s companion assets in `assets/qr/`:

| File | Links to | Used on |
|---|---|---|
| `qr_leaderboard.png` | `moondao.com/overview-vote` | Slide 8 |
| `qr_join_moondao.png` | `moondao.com/join` | Slide 13 |

(`qr_support_frank.png` is still generated for `moondao.com/mission/4` but isn't placed
on a slide now that slides 8–9 have been combined into a single QR.)

Each QR has the MoonDAO icon composited into its center (generated at error-correction
level H specifically so a small centered logo doesn't break scanning) and is re-verified
by decoding it back with OpenCV after the logo is added. Rerun the check with:

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

Slide 8's candidate leaderboard and photos were pulled live from
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

Slide 9 (DePrize) and slide 10 (surviving the lunar night) are pulled directly from the
real, implemented `/moonbase` feature in `ui/` (`ui/pages/moonbase/`,
`ui/lib/lunar-atlas/`, `ui/lib/lunar-atlas/seed/atlas.dataset.json`) plus outside
research — the capability-race list, competitor names/odds, and the fission-surface-power
criteria (40 kWe, 354-hour night) come from that dataset; the physics/thermal figures on
slide 10 (tidal-locking mechanics, ±°C extremes, battery-mass math) are sourced from NASA
references (see the citation line on that slide) and worked out independently for the
deck.

Slide 11 (Moonbase Zero) uses two **real screenshots captured live from a running
instance of the app** — `ui/pages/moonbase/index.tsx` was started locally
(`yarn dev` in `ui/`, with placeholder `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` /
`NEXT_PUBLIC_PRIVY_APP_ID` env vars so the client-side SDKs initialize without real
secrets), opened in a real browser window on the VM's display, and captured with
`import` (ImageMagick) after interacting with the page (clicking into a capability race
to open its detail panel). The raw captures and the crop/processing steps live in
`assets/moonbase_real/` — nothing on that slide is a mockup or AI render.

## Images

Photos/graphics come from three places, all real (no stock imagery, nothing invented):

1. **MoonDAO's own repo** (`ui/public/`) and MoonDAO's public citizen NFT profile images
   (IPFS) — team/astronaut photos, the logo, the leaderboard avatars.
2. **Live captures of the running app** — the two Moonbase Zero screenshots on slide 11
   (see above), saved in `assets/moonbase_real/`.
3. **The reference deck the user supplied** (`MoonDAO 101 PPT_design_improvements.pptx`)
   — several of its embedded graphics were extracted and reused directly, saved in
   `assets/reference/`: Coby Cotton's real Blue Origin NS-22 launch photo (slide 1), a
   real photo of Frank White with an Earth graphic (slide 7, cropped from the "Send Frank
   to Space" campaign graphic), the real "The Overview Effect" book cover (slide 7), a
   fresh Earth-sunrise photo (slide 6 background), and MoonDAO's official Space
   Acceleration Network diagram (slide 12).

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
