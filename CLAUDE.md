# PTO Tracker

A personal PTO tracking and planning tool built for Bill (CL8 at Accenture). Started as a React artifact in Claude.ai, now running as a Vite + React app locally with a complete Figma-driven redesign.

## Running the app

```bash
cd app && npm run dev
```

## Stack & project structure

- **Vite + React** (no TypeScript), running on port 5173
- **Supabase** for persistence (`pto_days` + `pto_settings` tables) — single hardcoded user, no auth
- **Supabase keepalive**: GitHub Actions cron (`.github/workflows/keepalive.yml`) PATCHes a `keepalive` table row daily. Read-only pings did NOT count as activity for Supabase's free-tier inactivity scanner — it must be a write. The workflow also re-enables itself via `gh workflow enable` on every run (needs `permissions: actions: write`) — this resets GitHub's 60-day repo-inactivity timer that would otherwise auto-disable scheduled workflows in quiet repos. The Vercel cron (`app/api/keepalive.js`) is a legacy read-only ping, kept as backup. Same setup exists in Timeback.
- Preview config: `.claude/launch.json`

```
/Users/billchien/Documents/Apps/PTO Tracker/
├── app/
│   ├── src/
│   │   ├── PTOTracker.jsx    ← PRIMARY working file (all UI + logic)
│   │   ├── supabase.js       ← Supabase client init
│   │   ├── App.jsx           ← Simple wrapper
│   │   └── index.css         ← Minimal reset
│   ├── package.json
│   └── vite.config.js
├── pto-tracker.jsx           ← Original Claude artifact (read-only reference)
├── pto-tracker-colors.json   ← Design tokens for Figma
└── .claude/launch.json       ← Preview server config
```

## Data model

