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
    add_qr_frame,
)

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, '..', 'assets'))
DIST = os.path.normpath(os.path.join(HERE, '..', 'dist'))
os.makedirs(DIST, exist_ok=True)

LOGO = os.path.join(ASSETS, 'MoonDAO_icon.png')
QR = os.path.join(ASSETS, 'qr')
LB = os.path.join(ASSETS, 'leaderboard')
TOTAL_SLIDES = 13

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
        ("Founder of MoonDAO. ", "First elected Executive Lead, since 2021."),
        ("Career: Waymo, YouTube, STEL. ", "Software engineer at Google, then biotech."),
        ("Core contributor, ConstitutionDAO. ", "Helped raise $47M in days for the U.S. Constitution."),
        ("University of Michigan. ", "CS, Mechanical Engineering & Business."),
    ]
    add_bullets(s, rx, Inches(1.85), rw, Inches(3.3), bullets, size=Pt(15.5), gap=Pt(18))

    add_rect(s, rx, Inches(5.85), rw, Inches(0.95), fill=BG_PANEL,
              shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.12)
    add_text(s, rx + Inches(0.28), Inches(5.98), rw - Inches(0.56), Inches(0.75),
              "\u201cI see decentralization as a way to fix the risks of centralized "
              "control over billions of people's lives.\u201d",
              size=Pt(13), color=NAVY_DARK, italic=True, font=FONT)

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
        ("Decentralized. ", "Governed onchain via the $MOONEY token."),
        ("Global & permissionless. ", "Anyone, anywhere can join, fund, or build."),
        ("Radically transparent. ", "Every vote and dollar is public onchain."),
    ]
    add_bullets(s, MARGIN, Inches(3.6), Inches(12.2), Inches(1.6), bullets, size=Pt(15.5), gap=Pt(12))

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

    # Each photo keeps its own native aspect ratio at a shared height, rather
    # than being forced into identical boxes (which stretched the square
    # astronaut portraits horizontally).
    photos = [
        ('MoonDAO-New-Shepard.jpg', 'Team at Blue Origin\u2019s launch site', (16, 10)),
        ('astronaut-coby.png', 'Coby Cotton \u2014 1st MoonDAO astronaut', (1, 1)),
        ('zero-g-image.jpg', 'Zero-gravity training flight', (16, 10)),
        ('astronaut-eiman.png', 'Dr. Eiman Jahangir \u2014 2nd astronaut', (1, 1)),
    ]
    ph = Inches(1.6)
    pgap = Inches(0.28)
    widths = [Emu(int(ph * rw_ / rh_)) for (_, _, (rw_, rh_)) in photos]
    total_pw = sum(widths, Emu(0)) + pgap * (len(photos) - 1)
    px0 = Emu(int((SLIDE_W - total_pw) / 2))
    py0 = Inches(5.0)
    px = px0
    for i, (fname, cap, ratio) in enumerate(photos):
        path = I.rounded_rect_mask(fname, ratio, radius_frac=0.06)
        pw_i = widths[i]
        add_picture(s, path, px, py0, pw_i, ph)
        add_text(s, px - Inches(0.2), py0 + ph + Inches(0.05), pw_i + Inches(0.4), Inches(0.32), cap,
                  size=Pt(9), color=TEXT_GRAY, align=PP_ALIGN.CENTER, font=FONT)
        px = Emu(int(px + pw_i + pgap))

    footer(s, 4, TOTAL_SLIDES)
    return s


