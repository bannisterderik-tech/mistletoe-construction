#!/usr/bin/env python3
"""
Render the realtor educational email series as a stylized, on-brand PDF —
same design language as the social graphics (Edmund display, Mulish body,
evergreen + brand green + parchment). Cover + cadence timeline + one page per email.
Usage: python3 tools/email_series_pdf.py
"""
import os, sys
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from social_render import (edmund, mulish, wrap, display_safe, check_bullet,
                           PINE950, PINE900, PINE800, GREEN, GREEN_B, GREEN_L,
                           PARCH, CREAM, MIST, INK, INK_SOFT, SAGE, WHITE,
                           LOGO_WHITE, LOGO_BADGE, ROOT)

PW, PH = 1700, 2200            # letter @ ~200dpi
M = 120
OUT = os.path.join(ROOT, "emails", "Mistletoe-Realtor-Email-Series.pdf")

# progressively-spaced send cadence (days from partnership start)
DAYS = [0, 4, 9, 15, 22, 31, 42, 56, 74, 96, 124, 160, 205, 260]

EMAILS = [
    {"subject": "A roofer your Douglas County deals can actually count on",
     "angle": "Introduce a licensed, fast-moving roofer who protects your closings.",
     "points": ["Oregon CCB #255729 — licensed, bonded, insured, and verifiable in 30 seconds.",
                "Estimates back fast, on your escrow timeline — not 'sometime next month.'",
                "Emergency tarping and repairs so a bad roof never kills a deal."],
     "cta": "Save our number: (541) 670-5005"},
    {"subject": "Price the roof before the buyer's inspector does",
     "angle": "A pre-listing roof report removes the biggest surprise from the inspection.",
     "points": ["We flag what a buyer's inspector will flag — before it becomes a renegotiation.",
                "A free pre-listing roof condition report you can hand straight to sellers.",
                "Price with confidence instead of losing leverage on day 10 of escrow."],
     "cta": "Book a free pre-listing roof check"},
    {"subject": "Repair credit vs. price cut: the roof math that saves deals",
     "angle": "A real repair number beats a scary round-number price drop every time.",
     "points": ["A documented $4-6k repair quote can replace a $15k 'just knock it off' demand.",
                "Same-week quotes so negotiations don't stall out.",
                "Keep buyer and seller talking numbers instead of walking away."],
     "cta": "Get a same-week repair quote"},
    {"subject": "That green roof is costing your seller money",
     "angle": "Moss reads as neglect and quietly lowers offers — and it's a cheap fix.",
     "points": ["Buyers subtract for moss and streaks long before the inspection.",
                "Safe soft-wash treatment — never pressure washing that voids the shingle warranty.",
                "Quick turnaround so the roof is clean before listing photos."],
     "cta": "Schedule a pre-listing roof cleaning"},
    {"subject": "\"How old is that roof?\" — what underwriters want to see",
     "angle": "Roof age and condition can make or break financing and insurance.",
     "points": ["Insurers and lenders increasingly want roof age and remaining life documented.",
                "We provide roof certification letters that satisfy underwriting.",
                "Clean documentation that clears financing conditions fast."],
     "cta": "Request a roof certification letter"},
    {"subject": "Your pocket roofer for pending sales (tarps included)",
     "angle": "When a storm hits during escrow, response time saves the closing.",
     "points": ["A priority line for homes already under contract.",
                "Emergency tarping for storm damage — same day whenever we can.",
                "Fast, documented repairs that protect the closing date."],
     "cta": "Add us to your pending-sale contacts"},
    {"subject": "The 5 roof red flags you can spot at any showing",
     "angle": "Read a roof from the driveway and know exactly when to call.",
     "points": ["Granules in gutters, curling edges, moss, sagging lines, ceiling stains.",
                "What each one signals — cosmetic versus costly.",
                "Text us a photo and we'll give you a quick read, free."],
     "cta": "Text a roof photo to (541) 670-5005"},
    {"subject": "Metal vs. asphalt: what to tell buyers in the Umpqua Valley",
     "angle": "A confident answer on roofing builds instant buyer trust.",
     "points": ["Lifespan, cost, and resale differences in plain English.",
                "How each handles our rain, moss, and wildfire risk.",
                "Share-ready guides you can forward to curious clients."],
     "cta": "Grab our buyer roofing guides"},
    {"subject": "Wildfire season and the roof questions buyers now ask",
     "angle": "Oregon buyers ask about fire risk — be the agent with the answers.",
     "points": ["Class A roofing and ember-resistant details that actually matter here.",
                "How roofing ties into insurability and defensible space.",
                "A quick consult we'll do for your listing or your buyer."],
     "cta": "Book a wildfire-resistant roofing consult"},
    {"subject": "How to read a roof inspection report without panicking",
     "angle": "Most 'roof issues' are negotiable, not deal-enders.",
     "points": ["Cosmetic versus structural — and the rough cost of each.",
                "Where the real negotiating leverage hides in the report.",
                "Send it over and we'll translate it for you, same day."],
     "cta": "We'll translate a report for you"},
    {"subject": "Add $10k of curb-appeal value from the roofline down",
     "angle": "The roofline is the fastest curb-appeal win most agents skip.",
     "points": ["Roof cleaning, gutters, fascia, and shingle color that photograph beautifully.",
                "A simple pre-listing punch list your sellers can actually afford.",
                "Small spend, measurable bump in first impressions and offers."],
     "cta": "Get a pre-listing roofline punch list"},
    {"subject": "Financing a new roof so the deal still closes",
     "angle": "When the roof needs replacing mid-deal, options keep it alive.",
     "points": ["Repair credits, escrow holdbacks, and timing that works for closing.",
                "Homeowner financing and our monthly maintenance membership.",
                "A one-page options sheet you can hand to either side."],
     "cta": "Get the client options sheet"},
    {"subject": "Winter listings: the roof problems that show up Nov-Feb",
     "angle": "Cold, wet months surface the leaks that summer hides.",
     "points": ["Ice and water intrusion, gutter overflow, and attic condensation.",
                "What to check before a winter listing goes live.",
                "A fast winter-ready roof check for your inventory."],
     "cta": "Schedule a winter-ready roof check"},
    {"subject": "Let's make it official: a referral partnership",
     "angle": "Let's turn a good roofer into your roofer.",
     "points": ["Priority service and honest reads for every client you send us.",
                "Co-branded pre-listing roof reports with your name on them.",
                "A real thank-you for every referral that closes."],
     "cta": "Become a referral partner"},
]


