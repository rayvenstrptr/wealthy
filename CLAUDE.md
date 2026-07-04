# Personal Wealth Dashboard — Project Brief

Personal finance tracker for a single user (Ray). Tracks income and expenses against a percentage-based budgeting system with **per-income-type allocations**. v1 scope is **income + expense tracking only** — asset/investment tracking comes later, so the schema allows it without rework.

Currency: **IDR only**. No decimals. Display format: `Rp 1.250.000`. Common shorthand in this doc: `jt` = juta = million.
Timezone: Asia/Jakarta (WIB).

## Implementation status (v1 BUILT — next phase: front-end improvement)

All build phases below are **done and verified** (unit tests + production build + live smoke test). What remains is polish: the next work session should focus on **front-end improvement** — see the last section for the map and rules of engagement.

Key implementation decisions already made (do not relitigate without reason):

- **supabase-js directly** (no Drizzle) — RLS + auth flow through `@supabase/ssr` clients.
- **Local mock mode**: when `NEXT_PUBLIC_SUPABASE_URL` is unset, the app runs with no auth and a file-backed store at `.mock/db.json` (seeded like the SQL trigger + demo entries). Ray is running **local-first for now** — don't push Supabase/Vercel setup. Delete `.mock/db.json` to reseed.
- **Dev server runs on port 888** (`npm run dev`).
- shadcn/ui here is the **Base UI** flavor (`@base-ui/react`, not Radix): triggers use `render`
  props not `asChild`; Select takes `items` + `onValueChange`. Follow existing component usage.

## Stack

- Next.js 15 (App Router, TypeScript, Turbopack)
- Supabase (Postgres + Auth) — deployed on Vercel eventually, so no SQLite
- Tailwind CSS v4 + shadcn/ui (Base UI primitives)
- supabase-js via `@supabase/ssr`; single user: one Supabase account, RLS on `user_id` on every table
- Vitest for the summary-math unit tests

## Core Concepts

Two separate taxonomies — do NOT merge them:

1. **Budget types** answer "which envelope does this money go to?" — Invest, Cash, Life, Fun, Giving.
2. **Expense categories** answer "what was it spent on?" — Food, Transport, etc. Secondary; used for drill-down only.

Every expense requires BOTH a budget type and an expense category.

### Budget month cycle (payday-based) — IMPORTANT

Ray's payday is the **25th**. A budget month runs from the **25th of the previous calendar month to the 24th of the labeled month**:

- "January 2026" = 25 Dec 2025 – 24 Jan 2026
- "February 2026" = 25 Jan – 24 Feb 2026
- A salary received 25 Dec funds **January's** budget.

Budget years follow the same cycle: "2026" = 25 Dec 2025 – 24 Dec 2026, so every budget month belongs to exactly one budget year. All of this lives in `src/lib/dates.ts` (`CYCLE_START_DAY`, `budgetMonthOf`, `monthRange`, `yearRange`) with unit tests in `dates.test.ts`. The UI always shows the resolved date range ("Budget month: 25 Jun – 24 Jul") so the cycle is never ambiguous.

### Income cadence

Each income type has a `cadence`:

- `monthly` — only **Salary**. Drives the monthly budget.
- `yearly` — everything else (Yield, Bonus, Angpao, THR, TCG Yield, Others). Budgeted and summarized on a yearly window only.

Note: cadence controls where an income type drives the *budget*, not where it appears in summaries. Salary counts in BOTH windows — it drives the monthly budget, and all 12 months of it roll up into the yearly totals and yearly budget alongside the yearly-cadence types.

Cadence is configurable per income type in Settings.

### Budget allocation matrix (the heart of the app)

Budget split is **per income type**, not global. Each income type has its own allocation row per budget type.

**Entry modes** — per income type, the user picks ONE mode for its allocation row:

