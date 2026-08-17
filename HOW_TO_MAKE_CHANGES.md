# How to make & test changes — TaskPulse (for Gaurav)

This guide is **copy-paste friendly** — you can hand any step (or the whole file) to an AI coding assistant (Claude, Copilot, Cursor) and it will know what to do. You do **not** need to be a programmer.

---

## 0) The mental model (read this once)

- **Piyush's repo = PRODUCTION.** `https://github.com/DocEmm19/taskpulse` → the live app at **https://docemm19.github.io/taskpulse/**. You never edit this directly.
- **Your FORK = your SANDBOX.** You copy ("fork") the repo into your own GitHub account, make changes on a **branch**, and test on **your own** live link. Nothing you do can break Piyush's production.
- **To ship a change to production**, you send it to Piyush as a **Pull Request (PR)**. He reviews the exact changes and merges — which auto-deploys to the production link.
- **Every change gets logged** in `CHANGELOG.md` so Piyush can see the "what & why" at a glance.

**Two golden rules:**
1. **Never commit directly to `main`.** Always make a branch (steps below).
2. **Never put passwords/keys in the code.** Secrets live only in GitHub repo Settings → Secrets.

---

## 1) One-time setup (do once)

### 1a. Fork the repo
- Go to `https://github.com/DocEmm19/taskpulse` → click **Fork** (top-right) → create the fork under your account.
- **Keep the repo name exactly `taskpulse`** (don't rename it). *Why: the app's web address path is `/taskpulse/`; renaming breaks the live page unless you also change `app/app.json` → `expo.experiments.baseUrl` to `/<new-name>/`.*
- Your fork will be at: `https://github.com/gauravthapar81-ai/taskpulse`

### 1b. Turn on your own live link (GitHub Pages on your fork)
- In **your fork**: **Settings → Pages → Build and deployment → Source = GitHub Actions**.
- Your test app will publish to: **https://gauravthapar81-ai.github.io/taskpulse/**
- Push any change (step 2) and the "Deploy to GitHub Pages" action runs automatically. Watch it under the **Actions** tab; green check = deployed.

### 1c. (Only if you want to test LOGIN + SYNC) make a SEPARATE test Supabase
- Follow `SETUP.md` to create a **test** Supabase project and add the two secrets **to your fork** (Settings → Secrets and variables → Actions):
  - `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- ⚠️ **Use a throwaway/test Supabase, NOT Piyush's production one** — so you never mix test data with real tasks.
- If you skip this, the app still runs in **offline mode** (no login, local-only) — perfect for testing look/feel and most features.

---

## 2) Make a change

### 2a. Create a branch (never edit `main`)
Give your AI assistant this, or run it yourself after cloning your fork locally:
```bash
git checkout main
git pull
git checkout -b change/<short-name>     # e.g. change/bigger-fonts
```

### 2b. Hand your AI assistant this kickoff prompt
> You are helping me modify a React Native + Expo **web-only** task app called TaskPulse. I am not a developer — explain in plain language and make minimal, focused changes.
> Rules: (1) only change what I ask; (2) never edit files under `app/src/lib/sync/` or `app/scripts/` or `schema_and_setup.sql` unless I explicitly ask — those are the sync/deploy/database core; (3) never hardcode secrets; (4) after any change run `cd app && npx tsc --noEmit && npm test` and make sure both pass; (5) keep the app building with `cd app && npm run build:web`.
> Where things live: screens = `app/src/screens/`, shared UI = `app/src/components/`, colors/spacing = `app/src/theme/theme.ts`, per-request edit map = `PROJECT_INDEX.md` (read it first). 
> After the change: tell me exactly which files changed and why, in one short paragraph, so I can log it.

### 2c. Log the change (IMPORTANT — this is how Piyush helps you later)
Add one entry to the top of `CHANGELOG.md` (see the format in that file). Fill in: date, branch name, what you changed, why, which files, and how you tested it. **Every change = one entry.** This is the single most useful thing you can do to make troubleshooting fast.

---

## 3) Test it on YOUR end

**Option A — fastest, no install (test on your fork's live link):**
1. Commit + push your branch (step 4a).
2. Go to your fork → **Actions** → wait for the green check.
3. Open **https://gauravthapar81-ai.github.io/taskpulse/** on your phone/laptop and try it.
   - Tip: to test a **branch** on Pages you can either merge it into your fork's `main`, or just test `main` after pushing. (For quick trials, working on your fork's `main` is fine — it's only your sandbox.)

**Option B — live local preview (if you/your assistant have Node.js installed):**
```bash
cd app
npm install
npm run web        # opens a local dev version in your browser, hot-reloads as you edit
```
Then before sending anything back, always run:
```bash
cd app
npx tsc --noEmit   # type check — must pass
npm test           # test suite — must pass
npm run build:web  # confirms it still builds for production
```

**After deploying to Pages, do the ONE critical check** (from `VERIFICATION_CHECKLIST.md`): open the site, open the browser DevTools **Console**, type `crossOriginIsolated` and press Enter — it must print `true`. If `false`, hard-refresh once. (This is what makes the database work.)

---

## 4) Send a change back to Piyush (for production)

### 4a. Push your branch
```bash
git add -A
git commit -m "clear description of the change"
git push -u origin change/<short-name>
```

### 4b. Open a Pull Request to Piyush's repo
- On your fork's page GitHub shows **"Compare & pull request"** → click it.
- Set **base repository = `DocEmm19/taskpulse`, base = `main`**; **head = your fork / your branch**.
- Paste the **Report-back template** (bottom of this file) into the PR description.
- Submit. Piyush gets the exact diff, your CHANGELOG entry, and your notes — easy to review and troubleshoot.

### 4c. Production deploy (Piyush does this)
Piyush reviews → merges into `DocEmm19/taskpulse` `main` → it **auto-deploys** to https://docemm19.github.io/taskpulse/. If anything looks wrong, he can revert that one merge cleanly. **You never deploy to production yourself.**

---

## 5) Golden rules / guardrails (quick reference)

- ✅ Always work on a **branch on your fork**; never commit to `main` on Piyush's repo.
- ✅ **Log every change** in `CHANGELOG.md`.
- ✅ Keep `cd app && npx tsc --noEmit && npm test` **green** before sending a PR.
- ✅ Keep the fork repo named **`taskpulse`** (or update `app/app.json` baseUrl).
- ✅ Secrets only in GitHub **Settings → Secrets**, never in code. Use a **test** Supabase, not production.
- 🚫 Don't touch `app/src/lib/sync/**`, `app/scripts/**`, or `schema_and_setup.sql` unless the change is specifically about sync/deploy/database — and flag it loudly to Piyush if you do.
- 🚫 Don't put real patient/personal data in a test build.

---

## Appendix A — CHANGELOG entry format
See `CHANGELOG.md`. Copy the template block, fill it in, put newest on top.

## Appendix B — Report-back / PR template (copy-paste into every PR or message to Piyush)
```
### What I changed
<one or two plain sentences>

### Why
<the problem this solves / what I was trying to do>

### Files touched
<list, or "see the diff">

### How I tested it
- [ ] Ran `npx tsc --noEmit` — passed
- [ ] Ran `npm test` — passed
- [ ] Deployed to my fork's Pages and clicked through it
- [ ] `crossOriginIsolated` printed `true` in the console
- Devices tested: <phone / laptop / browser>

### Anything weird / questions for Piyush
<errors, console messages, screenshots, or "none">

### Branch
change/<short-name>  (on github.com/gauravthapar81-ai/taskpulse)
```
```
```
