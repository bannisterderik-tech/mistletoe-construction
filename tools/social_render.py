#!/usr/bin/env python3
"""
Mistletoe Construction — social graphics renderer.
Reads post JSON from social/content/*.json, renders 1080x1350 PNGs to social/out/.
Brand: Edmund display (uppercase), Mulish body, evergreen + brand green + parchment.
Usage: python3 tools/social_render.py [--only d01a] [--sample]
"""
import json, os, sys, glob, math, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1080, 1350
OUT = os.path.join(ROOT, "social", "out")

# ---------- Palette ----------
PINE950 = (18, 41, 26); PINE900 = (27, 61, 38); PINE800 = (35, 76, 48)
GREEN = (63, 145, 40); GREEN_B = (74, 167, 46); GREEN_L = (92, 187, 60)
PARCH = (245, 246, 243); CREAM = (252, 253, 251); MIST = (219, 229, 220)
INK = (31, 31, 31); INK_SOFT = (74, 82, 76); SAGE = (125, 154, 130)
WHITE = (255, 255, 255)

# ---------- Fonts ----------
def edmund(size): return ImageFont.truetype(os.path.join(ROOT, "fonts/edmund-bold.ttf"), size)
def mulish(size, weight=400):
    f = ImageFont.truetype(os.path.join(ROOT, "fonts/mulish-var.ttf"), size)
    f.set_variation_by_axes([weight]); return f

# ---------- Assets ----------
LOGO_WHITE = Image.open(os.path.join(ROOT, "images/logo-lockup-white.png")).convert("RGBA")
LOGO_BADGE = Image.open(os.path.join(ROOT, "images/logo-badge.png")).convert("RGBA")

def tint_dark_logo(img):
    """Recolor badge logo pixels to pine900 keeping alpha (badge is already dark; passthrough)."""
    return img

# ---------- Helpers ----------
def wrap(draw, text, font, maxw):
    words = text.split()
    lines, cur = [], ""
    for w_ in words:
        t = (cur + " " + w_).strip()
        if font.getlength(t) <= maxw: cur = t
        else:
            if cur: lines.append(cur)
            cur = w_
    if cur: lines.append(cur)
    return lines

def display_safe(text):
    """Edmund lacks some glyphs — substitute ASCII-safe equivalents."""
    return (text.replace("–", "-").replace("—", " - ").replace("−", "-")
                .replace("½", "1/2").replace("¼", "1/4"))

def fit_headline(draw, text, maxw, maxh, start=104, minsize=54, leading=1.04):
    text = display_safe(text)
    size = start
    while size >= minsize:
        f = edmund(size)
        lines = wrap(draw, text.upper(), f, maxw)
        lh = int(size * leading)
        if lh * len(lines) <= maxh and all(f.getlength(l) <= maxw for l in lines):
            return f, lines, lh
        size -= 4
    f = edmund(minsize); lines = wrap(draw, text.upper(), f, maxw)
    return f, lines, int(minsize * leading)

def draw_rain(img, alpha=26, n=34, seed=7):
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    rnd = random.Random(seed)
    for _ in range(n):
        x = rnd.randint(0, W); y = rnd.randint(-100, H)
        ln = rnd.randint(90, 240)
        d.line([(x, y), (x - 14, y + ln)], fill=(219, 229, 220, alpha), width=3)
    img.alpha_composite(ov)

def grad_bg(c1, c2):
    img = Image.new("RGBA", (W, H), c1)
    top = Image.new("RGBA", (W, H), c2)
    mask = Image.new("L", (W, H))
    md = ImageDraw.Draw(mask)
    for y in range(H):
        md.line([(0, y), (W, y)], fill=int(255 * (y / H)))
    img.paste(top, (0, 0), mask)
    return img

def footer(img, draw, dark=True):
    y = H - 108
    if dark:
        lg = LOGO_WHITE.copy(); lg.thumbnail((300, 56)); img.alpha_composite(lg, (72, y))
        f = mulish(30, 700)
        txt = "(541) 670-5005 · CCB #255729"
        draw.text((W - 72 - f.getlength(txt), y + 12), txt, font=f, fill=SAGE)
    else:
        lg = LOGO_BADGE.copy(); lg.thumbnail((88, 88)); img.alpha_composite(lg, (72, y - 16))
        f = mulish(30, 700)
        txt = "mistletoeconstruction.com · CCB #255729"
        draw.text((W - 72 - f.getlength(txt), y + 12), txt, font=f, fill=INK_SOFT)

