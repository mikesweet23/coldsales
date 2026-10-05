# Outbound — Sales Outreach PWA
## Build Specification & Content Brief (v0.1 — first draft)

> Drop this file into the root of a new repo as `SPEC.md` and use it as the single source of truth for the build. Everything the app needs — framework, content, page structure, data model, styling and PWA setup — is in here.

---

## 0. Purpose

A mobile-first Progressive Web App that sales directors and sales reps save to their phone home screen. It turns "I'm working the client" into a visible, structured outreach programme, and gives reps an easy-to-deploy set of scripts, questions and skills they can rotate so they never sound the same twice.

**The problem it solves:** the team already knows how to find the right companies and people (ICP and personas are not the issue). What's missing is a repeatable answer to *"what do I actually do once I've got a name?"*

**Design principles**
- One-thumb use on a phone, mid-day, between meetings or in the car park before a call.
- Nothing complicated. Every screen should be usable in under 10 seconds.
- Content is variety-first: every script area has multiple interchangeable lines the rep can swipe through or shuffle.
- Works fully offline. No login, no backend for v1. All data stored on the device.
- **Branding:** black and red visual identity (see Section 7). **No company name, logo or reference to "adi" anywhere in the app.**

---

## 1. Working Name & Tagline

- **App name (working):** Outbound
- **Short name (home screen):** Outbound
- **Tagline:** *Work the client. Every day.*

(Name is a placeholder — easy to change in `manifest.json` and one constant in the code.)

---

## 2. The Framework (what the app teaches)

The app is built around three layers. These also mirror the 90-minute training session (Section 9).

### Layer 1 — The Outreach Ladder (the strategy)
"Working the client" means moving each contact up a ladder of touches, from cold to warm to meeting. A contact is never just "called once".

| Rung | Touch type | Purpose |
|---|---|---|
| 1 | **Research** | 5 minutes on the company and person: sites, recent news, projects, LinkedIn activity |
| 2 | **LinkedIn connect** | Connection request with a short, non-salesy note |
| 3 | **LinkedIn engage** | Like / comment thoughtfully on 2–3 of their posts or company posts |
| 4 | **Cold call** | First voice contact using the core skills |
| 5 | **Cold email** | Short, plain-text email — sent same day as call or as a voicemail follow-up |
| 6 | **Mushroom** | Find and connect with 2–3 other people in the same organisation (other sites, other functions, other levels) |
| 7 | **Warm call** | Follow-up call that references a previous touch |
| 8 | **Warm email** | Follow-up email adding value (case study, insight, question) |
| 9 | **Meeting booked** | Goal of the sequence |
| 10 | **Nurture** | Not now ≠ never. Light touch every 4–6 weeks |

### Layer 2 — The Cadence (the rhythm)
A default 21-day sequence per contact (the app auto-generates these tasks when a contact is added — see Section 5):

| Day | Action |
|---|---|
| 1 | Research + LinkedIn connect |
| 2 | Engage with a post (like/comment) |
| 3 | Cold call #1 → if no answer, voicemail + cold email #1 |
| 5 | Cold call #2 |
| 7 | Mushroom: connect with 2 colleagues at the same company |
| 8 | Cold email #2 (different angle) |
| 10 | Call #3 (warm if any reply/engagement, otherwise cold) |
| 14 | LinkedIn message (value, not pitch) |
| 17 | Warm/cold call #4 |
| 21 | "Close the loop" email (polite break-up) |
| 21+ | Move to Nurture (every 4–6 weeks) or Meeting |

Reps can skip, reschedule or mark tasks done.

### Layer 3 — The Five Core Skills (the behaviours)
These are the "easy to deploy" skills that run across every call, email and message. Each has its own page in the app with an explanation, example lines and a practice prompt.

1. **Call out the elephant** — say the obvious thing out loud ("This is a cold call", "We've never spoken"). Removes tension instead of pretending it isn't there.
2. **Micro-contracting** — get a small, explicit agreement before moving on ("Can I take 30 seconds to tell you why I called, then you decide if it's worth carrying on?"). Puts the prospect in control.
3. **Name the feeling (labelling)** — notice and say what the other person might be feeling ("Sounds like you get a lot of these calls"). Lowers their guard.
4. **Curiosity over pitching** — ask questions that get them talking about their situation rather than explaining what we do.
5. **Permission to say no** — make "no" a safe answer ("If it's not relevant, just say so and I'll leave you alone"). Paradoxically makes "yes" more likely and gets honest answers.

