# Running the dashboard locally

Everything below assumes a terminal. No Supabase account, no internet, no Claude needed.

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

**6. Log in.** Username + 4-digit PIN. Existing accounts: `ray`, `rays`, `test1`.

**7. Stop the server** when done: click the terminal window and press `Ctrl+C`.

That's it. Repeat steps 2, 4, 5 every time — steps 1 and 3 are one-offs.

---

## What's actually running

The app checks whether the environment variable `NEXT_PUBLIC_SUPABASE_URL` is set:

- **Not set → mock mode.** Data is a plain JSON file on this Mac at `.mock/db.json`. Accounts are
  in `.mock/users.json`. Nothing leaves the machine.
- **Set → Supabase mode.** Talks to a real cloud Postgres database.

There is no `.env.local` file here, so you are in **mock mode**. That is why `npm run dev` needs no
configuration at all.

---

## ⚠️ Do not delete `.mock/db.json`

`README.md` and `CLAUDE.md` both say "delete `.mock/db.json` to reset to seed data." That advice is
now **dangerous**. That file holds the real Y2025 data imported from the xlsx sheet. Deleting it
replaces everything with fake demo entries.

Back it up regularly:

```bash
cp .mock/db.json ~/Desktop/db-backup-$(date +%Y-%m-%d).json
```

`.mock/users.json` is a separate file on purpose, so a data reset would not destroy the logins.
Both are gitignored — they are **not** in git, so git will not save you here. The Desktop copy is
the only safety net.

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