def safe(t):
    t = display_safe(t)
    return (t.replace("“", '"').replace("”", '"')
             .replace("‘", "'").replace("’", "'").replace("…", "..."))


def vgrad(w, h, c1, c2):
    base = Image.new("RGB", (w, h), c1)
    top = Image.new("RGB", (w, h), c2)
    mask = Image.new("L", (w, h)); md = ImageDraw.Draw(mask)
    for y in range(h):
        md.line([(0, y), (w, y)], fill=int(255 * y / h))
    base.paste(top, (0, 0), mask)
    return base


def rain(d, x0, y0, x1, y1, n=26, alpha=30):
    import random
    rnd = random.Random(11)
    for _ in range(n):
        x = rnd.randint(x0, x1); y = rnd.randint(y0, y1)
        ln = rnd.randint(60, 150)
        d.line([(x, y), (x - 10, y + ln)], fill=(219, 229, 220, alpha), width=3)


def foot(img, d, dark=False):
    y = PH - 118
    if dark:
        lg = LOGO_WHITE.copy(); lg.thumbnail((300, 60)); img.paste(lg, (M, y), lg)
        f = mulish(32, 700)
        t = "Mistletoe Construction LLC · (541) 670-5005 · CCB #255729"
        d.text((PW - M - f.getlength(t), y + 14), t, font=f, fill=SAGE)
    else:
        lg = LOGO_BADGE.copy(); lg.thumbnail((92, 92)); img.paste(lg, (M, y - 18), lg)
        f = mulish(32, 700)
        t = "mistletoeconstruction.com · Riddle, Oregon · CCB #255729"
        d.text((PW - M - f.getlength(t), y + 14), t, font=f, fill=INK_SOFT)


