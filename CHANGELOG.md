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

## [2026-08-20] Fix New Task screen: attachments, Assigned To, Due Date
- Branch: fix/new-task-date-time-attachments
- Who: Claude (for Abhay), per bug report from testing the New Task screen
- What:
  - Attachments (Gallery/Photo, PDF, Record Audio, Video File) can now be picked on the New Task screen itself, reusing the exact same picker components/logic as the Task Detail screen. Since attachments require a saved task id in the DB, picked files are held locally ("pending") and committed to the task the moment it's created.
  - Due Date / Reminder / any date-time field was completely non-functional on web: `@react-native-community/datetimepicker` has no web implementation (its fallback just renders nothing and console.warns), and `DateTimeField.tsx`'s picker markup was only rendered when `Platform.OS === 'ios'`, so tapping the field silently did nothing on web. Added `DateTimeField.web.tsx` (Metro's platform-extension resolution) using the browser's native date/time input, invisibly overlaid on the same-looking row — native iOS/Android untouched.
  - Assigned To: typing/saving on task creation already worked; fixed a related bug where editing an existing task's Assigned To value was silently dropped because `TaskPatch`/`updateTask` never accepted an `assignedToName` field.
- Why: reported as broken/unclickable in manual testing of the New Task screen; verified root causes via headless + mobile-emulated browser testing against both the dev server and a production `expo export -p web` build.
- Files touched: app/src/components/DateTimeField.web.tsx (new), app/src/lib/pendingAttachments.ts (new), app/src/components/AttachmentsSection.tsx, app/src/screens/NewEditTaskScreen.tsx, app/src/db/repositories/tasks.ts, plus new tests under app/src/components/__tests__/ and app/src/db/__tests__/updateTaskAssignedTo.test.ts
- Tested: tsc pass · npm test pass (85) · build:web pass · manually verified via Playwright against both `expo start --web` and a production `expo export -p web` build (Due Date, Assigned To, and a picked PDF all persisted correctly to a newly created task)
- Status: testing on this branch, not yet merged to main
- Notes / issues for Piyush: none — native iOS/Android DateTimeField and the Task Detail attachments flow are unchanged.

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
