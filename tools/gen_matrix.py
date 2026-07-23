#!/usr/bin/env python3
"""Generate 130 service-x-town pages for Mistletoe Construction."""
import os, json, html

ROOT = "/Users/derikbannister9/mistletoe construction"
BASE = "https://mistletoeconstruction.com"

TOWNS = {
 "roseburg": dict(name="Roseburg", mins=20,
   context="Roseburg is Douglas County's hub — and where we do more work than anywhere else. From the historic Mill-Pine district downtown to hillside homes off Stewart Parkway, Roseburg's mix of older housing stock, heavy oak-and-fir canopy, and 33 inches of annual rain keeps a roofing crew honest.",
   bullets=["Historic neighborhoods with 50+ year-old homes and original decking","Deep tree canopy that shades roofs and loads gutters every fall","Hillside lots with wind-exposed ridgelines and complex valleys"],
   nearby=["green","winston","sutherlin"]),
 "riddle": dict(name="Riddle", mins=0,
   context="Riddle is home — our shop sits at 595 E Third St, so when a neighbor calls, we're often there before the coffee's cold. This Cow Creek valley town of timber-country roots has everything from classic mill-era houses to manufactured homes and shops that all need honest, local care.",
   bullets=["We're based here — fastest response anywhere in the county","Mix of mill-era homes, manufactured homes, and outbuildings","Cow Creek valley weather: wet winters, hot canyon summers"],
   nearby=["myrtle-creek","canyonville","winston"]),
 "myrtle-creek": dict(name="Myrtle Creek", mins=10,
   context="Myrtle Creek is ten minutes from our shop, across the South Umpqua. Its older housing stock — much of it built in the timber boom — means original decking, aging flashing, and roofs that deserve a contractor who slows down instead of one who bids fast and disappears north.",
   bullets=["Older timber-boom housing with original decking and flashing","South Umpqua river-valley moisture and morning fog","Ten minutes from our Riddle shop — quick scheduling, quick response"],
   nearby=["riddle","canyonville","winston"]),
 "winston": dict(name="Winston", mins=15,
   context="Winston sits in Douglas County's banana belt — a little warmer, a little sunnier, which means summer UV works shingles harder here while winter still delivers the county's trademark rain. From the Lookingglass Valley to the neighborhoods around Wildlife Safari, we keep Winston roofs balanced against both.",
   bullets=["Banana-belt sun: more UV aging on south-facing planes","Growing residential areas alongside mid-century core homes","Lookingglass Valley wind exposure on open lots"],
   nearby=["green","roseburg","myrtle-creek"]),
 "sutherlin": dict(name="Sutherlin", mins=30,
   context="Sutherlin is really two towns: newer subdivisions built during the I-5 corridor growth years, and the mill-era core with roofs pushing past their design life. Builder-grade shingles from the boom years are coming due all at once — and we're seeing it in the calls.",
   bullets=["Builder-grade subdivision roofs aging out on a schedule","Mill-era downtown homes with layered, older roofs","Open-valley wind across the north county flats"],
   nearby=["oakland","roseburg","green"]),
 "canyonville": dict(name="Canyonville", mins=10,
   context="Canyonville takes the county's weather and funnels it: storms accelerate through the I-5 canyon gap, and the steep hillside lots around town catch wind that flatland roofs never feel. Ten minutes from our shop, it's some of the most demanding — and most familiar — terrain we work.",
   bullets=["Canyon-funneled storm winds that test shingle bonds and edges","Steep hillside lots with complex, high-pitch roofs","Ten minutes from Riddle — same-day storm response is realistic"],
   nearby=["riddle","myrtle-creek","winston"]),
 "green": dict(name="Green", mins=15,
   context="The Green District is unincorporated Roseburg-adjacent country along the Highway 99 corridor — which we drive through nearly every day. Because Green is county territory rather than city, permits run through Douglas County, and we handle that paperwork as part of every job.",
   bullets=["Highway 99 corridor — we pass through daily, response is fast","County (not city) permit jurisdiction — we handle it","Mix of established neighborhoods and rural parcels"],
   nearby=["roseburg","winston","riddle"]),
 "oakland": dict(name="Oakland", mins=35,
   context="Oakland is one of Oregon's oldest towns, with an 1890s brick downtown and homes that have watched a century of Umpqua winters. Roofs here often sit on century-old decking with brick chimneys that demand proper step and counter flashing — work for a roofer who'll slow down and do it right.",
   bullets=["Century-old homes with original decking that needs careful assessment","Brick chimneys requiring proper step and counter flashing","Historic character worth preserving with clean, period-appropriate lines"],
   nearby=["sutherlin","roseburg","green"]),
 "glide": dict(name="Glide", mins=35,
   context="Glide sits where Douglas County meets the forest — the North Umpqua corridor that burned in the 2020 Archie Creek Fire. Out here, roofing is wildfire strategy: Class A assemblies, ember-resistant details, and gutters kept clear of needle litter. It's also deep-shade country where moss never takes a season off.",
   bullets=["Post-Archie Creek wildfire awareness: Class A roofing and ember details matter","Forest-edge shade and needle litter mean relentless moss and gutter pressure","Rural properties with homes, shops, and outbuildings to keep weather-tight"],
   nearby=["roseburg","sutherlin","green"]),
 "camas-valley": dict(name="Camas Valley", mins=35,
   context="Camas Valley catches Coast Range foothills weather — noticeably wetter and windier than the I-5 corridor. It's rural, whole-property country: the house, the barn, the shop, the outbuildings. Plenty of contractors won't drive out. We do, without trip fees, because this is still our county.",
   bullets=["Coast Range foothills: wetter and windier than the valley floor","Whole-property work — homes, barns, shops, outbuildings","We actually come out here, no trip fees"],
   nearby=["winston","riddle","roseburg"]),
}