# --------------------------------------------------------------------- 05 --
def slide_05():
    s = new_slide()
    set_bg(s, WHITE)
    header(s, "What We Do", "Core Initiatives", 5, LOGO)

    cards = [
        ("Human Spaceflight", "Two crowdfunded citizens sent to space by onchain vote."),
        ("Fund Space R&D", "$600K+ allocated to 80+ projects via open governance."),
        ("Space Training", "Zero-gravity flights and astronaut-prep experiences."),
        ("Space Acceleration Network", "An onchain \u201cstartup society\u201d for the space industry."),
        ("Transparent Governance", "Every vote and treasury move, public onchain."),
        ("Lunar Settlement Roadmap", "Constitution, Launchpad, and missions \u2014 building toward the Moon."),
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
        ("Coined \u201cthe Overview Effect.\u201d ", "The name for the shift astronauts feel seeing Earth from space."),
        ("40 years of research. ", "Interviewed 50+ astronauts and cosmonauts."),
        ("Shaped the industry. ", "Co-founded the Overview Institute; inspired a documentary."),
        ("Has never been to space.", ""),
    ]
    add_bullets(s, rx, Inches(1.85), rw, Inches(3.0), bullets, size=Pt(16), gap=Pt(18))

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

    lx, lw = MARGIN, Inches(6.3)
    raised, goal = 172, 250
    pct = round(raised / goal * 100)
    add_donut_chart(s, lx + Inches(1.0), Inches(2.0), Inches(3.6), Inches(3.2),
                      ["Raised", "Remaining"], [raised, goal - raised],
                      [ORANGE, LINE_GRAY], hole_size=68)
    add_text(s, lx + Inches(1.0), Inches(3.15), Inches(3.6), Inches(0.9), f"{pct}%\nfunded",
              size=Pt(22), color=NAVY_DARK, bold=True, align=PP_ALIGN.CENTER, font=FONT_HEAD)
    add_text(s, lx, Inches(5.35), lw, Inches(0.45), f"${raised}K of ${goal}K",
              size=Pt(18), color=NAVY_DARK, bold=True, align=PP_ALIGN.CENTER, font=FONT_HEAD)
    add_text(s, lx, Inches(5.82), lw, Inches(0.4), "157 contributors \u2014 goal secures a seat",
              size=Pt(12.5), color=TEXT_GRAY, align=PP_ALIGN.CENTER, font=FONT)

    # QR — scan to support Frank and enter the selection process.
    rx = Inches(7.9)
    qr_size = Inches(2.15)
    qr_path = os.path.join(QR, 'qr_support_frank.png')
    fw, fh = add_qr_frame(s, qr_path, rx, Inches(2.15), qr_size)
    add_text(s, rx - Inches(0.3), Inches(2.15) + fh + Inches(0.16), fw + Inches(0.6), Inches(0.4),
              "Scan to Support Frank", size=Pt(14), color=NAVY_DARK, bold=True,
              align=PP_ALIGN.CENTER, font=FONT_HEAD)
    add_text(s, rx - Inches(0.3), Inches(2.15) + fh + Inches(0.56), fw + Inches(0.6), Inches(0.3),
              "moondao.com/mission/4", size=Pt(10.5), color=TEXT_MUTE,
              align=PP_ALIGN.CENTER, font=FONT)

    add_rect(s, MARGIN, Inches(6.35), SLIDE_W - 2 * MARGIN, Inches(0.55), fill=BG_PANEL,
              shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.2)
    add_text(s, MARGIN + Inches(0.35), Inches(6.35), SLIDE_W - 2 * MARGIN - Inches(0.7), Inches(0.55),
              "$100+ grants free citizenship \u2014 and a shot at flying alongside Frank.",
              size=Pt(12.5), color=NAVY_DARK, italic=True, font=FONT, anchor=MSO_ANCHOR.MIDDLE)

    footer(s, 8, TOTAL_SLIDES)
    return s


