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

## [2026-08-20] New Task screen: web-alert fix + compact multi-color redesign
- Branch: fix/new-task-date-time-attachments
- Who: Claude (for Abhay), follow-up to PR #2 testing feedback
- What:
  - Investigated a report that Due Date, Reminder, and Create Task were all broken when testing PR #2 in a GitHub Codespace. Could not reproduce any of the three in this sandbox across dev server + a full production `expo export -p web` build (real clicks, DOM/pointer-event inspection, console/network monitoring, with and without a pending audio attachment) — `DateTimeField.web.tsx` is confirmed to be what's actually bundled (grepped the built JS for `datetime-local`/`toInputValue`; the old native picker's warning string is absent). Did find and fix one real, confirmed gap: `NewEditTaskScreen.tsx`'s `handleSave()` used `Alert.alert` for both its validation checks (missing title/category) and its catch-block — `Alert.alert` is a no-op stub on web (react-native-web renders nothing, calls no callback), so any silent validation failure or thrown error looked exactly like "Create Task does nothing." Now uses the same `window.alert`-based `webAlert()` pattern already established in `TaskDetailScreen.tsx`.
  - Redesigned the New Task screen's layout per new requirements: compact two-column grid on wide/desktop viewports (Title+Priority, Assigned To+Company, Due Date+Reminder rows), single-column stacking on mobile, a subtle limited color accent per field group (blue/amber/purple/green/indigo/teal/neutral), and a compact header-right "Create Task"/"Save" button so it's reachable without scrolling. Promoted "Company" from the hidden "+ Contact" section to an always-visible field next to Assigned To; the contact-linking save logic now creates/links a contact whenever Contact Name or Company is filled (falling back to Assigned To as the contact's name if only Company is given), instead of requiring the "+ Contact" section to be expanded.
  - Attachments, Assigned To persistence, and Create Task's core save flow were left untouched (no logic changes beyond the contact-linking condition above).
- Why: reported bugs needed root-causing (not just re-assumed-fixed), and the New Task screen needed a more compact, professional, color-differentiated layout without touching working functionality.
- Files touched: app/src/screens/NewEditTaskScreen.tsx, app/src/components/DateTimeField.web.tsx (added optional accentColor/accentSoft props, backward-compatible), app/src/components/DateTimeField.tsx (added the same optional props to the type only, for cross-platform type-checking — native rendering unchanged), app/src/theme/theme.ts (added `fieldAccents`, additive only)
- Tested: tsc pass · npm test pass (85) · Playwright against a freshly restarted dev server at both 1280px (desktop) and 390px (mobile) widths — Due Date and Reminder both real-click-focusable and fillable, Create Task succeeds with no attachment, with a pending recorded-audio attachment, and with Assigned To + Company (verified the resulting task's Contact section shows the right name/company), zero console errors in any run
- Status: testing on this branch, not yet merged to main
- Notes / issues for Piyush: the Due Date/Reminder/Create-Task Codespace reports could not be reproduced here — if they persist after this update, the most useful next diagnostic would be actual browser console output from the Codespace session, or confirmation of a hard refresh / service-worker cache clear.

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