Leave days are stored in Supabase `pto_days` (keyed by `YYYY-MM-DD`) and settings in `pto_settings` (jsonb).

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
- **Drag** across empty weekdays: multi-select to plan days off. CUL days consumed first (up to `culRemaining`), then PTO. Capped at `totalAvailDays` — preview stops growing when balance hits zero; toast fires if drag exceeded capacity. Commits atomically on mouseup (one undo step).
- **Drag** across planned days: multi-select to remove planned days. Preview dims cells to ~20% opacity; all `PLAN`/`PLAN_CUL`/`PLAN_UNPAID` in range are cleared on mouseup.
- **⌘ Cmd + drag** across `PLAN` days: bulk convert to unpaid leave (`PLAN_UNPAID`). Preview dims cells to ~35% opacity.
- **⌘ Cmd + drag** across `PLAN_UNPAID` days: bulk convert back to `PLAN`. Preview dims cells to ~35% opacity.
- **⌥ Option + drag** across unlocked planned days: bulk lock. Preview shows the lock dot at 40% opacity.
- **⌥ Option + drag** across locked planned days: bulk unlock.
- **Locked days are immune to all drag operations** — only ⌥ Option+drag unlock can affect them.
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
| **SETTINGS** (`settings`) | Name, management level, service start date, snapshot balance, calendar view (week start, US holidays scope, theme) |

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
HOURS_PER_DAY       = 8
CARRYOVER_CAP       = 200    // max hrs carrying to next FY
CUL_DAYS_TOTAL      = 2      // cultural days per calendar year
FY boundary: Sep 1 – Aug 31
```

Bill's service start date drives milestone dates dynamically (5yr = start + 5y, 10yr = start + 10y) — not hardcoded.

### Balance calculation

`currentBal` is computed by walking FY by FY from the snapshot date to today, applying the 200-hr carryover cap at each Aug 31 boundary crossed:

1. Start with `snapshotBal` at `balDate`
2. For each Aug 31 between `balDate` and today: add accruals, subtract PTO taken, then `min(balance, 200)`
3. Add remaining accruals and PTO from the last Aug 31 to today

Unpaid leave excluded from all balance calculations.

### Past-day normalization
On load, planned days whose date has passed are converted to their used types (`PLAN`→`PTO`, `PLAN_CUL`→`CUL`, `PLAN_UNPAID`→`UNPAID`) and synced back to Supabase; locks on past dates are dropped. Without this, past planned days rendered lime forever and were never deducted from the balance (the balance walk only counts `PTO`). A render guard also draws past `PLAN`/`PLAN_CUL` cells as used gray, covering sessions left open across midnight.

### Data integrity guards (audited alongside Timeback, July 2026)
- Settings' Management Level field is staged in `editCLDraft`; Cancel reverts it, Update commits to `editCL` and persists. (Timeback had the same live-state bug — CL changes leaked even on Cancel.)
- Settings Update rejects a balance date before 2025-01-01 (`PAY_PERIOD_ENDS` generation starts at 2025 — an older snapshot would silently miss accruals).
- Failed `pto_days`/`pto_settings` Supabase writes now toast "Couldn't save — check your connection" instead of failing silently; a failed day-sync keeps its diff pending so the next change retries.
- Not applicable here (single-user, no onboarding): CUL snapshot double-counting and the upsert `onConflict` mismatch that hit Timeback — this app's `pto_days` PK is just `date`, so default upsert conflict resolution is already correct.

### Smart logic
- Dynamic PLAN colors: lime if projected balance covers it, coral if not feasible (per-date projected balance check). Coral days are still clickable.
- Year-aware stats: switching years recalculates everything.
- Service-year milestones: accrual rate bumps at 5yr and 10yr marks (computed from Bill's service start date).
- FY rollover: caps balance at 200 hrs **only at Aug 31** — balance can exceed 200 hrs mid-year.
- Feasibility checking per planned date based on projected accruals.
- CUL popup option hidden when `culRemaining <= 0`.
- **`totalAvailDays`**: header PTO stat = `currentBal + accruals(today→Dec31) − planned(today→Dec31)`, no carryover cap. Reacts to every planned day regardless of FY boundary. Resets naturally on Sep 1 when `currentBal` gets the Aug 31 cap applied.
- **PTO planning gate**: when `totalAvailDays <= 0`, any attempt to plan a future PTO day (via popup or single-click) shows a toast "All PTO planned for the year" and does nothing. Prevents the header from going negative.
- **Infeasible PLAN cell text**: always uses `P.maroon` (#400000) — dark red readable on coral in both light and dark themes.

### Pay period generation
`PAY_PERIOD_ENDS` is generated dynamically at module load covering 15 FYs forward. Never needs manual updates for future years.

### Year navigation
- `viewYear` initializes dynamically based on the current FY: `month >= 8 ? year + 1 : year`.
- `minViewYear = Math.max(2026, currentYear - 5)` — computed per session.
- Left arrow in year nav is disabled (faded, no cursor) at `minViewYear`; can't navigate before it.

## Design system

**Fonts:**
- `Space Mono` — numbers, stat values, year nav
- `Space Grotesk` — panel stat numbers (`T.num`)
- `Work Sans` — all UI text, labels, buttons
- `Sorts Mill Goudy` — user name in panel header (italic serif)

**Type scale (`T`):**
```js
T.stat                          // Space Mono, weight 400, lineHeight 1 — big header numbers (fontSize set per usage: 44 mobile, 54 desktop)
T.display.lg                    // Sorts Mill Goudy italic, 50px — user name
T.display.md                    // Sorts Mill Goudy italic, 22px
T.num                           // Space Grotesk, 20px, weight 500 — panel stat numbers
T.label.alt                     // Work Sans, 11px, weight 500, uppercase + letterSpacing — primary labels, buttons
T.label.base                    // Work Sans, 11px, weight 400, uppercase + letterSpacing — secondary labels
T.label.sm                      // Work Sans, 11px, weight 400 — small labels, no transform (settings field labels)
T.body.sm                       // Work Sans, 12px, weight 400 — small body text
T.body.smAlt                    // Work Sans, 12px, weight 500 — small body emphasis
T.body.base                     // Work Sans, 14px, weight 400 — default body
T.body.alt                      // Work Sans, 14px, weight 500 — body emphasis, inputs
```
`button = T.label.alt; input = T.body.alt`

`T.label.base` and `T.label.alt` use a getter that reads `S.labelLetterSpacing` at call time, so letter-spacing tracks the active theme (`"0.08em"` light / `"0.1em"` dark).

**Colors:** Two-tier system — primitives (`P`) hold raw values; semantic tokens (`S`) reference them. `S` has light + dark variants (`LIGHT_S` / `DARK_S`); `applyTheme(mode)` mutates the live `S` object on every render of the top-level `PTOTracker` component, so module-global reads of `S.x` stay in sync with the active theme.

```js
// Primitives
P.white "#FFFFFF"   P.gray05 "#F8F8F8"   P.gray15 "#E3E3E3"
P.gray25 "#CECECE"  P.gray45 "#757575"   P.black "#000000"
P.ink "#141B13"     P.inkDeep "#0F170F"
P.lime "#ADFF55"    P.limeDeep "#70D900"
P.lime05 "#E0FF66"  P.lime35 "#4C9928"   P.lime55 "#386828"   P.lime75 "#263E21"
P.mint "#C8FFD6"
P.yellow "#D9FF00"  P.yellowHi "#FCF937" P.coral "#FF715B"    P.maroon "#400000"