SERVICES = {
 "roof-replacement": dict(name="Roof Replacement", cat="Roofing", img="project-1.jpg",
   pitch="When patching stops making sense, we tear it off and build it right: Owens Corning architectural shingles, synthetic underlayment, ice-and-water shield in the valleys, and flashing details that keep Oregon's rain outside where it belongs.",
   body="A replacement is the one roofing decision you'll live with for decades, so we treat the invisible layers — deck condition, underlayment, flashing — as seriously as the shingles everyone sees. Douglas County doesn't allow new shingles over old ones, so every replacement is a full tear-off with a deck inspection included.",
   inc=["Free on-roof inspection with photo documentation","Douglas County permit pulled and handled by us","Full tear-off, deck repair as needed, magnetic nail sweep","Owens Corning architectural shingles with algae-resistant granules","Ice-and-water shield in valleys and at eaves","Final walkthrough — done when you'd recommend us to a neighbor"],
   guide=("roof-replacement-cost-roseburg","what a replacement really costs in this area"),
   rel=["roof-repair","metal-roofing"],
   faqs=[("How long does a roof replacement take in {town}?","Most single-family replacements in {town} take 1–3 days once materials arrive. Complex rooflines, steep pitches, or hidden deck repairs can add a day. We schedule around Oregon weather windows and dry-in the deck the same day it's opened."),
         ("Do I need a permit to replace a roof in {town}?","Yes — reroofs over 100 square feet in the {town} area require a permit, and Douglas County requires full tear-off rather than layering new shingles over old. We pull and manage the permit on every job."),
         ("What does a roof replacement cost in {town}?","Most asphalt replacements in the {town} area land roughly between $10,000 and $25,000 depending on size, pitch, complexity, and deck condition — metal runs 2–3x that upfront but lasts far longer. Your exact number is a free written estimate away.")]),
 "roof-repair": dict(name="Roof Repair", cat="Roofing", img="project-2.jpg",
   pitch="Missing shingles, storm damage, stubborn leaks — we find the real source, fix it fast, and show you photos of everything we did.",
   body="Most leaks don't start where the stain shows up. Water enters at flashing, pipe boots, or a lifted shingle, then travels along rafters before it drips. We diagnose from the roof and the attic, fix the actual entry point, and document the repair with photos so you know exactly what you paid for.",
   inc=["Leak diagnosis from roof and attic — not guesswork","Shingle, flashing, and pipe-boot repairs","Storm and wind damage response with tarping when needed","Photo documentation of every repair","Honest repair-vs-replace advice","Member priority: front of the line when storms hit"],
   guide=("roof-leak-emergency-what-to-do","what to do in the first hour of a leak"),
   rel=["roof-replacement","roof-cleaning-moss-removal"],
   faqs=[("How fast can you get to a roof repair in {town}?","We're about {mins} from {town} and prioritize active leaks. Home Care members get front-of-line emergency response with tarping included. Call or text (541) 670-5005 and send photos if you can take them safely."),
         ("Will a repair match my existing shingles in {town}?","We match manufacturer, profile, and color as closely as possible; on older roofs, some weathering difference is unavoidable and we'll show you the closest options before we start. If matching matters cosmetically, we'll tell you honestly how it will look."),
         ("Is it worth repairing an older roof in {town}?","Often yes — one damaged area on an otherwise sound roof is a repair, not a replacement. But if the roof is past 20 years with widespread granule loss, we'll tell you when repair money would be better saved for replacement. Honest answers either way.")]),
 "roof-cleaning-moss-removal": dict(name="Roof Cleaning & Moss Removal", cat="Roofing", img="hero-rain-roof.webp",
   pitch="Moss is the quiet roof killer of the Umpqua Valley. We remove it safely — never pressure washing — and set up prevention that keeps it from coming back.",
   body="With 130+ rainy days a year and heavy tree cover, moss thrives on shaded roof planes, lifting shingle edges and holding water against the deck. Our removal is gentle by design: dry brushing, targeted treatment, and rain does the rinsing — because pressure washing strips granules and can void shingle warranties.",
   inc=["Safe hand removal — never pressure washing","Moss-killing treatment that works through the rainy season","Zinc strip installation for long-term prevention","Gutter cleanup of shed debris after treatment","Prevention schedule matched to Oregon's seasons","Included maintenance for Home Care members"],
   guide=("roof-moss-prevention","the full moss removal & prevention guide"),
   rel=["gutter-cleaning","roof-repair"],
   faqs=[("How much does roof moss removal cost in {town}?","Typical moss removal jobs in the {town} area run roughly $250–$600 depending on roof size, pitch, and how established the moss is. Heavy infestations needing multiple treatments cost more — catching it early is dramatically cheaper."),
         ("When is the best time for moss removal in {town}?","Late summer through early fall. Moss is dry and weak from the summer drought, it brushes off with less shingle damage, and a preventive treatment applied before October protects {town} roofs through the wet season when moss does nearly all its growing."),
         ("Why shouldn't I pressure wash my roof in {town}?","Pressure washing strips the protective granules off asphalt shingles, forces water under shingle edges, and can void your manufacturer warranty. In a climate like {town}'s, that trades a cosmetic fix for years of roof life. We remove moss gently and let Oregon's rain do the rinsing.")]),
 "metal-roofing": dict(name="Metal Roofing", cat="Roofing", img="project-3.jpg",
   pitch="Standing seam and through-fastened metal: 40–70 year lifespans, moss slides off instead of digging in, and a Class A fire rating that matters in Douglas County.",
   body="Metal costs more upfront — typically 2–3x asphalt — but on cost per year of roof life it frequently wins, especially where moss pressure and wildfire exposure are real. We install both standing seam (concealed fasteners, cleanest look) and through-fastened panels (economical, great for shops and barns), and we'll tell you honestly when asphalt is the better fit.",
   inc=["Standing seam and through-fastened panel systems","Class A fire-rated assemblies","Sheds moss, needles, and debris that plague asphalt here","Solid decking and underlayment for quiet, tight installs","40–70 year expected service life","Honest comparison against asphalt for your specific roof"],
   guide=("metal-vs-asphalt-oregon","our honest metal vs asphalt comparison"),
   rel=["roof-replacement","general-contracting"],
   faqs=[("Is a metal roof worth it in {town}?","Often, yes. Metal runs 2–3x asphalt upfront but lasts 40–70 years, sheds the moss and debris that eat asphalt roofs around {town}, and carries a Class A fire rating. On a cost-per-year basis it frequently wins — and we'll show you both numbers in a free estimate."),
         ("Is a metal roof loud in the rain in {town}?","Not the way people fear. Installed over solid decking and underlayment — the way we do it — a metal roof is comparable to asphalt in rain noise. The tin-roof drumming people remember comes from open-framed barns and porches without decking underneath."),
         ("Can metal be installed over my existing roof in {town}?","Douglas County requires tear-off rather than roofing over existing shingles, and honestly that's how we'd build it anyway — tear-off lets us inspect and repair the deck, then start the new system clean. We handle permit and disposal as part of the job.")]),
 "siding": dict(name="Siding", cat="Exterior", img="bg/green-house.jpg",
   pitch="Professional siding installation and replacement that stands up to sideways Oregon rain — and looks sharp doing it.",
   body="Winter storms here don't drop rain politely from above; wind drives it sideways into walls. Siding is your home's rain jacket, and when it fails, rot starts where you can't see it. We inspect what's behind old siding before we quote, so you're never surprised mid-project.",
   inc=["Siding replacement and new installation","Moisture and rot inspection behind existing siding","Weather-resistant barrier and flashing integration","Kick-out flashing at roof-wall intersections — where rot starts","Trim, caulk, and paint-ready finish detail","Matched or upgraded looks for your home's era"],
   guide=("roof-flashing-guide","how flashing keeps walls and roofs dry"),
   rel=["roof-replacement","gutter-cleaning"],
   faqs=[("How do I know my siding needs replacement in {town}?","Look for soft or bubbling boards, gaps at seams, paint that won't hold, or interior moisture on exterior walls. In {town}'s wind-driven winter rain, failing siding lets water into the wall cavity long before it shows inside — an exterior inspection settles it."),
         ("What siding holds up best in {town}'s climate?","Fiber cement and quality lap systems handle the wet winters and hot, dry summers around {town} well; the install details — housewrap, flashing, clearances — matter as much as the material. We spec for the weather your walls actually face."),
         ("Can you match my existing siding in {town}?","Usually yes — profile and reveal can be matched or closely approximated, and paint solves the rest. On partial replacements we'll show you the match before committing, and tell you honestly when a full side or full house makes more sense.")]),
 "gutter-cleaning": dict(name="Gutter Cleaning", cat="Exterior", img="bg/green-2.jpg",
   pitch="Clogged gutters rot fascia, flood foundations, and back water under shingles. We clean, repair, and keep water going where it should.",
   body="Under fir and oak canopy, gutters load up twice a year minimum — needle litter in fall, seed and debris in spring. When they overflow, the damage chain runs from fascia rot to foundation pooling to landscape washout. Members get gutter maintenance on a schedule, so it's never on your list.",
   inc=["Full gutter and downspout cleaning and flush","Sagging gutter and hanger repair","Fascia condition check while we're up there","Debris haul-away","Fall and spring scheduling matched to leaf drop","Included maintenance for Home Care members"],
   guide=("gutter-guide-oregon-rain","sizing and caring for gutters in Oregon rain"),
   rel=["gutter-guards","roof-cleaning-moss-removal"],
   faqs=[("How often should gutters be cleaned in {town}?","Twice a year minimum under {town}'s tree cover — after fall leaf drop and again in spring. Homes under heavy fir canopy often need a mid-winter check too, since needle litter keeps coming down through the storm season."),
         ("What happens if I skip gutter cleaning in {town}?","Overflowing gutters rot fascia boards, dump water against the foundation, and can back water up under the roof edge. A $200 cleaning skipped becomes fascia replacement, drainage work, or a roof-edge repair — the most avoidable expensive problem in the county."),
         ("Do you repair gutters too, or just clean them in {town}?","Both. Sagging runs, failed hangers, leaking seams, and crushed downspouts are all repairable, and we'll flag fascia rot before it spreads. If a run is past saving, we'll say so and quote a replacement honestly.")]),
 "gutter-guards": dict(name="Gutter Guard Installation", cat="Exterior", img="bg/green-3.jpg",
   pitch="Professionally installed guards that handle fir needles — turning a twice-a-year dirty job into a quick occasional check.",
   body="Honest version first: no guard eliminates maintenance under conifers. But the right guard — fine micro-mesh, properly pitched — keeps needles and leaves out of the trough so water keeps moving all winter. The junk foam and brush inserts you see at big-box stores clog worse than open gutters; we don't install them.",
   inc=["Micro-mesh guard systems that handle fir needles","Installation matched to your existing gutters","Pitch and flow check on every run","Honest guidance on what guards can and can't do","Dramatically reduced cleaning — not zero, and we say so","Pairs with a full cleaning at install time"],
   guide=("gutter-guide-oregon-rain","the full Oregon gutter guide"),
   rel=["gutter-cleaning","roof-cleaning-moss-removal"],
   faqs=[("Do gutter guards really work in {town}?","Good ones, yes — with an honest asterisk. Micro-mesh guards keep {town}'s fir needles and oak leaves out of the trough so water keeps flowing, but fine debris still settles on top and needs an occasional brush-off. Guards cut the work dramatically; nothing eliminates it under conifers."),
         ("Which gutter guards handle fir needles best in {town}?","Fine micro-mesh systems. Needles bridge across the mesh and blow or brush off instead of packing the trough. Foam inserts and brush-style guards actually trap needle litter and make things worse — we don't install them."),
         ("Can guards go on my existing gutters in {town}?","Usually yes, if the gutters themselves are sound and properly pitched. We check slope, hangers, and fascia condition at install — putting good guards on failing gutters just hides the problem, and we'd rather fix it first.")]),
 "general-contracting": dict(name="General Contracting", cat="Whole Home", img="bg/green-house.jpg",
   pitch="One licensed local contractor for the whole list — remodels, additions, repairs, and the projects that never quite make it to the top of the pile.",
   body="We're licensed as a general contractor (Oregon CCB #255729), which means the same family-owned crew that handles your roof can run your remodel, addition, or repair list — with permits, scheduling, and trades coordinated by one accountable local company.",
   inc=["Remodels, additions, and home repairs","Permit handling with Douglas County","Project management and trade coordination","The same licensed, insured crew — CCB #255729","Written scopes with real numbers","Roof-to-foundation whole-home perspective"],
   guide=("verify-oregon-contractor-ccb","how to verify any Oregon contractor"),
   rel=["decks","flooring"],
   faqs=[("What kinds of projects do you take on in {town}?","Everything from repair lists and bathroom refreshes to additions and structural work around {town}. If it's beyond our crew's trade, we coordinate licensed specialists and manage the project — one point of accountability, one written scope."),
         ("Do you handle permits for projects in {town}?","Yes. {town}-area projects permit through Douglas County, and we handle the paperwork, inspections, and scheduling as part of the job. Unpermitted work bites homeowners at sale time — we don't do it."),
         ("Are you licensed for general contracting work in {town}?","Yes — Mistletoe Construction LLC is a licensed Oregon general contractor, CCB #255729, insured and bonded. You can verify our license in about two minutes on the Oregon CCB site, and our guide shows you exactly how.")]),
 "decks": dict(name="Deck Building", cat="Property", img="bg/green-2.jpg",
   pitch="Custom decks built for real Oregon seasons — wet winters that test every fastener, and summer evenings that make it all worth it.",
   body="A deck here has to survive eight wet months to earn four glorious ones. That means ground contact done right, flashing at the ledger (the #1 deck failure point), and materials chosen for moisture — cedar for warmth and workability, composite for set-and-forget.",
   inc=["Custom design and build — cedar and composite","Ledger flashing done like roofers do it (obsessively)","Proper footings and ground-contact detailing","Railings, stairs, and code compliance","Permit handling when size or height requires it","Maintenance guidance for the wet season"],
   guide=("verify-oregon-contractor-ccb","how to vet any contractor before you hire"),
   rel=["fences","landscaping"],
   faqs=[("Cedar or composite for a deck in {town}?","Cedar costs less upfront and feels like Oregon, but wants cleaning and sealing on a schedule. Composite runs more but shrugs off {town}'s wet winters with a rinse. We build both and will give you the honest total-cost picture for your use."),
         ("Do I need a permit to build a deck in {town}?","Depends on size and height — larger and taller decks around {town} typically permit through Douglas County, and attached decks have structural requirements either way. We know the thresholds and handle the paperwork when it's required."),
         ("When is the best time to build a deck in {town}?","We build year-round in weather windows, but late spring through early fall is smoothest. Want it ready for summer? Start the conversation in winter — design, permits, and materials take lead time, and the calendar fills fast.")]),
 "fences": dict(name="Fence Building", cat="Property", img="bg/green-3.jpg",
   pitch="Quality fences with the posts set right — because around here, it's almost always the posts that fail first.",
   body="Wind and wet soil kill fences from the ground up. We set posts with proper gravel bases and concrete done correctly, so the fence that looks straight on day one still looks straight after five winters. Privacy, field fencing, gates, and repairs — built or fixed honestly.",
   inc=["Privacy, boundary, and field fencing","Posts set with gravel base and proper concrete","Gate building and hardware that keeps working","Repairs and post replacement — not just full builds","Wind-exposure planning for open lots","Material guidance for wet-climate longevity"],
   guide=("verify-oregon-contractor-ccb","how to vet any contractor in 2 minutes"),
   rel=["decks","landscaping"],
   faqs=[("What fence lasts longest in {town}'s climate?","Cedar with posts set on gravel bases (so end grain isn't sitting in a concrete cup of water) is the wet-climate workhorse around {town}; metal post options extend life further. The install details matter more than the brochure — it's almost always the posts that go first."),
         ("Do you repair fences in {town} or only build new ones?","Both. Leaning runs, rotted posts, sagging gates — most fences are saveable if the failure is caught early. We'll tell you honestly when a repair is throwing money at a fence that's done."),
         ("How long does a typical fence take in {town}?","Most residential fences around {town} take a few days once materials are on site — post setting, cure time, then rails and boards. Weather affects concrete cure in winter; we schedule accordingly and tell you the real timeline up front.")]),
 "flooring": dict(name="Flooring", cat="Interior", img="bg/green-house.jpg",
   pitch="Quality flooring installation — LVP, laminate, hardwood, and tile — with subfloor honesty before a single plank goes down.",
   body="Flooring is only as good as what's under it. We check subfloors for moisture, softness, and level before quoting — and if there's a problem, you get photos and a price before we proceed, not a surprise invoice after. In a wet climate, moisture-appropriate material choice per room is everything.",
   inc=["LVP, laminate, hardwood, and tile installation","Subfloor inspection with photo documentation","Moisture-appropriate material guidance per room","Level and transition detailing","Furniture and old-floor handling options","Tie-in with larger remodel projects"],
   guide=("storm-damage-insurance-claims-oregon","when water damage becomes an insurance claim"),
   rel=["general-contracting","roof-repair"],
   faqs=[("What flooring handles {town}'s climate best?","Luxury vinyl plank owns the wet-entry and kitchen zones — waterproof and tough. Hardwood is beautiful in living spaces but wants stable humidity; tile is forever in baths. We'll match material to each room's real moisture exposure in your {town} home."),
         ("Do you fix subfloors in {town} or just install over them?","We fix them. Soft spots, moisture damage, and out-of-level areas get documented with photos and priced before installation continues. Installing beautiful flooring over a bad subfloor is a waste of your money — we won't do it."),
         ("How long does flooring installation take in {town}?","Most single-room jobs take a day or two; whole-home projects run several days depending on material and subfloor work. LVP goes fast, tile and hardwood take longer. You'll get a real timeline in the written estimate.")]),
 "landscaping": dict(name="Landscaping", cat="Property", img="bg/green-2.jpg",
   pitch="Landscaping that works for your property — including the part nobody talks about: moving water away from your house.",
   body="Good landscaping here does double duty. It looks right against the Umpqua hills, and it manages the 30+ inches of rain that want to end up against your foundation. In fire country, it's also your first defense: the 'lean, clean, and green' zone that keeps embers from finding fuel beside the house.",
   inc=["Design and installation for real Oregon seasons","Drainage and water management around the home","Defensible-space planning for wildfire zones","Planting matched to wet winters and dry summers","Hardscape, borders, and cleanup","Seasonal maintenance planning"],
   guide=("wildfire-resistant-roofing-oregon","the wildfire home-hardening picture"),
   rel=["fences","gutter-cleaning"],
   faqs=[("Can landscaping really protect my foundation in {town}?","Yes — grading, drainage paths, and smart planting move roof and surface water away from the house instead of against it. Around {town}, where winter delivers most of 30+ inches of rain, drainage is the least glamorous, highest-value landscaping decision."),
         ("What is fire-wise landscaping for {town} properties?","Keep the first five feet around the house lean, clean, and green: no bark mulch against siding, no resinous shrubs under eaves, limbs up off the roof. In Douglas County's fire environment it protects your home and increasingly matters to insurers."),
         ("When should landscaping work happen in {town}?","Planting favors fall and spring; drainage and hardscape work is best in the dry season when soil cooperates. We plan {town} projects around that calendar so nothing gets installed into a mud pit or a drought.")]),
 "pool-installation": dict(name="Pool Installation", cat="Property", img="bg/green-3.jpg",
   pitch="Professional pool installation, managed like the serious site-work project it is — so your backyard is the destination by the time July hits 86°.",
   body="A pool is excavation, drainage, utilities, and coordination long before it's swimming. As a licensed general contractor we manage the site work, the trades, and the county paperwork with one accountable point of contact — and we're honest about timelines: plan in winter, swim in summer.",
   inc=["Site evaluation, excavation, and prep","Drainage planning — critical in our wet season","Trade and utility coordination","Permit handling with Douglas County","Decking, fencing, and landscape tie-ins","Realistic start-to-swim timelines"],
   guide=("verify-oregon-contractor-ccb","how to vet the contractor running your project"),
   rel=["fences","landscaping"],
   faqs=[("What does pool installation involve in {town}?","Site evaluation, excavation, drainage, utility runs, the pool system itself, then decking and safety fencing — coordinated across several trades. In the {town} area we manage the whole sequence with one written scope and one accountable contractor."),
         ("When should I start planning a pool in {town}?","Winter. Design, permits, and scheduling take months of lead time, and installers' summer calendars fill early. Homeowners who start planning in December are swimming in July; those who call in June are swimming next year."),
         ("Do pools need permits in {town}?","Yes — pools involve electrical, plumbing, and safety-barrier requirements permitted through Douglas County. We handle the permitting and inspections as part of managing the project.")]),
}

HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canon}">
<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="https://mistletoeconstruction.com/images/{img}">
<link rel="icon" type="image/png" href="/images/logo-badge.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Karla:ital,wght@0,400..800;1,400..800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/main.css">
<script type="application/ld+json">
{service_ld}
</script>
<script type="application/ld+json">
{crumb_ld}
</script>
<script type="application/ld+json">
{faq_ld}
</script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/" aria-label="Mistletoe Construction — home">
      <img src="/images/logo-lockup-white.png" alt="Mistletoe Construction LLC" width="1342" height="251">
    </a>
    <button class="nav-toggle" aria-expanded="false" aria-label="Menu"><span></span><span></span><span></span></button>
    <nav class="nav-main" aria-label="Main">
      <a href="/services/">Services</a>
      <a href="/membership.html">Membership</a>
      <a href="/locations/" aria-current="page">Service Areas</a>
      <a href="/guides/">Guides</a>
      <a href="/our-work.html">Our Work</a>
      <a href="/about.html">About</a>
      <a class="nav-phone" href="tel:+15416705005">(541) 670-5005</a>
      <a class="btn btn-primary nav-cta" href="/contact.html">Free Estimate</a>
    </nav>
  </div>
</header>
"""

FOOTER = """
<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div class="footer-brand">
        <img src="/images/logo-lockup-white.png" alt="Mistletoe Construction LLC">
        <address>595 E Third St<br>Riddle, Oregon 97469</address>
        <p style="margin-top:0.8rem"><a href="tel:+15416705005">(541) 670-5005</a> · call or text<br><a href="mailto:Mistletoeconstructionllc@gmail.com">Mistletoeconstructionllc@gmail.com</a></p>
      </div>
      <div>
        <h4>Services</h4>
        <ul>
          <li><a href="/services/roof-replacement.html">Roof Replacement</a></li>
          <li><a href="/services/roof-repair.html">Roof Repair</a></li>
          <li><a href="/services/roof-cleaning-moss-removal.html">Moss Removal</a></li>
          <li><a href="/services/metal-roofing.html">Metal Roofing</a></li>
          <li><a href="/services/siding.html">Siding</a></li>
          <li><a href="/services/gutter-guards.html">Gutter Guards</a></li>
          <li><a href="/services/">All 12 services →</a></li>
        </ul>
      </div>
      <div>
        <h4>Service Areas</h4>
        <ul>
          <li><a href="/locations/roseburg.html">Roseburg</a></li>
          <li><a href="/locations/riddle.html">Riddle</a></li>
          <li><a href="/locations/myrtle-creek.html">Myrtle Creek</a></li>
          <li><a href="/locations/winston.html">Winston</a></li>
          <li><a href="/locations/sutherlin.html">Sutherlin</a></li>
          <li><a href="/locations/">All of Douglas County →</a></li>
        </ul>
      </div>
      <div>
        <h4>Company</h4>
        <ul>
          <li><a href="/membership.html">Home Care Membership</a></li>
          <li><a href="/our-work.html">Our Work</a></li>
          <li><a href="/guides/">Guides &amp; Resources</a></li>
          <li><a href="/faq.html">FAQ</a></li>
          <li><a href="/about.html">About Us</a></li>
          <li><a href="/contact.html">Contact</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-legal">
      <span>© 2026 Mistletoe Construction LLC</span>
      <span>Oregon CCB #255729 · Licensed &amp; Insured</span>
      <span>Owens Corning Contractor</span>
      <span>Family-owned in Riddle, Oregon</span>
    </div>
  </div>
