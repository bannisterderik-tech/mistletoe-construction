#!/usr/bin/env python3
"""
Mistletoe realtor drip campaign — Resend API sender.

Usage:
  RESEND_API_KEY=re_xxx python3 tools/email_campaign.py --dry-run   # see today's batch
  RESEND_API_KEY=re_xxx python3 tools/email_campaign.py             # send today's batch
  python3 tools/email_campaign.py --status                          # campaign progress

Behavior:
- Sends at most DAILY_CAP emails per calendar day (Resend free tier = 100/day; we
  default to 90 to leave headroom for transactional sends).
- Contacts enter the 6-step sequence in CSV order; each contact gets step N only
  after `schedule_days` gaps have elapsed since their previous step.
- Only contacts with email_confidence == "published" are included unless
  --include-inferred is passed.
- Suppression: any address in data/campaign/unsubscribes.txt (one per line) is
  never emailed. Add addresses there when someone opts out.
- State lives in data/campaign/state.json (what was sent to whom, when).
- Every email includes the physical address + a mailto unsubscribe link and a
  List-Unsubscribe header (CAN-SPAM).
"""
import argparse, csv, json, os, re, sys, time, datetime, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "data", "realtors-douglas-county.csv")
SEQ_PATH = os.path.join(ROOT, "emails", "sequence.json")
STATE_PATH = os.path.join(ROOT, "data", "campaign", "state.json")
SUPPRESS_PATH = os.path.join(ROOT, "data", "campaign", "unsubscribes.txt")

DAILY_CAP = 50  # hard cap — never send more than this many in one calendar day
UNSUB_MAILTO = "alex@mistletoeconstruction.com"

WRAPPER = """<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f6f3;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f3;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
  <tr><td style="background:#1b3d26;padding:20px 32px;">
    <span style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:1px;">MISTLETOE CONSTRUCTION</span><br>
    <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#7d9a82;letter-spacing:2px;">ROOFING &amp; HOME CARE · DOUGLAS COUNTY, OREGON</span>
  </td></tr>
  <tr><td style="padding:32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f1f1f;">
    {BODY}
  </td></tr>
  <tr><td style="background:#f5f6f3;padding:20px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#4a524c;">
    Mistletoe Construction LLC · 595 E Third St, Riddle, OR 97469 · (541) 670-5005<br>
    Oregon CCB #255729 · Owens Corning contractor · <a href="https://mistletoeconstruction.com" style="color:#3f9128;">mistletoeconstruction.com</a><br>
    You're receiving this because your business contact info is publicly listed as a real estate professional in Douglas County.
    <a href="mailto:{UNSUB}?subject=Unsubscribe%20{EMAIL_ENC}" style="color:#4a524c;">Unsubscribe</a> and we'll never email you again.
  </td></tr>
</table>
</td></tr></table>
</body></html>"""


def load_state():
    try:
        return json.load(open(STATE_PATH))
    except Exception:
        return {"contacts": {}, "sent_log": []}


def save_state(st):
    os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
    json.dump(st, open(STATE_PATH, "w"), indent=1)


def load_suppressed():
    try:
        return {l.strip().lower() for l in open(SUPPRESS_PATH) if l.strip()}
    except Exception:
        return set()


def first_name(name):
    n = re.sub(r"\(#?\d+\)", "", name).strip()
    return n.split()[0].title() if n else "there"


def render(body_html, contact):
    city = (contact.get("city") or "Roseburg").strip() or "Roseburg"
    body = (body_html
            .replace("{{first_name}}", first_name(contact["name"]))
            .replace("{{brokerage}}", contact.get("brokerage") or "your brokerage")
            .replace("{{city_or_glide}}", city if city.lower() != "roseburg" else "Glide")
            .replace("{{city}}", city))
    return (WRAPPER.replace("{BODY}", body)
                   .replace("{UNSUB}", UNSUB_MAILTO)
                   .replace("{EMAIL_ENC}", contact["email"]))


