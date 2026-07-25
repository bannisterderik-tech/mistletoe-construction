#!/usr/bin/env python3
"""
Render the realtor educational email series as a stylized, on-brand PDF —
same design language as the social graphics (Edmund display, Mulish body,
evergreen + brand green + parchment). Cover + cadence timeline + the FULL
body of every email (auto-paginated when an email runs long).
Usage: python3 tools/email_series_pdf.py
"""
import os, sys
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from social_render import (edmund, mulish, wrap, display_safe,
                           PINE950, PINE900, PINE800, GREEN, GREEN_B, GREEN_L,
                           PARCH, CREAM, MIST, INK, INK_SOFT, SAGE, WHITE,
                           LOGO_WHITE, LOGO_BADGE, ROOT)

PW, PH = 1700, 2200
M = 120
BOTTOM = PH - 190
OUT = os.path.join(ROOT, "emails", "Mistletoe-Realtor-Email-Series.pdf")

FROM = "Alex Smith — Mistletoe Construction · alex@hi.mistletoeconstruction.com"
DAYS = [0, 4, 9, 15, 22, 31, 42, 56, 74, 96, 124, 160, 205, 260]

EMAILS = [
{"subject": "A roofer your Douglas County deals can actually count on",
 "body": """Hi {{first_name}},

I'm Alex Smith — I run Mistletoe Construction, a family-owned roofing company out of Riddle (Oregon CCB #255729, Owens Corning contractor). We work every town you sell in, from Roseburg to {{city_or_glide}}.

Here's why I'm in your inbox: roofs kill more Douglas County deals than almost anything else on the inspection report. Moss nobody dealt with, a 24-year-old shingle field, a mystery stain in the attic — and suddenly your closing date is a negotiation.

When that happens, you need a roofer who answers the phone, gets on the roof fast, and gives you a written, photographed answer you can hand to the other side. That's the entire way we operate.

Save this number: (541) 670-5005 — call or text either way. Over the next few weeks I'll send a handful of short notes on how we help agents specifically — pre-listing inspections, repair credits, roof certifications. No spam, and unsubscribing takes one click.

— Alex"""},

{"subject": "Price the roof before the buyer's inspector does",
 "body": """Hi {{first_name}},

The cheapest roof problem is the one your seller finds first.

A pre-listing roof inspection takes us about an hour. You get a written report with photos of every issue — moss, lifted shingles, flashing, boots, gutters — before the buyer's inspector climbs up there with their own camera.

What that buys your listing:
No surprises at negotiation. You already know what's up there and what it costs to fix.
Small fixes before showings. A $400 repair now beats a $4,000 credit demand later.
A document buyers trust. "Roof inspected and serviced last month, report attached" changes how a house reads.

We turn these around fast because listing timelines don't wait. Call or text (541) 670-5005 when you're prepping your next listing — even if the answer is "roof's fine, here's the proof," that's worth having in the folder.

— Alex, Mistletoe Construction · CCB #255729"""},

{"subject": "Repair credit vs. price cut: the roof math that saves deals",
 "body": """Hi {{first_name}},

When a roof issue shows up mid-transaction, there are three ways out — and they are not equal:

Price cut. Fast, but buyers mentally double the real repair cost. A $6,000 roof issue becomes a $12,000 ask.
Repair credit. Better — but lenders cap credits, and the buyer still closes on a broken roof they now have to manage.
Fix it before closing. Usually the cheapest path for your seller — because the repair costs what it costs, not what a nervous buyer fears it costs.

The catch with option three is speed: you need a licensed roofer who can quote from the inspection report within a day or two and get the work done inside the contingency window. That's a lane we've built our scheduling around — written scope, photos of the completed work, documentation for the file.

Next time an inspection report lands with a roofing section that makes everyone frown: (541) 670-5005. We'll give you real numbers the same week.

— Alex, Mistletoe Construction · CCB #255729"""},

{"subject": "That green roof is costing your seller money",
 "body": """Hi {{first_name}},

You've seen it on half your listings: the north roof slope is green. In the Umpqua Valley — 130+ rainy days a year — moss is basically a native species.

Two things every agent should know about it:
It reads as neglect. Buyers see a mossy roof and assume the whole house was maintained the same way. It suppresses offers well beyond the actual cost of fixing it.
Never let anyone pressure wash it. Pressure washing strips the protective granules and can void the shingle warranty — turning a cosmetic issue into a real one. (This one comes up constantly; it's worth remembering.)

Done right — gentle removal, treatment, zinc strips to keep it from coming back — a typical job runs a few hundred dollars and dramatically changes how a listing photographs. We can usually fit pre-listing moss work in fast, because we know photos are waiting.

Green roof on the next walkthrough? (541) 670-5005.

— Alex, Mistletoe Construction · CCB #255729"""},

{"subject": "\"How old is that roof?\" — what underwriters want to see",
 "body": """Hi {{first_name}},

"How old is that roof?" — the question that stalls files. The seller thinks 2012, the county shows no permit, and now underwriting or the buyer's insurer wants answers before anyone signs anything.

What actually satisfies that question is documentation from a licensed contractor: roof type and material, estimated remaining life, and condition of the field, flashing, and penetrations — in writing, with photos, from a company whose license number (CCB #255729) anyone can verify with the state in two minutes.

We write these up after a physical inspection, and they've settled everything from insurance-binder questions to "the appraiser flagged the roof" moments. Wet-season closings especially: insurers get nervous about Oregon roofs from October to May, and a current inspection letter calms the whole file down.

If a transaction needs a roof answer in writing, that's a same-week call for us: (541) 670-5005.

— Alex, Mistletoe Construction · CCB #255729"""},

{"subject": "Your pocket roofer for pending sales (tarps included)",
 "body": """Hi {{first_name}},

Here's the practical one — the three ways agents actually use us:

The 2 a.m. tarp. A storm hits a pending sale, water's coming in, closing is in twelve days. We tarp fast so the deal survives long enough to fix it properly. Save the number now, not that night: (541) 670-5005.
The honest opinion. Text us photos from a walkthrough and we'll tell you straight whether you're looking at a $500 repair or a replacement conversation — before your client falls in love or walks away.
The closing gift that isn't a candle. Our Home Care Membership ($49/mo — annual roof and gutter inspection, storm checks, priority service, photo reports) is a genuinely useful first-year gift for buyers new to Oregon roofs. Some agents cover the first few months; their clients remember it every time it rains.

That's the whole pitch: a licensed local roofer who treats your transaction timeline like it matters. Coffee's on us if you want to put a face to the name.

— Alex Smith, Mistletoe Construction · CCB #255729"""},

{"subject": "The 5 roof red flags you can spot at any showing",
 "body": """Hi {{first_name}},

You don't need to climb a ladder to read a roof. From the driveway, five things tell you most of the story:
Granules in the gutters or the downspout splash — the shingles are shedding their sun protection, and the clock is running.
Curling or cupping edges — heat and age; the field is near the end of its life.
Dark streaks or green fuzz — algae and moss; cosmetic now, costly if ignored.
A sagging or wavy ridgeline — possible decking or moisture trouble underneath; the one to take seriously.
Interior ceiling stains — a leak that's already inside the house.

None of these mean "walk away." They mean "know what you're looking at before you write or price." Spot one on a walkthrough? Snap a photo and text it to me — I'll tell you straight whether it's a $400 fix or a real conversation, no charge and no sales pitch.

Text a roof photo any time: (541) 670-5005.

— Alex, Mistletoe Construction · CCB #255729"""},

{"subject": "Metal vs. asphalt: what to tell buyers in the Umpqua Valley",
 "body": """Hi {{first_name}},

Buyers ask you about roofs, so here's the plain-English version you can repeat with confidence.

Asphalt shingles — most homes here. Lower upfront cost, 20–30 years in our climate, easy to repair and match. The right choice for most sellers and most budgets.

Metal — standing seam or exposed-fastener. Two to three times the cost upfront, but 40–70 years, sheds moss and rain beautifully, and carries a Class A fire rating that matters more every wildfire season. Buyers planning to stay put love it.

The honest answer to "which is better?" is "better for what?" — and being the agent who can actually explain that builds trust fast.

Our full buyer guides are on the site — lifespan, cost, resale — and you're welcome to forward them to any client chewing on the decision. Want the links, or a quick roof read on a specific listing? (541) 670-5005.

— Alex, Mistletoe Construction · CCB #255729"""},

{"subject": "Wildfire season and the roof questions buyers now ask",
 "body": """Hi {{first_name}},

Every summer more Oregon buyers ask the same thing: "Is this house safe if a fire comes through?" The roof is the first honest answer.

Three things worth knowing:
Class A is the standard. Most asphalt and all metal roofs we install carry the top fire rating — embers landing on the roof are the number-one way homes ignite, so this is the real protection.
The edges matter as much as the field. Ember-resistant vents, clean gutters, and enclosed eaves keep embers from getting underneath.
It's an insurance conversation now. Insurers are pricing — and even declining — based on roof age and fire resilience, so a current roof and documentation can keep a policy (and a closing) alive.

If you've got a listing in a higher-risk area, or a buyer who's nervous, I'll do a quick wildfire-resilience read on the roof and put it in writing.

(541) 670-5005.

— Alex, Mistletoe Construction · CCB #255729"""},

{"subject": "How to read a roof inspection report without panicking",
 "body": """Hi {{first_name}},

A roofing section on an inspection report can look scarier than it is. Here's how to triage one in thirty seconds:
Cosmetic / maintenance — moss, minor granule loss, a little debris, worn sealant. Real, cheap, and almost never a deal-breaker.
Component repairs — a few lifted shingles, a flashing detail, a pipe boot. Usually hundreds, not thousands, and quotable fast.
Systemic — widespread curling, multiple leaks, decking damage, a roof past its life. This is the replace-or-negotiate conversation, and it deserves a real number, not a guess.

The mistake is treating all three the same and letting a $600 problem read like a $16,000 one. Send me the report — I'll translate the roofing section into plain language and rough numbers, same day, so you walk into the negotiation knowing exactly where the leverage is.

Forward it any time: (541) 670-5005.

— Alex, Mistletoe Construction · CCB #255729"""},

{"subject": "Add $10k of curb-appeal value from the roofline down",
 "body": """Hi {{first_name}},

The fastest curb-appeal win most sellers skip is the top third of the house.

A tired roofline drags down every listing photo — streaked shingles, a sagging gutter, peeling fascia, a downspout hanging loose. Buyers read it as "deferred maintenance everywhere" before they've seen the kitchen.

The fix is usually cheap relative to the return: a soft-wash moss treatment, gutters cleaned and re-secured, fascia touched up, and — if the shingles are near end-of-life — knowing whether a fresh field is worth it before listing rather than after a lowball.

I'll walk a pre-listing roofline with you and hand over a short, prioritized punch list: what's worth doing, what's not, and what it costs. Most sellers spend a little and photograph a lot better.

Prepping a listing? (541) 670-5005.

— Alex, Mistletoe Construction · CCB #255729"""},

{"subject": "Financing a new roof so the deal still closes",
 "body": """Hi {{first_name}},

Sometimes the roof really does need replacing mid-deal — and that doesn't have to end the transaction. A few paths I've seen close:
Seller replaces before closing. Cleanest for everyone; the cost is the cost, and the listing gets a brand-new-roof headline.
Repair or replacement credit. Works within lender limits; the buyer closes and schedules the work.
Escrow holdback. Funds set aside at closing, roof done right after — keeps the timeline moving.
Buyer financing or our membership. Homeowner financing options, plus a maintenance membership that spreads care over time for buyers new to Oregon roofs.

The key is a fast, firm number so both sides negotiate reality instead of fear. I'll put together a one-page options sheet for a specific deal — real scope, real cost, real timeline — that you can hand to either side.

When a roof is the last thing standing between you and the table: (541) 670-5005.

— Alex, Mistletoe Construction · CCB #255729"""},

{"subject": "Winter listings: the roof problems that show up Nov-Feb",
 "body": """Hi {{first_name}},

Winter is when Oregon roofs tell the truth. The leaks that hid all summer show up the first week of steady rain — right when your winter inventory is trying to close.

What to watch from November on:
Water intrusion at valleys and flashing — summer-dry gaps that only leak under sustained rain.
Overflowing or ice-blocked gutters — water backing up under the shingle edge and into the fascia.
Attic condensation — poor ventilation that reads as a "leak" but is really trapped moisture, and spooks buyers either way.

A quick pre-winter or pre-listing check catches these before they become an inspection surprise or a mid-escrow emergency. And if one does pop during a pending sale, we tarp fast so the closing survives.

Got listings going live this winter? Let's get ahead of it: (541) 670-5005.

— Alex, Mistletoe Construction · CCB #255729"""},

{"subject": "Let's make it official: a referral partnership",
 "body": """Hi {{first_name}},

We've been in each other's orbit for a few months now — so here's the straight ask: let's make it a real partnership.

What that looks like from my side:
Priority service for anyone you send — your clients go to the front of the line, and they get an honest read, not an upsell.
Co-branded pre-listing roof reports — your name and logo on the documentation you hand sellers. It makes you look thorough, because you are.
A real thank-you for referrals that close — I take care of the people who take care of me, and I'll tell you exactly how.

You get a roofer who protects your closings and makes you look good doing it. I get to work with agents who value doing it right. That's the whole deal.

Grab fifteen minutes and let's set it up — coffee's on me: (541) 670-5005.

— Alex Smith, Mistletoe Construction · CCB #255729"""},
]