</footer>

<div class="callbar">
  <a class="btn btn-outline on-dark" href="tel:+15416705005">☎ Call / Text</a>
  <a class="btn btn-primary" href="/contact.html">Free Estimate</a>
</div>

<script src="/js/main.js" defer></script>
</body>
</html>
"""

def mins_phrase(m):
    return "right here in town — we're your neighbors" if m == 0 else f"about {m} minutes from our shop in Riddle"

def esc(s): return s.replace("&", "&amp;").replace('"', "&quot;")

count = 0
for tslug, T in TOWNS.items():
    outdir = os.path.join(ROOT, "locations", tslug)
    os.makedirs(outdir, exist_ok=True)
    for sslug, S in SERVICES.items():
        town, svc = T["name"], S["name"]
        mins = T["mins"]
        minsphrase = mins_phrase(mins)
        minsfaq = "based right here in " + town if mins == 0 else f"{mins} minutes away"
        url = f"{BASE}/locations/{tslug}/{sslug}.html"
        title = f"{svc} in {town}, OR | Mistletoe Construction"
        desc = f"{svc} in {town}, Oregon from a family-owned Douglas County contractor {minsphrase.replace(' — we', ', we')}. Oregon CCB #255729 · Owens Corning contractor. Free estimates: (541) 670-5005."
        if len(desc) > 190:
            desc = f"{svc} in {town}, Oregon — family-owned, {minsphrase}. Oregon CCB #255729. Free estimates: (541) 670-5005."

        faqs = [(q.format(town=town, mins=(f"{mins} minutes" if mins else "zero minutes")),
                 a.format(town=town, mins=(f"{mins} minutes" if mins else "based right here"))) for q, a in S["faqs"]]

        service_ld = json.dumps({
            "@context": "https://schema.org", "@type": "Service",
            "name": f"{svc} in {town}, Oregon", "serviceType": svc,
            "provider": {"@id": f"{BASE}/#business"},
            "areaServed": {"@type": "City", "name": town,
                           "containedInPlace": {"@type": "AdministrativeArea", "name": "Douglas County, Oregon"}},
            "url": url}, indent=2)
        crumb_ld = json.dumps({
            "@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE}/"},
                {"@type": "ListItem", "position": 2, "name": "Service Areas", "item": f"{BASE}/locations/"},
                {"@type": "ListItem", "position": 3, "name": town, "item": f"{BASE}/locations/{tslug}.html"},
                {"@type": "ListItem", "position": 4, "name": svc, "item": url}]}, indent=2)
        faq_ld = json.dumps({
            "@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": q,
                            "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]}, indent=2)

        inc_lis = "\n            ".join(f"<li>{b}</li>" for b in S["inc"])
        local_lis = "\n            ".join(f"<li>{b}</li>" for b in T["bullets"])
        faq_details = "\n      ".join(
            f'<details class="faq-item"><summary>{esc(q)}</summary><div class="faq-a"><p>{a}</p></div></details>'
            for q, a in faqs)
        rel_cards = "\n        ".join(
            f'<a class="card" href="/locations/{tslug}/{r}.html"><span class="card-tag">Also in {town}</span><h3>{SERVICES[r]["name"]}</h3><p>{SERVICES[r]["pitch"][:110]}…</p><span class="card-more">→</span></a>'
            for r in S["rel"])
        nearby_cards = "\n        ".join(
            f'<a class="card" href="/locations/{n}/{sslug}.html"><span class="card-tag">Nearby</span><h3>{svc} in {TOWNS[n]["name"]}</h3><p>Same crew, same craftsmanship — serving {TOWNS[n]["name"]} too.</p><span class="card-more">→</span></a>'
            for n in T["nearby"][:2])
        gslug, gdesc = S["guide"]

        page = HEAD.format(title=esc(title), desc=esc(desc), canon=url, img=S["img"],
                           service_ld=service_ld, crumb_ld=crumb_ld, faq_ld=faq_ld) + f"""
