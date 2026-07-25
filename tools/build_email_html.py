#!/usr/bin/env python3
"""
Generate branded HTML bodies for the realtor drip (e7-e14), extend the
14-step progressive schedule in sequence.json, and build one combined
preview email (all 14) for review.
Usage: python3 tools/build_email_html.py
"""
import os, sys, json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from email_series_pdf import EMAILS, DAYS, ROOT

EM = os.path.join(ROOT, "emails")

# step ids + body filenames, aligned to EMAILS order (1..14)
IDS = [
    "e1-intro", "e2-prelisting", "e3-repair-credit", "e4-moss",
    "e5-certification", "e6-pocket-roofer", "e7-red-flags",
    "e8-metal-vs-asphalt", "e9-wildfire", "e10-inspection-report",
    "e11-curb-appeal", "e12-financing", "e13-winter", "e14-partnership",
]


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def emph_para(s):
    return esc(s).replace("(541) 670-5005", "<strong>(541) 670-5005</strong>")


def emph_li(s):
    s = esc(s).replace("(541) 670-5005", "<strong>(541) 670-5005</strong>")
    if " — " in s:
        lead, rest = s.split(" — ", 1)
        return "<strong>" + lead + "</strong> — " + rest
    return s


def to_inner_html(body):
    out = []
    for block in body.strip().split("\n\n"):
        subs = [x.strip() for x in block.split("\n") if x.strip()]
        if len(subs) > 1 and not subs[0].startswith("Hi "):
            lead, items = "", subs
            if subs[0].endswith(":"):
                lead, items = "<p>%s</p>\n" % emph_para(subs[0]), subs[1:]
            li = "".join("<li style='margin:0 0 8px'>%s</li>" % emph_li(x) for x in items)
            out.append(lead + "<ul style='margin:0 0 16px;padding-left:22px'>%s</ul>" % li)
        else:
            out.append("<p>%s</p>" % emph_para(subs[0] if subs else ""))
    return "\n".join(out)


def main():
    # 1) write body files e7-e14 (e1-e6 already exist, leave them)
    written = []
    for i in range(6, len(EMAILS)):
        path = os.path.join(EM, IDS[i] + ".html")
        open(path, "w").write(to_inner_html(EMAILS[i]["body"]) + "\n")
        written.append(IDS[i] + ".html")

    # 2) extend sequence.json to 14 steps on the progressive cadence
    seq = json.load(open(os.path.join(EM, "sequence.json")))
    seq["schedule_days"] = DAYS
    seq["steps"] = [{"id": IDS[i], "subject": EMAILS[i]["subject"], "body_file": IDS[i] + ".html"}
                    for i in range(len(EMAILS))]
    json.dump(seq, open(os.path.join(EM, "sequence.json"), "w"), indent=1, ensure_ascii=False)

    # 3) combined preview email — all 14, brand-styled, in one message
    sections = []
    for i in range(len(EMAILS)):
        e = EMAILS[i]
        sections.append(
            "<tr><td style='padding:26px 32px 6px;'>"
            "<div style='font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;color:#3f9128;font-weight:bold;'>"
            "EMAIL %02d &nbsp;·&nbsp; SENDS DAY %d</div>"
            "<div style='font-family:Georgia,serif;font-size:19px;font-weight:bold;color:#1b3d26;margin-top:4px;'>%s</div>"
            "<div style='font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#4a524c;margin-top:2px;'>Subject line</div>"
            "</td></tr>"
            "<tr><td style='padding:8px 32px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f1f1f;border-bottom:1px solid #e6ebe6;'>%s</td></tr>"
            % (i + 1, DAYS[i], esc(e["subject"]), to_inner_html(e["body"]))
        )
    preview = """<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f6f3;">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f5f6f3;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%%;background:#ffffff;border-radius:12px;overflow:hidden;">
  <tr><td style="background:#1b3d26;padding:24px 32px;">
    <span style="font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:1px;">MISTLETOE CONSTRUCTION</span><br>
    <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#7d9a82;letter-spacing:2px;">THE REALTOR EMAIL SERIES · 14 EMAILS · DOUGLAS COUNTY, OREGON</span>
  </td></tr>
  <tr><td style="padding:24px 32px 4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#4a524c;">
    Preview of the full realtor drip — all 14 emails, in send order, on a progressively-spaced cadence (day 0 &rarr; 260). Merge fields like <code>{{first_name}}</code> fill in per recipient at send time.
  </td></tr>
  %s
  <tr><td style="background:#f5f6f3;padding:20px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#4a524c;">
    Mistletoe Construction LLC · 595 E Third St, Riddle, OR 97469 · (541) 670-5005<br>
    Oregon CCB #255729 · <a href="https://mistletoeconstruction.com" style="color:#3f9128;">mistletoeconstruction.com</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>""" % "\n".join(sections)
    open(os.path.join(EM, "all-14-preview.html"), "w").write(preview)

    # also emit a JS module so the Vercel serverless sender bundles the content
    esc_js = preview.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
    api_dir = os.path.join(ROOT, "api")
    os.makedirs(api_dir, exist_ok=True)
    open(os.path.join(api_dir, "_email-preview.js"), "w").write("module.exports = `%s`;\n" % esc_js)

    print("wrote bodies:", ", ".join(written))
    print("sequence.json steps:", len(seq["steps"]), "· schedule:", seq["schedule_days"])
    print("combined preview: emails/all-14-preview.html (%d chars)" % len(preview))


if __name__ == "__main__":
    main()