def safe(t):
    t = display_safe(t)
    return (t.replace("“", '"').replace("”", '"')
             .replace("‘", "'").replace("’", "'").replace("…", "..."))


def vgrad(w, h, c1, c2):
    base = Image.new("RGB", (w, h), c1); top = Image.new("RGB", (w, h), c2)
    mask = Image.new("L", (w, h)); md = ImageDraw.Draw(mask)
    for y in range(h):
        md.line([(0, y), (w, y)], fill=int(255 * y / h))
    base.paste(top, (0, 0), mask); return base


def rain(d, x0, y0, x1, y1, n=26, alpha=30, seed=11):
    import random
    rnd = random.Random(seed)
    for _ in range(n):
        x = rnd.randint(x0, x1); y = rnd.randint(y0, y1); ln = rnd.randint(60, 150)
        d.line([(x, y), (x - 10, y + ln)], fill=(219, 229, 220, alpha), width=3)


def foot(img, d):
    y = PH - 118
    lg = LOGO_BADGE.copy(); lg.thumbnail((88, 88)); img.paste(lg, (M, y - 16), lg)
    f = mulish(30, 700)
    t = "mistletoeconstruction.com · Riddle, Oregon · CCB #255729"
    d.text((PW - M - f.getlength(t), y + 14), t, font=f, fill=INK_SOFT)


