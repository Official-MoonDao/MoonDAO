#!/usr/bin/env python3
"""Builds NewCo_Seed_Deck.pptx — pre-seed investor deck for the MoonDAO spin-out
described in docs/MOONDAO_LABS_VENTURE_CASE.md.

Design constraints (from Sequoia's template, YC's "legible / simple / obvious",
Kawasaki's 10/20/30, and DocSend's seed-deck attention data):
  - one idea per slide, a declarative headline that carries the idea
  - "why now" immediately after purpose; product and business model early
  - honest competition slide; the strongest objection answered on its own slide
  - traction stated as proof-of-operation with the diligence caveat on the slide
  - explicit ask, use of funds and milestones; nothing below ~14pt

Run:    /path/to/venv/bin/python build/generate_deck.py
Output: dist/NewCo_Seed_Deck.pptx

Reuses the drawing primitives from ../rio-innovation-week-2026/build/deckutil.py.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(os.path.join(HERE, '..', '..', 'rio-innovation-week-2026', 'build')))

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.dml.color import RGBColor

import deckutil as D
from deckutil import (
    SLIDE_W, SLIDE_H, MARGIN, CONTENT_TOP, CONTENT_BOTTOM, CONTENT_W, FONT, FONT_HEAD,
    NAVY_DARK, NAVY, WHITE, BG_LIGHT, BG_PANEL, LINE_GRAY, TEXT_DARK, TEXT_GRAY, TEXT_MUTE,
    set_bg, evenly_spaced,
)


def _emu_args(fn, n=4):
    """Wrap a deckutil drawer so its first n geometry args are integral EMUs.
    Arithmetic on Length values yields floats, which python-pptx writes verbatim
    into the XML and PowerPoint then rejects."""
    def wrapped(slide, *args, **kw):
        args = list(args)
        for i in range(min(n, len(args))):
            args[i] = Emu(int(args[i]))
        return fn(slide, *args, **kw)
    return wrapped


add_rect = _emu_args(D.add_rect)
add_line = _emu_args(D.add_line)
add_text = _emu_args(D.add_text)
add_bullets = _emu_args(D.add_bullets)
card = _emu_args(D.card)
accent_bar = _emu_args(D.accent_bar, 3)
accent_rail = _emu_args(D.accent_rail, 3)

# NewCo accent: deliberately not MoonDAO orange. Teal reads "infrastructure".
ACCENT = RGBColor(0x0E, 0x9F, 0x8E)
ACCENT_LT = RGBColor(0xD8, 0xF1, 0xEE)
MUTED_RED = RGBColor(0xA3, 0x2E, 0x35)

DIST = os.path.normpath(os.path.join(HERE, '..', 'dist'))
os.makedirs(DIST, exist_ok=True)

COMPANY = "NEWCO"          # placeholder wordmark; name is an open decision
TOTAL = 16

prs = Presentation()
prs.slide_width = SLIDE_W
prs.slide_height = SLIDE_H
BLANK = prs.slide_layouts[6]


def new_slide():
    return prs.slides.add_slide(BLANK)


def notes(slide, text):
    slide.notes_slide.notes_text_frame.text = text


def wordmark(slide, l, t, color=NAVY_DARK, size=Pt(14)):
    add_rect(slide, l, t + Inches(0.05), Inches(0.16), Inches(0.16), fill=ACCENT,
             shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.3)
    add_text(slide, l + Inches(0.24), t, Inches(1.3), Inches(0.3), COMPANY,
             size=size, color=color, bold=True, font=FONT_HEAD)


def hdr(slide, kicker, title, page_no, title_size=Pt(28)):
    add_rect(slide, 0, 0, SLIDE_W, Inches(0.08), fill=NAVY_DARK)
    add_text(slide, MARGIN, Inches(0.26), Inches(9.6), Inches(0.26), kicker.upper(),
             size=Pt(11), color=ACCENT, bold=True, font=FONT_HEAD)
    add_text(slide, MARGIN, Inches(0.50), Inches(10.6), Inches(0.95), title,
             size=title_size, color=NAVY_DARK, bold=True, font=FONT_HEAD, spacing=1.02,
             anchor=MSO_ANCHOR.TOP)
    wordmark(slide, SLIDE_W - MARGIN - Inches(1.5), Inches(0.30))
    add_line(slide, MARGIN, Inches(1.47), CONTENT_W, 0, color=LINE_GRAY, weight=Pt(0.75))


def ftr(slide, page_no):
    add_line(slide, MARGIN, SLIDE_H - Inches(0.52), CONTENT_W, 0, color=LINE_GRAY, weight=Pt(0.75))
    add_text(slide, MARGIN, SLIDE_H - Inches(0.42), Inches(9.5), Inches(0.28),
             f"{COMPANY.title()}  ·  Pre-seed  ·  September 2026  ·  Confidential",
             size=Pt(9), color=TEXT_MUTE, font=FONT)
    add_text(slide, SLIDE_W - MARGIN - Inches(1.3), SLIDE_H - Inches(0.42), Inches(1.3), Inches(0.28),
             f"{page_no:02d}  /  {TOTAL}", size=Pt(9), color=TEXT_MUTE, font=FONT_HEAD,
             align=PP_ALIGN.RIGHT)


def col_card(slide, l, t, w, h, title, body_items, accent=ACCENT, title_size=Pt(17),
             body_size=Pt(14), kicker=None):
    card(slide, l, t, w, h)
    accent_bar(slide, l, t, w, accent=accent)
    y = t + Inches(0.28)
    if kicker:
        add_text(slide, l + Inches(0.3), y, w - Inches(0.6), Inches(0.25), kicker.upper(),
                 size=Pt(10), color=accent, bold=True, font=FONT_HEAD)
        y += Inches(0.28)
    add_text(slide, l + Inches(0.3), y, w - Inches(0.6), Inches(0.8), title,
             size=title_size, color=NAVY_DARK, bold=True, font=FONT_HEAD, spacing=1.05)
    add_bullets(slide, l + Inches(0.3), y + Inches(0.9), w - Inches(0.6), h - Inches(1.35) - (y - t),
                body_items, size=body_size, bullet_color=accent, gap=Pt(6), spacing=1.15)


def big_statement(slide, l, t, w, h, text, size=Pt(16), color=TEXT_DARK, fill=ACCENT_LT):
    add_rect(slide, l, t, w, h, fill=fill, shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.12)
    add_text(slide, l + Inches(0.35), t, w - Inches(0.7), h, text, size=size, color=color,
             bold=True, font=FONT_HEAD, anchor=MSO_ANCHOR.MIDDLE, spacing=1.1)


# ------------------------------------------------------------------ 01 title --
def slide_01():
    s = new_slide()
    set_bg(s, NAVY_DARK)
    add_rect(s, 0, SLIDE_H - Inches(0.09), SLIDE_W, Inches(0.09), fill=ACCENT)
    wordmark(s, MARGIN, Inches(0.7), color=WHITE, size=Pt(16))
    add_text(s, MARGIN, Inches(2.15), Inches(11.5), Inches(1.9),
             "Form a funded organization of humans and agents in minutes.",
             size=Pt(44), color=WHITE, bold=True, font=FONT_HEAD, spacing=1.05)
    add_text(s, MARGIN, Inches(4.25), Inches(10.5), Inches(0.9),
             "The constitution layer for the agent economy.\nHumans govern. Agents execute. Code enforces.",
             size=Pt(22), color=RGBColor(0xC7, 0xE9, 0xE4), font=FONT, spacing=1.2)
    add_text(s, MARGIN, Inches(6.35), Inches(9), Inches(0.3),
             "Pre-seed  ·  September 2026  ·  Built by the team that has run an on-chain organization since 2022",
             size=Pt(12), color=RGBColor(0x9A, 0xA3, 0xC0), font=FONT)
    add_text(s, SLIDE_W - MARGIN - Inches(3.2), Inches(6.35), Inches(3.2), Inches(0.3),
             "Company name: placeholder", size=Pt(10), color=RGBColor(0x6E, 0x78, 0x99),
             font=FONT, align=PP_ALIGN.RIGHT, italic=True)
    notes(s, "30 seconds. Say the one sentence, then the tagline. Do not say 'DAO' or 'blockchain' "
             "on this slide. The name is a placeholder pending a decision.")


# ---------------------------------------------------------------- 02 why now --
def slide_02():
    s = new_slide()
    set_bg(s, WHITE)
    hdr(s, "Why now", "Three things became true in the last eighteen months.", 2)
    n, gap = 3, Inches(0.3)
    w = evenly_spaced(n, CONTENT_W, gap)
    t = CONTENT_TOP + Inches(0.1)
    h = Inches(4.35)
    cols = [
        ("Agents got wallets.", [
            ("Coinbase Agentic Wallets", " launched Feb 2026 on AgentKit and x402"),
            ("x402", " has cleared 50M+ machine-to-machine payments"),
            ("Visa Intelligent Commerce and Mastercard Agent Pay", " launched 10 June 2026"),
        ]),
        ("Stablecoins became business plumbing.", [
            ("$300B+", " stablecoin supply; U.S. federal law in 2025"),
            ("Stripe", " offers USDC business accounts in 100+ countries; Bridge turns a bank account number into a wallet"),
            ("Circle", " settles its own intercompany payments in USDC"),
        ]),
        ("Nobody built the organization.", [
            ("Coinbase, on its own agent framework:", " it \u201cdoes not gate transfers behind human approval, enforce spend caps, or allowlist destinations.\u201d"),
            ("Every vendor stops at", " \u201ca wallet with limits.\u201d"),
            ("No one sells", " roles, budgets, approvals and commitments across humans and agents."),
        ]),
    ]
    for i, (title, items) in enumerate(cols):
        l = MARGIN + i * (w + gap)
        col_card(s, l, t, w, h, title, items, kicker=f"0{i + 1}")
    big_statement(s, MARGIN, t + h + Inches(0.2), CONTENT_W, Inches(0.6),
                  "Wallets and rails are solved. Authority is not.")
    ftr(s, 2)
    notes(s, "DocSend's seed research: successful decks put 'why now' right after purpose. "
             "The third column is the wedge: quote Coinbase verbatim.")


# ---------------------------------------------------------------- 03 problem --
def slide_03():
    s = new_slide()
    set_bg(s, WHITE)
    hdr(s, "Problem", "Every agent with a wallet is an untrusted operator.\nEvery new organization takes weeks to trust anyone.", 3,
        title_size=Pt(26))
    t = CONTENT_TOP + Inches(0.35)
    h = Inches(3.6)
    gap = Inches(0.3)
    w = evenly_spaced(2, CONTENT_W, gap)
    col_card(s, MARGIN, t, w, h, "Agents", [
        ("Locked agent:", " useless."),
        ("Open agent:", " one paragraph of injected text moves the money."),
        ("Off-chain policy:", " you trust the vendor, and the admin console the agent can reach."),
        ("Five hundred agents", " make every company multi-principal in the security sense."),
    ], accent=MUTED_RED, kicker="Authority")
    col_card(s, MARGIN + w + gap, t, w, h, "Organizations", [
        ("Onboarding a new vendor:", " about three weeks."),
        ("A multisig payout:", " days, across time zones."),
        ("The most on-chain organization we know:", " weeks from vote to payout, quarterly cycles."),
        ("Forming a funded team of strangers across borders:", " months, or never."),
    ], accent=MUTED_RED, kicker="Trust latency")
    big_statement(s, MARGIN, t + h + Inches(0.3), CONTENT_W, Inches(0.7),
                  "The bottleneck is not intelligence. It is authority: who may do what, with whose money, enforced by what.")
    ftr(s, 3)
    notes(s, "Two pains, one root. Say the last line out loud. Do not explain blockchain yet.")


# --------------------------------------------------------------- 04 solution --
def slide_04():
    s = new_slide()
    set_bg(s, WHITE)
    hdr(s, "Solution", "Put the constitution on-chain. Run execution at full speed underneath.", 4,
        title_size=Pt(28))
    t = CONTENT_TOP + Inches(0.25)
    lw = Inches(2.1)
    bw = CONTENT_W - lw - Inches(0.3)
    bl = MARGIN + lw + Inches(0.3)

    # Layer 1 — constitution (on-chain)
    h1 = Inches(1.9)
    add_text(s, MARGIN, t, lw, Inches(0.3), "ON-CHAIN", size=Pt(10), color=ACCENT, bold=True, font=FONT_HEAD)
    add_text(s, MARGIN, t + Inches(0.28), lw, Inches(0.8), "The constitution", size=Pt(20),
             color=NAVY_DARK, bold=True, font=FONT_HEAD)
    add_text(s, MARGIN, t + Inches(0.95), lw, Inches(0.9), "Slow, neutral, final.\nNo one can raise it alone.",
             size=Pt(12), color=TEXT_GRAY, font=FONT)
    card(s, bl, t, bw, h1, fill=NAVY_DARK, line=None)
    items1 = ["Members and roles\n(humans and agents)", "Budget ceilings\nper role", "Commitments to funders\n(refunds, vesting, escrow)", "Formation and\ndissolution"]
    cw = evenly_spaced(4, bw - Inches(0.6), Inches(0.25))
    for i, txt in enumerate(items1):
        x = bl + Inches(0.3) + i * (cw + Inches(0.25))
        add_rect(s, x, t + Inches(0.35), cw, h1 - Inches(0.7), fill=NAVY,
                 shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.1)
        add_text(s, x + Inches(0.15), t + Inches(0.35), cw - Inches(0.3), h1 - Inches(0.7), txt,
                 size=Pt(14), color=WHITE, bold=True, font=FONT_HEAD, anchor=MSO_ANCHOR.MIDDLE,
                 align=PP_ALIGN.CENTER, spacing=1.15)

    # settlement arrow
    ay = t + h1 + Inches(0.05)
    add_rect(s, bl + bw / 2 - Inches(1.6), ay, Inches(3.2), Inches(0.42), fill=ACCENT_LT,
             shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.5)
    add_text(s, bl + bw / 2 - Inches(1.6), ay, Inches(3.2), Inches(0.42),
             "\u25B2  settles to ceilings  \u25BC", size=Pt(12), color=ACCENT, bold=True,
             font=FONT_HEAD, anchor=MSO_ANCHOR.MIDDLE, align=PP_ALIGN.CENTER)

    # Layer 2 — execution (off-chain)
    t2 = ay + Inches(0.52)
    h2 = Inches(1.7)
    add_text(s, MARGIN, t2, lw, Inches(0.3), "OFF-CHAIN", size=Pt(10), color=TEXT_MUTE, bold=True, font=FONT_HEAD)
    add_text(s, MARGIN, t2 + Inches(0.28), lw, Inches(0.8), "Execution", size=Pt(20),
             color=NAVY_DARK, bold=True, font=FONT_HEAD)
    add_text(s, MARGIN, t2 + Inches(0.95), lw, Inches(0.7), "Fast. Reversible.\nInside the ceilings.",
             size=Pt(12), color=TEXT_GRAY, font=FONT)
    card(s, bl, t2, bw, h2, fill=BG_PANEL, line=LINE_GRAY, shadow=False)
    items2 = ["Agent wallets with limits\n(Circle, Coinbase, Turnkey)", "Approval ladders,\nhumans on exceptions only", "x402 spend,\nUSDC payouts, cards", "Audit ledger with\nselective disclosure"]
    for i, txt in enumerate(items2):
        x = bl + Inches(0.3) + i * (cw + Inches(0.25))
        add_rect(s, x, t2 + Inches(0.3), cw, h2 - Inches(0.6), fill=WHITE, line=LINE_GRAY,
                 shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.1)
        add_text(s, x + Inches(0.15), t2 + Inches(0.3), cw - Inches(0.3), h2 - Inches(0.6), txt,
                 size=Pt(13), color=TEXT_DARK, font=FONT, anchor=MSO_ANCHOR.MIDDLE,
                 align=PP_ALIGN.CENTER, spacing=1.15)

    big_statement(s, MARGIN, t2 + h2 + Inches(0.28), CONTENT_W, Inches(0.62),
                  "An organizational rollup: agents at database speed, inside ceilings no agent, admin or vendor can raise.",
                  size=Pt(15))
    ftr(s, 4)
    notes(s, "The Ethereum/rollup analogy is for crypto-native investors; for others say 'constitution and bylaws "
             "on a neutral ledger, day-to-day in normal software'. Emphasize: we are not putting execution on-chain.")


# ---------------------------------------------------------------- 05 product --
def slide_05():
    s = new_slide()
    set_bg(s, WHITE)
    hdr(s, "Product", "Form. Fund. Operate. Settle.", 5)
    n, gap = 4, Inches(0.25)
    w = evenly_spaced(n, CONTENT_W, gap)
    t = CONTENT_TOP + Inches(0.15)
    h = Inches(4.55)
    cols = [
        ("Form", "An organization in minutes", [
            "Humans and agents as role-holders",
            "Treasury, per-role ceilings, approval ladders",
            "Legal wrapper from a template",
            "Public constitution page",
        ]),
        ("Fund", "Raise with enforced rules", [
            "Refund-if-not-funded, vesting, milestone escrow, prize purses",
            "Card and bank in; USDC lands in the treasury",
            "Receipts and rights to contributors",
        ]),
        ("Operate", "Agents spend inside ceilings", [
            "Provider wallets with off-chain limits that settle to on-chain budgets",
            "Humans approve exceptions only",
            "Every action logged against the policy version",
        ]),
        ("Settle", "Pay anyone in the first hour", [
            "USDC, or fiat via a liquidation address",
            "Confidential amounts; stealth addresses",
            "Close the org, return unspent funds, export the books",
        ]),
    ]
    for i, (verb, sub, items) in enumerate(cols):
        l = MARGIN + i * (w + gap)
        card(s, l, t, w, h)
        accent_bar(s, l, t, w)
        add_text(s, l + Inches(0.3), t + Inches(0.3), w - Inches(0.6), Inches(0.6), verb,
                 size=Pt(26), color=NAVY_DARK, bold=True, font=FONT_HEAD)
        add_text(s, l + Inches(0.3), t + Inches(0.9), w - Inches(0.6), Inches(0.6), sub,
                 size=Pt(13), color=ACCENT, bold=True, font=FONT_HEAD)
        add_bullets(s, l + Inches(0.3), t + Inches(1.45), w - Inches(0.6), h - Inches(1.7),
                    items, size=Pt(13), gap=Pt(7), spacing=1.15)
    add_text(s, MARGIN, t + h + Inches(0.18), CONTENT_W, Inches(0.55),
             "The customer never sees Safe, Hats or Zodiac. They see a constitution, a treasury, a budget per role, a funding page, an agent that spends within it, and books.",
             size=Pt(13), color=TEXT_GRAY, font=FONT, italic=True)
    ftr(s, 5)
    notes(s, "Product before business model, per DocSend's finding that successful seed decks place both early.")


# ------------------------------------------------------------------- 06 demo --
def slide_06():
    s = new_slide()
    set_bg(s, WHITE)
    hdr(s, "What it looks like", "Nine minutes from approved proposal to paying a stranger in Nairobi.", 6,
        title_size=Pt(27))
    t = CONTENT_TOP + Inches(0.15)
    lw = Inches(7.6)
    steps = [
        ("1", "Pick the \u201cfunded project\u201d template.", "Three-month research sprint, $180k, three milestone tranches."),
        ("2", "Name 4 humans in 3 countries and 2 agents.", "Compute agent: $15k ceiling. Reporting agent: no spending authority."),
        ("3", "Choose a wrapper.", "Wyoming DUNA from a template. Constitution page goes live."),
        ("4", "Funder pays tranche one.", "Bank wire hits a virtual account, lands as USDC in the project\u2019s treasury."),
        ("5", "Contributor in Nairobi is paid within the hour.", "USDC to a stealth address; off-ramps to M-Pesa via a liquidation address."),
        ("6", "Compute agent buys GPU hours that afternoon.", "Daily cap at the provider; quarterly ceiling on-chain; amounts confidential."),
        ("7", "Month three: committee approves the last milestone.", "Final tranche pays, org closes, $6,200 unspent returns automatically, books post to NetSuite."),
    ]
    y = t
    rh = Inches(0.7)
    for num, lead, rest in steps:
        add_rect(s, MARGIN, y + Inches(0.08), Inches(0.42), Inches(0.42), fill=ACCENT,
                 shape_type=MSO_SHAPE.OVAL)
        add_text(s, MARGIN, y + Inches(0.08), Inches(0.42), Inches(0.42), num, size=Pt(13),
                 color=WHITE, bold=True, font=FONT_HEAD, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        add_text(s, MARGIN + Inches(0.6), y, lw - Inches(0.6), Inches(0.3), lead, size=Pt(14),
                 color=NAVY_DARK, bold=True, font=FONT_HEAD)
        add_text(s, MARGIN + Inches(0.6), y + Inches(0.29), lw - Inches(0.6), Inches(0.4), rest,
                 size=Pt(11.5), color=TEXT_GRAY, font=FONT)
        y += rh
    # right panel
    px = MARGIN + lw + Inches(0.4)
    pw = CONTENT_W - lw - Inches(0.4)
    card(s, px, t, pw, Inches(4.9), fill=NAVY_DARK, line=None)
    add_text(s, px + Inches(0.35), t + Inches(0.35), pw - Inches(0.7), Inches(0.3), "WHAT DID NOT HAPPEN",
             size=Pt(10), color=ACCENT, bold=True, font=FONT_HEAD)
    add_bullets(s, px + Inches(0.35), t + Inches(0.75), pw - Inches(0.7), Inches(2.6), [
        "Nobody opened a bank account",
        "Nobody onboarded a vendor",
        "Nobody signed a multisig transaction",
        "Nobody could raise a ceiling alone",
        "Nobody outside the org saw an amount",
    ], size=Pt(14), color=WHITE, bullet_color=ACCENT, gap=Pt(8))
    add_line(s, px + Inches(0.35), t + Inches(3.55), pw - Inches(0.7), 0, color=NAVY, weight=Pt(1))
    add_text(s, px + Inches(0.35), t + Inches(3.75), pw - Inches(0.7), Inches(1.0),
             "Every component exists today.\nThe product is the nine minutes.",
             size=Pt(15), color=WHITE, bold=True, font=FONT_HEAD, spacing=1.15)
    ftr(s, 6)
    notes(s, "YC's advice: show the simplest version as a bulleted list of steps. If there is a live demo, it replaces this slide.")


# --------------------------------------------------------- 07 the objection --
def slide_07():
    s = new_slide()
    set_bg(s, WHITE)
    hdr(s, "Why on-chain at all", "If you have a trusted operator, use Ramp. Our customers do not.", 7, title_size=Pt(28))
    t = CONTENT_TOP + Inches(0.2)
    rows = [
        ("No trusted operator", "Foundations answerable to token holders, grant and prize committees, syndicates, working groups formed by strangers. The administrator is the adversary the structure exists to bound."),
        ("Strangers\u2019 capital", "Refund-if-not-funded, vesting and escrow that a contributor can verify. A three-week-old organization has no brand; the ledger lends it one."),
        ("Boundary payments", "Thousands of counterparties, many of them software, paid in the first hour with nothing to onboard into. Trust latency, not compute latency, is what shrinks."),
        ("Agent authority", "A ceiling that neither the agent runtime nor the admin console can raise. The hardware root of trust for organizational authority."),
    ]
    rh = Inches(0.92)
    for i, (lead, rest) in enumerate(rows):
        y = t + i * (rh + Inches(0.12))
        card(s, MARGIN, y, CONTENT_W, rh, shadow=False)
        accent_rail(s, MARGIN, y, rh, accent=ACCENT)
        add_text(s, MARGIN + Inches(0.35), y, Inches(2.9), rh, lead, size=Pt(16), color=NAVY_DARK,
                 bold=True, font=FONT_HEAD, anchor=MSO_ANCHOR.MIDDLE)
        add_text(s, MARGIN + Inches(3.35), y, CONTENT_W - Inches(3.7), rh, rest, size=Pt(13),
                 color=TEXT_GRAY, font=FONT, anchor=MSO_ANCHOR.MIDDLE, spacing=1.1)
    add_text(s, MARGIN, t + 4 * (rh + Inches(0.12)) + Inches(0.05), CONTENT_W, Inches(0.45),
             "We refuse conventional single-principal companies, banks and insurers, and anything token-first. Saying so is how we earn the customers who fit.",
             size=Pt(13), color=TEXT_DARK, bold=True, font=FONT_HEAD)
    ftr(s, 7)
    notes(s, "Reid Hoffman's LinkedIn-deck lesson: state the investor's strongest objection yourself and answer it. "
             "Concede the general-company case completely; it makes the rest credible.")


# ------------------------------------------------------------- 08 traction --
def slide_08():
    s = new_slide()
    set_bg(s, WHITE)
    hdr(s, "Proof of operation", "We have run an organization on this substrate since 2022.", 8)
    t = CONTENT_TOP + Inches(0.15)
    stats = [
        ("$8M", "raised from 2,000+ strangers in one month, no bank, no incorporation-first (2022)"),
        ("2", "civilian astronauts flown on Blue Origin (2022, 2024): the first crowdfunded spaceflights"),
        ("80+", "projects funded through an on-chain proposal, vote and retro-reward cycle"),
        ("26 + 250", "team organizations and members formed by our one-transaction org factory"),
        ("30", "countries where contributors have been paid from the treasury"),
        ("4 yrs", "of Safe + Hats + HSM-signed operations under a DAO LLC wrapper, multi-chain"),
    ]
    n, gap = 3, Inches(0.3)
    w = evenly_spaced(n, CONTENT_W, gap)
    h = Inches(1.55)
    for i, (num, label) in enumerate(stats):
        r, c = divmod(i, 3)
        l = MARGIN + c * (w + gap)
        y = t + r * (h + Inches(0.25))
        card(s, l, y, w, h)
        accent_rail(s, l, y, h, accent=ACCENT if r == 0 else NAVY)
        add_text(s, l + Inches(0.3), y + Inches(0.18), w - Inches(0.5), Inches(0.55), num,
                 size=Pt(28), color=NAVY_DARK, bold=True, font=FONT_HEAD)
        add_text(s, l + Inches(0.3), y + Inches(0.78), w - Inches(0.5), Inches(0.7), label,
                 size=Pt(12), color=TEXT_GRAY, font=FONT, spacing=1.1)
    y2 = t + 2 * (h + Inches(0.25)) + Inches(0.05)
    card(s, MARGIN, y2, CONTENT_W, Inches(1.05), fill=BG_PANEL, line=LINE_GRAY, shadow=False)
    add_text(s, MARGIN + Inches(0.35), y2 + Inches(0.15), Inches(2.6), Inches(0.3), "DILIGENCE NOTE",
             size=Pt(10), color=MUTED_RED, bold=True, font=FONT_HEAD)
    add_text(s, MARGIN + Inches(0.35), y2 + Inches(0.42), CONTENT_W - Inches(0.7), Inches(0.6),
             "MoonDAO is the reference deployment and customer zero, not the company. Today humans click through the phase machine; "
             "the agent and formation layers are what this round builds. Every competitor in agent treasury is a repository. We are an organization.",
             size=Pt(12), color=TEXT_DARK, font=FONT, spacing=1.1)
    ftr(s, 8)
    notes(s, "Traction as proof-of-operation. Put the caveat on the slide before they find it: no agents run wallets today. "
             "The point is that the org, the money, the legal wrapper and the permission model are real and four years old.")


# --------------------------------------------------------------- 09 market --
def slide_09():
    s = new_slide()
    set_bg(s, WHITE)
    hdr(s, "Market", "The market is the rate at which organizations get formed.", 9)
    t = CONTENT_TOP + Inches(0.15)
    gap = Inches(0.3)
    w = evenly_spaced(3, CONTENT_W, gap)
    h = Inches(3.7)
    tiers = [
        ("Now", "Where organizations already form fast and already hold stablecoins", [
            ("Ecosystem grant programs:", " every grant is a small org; hundreds formed per ecosystem per year; top ecosystems disburse on the order of $1B+ a year"),
            ("Public-goods and open-source funding", ""),
            ("Prizes, bounties, hackathons", ""),
        ], ACCENT),
        ("Next", "Where agents and strangers form organizations together", [
            ("Agent-native businesses and swarms", ""),
            ("Remote contributor collectives and guilds", " paid across 20\u201340 countries"),
            ("Pop-up organizations:", " conferences, pop-up cities, expeditions, community missions"),
        ], NAVY),
        ("Expanding edge", "What moves the ceiling on the whole market", [
            ("Stablecoin business accounts", " in 100+ countries (Stripe, Bridge, Circle)"),
            ("Agent commerce", " on x402, Agent Pay, Intelligent Commerce"),
            ("Every agent swarm", " becomes a micro-organization with a budget and members"),
        ], TEXT_MUTE),
    ]
    for i, (kick, title, items, acc) in enumerate(tiers):
        l = MARGIN + i * (w + gap)
        col_card(s, l, t, w, h, title, items, accent=acc, kicker=kick, title_size=Pt(15), body_size=Pt(13))
    y2 = t + h + Inches(0.2)
    card(s, MARGIN, y2, CONTENT_W, Inches(1.0), fill=NAVY_DARK, line=None)
    add_text(s, MARGIN + Inches(0.35), y2 + Inches(0.12), Inches(3.2), Inches(0.3), "WHAT VENTURE-SCALE REQUIRES",
             size=Pt(10), color=ACCENT, bold=True, font=FONT_HEAD)
    add_text(s, MARGIN + Inches(0.35), y2 + Inches(0.4), CONTENT_W - Inches(0.7), Inches(0.55),
             "About 5,000 active organizations and $1\u20132B of annual flows. We publish formation counts and flows every quarter, "
             "so you will know before we do whether the bet is paying.",
             size=Pt(13), color=WHITE, font=FONT, spacing=1.1)
    ftr(s, 9)
    notes(s, "No top-down TAM. Bottoms-up on formation rate, which is the single observable the whole thesis reduces to. "
             "Investors reward honesty here more than a $1T slide.")


# ------------------------------------------------------- 10 business model --
def slide_10():
    s = new_slide()
    set_bg(s, WHITE)
    hdr(s, "Business model", "Stripe Atlas for the agent era: formation is the acquisition, flows are the business.", 10,
        title_size=Pt(26))
    t = CONTENT_TOP + Inches(0.2)
    gap = Inches(0.3)
    w = evenly_spaced(3, CONTENT_W, gap)
    h = Inches(2.4)
    pricing = [
        ("Formation fee", "$250\u2013$2,500", "per organization, by template and legal wrapper. Filters tourists; the Atlas move."),
        ("Platform fee", "$200\u2013$2,000 / month", "per active organization: constitution page, agent adapters, audit ledger, disclosure."),
        ("Flow fee", "25\u201375 bps", "on capital raised, escrowed and paid out through our contracts. The Stripe move; where the venture math lives."),
    ]
    for i, (name, price, desc) in enumerate(pricing):
        l = MARGIN + i * (w + gap)
        card(s, l, t, w, h)
        accent_bar(s, l, t, w, accent=ACCENT if i == 2 else NAVY)
        add_text(s, l + Inches(0.3), t + Inches(0.3), w - Inches(0.6), Inches(0.3), name.upper(),
                 size=Pt(10), color=TEXT_MUTE, bold=True, font=FONT_HEAD)
        add_text(s, l + Inches(0.3), t + Inches(0.6), w - Inches(0.6), Inches(0.6), price,
                 size=Pt(21), color=NAVY_DARK, bold=True, font=FONT_HEAD)
        add_text(s, l + Inches(0.3), t + Inches(1.25), w - Inches(0.6), Inches(1.0), desc,
                 size=Pt(13), color=TEXT_GRAY, font=FONT, spacing=1.1)
    y2 = t + h + Inches(0.3)
    card(s, MARGIN, y2, CONTENT_W, Inches(2.0), fill=BG_PANEL, line=LINE_GRAY, shadow=False)
    add_text(s, MARGIN + Inches(0.35), y2 + Inches(0.2), Inches(4), Inches(0.3), "ILLUSTRATIVE ARITHMETIC",
             size=Pt(10), color=ACCENT, bold=True, font=FONT_HEAD)
    cols = [
        ("500 orgs \u00d7 $600/mo", "$3.6M / yr"),
        ("$100M flows \u00d7 50 bps", "$0.5M / yr"),
        ("5,000 orgs + $1.5B flows", "$30\u201340M / yr"),
    ]
    cw = evenly_spaced(3, CONTENT_W - Inches(0.7), Inches(0.3))
    for i, (a, b) in enumerate(cols):
        x = MARGIN + Inches(0.35) + i * (cw + Inches(0.3))
        add_text(s, x, y2 + Inches(0.6), cw, Inches(0.3), a, size=Pt(13), color=TEXT_GRAY, font=FONT)
        add_text(s, x, y2 + Inches(0.95), cw, Inches(0.5), b, size=Pt(22), color=NAVY_DARK, bold=True, font=FONT_HEAD)
    add_text(s, MARGIN + Inches(0.35), y2 + Inches(1.55), CONTENT_W - Inches(0.7), Inches(0.35),
             "No token. No custody. Wallets, chains, KYC and legal wrappers are partners with revenue share, not products.",
             size=Pt(12), color=TEXT_DARK, bold=True, font=FONT_HEAD)
    ftr(s, 10)
    notes(s, "DocSend: business model is the second most scrutinized section. Keep the third column honest; "
             "it is the same number as the market slide.")


# ---------------------------------------------------------- 11 competition --
def slide_11():
    s = new_slide()
    set_bg(s, WHITE)
    hdr(s, "Competition", "Wallet vendors are partners. We are the layer above all of them.", 11)
    # positioning map
    mx, my = MARGIN + Inches(0.6), CONTENT_TOP + Inches(0.25)
    mw, mh = Inches(7.4), Inches(4.5)
    add_rect(s, mx, my, mw, mh, fill=BG_LIGHT, line=LINE_GRAY)
    add_line(s, mx, my + mh / 2, mw, 0, color=LINE_GRAY, weight=Pt(1))
    add_line(s, mx + mw / 2, my, 0, mh, color=LINE_GRAY, weight=Pt(1))
    add_text(s, mx, my + mh + Inches(0.08), mw, Inches(0.3), "one agent, one wallet   \u2192   whole organization: humans + agents",
             size=Pt(11), color=TEXT_MUTE, font=FONT_HEAD, bold=True, align=PP_ALIGN.CENTER)
    add_text(s, MARGIN - Inches(0.05), my, Inches(0.6), mh, "vendor-enforced  \u2192  chain-enforced ceilings",
             size=Pt(10), color=TEXT_MUTE, font=FONT_HEAD, bold=True, anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, mx + mw - Inches(2.6), my + mh + Inches(0.08), Inches(2.6), Inches(0.3), "",
             size=Pt(10), color=TEXT_MUTE)

    def dot(x_frac, y_frac, label, fill=WHITE, line=LINE_GRAY, color=TEXT_DARK, w=Inches(1.9), bold=False):
        x = mx + mw * x_frac - w / 2
        y = my + mh * (1 - y_frac) - Inches(0.22)
        add_rect(s, x, y, w, Inches(0.44), fill=fill, line=line,
                 shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.4)
        add_text(s, x, y, w, Inches(0.44), label, size=Pt(10), color=color, bold=bold,
                 font=FONT_HEAD, anchor=MSO_ANCHOR.MIDDLE, align=PP_ALIGN.CENTER)

    dot(0.16, 0.22, "Coinbase \u00b7 Crossmint\nTurnkey \u00b7 Privy", w=Inches(2.0))
    dot(0.30, 0.42, "Nava \u00b7 Sigil\n(agent policy)", w=Inches(1.7))
    dot(0.68, 0.18, "Ramp \u00b7 Okta\n(fiat, human)", w=Inches(1.6))
    dot(0.60, 0.40, "Tally \u00b7 Aragon\n(DAO tooling)", w=Inches(1.7))
    dot(0.22, 0.80, "Safe \u00b7 Hats \u00b7 Zodiac\n(primitives)", w=Inches(1.9))
    dot(0.80, 0.86, COMPANY.title(), fill=ACCENT, line=ACCENT, color=WHITE, w=Inches(1.6), bold=True)
    dot(0.85, 0.06, "Inertia: spreadsheets\n+ a founder\u2019s Wise", fill=BG_PANEL, w=Inches(2.1), color=TEXT_GRAY)

    # right column
    rx = mx + mw + Inches(0.5)
    rw = SLIDE_W - MARGIN - rx
    add_text(s, rx, my, rw, Inches(0.3), "HOW WE WIN", size=Pt(10), color=ACCENT, bold=True, font=FONT_HEAD)
    add_bullets(s, rx, my + Inches(0.35), rw, mh, [
        ("Proof of operation.", " Competitors are repositories; we have run a real organization on the primitives for four years."),
        ("Neutral by design.", " A coordination layer for many parties cannot be owned by one of them. Consortium chains died on this; Stripe and Okta cannot be it."),
        ("Partners, not rivals.", " Every wallet and signer plugs in. We never hold keys."),
        ("Lifecycles, not a DSL.", " Grants, prizes, retro rewards, funding rounds as templates; the policy engine is a commodity."),
    ], size=Pt(12), gap=Pt(8), spacing=1.12)
    ftr(s, 11)
    notes(s, "Name everyone, including inertia. Investors punish 'we have no competitors'. "
             "Two axes: scope (agent vs organization) and where the ceiling is enforced.")


# ------------------------------------------------------------------ 12 gtm --
def slide_12():
    s = new_slide()
    set_bg(s, WHITE)
    hdr(s, "Go-to-market", "Start where organizations already form fast and already hold stablecoins.", 12, title_size=Pt(27))
    t = CONTENT_TOP + Inches(0.2)
    phases = [
        ("Months 0\u20136", "Tier 1 only", [
            "3\u20135 design partners: ecosystem grant programs, a public-goods round, a prize",
            "MoonDAO\u2019s quarterly projects run as organizational rollups: the public reference",
            "Formation self-serve by month six",
        ], ACCENT),
        ("Months 6\u201318", "Tier 2 via inbound", [
            "Agent builders and contributor guilds already inside Tier 1 ecosystems",
            "Confidential amounts on by default",
            "First deployment on a payments-first private chain when one is production-ready",
        ], NAVY),
        ("Month 18+", "Tier 3, conditionally", [
            "Syndicates only with a licensed partner carrying the regulatory risk",
            "Only if formation rate is rising quarter over quarter",
        ], TEXT_MUTE),
    ]
    gap = Inches(0.3)
    w = evenly_spaced(3, CONTENT_W, gap)
    h = Inches(3.6)
    for i, (when, what, items, acc) in enumerate(phases):
        l = MARGIN + i * (w + gap)
        col_card(s, l, t, w, h, what, items, accent=acc, kicker=when, title_size=Pt(17), body_size=Pt(13))
    y2 = t + h + Inches(0.2)
    card(s, MARGIN, y2, CONTENT_W, Inches(1.05), fill=BG_PANEL, line=LINE_GRAY, shadow=False)
    add_text(s, MARGIN + Inches(0.35), y2 + Inches(0.12), Inches(4), Inches(0.3), "MARKETS WE REFUSE",
             size=Pt(10), color=MUTED_RED, bold=True, font=FONT_HEAD)
    add_text(s, MARGIN + Inches(0.35), y2 + Inches(0.4), CONTENT_W - Inches(0.7), Inches(0.6),
             "Single-principal fiat companies \u00b7 banks, insurers, pharma settlement \u00b7 anything token-first or speculative \u00b7 "
             "prediction markets and gambling as the core \u00b7 consumer wallets \u00b7 conventional payroll \u00b7 custody \u00b7 \u201creplace Okta\u201d \u00b7 anonymity from compliance",
             size=Pt(12), color=TEXT_DARK, font=FONT, spacing=1.15)
    ftr(s, 12)
    notes(s, "Buyer in Tier 1 is the grants lead, who hates the current process. The refuse list is a credibility device.")


# ----------------------------------------------------------------- 13 team --
def slide_13():
    s = new_slide()
    set_bg(s, WHITE)
    hdr(s, "Team", "The team that has operated this for four years.", 13)
    t = CONTENT_TOP + Inches(0.2)
    gap = Inches(0.3)
    w = evenly_spaced(3, CONTENT_W, gap)
    h = Inches(2.7)
    people = [
        ("Pablo Moncada-Larrotiz", "Co-founder, CEO", [
            "Co-founded MoonDAO (2021); first elected Executive Lead",
            "Led the $8M raise and two crowdfunded spaceflights",
            "Formerly engineering at a large technology company",
        ]),
        ("Ryan  [surname]", "Co-founder, [Protocol / Engineering]", [
            "[Role at MoonDAO, years]",
            "[Systems shipped: Launchpad, DePrize, org factory, HSM operations]",
            "[Prior experience]",
        ]),
        ("Miguel  [surname]", "Co-founder, [Product / Operations]", [
            "[Role at MoonDAO, years]",
            "[Systems shipped / programs run]",
            "[Prior experience]",
        ]),
    ]
    for i, (name, role, items) in enumerate(people):
        l = MARGIN + i * (w + gap)
        card(s, l, t, w, h)
        add_rect(s, l + Inches(0.3), t + Inches(0.3), Inches(0.9), Inches(0.9), fill=BG_PANEL,
                 shape_type=MSO_SHAPE.OVAL)
        add_text(s, l + Inches(1.35), t + Inches(0.28), w - Inches(1.6), Inches(0.45), name, size=Pt(14),
                 color=NAVY_DARK, bold=True, font=FONT_HEAD)
        add_text(s, l + Inches(1.35), t + Inches(0.7), w - Inches(1.6), Inches(0.5), role, size=Pt(12),
                 color=ACCENT, bold=True, font=FONT_HEAD)
        add_bullets(s, l + Inches(0.3), t + Inches(1.4), w - Inches(0.6), h - Inches(1.5), items,
                    size=Pt(12), gap=Pt(5), spacing=1.1)
    y2 = t + h + Inches(0.3)
    gap2 = Inches(0.3)
    w2 = evenly_spaced(2, CONTENT_W, gap2)
    col_card(s, MARGIN, y2, w2, Inches(1.55), "Hiring with this round", [
        "Agent-systems engineer (execution adapters, settlement)",
        "Design-partner lead who has run a grants or prize program",
    ], accent=NAVY, title_size=Pt(14), body_size=Pt(12))
    col_card(s, MARGIN + w2 + gap2, y2, w2, Inches(1.55), "Advisors  [to be confirmed]", [
        "Safe / Hats ecosystem; a foundation grants lead; securities counsel with DAO-spin-out experience",
    ], accent=TEXT_MUTE, title_size=Pt(14), body_size=Pt(12))
    ftr(s, 13)
    notes(s, "Bracketed fields are placeholders to fill before sending. At pre-seed the team is the thesis; "
             "lead with the proof ('we ran it'), not titles. Disclose the MoonDAO conflict and recusal if asked.")


# ------------------------------------------------------------------ 14 ask --
def slide_14():
    s = new_slide()
    set_bg(s, WHITE)
    hdr(s, "The ask", "$2.5M pre-seed for eighteen months.", 14)
    t = CONTENT_TOP + Inches(0.2)
    lw = Inches(5.6)
    # use of funds
    card(s, MARGIN, t, lw, Inches(4.9))
    accent_bar(s, MARGIN, t, lw)
    add_text(s, MARGIN + Inches(0.3), t + Inches(0.3), lw - Inches(0.6), Inches(0.3), "USE OF FUNDS",
             size=Pt(10), color=ACCENT, bold=True, font=FONT_HEAD)
    uses = [
        ("Engineering (4)", "2 protocol, 2 agent / infrastructure", 0.58),
        ("Go-to-market (1)", "design-partner lead", 0.14),
        ("Legal-ops and compliance (1)", "wrappers, fiat-edge onboarding, counsel", 0.16),
        ("Audits, infrastructure, reserve", "", 0.12),
    ]
    y = t + Inches(0.7)
    for lead, rest, frac in uses:
        add_text(s, MARGIN + Inches(0.3), y, Inches(3.4), Inches(0.3), lead, size=Pt(13), color=NAVY_DARK,
                 bold=True, font=FONT_HEAD)
        add_text(s, MARGIN + Inches(0.3), y + Inches(0.28), Inches(3.4), Inches(0.3), rest, size=Pt(11),
                 color=TEXT_GRAY, font=FONT)
        bar_w = lw - Inches(0.6)
        add_rect(s, MARGIN + Inches(0.3), y + Inches(0.62), bar_w, Inches(0.16), fill=BG_PANEL,
                 shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.5)
        add_rect(s, MARGIN + Inches(0.3), y + Inches(0.62), Emu(int(bar_w * frac)), Inches(0.16), fill=ACCENT,
                 shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.5)
        add_text(s, MARGIN + lw - Inches(1.1), y, Inches(0.8), Inches(0.3), f"{int(frac * 100)}%", size=Pt(13),
                 color=NAVY_DARK, bold=True, font=FONT_HEAD, align=PP_ALIGN.RIGHT)
        y += Inches(1.0)
    # milestones
    rx = MARGIN + lw + Inches(0.3)
    rw = CONTENT_W - lw - Inches(0.3)
    card(s, rx, t, rw, Inches(2.95))
    accent_bar(s, rx, t, rw, accent=NAVY)
    add_text(s, rx + Inches(0.3), t + Inches(0.3), rw - Inches(0.6), Inches(0.3), "MILESTONES",
             size=Pt(10), color=NAVY, bold=True, font=FONT_HEAD)
    add_bullets(s, rx + Inches(0.3), t + Inches(0.65), rw - Inches(0.6), Inches(2.3), [
        ("Month 4:", " formation MVP live; MoonDAO\u2019s quarter runs as organizational rollups"),
        ("Month 6:", " three paying design partners; formation self-serve"),
        ("Month 12:", " 200 active organizations; confidential amounts by default"),
        ("Month 18:", " 1,000 organizations, $100M+ flows: Series A metrics"),
    ], size=Pt(12), gap=Pt(6), spacing=1.1)
    y3 = t + Inches(3.2)
    card(s, rx, y3, rw, Inches(1.7), fill=BG_PANEL, line=LINE_GRAY, shadow=False)
    add_text(s, rx + Inches(0.3), y3 + Inches(0.2), rw - Inches(0.6), Inches(0.3), "STRUCTURE",
             size=Pt(10), color=TEXT_MUTE, bold=True, font=FONT_HEAD)
    add_bullets(s, rx + Inches(0.3), y3 + Inches(0.5), rw - Inches(0.6), Inches(1.2), [
        "Delaware C-Corp; standard instruments; no token",
        "MoonDAO LLC: 10\u201320% equity, board observer, exclusive IP license with carve-back",
        "MoonDAO is customer zero at a fair-value services contract",
    ], size=Pt(11), gap=Pt(4), spacing=1.1, bullet_color=TEXT_MUTE)
    ftr(s, 14)
    notes(s, "State the ask in one breath. The structure box pre-empts the 'DAO spin-out' questions; "
             "the Aave Labs and Gitcoin Passport precedents are the references if asked.")


# -------------------------------------------------------------- 15 closing --
def slide_15():
    s = new_slide()
    set_bg(s, NAVY_DARK)
    add_rect(s, 0, SLIDE_H - Inches(0.09), SLIDE_W, Inches(0.09), fill=ACCENT)
    wordmark(s, MARGIN, Inches(0.7), color=WHITE, size=Pt(16))
    add_text(s, MARGIN, Inches(1.9), Inches(11.8), Inches(1.6),
             "The corporate registry and clearing system of the agent economy.",
             size=Pt(40), color=WHITE, bold=True, font=FONT_HEAD, spacing=1.05)
    add_text(s, MARGIN, Inches(3.75), Inches(9), Inches(0.3), "THREE NUMBERS WE WILL REPORT EVERY QUARTER",
             size=Pt(10), color=ACCENT, bold=True, font=FONT_HEAD)
    metrics = [
        ("Minutes", "to form and fund a new organization"),
        ("Minutes", "to first payment to a counterparty never dealt with before"),
        ("Share of authority", "bounded by a ceiling no single party can raise"),
    ]
    gap = Inches(0.3)
    w = evenly_spaced(3, CONTENT_W, gap)
    for i, (num, label) in enumerate(metrics):
        l = MARGIN + i * (w + gap)
        add_rect(s, l, Inches(4.15), w, Inches(1.35), fill=NAVY, shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.1)
        add_text(s, l + Inches(0.3), Inches(4.3), w - Inches(0.6), Inches(0.5), num, size=Pt(22), color=WHITE,
                 bold=True, font=FONT_HEAD)
        add_text(s, l + Inches(0.3), Inches(4.85), w - Inches(0.6), Inches(0.6), label, size=Pt(12),
                 color=RGBColor(0xC7, 0xCC, 0xE4), font=FONT, spacing=1.1)
    add_text(s, MARGIN, Inches(6.0), Inches(11), Inches(0.9),
             "The substrate will not make your organization faster. It lets organizations exist that could not, "
             "and lets agents hold authority that could not otherwise be trusted.",
             size=Pt(14), color=RGBColor(0xC7, 0xE9, 0xE4), font=FONT, italic=True, spacing=1.15)
    add_text(s, MARGIN, Inches(6.95), Inches(8), Inches(0.3), "[founder email]   \u00b7   [data room link]",
             size=Pt(11), color=RGBColor(0x9A, 0xA3, 0xC0), font=FONT)
    notes(s, "Close on the metrics, not on adjectives. Offer the data room: the venture case document, the repo, "
             "the financial disclosure, and the design-partner pipeline.")


# ------------------------------------------------------------ 16 appendix --
def slide_16():
    s = new_slide()
    set_bg(s, WHITE)
    hdr(s, "Appendix", "What would make us wrong, and what we do about it.", 16)
    t = CONTENT_TOP + Inches(0.2)
    rows = [
        ("The org layer gets absorbed by the wallet layer", "Be Coinbase\u2019s and Safe\u2019s reference application and template layer before they build it; partner early."),
        ("Agent-heavy organizations stay rare", "Publish formation counts quarterly; month-5 go/no-go on three paying design partners; clean acqui-hire path (Coinbase, Safe Labs, Polymarket) that still returns equity to MoonDAO."),
        ("Legal exposure of agents moving money", "Never market autonomy; humans hold the hats that set policy; every action has a legal principal; we do not custody funds; no token."),
        ("Privacy stays immature", "Confidential amounts via ERC-7984 today; Tempo Zones and Arc Privacy as the 2027 home; policy and audit trail are ledger-agnostic by design."),
        ("A three-person team against $8\u201335M-funded entrants", "The moat is proof of operation, not headcount; this round funds the two hires that matter."),
    ]
    rh = Inches(0.86)
    for i, (risk, resp) in enumerate(rows):
        y = t + i * (rh + Inches(0.1))
        card(s, MARGIN, y, CONTENT_W, rh, shadow=False)
        accent_rail(s, MARGIN, y, rh, accent=MUTED_RED)
        add_text(s, MARGIN + Inches(0.35), y, Inches(3.6), rh, risk, size=Pt(13), color=NAVY_DARK, bold=True,
                 font=FONT_HEAD, anchor=MSO_ANCHOR.MIDDLE, spacing=1.05)
        add_text(s, MARGIN + Inches(4.1), y, CONTENT_W - Inches(4.45), rh, resp, size=Pt(12), color=TEXT_GRAY,
                 font=FONT, anchor=MSO_ANCHOR.MIDDLE, spacing=1.1)
    ftr(s, 16)
    notes(s, "Appendix, for diligence. Investors trust a founder who lists the kill conditions.")


for fn in (slide_01, slide_02, slide_03, slide_04, slide_05, slide_06, slide_07, slide_08,
           slide_09, slide_10, slide_11, slide_12, slide_13, slide_14, slide_15, slide_16):
    fn()

out = os.path.join(DIST, 'NewCo_Seed_Deck.pptx')
prs.save(out)
print(f"wrote {out} ({len(prs.slides)} slides)")