### Influences (for the "Learn" section — paraphrased, not quoted)
- **Benjamin Dennehy style** — brutally honest, upfront about the cold call, refuses to chase, prospects must qualify themselves, pattern-interrupt openers.
- **Jeremy Miner / NEPQ style** — calm, curious, neutral tone; staged questions (situation → problem awareness → consequence → solution awareness → commitment) so the prospect talks themselves into change.
- **Sandler style** — up-front contracts (agree the agenda, time and possible outcomes), the pain funnel (go from surface problem to business and personal impact), "no is OK".

The app presents these as three "voices" a rep can choose from for each script (Section 4.3 tagging).

---

## 3. Target Personas (pre-loaded)

Used as filters on the Scripts pages and as a field on each contact.

- Engineering Director
- Engineering / Maintenance Manager
- Facilities Manager / Head of Facilities
- Operations Director / Site Director
- Procurement / Category Manager
- Project Manager / Capital Projects Lead
- Energy / Sustainability Manager
- Health & Safety / Compliance Lead

Sectors (filter + contact field): Manufacturing, Food & Beverage, Pharmaceutical, Aerospace, Automotive, Logistics/Warehousing, Commercial/Other.

Service themes (used to tailor lines): HVAC maintenance, Chiller replacement, Heat pumps / decarbonisation, LEV, Refrigeration, Process cooling, Energy saving, Compliance (F-Gas etc.).

---

## 4. Content Library

All content lives in a single `content.json` (or `content.js`) so it can be edited without touching app logic. Each item has an `id`, `category`, `stage`, `voice`, `personas[]`, `text`, and optional `notes`.

### 4.1 Cold Call — structured by stage
The Cold Call page is a step-by-step flow. Each stage has 4–8 interchangeable lines. The rep swipes left/right (carousel) or taps **Shuffle** to change the line. Tapping a line marks it "used today".

**Stage 1 — Opener (call out the elephant)**
- "Hi [Name], it's [Rep] — I'll be honest, this is a cold call. Do you want to hang up now, or give me 30 seconds?" *(Dennehy)*
- "Hi [Name], [Rep] here. We've never spoken before, so I know this is out of the blue — have I caught you at a terrible time?" *(NEPQ)*
- "Hi [Name], this is [Rep]. You don't know me, and I'm interrupting your day — can I tell you why I called and then you can decide if we carry on?" *(Sandler)*
- "Hi [Name], it's [Rep]. This is a sales call — I'll be quick and you can tell me to get lost if it's not relevant. Fair?"
- "Hi [Name], [Rep] calling. I'm guessing you weren't sitting there hoping a contractor would ring today?"
- "Hi [Name], it's [Rep]. Cold call, I'm afraid — is now a really bad time, or have you got a minute?"

**Stage 2 — Micro-contract**
- "Can I take 30 seconds to tell you why I called, and if it's not relevant you just tell me?"
- "Here's what I'd suggest — I'll ask you a couple of quick questions, and if there's nothing there, we both get on with our day. OK?"
- "If at any point this sounds like a waste of time, just say so — deal?"
- "Would it be OK if I asked a couple of questions to see whether there's any point us talking?"
- "Give me a minute, and if I haven't said anything useful, you can hang up. Sound fair?"

**Stage 3 — Reason for the call (short, no pitch)**
- "We look after HVAC and mechanical plant for manufacturing sites — chillers, heat pumps, process cooling. I've no idea whether that's relevant to you right now."
- "I speak to a lot of engineering directors who are juggling ageing plant and pressure to cut energy. I don't know if that's you."
- "Most people I call are either happy with their current setup or have one or two things that keep them up at night. I'm not sure which camp you're in."
- "We tend to get called when chillers are getting old, energy bills are climbing, or there's a compliance headache. Is any of that on your radar?"

**Stage 4 — Situation questions (curiosity)**
- "How are you currently handling HVAC and mechanical maintenance across your sites?"
- "Who looks after your chillers and cooling plant at the moment?"
- "Roughly how old is the main plant on site?"
- "Is maintenance in-house, a contractor, or a bit of both?"
- "What's the setup for process cooling — is it on its own system or shared?"
- "When did you last look at what the plant is costing you to run?"
- "How many sites are you responsible for?"