def cover():
    img = vgrad(PW, PH, PINE950, PINE800).convert("RGBA")
    d = ImageDraw.Draw(img)
    rain(d, 0, 0, PW, PH, n=46, alpha=22)
    lg = LOGO_WHITE.copy(); lg.thumbnail((720, 150))
    img.paste(lg, ((PW - lg.width) // 2, 360), lg)
    # green rule
    d.rounded_rectangle([(PW - 120) // 2, 560, (PW + 120) // 2, 568], 4, fill=GREEN_L)
    f1 = edmund(150)
    for i, line in enumerate(["THE REALTOR", "EMAIL SERIES."]):
        d.text(((PW - f1.getlength(line)) / 2, 660 + i * 168), line, font=f1, fill=CREAM)
    f2 = mulish(54, 600)
    for i, line in enumerate(["14 educational emails · progressively spaced",
                              "The realtor + roofer playbook for Douglas County"]):
        d.text(((PW - f2.getlength(line)) / 2, 1080 + i * 80), line, font=f2, fill=MIST)
    # meta chip
    f3 = mulish(40, 800)
    chip = "AUTOMATED DRIP · RESEND · 100/DAY FREE TIER"
    cw = f3.getlength(chip) + 72
    d.rounded_rectangle([(PW - cw) / 2, 1320, (PW + cw) / 2, 1392], 36, outline=GREEN_L, width=3)
    d.text(((PW - f3.getlength(chip)) / 2, 1338), chip, font=f3, fill=GREEN_L)
    foot(img, d, dark=True)
    return img.convert("RGB")


def cadence():
    img = Image.new("RGBA", (PW, PH), CREAM); d = ImageDraw.Draw(img)
    d.rectangle([0, 0, PW, 300], fill=PINE900)
    rd = ImageDraw.Draw(img)
    lg = LOGO_WHITE.copy(); lg.thumbnail((260, 52)); img.paste(lg, (M, 70), lg)
    d.text((M, 150), "THE CADENCE", font=edmund(96), fill=CREAM)
    f = mulish(40, 600)
    d.text((M, 250), "Emails start close together, then space out — steady presence without the pester.", font=f, fill=MIST)

    # timeline bar (scaled day positions show the progressive widening)
    bx0, bx1, by = M, PW - M, 420
    d.line([(bx0, by), (bx1, by)], fill=SAGE, width=4)
    maxd = DAYS[-1]
    for i, day in enumerate(DAYS):
        x = bx0 + (bx1 - bx0) * day / maxd
        d.ellipse([x - 9, by - 9, x + 9, by + 9], fill=GREEN)
    d.text((bx0, by + 26), "Day 0", font=mulish(30, 700), fill=INK_SOFT)
    lbl = "Day %d (~%d months)" % (maxd, round(maxd / 30))
    d.text((bx1 - mulish(30, 700).getlength(lbl), by + 26), lbl, font=mulish(30, 700), fill=INK_SOFT)

    # rows
    y = 540
    rowh = (PH - 140 - y) / len(EMAILS)
    num_f = edmund(46); day_f = mulish(34, 800); sub_f = mulish(40, 700); gap_f = mulish(28, 700)
    for i, e in enumerate(EMAILS):
        ry = int(y + i * rowh)
        # number chip
        d.rounded_rectangle([M, ry, M + 66, ry + 66], 16, fill=PINE800)
        n = "%02d" % (i + 1)
        d.text((M + (66 - num_f.getlength(n)) / 2, ry + 8), n, font=num_f, fill=CREAM)
        # day pill
        dp = "DAY %d" % DAYS[i]
        dpw = day_f.getlength(dp) + 40
        d.rounded_rectangle([M + 90, ry + 10, M + 90 + dpw, ry + 56], 23, fill=(224, 236, 224))
        d.text((M + 110, ry + 20), dp, font=day_f, fill=PINE800)
        # gap note
        if i > 0:
            g = "+%d" % (DAYS[i] - DAYS[i - 1])
            d.text((M + 100 + dpw + 20, ry + 22), g, font=gap_f, fill=SAGE)
        # subject
        subj = safe(e["subject"])
        sx = M + 90 + dpw + 96
        # trim if too long
        while sub_f.getlength(subj) > PW - M - sx and len(subj) > 8:
            subj = subj[:-2]
        if subj != safe(e["subject"]):
            subj = subj.rstrip() + "…"
        d.text((sx, ry + 16), subj, font=sub_f, fill=INK)
    foot(img, d, dark=False)
    return img.convert("RGB")


def email_page(i, e):
    img = Image.new("RGBA", (PW, PH), PARCH); d = ImageDraw.Draw(img)
    # header band
    bandh = 360
    d.rectangle([0, 0, PW, bandh], fill=PINE900)
    rain(d, 0, 0, PW, bandh, n=22, alpha=26)
    lg = LOGO_WHITE.copy(); lg.thumbnail((250, 50)); img.paste(lg, (M, 60), lg)
    # kicker
    d.rounded_rectangle([M, 150, M + 54, 156], 3, fill=GREEN_L)
    d.text((M + 74, 138), "REALTOR EMAIL SERIES", font=mulish(32, 800), fill=GREEN_L)
    # email number + day tag (right side of band)
    tag = "EMAIL %02d" % (i + 1)
    tf = edmund(64)
    d.text((PW - M - tf.getlength(tag), 92), tag, font=tf, fill=CREAM)
    dtag = "SENDS DAY %d" % DAYS[i]
    df = mulish(34, 800)
    d.text((PW - M - df.getlength(dtag), 172), dtag, font=df, fill=MIST)

    x = M; y = bandh + 90
    # subject
    d.text((x, y), "SUBJECT LINE", font=mulish(32, 800), fill=GREEN); y += 54
    subj = safe(e["subject"]).upper()
    size = 92
    while size >= 52:
        hf = edmund(size); lines = wrap(d, subj, hf, PW - 2 * M)
        if len(lines) <= 3:
            break
        size -= 4
    lh = int(size * 1.06)
    for ln in lines:
        d.text((x, y), ln, font=hf, fill=PINE900); y += lh
    y += 40

    # angle
    d.text((x, y), "THE ANGLE", font=mulish(32, 800), fill=GREEN); y += 52
    af = mulish(48, 500)
    for ln in wrap(d, safe(e["angle"]), af, PW - 2 * M):
        d.text((x, y), ln, font=af, fill=INK); y += 60
    y += 46

    # key points
    d.text((x, y), "WHAT IT TEACHES", font=mulish(32, 800), fill=GREEN); y += 58
    bf = mulish(44, 500)
    for p in e["points"]:
        y = check_bullet(img, d, x, y, safe(p), bf, PW - 2 * M, INK, GREEN, WHITE, 56) + 10
    y += 26

    # CTA pill
    cf = mulish(44, 800)
    ctext = safe(e["cta"])
    cw = cf.getlength(ctext) + 96
    cy = PH - 320
    d.rounded_rectangle([x, cy, x + cw, cy + 88], 44, fill=GREEN)
    d.text((x + 48, cy + 20), ctext, font=cf, fill=WHITE)
    d.text((x, cy - 46), "THE ASK", font=mulish(32, 800), fill=INK_SOFT)

    foot(img, d, dark=False)
    return img.convert("RGB")


def main():
    Image.init()  # ensure JPEG/DCTDecode is registered for PDF image encoding
    pages = [cover(), cadence()] + [email_page(i, e) for i, e in enumerate(EMAILS)]
    pages[0].save(OUT, "PDF", save_all=True, append_images=pages[1:], resolution=200)
    print("wrote", OUT, "·", len(pages), "pages ·", len(EMAILS), "emails")


if __name__ == "__main__":
    main()
