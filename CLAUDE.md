# PTO Tracker

A personal PTO tracking and planning tool built for Bill (CL8 at Accenture). Started as a React artifact in Claude.ai, now running as a Vite + React app locally with a complete Figma-driven redesign.

## Running the app

```bash
cd app && npm run dev
```

## Stack & project structure

- **Vite + React** (no TypeScript), running on port 5173
- **localStorage** for persistence — key: `bill-pto-2026-v2`
- Preview config: `.claude/launch.json`

```
/Users/billchien/Documents/PTO Tracker/
├── app/
│   ├── src/
│   │   ├── PTOTracker.jsx    ← PRIMARY working file (all UI + logic)
│   │   ├── App.jsx           ← Simple wrapper
│   │   └── index.css         ← Minimal reset
│   ├── package.json
│   └── vite.config.js
├── pto-tracker.jsx           ← Original Claude artifact (read-only reference)
├── pto-tracker-colors.json   ← Design tokens for Figma
└── .claude/launch.json       ← Preview server config
```

## Data model

Leave days are stored in the `days` object (keyed by `YYYY-MM-DD` strings):

| Type | Description |
|------|-------------|
| `PTO` | Used PTO day (past) |
| `PLAN` | Planned PTO day (future) |
| `CUL` | Used cultural day (past) |
| `PLAN_CUL` | Planned cultural day (future) |
| `UNPAID` | Used unpaid leave day (past) |
| `PLAN_UNPAID` | Planned unpaid leave day (future) |

## Leave types

- **PTO**: Accrued paid time off. Balance tracked in hours (`HOURS_PER_DAY = 8`).
- **Cultural days**: Fixed 2 days/year (`CUL_DAYS_TOTAL = 2`), separate from PTO balance.
- **Unpaid leave**: Unlimited. Does **not** consume PTO balance.

## Interactions

- **Click** an empty weekday: opens popup to assign PTO or CUL day.
- **Click** an assigned day: clears the assignment.
- **Cmd+Click** a planned PTO (`PLAN`) day: converts to planned unpaid leave (`PLAN_UNPAID`), restoring the PTO day to balance.
- **Cmd+Click** a planned unpaid (`PLAN_UNPAID`) day: converts back to planned PTO (`PLAN`).
- **Cmd+Z**: undo the last day assignment change (up to 20 steps, in-memory only).
- Click calendar white space → closes side panel.

## Panel tabs

(Internal keys in parens — used in code. Tab labels in the UI are the bold names.)

| Tab | Purpose |
|-----|---------|
| **PLAN** (`reco`) | Suggests break opportunities around holidays; preview + apply to calendar |
| **DRAFT** (`write`) | Draft approval email from planned dates; copy to clipboard |
| **BALANCE** (`overview`) | Current balance, accrual rates, used days |
| **SETTINGS** (`settings`) | Name, management level, service start date, snapshot balance, calendar view (week start, US holidays scope) |

