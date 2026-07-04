# Wealth Dashboard

Personal income + expense tracker with per-income-type budget allocations. Single user, IDR only,
Asia/Jakarta timezone. Full product spec lives in [CLAUDE.md](./CLAUDE.md).

Stack: Next.js 15 (App Router) · Supabase (Postgres + Auth) · Tailwind CSS + shadcn/ui · supabase-js.

## Quick start — local mock mode (no Supabase needed)

With no env vars configured the app runs entirely locally: auth is bypassed and data lives in
`.mock/db.json` (gitignored), pre-seeded with the default income/budget types, the allocation
matrix, categories, and a few demo entries.

```bash
npm install
npm run dev
```

Open http://localhost:3000 — that's it. Delete `.mock/db.json` to reset to the seed data.

## Going live with Supabase (later)

1. **Create a Supabase project** at [database.new](https://database.new).

2. **Apply the schema.** In the Supabase dashboard open *SQL Editor* and run the contents of
   [`supabase/migrations/00001_init.sql`](./supabase/migrations/00001_init.sql)
   (or use the CLI: `supabase link && supabase db push`).

3. **Create the single user account.** Dashboard → *Authentication* → *Users* → *Add user*
   (email + password, confirm email). Creating the user fires a trigger that seeds all default
   income types, budget types, the allocation matrix and expense categories.

   > Order matters: apply the migration **before** creating the user, or the seed trigger won't exist.

4. **Configure env vars.**

   ```bash
   cp .env.example .env.local
   # fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

5. **Run.** `npm run dev`, then sign in at http://localhost:3000/login with the account from
   step 3. Once the env vars exist, the app talks to Supabase — mock mode turns itself off.

## Deploying to Vercel

Push the repo to GitHub, import it in Vercel, and set the two `NEXT_PUBLIC_SUPABASE_*` environment
variables. No other configuration is needed.

## Tests

All budget math (derived %, monthly/yearly allocation, overspend, no-salary month, unallocated
income types, event totals) lives in `src/lib/summary.ts` and is covered by unit tests:

```bash
npm test
```

## Notes

- **Budget months run payday-to-payday**: the 25th of the previous calendar month through the
  24th ("January 2026" = 25 Dec 2025 – 24 Jan 2026). Budget years run 25 Dec – 24 Dec.
- Money is stored as `bigint` IDR — never floats. Display format `Rp 1.250.000`.
- Allocations are computed on the fly from the current matrix (editing a split recalculates past
  dashboards). If frozen history is ever needed, add `allocation_snapshot jsonb` to `incomes`.
- Types/categories/events referenced by entries can't be deleted — archive them in Settings.