# --------------------------------------------------------------------- 09 --
def slide_09():
    s = new_slide()
    set_bg(s, WHITE)
    header(s, "The Next Opportunity", "Fly with Frank \u2014 Leaderboard", 9, LOGO)

    add_text(s, MARGIN, Inches(1.55), Inches(7.5), Inches(0.4),
              "Top 25 $OVERVIEW backers advance to Round 2",
              size=Pt(14.5), color=NAVY_DARK, bold=True, font=FONT_HEAD)

    leaderboard = [
        (1, 'Andrew "Titan" Parris', 2083, 6, os.path.join(LB, 'citizen_7_parris.png')),
        (2, 'Citizen #180', 680, 1, None),
        (3, 'Jas', 652, 5, os.path.join(LB, 'citizen_184_jas.png')),
        (4, 'austin3wilson', 614, 2, os.path.join(LB, 'citizen_55_austin.png')),
        (5, 'Anastasia Stepanova', 541, 3, os.path.join(LB, 'citizen_9_anastasia.png')),
    ]
    max_amt = leaderboard[0][2]
    lx = MARGIN
    lw = Inches(7.3)
    ry = Inches(2.15)
    row_h = Inches(0.82)
    for rank, name, amt, backers, photo in leaderboard:
        add_text(s, lx, ry + Inches(0.12), Inches(0.4), Inches(0.4), f"{rank}",
                  size=Pt(16), color=TEXT_MUTE, bold=True, font=FONT_HEAD)
        pd = Inches(0.56)
        py_ = ry + Inches(0.06)
        if photo:
            badge = I.circle_badge(os.path.relpath(photo, ASSETS), size=300)
            add_picture(s, badge, lx + Inches(0.45), py_, pd, pd)
        else:
            add_rect(s, lx + Inches(0.45), py_, pd, pd, fill=BG_PANEL,
                      shape_type=MSO_SHAPE.OVAL)
        add_text(s, lx + Inches(1.15), ry + Inches(0.02), Inches(2.7), Inches(0.3),
                  name, size=Pt(13), color=NAVY_DARK, bold=True, font=FONT_HEAD)
        bar_w = Inches(2.7)
        bar_max = lw - Inches(1.15) - Inches(1.5)
        bfill = Emu(int(bar_max * (amt / max_amt)))
        add_rect(s, lx + Inches(1.15), ry + Inches(0.36), bar_max, Inches(0.14), fill=BG_PANEL,
                  shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.5)
        add_rect(s, lx + Inches(1.15), ry + Inches(0.36), bfill, Inches(0.14),
                  fill=[ORANGE, NAVY, BLUE, RED, NAVY][rank - 1], shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.5)
        add_text(s, lx + lw - Inches(1.5), ry - Inches(0.02), Inches(1.5), Inches(0.3),
                  f"{amt:,} $OVERVIEW", size=Pt(11), color=NAVY_DARK, bold=True,
                  align=PP_ALIGN.RIGHT, font=FONT_HEAD)
        add_text(s, lx + lw - Inches(1.5), ry + Inches(0.53), Inches(1.5), Inches(0.24),
                  f"{backers} backer{'s' if backers != 1 else ''}", size=Pt(9.5), color=TEXT_MUTE,
                  align=PP_ALIGN.RIGHT, font=FONT)
        ry += row_h

    add_text(s, lx, ry + Inches(0.05), lw, Inches(0.4),
              "Any Citizen can enter \u2014 rally backers to climb the board.",
              size=Pt(11), color=TEXT_MUTE, italic=True, font=FONT)

    # QR — view the live leaderboard and back a candidate.
    rx = Inches(9.55)
    qr_size = Inches(2.0)
    qr_path = os.path.join(QR, 'qr_leaderboard.png')
    fw, fh = add_qr_frame(s, qr_path, rx, Inches(2.3), qr_size)
    add_text(s, rx - Inches(0.3), Inches(2.3) + fh + Inches(0.16), fw + Inches(0.6), Inches(0.4),
              "Back a Candidate", size=Pt(13.5), color=NAVY_DARK, bold=True,
              align=PP_ALIGN.CENTER, font=FONT_HEAD)
    add_text(s, rx - Inches(0.3), Inches(2.3) + fh + Inches(0.55), fw + Inches(0.6), Inches(0.3),
              "moondao.com/overview-vote", size=Pt(10), color=TEXT_MUTE,
              align=PP_ALIGN.CENTER, font=FONT)

    footer(s, 9, TOTAL_SLIDES)
    return s


