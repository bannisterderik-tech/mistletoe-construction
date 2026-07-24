#!/usr/bin/env python3
"""Compose the 60-day social schedule into a single PDF (cover + one page per day)."""
import json, glob, os, sys
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from social_render import mulish, edmund, wrap, PINE950, PINE900, PINE800, GREEN, GREEN_L, PARCH, CREAM, MIST, INK, INK_SOFT, SAGE, WHITE, LOGO_WHITE, LOGO_BADGE, ROOT

PW, PH = 1700, 2200  # ~letter at 200dpi
M = 90               # margin
OUT_DIR = os.path.join(ROOT, "social", "out")

def load_posts():
    posts = []
    for fp in sorted(glob.glob(os.path.join(ROOT, "social/content/batch*.json"))):
        posts += json.load(open(fp))
    posts.sort(key=lambda p: (p["day"], p["slot"]))
    return posts

def post_images(p):
    n = len(p["slides"]) + (1 if p["type"] == "carousel" else 0)
    if n == 1: return [os.path.join(OUT_DIR, p["id"] + ".png")]
    return [os.path.join(OUT_DIR, f"{p['id']}-{i+1}.png") for i in range(n)]

def cover():
    img = Image.new("RGB", (PW, PH), PINE950)
    d = ImageDraw.Draw(img)
    lg = LOGO_WHITE.copy(); lg.thumbnail((640, 120))
    img.paste(lg, ((PW - lg.width) // 2, 360), lg)
    f1 = edmund(150)
    for i, line in enumerate(["60 DAYS OF", "SOCIAL CONTENT."]):
        d.text(((PW - f1.getlength(line)) / 2, 640 + i * 165), line, font=f1, fill=CREAM)
    f2 = mulish(52, 600)
    for i, line in enumerate(["120 posts · 2 per day · stills & carousels",
                              "Educational, on-brand, grounded in our own guides"]):
        d.text(((PW - f2.getlength(line)) / 2, 1050 + i * 78), line, font=f2, fill=MIST)
    f3 = mulish(44, 800)
    t = "Captions & hashtags: social/CALENDAR.md · Graphics: social/out/"
    d.text(((PW - f3.getlength(t)) / 2, 1320), t, font=f3, fill=GREEN_L)
    f4 = mulish(40, 700)
    t2 = "Mistletoe Construction LLC · Riddle, Oregon · CCB #255729 · (541) 670-5005"
    d.text(((PW - f4.getlength(t2)) / 2, PH - 220), t2, font=f4, fill=SAGE)
    return img

def draw_post(img, d, p, y, half_h):
    x = M
    maxw = PW - 2 * M
    # label row
    lab = mulish(38, 800)
    tag = f"POST {p['slot']} · {p['type'].upper()} · {p['category'].upper()}"
    d.rounded_rectangle([x, y, x + lab.getlength(tag) + 56, y + 62], 31, fill=PINE800)
    d.text((x + 28, y + 10), tag, font=lab, fill=MIST)
    imgs_f = mulish(34, 700)
    files = post_images(p)
    fname = os.path.basename(files[0]) if len(files) == 1 else f"{p['id']}-1…{len(files)}.png"
    d.text((PW - M - imgs_f.getlength(fname), y + 14), fname, font=imgs_f, fill=INK_SOFT)
    y += 92

    # thumbnails
    th = 356
    tw = int(th * 1080 / 1350)
    tx = x
    for fp_ in files[:5]:
        try:
            t = Image.open(fp_).convert("RGB")
            t.thumbnail((tw, th))
            img.paste(t, (tx, y))
            tx += tw + 22
        except Exception:
            pass
    if len(files) > 5:
        mf = mulish(40, 800)
        d.text((tx + 8, y + th // 2 - 20), f"+{len(files) - 5}", font=mf, fill=INK_SOFT)
    y += th + 34

    # caption
    cf = mulish(34, 500)
    cap = p["caption"].replace("\n\n", "  •  ").replace("\n", " ")
    lines = wrap(d, cap, cf, maxw)
    max_lines = (half_h - (y % half_h)) // 46 - 2 if False else 99
    for ln in lines[:11]:
        d.text((x, y), ln, font=cf, fill=INK); y += 46
    if len(lines) > 11:
        d.text((x, y), "…", font=cf, fill=INK_SOFT); y += 46
    y += 8
    hf = mulish(31, 700)
    for ln in wrap(d, " ".join(p["hashtags"]), hf, maxw)[:2]:
        d.text((x, y), ln, font=hf, fill=GREEN); y += 42
    return y

def day_page(day, pa, pb):
    img = Image.new("RGB", (PW, PH), (252, 253, 251))
    d = ImageDraw.Draw(img)
    # header
    d.rectangle([0, 0, PW, 150], fill=PINE900)
    hf = edmund(76)
    d.text((M, 36), f"DAY {day:02d}", font=hf, fill=CREAM)
    lg = LOGO_WHITE.copy(); lg.thumbnail((300, 56))
    img.paste(lg, (PW - M - lg.width, 48), lg)
    y = 210
    y = draw_post(img, d, pa, y, PH // 2)
    # divider
    mid = max(y + 30, 1130)
    d.line([(M, mid), (PW - M, mid)], fill=(210, 216, 208), width=3)
    draw_post(img, d, pb, mid + 40, PH)
    # footer page label
    ff = mulish(30, 700)
    d.text((M, PH - 70), "Mistletoe Construction — 60-Day Social Schedule", font=ff, fill=INK_SOFT)
    pn = f"{day + 1} / 61"
    d.text((PW - M - ff.getlength(pn), PH - 70), pn, font=ff, fill=INK_SOFT)
    return img

def main():
    posts = load_posts()
    by_day = {}
    for p in posts: by_day.setdefault(p["day"], []).append(p)
    pages = [cover()]
    for day in sorted(by_day):
        ps = sorted(by_day[day], key=lambda p: p["slot"])
        pages.append(day_page(day, ps[0], ps[1]))
    out = os.path.join(ROOT, "social", "Mistletoe-60-Day-Social-Schedule.pdf")
    pages[0].save(out, "PDF", save_all=True, append_images=pages[1:], resolution=200)
    print(f"wrote {out} ({len(pages)} pages, {os.path.getsize(out)//1024//1024} MB)")

if __name__ == "__main__":
    main()
