#!/usr/bin/env python3
"""Fold enriched emails into the master realtor list + pattern-infer the gaps.
Output: data/realtors-douglas-county.csv with email_source & email_confidence columns.
PATTERNS is filled from enrichment-agent reports: brokerage-substring -> (domain, pattern)
where pattern is one of: first, last, firstlast, first.last, flast, firstl
"""
import csv, glob, os, re, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = os.path.join(ROOT, "data", "realtors-douglas-county.csv")
FIELDS = ["name", "brokerage", "title", "phone", "email", "email_source", "email_confidence",
          "profile_url", "city", "source_url"]

# brokerage substring (lowercase) -> (domain, pattern) — CONFIRMED patterns only
PATTERNS = {
    # confirmed by ≥2 published same-pattern addresses (enrichment reports, Jul 2026)
    "exp": ("exprealty.com", "first.last"),
    "berkshire": ("bhhsrep.com", "firstlast"),
    "bhhs": ("bhhsrep.com", "firstlast"),
    "all-pro": ("apr-advisors.com", "first"),
    "different better": ("anthonybeckham.com", "first"),
    "beckham": ("anthonybeckham.com", "first"),
    "north county": ("northcountyrealty.net", "first"),
    "umpqua legacy": ("ulrealty.com", "first"),
}

def norm_name(n):
    n = re.sub(r"\(#?\d+\)", "", n)
    n = unicodedata.normalize("NFKD", n)
    n = re.sub(r"[^a-z ]", "", n.lower()).strip()
    p = n.split()
    return (p[0] + " " + p[-1]) if len(p) >= 2 else n

def parts(name):
    n = re.sub(r"\(#?\d+\)", "", name)
    n = re.sub(r"[^A-Za-z ]", "", n).strip().lower().split()
    return (n[0], n[-1]) if len(n) >= 2 else (n[0] if n else "", "")

def apply_pattern(name, domain, pat):
    f, l = parts(name)
    if not f or not l: return ""
    local = {"first": f, "last": l, "firstlast": f + l, "first.last": f + "." + l,
             "flast": f[0] + l, "firstl": f + l[0]}.get(pat, "")
    return f"{local}@{domain}" if local else ""

rows = list(csv.DictReader(open(MASTER, newline="", encoding="utf-8")))
by_key = {norm_name(r["name"]): r for r in rows}

found = 0
for fp in sorted(glob.glob(os.path.join(ROOT, "data", "realtors", "enriched-*.csv"))):
    for e in csv.DictReader(open(fp, newline="", encoding="utf-8-sig")):
        k = norm_name(e.get("name", ""))
        em = (e.get("email") or "").strip()
        if k in by_key and em and "@" in em:
            r = by_key[k]
            if not (r.get("email") or "").strip():
                r["email"] = em
                r["email_source"] = (e.get("email_source") or "").strip()
                r["email_confidence"] = "published"
                found += 1

inferred = 0
for r in rows:
    if (r.get("email") or "").strip():
        if not r.get("email_confidence"): r["email_confidence"] = "published"
        continue
    b = (r.get("brokerage") or "").lower()
    for sub, (domain, pat) in PATTERNS.items():
        if sub in b:
            em = apply_pattern(r["name"], domain, pat)
            if em:
                r["email"] = em
                r["email_source"] = f"inferred from confirmed {domain} pattern"
                r["email_confidence"] = "inferred"
                inferred += 1
            break

with open(MASTER, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
    w.writeheader()
    for r in rows: w.writerow(r)

total = len(rows)
with_email = sum(1 for r in rows if (r.get("email") or "").strip())
print(f"total {total} · newly published {found} · inferred {inferred} · with email now {with_email}")