# --------------------------------------------------------------------- 10 --
def slide_10():
    s = new_slide()
    set_bg(s, WHITE)
    header(s, "Funding Innovation", "DePrize: Betting to Fund the Mission", 10, LOGO)

    # Mechanism — three short steps, icons over paragraphs.
    steps = [
        ("01", "Back a Team", NAVY),
        ("02", "Live Odds", BLUE),
        ("03", "Winner Delivers", ORANGE),
    ]
    gap = Inches(0.35)
    cw = (SLIDE_W - 2 * MARGIN - gap * 2) / 3
    y0 = Inches(1.55)
    ch = Inches(1.15)
    for i, (num, title, accent) in enumerate(steps):
        cx = MARGIN + i * (cw + gap)
        add_rect(s, cx, y0, cw, ch, fill=BG_LIGHT, line=LINE_GRAY, line_w=Pt(1),
                  shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.12, shadow=True)
        section_number_badge(s, cx + Inches(0.22), y0 + Inches(0.3), num[-1], accent=accent, d=Inches(0.55))
        add_text(s, cx + Inches(0.95), y0, cw - Inches(1.1), ch, title,
                  size=Pt(15.5), color=NAVY_DARK, bold=True, font=FONT_HEAD, anchor=MSO_ANCHOR.MIDDLE)
        if i < 2:
            ax = cx + cw + gap / 2
            arrow = s.shapes.add_shape(MSO_SHAPE.CHEVRON, ax - Inches(0.13), y0 + ch / 2 - Inches(0.13),
                                         Inches(0.26), Inches(0.26))
            arrow.fill.solid()
            arrow.fill.fore_color.rgb = TEXT_MUTE
            arrow.line.fill.background()
            arrow.shadow.inherit = False
    add_text(s, MARGIN, y0 + ch + Inches(0.12), SLIDE_W - 2 * MARGIN, Inches(0.3),
              "Bet on a provider \u2192 odds update live, growing the prize \u2192 the community pays out the winner.",
              size=Pt(11), color=TEXT_GRAY, italic=True, align=PP_ALIGN.CENTER, font=FONT)

    # A real race the mechanism could apply to — pulled from Moonbase Zero.
    my0 = Inches(3.35)
    mh = Inches(3.25)
    add_rect(s, MARGIN, my0, SLIDE_W - 2 * MARGIN, mh, fill=NAVY_DARK,
              shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.05, shadow=True)
    pad = Inches(0.4)
    lcw = Inches(4.6)
    add_text(s, MARGIN + pad, my0 + Inches(0.32), lcw, Inches(0.3),
              "A REAL RACE ON MOONBASE ZERO", size=Pt(10.5), color=ORANGE_LT, bold=True, font=FONT_HEAD)
    add_text(s, MARGIN + pad, my0 + Inches(0.68), lcw, Inches(0.9),
              "First Fission Power\non the Moon", size=Pt(21), color=WHITE, bold=True, font=FONT_HEAD)
    add_text(s, MARGIN + pad, my0 + Inches(1.68), lcw, Inches(0.5),
              "354-hour lunar night", size=Pt(28), color=ORANGE, bold=True, font=FONT_HEAD)
    add_text(s, MARGIN + pad, my0 + Inches(2.22), lcw, Inches(0.75),
              "No sunlight for two straight weeks \u2014 the reason NASA is funding three "
              "competing reactors instead of solar panels.",
              size=Pt(11), color=RGBColor(0xC7, 0xCC, 0xE4), font=FONT)

    rcx = MARGIN + pad + lcw + Inches(0.4)
    rcw = SLIDE_W - MARGIN - pad - rcx
    add_text(s, rcx, my0 + Inches(0.32), rcw, Inches(0.3),
              "WHO'S LEADING", size=Pt(10.5), color=ORANGE_LT, bold=True, font=FONT_HEAD)
    competitors = [
        ("Lockheed Martin", 0.35, ORANGE),
        ("Westinghouse", 0.34, RGBColor(0xE8, 0xC4, 0x5A)),
        ("Intuitive Machines", 0.31, RGBColor(0xE0, 0x6B, 0x3A)),
    ]
    cy = my0 + Inches(0.78)
    for name, pct, color in competitors:
        add_text(s, rcx, cy, rcw - Inches(0.6), Inches(0.28),
                  name, size=Pt(13), color=WHITE, bold=True, font=FONT_HEAD)
        add_text(s, rcx + rcw - Inches(0.6), cy, Inches(0.6), Inches(0.28),
                  f"{int(pct*100)}%", size=Pt(13), color=color, bold=True, align=PP_ALIGN.RIGHT, font=FONT_HEAD)
        bar_y = cy + Inches(0.32)
        add_rect(s, rcx, bar_y, rcw, Inches(0.12), fill=RGBColor(0x2E, 0x37, 0x5C),
                  shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.5)
        add_rect(s, rcx, bar_y, Emu(int(rcw * pct)), Inches(0.12), fill=color,
                  shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.5)
        cy += Inches(0.72)
    add_text(s, rcx, cy + Inches(0.08), rcw, Inches(0.3),
              "Curator priors \u2014 live odds once the market opens.", size=Pt(8.5),
              color=RGBColor(0x8A, 0x90, 0xB0), italic=True, font=FONT)

    footer(s, 10, TOTAL_SLIDES)
    return s


