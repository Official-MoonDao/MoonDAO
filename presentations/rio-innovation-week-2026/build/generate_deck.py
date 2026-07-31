#!/usr/bin/env python3
"""Builds MoonDAO_Rio_Innovation_Week.pptx — institutional deck for the
"Deep Space and the Lunar Economy" panel (2nd Space Industry Workshop Brazil).

Run:  python3 build/generate_deck.py
Output: dist/MoonDAO_Rio_Innovation_Week.pptx
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.dml.color import RGBColor

import imgutil as I
from deckutil import (
    SLIDE_W, SLIDE_H, MARGIN, FONT, FONT_HEAD,
    NAVY_DARK, NAVY, BLUE, ORANGE, ORANGE_LT, RED, WHITE, BG_LIGHT, BG_PANEL,
    LINE_GRAY, TEXT_DARK, TEXT_GRAY, TEXT_MUTE,
    set_bg, add_rect, add_line, add_text, add_rich, add_bullets, add_picture,
    header, footer, stat_card, section_number_badge, add_donut_chart, logo_lockup_white,
)

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, '..', 'assets'))
DIST = os.path.normpath(os.path.join(HERE, '..', 'dist'))
os.makedirs(DIST, exist_ok=True)

LOGO = os.path.join(ASSETS, 'MoonDAO_icon.png')
TOTAL_SLIDES = 12

prs = Presentation()
prs.slide_width = SLIDE_W
prs.slide_height = SLIDE_H
BLANK = prs.slide_layouts[6]


def new_slide():
    return prs.slides.add_slide(BLANK)


# --------------------------------------------------------------------- 01 --
# Title slide
def slide_01():
    s = new_slide()
    set_bg(s, WHITE)

    panel_x = Inches(8.35)
    panel_w = Emu(SLIDE_W - panel_x)
    moon_img = I.darken('moon-full.jpg', factor=0.55, ratio=(panel_w.inches, SLIDE_H.inches))
    add_picture(s, moon_img, panel_x, 0, panel_w, SLIDE_H)
    add_rect(s, panel_x, 0, Inches(0.06), SLIDE_H, fill=ORANGE)

    # Pablo circular headshot inside the panel
    badge = I.circle_badge('pablo_headshot.png', size=700, border_color=(255, 255, 255, 255), border_px=14)
    bd = Inches(2.3)
    add_picture(s, badge, panel_x + (panel_w - bd) / 2, Inches(4.55), bd, bd)
    add_text(s, panel_x + Inches(0.2), Inches(6.95), panel_w - Inches(0.4), Inches(0.4),
              "Space Acceleration Network", size=Pt(11), color=WHITE, align=PP_ALIGN.CENTER, font=FONT)

    lw = Inches(3.1)
    lh = lw * (345 / 1233)
    add_picture(s, LOGO, Inches(0.7), Inches(0.55), lw, lh)

    add_text(s, Inches(0.72), Inches(1.95), Inches(7.2), Inches(0.4),
              "THE INTERNET'S SPACE PROGRAM", size=Pt(14), color=ORANGE, bold=True, font=FONT_HEAD)
    add_text(s, Inches(0.68), Inches(2.35), Inches(7.4), Inches(1.15),
              "MoonDAO", size=Pt(60), color=NAVY_DARK, bold=True, font=FONT_HEAD)
    add_text(s, Inches(0.72), Inches(3.55), Inches(7.4), Inches(0.6),
              "Deep Space and the Lunar Economy", size=Pt(24), color=NAVY, bold=False, font=FONT_HEAD)
    add_text(s, Inches(0.72), Inches(4.08), Inches(7.4), Inches(0.5),
              "2nd Space Industry Workshop Brazil  ·  Brazilian Space Agency (AEB)  ·  Rio de Janeiro",
              size=Pt(13.5), color=TEXT_GRAY, font=FONT)

    add_line(s, Inches(0.72), Inches(4.85), Inches(6.9), 0, color=LINE_GRAY, weight=Pt(1))

    circ = I.circle_badge('pablo_headshot.png', size=400)
    cd = Inches(0.95)
    add_picture(s, circ, Inches(0.72), Inches(5.15), cd, cd)
    add_text(s, Inches(1.85), Inches(5.18), Inches(5.8), Inches(0.4),
              "Pablo Moncada-Larrotiz", size=Pt(18), color=NAVY_DARK, bold=True, font=FONT_HEAD)
    add_text(s, Inches(1.85), Inches(5.58), Inches(5.8), Inches(0.4),
              "Founder & Executive Director, MoonDAO", size=Pt(13.5), color=TEXT_GRAY, font=FONT)

    add_text(s, Inches(0.72), Inches(6.85), Inches(7.2), Inches(0.35),
              "pablo@moondao.com   ·   @pablo_moncada_   ·   moondao.com",
              size=Pt(11.5), color=TEXT_MUTE, font=FONT)
    return s


# --------------------------------------------------------------------- 02 --
def slide_02():
    s = new_slide()
    set_bg(s, WHITE)
    header(s, "About the Speaker", "Pablo Moncada-Larrotiz", 2, LOGO)

    left_w = Inches(3.9)
    lx = MARGIN
    ly = Inches(1.65)
    badge = I.circle_badge('pablo_headshot.png', size=700)
    bd = Inches(2.5)
    add_picture(s, badge, lx + (left_w - bd) / 2, ly, bd, bd)
    add_text(s, lx, ly + bd + Inches(0.22), left_w, Inches(0.4),
              "Pablo Moncada-Larrotiz", size=Pt(17), color=NAVY_DARK, bold=True,
              align=PP_ALIGN.CENTER, font=FONT_HEAD)
    add_text(s, lx, ly + bd + Inches(0.58), left_w, Inches(0.6),
              "Founder & Executive\nDirector, MoonDAO", size=Pt(12.5), color=TEXT_GRAY,
              align=PP_ALIGN.CENTER, font=FONT)
    add_text(s, lx, ly + bd + Inches(1.35), left_w, Inches(0.35),
              "San Francisco, CA", size=Pt(11), color=TEXT_MUTE, align=PP_ALIGN.CENTER, font=FONT)
    add_text(s, lx, ly + bd + Inches(1.62), left_w, Inches(0.35),
              "pablo@moondao.com  ·  @pablo_moncada_", size=Pt(10.5), color=TEXT_MUTE,
              align=PP_ALIGN.CENTER, font=FONT)

    rx = Inches(4.85)
    rw = SLIDE_W - MARGIN - rx
    bullets = [
        ("Founder of MoonDAO. ", "Co-founded and served as the first elected Executive Lead, building an open, onchain platform to fund and govern humanity's return to the Moon since 2021."),
        ("Formerly BigTech. ", "Software engineer at Google, working on Waymo's self-driving perception systems and YouTube VR, and previously at a biotech startup engineering human tissue."),
        ("Core contributor, ConstitutionDAO. ", "Helped build the DAO that raised $47M in days to bid on an original copy of the U.S. Constitution."),
        ("University of Michigan. ", "Studied Computer Science, Mechanical Engineering, and Business; grew up between Michigan and Zaragoza, Spain."),
    ]
    add_bullets(s, rx, Inches(1.65), rw, Inches(3.5), bullets, size=Pt(13.5), gap=Pt(10))

    add_rect(s, rx, Inches(5.85), rw, Inches(0.95), fill=BG_PANEL,
              shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.12)
    add_text(s, rx + Inches(0.28), Inches(5.98), rw - Inches(0.56), Inches(0.75),
              "\u201cI used to work at Big Tech, but stepped away after seeing where the world "
              "could be headed with centralized control over billions of people's lives. "
              "I see decentralization as a way to help fix that.\u201d",
              size=Pt(12), color=NAVY_DARK, italic=True, font=FONT)

    footer(s, 2, TOTAL_SLIDES)
    return s


# --------------------------------------------------------------------- 03 --
def slide_03():
    s = new_slide()
    set_bg(s, WHITE)
    header(s, "Who We Are", "What Is MoonDAO", 3, LOGO)

    add_text(s, MARGIN, Inches(1.55), Inches(12.2), Inches(0.7),
              "An onchain community — anyone, anywhere — pooling resources to fund and "
              "govern humanity's next steps into space.",
              size=Pt(19), color=NAVY_DARK, bold=True, font=FONT_HEAD)

    add_rect(s, MARGIN, Inches(2.4), Inches(12.2), Inches(0.95), fill=BG_PANEL,
              shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.15)
    add_text(s, MARGIN + Inches(0.3), Inches(2.55), Inches(2.5), Inches(0.65),
              "OUR MISSION", size=Pt(12), color=ORANGE, bold=True, font=FONT_HEAD, anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, Inches(3.1), Inches(2.55), Inches(9.15), Inches(0.65),
              "To accelerate the development of a self-sustaining, self-governing settlement on the Moon.",
              size=Pt(15.5), color=NAVY_DARK, italic=True, font=FONT, anchor=MSO_ANCHOR.MIDDLE)

    bullets = [
        ("Decentralized. ", "Membership, voting, and treasury are governed onchain through the $MOONEY token — no single point of control."),
        ("Global & permissionless. ", "Anyone, anywhere can join as a Citizen, propose a project, contribute funding, or start a Team."),
        ("Radically transparent. ", "Every proposal, vote, and treasury transaction is public and verifiable onchain."),
    ]
    add_bullets(s, MARGIN, Inches(3.6), Inches(12.2), Inches(1.6), bullets, size=Pt(14.5), gap=Pt(10))

    stats = [
        ("$8M+", "Raised onchain\nto fund space access"),
        ("12,000+", "$MOONEY\ntoken holders"),
        ("80+", "Space R&D projects\nfunded via governance"),
        ("2", "Crowdfunded citizen-\nastronauts sent to space"),
    ]
    card_w = Inches(2.85)
    gap = Inches(0.2)
    total_w = card_w * 4 + gap * 3
    x0 = (SLIDE_W - total_w) / 2
    y0 = Inches(5.45)
    ch = Inches(1.35)
    for i, (num, label) in enumerate(stats):
        cx = x0 + i * (card_w + gap)
        stat_card(s, cx, y0, card_w, ch, num, label, accent=[NAVY, ORANGE, RED, BLUE][i % 4])

    footer(s, 3, TOTAL_SLIDES)
    return s


# --------------------------------------------------------------------- 04 --
def slide_04():
    s = new_slide()
    set_bg(s, WHITE)
    header(s, "Our Story", "Five Years of Milestones", 4, LOGO)

    events = [
        ("2021", "MoonDAO Launches", "First DAO focused on space\nexploration & lunar settlement"),
        ("2022", "$8M Raised + First Astronaut", "2,600 ETH raised; Coby Cotton\nflies on Blue Origin's NS-22"),
        ("2023", "80+ Projects Funded", "Community governance funds a\nthriving space R&D ecosystem"),
        ("2024", "Network + 2nd Astronaut", "Space Acceleration Network launches;\nDr. Eiman Jahangir flies to space"),
        ("2025", "Constitution Reaches the Moon", "MoonDAO Launchpad ships; our\nconstitution lands on the lunar surface"),
    ]
    n = len(events)
    card_w = Inches(2.15)
    x0 = MARGIN + card_w / 2
    x1 = SLIDE_W - MARGIN - card_w / 2
    line_y = Inches(2.85)
    add_line(s, x0, line_y, x1 - x0, 0, color=LINE_GRAY, weight=Pt(2.5))
    step = (x1 - x0) / (n - 1)
    colors = [NAVY, BLUE, ORANGE, RED, NAVY]
    for i, (yr, title, desc) in enumerate(events):
        cx = x0 + step * i
        dot = Inches(0.22)
        shp = s.shapes.add_shape(MSO_SHAPE.OVAL, cx - dot / 2, line_y - dot / 2, dot, dot)
        shp.fill.solid()
        shp.fill.fore_color.rgb = colors[i]
        shp.line.color.rgb = WHITE
        shp.line.width = Pt(2)
        shp.shadow.inherit = False

        add_text(s, cx - card_w / 2, line_y - Inches(1.35), card_w, Inches(0.4), yr,
                  size=Pt(20), color=colors[i], bold=True, align=PP_ALIGN.CENTER, font=FONT_HEAD)
        add_text(s, cx - card_w / 2, line_y - Inches(0.98), card_w, Inches(0.7), title,
                  size=Pt(12), color=NAVY_DARK, bold=True, align=PP_ALIGN.CENTER, font=FONT_HEAD)

        add_text(s, cx - card_w / 2, line_y + Inches(0.3), card_w, Inches(0.95), desc,
                  size=Pt(10), color=TEXT_GRAY, align=PP_ALIGN.CENTER, font=FONT)

    photos = [
        ('MoonDAO-New-Shepard.jpg', 'Team at Blue Origin\u2019s launch site', (16, 10)),
        ('astronaut-coby.png', 'Coby Cotton \u2014 1st MoonDAO astronaut', (1, 1)),
        ('zero-g-image.jpg', 'Zero-gravity training flight', (16, 10)),
        ('astronaut-eiman.png', 'Dr. Eiman Jahangir \u2014 2nd astronaut', (1, 1)),
    ]
    pw = Inches(2.78)
    ph = Inches(1.6)
    pgap = Inches(0.22)
    total_pw = pw * 4 + pgap * 3
    px0 = (SLIDE_W - total_pw) / 2
    py0 = Inches(5.0)
    for i, (fname, cap, ratio) in enumerate(photos):
        path = I.rounded_rect_mask(fname, ratio, radius_frac=0.06)
        px = px0 + i * (pw + pgap)
        add_picture(s, path, px, py0, pw, ph)
        add_text(s, px, py0 + ph + Inches(0.05), pw, Inches(0.32), cap,
                  size=Pt(9), color=TEXT_GRAY, align=PP_ALIGN.CENTER, font=FONT)

    footer(s, 4, TOTAL_SLIDES)
    return s


# --------------------------------------------------------------------- 05 --
def slide_05():
    s = new_slide()
    set_bg(s, WHITE)
    header(s, "What We Do", "Core Initiatives", 5, LOGO)

    cards = [
        ("Human Spaceflight", "Sent two crowdfunded, community-selected citizens to space via open, onchain voting."),
        ("Fund Space R&D", "$600K+ allocated to 80+ projects through transparent community governance."),
        ("Space Training", "Zero-gravity flights and astronaut-preparation experiences for the community."),
        ("Space Acceleration Network", "An onchain \u201cstartup society\u201d connecting builders, teams, and citizens across the space industry."),
        ("Transparent Governance", "Every proposal, vote, and treasury movement is public and verifiable onchain."),
        ("Lunar Settlement Roadmap", "Constitution, Launchpad, and mission funding building toward a self-governing settlement on the Moon."),
    ]
    cols, rows = 3, 2
    gap = Inches(0.25)
    cw = (SLIDE_W - 2 * MARGIN - gap * (cols - 1)) / cols
    ch = Inches(1.95)
    y0 = Inches(1.75)
    accents = [NAVY, ORANGE, BLUE, RED, NAVY, ORANGE]
    for i, (title, desc) in enumerate(cards):
        r, c = divmod(i, cols)
        cx = MARGIN + c * (cw + gap)
        cy = y0 + r * (ch + gap)
        add_rect(s, cx, cy, cw, ch, fill=WHITE, line=LINE_GRAY, line_w=Pt(1),
                  shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.08, shadow=True)
        add_rect(s, cx, cy, cw, Inches(0.09), fill=accents[i],
                  shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.5)
        add_text(s, cx + Inches(0.25), cy + Inches(0.24), cw - Inches(0.5), Inches(0.55),
                  title, size=Pt(15.5), color=NAVY_DARK, bold=True, font=FONT_HEAD)
        add_text(s, cx + Inches(0.25), cy + Inches(0.78), cw - Inches(0.5), Inches(1.05),
                  desc, size=Pt(11.5), color=TEXT_GRAY, font=FONT)

    footer(s, 5, TOTAL_SLIDES)
    return s


# --------------------------------------------------------------------- 06 --
def slide_06():
    s = new_slide()
    set_bg(s, NAVY_DARK)
    bg = I.darken('earthrise.jpg', factor=0.32, ratio=(SLIDE_W.inches, SLIDE_H.inches))
    add_picture(s, bg, 0, 0, SLIDE_W, SLIDE_H)
    add_rect(s, 0, 0, SLIDE_W, Inches(0.09), fill=ORANGE)

    add_text(s, Inches(1.1), Inches(2.55), Inches(11.1), Inches(0.45),
              "THE NEXT OPPORTUNITY", size=Pt(15), color=ORANGE, bold=True,
              align=PP_ALIGN.CENTER, font=FONT_HEAD)
    add_text(s, Inches(1.1), Inches(3.05), Inches(11.1), Inches(1.5),
              "Go to Space with Frank White", size=Pt(46), color=WHITE, bold=True,
              align=PP_ALIGN.CENTER, font=FONT_HEAD)
    add_text(s, Inches(1.8), Inches(4.15), Inches(9.7), Inches(0.7),
              "Funding a flight for the author of \u201cThe Overview Effect\u201d \u2014 and one "
              "MoonDAO community member \u2014 to finally see Earth from space.",
              size=Pt(15.5), color=RGBColor(0xE6, 0xE9, 0xF5), align=PP_ALIGN.CENTER, font=FONT)

    footer_light(s, 6)
    return s


def footer_light(s, page_no):
    add_text(s, MARGIN, SLIDE_H - Inches(0.42), Inches(8), Inches(0.3),
              "MoonDAO  |  Deep Space and the Lunar Economy  |  2nd Space Industry Workshop Brazil",
              size=Pt(9), color=RGBColor(0xAF, 0xB6, 0xCC), font=FONT)
    add_text(s, SLIDE_W - MARGIN - Inches(1.2), SLIDE_H - Inches(0.42), Inches(1.2), Inches(0.3),
              f"{page_no:02d} / {TOTAL_SLIDES}", size=Pt(9), color=RGBColor(0xAF, 0xB6, 0xCC),
              font=FONT, align=PP_ALIGN.RIGHT)


# --------------------------------------------------------------------- 07 --
def slide_07():
    s = new_slide()
    set_bg(s, WHITE)
    header(s, "The Next Opportunity", "Who Is Frank White", 7, LOGO)

    lx, lw = MARGIN, Inches(3.9)
    badge = I.circle_badge('frank_white_citizen.png', size=700)
    bd = Inches(2.3)
    add_picture(s, badge, lx + (lw - bd) / 2, Inches(1.7), bd, bd)
    add_text(s, lx, Inches(4.15), lw, Inches(0.4), "Frank White", size=Pt(16),
              color=NAVY_DARK, bold=True, align=PP_ALIGN.CENTER, font=FONT_HEAD)
    add_text(s, lx, Inches(4.5), lw, Inches(0.4), "Author, \u201cThe Overview Effect\u201d",
              size=Pt(12), color=TEXT_GRAY, align=PP_ALIGN.CENTER, font=FONT)

    er = I.rounded_rect_mask('earthrise.jpg', (12, 5), radius_frac=0.06)
    er_h = lw * 5 / 12
    add_picture(s, er, lx, Inches(4.95), lw, er_h)
    add_text(s, lx, Inches(4.95) + er_h + Inches(0.04), lw, Inches(0.3),
              "\u201cEarthrise,\u201d Apollo 8, 1968", size=Pt(9), color=TEXT_MUTE,
              align=PP_ALIGN.CENTER, font=FONT)

    rx = Inches(5.15)
    rw = SLIDE_W - MARGIN - rx
    bullets = [
        ("Coined \u201cthe Overview Effect.\u201d ", "His 1987 book \u2014 now in its 4th edition \u2014 named the cognitive shift astronauts describe when they see Earth as one fragile, borderless whole."),
        ("Nearly 40 years of research. ", "Interviewed more than 50 astronauts and cosmonauts about how spaceflight changed the way they see our planet."),
        ("Shaped the industry's language. ", "Co-founded the Overview Institute; his work inspired the documentary \u201cOverview,\u201d viewed nearly 8 million times."),
        ("Has never been to space.", ""),
    ]
    add_bullets(s, rx, Inches(1.75), rw, Inches(3.0), bullets, size=Pt(14.5), gap=Pt(14))

    add_rect(s, rx, Inches(5.15), rw, Inches(1.35), fill=BG_PANEL,
              shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.1)
    add_text(s, rx + Inches(0.3), Inches(5.32), rw - Inches(0.6), Inches(1.02),
              "\u201cAstronauts describe seeing Earth from space as an instant, visceral realization "
              "that we share one planet, one atmosphere, one destiny \u2014 the Overview Effect.\u201d",
              size=Pt(13), color=NAVY_DARK, italic=True, font=FONT)

    footer(s, 7, TOTAL_SLIDES)
    return s


# --------------------------------------------------------------------- 08 --
def slide_08():
    s = new_slide()
    set_bg(s, WHITE)
    header(s, "The Next Opportunity", "Fly to Space with Frank White", 8, LOGO)

    lx, lw = MARGIN, Inches(4.5)
    add_donut_chart(s, lx + Inches(0.55), Inches(1.85), Inches(3.4), Inches(3.0),
                      ["Raised", "Remaining"], [172, 1828],
                      [ORANGE, LINE_GRAY], hole_size=68)
    add_text(s, lx + Inches(0.55), Inches(3.0), Inches(3.4), Inches(0.8), "~9%\nfunded",
              size=Pt(20), color=NAVY_DARK, bold=True, align=PP_ALIGN.CENTER, font=FONT_HEAD)
    add_text(s, lx, Inches(4.95), lw, Inches(0.4), "$172K raised  \u00b7  157 contributors",
              size=Pt(13.5), color=NAVY_DARK, bold=True, align=PP_ALIGN.CENTER, font=FONT_HEAD)
    add_text(s, lx, Inches(5.32), lw, Inches(0.4), "Campaign goal: 965 ETH (\u2248$2M) for two seats",
              size=Pt(11.5), color=TEXT_GRAY, align=PP_ALIGN.CENTER, font=FONT)

    add_rect(s, lx, Inches(5.85), lw, Inches(0.85), fill=BG_PANEL,
              shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.15)
    add_text(s, lx + Inches(0.25), Inches(5.97), lw - Inches(0.5), Inches(0.65),
              "Every dollar raised is held in escrow until a flight is secured \u2014 nothing has been spent.",
              size=Pt(11), color=NAVY_DARK, italic=True, font=FONT)

    rx = Inches(5.35)
    rw = SLIDE_W - MARGIN - rx
    add_text(s, rx, Inches(1.75), rw, Inches(0.5),
              "How the community selects the Candidate", size=Pt(15), color=NAVY_DARK,
              bold=True, font=FONT_HEAD)
    steps = [
        ("Contribute $100+", "Grants free MoonDAO citizenship \u2014 required to enter the selection process."),
        ("Community backing + essay", "Candidates share what the Overview Effect means to them and build public support."),
        ("Astronaut review committee", "Professional and commercial astronauts evaluate the remaining candidates."),
        ("Final governance vote", "MoonDAO's $vMOONEY holders vote to select who flies alongside Frank."),
    ]
    y = Inches(2.35)
    step_h = Inches(0.98)
    for i, (title, desc) in enumerate(steps):
        section_number_badge(s, rx, y, str(i + 1), accent=[NAVY, BLUE, RED, ORANGE][i], d=Inches(0.45))
        add_text(s, rx + Inches(0.62), y - Inches(0.02), rw - Inches(0.62), Inches(0.35),
                  title, size=Pt(13.5), color=NAVY_DARK, bold=True, font=FONT_HEAD)
        add_text(s, rx + Inches(0.62), y + Inches(0.33), rw - Inches(0.62), Inches(0.55),
                  desc, size=Pt(11), color=TEXT_GRAY, font=FONT)
        y += step_h

    footer(s, 8, TOTAL_SLIDES)
    return s


# --------------------------------------------------------------------- 09 --
def slide_09():
    s = new_slide()
    set_bg(s, WHITE)
    header(s, "Funding Innovation", "DePrize: Betting to Fund the Mission", 9, LOGO)

    steps = [
        ("01", "Back a Provider", "Community members wager ETH on which launch provider \u2014 e.g. Virgin Galactic or Zephalto \u2014 will deliver the flight first.", NAVY),
        ("02", "Live, Onchain Odds", "Every bet grows a shared prize pool and produces real-time, transparent odds \u2014 a prediction market for space delivery.", BLUE),
        ("03", "Winner Delivers, Prize Pays Out", "The community declares a winner; the provider is paid in milestones tied to delivery, and backers of the winner are rewarded.", ORANGE),
    ]
    gap = Inches(0.4)
    cw = (SLIDE_W - 2 * MARGIN - gap * 2) / 3
    y0 = Inches(2.0)
    ch = Inches(3.15)
    for i, (num, title, desc, accent) in enumerate(steps):
        cx = MARGIN + i * (cw + gap)
        add_rect(s, cx, y0, cw, ch, fill=BG_LIGHT, line=LINE_GRAY, line_w=Pt(1),
                  shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.07, shadow=True)
        add_rect(s, cx, y0, cw, Inches(0.09), fill=accent, shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.5)
        add_text(s, cx + Inches(0.3), y0 + Inches(0.28), cw - Inches(0.6), Inches(0.7),
                  num, size=Pt(30), color=accent, bold=True, font=FONT_HEAD)
        add_text(s, cx + Inches(0.3), y0 + Inches(0.98), cw - Inches(0.6), Inches(0.75),
                  title, size=Pt(16), color=NAVY_DARK, bold=True, font=FONT_HEAD)
        add_text(s, cx + Inches(0.3), y0 + Inches(1.65), cw - Inches(0.6), Inches(1.35),
                  desc, size=Pt(12), color=TEXT_GRAY, font=FONT)
        if i < 2:
            ax = cx + cw + gap / 2
            arrow = s.shapes.add_shape(MSO_SHAPE.CHEVRON, ax - Inches(0.14), y0 + ch / 2 - Inches(0.14),
                                         Inches(0.28), Inches(0.28))
            arrow.fill.solid()
            arrow.fill.fore_color.rgb = TEXT_MUTE
            arrow.line.fill.background()
            arrow.shadow.inherit = False

    add_rect(s, MARGIN, Inches(5.55), SLIDE_W - 2 * MARGIN, Inches(0.95), fill=BG_PANEL,
              shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.12)
    add_text(s, MARGIN + Inches(0.35), Inches(5.72), SLIDE_W - 2 * MARGIN - Inches(0.7), Inches(0.65),
              "A transparent, market-driven way to fund high-uncertainty space missions \u2014 "
              "turning funding into participation, and every backer into a stakeholder.",
              size=Pt(13), color=NAVY_DARK, italic=True, font=FONT)

    footer(s, 9, TOTAL_SLIDES)
    return s


# --------------------------------------------------------------------- 10 --
def slide_10():
    s = new_slide()
    set_bg(s, WHITE)
    header(s, "Funding Innovation", "Mapping (and Wagering on) the Lunar Economy", 10, LOGO,
            title_size=Pt(26))

    rx = Inches(9.1)
    rw = SLIDE_W - MARGIN - rx
    moon = I.rounded_rect_mask('moon-full.jpg', (1, 1), radius_frac=0.06)
    add_picture(s, moon, rx, Inches(1.85), rw, rw)
    badge_w = Inches(2.1)
    add_rect(s, rx + (rw - badge_w) / 2, Inches(1.85) + rw - Inches(0.35), badge_w, Inches(0.5),
              fill=ORANGE, shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.5, shadow=True)
    add_text(s, rx + (rw - badge_w) / 2, Inches(1.85) + rw - Inches(0.35), badge_w, Inches(0.5),
              "IN DEVELOPMENT", size=Pt(10.5), color=WHITE, bold=True, align=PP_ALIGN.CENTER,
              font=FONT_HEAD, anchor=MSO_ANCHOR.MIDDLE)

    lx = MARGIN
    lw = rx - MARGIN - Inches(0.4)
    add_text(s, lx, Inches(1.7), lw, Inches(0.75),
              "\u201cLunar Atlas\u201d \u2014 an interactive, MoonDAO-curated globe",
              size=Pt(16), color=NAVY_DARK, bold=True, font=FONT_HEAD)
    bullets = [
        ("Real, sourced plans. ", "Visualizes publicly announced lunar programs from NASA, SpaceX, Blue Origin and others, placed at their intended locations."),
        ("A timeline of the coming decade. ", "A year-by-year scrubber reveals planned bases, landers, and infrastructure as their target dates arrive."),
        ("Shared goals, surfaced. ", "Where multiple organizations chase the same objective \u2014 e.g. the first sustained south-pole base \u2014 it becomes a tracked \u201cshared goal.\u201d"),
        ("Linked to DePrize. ", "Each shared goal can connect to a DePrize market, so the community can back who they believe will deliver first."),
    ]
    add_bullets(s, lx, Inches(2.55), lw, Inches(3.9), bullets, size=Pt(14), gap=Pt(13))

    footer(s, 10, TOTAL_SLIDES)
    return s


# --------------------------------------------------------------------- 11 --
def slide_11():
    s = new_slide()
    set_bg(s, WHITE)
    header(s, "The Bigger Picture", "A Level Playing Field for the Next Space Age", 11, LOGO,
            title_size=Pt(27))

    add_text(s, MARGIN, Inches(1.7), Inches(12.2), Inches(0.85),
              "For most of history, deep-space activity has been the domain of a handful of "
              "national agencies \u2014 and, more recently, a handful of billionaires.",
              size=Pt(16.5), color=NAVY_DARK, font=FONT)

    bullets = [
        ("Permissionless participation. ", "Decentralized, onchain tools mean any country, company, university, or individual can fund, compete in, and benefit from lunar-economy activity \u2014 not just legacy space powers."),
        ("Already global. ", "The Space Acceleration Network connects citizens across 25+ countries with the funding, tools, and visibility to build \u2014 including a growing community in Latin America."),
        ("An open invitation. ", "To Brazil's space ecosystem \u2014 AEB, GRU, universities, and industry \u2014 to plug into a transparent, global network built for exactly the next phase of space development this panel is about."),
    ]
    add_bullets(s, MARGIN, Inches(2.75), Inches(12.2), Inches(2.6), bullets, size=Pt(15.5), gap=Pt(16))

    stats = [
        ("25+", "Countries in the\nSpace Acceleration Network"),
        ("12,000+", "$MOONEY\ntoken holders worldwide"),
        ("100%", "Onchain, transparent\nvotes & treasury"),
    ]
    card_w = Inches(3.7)
    gap = Inches(0.35)
    total_w = card_w * 3 + gap * 2
    x0 = (SLIDE_W - total_w) / 2
    y0 = Inches(5.65)
    ch = Inches(1.2)
    for i, (num, label) in enumerate(stats):
        cx = x0 + i * (card_w + gap)
        stat_card(s, cx, y0, card_w, ch, num, label, accent=[NAVY, ORANGE, RED][i])

    footer(s, 11, TOTAL_SLIDES)
    return s


# --------------------------------------------------------------------- 12 --
def slide_12():
    s = new_slide()
    set_bg(s, NAVY_DARK)
    panel_img = I.darken('earthrise.jpg', factor=0.28, ratio=(SLIDE_W.inches, SLIDE_H.inches))
    add_picture(s, panel_img, 0, 0, SLIDE_W, SLIDE_H)
    add_rect(s, 0, 0, SLIDE_W, Inches(0.09), fill=ORANGE)

    WHITE_MARK = os.path.join(ASSETS, 'moondao_mark_white.png')
    lockup_h = Inches(0.62)
    lockup_w = lockup_h * (620 / 650) + Inches(0.12) + Inches(1.55)
    logo_lockup_white(s, WHITE_MARK, (SLIDE_W - lockup_w) / 2, Inches(0.8), lockup_h)

    add_text(s, Inches(1.2), Inches(1.75), Inches(10.9), Inches(0.9),
              "Let's Build the Lunar Economy Together", size=Pt(34), color=WHITE, bold=True,
              align=PP_ALIGN.CENTER, font=FONT_HEAD)

    badge = I.circle_badge('pablo_headshot.png', size=500, border_color=(255, 255, 255, 255), border_px=10)
    bd = Inches(1.5)
    add_picture(s, badge, (SLIDE_W - bd) / 2, Inches(2.95), bd, bd)
    add_text(s, Inches(1.2), Inches(4.6), Inches(10.9), Inches(0.4),
              "Pablo Moncada-Larrotiz  \u00b7  Founder & Executive Director, MoonDAO",
              size=Pt(14.5), color=WHITE, align=PP_ALIGN.CENTER, font=FONT_HEAD)
    add_text(s, Inches(1.2), Inches(5.05), Inches(10.9), Inches(0.4),
              "pablo@moondao.com   \u00b7   @pablo_moncada_", size=Pt(13),
              color=RGBColor(0xCB, 0xD1, 0xE6), align=PP_ALIGN.CENTER, font=FONT)

    add_line(s, Inches(4.5), Inches(5.75), Inches(4.33), 0, color=RGBColor(0x3A, 0x44, 0x70), weight=Pt(1))

    ctas = ["moondao.com", "Become a Citizen  \u2192  moondao.com/join", "Join the Discord  \u2192  discord.gg/moondao"]
    add_text(s, Inches(1.2), Inches(6.0), Inches(10.9), Inches(0.5),
              "   \u00b7   ".join(ctas), size=Pt(13), color=ORANGE_LT, bold=True,
              align=PP_ALIGN.CENTER, font=FONT_HEAD)

    footer_light(s, 12)
    return s


# -------------------------------------------------------- speaker notes --
# Target: ~8 minutes total (the panel's suggested opening-remarks slot).
NOTES = {
    1: "[~20s] Quick intro — who you are and why MoonDAO is on this panel. Don't linger, the "
       "content does the introducing.",
    2: "[~30s] One or two sentences max — the room can read the bullets. Land on the ConstitutionDAO "
       "line, it's the most relatable proof point for a non-crypto audience.",
    3: "[~40s] Define MoonDAO in one breath before the stats: an onchain community funding and "
       "governing space access. Let the four numbers do the heavy lifting.",
    4: "[~45s] Walk left to right once, quickly. Slow down only on 2022 (first astronaut) and "
       "2025 (constitution on the Moon) — those are the two moments that make people lean in.",
    5: "[~40s] Don't read every card. Group them verbally: 'flight access, funding, training, "
       "network, governance, and the roadmap that ties it together.'",
    6: "[~10s] Let this breathe — pause on the title before moving to Frank White. This is the "
       "pivot from 'here's who we are' to 'here's the live opportunity.'",
    7: "[~45s] Frank is the emotional core of this section — 40 years, 50+ astronauts, coined the "
       "term, and has never flown himself. That irony is the hook.",
    8: "[~50s] Lead with the honesty of the escrow note — nothing has been spent. Then walk the "
       "4-step selection process; it's the part of the story that shows this is merit-based, "
       "not pay-to-win.",
    9: "[~50s] This is the funding-innovation section — frame DePrize as a new financing primitive "
       "for uncertain missions, not just 'crypto betting.' Emphasize transparency and shared upside.",
    10: "[~45s] Be clear this is in development — it's the vision for how MoonDAO visualizes and "
        "eventually helps fund the entire lunar economy, not just one mission.",
    11: "[~45s] This is the slide that answers the panel's brief directly — bring it back to Brazil, "
        "AEB, and GRU explicitly if the moderator hasn't already framed it.",
    12: "[~15s] Contact info stays up during Q&A. Invite people to find you afterward per the "
        "organizer's networking guidance.",
}


# ------------------------------------------------------------------ build --
for i, fn in enumerate([slide_01, slide_02, slide_03, slide_04, slide_05, slide_06,
                          slide_07, slide_08, slide_09, slide_10, slide_11, slide_12], start=1):
    slide = fn()
    note = NOTES.get(i)
    if note:
        slide.notes_slide.notes_text_frame.text = note

out_path = os.path.join(DIST, 'MoonDAO_Rio_Innovation_Week.pptx')
prs.save(out_path)
print('Saved:', out_path)