// Semantic              LIGHT          DARK
S.bg / S.surface       → P.white      / P.ink
S.surfaceAlt           → P.gray05     / P.inkDeep
S.surfaceAltRgb        → "248,248,248"/"15,23,15"
S.border               → P.gray15     / P.lime75
S.text                 → P.black      / P.lime
S.textSubtle           → P.gray45     / P.lime55
S.textFaint            → P.gray25     / P.lime75
S.iconSubtle           → P.gray45     / P.lime35
S.iconOnPto            → P.white      / P.inkDeep
S.today / S.todayText  → P.black/P.white   / P.mint/P.inkDeep
S.pto                  → P.lime       / P.lime
S.ptoOver / Text       → P.coral / P.maroon (light) / P.coral (dark)
S.cul                  → P.yellow     / P.lime05
S.holiday              → P.yellowHi   / P.lime75
S.unpaid               → P.limeDeep   / P.lime35
S.labelLetterSpacing   → "0.08em"     / "0.1em"
S.shadowHeader         → "0 1px 12px rgba(0,0,0,0.08)" / "0 2px 16px rgba(0,0,0,0.4)"
S.shadowThumb          → "0 1px 4px rgba(0,0,0,0.12)"  / "0 2px 6px rgba(0,0,0,0.4)"
```

Note: `S.ptoOverText` is used in the balance panel for negative balance color. Infeasible PLAN calendar cells always use `P.maroon` directly (theme-independent, readable on coral in both modes).

The Theme setting (Light / Dark / System) lives under Settings → Calendar View. Default is `system`; `system` follows `prefers-color-scheme` via a `matchMedia` subscription.

**Layout:**
- Sticky header: balance stats + year nav + panel toggle + divider
- Calendar grid: `repeat(auto-fill, minmax(260px, 1fr))` — 4 cols desktop, responsive to 1 col mobile
- Fluid circular cells: `width: 100%, aspectRatio: 1, borderRadius: 999`
- Side panel: animated width `0 ↔ 360px`, pushes calendar (not overlay)
- Figma file: `585nROM3w4oq3US9B6CLFa` (node `60-12856` for main view)

## Wishlist

**High priority**
1. ~~Backend storage (Supabase) — sync across devices~~ ✓ Done
2. ~~Dark mode~~ ✓ Done
3. White-label / shared version — spun off as **Timeback** (separate project under `Documents/Apps/Timeback`)

**Medium priority**
4. China trip planner — lunar new year + mom's birthday optimization
5. Multi-year view
6. Export to CSV/Google Calendar

**Nice to have**
7. Configurable holidays (non-US)
8. PTO history view
9. Notifications
10. Slack integration

## Notes for Claude

- Update this CLAUDE.md whenever an important logic or architecture decision is made.
- Bill prefers brief direct answers, lead with the conclusion.
- He's a designer — expects pixel-perfect implementation from Figma.
- The code uses `var` and `function()` style (artifact parser legacy).
- Bill knows enough to read code but isn't a developer — explain changes plainly.
- The screenshot preview tool captures at 2x DPR — use `preview_eval` for precise layout verification.