<main id="main">
  <section class="page-hero">
    <div class="wrap on-dark">
      <nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/locations/">Service Areas</a></li><li><a href="/locations/{tslug}.html">{town}</a></li><li>{svc}</li></ol></nav>
      <p class="kicker on-dark">{S["cat"]} · {town}, Oregon</p>
      <h1>{svc} in {town}, Oregon.</h1>
      <p class="hero-lede">{S["pitch"]} We're {minsphrase} — family-owned, licensed (Oregon CCB #255729), and already working in {town}.</p>
      <div class="hero-ctas">
        <a class="btn btn-primary" href="/contact.html">Get a Free Estimate</a>
        <a class="btn btn-outline on-dark" href="tel:+15416705005">Call (541) 670-5005</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="split">
        <div>
          <p class="kicker">Local Knowledge</p>
          <h2>Why {town} homes call us for {svc.lower()}.</h2>
          <p>{T["context"]}</p>
          <p>{S["body"]}</p>
          <ul class="checklist">
            {local_lis}
          </ul>
        </div>
        <div class="split-media">
          <img src="/images/{S["img"]}" alt="{svc} work by Mistletoe Construction serving {town}, Oregon" loading="lazy">
        </div>
      </div>
    </div>
  </section>

  <section class="section section-dark on-dark">
    <div class="wrap">
      <div class="split">
        <div>
          <p class="kicker on-dark">What's Included</p>
          <h2>{svc}, done the Mistletoe way.</h2>
          <ul class="checklist">
            {inc_lis}
          </ul>
        </div>
        <div>
          <p class="kicker on-dark">Worth Reading</p>
          <h3>Before you decide, read this.</h3>
          <p>We publish the stuff other contractors keep vague — see {gdesc}: <a href="/guides/{gslug}.html" style="color:var(--ochre)">read the guide</a>.</p>
          <p>And if you'd rather never think about this again: our <a href="/membership.html" style="color:var(--ochre)">Home Care Membership</a> covers inspections, maintenance, priority service, and member pricing from $49/month.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="section section-cream">
    <div class="wrap">
      <div class="section-head">
        <p class="kicker">Questions</p>
        <h2>{svc} in {town} — FAQs</h2>
      </div>
      {faq_details}
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <p class="kicker">Keep Exploring</p>
        <h2>More for {town} homeowners.</h2>
      </div>
      <div class="grid grid-2">
        {rel_cards}
        {nearby_cards}
      </div>
      <p style="margin-top:2rem"><a class="btn btn-outline" href="/locations/{tslug}.html">Everything we do in {town}</a> <a class="btn btn-outline" href="/services/{sslug}.html" style="margin-left:0.6rem">All about {svc.lower()}</a></p>
    </div>
  </section>

  <section class="cta-band on-dark">
    <div class="wrap">
      <div>
        <h2>{town}, let's get it done right.</h2>
        <p>Free written estimates from your neighbors {minsphrase.replace("about ", "")} — honest answers, local craftsmanship.</p>
      </div>
      <div class="cta-actions">
        <a class="btn btn-primary" href="/contact.html">Get a Free Estimate</a>
        <a class="btn btn-outline on-dark" href="tel:+15416705005">Call (541) 670-5005</a>
      </div>
    </div>
  </section>
