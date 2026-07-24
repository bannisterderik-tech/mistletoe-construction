#!/usr/bin/env python3
"""Merge + dedupe realtor CSVs from data/realtors/ into data/realtors-douglas-county.csv."""
import csv, glob, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "realtors")
OUT = os.path.join(ROOT, "data", "realtors-douglas-county.csv")
FIELDS = ["name", "brokerage", "title", "phone", "email", "profile_url", "city", "source_url"]

def norm_name(n):
    n = re.sub(r"\(#?\d+\)", "", n)                # strip license numbers
    n = re.sub(r"[^a-z ]", "", n.lower()).strip()
    parts = n.split()
    if len(parts) >= 2:
        return parts[0] + " " + parts[-1]           # first + last
    return n

def norm_phone(p):
    d = re.sub(r"\D", "", p or "")
    if len(d) == 11 and d.startswith("1"): d = d[1:]
    return f"({d[0:3]}) {d[3:6]}-{d[6:10]}" if len(d) == 10 else (p or "").strip()

def score(row):
    return sum(bool(row.get(k, "").strip()) for k in ("phone", "email", "profile_url", "brokerage", "title"))

rows = {}
n_in = 0
for fp in sorted(glob.glob(os.path.join(SRC, "*.csv"))):
    with open(fp, newline="", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            r = { (k or "").strip().lower(): (v or "").strip() for k, v in r.items() }
            name = r.get("name", "")
            if not name or norm_name(name) in ("", "name"): continue
            n_in += 1
            r["phone"] = norm_phone(r.get("phone", ""))
            key = norm_name(name)
            if key in rows:
                keep, new = rows[key], r
                # merge: prefer higher-score base, fill blanks from the other
                base, other = (keep, new) if score(keep) >= score(new) else (new, keep)
                for k in FIELDS:
                    if not base.get(k, "").strip() and other.get(k, "").strip():
                        base[k] = other[k]
                rows[key] = base
            else:
                rows[key] = r

out_rows = sorted(rows.values(), key=lambda r: (r.get("city", "").lower(), r.get("brokerage", "").lower(), r.get("name", "").lower()))
with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
    w.writeheader()
    for r in out_rows: w.writerow(r)

from collections import Counter
cities = Counter(r.get("city", "?") or "?" for r in out_rows)
brokerages = Counter(r.get("brokerage", "?") or "?" for r in out_rows)
with_phone = sum(1 for r in out_rows if r.get("phone", "").strip())
with_email = sum(1 for r in out_rows if r.get("email", "").strip())
print(f"in: {n_in} rows -> out: {len(out_rows)} unique agents")
print(f"with phone: {with_phone} · with email: {with_email}")
print("top cities:", cities.most_common(8))
print("brokerages:", len(brokerages))