def send_resend(api_key, from_addr, reply_to, to, subject, html):
    payload = json.dumps({
        "from": from_addr, "to": [to], "subject": subject, "html": html,
        "reply_to": reply_to,
        "headers": {"List-Unsubscribe": f"<mailto:{UNSUB_MAILTO}?subject=Unsubscribe>"}
    }).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails", data=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--status", action="store_true")
    ap.add_argument("--include-inferred", action="store_true")
    ap.add_argument("--cap", type=int, default=DAILY_CAP)
    args = ap.parse_args()

    seq = json.load(open(SEQ_PATH))
    steps = seq["steps"]
    gaps = seq["schedule_days"]
    bodies = {s["id"]: open(os.path.join(ROOT, "emails", s["body_file"])).read() for s in steps}

    contacts = []
    seen = set()
    for r in csv.DictReader(open(CSV_PATH)):
        em = (r.get("email") or "").strip().lower()
        if not em or "@" not in em or em in seen:
            continue
        if r.get("email_confidence") == "inferred" and not args.include_inferred:
            continue
        seen.add(em)
        contacts.append({"name": r["name"], "email": em, "brokerage": r.get("brokerage", ""),
                         "city": r.get("city", "")})

    st = load_state()
    suppressed = load_suppressed()
    today = datetime.date.today()
    today_s = today.isoformat()
    sent_today = sum(1 for e in st["sent_log"] if e["date"] == today_s)

    if args.status:
        done = sum(1 for c in st["contacts"].values() if c.get("step", 0) >= len(steps))
        active = sum(1 for c in st["contacts"].values() if 0 < c.get("step", 0) < len(steps))
        print(f"contacts eligible: {len(contacts)} · suppressed: {len(suppressed)}")
        print(f"in sequence: {active} · completed all {len(steps)} steps: {done}")
        print(f"total emails sent: {len(st['sent_log'])} · sent today: {sent_today}")
        return

    api_key = os.environ.get("RESEND_API_KEY", "")
    if not api_key and not args.dry_run:
        sys.exit("RESEND_API_KEY not set (use --dry-run to preview).")

    budget = max(0, args.cap - sent_today)
    batch = []

    # 1) due follow-ups first (contacts mid-sequence whose gap has elapsed)
    for c in contacts:
        if len(batch) >= budget: break
        if c["email"] in suppressed: continue
        rec = st["contacts"].get(c["email"])
        if not rec or rec.get("step", 0) >= len(steps): continue
        step_i = rec["step"]
        last = datetime.date.fromisoformat(rec["last_sent"])
        gap = gaps[step_i] - gaps[step_i - 1] if step_i > 0 else 0
        if (today - last).days >= gap and step_i > 0:
            batch.append((c, step_i))

    # 2) then new contacts entering step 0
    for c in contacts:
        if len(batch) >= budget: break
        if c["email"] in suppressed: continue
        if c["email"] not in st["contacts"]:
            batch.append((c, 0))

    print(f"today's batch: {len(batch)} (cap {args.cap}, already sent today {sent_today})")
    for c, step_i in batch:
        s = steps[step_i]
        if args.dry_run:
            print(f"  [dry] step {step_i+1}/{len(steps)} '{s['subject']}' -> {c['name']} <{c['email']}>")
            continue
        html = render(bodies[s["id"]], c)
        try:
            send_resend(api_key, seq["from"], seq["reply_to"], c["email"], s["subject"], html)
            st["contacts"][c["email"]] = {"name": c["name"], "step": step_i + 1, "last_sent": today_s}
            st["sent_log"].append({"date": today_s, "email": c["email"], "step": s["id"]})
            save_state(st)
            print(f"  sent step {step_i+1} -> {c['email']}")
            time.sleep(1.2)  # stay well under Resend rate limits
        except Exception as e:
            print(f"  ERROR {c['email']}: {e}")

    if not args.dry_run:
        print(f"done. total sent today: {sent_today + len(batch)}")


if __name__ == "__main__":
    main()