</main>
""" + FOOTER

        with open(os.path.join(outdir, f"{sslug}.html"), "w", encoding="utf-8") as f:
            f.write(page)
        count += 1

print(f"Generated {count} service-x-town pages")

# ---- Inject "Services in <Town>" link blocks into the 10 town pages ----
for tslug, T in TOWNS.items():
    tp = os.path.join(ROOT, "locations", f"{tslug}.html")
    src = open(tp, encoding="utf-8").read()
    marker = f'<!-- svc-matrix-{tslug} -->'
    if marker in src:
        continue
    links = "\n        ".join(
        f'<li><a href="/locations/{tslug}/{s}.html">{SERVICES[s]["name"]} in {T["name"]}</a></li>'
        for s in SERVICES)
    block = f"""
  {marker}
  <section class="section section-deep">
    <div class="wrap">
      <div class="section-head">
        <p class="kicker">Every Service, Locally</p>
        <h2>Everything we do in {T["name"]}, in detail.</h2>
        <p class="lede">Dedicated local pages for every service we offer in {T["name"]} — what's included, local considerations, and honest answers.</p>
      </div>
      <ul class="checklist" style="grid-template-columns:repeat(auto-fit,minmax(16rem,1fr))">
        {links}
      </ul>
    </div>
  </section>