def kicker_line(draw, x, y, text, color, dark_accent):
    draw.rounded_rectangle([x, y + 8, x + 54, y + 14], 3, fill=dark_accent)
    f = mulish(30, 800)
    draw.text((x + 74, y - 6), text.upper(), font=f, fill=color)
    # letterspacing approximation: draw normally (PIL lacks tracking) — acceptable

def check_bullet(img, draw, x, y, text, font, maxw, fill, chip_bg, chip_fg, lh):
    r = 21
    draw.ellipse([x, y + 4, x + 2 * r, y + 4 + 2 * r], fill=chip_bg)
    cx, cy = x + r, y + 4 + r
    draw.line([(cx - 9, cy + 1), (cx - 2, cy + 8)], fill=chip_fg, width=5)
    draw.line([(cx - 2, cy + 8), (cx + 10, cy - 7)], fill=chip_fg, width=5)
    lines = wrap(draw, text, font, maxw - 70)
    ty = y
    for ln in lines:
        draw.text((x + 66, ty), ln, font=font, fill=fill)
        ty += lh
    return max(ty, y + 2 * r + 10) + 14

def swipe_cue(draw, dark=True):
    f = mulish(32, 800)
    col = GREEN_L if dark else GREEN
    txt = "SWIPE"
    aw = 56
    x = W - 72 - f.getlength(txt) - aw - 16
    y = H - 178
    draw.text((x, y), txt, font=f, fill=col)
    ax = x + f.getlength(txt) + 16; ay = y + 22
    draw.line([(ax, ay), (ax + aw, ay)], fill=col, width=5)
    draw.line([(ax + aw, ay), (ax + aw - 14, ay - 12)], fill=col, width=5)
    draw.line([(ax + aw, ay), (ax + aw - 14, ay + 12)], fill=col, width=5)

def page_dots(draw, idx, total, dark=True):
    if total <= 1: return
    r = 7; gap = 26
    total_w = total * 2 * r + (total - 1) * (gap - 2 * r)
    x = (W - total_w) / 2; y = H - 178
    for i in range(total):
        fill = (GREEN_L if dark else GREEN) if i == idx else ((255, 255, 255, 70) if dark else (31, 31, 31, 50))
        draw.ellipse([x, y, x + 2 * r, y + 2 * r], fill=fill)
        x += gap

# ---------- Slide renderers ----------
def base_dark():
    img = grad_bg(PINE950, PINE800); draw_rain(img)
    return img

def base_light():
    img = Image.new("RGBA", (W, H), PARCH)
    d = ImageDraw.Draw(img)
    d.ellipse([W - 420, -260, W + 260, 420], fill=MIST)
    d.ellipse([-300, H - 380, 280, H + 200], fill=(233, 242, 224, 255))
    return img

