# TaskPulse — Setup Guide (for Gaurav, no coding needed)

This guide takes you from "I have a zip file" to "the app is live on the web and I can use it on my phone." Follow the numbered steps in order — don't skip ahead. Every step tells you exactly what to click or type. It should take about 30–45 minutes the first time.

You do **not** need to know how to code. You will use two free websites (GitHub and Supabase) and copy-paste a few things between them.

**What you're building:** a private task-manager web app for you and Abhay, hosted for free, that both of you can open on your phones (and add to your Home Screen so it looks/acts like a real app) and on any computer's browser. Your data lives in your own free Supabase account — nobody else can see it.

---

## Before you start

- You'll need: a computer with a web browser, and 30–45 minutes of uninterrupted time.
- Have the `taskpulse_production_<date>.zip` file (the one this SETUP.md came in) downloaded somewhere you can find it, e.g. your Desktop or Downloads folder.
- Don't unzip it yet — you'll do that in Step 6.

---

## Step 1 — Create two free accounts

1. **GitHub** (this is where the app's files and the "publish website" robot live): go to https://github.com/signup and create a free account. Verify your email if asked.
2. **Supabase** (this is where your and Abhay's tasks, photos, and other data will actually be stored): go to https://supabase.com, click **Start your project**, and sign up (signing up with your GitHub account is the fastest way — click "Continue with GitHub").

`[Screenshot: GitHub signup page]`
`[Screenshot: Supabase signup page]`

---

## Step 2 — Create your Supabase project

1. In the Supabase dashboard, click **New project**.
2. Give it any name, e.g. `taskpulse`.
3. Choose any database password — Supabase can generate one for you (click the "Generate a password" button if offered). Save it somewhere safe; you likely won't need it again for this setup, but it's good practice to keep it.
4. Choose the region closest to you (e.g. Mumbai, if offered) and click **Create new project**.
5. Wait 1–2 minutes while Supabase sets up your project (it shows a progress screen).

`[Screenshot: Supabase "New project" form]`

---

## Step 3 — Run the database setup script (first pass)

This creates all the tables the app needs (tasks, categories, contacts, etc.) inside your new Supabase project.

1. In your Supabase project, click **SQL Editor** in the left sidebar, then click **New query**.
2. Open the `schema_and_setup.sql` file (it's in the same folder/zip as this SETUP.md) in any plain text editor (Notepad, TextEdit, or just double-click it and it'll likely open in your browser or a text app), select **all** of the text (Ctrl+A / Cmd+A), and copy it (Ctrl+C / Cmd+C).
3. Paste the whole thing into the Supabase SQL Editor box.
4. Click **Run** (or press Ctrl+Enter / Cmd+Enter).

**Expected result on this first run:** you'll see a red error message that says something like *"STEP 2 not configured yet: replace the gaurav_id / abhay_id placeholders..."* — **this is normal and expected.** It means all your tables were created successfully, and the script is just refusing to link two user accounts together because those accounts don't exist yet. You'll fix that in Step 5. Do not worry about this error — move on to Step 4.

`[Screenshot: SQL Editor with the expected red error after clicking Run]`

---

## Step 4 — Create the two user accounts (you and Abhay)

1. In the left sidebar, click **Authentication**, then **Users**.
2. Click **Add user** → **Create new user**.
3. Fill in an email and a password for **yourself**. Turn on **Auto Confirm User** if you see that option (it saves you from having to click a confirmation link in an email). Click **Create user**.
4. Repeat step 2–3 for **Abhay**, using his email and a password (Abhay should change this password himself after first login, if the option is available — but it isn't required to get started).

**Optional, nice-to-have — showing real names instead of emails:** the app shows "Gaurav" and "Abhay" by name in places like Activity History if you set it up; otherwise it just shows your email address there instead, which works fine too. If you want to try it: click into the user row you just created, look for a section called **User Metadata** (it may be labeled slightly differently or need an "Edit user" click depending on Supabase's current dashboard), and enter:
```
{ "full_name": "Gaurav" }
```
(or `"Abhay"` for the other account), then save. **If this looks fiddly or you can't find the field, skip it** — the app will simply show the email address instead, and nothing else breaks.

5. Once both users exist, click into **each one** and copy its **User UID** — a long code that looks like `3fa85f64-5717-4562-b3fc-2c963f66afa6`. Paste each one somewhere temporary (a notes app, or a blank text file) labeled "Gaurav's UID" and "Abhay's UID" — you'll need both in the next step.

`[Screenshot: Authentication > Users > Add user dialog]`
`[Screenshot: User row showing the User UID to copy]`

---

## Step 5 — Link the two accounts together (second SQL run)

1. Go back to **SQL Editor** → the query you ran in Step 3 (or open a new query and paste the whole `schema_and_setup.sql` file again — it's safe to run more than once).
2. Scroll to near the bottom, to the block that starts with `do $$` and contains these two lines:
   ```
   gaurav_id uuid := '00000000-0000-0000-0000-000000000000'; -- replace with GAURAV's user id
   abhay_id  uuid := '00000000-0000-0000-0000-000000000000'; -- replace with ABHAY's user id
   ```
3. Replace the all-zeros code (`00000000-0000-0000-0000-000000000000`) on the `gaurav_id` line with **Gaurav's User UID** you copied in Step 4, and the all-zeros code on the `abhay_id` line with **Abhay's User UID**. Leave everything else in the file exactly as it is.
4. Click **Run** again.
5. This time it should complete with **no red error**. If you still see the "STEP 2 not configured yet" error, double-check you actually replaced both all-zero codes (not just one) and didn't accidentally add or remove any quote marks.

`[Screenshot: the do $$ block with real UUIDs pasted in, before clicking Run]`

---

## Step 6 — Get your two API values

1. In the left sidebar, click the gear icon **Project Settings**, then **API**.
2. You'll see two values you need — copy each one somewhere temporary, same as the UIDs:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon / public key** (a long string of letters and numbers)
3. Keep this browser tab open or these two values handy — you'll paste them into GitHub in Step 8.

`[Screenshot: Project Settings > API page with Project URL and anon key highlighted]`

---

## Step 7 — Put the app on GitHub

1. Unzip the `taskpulse_production_<date>.zip` file you downloaded (double-click it, or right-click → Extract). You'll get a folder containing an `app` folder, a `.github` folder, this `SETUP.md`, `schema_and_setup.sql`, and a couple of other files.
2. On https://github.com, click the **+** icon (top right) → **New repository**.
3. Give it a name — anything is fine, e.g. `gaurav-tasks`. **Write this name down exactly as you typed it** — you'll need it again in Step 10.
4. Leave it set to **Public** (this keeps things free and simple — see the honest note about this near the end of this guide). Do **not** check "Add a README file". Click **Create repository**.
5. The next screen shows a few ways to upload code. The easiest for a first-timer is **GitHub Desktop**:
   - Download and install GitHub Desktop from https://desktop.github.com (free), and sign in with your GitHub account.
   - In GitHub Desktop, choose **File → Add local repository**, and point it at the unzipped folder from step 1.
   - It will ask to initialize a repository — say yes.
   - Click **Publish repository** (top bar), make sure the name matches what you created in step 3, and untick "Keep this code private" so it matches the Public repo you made. Click **Publish**.
6. After publishing, refresh your repository's page on github.com — you should now see the `app` folder, `.github` folder, and the other files listed there.

`[Screenshot: GitHub "New repository" form]`
`[Screenshot: GitHub Desktop "Publish repository" dialog]`
`[Screenshot: the repository page on github.com showing uploaded files]`

---

## Step 8 — Add your two secret values

These are the Project URL and anon key from Step 6. They're called "Secrets" because GitHub keeps them encrypted and never shows them again once saved (that's expected — you won't need to view them again unless you're changing them).

1. On your repository's GitHub page, click **Settings** (top menu of the repo, not your account settings).
2. In the left sidebar, click **Secrets and variables → Actions**.
3. Click **New repository secret**.
4. For **Name**, type exactly: `EXPO_PUBLIC_SUPABASE_URL` — for **Secret**, paste the **Project URL** from Step 6. Click **Add secret**.
5. Click **New repository secret** again. For **Name**, type exactly: `EXPO_PUBLIC_SUPABASE_ANON_KEY` — for **Secret**, paste the **anon / public key** from Step 6. Click **Add secret**.
6. You should now see both secret names listed (their values stay hidden — that's normal).

**The two names must be typed exactly as shown above** (capital letters, underscores, no spaces) — the app looks for these exact names.

`[Screenshot: Settings > Secrets and variables > Actions, showing both secrets added]`

---

## Step 9 — Turn on GitHub Pages

1. Still in **Settings**, click **Pages** in the left sidebar.
2. Under **Build and deployment**, find the **Source** dropdown and change it to **GitHub Actions**.
3. That's it for this step — no save button needed, it saves automatically.

`[Screenshot: Settings > Pages with Source set to "GitHub Actions"]`

---

## Step 10 — Set the app's web address to match your repository name

1. On your repository's GitHub page, click into the `app` folder, then click on the file `app.json`.
2. Click the pencil (✏️) **Edit** icon (top right of the file view).
3. Find this line (near the middle of the file):
   ```
   "baseUrl": "/taskpulse/"
   ```
4. Change `taskpulse` to your **exact repository name** from Step 7, keeping the leading and trailing slashes. For example, if you named your repository `gaurav-tasks`, the line should become:
   ```
   "baseUrl": "/gaurav-tasks/"
   ```
5. Scroll down and click **Commit changes...**, then **Commit changes** again (committing straight to `main` is fine).

This single commit also automatically starts the first real deploy (the next step shows you how to watch it).

`[Screenshot: editing app.json in the GitHub web editor, baseUrl line highlighted]`

---

## Step 11 — Watch the deploy finish, then open your app

1. Click the **Actions** tab on your repository page.
2. You should see a run in progress (a yellow dot) called "Deploy to GitHub Pages". Click it to watch its progress if you're curious — it usually takes 2–4 minutes.
3. Wait for the yellow dot to turn into a **green checkmark**. If it turns into a **red X** instead, see the troubleshooting table below.
4. Once green, go to **Settings → Pages** — near the top you'll see "Your site is live at" followed by a link. It will look like:
   ```
   https://<your-github-username>.github.io/<your-repo-name>/
   ```
5. Click that link (or copy it) to open your app in the browser.

`[Screenshot: Actions tab with a green checkmark run]`
`[Screenshot: Settings > Pages showing the live site link]`

---

## Step 12 — Add it to your phone's Home Screen and sign in

Do this on **both** your phone and Abhay's phone.

1. Open the link from Step 11 in your phone's browser (Safari on iPhone, Chrome on Android).
2. **iPhone (Safari):** tap the Share icon (square with an arrow) → **Add to Home Screen** → **Add**.
   **Android (Chrome):** tap the three-dot menu (⋮) → **Add to Home screen** (or **Install app**) → **Add/Install**.
3. Open the app from the new icon on your Home Screen.
4. Sign in with the email + password you created for yourself in Step 4 (Abhay signs in with his own).
5. You should see the TaskPulse app. Try creating a task — if Abhay is signed in on his own device, it should appear for him too within a few seconds.

`[Screenshot: iOS Share sheet with "Add to Home Screen"]`
`[Screenshot: Android "Add to Home screen" menu item]`

---

## If something looks wrong

| What you see | Likely cause | What to do |
|---|---|---|
| Blank white page when you open the link | The `baseUrl` in `app.json` doesn't exactly match your repository name (Step 10) | Re-check Step 10 — the text between the slashes must match your repo name exactly, including capitalization and dashes |
| Can't log in / "invalid email or password" | The user account wasn't actually created, or the password was typed wrong | Go to Supabase → Authentication → Users and confirm the account exists; try **Add user** again if not, or reset the password from that same screen |
| Signed in, but tasks/data never appear, or the app seems stuck loading | The two Secrets are missing or misspelled, or Step 5 (linking the two users) never completed successfully | Recheck Step 8 (secret names must match exactly) and Step 5 (re-run the SQL and confirm no red error) |
| Your task shows up for you, but never appears on Abhay's phone (or vice versa) | Same as above — usually Step 5 (the workspace link) didn't complete, so the two accounts aren't linked | Re-run Step 5 and confirm you see no error at the end |
| The Actions tab shows a red X instead of a green check | The build failed — almost always missing/misspelled Secrets | Open the failed run, check the two secret names in Step 8 are typed exactly right, then push any small change (e.g. redo Step 10) to trigger a new run |
| A reminder didn't pop up on your phone even though the app was closed | This is expected sometimes — see the honest note about web reminders below | No fix needed; this is a known limitation, not a bug |

---

## Honest notes — things worth knowing (not bugs)

- **Supabase's free tier gives you 1 GB of storage** — plenty for two people's tasks, notes, and attachments for a long time.
- **Your Supabase project auto-pauses after about 7 days with no activity.** If neither of you opens the app for a week or more, the very next time someone opens it, it may take a bit longer than usual to load (Supabase is "waking up" the project) — this is normal and only affects the first load after a long gap.
- **Reminders on the web version are best-effort, not guaranteed** — especially on iPhone. If the app/browser tab is fully closed, a reminder notification may not fire. It reliably works while the app is open in the background. This is a known limitation of how web browsers (particularly iPhone Safari) handle notifications, not something this setup can fix.
- **Taking photos and recording voice notes work in the browser**, but the in-app custom camera screen is phone-app-only — on the web version, adding a photo goes through your phone/browser's own "choose file" / gallery picker instead (which on many phones still offers a "Take Photo" option), and voice notes are recorded directly in the browser.
- **Your repository is Public on GitHub**, which is the free, simplest option. This means the app's *code* is visible to anyone who looks for it — but your actual data (tasks, photos, contacts) is **not** in the code; it lives privately in your own Supabase project, which nobody else can access without your login. Your two API values are stored as GitHub Secrets, not visible in the code either.
- **Activity History and Reassignment History are per-device only in this version** — each of you sees the log entries for actions taken on your own device, not your partner's, even though the task itself (title, status, assignee, remarks, attachments, etc.) always stays fully in sync between you. Full shared Activity History sync is planned for a future update — see `VERIFICATION_CHECKLIST.md` item 9 for what to expect.

---

## Last step — verify it actually works

Once everything above is done, open `VERIFICATION_CHECKLIST.md` (in the same zip as this file) and go through it with Abhay — it walks through a real cross-device test (creating a task on one phone and watching it appear on the other, uploading a photo, etc.) to confirm the whole thing is genuinely working end to end before you rely on it day to day.