"""
    idx = src.find('<section class="cta-band')
    if idx == -1:
        print(f"WARN: no cta-band in {tp}"); continue
    open(tp, "w", encoding="utf-8").write(src[:idx] + block + "  " + src[idx:])
    print(f"injected town links into {tslug}.html")

# ---- Inject "Where we offer this" blocks into the 13 service pages ----
for sslug, S in SERVICES.items():
    sp = os.path.join(ROOT, "services", f"{sslug}.html")
    src = open(sp, encoding="utf-8").read()
    marker = f'<!-- town-matrix-{sslug} -->'
    if marker in src:
        continue
    links = "\n        ".join(
        f'<li><a href="/locations/{t}/{sslug}.html">{S["name"]} in {TOWNS[t]["name"]}</a></li>'
        for t in TOWNS)
    block = f"""
  {marker}
  <section class="section section-deep">
    <div class="wrap">
      <div class="section-head">
        <p class="kicker">Where We Offer This</p>
        <h2>{S["name"]} across Douglas County.</h2>
        <p class="lede">Local details for every town we serve — same family-owned crew, same standards, wherever you are in the county.</p>
      </div>
      <ul class="checklist" style="grid-template-columns:repeat(auto-fit,minmax(16rem,1fr))">
        {links}
      </ul>
    </div>
  </section>

"""
    idx = src.find('<section class="cta-band')
    if idx == -1:
        print(f"WARN: no cta-band in {sp}"); continue
    open(sp, "w", encoding="utf-8").write(src[:idx] + block + "  " + src[idx:])
    print(f"injected town links into services/{sslug}.html")

print("done")
