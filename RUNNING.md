# Running the dashboard locally

Everything below assumes a terminal. Since 2026-07-11 the app lives in the cloud
(<https://wealthy-ten.vercel.app>) and the local server talks to the **same** database,
so internet is required. You usually don't need to run locally at all anymore — just
open the website. Run locally when developing or when Vercel is down.

## Step by step

**1. Open Terminal** (Cmd+Space, type "Terminal", Enter).

**2. Go to the project folder.** Copy this line exactly, including the quotes — the folder name
has a space in it:

```bash
cd "/Users/rayvenstrptr/Something/life support/wealth-dashboard"
```

**3. Install dependencies.** Only needed the first time, or after a `git pull` that changed
`package.json`. Takes a minute or two.

```bash
npm install
```

**4. Start the server.**

```bash
npm run dev
```

Wait for it to print `✓ Ready in 4.3s` or similar.

**5. Open the app** at **http://localhost:888**

Note the port: **888**, not 3000. It is set in `package.json` under `scripts.dev`.

**6. Log in.** Username + 4-digit PIN. The cloud account is `rays` — same login as the
website. (The old mock-only accounts `ray` and `test1` only exist if you switch back to
mock mode.)

**7. Stop the server** when done: click the terminal window and press `Ctrl+C`.

That's it. Repeat steps 2, 4, 5 every time — steps 1 and 3 are one-offs.

---

## What's actually running

The app checks whether the environment variable `NEXT_PUBLIC_SUPABASE_URL` is set:

- **Not set → mock mode.** Data is a plain JSON file on this Mac at `.mock/db.json`. Accounts are
  in `.mock/users.json`. Nothing leaves the machine.
- **Set → Supabase mode.** Talks to a real cloud Postgres database.

There **is** a `.env.local` file here (since 2026-07-11), so local runs in **Supabase mode**:
everything you see and edit locally is the live cloud data — the same thing the website shows.
If the Supabase keys ever change, refresh the file with `vercel env pull .env.local`.
To deliberately go offline, rename `.env.local` away and you're back in mock mode.

---

## About `.mock/db.json` (old local data)

The real Y2025 data was migrated into Supabase on 2026-07-11 — the cloud is now the source of
truth, and `.mock/db.json` is a frozen snapshot from just before the migration (a Desktop backup
`db-backup-2026-07-11-pre-cloud.json` also exists). Deleting it no longer loses live data, but
keep it as a last-resort archive. It only gets read in mock mode.

`.mock/users.json` still holds the mock-mode logins. Both files are gitignored.

---

## Troubleshooting

**"address already in use" / `EADDRINUSE`**
A server is already running on port 888, probably from a terminal you forgot about. Either use the
app that is already up at http://localhost:888, or kill it:

```bash
lsof -ti:888 | xargs kill
```

**"command not found: npm"**
Node.js is not installed or not on your PATH. This project was verified on Node v22.17.1. Install
from https://nodejs.org (LTS version), then reopen Terminal.

**Weird 500 errors, blank pages, or stale-looking UI**
Delete the build cache and restart. This is safe — it does not touch your data.

```bash
rm -rf .next
npm run dev
```

**Login page loops or rejects a good PIN**
A corrupted session cookie. Visit http://localhost:888/auth/reset — it clears the cookie and
sends you back to login.

**Nothing else works**
Confirm your data file is intact, then reinstall from scratch:

```bash
ls -la .mock/db.json     # should be ~500 KB, not 0
rm -rf node_modules .next
npm install
npm run dev
```

---

## Other useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 888. **This is the one you want.** |
| `npm test` | Runs the budget/investment math unit tests. |
| `npm run build` | Production build. Catches type errors the dev server tolerates. |
| `npm start` | Serves an already-built app on port **3000**. Requires `npm run build` first. |
| `npm run lint` | Lints the code. |

`npm run dev` is what you want for daily use — it picks up file edits automatically. The
`build` + `start` pair is only worth it if you want the faster production build; it will not
reload when you change code.