# --------------------------------------------------------------------- 11 --
def slide_11():
    s = new_slide()
    set_bg(s, NAVY_DARK)

    bg = I.darken('moonbase_zero_render.png', factor=0.62, ratio=(SLIDE_W.inches, SLIDE_H.inches))
    add_picture(s, bg, 0, 0, SLIDE_W, SLIDE_H)
    add_rect(s, 0, 0, SLIDE_W, Inches(0.09), fill=ORANGE)

    # Top-left HUD card — mirrors the real in-app overlay copy.
    card_w = Inches(4.5)
    add_rect(s, Inches(0.5), Inches(0.5), card_w, Inches(1.35), fill=RGBColor(0x08, 0x0A, 0x16),
              shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.12)
    add_text(s, Inches(0.75), Inches(0.66), card_w - Inches(0.5), Inches(0.35),
              "MOONBASE ZERO", size=Pt(14), color=WHITE, bold=True, font=FONT_HEAD)
    add_text(s, Inches(0.75), Inches(1.02), card_w - Inches(0.5), Inches(0.72),
              "A true-to-scale base on the Shackleton ridge \u2014 every serious "
              "program is racing here.",
              size=Pt(10.5), color=RGBColor(0xC7, 0xCC, 0xE4), font=FONT)

    # Right HUD card — the real capability-race board.
    rw = Inches(3.85)
    rx = SLIDE_W - Inches(0.5) - rw
    races = [
        ("Comms / PNT", "Nokia Bell Labs"),
        ("Surface construction", "ICON"),
        ("Habitat", "Thales Alenia Space"),
        ("ISRU plant", "Blue Origin"),
        ("Power", "Lockheed Martin"),
        ("Rover", "Intuitive Machines"),
        ("Crewed base", "NASA"),
        ("Lander", "SpaceX"),
    ]
    row_h = Inches(0.44)
    rh = Inches(0.55) + row_h * len(races) + Inches(0.15)
    add_rect(s, rx, Inches(0.5), rw, rh, fill=RGBColor(0x08, 0x0A, 0x16),
              shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.08)
    add_text(s, rx + Inches(0.28), Inches(0.64), rw - Inches(0.56), Inches(0.3),
              "CAPABILITY RACES", size=Pt(10.5), color=ORANGE_LT, bold=True, font=FONT_HEAD)
    ry = Inches(1.05)
    colors = [NAVY, ORANGE, BLUE, RED, NAVY, ORANGE, BLUE, RED]
    for i, (name, leader) in enumerate(races):
        dot = Inches(0.08)
        dot_shp = s.shapes.add_shape(MSO_SHAPE.OVAL, rx + Inches(0.28), ry + Inches(0.08), dot, dot)
        dot_shp.fill.solid()
        dot_shp.fill.fore_color.rgb = colors[i]
        dot_shp.line.fill.background()
        dot_shp.shadow.inherit = False
        add_text(s, rx + Inches(0.46), ry, rw - Inches(0.7), Inches(0.24),
                  name, size=Pt(10.5), color=WHITE, bold=True, font=FONT_HEAD)
        add_text(s, rx + Inches(0.46), ry + Inches(0.21), rw - Inches(0.7), Inches(0.2),
                  leader, size=Pt(8.5), color=RGBColor(0x9A, 0xA1, 0xBF), font=FONT)
        ry += row_h

    # Bottom badge.
    badge_w = Inches(2.0)
    add_rect(s, Inches(0.5), SLIDE_H - Inches(1.0), badge_w, Inches(0.42),
              fill=ORANGE, shape_type=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.5)
    add_text(s, Inches(0.5), SLIDE_H - Inches(1.0), badge_w, Inches(0.42),
              "IN DEVELOPMENT", size=Pt(10), color=WHITE, bold=True, align=PP_ALIGN.CENTER,
              font=FONT_HEAD, anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, Inches(0.5) + badge_w + Inches(0.2), SLIDE_H - Inches(1.0), Inches(3), Inches(0.42),
              "moondao.com/moonbase", size=Pt(10.5), color=RGBColor(0xC7, 0xCC, 0xE4), font=FONT,
              anchor=MSO_ANCHOR.MIDDLE)

    footer_light(s, 11)
    return s