**Stage 5 — Problem awareness**
- "How's that working out for you?"
- "Is there anything about the current setup that frustrates you?"
- "If you could change one thing about how the plant's looked after, what would it be?"
- "When was the last unplanned breakdown, and what happened?"
- "Is there anything you know needs doing but keeps getting pushed back?"
- "How confident are you the plant gets through next summer without a problem?"

**Stage 6 — Consequence / pain funnel (go deeper)**
- "What happens if that doesn't get sorted?"
- "What did that breakdown end up costing — in downtime or otherwise?"
- "How long has that been an issue?"
- "What have you tried so far?"
- "Who else feels the pain when that goes wrong?"
- "How does that affect you personally?"
- "On a scale of 1 to 10, how much of a priority is fixing it?"

**Stage 7 — Name the feeling (use any time)**
- "Sounds like you get a lot of these calls."
- "You sound a bit sceptical — that's fair."
- "It sounds like that's been a real thorn in your side."
- "I get the sense you've been let down by a contractor before."
- "Sounds like you've got more on your plate than you've got people."
- "It sounds like now's not great timing."

**Stage 8 — Close for the meeting (with permission to say no)**
- "Would it be worth 15 minutes next week to see if there's a fit — or is that a waste of your time?"
- "Would it make sense to get together so I can understand your setup properly? If there's nothing there, I'll tell you."
- "How about a quick site walk-round — no obligation — and if we can't add anything, I'll say so?"
- "Shall we put 20 minutes in the diary, and if it's not for you, you tell me no and that's fine?"
- "What would need to be true for it to be worth you meeting us?"

