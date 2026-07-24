#!/usr/bin/env python3
"""Regenerate js/partners-data.js from data/realtors-douglas-county.csv."""
import csv, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = list(csv.DictReader(open(os.path.join(ROOT, "data/realtors-douglas-county.csv"))))
partners = [{
    "name": r["name"], "brokerage": r["brokerage"], "title": r["title"],
    "phone": r["phone"], "email": r["email"], "confidence": r.get("email_confidence",""),
    "city": r["city"], "profile": r.get("profile_url","")
} for r in rows]
with open(os.path.join(ROOT, "js/partners-data.js"), "w") as f:
    f.write("/* Generated from data/realtors-douglas-county.csv — regen: tools/partners_to_js.py */\n")
    f.write("window.MC_PARTNERS = " + json.dumps(partners, separators=(",", ":")) + ";\n")
print("partners:", len(partners))
