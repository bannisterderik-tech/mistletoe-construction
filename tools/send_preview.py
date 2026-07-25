#!/usr/bin/env python3
"""
Send the combined 14-email realtor series as ONE preview email via Resend,
to Derik + Alex, from the branded hi.mistletoeconstruction.com sender.

Usage:
  RESEND_API_KEY=re_xxx python3 tools/send_preview.py

The key is read from the environment only — it is never stored or printed.
"""
import os, sys, json, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FROM = "Alex Smith - Mistletoe Construction <alex@hi.mistletoeconstruction.com>"
REPLY_TO = "alex@mistletoeconstruction.com"
TO = ["bannisterderik@gmail.com", "alex@mistletoeconstruction.com"]
SUBJECT = "The Realtor Email Series - all 14 emails (preview)"


def main():
    key = os.environ.get("RESEND_API_KEY")
    if not key:
        sys.exit("RESEND_API_KEY not set.\nRun:  RESEND_API_KEY=re_xxx python3 tools/send_preview.py")

    html = open(os.path.join(ROOT, "emails", "all-14-preview.html")).read()
    # fill merge fields with example values so the preview reads naturally
    html = (html.replace("{{first_name}}", "there")
                .replace("{{city_or_glide}}", "Glide")
                .replace("{{brokerage}}", "your brokerage")
                .replace("{{city}}", "Roseburg"))

    payload = json.dumps({
        "from": FROM, "to": TO, "reply_to": REPLY_TO,
        "subject": SUBJECT, "html": html,
    }).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails", data=payload,
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            res = json.loads(r.read())
        print("Sent ✓  id:", res.get("id"), "→", ", ".join(TO))
    except urllib.error.HTTPError as e:
        sys.exit("Resend error %s: %s" % (e.code, e.read().decode()[:500]))


if __name__ == "__main__":
    main()