def cover():
    img = vgrad(PW, PH, PINE950, PINE800).convert("RGBA"); d = ImageDraw.Draw(img)
    rain(d, 0, 0, PW, PH, n=46, alpha=22)
    lg = LOGO_WHITE.copy(); lg.thumbnail((720, 150)); img.paste(lg, ((PW - lg.width) // 2, 360), lg)
    d.rounded_rectangle([(PW - 120) // 2, 560, (PW + 120) // 2, 568], 4, fill=GREEN_L)
    f1 = edmund(150)
    for i, line in enumerate(["THE REALTOR", "EMAIL SERIES."]):
        d.text(((PW - f1.getlength(line)) / 2, 660 + i * 168), line, font=f1, fill=CREAM)
    f2 = mulish(54, 600)
    for i, line in enumerate(["14 educational emails · full copy · progressively spaced",
                              "The realtor + roofer playbook for Douglas County"]):
        d.text(((PW - f2.getlength(line)) / 2, 1080 + i * 80), line, font=f2, fill=MIST)
    f3 = mulish(40, 800)
    chip = "AUTOMATED DRIP · RESEND · FROM alex@hi.mistletoeconstruction.com"
    cw = f3.getlength(chip) + 72
    d.rounded_rectangle([(PW - cw) / 2, 1320, (PW + cw) / 2, 1392], 36, outline=GREEN_L, width=3)
    d.text(((PW - f3.getlength(chip)) / 2, 1338), chip, font=f3, fill=GREEN_L)
    lg2 = LOGO_WHITE.copy(); lg2.thumbnail((300, 60)); img.paste(lg2, (M, PH - 128), lg2)
    ff = mulish(32, 700); ft = "Mistletoe Construction LLC · (541) 670-5005 · CCB #255729"
    d.text((PW - M - ff.getlength(ft), PH - 104), ft, font=ff, fill=SAGE)
    return img.convert("RGB")


def cadence():
    img = Image.new("RGBA", (PW, PH), CREAM); d = ImageDraw.Draw(img)
    d.rectangle([0, 0, PW, 300], fill=PINE900)
    lg = LOGO_WHITE.copy(); lg.thumbnail((260, 52)); img.paste(lg, (M, 70), lg)
    d.text((M, 150), "THE CADENCE", font=edmund(96), fill=CREAM)
    d.text((M, 250), "Emails start close together, then space out — steady presence without the pester.",
           font=mulish(40, 600), fill=MIST)
    bx0, bx1, by = M, PW - M, 420
    d.line([(bx0, by), (bx1, by)], fill=SAGE, width=4)
    maxd = DAYS[-1]
    for day in DAYS:
        x = bx0 + (bx1 - bx0) * day / maxd
        d.ellipse([x - 9, by - 9, x + 9, by + 9], fill=GREEN)
    d.text((bx0, by + 26), "Day 0", font=mulish(30, 700), fill=INK_SOFT)
    lbl = "Day %d (~%d months)" % (maxd, round(maxd / 30))
    d.text((bx1 - mulish(30, 700).getlength(lbl), by + 26), lbl, font=mulish(30, 700), fill=INK_SOFT)
    y = 540; rowh = (BOTTOM - y) / len(EMAILS)
    num_f = edmund(46); day_f = mulish(34, 800); sub_f = mulish(40, 700); gap_f = mulish(28, 700)
    for i, e in enumerate(EMAILS):
        ry = int(y + i * rowh)
        d.rounded_rectangle([M, ry, M + 66, ry + 66], 16, fill=PINE800)
        n = "%02d" % (i + 1)
        d.text((M + (66 - num_f.getlength(n)) / 2, ry + 8), n, font=num_f, fill=CREAM)
        dp = "DAY %d" % DAYS[i]; dpw = day_f.getlength(dp) + 40
        d.rounded_rectangle([M + 90, ry + 10, M + 90 + dpw, ry + 56], 23, fill=(224, 236, 224))
        d.text((M + 110, ry + 20), dp, font=day_f, fill=PINE800)
        if i > 0:
            d.text((M + 100 + dpw + 20, ry + 22), "+%d" % (DAYS[i] - DAYS[i - 1]), font=gap_f, fill=SAGE)
        subj = safe(e["subject"]); sx = M + 90 + dpw + 96
        full = subj
        while sub_f.getlength(subj) > PW - M - sx and len(subj) > 8:
            subj = subj[:-2]
        if subj != full:
            subj = subj.rstrip() + "…"
        d.text((sx, ry + 16), subj, font=sub_f, fill=INK)
    foot(img, d)
    return img.convert("RGB")


class Flow:
    """Renders an email's full body across as many pages as it needs."""
    def __init__(self, idx):
        self.idx = idx; self.pages = []
        self._start(first=True)

    def _start(self, first):
        img = Image.new("RGBA", (PW, PH), PARCH); d = ImageDraw.Draw(img)
        e = EMAILS[self.idx]
        if first:
            bandh = 300
            d.rectangle([0, 0, PW, bandh], fill=PINE900)
            rain(d, 0, 0, PW, bandh, n=20, alpha=26)
            lg = LOGO_WHITE.copy(); lg.thumbnail((250, 50)); img.paste(lg, (M, 56), lg)
            d.rounded_rectangle([M, 138, M + 54, 144], 3, fill=GREEN_L)
            d.text((M + 74, 126), "REALTOR EMAIL SERIES", font=mulish(30, 800), fill=GREEN_L)
            tag = "EMAIL %02d" % (self.idx + 1); tf = edmund(60)
            d.text((PW - M - tf.getlength(tag), 78), tag, font=tf, fill=CREAM)
            dtag = "SENDS DAY %d" % DAYS[self.idx]; df = mulish(32, 800)
            d.text((PW - M - df.getlength(dtag), 152), dtag, font=df, fill=MIST)
            y = bandh + 74
            # subject headline
            d.text((M, y), "SUBJECT", font=mulish(30, 800), fill=GREEN); y += 48
            subj = safe(e["subject"]).upper(); size = 78
            while size >= 46:
                hf = edmund(size); lines = wrap(d, subj, hf, PW - 2 * M)
                if len(lines) <= 3:
                    break
                size -= 4
            lh = int(size * 1.06)
            for ln in lines:
                d.text((M, y), ln, font=hf, fill=PINE900); y += lh
            y += 20
            ff = mulish(30, 700)
            d.text((M, y), "From: " + safe(FROM), font=ff, fill=INK_SOFT); y += 46
            d.line([(M, y), (PW - M, y)], fill=(200, 210, 201), width=2); y += 40
        else:
            bandh = 150
            d.rectangle([0, 0, PW, bandh], fill=PINE800)
            lg = LOGO_WHITE.copy(); lg.thumbnail((220, 44)); img.paste(lg, (M, 52), lg)
            tag = "EMAIL %02d — CONTINUED" % (self.idx + 1); tf = mulish(34, 800)
            d.text((PW - M - tf.getlength(tag), 60), tag, font=tf, fill=MIST)
            y = bandh + 60
        self.img, self.d, self.y = img, d, y

    def _flush(self):
        foot(self.img, self.d)
        self.pages.append(self.img.convert("RGB"))

    def _ensure(self, need):
        if self.y + need > BOTTOM:
            self._flush(); self._start(first=False)

    def line(self, text, font, x, lh, fill=INK):
        self._ensure(lh)
        self.d.text((x, self.y), text, font=font, fill=fill); self.y += lh

    def bullet_dot(self):
        self._ensure(0)
        self.d.ellipse([M + 4, self.y + 16, M + 20, self.y + 32], fill=GREEN)

    def gap(self, g): self.y += g

    def build(self):
        bf = mulish(42, 500); lh = 60; bfw = PW - 2 * M
        body = EMAILS[self.idx]["body"].strip()
        for block in body.split("\n\n"):
            sub = [s for s in block.split("\n") if s.strip()]
            islist = len(sub) > 1 and not sub[0].startswith("Hi ")
            for s in sub:
                s = safe(s.strip())
                if islist:
                    lines = wrap(self.d, s, bf, bfw - 46)
                    for j, ln in enumerate(lines):
                        if j == 0:
                            self._ensure(lh); self.bullet_dot()
                        self.line(ln, bf, M + 46, lh)
                    self.gap(6)
                else:
                    for ln in wrap(self.d, s, bf, bfw):
                        self.line(ln, bf, M, lh)
            self.gap(24)
        self._flush()
        return self.pages


def main():
    Image.init()
    pages = [cover(), cadence()]
    for i in range(len(EMAILS)):
        pages += Flow(i).build()
    pages[0].save(OUT, "PDF", save_all=True, append_images=pages[1:], resolution=200)
    print("wrote", OUT, "·", len(pages), "pages ·", len(EMAILS), "emails (full body)")


if __name__ == "__main__":
    main()
