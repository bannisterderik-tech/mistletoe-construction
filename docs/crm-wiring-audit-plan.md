# Mistletoe Admin CRM — Wiring Audit & Execution Plan

## 1. THE MAP (per flow)

### Flow A — Lead → Customer
| Action | File | Status |
|---|---|---|
| New Lead modal (create) | admin/leads.html | ✅ |
| Search / sort / owner / service filters | admin/leads.html | ✅ |
| Kanban drag between stages | admin/leads.html | 🟡 proposal-stage drops revert (derived logic demotes) |
| Card click → detail drawer | admin/leads.html | ✅ |
| Lead panel: View / Edit linked proposal | admin/leads.html | ✅ |
| Lead panel: Move-stage buttons | admin/leads.html | 🟡 highlight uses raw stage, disagrees w/ derived; proposal-stage clicks revert |
| Lead panel: Assign select | admin/leads.html | ✅ |
| Lead panel: Create proposal → | admin/leads.html | 🟡 no dedupe — dup customer every click |
| Lead panel: Call | admin/leads.html | ✅ (dials, logs nothing) |
| Lead panel: Delete | admin/leads.html | ✅ (orphans spawned customer) |
| **Edit lead core fields** (name/phone/email/city/service/note) | admin/leads.html | ⬜ **absent** |
| **Send proposal from lead** | admin/leads.html | ⬜ missing |
| **Log call outcome / follow-up date / activity log** | admin/leads.html | ⬜ missing |
| Row 'View' → legacy modal (customers) | admin/customers.html | 🟡 inferior duplicate UI (no proposals, notes-only save) |
| Customer profile drawer | admin/customers.html | ✅ |
| **Add job / Add visit from profile** | admin/customers.html | ⬜ edit-only, no create |
| Toggle membership after creation | admin/customers.html | ⬜ no member field in editor |
| Edit proposal status in profile | admin/customers.html | 🟡 writes legacy string, sets no milestone → deal never advances |

### Flow B — Proposal → Invoice → Money
| Action | File | Status |
|---|---|---|
| New / Edit / Send / Resend / Copy-link proposal | admin/proposals.html | ✅ |
| Edit proposal at invoiced/paid status | admin/proposals.html | 🟡 silently desyncs local amount from issued Stripe invoice |
| Delete proposal w/ Stripe invoice or signature | admin/proposals.html | 🟡 orphans Stripe/agreement, no warning |
| 'Open / PDF' link | admin/proposals.html | 🟡 label lies — opens web page, no PDF |
| Timeline drawer: save billing, mark complete, send balance | admin/proposals.html | ✅ |
| Timeline: 'Linked lead' name | admin/proposals.html | 🟡 plain text, not a link |
| Link lead | admin/proposals.html | ✅ (row only when unlinked) |
| `advanceLead()` stub + dead code after `return` | admin/proposals.html | ❌ dead code |
| '+ New Invoice' (tracking-only) | admin/invoices.html | 🟡 no Stripe/email, parallel path |
| Filters / search / mark-paid / open Stripe | admin/invoices.html | ✅ |
| 'Manage in Proposals →' | admin/invoices.html | 🟡 goes to list, not `?edit=<id>` |
| 'View customer →' | admin/invoices.html | 🟡 list, no id |
| Money: '+ New Proposal' redirect | admin/money.html | ✅ |
| Money: est-modal (ne-save/ne-cancel/ne-customer) | admin/money.html | ❌ dead code — never opened |
| Money: 'Convert to Invoice' | admin/money.html | 🟡 relabels locally, no Stripe invoice |
| Money: drawer nav links | admin/money.html | 🟡 generic lists, no ids |

