# TaskPulse — Verification Checklist (do this after SETUP.md, with Abhay)

This checklist covers the things **only you and Abhay can verify**, with the app actually deployed and your real Supabase project connected — a computer can't check these ahead of time. Go through it top to bottom, together if possible (one of you on a laptop, the other on a phone), right after finishing `SETUP.md`.

Check each box as you confirm it. If anything fails, the "What to do if this fails" note under that item tells you the fix — most issues trace back to Steps 5, 8, or 10 in `SETUP.md`.

---

## 0. Cross-origin isolation check (do this FIRST — everything else depends on it)

This is the single most important check. TaskPulse's on-device database (the thing that makes tasks show up instantly and work offline) needs a browser feature called "cross-origin isolation." GitHub Pages doesn't turn this on by default — the app has a workaround built in, but this check proves the workaround actually took effect on **your** deployed site.

- [ ] **Open the deployed site** in a normal desktop browser (Chrome, Edge, or Safari) — the link from SETUP.md Step 11 (looks like `https://<username>.github.io/<repo-name>/`).
- [ ] **Open the browser's DevTools console**:
  - Chrome/Edge: right-click anywhere on the page → **Inspect** → click the **Console** tab (or press F12, or Cmd+Option+J on Mac).
  - Safari: you may first need to turn on the Develop menu (Safari → Settings → Advanced → "Show Develop menu"), then Develop → Show JavaScript Console.
- [ ] **Type exactly** `crossOriginIsolated` into the console and press Enter.
- [ ] **Confirm it prints `true`.** (It will show `true` on its own line, in blue or plain text depending on the browser.)

**If it prints `false` instead of `true`:**
1. This almost always means it's your **very first page load** of this deployment — the fix (a background "service worker") installs itself in the background on the first visit, then reloads the page once automatically to turn itself on. It's expected to be `false` for a split second before that automatic reload happens.
2. **Do a hard refresh** (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows/Linux) and check `crossOriginIsolated` again.
3. Still `false`? Fully close the browser tab, reopen the link fresh, wait a couple of seconds for it to finish loading, and check again.
4. Still `false` after that? Something didn't deploy correctly — go back to `SETUP.md` Step 11 and confirm the GitHub Actions run finished with a green checkmark (not a red X), and that you're opening the *current* deployed link, not a cached/bookmarked old one. If it's still stuck at `false`, this needs a developer to look at the deploy output — note it down and flag it rather than continuing, since the database may not work correctly until this is fixed.

- [ ] Repeat this same check (open site → console → `crossOriginIsolated` → `true`) on **the second person's device/browser** too, not just the first one you tried.

---

## 1. Sign-in — both people, both devices

- [ ] Gaurav opens the site link and signs in with his own email + password (created in SETUP.md Step 4).
- [ ] Abhay opens the same site link **on a different device** (e.g. Gaurav on a laptop, Abhay on his phone — or vice versa) and signs in with his own email + password.
- [ ] Both of you land on the TaskPulse app (task list), not stuck on the sign-in screen or a blank page.

*If sign-in fails:* see the "Can't log in" row in SETUP.md's troubleshooting table.

## 2. Create a task — appears on the other person's device

- [ ] One of you creates a new task (any title, e.g. "verification test — create").
- [ ] Within a few seconds, **without refreshing manually**, it appears in the task list on the other person's device.

## 3. Edit a task — change syncs both ways

- [ ] One of you edits that task (change the title, due date, or notes).
- [ ] The change appears on the other person's device within a few seconds.

## 4. Reassign a task — assignment updates on both sides

- [ ] One of you reassigns the task to the other person.
- [ ] The reassignment (and any change in who it's shown as "assigned to") shows up on both devices within a few seconds.

## 5. Complete a task — status syncs

- [ ] One of you marks the task complete (checkbox / "done" action).
- [ ] It shows as completed on the other person's device within a few seconds.

## 6. Delete a task — removal syncs

- [ ] One of you deletes the task.
- [ ] It disappears from the other person's device within a few seconds (not just your own).

## 7. Attach a file — uploads and downloads correctly

- [ ] Create a new task and attach a file to it (a photo is the easiest test — use the phone's camera/gallery picker when prompted).
- [ ] On the other person's device, open that same task and confirm the attachment shows up and **downloads/opens successfully** (not a broken thumbnail or an error).

## 8. Offline → reconnect — changes still sync

- [ ] On one device, turn on Airplane Mode (or turn off Wi-Fi/data).
- [ ] While offline, make a change — create a task, or edit/complete an existing one.
- [ ] Confirm the app doesn't crash or show a scary error — it should let you keep working (this is expected behavior, not a bug).
- [ ] Turn Wi-Fi/data back on (reconnect).
- [ ] Within a short time after reconnecting, confirm the change appears on the **other person's** device.

## 9. Activity History shows your own actions correctly (known v1 limitation: not cross-device yet)

- [ ] Open a task's Activity History (or equivalent activity log) **on the device where you took an action** (e.g. you created the task, or you completed it).
- [ ] Confirm it shows **your correct name** (or email, if you skipped the optional "full_name" step in SETUP.md Step 4) next to each action you took on this device — not "unknown" and not blank.
- [ ] **Known v1 limitation — don't be alarmed by this:** Activity History and Reassignment History are recorded **per-device only** in this version. If Gaurav created a task and Abhay completed it, Gaurav's device shows only "created" in its Activity History, and Abhay's device shows only "completed" in its own — each of you sees the entries made on your own device, not your partner's. This is expected, not a bug; the task itself (title, status, assignee, due date, remarks, attachments, contacts, etc.) still stays **fully in sync** between both of you. See SETUP.md's "Honest notes" section for the one-line summary. Shared, cross-device Activity History is planned for a future update.

## 10. (Web only) Reminder caveat + a real reminder firing

- [ ] Open the app on the **web** (browser, not the installed phone app) and create a task with a reminder set for a couple of minutes in the future.
- [ ] Confirm the app shows the **reminder caveat/notice** somewhere near the reminder-setting UI (the honest note that web reminders are best-effort — see SETUP.md's "Honest notes" section for the exact wording to expect).
- [ ] **Keep that browser tab open** and wait for the reminder time to pass.
- [ ] Confirm the reminder actually fires (a notification/alert appears) while the tab is open in the foreground or background.
- [ ] This is a best-effort feature — if the browser tab was fully closed, it's expected/normal for the reminder not to fire. That's not a failure of this checklist; it's the documented limitation from SETUP.md.

---

## All done?

If every box above is checked, TaskPulse is genuinely working end-to-end for both of you — real-time sync, attachments, offline resilience, and history are all confirmed live, not just "should work." You're good to start using it day to day.

If any single item failed and the linked fix in `SETUP.md` didn't resolve it, write down exactly which numbered item failed and what you saw (a screenshot helps) before asking for help — that's the fastest way for someone else to diagnose it without redoing this whole checklist.