# --------------------------------------------------------------------- 12 --
def slide_12():
    s = new_slide()
    set_bg(s, WHITE)
    header(s, "The Bigger Picture", "A Level Playing Field for the Next Space Age", 12, LOGO,
            title_size=Pt(27))

    add_text(s, MARGIN, Inches(1.7), Inches(12.2), Inches(0.65),
              "Deep space used to require a national agency \u2014 or a billionaire.",
              size=Pt(18), color=NAVY_DARK, bold=True, font=FONT_HEAD)

    bullets = [
        ("Permissionless. ", "Any country, company, or individual can fund and compete."),
        ("Already global. ", "25+ countries in the Space Acceleration Network."),
        ("An open invitation. ", "To Brazil's AEB, GRU, and space ecosystem \u2014 join in."),
    ]
    add_bullets(s, MARGIN, Inches(2.6), Inches(12.2), Inches(2.6), bullets, size=Pt(17), gap=Pt(20))

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

    footer(s, 12, TOTAL_SLIDES)
    return s


# --------------------------------------------------------------------- 13 --
def slide_13():
    s = new_slide()
    set_bg(s, NAVY_DARK)
    panel_img = I.darken('earthrise.jpg', factor=0.28, ratio=(SLIDE_W.inches, SLIDE_H.inches))
    add_picture(s, panel_img, 0, 0, SLIDE_W, SLIDE_H)
    add_rect(s, 0, 0, SLIDE_W, Inches(0.09), fill=ORANGE)

    WHITE_MARK = os.path.join(ASSETS, 'moondao_mark_white.png')
    lockup_h = Inches(0.62)
    lockup_w = lockup_h * (620 / 650) + Inches(0.12) + Inches(1.55)
    logo_lockup_white(s, WHITE_MARK, (SLIDE_W - lockup_w) / 2, Inches(0.8), lockup_h)

    add_text(s, Inches(1.2), Inches(1.65), Inches(10.9), Inches(0.7),
              "Let's Build the Lunar Economy Together", size=Pt(30), color=WHITE, bold=True,
              align=PP_ALIGN.CENTER, font=FONT_HEAD)

    # Left: speaker. Right: QR to join.
    badge = I.circle_badge('pablo_headshot.png', size=500, border_color=(255, 255, 255, 255), border_px=10)
    bd = Inches(1.4)
    lcx = Inches(3.7)
    add_picture(s, badge, lcx - bd / 2, Inches(2.75), bd, bd)
    add_text(s, lcx - Inches(2.5), Inches(4.35), Inches(5), Inches(0.4),
              "Pablo Moncada-Larrotiz", size=Pt(15), color=WHITE, bold=True,
              align=PP_ALIGN.CENTER, font=FONT_HEAD)
    add_text(s, lcx - Inches(2.5), Inches(4.72), Inches(5), Inches(0.35),
              "Founder & Executive Director, MoonDAO", size=Pt(11.5),
              color=RGBColor(0xCB, 0xD1, 0xE6), align=PP_ALIGN.CENTER, font=FONT)
    add_text(s, lcx - Inches(2.5), Inches(5.1), Inches(5), Inches(0.35),
              "pablo@moondao.com   \u00b7   @pablo_moncada_", size=Pt(11.5),
              color=RGBColor(0xCB, 0xD1, 0xE6), align=PP_ALIGN.CENTER, font=FONT)

    add_line(s, Inches(6.9), Inches(2.8), 0, Inches(2.85), color=RGBColor(0x3A, 0x44, 0x70), weight=Pt(1))

    qr_size = Inches(1.75)
    qr_path = os.path.join(QR, 'qr_join_moondao.png')
    qcx = Inches(9.6)
    fw, fh = add_qr_frame(s, qr_path, qcx - qr_size / 2 - Inches(0.16), Inches(2.75), qr_size,
                            frame_fill=WHITE, line=WHITE)
    add_text(s, qcx - Inches(1.7), Inches(2.75) + fh + Inches(0.14), Inches(3.4), Inches(0.35),
              "Scan to Join MoonDAO", size=Pt(13.5), color=WHITE, bold=True,
              align=PP_ALIGN.CENTER, font=FONT_HEAD)
    add_text(s, qcx - Inches(1.7), Inches(2.75) + fh + Inches(0.5), Inches(3.4), Inches(0.3),
              "moondao.com/join", size=Pt(10.5), color=RGBColor(0xCB, 0xD1, 0xE6),
              align=PP_ALIGN.CENTER, font=FONT)

    ctas = ["moondao.com", "Discord: moondao.com/discord"]
    add_text(s, Inches(1.2), Inches(6.55), Inches(10.9), Inches(0.4),
              "   \u00b7   ".join(ctas), size=Pt(12.5), color=ORANGE_LT, bold=True,
              align=PP_ALIGN.CENTER, font=FONT_HEAD)

    footer_light(s, 13)
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
    8: "[~30s] Point at the QR code directly — invite the room to scan right now while you talk. "
       "$100+ gets citizenship and a shot at flying.",
    9: "[~40s] These are real, live candidates — say so explicitly. Point out anyone can enter and "
       "climb the board with community backing. QR code lets people back a candidate on the spot.",
    10: "[~45s] Walk the 3-step mechanism fast, then spend the time on the real fission-power race — "
        "354-hour lunar night is the number that lands. It shows MoonDAO understands the engineering, "
        "not just the funding mechanics.",
    11: "[~35s] Name it clearly as Moonbase Zero, in development — a true-to-scale site model with a "
        "real, sourced capability-race board. Let the visual do the work.",
    12: "[~40s] This is the slide that answers the panel's brief directly — bring it back to Brazil, "
        "AEB, and GRU explicitly if the moderator hasn't already framed it.",
    13: "[~20s] Point at the QR code — invite people to scan and join MoonDAO before you leave the "
        "stage. Contact info stays up during Q&A.",
}


# ------------------------------------------------------------------ build --
for i, fn in enumerate([slide_01, slide_02, slide_03, slide_04, slide_05, slide_06,
                          slide_07, slide_08, slide_09, slide_10, slide_11, slide_12,
                          slide_13], start=1):
    slide = fn()
    note = NOTES.get(i)
    if note:
        slide.notes_slide.notes_text_frame.text = note

out_path = os.path.join(DIST, 'MoonDAO_Rio_Innovation_Week.pptx')
prs.save(out_path)
print('Saved:', out_path)
