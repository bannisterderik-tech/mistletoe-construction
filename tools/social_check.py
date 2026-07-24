#!/usr/bin/env python3
"""Validate social content batches + emit CALENDAR.md with captions."""
import json, glob, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATES = {"dark", "light", "photo", "myth", "stat"}
errors, posts = [], []

for fp in sorted(glob.glob(os.path.join(ROOT, "social/content/batch*.json"))):
    try:
        data = json.load(open(fp))
    except Exception as e:
        errors.append(f"{os.path.basename(fp)}: JSON parse error: {e}"); continue
    for p in data:
        pid = p.get("id", "?")
        def err(m): errors.append(f"{pid}: {m}")
        for k in ("id", "day", "slot", "type", "template", "category", "slides", "caption", "hashtags"):
            if k not in p: err(f"missing {k}")
        if p.get("type") not in ("still", "carousel"): err("bad type")
        if p.get("template") not in TEMPLATES: err(f"bad template {p.get('template')}")
        slides = p.get("slides", [])
        if p.get("type") == "still" and len(slides) != 1: err(f"still needs 1 slide, has {len(slides)}")
        if p.get("type") == "carousel" and not (3 <= len(slides) <= 5): err(f"carousel needs 3-5 slides, has {len(slides)}")
        if p.get("photo"):
            if not os.path.exists(os.path.join(ROOT, "images", p["photo"])): err(f"photo missing: {p['photo']}")
        for i, s in enumerate(slides):
            t = s.get("template", p.get("template"))
            if t not in TEMPLATES: err(f"slide {i+1} bad template {t}")
            if t == "photo" and not (p.get("photo") or s.get("photo")): err(f"slide {i+1} photo template but no photo set")
            if s.get("photo") and not os.path.exists(os.path.join(ROOT, "images", s["photo"])): err(f"slide {i+1} photo missing {s['photo']}")
            for field, lim in (("kicker", 34), ("headline", 90), ("body", 200), ("myth", 70), ("truth", 80), ("big", 7)):
                if s.get(field) and len(s[field]) > lim: err(f"slide {i+1} {field} too long ({len(s[field])})")
            for b in s.get("bullets", []):
                if len(b) > 56: err(f"slide {i+1} bullet too long: {b[:40]}…")
        hs = p.get("hashtags", [])
        if not (6 <= len(hs) <= 14): err(f"{len(hs)} hashtags")
        posts.append(p)

# coverage + uniqueness
ids = [p["id"] for p in posts]
dupes = {i for i in ids if ids.count(i) > 1}
if dupes: errors.append(f"duplicate ids: {sorted(dupes)}")
want = {f"d{d:02d}{s}" for d in range(1, 61) for s in "ab"}
missing = want - set(ids)
if missing: errors.append(f"missing {len(missing)} posts: {sorted(missing)[:8]}…")

print(f"posts: {len(posts)}  errors: {len(errors)}")
for e in errors[:40]: print(" ", e)

if not errors and "--calendar" in sys.argv:
    posts.sort(key=lambda p: (p["day"], p["slot"]))
    lines = ["# Mistletoe Construction — 60-Day Social Calendar",
             "", "Two posts per day. Images in `social/out/` (carousels = numbered slides + auto CTA card).", ""]
    for p in posts:
        n_imgs = len(p["slides"]) + (1 if p["type"] == "carousel" else 0)
        imgs = p["id"] + ".png" if n_imgs == 1 else f"{p['id']}-1.png … {p['id']}-{n_imgs}.png"
        lines += [f"## Day {p['day']} · Post {p['slot']} — {p['type'].title()} ({p['category']})",
                  f"**Images:** {imgs}", "",
                  p["caption"], "",
                  " ".join(p["hashtags"]), "", "---", ""]
    open(os.path.join(ROOT, "social/CALENDAR.md"), "w").write("\n".join(lines))
    print("wrote social/CALENDAR.md")
sys.exit(1 if errors else 0)