**Stage 9 — Common brush-offs (respond, don't fight)**
| Brush-off | Example responses |
|---|---|
| "Send me an email" | "Happy to — so I don't send you rubbish, what would actually be useful to you?" / "Sure. Most people say that to get me off the phone — is that what's happening here? Totally fine if so." |
| "We've already got someone" | "Makes sense — most good sites do. How's it going with them?" / "Great. If you could change one thing about them, what would it be?" |
| "Not interested" | "That's fine. Can I ask — is it not interested in us, or not interested in looking at the plant at all right now?" |
| "No budget" | "Understood. When does budget planning start for next year?" / "Is that no budget at all, or no budget for something that isn't a problem yet?" |
| "Too busy" | "Sounds like it's full on. Is there a better time, or would you rather I didn't call back?" |
| "Call me in six months" | "Happy to. What's likely to be different in six months?" |

**Stage 10 — Voicemail (keep under 20 seconds)**
- "Hi [Name], it's [Rep] — cold call, I'll be honest. I'll drop you a short email; if it's relevant, great, if not, no problem. [Number]."
- "Hi [Name], [Rep]. Quick one about your cooling plant — not urgent. I'll try you again [day]. [Number]."
- "Hi [Name], [Rep] here. You don't know me — I'll send a two-line email so you can decide if it's worth a chat."

### 4.2 Warm Call (there's been a previous touch)
**Openers (reference the touch)**
- "Hi [Name], it's [Rep] — we connected on LinkedIn last week. Thought I'd put a voice to the name. Have you got a minute?"
- "Hi [Name], [Rep] here — I sent you an email on [day]. I'm guessing it got buried. Is it OK to take 60 seconds?"
- "Hi [Name], it's [Rep]. [Colleague name] mentioned you look after the plant at [site] — have I got the right person?"
- "Hi [Name], [Rep]. We spoke briefly back in [month] and you said to call around now. Is now still OK?"
- "Hi [Name], it's [Rep]. I saw your post about [topic] — it got me thinking, can I ask you something about it?"

**Bridge / micro-contract**
- "Last time you mentioned [issue] — has anything changed since?"
- "I promised I'd come back to you when [trigger]. Is now a good moment, or shall I try another day?"
- "Can I check — is [issue] still on your list, or has it been sorted?"

**Deepen (reuse Stage 4–6 questions from Cold Call)**

**Close**
- "Last time it sounded like [issue] was costing you. Worth getting together to look at it properly?"
- "Would it help if I brought [engineer/specialist] along so you get a straight answer?"

### 4.3 Cold Email Templates
Rules shown in-app: plain text, under 100 words, one question, no attachments on first email, subject line lower-case and short.

**Template A — Honest cold**
> Subject: cold email — sorry
> Hi [Name],
> I'll be upfront — this is a cold email and we've never spoken.
> We look after HVAC and process cooling for manufacturing sites. I've no idea if that's relevant to you.
> If ageing plant, energy costs or reliability are on your radar, would it be worth a 15-minute chat? If not, just say so and I won't chase.
> [Rep]

**Template B — Curiosity question**
> Subject: quick question about [site]
> Hi [Name],
> Quick one — who looks after the chillers and cooling plant at [site] at the moment?
> I ask because a lot of the engineering directors I speak to are managing older plant with less budget than they'd like.
> If that's you, happy to share what others are doing. If not, ignore me.
> [Rep]

**Template C — After a voicemail**
> Subject: just left you a voicemail
> Hi [Name],
> Just tried you — no worries you weren't free.
> Short version: we help sites like [site] keep cooling and heating plant reliable and cheaper to run. Is that worth 15 minutes, or is it not a priority right now?
> [Rep]

**Template D — Problem-led**
> Subject: summer breakdowns
> Hi [Name],
> Most cooling plant failures we see happen on the hottest week of the year, when everyone's already stretched.
> How confident are you that [site]'s plant gets through next summer?
> If the honest answer is "not very", worth a chat?
> [Rep]

**Template E — Energy angle**
> Subject: plant running costs
> Hi [Name],
> Pumps, fans and chillers are usually the biggest energy users on a site after process kit — and often the easiest to cut.
> Have you looked at what yours cost to run recently?
> Happy to share a quick way to estimate it if useful.
> [Rep]

**Template F — Break-up / close the loop (Day 21)**
> Subject: closing the loop
> Hi [Name],
> I've tried you a few times and haven't heard back, which usually means one of three things: it's not a priority, you've got it covered, or you've been buried.
> Any of those is fine — just let me know which and I'll stop chasing.
> [Rep]

### 4.4 Warm Email Templates
**Follow-up after a call**
> Subject: following our call
> Hi [Name], thanks for the time today. You mentioned [issue] and that it's been [consequence]. As promised, here's [one useful thing]. Shall we pencil in [day] for [meeting/site walk]? [Rep]

**Value add (no ask)**
> Subject: thought of you
> Hi [Name], saw this and it reminded me of what you said about [issue]: [one-line insight / case study]. No need to reply. [Rep]

**Re-engage (nurture)**
> Subject: still on your list?
> Hi [Name], we spoke back in [month] about [issue]. Has that been sorted, or is it still hanging around? [Rep]

**Referral / mushroom**
> Subject: [Colleague name] suggested I get in touch
> Hi [Name], I've been speaking with [colleague] about [topic] and they mentioned you look after [area]. Would it be useful to compare notes? [Rep]

### 4.5 LinkedIn
**Connection notes (under 200 characters)**
- "Hi [Name] — I work with engineering teams across manufacturing on HVAC and cooling. Would be good to connect."
- "Hi [Name], noticed we're both in the [sector] world. Happy to connect."
- "Hi [Name] — saw your post on [topic], really interesting. Would be great to connect."

**Post engagement ideas**
- Comment with a genuine question, not "great post".
- Congratulate on new roles, projects, awards, site openings.
- Share their company's post with a one-line comment.

**Your own posts (suggested weekly)**
- A lesson learned on a job (anonymised).
- A quick tip (e.g. one sign your chiller is struggling).
- A photo from site with a one-line story.
- A question to your network.

**LinkedIn messages (after connecting — value, not pitch)**
- "Thanks for connecting [Name]. Out of interest, what's the biggest headache on the engineering side at the moment?"
- "Thanks for connecting. No pitch — if plant or energy ever becomes a priority, happy to be a sounding board."

### 4.6 Mushrooming (multi-threading)
Guidance page plus a checklist per account:
- Map 3+ contacts per account (different level, function or site).
- Typical map: Engineering Director → Maintenance Manager → Facilities Manager → Procurement → Site/Ops Director → Energy/Sustainability.
- Questions to open doors: "Who else gets involved when plant decisions are made?", "Who looks after this at your other sites?", "Who should I speak to so I'm not wasting your time?"
- Use referral emails (4.4) and warm-call openers referencing colleagues.

### 4.7 Shuffle / Variety Logic
- Every line can be tagged `voice: dennehy | nepq | sandler | neutral`.
- Filter chips at the top of each Scripts page: Persona, Voice, Service theme.
- **Shuffle** button picks a random line from the stage, avoiding any line used in the last 7 days.
- **"Build me a call"** button generates a complete call path by picking one line from each stage (Opener → Micro-contract → Reason → 2 Situation → 2 Problem → 1 Consequence → Close), displayed as a single scrollable card. Tap **Reroll** on any single line.
- Favourites (star) and "Used" tracking per line.
- Placeholders `[Name]`, `[Rep]`, `[site]` auto-fill from the selected contact and the rep's settings.

---

## 5. App Structure (multi-page)

Bottom tab bar (5 tabs), max one level of navigation deep.

### Tab 1 — Today (home)
- Greeting + date.
- **Today's tasks** from the cadence engine, grouped: Calls / Emails / LinkedIn / Mushroom. Tap a task → opens the relevant script page pre-filled for that contact.
- **Daily targets ring** (e.g. 20 calls, 10 emails, 5 LinkedIn touches, 2 mushrooms — editable in Settings).
- Streak counter (consecutive outreach days).
- **Skill of the day** card (rotates through the 5 core skills with one example line).
- Quick buttons: **Log a call**, **Build me a call**, **Add contact**.

### Tab 2 — Scripts
Sub-sections as a top segmented control or list:
- Cold Call (stage flow, Section 4.1)
- Warm Call
- Cold Email
- Warm Email
- LinkedIn
- Voicemail
- Brush-offs

Each line card has: text, voice tag, ★ favourite, ✓ used, copy button (for emails/LinkedIn), swipe for next variant.

**Call Mode:** full-screen, large text, one stage at a time, big Next / Shuffle buttons, outcome buttons at the end (No answer / Voicemail / Spoke – not now / Spoke – follow up / Meeting booked / Wrong person / Not interested). Selecting an outcome logs the activity and schedules the next cadence step.

### Tab 3 — Pipeline (contacts & accounts)
- List of contacts with: name, company, persona, sector, current ladder rung, last touch, next action date.
- Filter by rung, persona, sector, overdue.
- Contact detail page: ladder progress bar (rungs 1–10), activity timeline, notes, "colleagues at this company" (mushroom map), next task.
- Add contact form: name, role/persona, company, site, sector, phone, email, LinkedIn URL, source, notes. On save → generates the 21-day cadence.
- Account view: group contacts by company with a simple org map (number of threads).

### Tab 4 — Tracker (the visual)
- **Calendar heatmap** (GitHub-style): each day shaded by number of outreach activities. Tap a day → list of activities.
- **Planned call days:** rep sets their calling days (e.g. Tue/Thu mornings as "power hours"). These show as outlined cells on the calendar; filled when done. Visual nudge if a planned call day was missed.
- **Weekly bar chart:** calls / emails / LinkedIn / mushrooms per day, stacked.
- **Funnel:** contacts by rung (Research → Meeting).
- **Ratios:** dials → conversations → meetings (conversion %).
- **This week vs last week** comparison.
- Simple export: CSV of activities (for the sales director's review).

### Tab 5 — Learn
- The Outreach Ladder (interactive — tap each rung for explanation).
- The 21-day Cadence.
- The 5 Core Skills — each with: what it is, why it works, 5 example lines, a "try it out loud" practice prompt, and a common mistake.
- The three "voices" (Dennehy / NEPQ / Sandler) summarised in plain English with when to use each.
- Mushrooming guide.
- Email rules & LinkedIn rules.
- Training session notes (Section 9) for reference.

### Settings (gear icon top-right)
- Rep name, phone, email signature (used in placeholders).
- Daily/weekly targets.
- Planned calling days and times.
- Default voice preference.
- Cadence editor (adjust day offsets).
- Data: Export JSON backup / Import backup / Clear all data.
- Theme: Dark (default) / Light.

---

## 6. Data Model (IndexedDB, via a small wrapper like `idb`)

```
settings: {
  repName, repPhone, repEmail, signature,
  targets: { calls, emails, linkedin, mushroom } // per day
  callDays: [ { weekday: 2, start: "09:00", end: "11:00" }, ... ],
  defaultVoice, theme, cadence: [ { day, type, templateHint } ]
}

contacts: {
  id, name, role, persona, company, site, sector,
  phone, email, linkedin, source, notes,
  rung (1–10), status ("active" | "nurture" | "won" | "closed"),
  createdAt, lastTouchAt, nextActionAt
}

tasks: {
  id, contactId, type ("call" | "email" | "linkedin_connect" | "linkedin_engage" | "mushroom" | "research"),
  dueDate, status ("open" | "done" | "skipped"), cadenceStep, completedAt
}

activities: {
  id, contactId, type, outcome, scriptIdsUsed: [], notes, timestamp
}

scriptUsage: {
  scriptId, lastUsedAt, timesUsed, favourite (bool)
}
```

Content (scripts/templates) is static in `content.json` and versioned with the app; usage and favourites are stored separately so content updates never wipe a rep's history.

---

## 7. Visual Design

**Look:** bold, high-contrast black and red. Industrial, confident, minimal. No company name, logo or references to "adi" anywhere.

**Colour tokens**
```
--bg:          #0B0B0C   (near-black, default background)
--surface:     #161618   (cards)
--surface-2:   #202023   (raised cards / inputs)
--text:        #F5F5F5
--text-muted:  #A1A1AA
--red:         #E30613   (primary accent — buttons, active tab, progress)
--red-dark:    #B0050F   (pressed state)
--red-tint:    rgba(227, 6, 19, 0.12)
--success:     #22C55E   (meeting booked only)
--border:      #2A2A2E
```
Light theme: white background, black text, same red accent.

**Typography:** system font stack (or Inter / Barlow via Google Fonts with fallbacks). Headings heavy (700–800), uppercase for section labels with letter-spacing. Call Mode text at 22–26px.

**Components**
- Cards with 12px radius, 1px border, generous padding.
- Primary buttons solid red, white text, full width on mobile, 48px+ tap height.
- Bottom tab bar black with red active icon + label.
- Ladder progress shown as 10 segments, filled red up to current rung.
- Heatmap: shades from surface grey to full red.
- Icons: Lucide (line icons).

**App icon / favicon:** simple bold red upward arrow or chevron on black square (no letters). Provide 192px and 512px PNGs plus a maskable version.

---

## 8. Technical Spec

**Stack (keep it simple, GitHub Pages friendly)**
- Vanilla JS + HTML + CSS, *or* Vite + Preact/React if preferred. No backend.
- Hash-based routing (`#/today`, `#/scripts/cold`, `#/pipeline/:id`, `#/tracker`, `#/learn`) so it works on GitHub Pages without server config.
- Storage: IndexedDB (via `idb` library) for contacts/tasks/activities; localStorage only for small UI prefs.
- Charts: Chart.js or lightweight custom SVG (heatmap is easy in SVG).

**PWA**
- `manifest.json`: name, short_name, `display: standalone`, `theme_color: #0B0B0C`, `background_color: #0B0B0C`, icons (192, 512, maskable), `start_url: ./#/today`, `orientation: portrait`.
- Service worker: cache-first for app shell + `content.json`; versioned cache name so updates roll out. Show a small "New version available — tap to refresh" toast.
- iOS: `apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`, safe-area insets (`env(safe-area-inset-*)`) on the tab bar and headers.
- Fully functional offline.

**Folder structure**
```
/
├── index.html
├── manifest.json
├── sw.js
├── SPEC.md
├── /icons/            (icon-192.png, icon-512.png, maskable-512.png, favicon)
├── /css/app.css
├── /js/
│   ├── app.js          (router, init)
│   ├── db.js           (IndexedDB wrapper)
│   ├── cadence.js      (generates & reschedules tasks)
│   ├── shuffle.js      (variety logic, "Build me a call")
│   ├── pages/today.js
│   ├── pages/scripts.js
│   ├── pages/callmode.js
│   ├── pages/pipeline.js
│   ├── pages/tracker.js
│   ├── pages/learn.js
│   └── pages/settings.js
└── /data/content.json  (all scripts, templates, skills, learn content)
```

**Key behaviours**
- Adding a contact creates cadence tasks from `settings.cadence` relative to today.
- Logging an outcome: updates `contact.rung` / `status`, writes an `activity`, marks the task done, and (if needed) reschedules.
  - Meeting booked → rung 9, remaining cadence tasks cancelled.
  - Not interested → status "nurture", next action in 6 weeks.
  - Wrong person → prompts "Who's the right person?" → quick-add a linked contact (mushroom).
- Overdue tasks roll forward to Today with a red marker.
- Haptic feedback (`navigator.vibrate`) on outcome logging where supported.
- Tel and mailto links: tap phone number to call, tap email template to open the mail app with subject/body pre-filled (and a copy button as fallback). LinkedIn URL opens the profile.

**Deployment**
- GitHub repo → GitHub Pages (later move to own domain).
- Reps open the URL on their phone → Share → Add to Home Screen.

---

## 9. 90-Minute Training Session (run sheet)

Also included in the Learn tab so reps can revisit it.

| Time | Block | Content |
|---|---|---|
| 0–10 min | **The real problem** | We know who to target. The gap is what "working the client" actually means. Ask the room: "When you say you're working an account, what have you actually done this week?" |
| 10–20 min | **The Outreach Ladder & Cadence** | Walk through the 10 rungs and the 21-day rhythm. Key message: one call is not a strategy; 8–10 touches across channels is. Introduce mushrooming. |
| 20–30 min | **Skill 1: Call out the elephant** | Why pretending it's not a cold call makes it worse. Example lines. Pairs say three openers out loud. |
| 30–40 min | **Skill 2: Micro-contracting** | Small agreements, prospect in control. Example lines. Practice: opener + micro-contract back to back. |
| 40–50 min | **Skill 3: Name the feeling** | Label scepticism, busyness, past bad experiences. Practice reacting to brush-offs with a label instead of a counter-argument. |
| 50–60 min | **Skills 4 & 5: Curiosity & permission to say no** | Questions over pitching (situation → problem → consequence). Making "no" safe. Show the three voices briefly. |
| 60–80 min | **Live practice** | Pairs/threes: caller, prospect, observer. Real persona cards (e.g. Engineering Director at a food factory, ageing chillers). Rotate. Observer ticks off: elephant / contract / label / question / close. |
| 80–90 min | **Commit & launch the app** | Everyone installs the app, adds 5 real contacts, sets their call days. Agree team targets for the next two weeks and a review date. |

**Practice persona cards (pre-loaded in Learn):**
1. Engineering Director, food manufacturer, 15-year-old chillers, "we've got a contractor".
2. Facilities Manager, pharma site, compliance pressure, very busy.
3. Procurement Manager, aerospace, "send me an email".
4. Maintenance Manager, automotive, had a bad experience with a contractor last year.
5. Operations Director, warehouse, energy bills up, net zero targets from head office.

---

## 10. Roadmap (post v1)

- v1.1: Sales director view — import a team's exported CSVs and see a combined dashboard.
- v1.2: Team sync via a lightweight backend (e.g. Supabase) with sign-in restricted to company email domain.
- v1.3: Call recording notes / dictation to note field.
- v1.4: AI "write me a follow-up email" from call notes.
- v1.5: Account-level mushroom map visual (org tree).
- v1.6: CRM export / integration.

---

## 11. Acceptance Criteria for v1

- [ ] Installs to home screen on iPhone and Android and opens full-screen.
- [ ] Works fully offline after first load.
- [ ] Five tabs work: Today, Scripts, Pipeline, Tracker, Learn (+ Settings).
- [ ] All content from Section 4 is loaded from `content.json`.
- [ ] Shuffle never repeats a line used in the last 7 days (when alternatives exist).
- [ ] "Build me a call" produces a full call path with per-line reroll.
- [ ] Call Mode logs outcomes and schedules the next step.
- [ ] Adding a contact generates the 21-day cadence.
- [ ] Tracker shows heatmap with planned call days, weekly bar chart, funnel and conversion ratios.
- [ ] Data export/import (JSON) and CSV activity export work.
- [ ] Black/red theme, no company name or logo anywhere.
- [ ] Tap targets ≥ 44px, text readable at arm's length in Call Mode.