def base_photo(photo):
    p = Image.open(os.path.join(ROOT, "images", photo)).convert("RGB")
    pw, ph = p.size
    scale = max(W / pw, H / ph)
    p = p.resize((int(pw * scale), int(ph * scale)))
    p = p.crop(((p.width - W) // 2, (p.height - H) // 2, (p.width - W) // 2 + W, (p.height - H) // 2 + H))
    p = ImageEnhance.Brightness(p).enhance(0.9)
    img = p.convert("RGBA")
    ov = Image.new("RGBA", (W, H))
    od = ImageDraw.Draw(ov)
    for y in range(H):
        a = int(40 + 180 * (y / H) ** 1.6)
        od.line([(0, y), (W, y)], fill=(18, 41, 26, a))
    od.rectangle([0, 0, W, 300], fill=(18, 41, 26, 110))
    img.alpha_composite(ov)
    return img

def render_slide(slide, template, photo, idx, total, is_carousel, post_type):
    dark = template in ("dark", "myth", "stat", "photo")
    if template == "photo" and photo:
        img = base_photo(photo)
    elif dark:
        img = base_dark()
    else:
        img = base_light()
    d = ImageDraw.Draw(img)
    fg = CREAM if dark else PINE900
    body_fg = MIST if dark else INK_SOFT
    kicker_fg = GREEN_L if dark else GREEN
    x = 72; maxw = W - 144

    y = 150
    if slide.get("kicker"):
        kicker_line(d, x, y, slide["kicker"], kicker_fg, GREEN)
        y += 78

    if template == "stat" and slide.get("big"):
        bf = edmund(300)
        big = display_safe(slide["big"])
        while bf.getlength(big) > maxw: bf = edmund(bf.size - 12)
        d.text((x, y), big, font=bf, fill=GREEN_L)
        y += bf.size + 26

    if template == "myth" and slide.get("myth"):
        mf = mulish(34, 800)
        d.text((x, y), "MYTH", font=mf, fill=(226, 116, 96)); y += 52
        f2, lines, lh = fit_headline(d, slide["myth"], maxw, 300, start=72, minsize=48)
        for ln in lines:
            d.text((x, y), ln, font=f2, fill=(255, 255, 255, 200))
            lw = f2.getlength(ln)
            d.line([(x, y + lh * 0.55), (x + lw, y + lh * 0.55)], fill=(226, 116, 96), width=6)
            y += lh
        y += 40
        d.text((x, y), "TRUTH", font=mf, fill=GREEN_L); y += 52

    headline = slide.get("headline") or slide.get("truth") or ""
    if headline:
        avail = (H - 320) - y if not slide.get("body") and not slide.get("bullets") else 460
        hf, lines, lh = fit_headline(d, headline, maxw, min(avail, 560))
        for ln in lines:
            d.text((x, y), ln, font=hf, fill=fg); y += lh
        y += 34

    if slide.get("body"):
        bf = mulish(41, 500)
        for ln in wrap(d, slide["body"], bf, maxw):
            d.text((x, y), ln, font=bf, fill=body_fg); y += 58
        y += 26

    if slide.get("bullets"):
        bf = mulish(39, 600)
        chip_bg = GREEN if dark else PINE800
        for b in slide["bullets"]:
            y = check_bullet(img, d, x, y, b, bf, maxw, fg if dark else INK, chip_bg, WHITE, 54)

    if is_carousel:
        if idx == 0: swipe_cue(d, dark)
        else: page_dots(d, idx, total, dark)

    footer(img, d, dark)
    return img

def cta_slide():
    img = base_dark(); d = ImageDraw.Draw(img)
    lg = LOGO_BADGE.copy(); lg.thumbnail((240, 240))
    # badge is dark on transparent; put on mist circle
    d.ellipse([W // 2 - 150, 130, W // 2 + 150, 430], fill=MIST)
    img.alpha_composite(lg, (W // 2 - lg.width // 2, 280 - lg.height // 2))
    y = 500
    hf, lines, lh = fit_headline(d, "Sleep better when it rains.", W - 200, 300, start=96)
    for ln in lines:
        d.text(((W - hf.getlength(ln)) / 2, y), ln, font=hf, fill=CREAM); y += lh
    y += 30
    bf = mulish(40, 600)
    for t in ["Family-owned · Riddle, Oregon", "Licensed & insured · Oregon CCB #255729", "Owens Corning contractor"]:
        d.text(((W - bf.getlength(t)) / 2, y), t, font=bf, fill=MIST); y += 62
    y += 40
    # CTA pill
    cf = mulish(44, 800)
    txt = "Free estimates · (541) 670-5005"
    pw = cf.getlength(txt) + 120
    d.rounded_rectangle([(W - pw) / 2, y, (W + pw) / 2, y + 108], 54, fill=GREEN)
    d.text(((W - cf.getlength(txt)) / 2, y + 26), txt, font=cf, fill=WHITE)
    df = mulish(34, 700)
    t2 = "mistletoeconstruction.com"
    d.text(((W - df.getlength(t2)) / 2, y + 150), t2, font=df, fill=SAGE)
    return img

# ---------- Main ----------
def render_post(post):
    slides = post["slides"]
    total = len(slides) + (1 if post["type"] == "carousel" else 0)
    outs = []
    for i, s in enumerate(slides):
        tpl = s.get("template", post.get("template", "dark"))
        img = render_slide(s, tpl, post.get("photo"), i, total, post["type"] == "carousel", post["type"])
        outs.append(img)
    if post["type"] == "carousel":
        img = cta_slide()
        d = ImageDraw.Draw(img); page_dots(d, total - 1, total, True)
        outs.append(img)
    for i, img in enumerate(outs):
        name = post["id"] + (("-" + str(i + 1)) if len(outs) > 1 else "") + ".png"
        img.convert("RGB").save(os.path.join(OUT, name), "PNG", optimize=True)
    return len(outs)

def main():
    os.makedirs(OUT, exist_ok=True)
    only = None
    if "--only" in sys.argv: only = sys.argv[sys.argv.index("--only") + 1]
    files = sorted(glob.glob(os.path.join(ROOT, "social", "content", "*.json")))
    n_posts = n_slides = 0
    for fp in files:
        posts = json.load(open(fp))
        for p in posts:
            if only and p["id"] != only: continue
            n_slides += render_post(p); n_posts += 1
    print(f"rendered {n_posts} posts / {n_slides} slides -> social/out/")

if __name__ == "__main__":
    main()