### Draft tab details
- Future `PLAN`/`PLAN_CUL` dates are grouped into consecutive blocks (weekends and holidays between planned days don't break a group).
- Each group is a selectable row — checked by default. Unchecking removes it from the email draft.
- Clicking a row scrolls the calendar to those dates and highlights them with an `S.unpaid` (`#70D900`) border ring on top of the lime-green fill.
- The **Text** section renders a ready-to-send email with each selected date range on its own bold line.
- **Copy** button (sticky footer CTA) copies the plain-text email to the clipboard and toasts "Copied!".

## Visual legend

- Lime green fill (`S.pto`): planned PTO (`PLAN`)
- Yellow fill (`S.cul`): planned cultural day (`PLAN_CUL`)
- Coral fill (`S.ptoOver`): planned PTO that exceeds balance
- Bright yellow fill (`S.holiday`): future holiday cell
- Gray fill (`S.surfaceAlt`): weekend cells, past-holiday cells, past PTO/CUL cells (all unified)
- Dashed lime stroke (`S.unpaid`): planned unpaid leave (`PLAN_UNPAID`)
- Dashed gray stroke: used unpaid leave (`UNPAID`)
- `S.unpaid` ring: highlight on calendar cells when a Draft-tab group is clicked

## Business logic

### Key constants
```js
ACCRUAL_RATE_PRE5   = 7.0    // hrs/pay period before 5yr milestone
ACCRUAL_RATE_POST5  = 7.67   // hrs/pay period from 5yr to 10yr milestone
ACCRUAL_RATE_POST10 = 8.33   // hrs/pay period after 10yr milestone
MILESTONE_DATE      = Aug 2, 2026  // Bill's 5-year mark (start + 5y); 10yr is start + 10y
HOURS_PER_DAY       = 8
CARRYOVER_CAP       = 200    // hard-coded as Math.min(...,200) — max hrs carrying to next FY
CUL_DAYS_TOTAL      = 2      // cultural days per calendar year
FY boundary: Sep 1 – Aug 31
```

### Balance calculation

`currentBal = snapshotBal + accruedSinceSnapshot − daysTakenSinceSnapshot × 8`

Unpaid leave days are excluded from all balance calculations.

### Smart logic
- Dynamic PLAN colors: lime if projected balance covers it, coral if not feasible.
- Year-aware stats: switching years recalculates everything.
- Service-year milestones: accrual rate bumps to 7.67 at 5 years (Aug 2, 2026 for Bill) and 8.33 at 10 years.
- FY rollover: caps balance at 200 hrs when crossing Aug 31.
- Feasibility checking per planned date based on projected accruals.

## Design system

**Fonts:**
- `Space Mono` — numbers, stat values, year nav
- `Work Sans` — all UI text, labels, buttons
- `Sorts Mill Goudy` — user name in panel header (italic serif)

**Colors:** Two-tier system — primitives (`P`) hold raw values, semantic tokens (`S`) reference them. Re-themes only need to swap `P`.

```js
// Primitives
P.white "#FFFFFF"   P.gray05 "#F8F8F8"   P.gray15 "#E3E3E3"
P.gray25 "#CECECE"  P.gray45 "#757575"   P.black "#000000"
P.lime "#ADFF55"    P.limeDeep "#70D900" P.yellow "#D9FF00"
P.yellowHi "#FCF937" P.coral "#FF715B"
P.maroon "#400000"

// Semantic
S.bg / S.surface          → P.white     // page bg, cards, popovers, inputs
S.surfaceAlt              → P.gray05    // panel bg, weekend cells, past-holiday cells, past PTO/CUL cells
S.border                  → P.gray15    // all dividers and strokes
S.text                    → P.black     // primary text, today indicator
S.textSubtle              → P.gray45    // labels, captions, focus outlines, chevrons, past-day numerals
S.textFaint               → P.gray25    // PLAN slider min/max
S.today / S.todayText     → P.black / P.white
S.pto                     → P.lime      // planned PTO fill
S.ptoOver / S.ptoOverText → P.coral / P.maroon  // over-balance fill + text
S.cul                     → P.yellow    // cultural day
S.holiday                 → P.yellowHi  // holiday cell (future)
S.unpaid                  → P.limeDeep  // unpaid stroke + WRITE highlight ring
```

Known still-hardcoded values: shadow `rgba(0,0,0,0.08)`, spinner track `rgba(0,0,0,0.15)`, slider thumb shadow `rgba(0,0,0,0.12)`, panel-fade gradient `rgba(248,248,248,...)` (must stay in sync with `S.surfaceAlt` if re-themed).

**Layout:**
- Sticky header: balance stats + year nav + panel toggle + divider
- Calendar grid: `repeat(auto-fill, minmax(260px, 1fr))` — 4 cols desktop, responsive to 1 col mobile
- Fluid circular cells: `width: 100%, aspectRatio: 1, borderRadius: 999`
- Side panel: animated width `0 ↔ 360px`, pushes calendar (not overlay)
- Figma file: `585nROM3w4oq3US9B6CLFa` (node `60-12856` for main view)

## Wishlist

**High priority**
1. Backend storage (Supabase) — sync across devices
2. White-label setup — coworkers configure their own CL, service years, balance
3. Login/auth

**Medium priority**
4. China trip planner — lunar new year + mom's birthday optimization
5. Multi-year view
6. Export to CSV/Google Calendar
7. Dark mode

**Nice to have**
8. Configurable holidays (non-US)
9. PTO history view
10. Notifications
11. Slack integration

## Notes for Claude

- Bill prefers brief direct answers, lead with the conclusion.
- He's a designer — expects pixel-perfect implementation from Figma.
- The code uses `var` and `function()` style (artifact parser legacy).
- Bill knows enough to read code but isn't a developer — explain changes plainly.
- The screenshot preview tool captures at 2x DPR — use `preview_eval` for precise layout verification.
