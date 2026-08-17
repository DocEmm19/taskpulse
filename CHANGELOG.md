# CHANGELOG — TaskPulse

Log **every** change here so anyone (especially Piyush) can see the delta at a glance.
**Newest entry on top.** One entry per change/branch. See `HOW_TO_MAKE_CHANGES.md` for the full workflow.

Copy this template for each new change:

```
## [YYYY-MM-DD] <short title>
- Branch: change/<short-name>   (fork: github.com/gauravthapar81-ai/taskpulse)
- Who: <name>
- What: <plain-language description of what changed>
- Why: <the problem it solves / goal>
- Files touched: <list, or "see PR diff">
- Tested: tsc <pass/fail> · npm test <pass/fail> · deployed-to-fork-Pages <yes/no> · crossOriginIsolated=true <yes/no> · devices <phone/laptop>
- Status: <testing on my fork | PR opened to DocEmm19/taskpulse #<n> | merged to production>
- Notes / issues for Piyush: <anything odd, errors, screenshots, or "none">
```

---

## [2026-08-17] v1 baseline (starting point — do not edit, for reference)
- Branch: main
- Who: Piyush (build) — handed to Gaurav
- What: TaskPulse v1 live: web-only Expo→GitHub Pages, offline-first local DB, two-way Supabase sync (push+pull+realtime, last-write-wins), invite-only shared workspace, PWA, web voice recording + best-effort web reminders.
- Why: production handoff for Gaurav + Abhay to use and test.
- Files touched: (initial bundle)
- Tested: tsc pass · npm test pass (72) · build:web pass · crossOriginIsolated=true verified live · devices: desktop+mobile browser
- Status: merged to production (https://docemm19.github.io/taskpulse/)
- Notes / issues for Piyush: known v1 limitations — Activity/Reassignment history is per-device (tasks + their data sync); sync/auth need a Supabase project + 2 repo secrets to activate (see SETUP.md).
```
```