### Flow C — Ops (Jobs / Schedule / Members / Team / Partners / Pricing / Social)
| Action | File | Status |
|---|---|---|
| New job / advance status / assign / add visit note / delete | admin/jobs.html | ✅ |
| Job drawer 'View customer →' | admin/jobs.html | ❌ list, no id |
| **Create job from proposal / store proposal_id** | admin/jobs.html | ⬜ jobs are an island |
| Job complete advances pipeline / fires balance | admin/jobs.html | ⬜ inert (different field than proposal.job_completed_at) |
| Add to schedule / visit drawer | admin/schedule.html | ✅ |
| Job rows on schedule | admin/schedule.html | ❌ inert, not clickable |
| Reschedule / move existing event | admin/schedule.html | ⬜ missing |
| Visit 'View customer →' | admin/schedule.html | ❌ list, no id |
| Member roster / log visit / drawer | admin/members.html | ✅ |
| Member 'Open full profile →' | admin/members.html | ❌ list, no id |
| Member drawer visits/invoices lists | admin/members.html | 🟡 display-only, not clickable |
| Add member / set member=true here | admin/members.html | ⬜ missing |
| Partner search/sort/status/drawer | admin/partners.html | ✅ |
| Partner filter buttons active-state | admin/partners.html | 🟡 no is-on highlight |
| Partner delete in demo mode | admin/partners.html | 🟡 undefined id, array not spliced |
| Team add seat / activate-deactivate | admin/team.html | ✅ |
| Edit / delete seat | admin/team.html | ⬜ deactivate-only; typo'd email (RLS key) permanent |
| Team stat cards → filter | admin/team.html | ❌ dead |
| Pricing save / preview / load | admin/pricing.html | ✅ |
| Reset-to-defaults / unsaved guard | admin/pricing.html | ⬜ missing |
| Social composer / queue / bulk / connect | admin/social.html | ✅ |
| Social 'View live ↗' (#pmOpen) | admin/social.html | ❌ never un-hidden, dead |

### Flow D — Dashboard
| Action | File | Status |
|---|---|---|
| Sidebar nav / role gate / logout | admin/index.html | ✅ |
| '+ Lead' / '+ Proposal' buttons | admin/index.html | 🟡 imply create, only go to list |
| 5 stat cards (Leads/Jobs/Pipeline/Owed/Members) | admin/index.html | ❌ all dead — no drill-down |
| 'Needs your attention' Open → links | admin/index.html | ✅ (list, not specific record) |
| 'This week' table rows | admin/index.html | ❌ plain text, no link to job/customer |
| 'Full schedule →' | admin/index.html | ✅ |

### Customer-facing + API
| Action | File | Status |
|---|---|---|
| Proposal Download-PDF / agree / paylink / open-beacon | proposal.html | ✅ |
| Proposal '#p-accept' button | proposal.html | 🟡 records nothing — dup of #p-agree |
| Contract sign → accept → Stripe redirect | contract.html | ✅ happy path |
| Contract email field validation | contract.html | 🟡 no client-side validation |
| **Post-sign invoice failure** | contract.html | ❌ false "we'll email your invoice shortly" — no invoice, no email |
| get / send / accept / sign / final-invoice / cron / track / lead APIs | api/*.js | ✅ |
| `accepted_at` distinct from deposit-invoiced | api/accept-proposal.js | 🟡 written same instant — 'Accepted' stage never exists alone |
| `stripe-webhook` unconfigured | api/stripe-webhook.js | ❌ silent — whole back half of pipeline never records paid |
| create-lead-proposal.js | api/create-lead-proposal.js | ❌ orphan, zero front-end callers, CRON-gated |
| Hardcoded cron fallback token | api/final-invoice-cron.js | 🟡 weak secret guards money endpoint |

---

## 2. THE LEAD PANEL — what "everything" means

Today the panel (admin/leads.html `openLeadPanel`) does: read-only details, linked-proposal View/Edit, move-stage buttons, assign select, Create-proposal, Call, Delete. To be complete, wire in:

1. **Edit lead** — inline editor for name / phone / email / city / service / note (reuse the customers.html `openRecordForm` pattern). *The single biggest gap.*
2. **Contact actions row** — Call (tel:, exists), **Text** (sms: link), **Email** (mailto: prefilled). All one-tap.
3. **Send proposal** — if a draft proposal is linked, a Send button that POSTs `/api/send-proposal` right here (no trip to proposals.html).
4. **Create proposal (deduped)** — reuse existing customer if the lead was already converted; never mint a second customer. If already converted, show "Customer created ✓ →" linking to that customer record instead of a fresh add.
5. **Create ANOTHER proposal** — allow a second proposal for the same lead/customer (repeat/upsell) without duplicating the customer.
6. **View timeline** — jump straight into the linked proposal's Timeline drawer (billing & schedule), not just `?edit=`.
7. **Log a note / call outcome** — append-only activity log with timestamp ("called, LVM"), instead of a set-once creation note.
8. **Follow-up / next-action date** — a date field that surfaces the lead on the dashboard "Needs attention" list when due.
9. **Book inspection / site visit** — create a `visit` (or scheduled job) for this lead's customer directly, feeding schedule.html.
10. **Stage that matches reality** — kill the misleading manual proposal-stage buttons (or disable them until a proposal is linked); highlight the DERIVED stage, not raw `lead.stage`.
11. **Link to converted customer** — a persistent "View customer →" once conversion has happened (closes the one-way lead↔customer gap).
12. **Invoice/deal status link** — the milestone label should link to the invoice / Money doc for the deal.

---

## 3. RANKED BACKLOG

### P0 — dead-ends / broken flows (do first)
- **contract.html:330 false-success on invoice failure** — when accept-proposal returns no url, stop showing "we'll email your invoice shortly"; show a real error + retry, alert admin. `contract.html`. **M**
- **stripe-webhook not configured = silent pipeline stall** — add an admin-visible health check / banner when `deposit_paid_at` never lands (or document required Vercel/Stripe setup as a release blocker). `api/stripe-webhook.js` + admin banner. **M**
- **Leads: 'Create proposal →' dedupe** — reuse existing customer, block duplicate creation on repeat clicks / already-won leads. `admin/leads.html`. **M**
- **Jobs drawer 'View customer →' dead-end** — pass `?id=` and make customers.html honor it (see cross-link fix). `admin/jobs.html` + `admin/customers.html`. **S**
- **Schedule 'View customer →' dead-end** — same `?id=` fix. `admin/schedule.html`. **S**
- **Members 'Open full profile →' dead-end** — same `?id=` fix. `admin/members.html`. **S**
- **Schedule job rows inert** — add click → open job (link to jobs.html or a drawer). `admin/schedule.html`. **S**
- **Dashboard stat cards dead** — wrap all 5 in links to their lists (Leads→leads, Jobs→jobs, Pipeline→proposals, Owed→money, Members→members). `admin/index.html`. **S**
- **money.html est-modal dead code** — delete the unreachable modal + ne-save/ne-cancel handlers (or wire it; redirect already supersedes it, so delete). `admin/money.html`. **S**
- **proposals.html `advanceLead()` dead stub** — remove the no-op and unreachable code after `return`. `admin/proposals.html`. **S**
- **create-lead-proposal.js orphan** — remove, or add an admin-auth variant and wire a lead-side button to it. `api/create-lead-proposal.js`. **S**
- **social '#pmOpen' dead control** — remove (per-platform ↗ links already cover it). `admin/social.html`. **S**

### P1 — high-value wiring + cross-links
- **Lead panel: edit core fields** (see §2.1). `admin/leads.html`. **M**
- **Lead panel: Send proposal + Text/Email actions** (§2.2–2.3). `admin/leads.html`. **M**
- **Lead panel: activity log + follow-up date** (§2.7–2.8). `admin/leads.html`. **L**
- **Lead panel: View-timeline jump** into proposal Timeline drawer, not `?edit=`. `admin/leads.html` + `admin/proposals.html` (`?timeline=<id>`). **S**
- **customers.html: honor `?id=` deep-link** to auto-open a profile drawer (unblocks 3 P0 dead-ends above). `admin/customers.html`. **S**
- **customers.html: Add Job / Add Visit** buttons in profile (create, not just edit). `admin/customers.html`. **M**
- **customers.html: membership toggle** in the inline editor. `admin/customers.html`. **S**
- **customers.html: proposal status editor sets milestones** (or is removed and defers fully to Timeline). `admin/customers.html`. **M**
- **customers.html: kill legacy 'View' modal** — make the row 'View' open the full drawer. `admin/customers.html`. **S**
- **Job ↔ Proposal link** — add `proposal_id`/`lead_id` to jobs; "Create job from accepted deal" action in Timeline; job-complete advances proposal `job_completed_at`. `admin/jobs.html`, `admin/proposals.html`, schema. **L**
- **Invoice/Money → deal deep-links** — 'Manage in Proposals →' uses `?edit=<id>` (or `?timeline=<id>`); 'View customer →' passes `?id=`. `admin/invoices.html`, `admin/money.html`. **S**
- **Timeline 'Linked lead' → hyperlink** to leads.html (deep-link that opens the card). `admin/proposals.html` + `admin/leads.html` (`?lead=<id>`). **S**
- **Dashboard 'This week' + attention rows → specific records** (deep-link job/customer/lead by id). `admin/index.html`. **M**
- **proposal.html '#p-accept' records acceptance** — set `accepted_at` server-side on click so 'Accepted' is a real stage distinct from deposit-invoiced. `proposal.html` + `api/*`. **M**

### P2 — polish
- **Leads: fix move-stage highlight** to use derived stage; disable proposal-stage buttons when no proposal linked. `admin/leads.html`. **S**
- **Proposals: guard edit on invoiced/paid** — warn before amount change desyncs Stripe. `admin/proposals.html`. **S**
- **Proposals: guard delete** with Stripe invoice / signature warning. `admin/proposals.html`. **S**
- **Proposals: rename 'Open / PDF'** to 'Open' (no PDF produced). `admin/proposals.html`. **S**
- **Partners: filter-button active state** (is-on toggle like social chips). `admin/partners.html`. **S**
- **Team: edit/delete seat** + stat-card click-to-filter. `admin/team.html`. **M**
- **Pricing: Reset-to-defaults + unsaved-changes guard + change audit.** `admin/pricing.html`. **M**
- **Dashboard '+ Lead'/'+ Proposal'** open the create modal directly (`?new=1`). `admin/index.html`. **S**
- **contract.html: email field validation** before sign. `contract.html`. **S**
- **cron token: remove hardcoded fallback**, fail closed if env unset. `api/final-invoice-cron.js`, `api/create-lead-proposal.js`. **S**
- **Members: 'Add member' / set member=true** action. `admin/members.html`. **S**
- **Schedule: reschedule/move existing event.** `admin/schedule.html`. **M**
- **Deposit-invoice link preserved** — don't let balance invoice overwrite `stripe_invoice_url`; keep both. `api/_final-invoice.js`, `api/get-proposal.js`, `proposal.html`. **M**

---

## 4. CROSS-LINK GAPS (the missing jumps)

| From → To | Reality | Fix |
|---|---|---|
| **Customer → its lead** | one-way, lost after conversion | store `lead_id` on customer; link in profile |
| **Lead → its customer** | Create-proposal makes customer, no back-link, dups | dedupe + persistent "View customer →" |
| **Customer/Lead → proposal Timeline** | only `?edit=` or plain text | `?timeline=<id>` deep-link into drawer |
| **Job → proposal / deal** | no `proposal_id` at all — total island | add FK + Timeline "create job", surface link both ways |
| **Job complete → balance invoice** | different field, inert | job-complete sets `proposal.job_completed_at`, fires cron path |
| **Invoice/Money → deal** | 'Manage in Proposals →' hits the list | `?edit=<id>` / `?timeline=<id>` |
| **Invoice/Money → specific customer** | 'View customer →' hits bare list | pass `?id=`, customers.html opens drawer |
| **Jobs/Schedule/Members → customer** | 'View customer →' / 'Open full profile' = bare list | `?id=` deep-link (3 dead-ends, one shared fix) |
| **Schedule job row → job** | not clickable | click → jobs.html / drawer |
| **Proposal Timeline → lead** | linked-lead name is plain text | hyperlink to `leads.html?lead=<id>` |
| **Dashboard stat card → filtered list** | all 5 dead | wrap in links |
| **Dashboard 'This week'/attention → record** | list-level only | deep-link by id |
| **Partner → referred leads** | no attribution exists | link partner→leads filtered by referrer |
| **Deposit invoice link (customer)** | overwritten by balance invoice | preserve both URLs |

**One shared unlock:** make `customers.html` honor `?id=` (open the profile drawer on load). That single change clears the Jobs, Schedule, Members, Invoices, and Money "View customer →" dead-ends at once — do it first in P1.

Files referenced (absolute): `/Users/derikbannister9/mistletoe construction/admin/{leads,customers,proposals,invoices,money,jobs,schedule,members,partners,team,pricing,social,index}.html`, `/Users/derikbannister9/mistletoe construction/{proposal,contract}.html`, `/Users/derikbannister9/mistletoe construction/api/{accept-proposal,create-final-invoice,_final-invoice,final-invoice-cron,get-proposal,stripe-webhook,create-lead-proposal}.js`.