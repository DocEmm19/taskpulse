# TaskPulse — start here

This is the complete, self-contained handoff for TaskPulse: a private task-manager web app for you (Gaurav) and Abhay, hosted free on GitHub Pages, backed by your own free Supabase account.

**Start with `SETUP.md`** — it's a step-by-step, no-coding-required guide that takes you from "I have this zip" to "the app is live and both of us can use it on our phones." It takes about 30–45 minutes.

## What's in this folder

- **`SETUP.md`** — the guide. Read this first, follow it top to bottom.
- **`schema_and_setup.sql`** — the database setup script. `SETUP.md` tells you exactly when and how to run it (you paste it into Supabase's SQL Editor — no coding involved).
- **`VERIFICATION_CHECKLIST.md`** — a checklist to run through with Abhay right after setup, to confirm everything actually works end-to-end (sync, attachments, offline, reminders). `SETUP.md` points you here at the very end.
- **`app/`** — the app's source code. GitHub Desktop needs this folder when you publish your repository in `SETUP.md` Step 7 — you won't need to open or edit any of it yourself.
- **`.github/workflows/deploy.yml`** — the automation that builds and publishes the app to GitHub Pages every time you push a change. `SETUP.md` tells you the two things you need to configure for it (repository Secrets and the Pages source) — you don't need to read or edit this file.

## Order of operations

1. Read and follow **`SETUP.md`** end to end.
2. When it tells you to, run **`schema_and_setup.sql`** in Supabase (twice, per the guide).
3. Once the site is live and you can both sign in, work through **`VERIFICATION_CHECKLIST.md`** together.

That's it — no terminal, no code editor, no command line required anywhere in this process.