- `percent` mode: enter % per budget type. Warn (don't block) if they don't sum to 100.
- `amount` mode: enter IDR per budget type. Derived % = `amount ÷ sum of amounts for that income type`. Derived % shown live as the user types. The row also shows **Total: Rp X · last `<type>` received: Rp Y** and warns (don't block) when the amounts total differs from the most recent actual income of that type.

**Application rule:** amounts are only a convenient way to define percentages. When actual income lands, allocation is ALWAYS `derived % × actual amount received`. (If salary comes in at 10.5jt instead of 10jt, Invest gets 20% × 10.5jt = 2.1jt, not the flat 2jt.)

**How allocations meet expenses:** expenses are NOT linked to income types. Reconciliation happens at three windows:

- **Monthly:** allocated = that budget month's `monthly`-cadence income (Salary) × Salary's %s vs that month's expenses per budget type.
- **Yearly:** allocated = ALL income received that budget year × each income type's %s, summed per budget type, vs that year's expenses.
- **All-time:** same rule as yearly over everything ever recorded — lifetime envelope balance.

Yearly incomes (THR, Bonus…) never inflate a single month's budget. Unspent monthly budget does NOT carry over in v1.

Edge case: income of a type with no allocation defined → counted in income summaries, excluded from budget allocation, warning chip on the dashboard ("THR has no budget split configured").

## Data Model

See `supabase/migrations/00001_init.sql` for the authoritative schema (tables: `income_types`, `budget_types`, `budget_allocations`, `expense_categories`, `events`, `incomes`, `expenses`; RLS on `user_id` everywhere; seed trigger `seed_user_defaults()` on `auth.users` insert). Rules that matter when touching code:

- Money is `bigint` IDR — never floats. Dates are `date`, day-granular.
- `budget_allocations` has `percent` OR `amount` per cell depending on the row's mode; the derived % for amount mode is computed in app code (`deriveRowPercents`), never stored.
- Types/categories/events referenced by entries can't be hard-deleted — archive (`is_active = false`). Archived items disappear from entry forms but still render in history.

Seed data (defaults on first run): income types Salary(monthly)/Yield/Bonus/Angpao/THR/TCG Yield/Others; budget types Invest/Cash/Life/Fun/Giving; Salary amounts 2jt/1jt/5jt/1.5jt/500k, THR 20/0/50/30/0, others 20/10/50/15/5; the 11 expense categories with default budget types.

## Acceptance Criteria (all implemented)

**AC1 — Income types:** Settings: add / rename / archive / restore income types, set cadence.

**AC2 — Budget types + allocation matrix:** add/rename/archive budget types; matrix editor with per-row %/Rp mode toggle, live derived %, sum≠100 warning (percent mode), row-total-vs-latest-income warning (amount mode).

**AC3 — Expense categories:** add / rename / archive, set default budget type (prefills expense form).

**AC4 — Expense entry:** name, amount (IDR input with separators), date (default today WIB), budget type (prefilled from category default), category, optional event (select or create inline), notes. Fast on mobile; after save: toast + reset keeping date. **List rows:** name and amount editable inline (blur/Enter saves, Esc reverts); other fields via the pencil → edit dialog. List has **search** (name, debounced) + month/budget/category/event filters.

**AC5 — Income entry:** name, amount, date, income type; notes optional. Same inline edit + search + filters on the list.

**AC6 — Summaries:** three dashboard views (Monthly | Yearly | All time), each with stat cards (Total Income / Total Expenses / Net) and budget performance rows (allocated / spent / remaining + progress bar, red on overspend):

- *Monthly*: salary-based budget; "no salary this month" info note; recent 10 expenses.
- *Yearly*: all-income budget; income by type split into monthly vs yearly cadence groups.
- *All time*: totals of everything ever recorded; all-income budget rule.
- *Event view*: `/events/[id]` — total + breakdowns by budget type and category; ignores period filters (events cross months/years).

## Pages

```
/            Dashboard — Monthly | Yearly | All time (the money screen)
/expenses    Expense list (search + filters, inline edit) + add/edit
/income      Income list (search + filters, inline edit) + add/edit
/events      Event list + per-event summary at /events/[id]
/settings    Income types, budget types + allocation matrix, categories, sign out
/login       Only reachable when Supabase is configured
```

Mobile-first. Floating "+ Expense" button on every page; its dialog stays open after save for rapid entry.

## Conventions

- All summary math lives in `src/lib/summary.ts`; all cycle/date logic in `src/lib/dates.ts` — both pure and unit-tested (`npm test`). Never compute budget numbers in components.
- Server components read via `src/lib/data.ts`; writes via server actions in `src/lib/actions/*` returning `{ ok } | { ok: false, error }`. Every write path has a mock-mode branch (`src/lib/mock/*`) — keep both in sync when changing the data layer.
- Money formatting via `formatIDR`/`formatNumber` in `src/lib/format.ts` (id-ID separators).

## Front-end improvement — next phase

The functionality is complete; the UI is functional-but-plain shadcn defaults. When improving the front end:

**File map (UI only):**

- `src/app/(app)/page.tsx` — dashboard (stat cards, budget bars, income/category sections)
- `src/components/dashboard/` — `period-picker`, `budget-performance`
- `src/components/expense-*` / `income-*` / `event-*` — lists, forms, filters, FAB
- `src/components/inline-edit.tsx`, `amount-input.tsx`, `simple-select.tsx` — shared field primitives
- `src/components/settings/` — cards + `allocation-matrix` (the most complex UI)
- `src/components/nav.tsx` — desktop top bar + mobile bottom tabs
- `src/app/globals.css` — Tailwind v4 theme tokens (colors/radius live here as CSS vars)

**Rules of engagement:**

1. Don't touch `lib/summary.ts`, `lib/dates.ts`, `lib/data.ts`, actions, or the schema for visual work.
2. Mobile-first: this is a daily phone-entry app. Bottom nav + FAB ergonomics are sacred; expense entry must stay ≤ 2 taps away.
3. Keep both themes working (Tailwind tokens handle dark mode).
4. Verify with `npm test` + `npm run build`; eyeball on the dev server (port 888, mock data — delete `.mock/db.json` to reset).

**Candidate improvements (unprioritized):** visual identity beyond stock shadcn (typography scale, spacing, color for budget types), charts for income by type / spending trend, budget bar micro-design (amount ticks, % labels), skeleton/loading states, better empty states, month-picker UX (native `type="month"` is clunky on desktop), settings matrix layout on narrow screens, PWA/installability, subtle motion on save/toasts.

## Non-goals (v1)

- Asset / investment / net-worth tracking (schema must not block adding an `assets` table later)
- Multi-currency, multi-user, bank import / OCR receipts
- Recurring transactions (v2 candidate — salary is predictable)
- Envelope carryover of unspent monthly budget (v2 candidate)

## Open Question (unchanged)

Allocations are computed **on the fly** from the current matrix. If Ray edits Salary's split in August, past months' dashboards recalculate with the new split. On-the-fly is fine for v1; if historical accuracy starts to matter, add `allocation_snapshot jsonb` to `incomes` later.
