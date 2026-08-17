# 👋 Start here, Gaurav — TaskPulse

This is your task / meeting / follow-up / travel manager, built for you and Abhay. Right now it's **live and ready for you to try**. This page tells you exactly where to click and how to tell us what you think. **No technical steps needed to start.**

---

## 1) Open the app (works right now)

**▶️ Live app: https://docemm19.github.io/taskpulse/**

- Open it on your **phone browser** and on your **laptop**.
- On the phone: open the link → browser menu → **"Add to Home Screen"** → now it opens like a normal app, fullscreen.
- It comes pre-loaded with a few **example tasks** so there's something to play with immediately.

> Note: right now there's **no login** and it's **single-device** (your data stays on that one device/browser). That's on purpose for this first round — we're testing how the app *feels and works*. Logging in + sharing with Abhay across devices gets switched on in the next round (needs a small backend setup — see "What's next" below).

You can also see the project on GitHub (you've been invited): **https://github.com/DocEmm19/taskpulse** — you don't need this to test; it's where the code + your feedback live.

---

## 2) Your test tour (try these in order, ~15 min)

Tick them off as you go. Do it on **both** phone and laptop if you can.

1. **Home** — does the dashboard make sense? Counts, today's meetings, overdue tasks.
2. **Create a task** — tap **+ NEW TASK** (bottom-right). Add a title, priority, due date, a category. Save.
3. **Open a task** → try **Edit**, **Reassign**, add a **Remark**, mark **Complete**, then **reopen** it.
4. **Attachments** on a task — attach a **photo/file**, and try **Record Audio** (voice note) on the laptop.
5. **Contacts** — open a task's contact → try **Call / WhatsApp / Save / Copy**, and **Save Contact** (downloads a card).
6. **Add to Calendar** on a task with a time — it should open **Google Calendar**.
7. **Categories, Search, Filters** — switch categories, search a task.
8. **Travel & Calendar tabs** — look at the demo Mumbai trip / today's meetings.
9. **Reminders** — set a reminder a couple minutes out, keep the tab open, see if it notifies. *(Heads-up: web reminders are best-effort — may not fire if the tab is closed, especially on iPhone. That's expected for now.)*

As you go, notice: anything **confusing**, anything that **looks wrong**, anything that **doesn't work**, and anything you **wish it did**.

---

## 3) Tell us what you found (pick the easy path)

**For feedback, bugs, "this is confusing", ideas — use GitHub Issues (easiest, no coding):**
1. Go to **https://github.com/DocEmm19/taskpulse/issues** → **New issue**.
2. Write one issue per thing. Simple format:
   ```
   What I did: <steps>
   What I expected: <...>
   What happened: <...>
   Phone or laptop: <...>
   Screenshot: <attach if you can>
   ```
3. Submit. Piyush gets notified and can track it.

You can also just message Piyush directly — but Issues keep everything in one place so nothing gets lost.

---

## 4) If you (or your AI assistant) want to actually change something

You have a full workflow that keeps your experiments **separate from the live app** (you can't break production):
- Read **`HOW_TO_MAKE_CHANGES.md`** — fork the repo, make changes on a branch, test on **your own** copy, then send it to Piyush as a Pull Request.
- **Log every change in `CHANGELOG.md`** (there's a template) so Piyush can quickly see what changed and help if something breaks.
- Production always stays on Piyush's repo; changes go live only after he reviews + merges.

---

## 5) What's next (to switch on login + sharing with Abhay)

When you're ready to test **multi-device sync** (you and Abhay seeing the same tasks):
- Follow **`SETUP.md`** to create a free **Supabase** account/project and run the setup, then add the two keys as repo secrets.
- That flips the app into **shared, logged-in mode** for the two of you.
- (For your own experiments, use a *separate test* Supabase — never the production one — so test data stays out of real tasks.)

---

**TL;DR:** Open **https://docemm19.github.io/taskpulse/**, run the test tour, and drop anything you notice into **Issues**. That's the whole first round. 🎯
