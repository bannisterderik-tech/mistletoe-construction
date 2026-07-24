# Realtor Drip Campaign — how to run it

## One-time setup
1. Create a free account at resend.com (free tier: 100 emails/day, 3,000/mo).
2. Add and verify the sending domain `mistletoeconstruction.com` in Resend
   (Domains → Add → add the DKIM/SPF DNS records they show you at your DNS host).
   Without this, deliverability will be garbage — do not skip.
3. Create an API key (Resend → API Keys) and keep it out of git.

## Daily send (one command)
    RESEND_API_KEY=re_xxx python3 tools/email_campaign.py

- Caps at 90/day (free tier headroom). Run it once a day — cron/launchd or by hand.
- Preview without sending: add `--dry-run` · Progress: `--status`
- Sequence: 6 educational emails over ~4 weeks (emails/sequence.json + e*.html).
- Only "published"-confidence emails are used; add `--include-inferred` to widen
  (verify those addresses first).

## Unsubscribes (do this daily, it's the law)
Any reply asking to stop, or any "Unsubscribe" email: add that address on its own
line to data/campaign/unsubscribes.txt. The sender never emails a listed address.
Every email already includes the physical address + unsubscribe link (CAN-SPAM).

## State
data/campaign/state.json tracks who got which step when — back it up; deleting it
restarts everyone at step 1.
