# Personal Wealth Dashboard — Project Brief

Personal finance tracker for a single user (Ray). Tracks income and expenses against a percentage-based budgeting system with **per-income envelope splits**, plus an **investments module** (v2) — asset classes with per-year risk targets, buy/sell tracking, realized-only performance, and a net-worth headline.

Currency: **IDR only**. No decimals. Display format: `Rp 1.250.000`. Common shorthand in this doc: `jt` = juta = million.
Timezone: Asia/Jakarta (WIB).

## Implementation status (v2 BUILT)

v1 (income + expenses + allocation matrix) and the first front-end pass (Envelope visual identity, shared Add-Expense dialog) are done and committed. **v2 is built and verified** (unit tests + production build + live smoke test): the allocation matrix was REPLACED by per-income envelope splits, and the investments module + `/investments` page were added. Demo data was wiped and reseeded for v2 (delete `.mock/db.json` to reseed anytime).

**v2.1 is built and verified** (unit tests + build + live import of Ray's real Y2025 sheet): (1) username + 4-digit-PIN auth (reused from the Split project) works in mock mode too — landing/login page, signed session cookie, user menu top right (Settings / Import / Log out), no auto-logout; (2) `/import` brings in expenses+income from an xlsx (Cat·Details·Date·Ex·In·Type·Notes) with a preview step — duplicate/similar-near-date warnings, auto-created categories/envelopes/income types, investment rows excluded (they belong in the investments module), formula cells keep the final amount with the calculation appended to notes; (3) expenses may be negative = surplus that refills the budget (warned in the form, green in lists; amount just must not be 0).

**v2.2 is built and verified** (unit tests + build + live smoke against Ray's real data): (1) **yields** — "＋ Yield" on `/investments` records a dividend/coupon/TCG yield as ONE entry: a normal income (type + envelope split, exact-sum rule) carrying `incomes.investment_item_id` for per-holding attribution; yields fold into the realized totals (zero basis — the trading realized % is untouched); (2) **all-time capital** — the all-time view's budget is CUMULATIVE across all years (`capitalBase` = every Rp ever allocated to investment-kind envelopes); net worth all-time = holdings + undeployed capital, with an "Undeployed capital" stat; (3) sortable **trade log** table (date/name/amount, asc/desc) of buys+sells+yields in the window; (4) item dropdowns sorted A–Z, transaction/yield dialogs widened to 560px with Item on a full-width row (long TCG names); (5) Holdings & performance rows have per-class subtotals + aligned numeric columns; (6) Settings tab removed from the nav (lives in the user menu) — mobile bar is 5 tabs; (7) `/import` accepts drag-and-drop.

**v2.3 is built and verified** (unit tests + build + live smoke): (1) **yields visible in the item drill-down** — the Holdings & performance accordion merges YIELD rows (gold, not editable there — yields are incomes) with buys/sells chronologically; (2) an item's realized % now includes yields: denominator = basis sold + (open cost when yields exist), so a dividend on a never-sold holding reads as yield-on-cost (the lib's trading-only `realizedPct` is unchanged — this is display math in the investments page); (3) "Trade log" renamed to **"Log"** with an All | Buy | Sell | Yield filter (client-side chips in `trade-log.tsx`).

Key implementation decisions already made (do not relitigate without reason):

- **supabase-js directly** (no Drizzle) — RLS + auth flow through `@supabase/ssr` clients.
- **Local mock mode is now a fallback, not the default** (since 2026-07-11): when `NEXT_PUBLIC_SUPABASE_URL` is unset, the app runs with a file-backed store at `.mock/db.json`. The app is **deployed** (see Deployment) and local dev talks to the same cloud database via `.env.local` — mock mode only activates if `.env.local` is removed. `.mock/db.json` is an archived pre-migration snapshot (Desktop backup exists), no longer the source of truth. Keep mock-mode code paths working — they're the offline fallback and the test bed.
- **Auth (v2.1)** is username + 4-digit PIN, Split-project style. Mock mode: scrypt-hashed users in `.mock/users.json` (separate file — reseeding db.json keeps accounts) + HMAC-signed `wd_session` cookie; middleware only checks cookie presence, the (app) layout verifies the signature (bad cookie → `/auth/reset` clears it, avoiding a redirect loop). Supabase mode maps the same credentials onto email auth via `<username>@wealth.local`. Auth is a gate, not multi-tenancy — data stays single-store.
- **Dev server runs on port 888** (`npm run dev`). The Claude preview tool can't bind ports <1024 — `.claude/launch.json` runs it on 3888 for previews.
- shadcn/ui here is the **Base UI** flavor (`@base-ui/react`, not Radix): triggers use `render` props not `asChild`; Select takes `items` + `onValueChange`. Follow existing component usage.
- Income+split and income-migration writes are **two inserts with compensating delete** (supabase-js has no transactions) — acceptable single-user risk. Supabase is now deployed, so moving these writes into a Postgres RPC is an open TODO.

## Stack

- Next.js 15 (App Router, TypeScript, Turbopack)
- Supabase (Postgres + Auth) — live, project ref `bbiajfycdnkjikjbkmhu`
- Tailwind CSS v4 + shadcn/ui (Base UI primitives)
- supabase-js via `@supabase/ssr`; single user: one Supabase account, RLS on `user_id` on every table
- Vitest for the pure-math unit tests (`npm test`)

## Deployment (LIVE since 2026-07-11)

- **Production:** <https://wealthy-ten.vercel.app> — Vercel project `wealthy` (Hobby), GitHub `rayvenstrptr/wealthy`. **Deploys trigger on push to `main`.** The CLI path (`vercel --prod`) gets BLOCKED on this account — don't use it.
- **Commit-author gotcha:** Vercel blocks any deployment (`COMMIT_AUTHOR_REQUIRED`) whose commit author/committer email doesn't map to Ray's GitHub user. Commit with the GitHub noreply address: `git -c user.name="Rayven Satriaputra" -c user.email="62012037+rayvenstrptr@users.noreply.github.com" commit …` (Ray's usual git email `rayvensatriaputra@yahoo.co.id` is unverified on Vercel).
- **Supabase:** schema is `supabase/migrations/00001_init.sql`, applied 2026-07-11 (note: the expenses CHECK is `amount <> 0` — negative surplus rows are legal). Email auth provider is ENABLED with autoconfirm ON — both are required by the `<username>@wealth.local` synthetic-email login; never disable them. Schema changes can be applied via the Management API `POST /v1/projects/{ref}/database/query` (direct DB connections need IPv6/paid IPv4 — not available here).
- **Env:** `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set on Vercel for production/preview/development. Local dev reads the same values from `.env.local` (refresh with `vercel env pull .env.local`).
- **Data:** Ray's real data was migrated 2026-07-11 from `.mock/db.json` into Supabase with UUIDs preserved. Single account: username `rays`. **The cloud database is the single source of truth** — local dev writes to it directly.

## Core Concepts

Two separate taxonomies — do NOT merge them:

1. **Budget types (envelopes)** answer "which envelope does this money go to?" — Invest, Cash, Life, Fun, Giving. Each has a `kind`: `'spending'` or `'investment'` (seed-fixed in v2; Invest is the only investment-kind envelope).
2. **Expense categories** answer "what was it spent on?" — Food, Transport, etc. Secondary; used for drill-down only.

Every expense requires BOTH a budget type and an expense category — but **only spending-kind budget types**: investment envelopes are deployed via the investments module, never via expenses (single source of record; selling 50jt and rebuying 55jt must not explode expense totals).

### Budget month cycle (payday-based) — IMPORTANT

Ray's payday is the **25th**. A budget month runs from the **25th of the previous calendar month to the 24th of the labeled month**:

- "January 2026" = 25 Dec 2025 – 24 Jan 2026
- A salary received 25 Dec funds **January's** budget.

Budget years follow the same cycle: "2026" = 25 Dec 2025 – 24 Dec 2026. All of this lives in `src/lib/dates.ts` (`CYCLE_START_DAY`, `budgetMonthOf`, `monthRange`, `yearRange`) with unit tests. The UI always shows the resolved date range so the cycle is never ambiguous.

### Income cadence

Each income type has a `cadence`: `monthly` (only **Salary** — drives the monthly budget) or `yearly` (everything else). Cadence controls which window an income's split funds: monthly-cadence splits count in the monthly view; ALL splits count in yearly/all-time. Configurable per income type in Settings.

### Per-income envelope splits (v2 — replaced the allocation matrix)

Every income entry stores its own split across envelopes in `income_allocations` (amounts, one row per non-zero cell). **The app's one HARD validation: split amounts must sum EXACTLY to the income amount** — enforced in the form (submit disabled, amber "Remaining to allocate" line) and in the server action. Rationale: any income varies from one entry to the next, salary included, so portions are decided at record time.

- The split editor (`income-split-editor.tsx`) has an Rp | % toggle. Amounts are the stored truth; % mode converts via `splitFromPercents` (rounding remainder → largest cell, only force-summed when percents hit 100).
- **Prefill**: picking an income type prefills the split from the most recent income of that type, proportionally scaled to the new amount (`scaleSplit`, remainder → largest cell). Hand-editing a cell stops re-prefill.
- Inline amount edits in the income list re-scale the stored split proportionally so the sum rule keeps holding.
- Allocated per envelope per window = Σ stored splits of counted incomes (`computeBudgetPerformance`) — exact sums, no derivation. The old "type has no split configured" warning is obsolete; splits ARE historical snapshots, so editing future splits never rewrites past months.

### Investments module (v2)

Ray invests irregularly ("buy when the time is right"), splitting risk across **asset classes**: Commodities 5 / Stocks 45 / Fixed 25 / Crypto 5 / Others 12.5 / Business 5 / Buffer 2.5 (seed defaults). Rules:

- **Targets are per budget YEAR** (`asset_class_targets`: class × year × percent). Changing the split means changing the whole year. Sum ≠ 100 warns, never blocks (Settings → Investments).
- **Investment budget** = income allocated to investment-kind envelopes in the budget year. Class budget = invest budget × target %.
- **Items** (`investment_items`) are the buyable things per class (BBCA, BTC, Deposito Superbank…). Managed in Settings; inline-creatable from the transaction form. Archive, never hard-delete.
- **Transactions** (`investment_transactions`): buy/sell, `amount` = total IDR, optional `quantity` (unit price derived, never stored).
- **Deployed = buys − sell proceeds** (net) per class per window — sells replenish the year's budget. A buy exceeding the class's remaining budget **warns, never blocks** (Ray intentionally overshoots sometimes). **Overselling is a HARD error** (`validateSell` in the actions).
- **Performance is realized-only, average cost** (`src/lib/investments.ts`, unit-tested): with quantity, sell basis = qty × avg cost; without quantity, a sell closes the ENTIRE outstanding cost (deposito-style); realized % is cumulative Σrealized ÷ Σbasis-sold (Ray's −800k then +1jt → +200k example). Holdings shown at cost — no market valuations in v2.
- **Windowing**: holdings/positions are always the current all-time state; realized P&L and deployed are windowed (yearly view) or total (all-time view).
- **Net worth = holdings at cost + max(budget − deployed, 0)** — shown on `/investments`. Yearly view uses the current-year budget; all-time view uses the CUMULATIVE capital (`capitalBase`, v2.2) = all invest-envelope income ever.
- **Yields (v2.2)**: a dividend/coupon is an income with `investment_item_id` set (split across envelopes like any income — recorded once via the Yield dialog on `/investments`). `computeInvestmentSummary` takes `yields` and folds them into realized amounts per class/total (zero basis; `realizedPct` stays trading-only). `getInvestmentYields()` in data.ts reads them.
- Dashboard: the Invest envelope card shows **Allocated vs Deployed** (net buys in the same window) and links to `/investments`.

## Data Model

See `supabase/migrations/00001_init.sql` for the authoritative schema (rewritten in place for v2 — it was never deployed). Tables: `income_types`, `budget_types` (+`kind`), `expense_categories`, `events`, `incomes`, `income_allocations`, `expenses`, `asset_classes`, `asset_class_targets`, `investment_items`, `investment_transactions`; RLS on `user_id` everywhere; seed trigger `seed_user_defaults()`. Rules that matter when touching code:

- Money is `bigint` IDR — never floats. Dates are `date`, day-granular. `quantity` is numeric (fractional units like 0.0005 BTC).
- `income_allocations` stores only non-zero cells; cascade-deleted with the income.
- Types/categories/classes/items referenced by entries can't be hard-deleted — archive (`is_active = false`). Archived items disappear from entry forms but still render in history; archived classes keep their holdings in totals.
- `budget_types.kind` is seed-fixed — no UI to flip spending↔investment in v2.

Seed data: income types Salary(monthly)/Yield/Bonus/Angpao/THR/TCG Yield/Others; budget types Invest(investment)/Cash/Life/Fun/Giving; 10 expense categories (NO "Invest" category); 7 asset classes with current-budget-year targets; default items (Stocks: BBCA/CDIA/BMRI/AAPL, Crypto: BTC/ETH/SOL, Fixed: Deposito Superbank, Pasar Uang BRI); demo incomes carry exact-sum splits; demo transactions include a BBCA round trip (+180k realized) and a no-quantity deposito buy.

## Pages

```
/             Dashboard — Monthly | Yearly | All time (the money screen)
/expenses     Expense list (search + filters, inline edit) + add/edit
/income       Income list (search + filters, inline edit) + add/edit with split editor
/investments  Yearly | All time — net worth, class cards, holdings drill-down, buy/sell entry
/events       Event list + per-event summary at /events/[id]
/settings     Income types, categories, Investments (classes/targets/items), envelopes, sign out
/import       xlsx import wizard (also linked from the user menu)
/login        Landing + sign-in/create-account (username + 4-digit PIN); default page when logged out
```

Mobile-first; the bottom tab bar has **5 tabs** (Home/Expenses/Income/Invest/Events — Settings lives in the top-right user menu, v2.2). A single "+ Expense" dialog is owned by `AddExpenseProvider` in `src/app/(app)/layout.tsx` and opened via `useAddExpense()` from both the FAB and the desktop nav; it stays open after save for rapid entry.

## Conventions

- All summary math lives in `src/lib/summary.ts`; investment math in `src/lib/investments.ts`; split-editor math in `src/lib/allocation-split.ts`; cycle/date logic in `src/lib/dates.ts` — all pure and unit-tested (`npm test`). **Never compute budget/investment numbers in components.**
- Server components read via `src/lib/data.ts`; writes via server actions in `src/lib/actions/*` returning `{ ok } | { ok: false, error }`. **Every read/write path has a mock-mode branch** (`src/lib/mock/api.ts`, store in `src/lib/mock/store.ts`) — keep both in sync when changing the data layer, including the seed.
- Money formatting via `formatIDR`/`formatNumber` in `src/lib/format.ts` (id-ID separators).
- **Negative expenses are legal** (surplus/refund refills the budget; only 0 is invalid). `parseAmountInput`/`AmountInput`/`InlineAmount` take an `allowNegative` flag — expenses pass it, incomes/investments don't.
- Import: pure row classification + duplicate detection in `src/lib/import/core.ts` (unit-tested); xlsx reading (exceljs) + preview/execute server actions in `src/lib/actions/import.ts`; imported incomes reuse the latest split of their type (scaled) or fall back 100% → Cash.
- Philosophy: **warn, don't block** (target sums, over-budget buys, negative expenses, import duplicates) — the two exceptions are the income split sum (hard) and oversells (hard).

## Front-end map

- `src/app/(app)/page.tsx` — dashboard (stat cards, envelope cards incl. Invest→deployed variant)
- `src/app/(app)/investments/page.tsx` — all investments math orchestration + layout
- `src/components/dashboard/` — `period-picker`, `budget-performance`, `envelope-card` (has `verb="deployed"` prop)
- `src/components/investments/` — `period-picker` (Yearly|All-time), `class-card`, `item-section` (holdings accordion + tx edit, per-class subtotals), `transaction-form` (inline item create, over-budget warn chip, A–Z items), `transaction-dialog`, `yield-form`/`yield-dialog` (v2.2 — reuses `IncomeSplitEditor` + split prefill), `trade-log` (v2.2 — sortable buys/sells/yields table)
- `src/lib/envelope-colors.ts` / `src/lib/asset-class-colors.ts` — `envelopeHue(name)` / `assetClassHue(name)` → oklch {fill,tint,text,track}; pure presentation, warm-neutral fallback
- `src/components/income-split-editor.tsx` — the Rp/% split editor; `income-form.tsx` owns prefill state
- `src/components/add-expense-provider.tsx` — shared Add-Expense dialog (`useAddExpense()`)
- `src/components/inline-edit.tsx`, `amount-input.tsx`, `simple-select.tsx` — shared field primitives
- `src/components/period-filter.tsx` — expenses/income period filter (month/year/all-time in the `month` URL param, stepper capsule, mobile bottom sheet, payday-cycle caption); param parsing via `src/lib/period.ts` (unit-tested)
- `src/components/settings/` — income-types, categories, budget-types (investment badge), asset-classes, class-targets (year stepper + copy-prev-year), investment-items
- `src/components/nav.tsx` — desktop top bar + mobile 6-tab bottom bar
- `src/app/globals.css` — Tailwind v4 theme tokens (colors/radius live here as CSS vars)

**Rules of engagement for visual work:** don't touch the lib/ math modules, actions, or schema; mobile-first (bottom nav + FAB ergonomics are sacred; expense entry ≤ 2 taps); keep both themes working; verify with `npm test` + `npm run build`; eyeball on the dev server (mock data — delete `.mock/db.json` to reset).

**Remaining front-end candidates (unprioritized):** charts (income by type, spending trend, class allocation donut), budget bar micro-design, skeleton/loading states, better empty states, PWA/installability, subtle motion on save/toasts.

## Non-goals (current)

- Market-price feeds / unrealized P&L (v2 is realized-only, holdings at cost — manual valuations are the natural v3 step)
- Multi-currency, multi-user, bank import / OCR receipts
- Recurring transactions (candidate — salary is predictable)
- Envelope carryover of unspent monthly budget (candidate)
- FIFO cost basis (average cost only)
