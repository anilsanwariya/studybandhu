## Multi-Stage Exams + Test Series Architecture

Frontend-only mock-data implementation across 4 modules. No DB migrations yet — everything lives in the store + localStorage so the UI is testable immediately. Backend wiring (AI PDF parse, real test-series tables) comes later.

### Module 1 — Types & Store

**`src/lib/mock-syllabus.ts`**
- Add `stages?: ('prelims' | 'mains')[]` to `SyllabusNode`.
- Export new types: `Intent = 'prelims' | 'mains' | 'both'`, `BucketItem = { id: string; intent: Intent }`, `TestSeries`, `Test`.
- Add mock `TEST_SERIES_SEED` (2–3 series, mix of statuses, past + future tests, overlapping `mappedTopicIds`) so High-Yield badges are demonstrable.

**`src/lib/auth.tsx` (`UserProfile`)**
- Add `studyMode?: 'prelims' | 'mains' | 'both'` (default `'both'`) and `scheduleMode?: 'self-paced' | 'test-series'` (default `'self-paced'`). Persist to `user_profiles` writes if the column exists; otherwise stash in localStorage keyed by user id (safer — no schema change this pass).

**`src/lib/store.tsx`**
- Migrate `bucket: string[]` → `bucket: BucketItem[]`. Add localStorage migration that lifts legacy string ids to `{ id, intent: 'both' }`.
- `addToBucket(id, intent='both')`, `removeFromBucket(id)`, `bucketNodes` returns `(SyllabusNode & { intent })[]`.
- New state slice `testSeries: TestSeries[]` seeded from mock, with `setTestSeriesStatus(id, status)`, `saveTestMarks(seriesId, testId, marks, maxMarks)`, `setScheduleMode(mode)`, `setStudyMode(mode)`. Persist to a new `sb-test-series-{userId}` localStorage key.
- Merge `stages` from mock onto topic nodes by id after tree loads (since DB nodes don't have it yet) so P/M badges show on real syllabus data.

### Module 2 — Prelims/Mains everywhere

- New tiny `<StageBadge stages={...} />` component (P / M / P+M pill), reused in `MorningIntent`, `syllabus`, `revisions`, `progress`.
- `MorningIntent` `+` intercept: when `user.studyMode === 'both'` and topic has both stages, open a shadcn `Dialog` (bottom-sheet feel on mobile via `max-w-md` + `sm:` positioning) with 3 buttons → calls `addToBucket(id, intent)`. Otherwise add directly with the natural intent (`prelims` / `mains` / `both`).
- `progress.tsx`: `Tabs` at top (Combined / Prelims / Mains). Filter helper `nodeMatchesStage(node, stage)` — a node matches when itself or any descendant contains that stage. Donut, subject bars, and topic list all pipe through the filter.

### Module 3 — `/schedule` route

New file `src/routes/schedule.tsx` (registered via file-based routing).

- Head metadata (unique title/desc, matches directive).
- Top segmented toggle: Self-Paced / Test Series Directed → `setScheduleMode`.
- **Manage Subscriptions**: card list of series. Row = title, status pill, status dropdown (`Select` → active/paused/completed). "View completed" toggle unhides completed rows.
- **Master Timeline**: flat sort of all tests from `active` series by date asc. Grouped visually by month header.
- **Test Card**: date chip, title, parent series name, progress bar `mastered / total` computed from mapped topics via `findNode`.
- **Enter Marks**: shown when `new Date(test.date) < now`. Dialog with number inputs → `saveTestMarks`.
- **Upload Schedule**: dialog with drag-and-drop dropzone (visual only; on drop just toast "Parsing coming soon").

### Module 4 — Morning Intent aggregation

- When `scheduleMode === 'test-series'`:
  - For each `active` series, find first test with `date >= today`.
  - Union `mappedTopicIds`, tally counts across those tests.
  - Replace `newTargets` / `dueToday` data sources with topic nodes resolved from that union; keep the same card UI + rating flow.
  - Topic card gains a `High Yield 🔥` glowing badge (subtle amber ring + pulse) when count > 1.
  - Top banner: "Targeting upcoming tests · next in Nd Hh" (nearest future test countdown, live-updating each minute).
- Self-paced mode = current behavior untouched.

### Files touched

- `src/lib/mock-syllabus.ts` (types + seed)
- `src/lib/auth.tsx` (profile fields + setters)
- `src/lib/store.tsx` (bucket shape, test-series slice, stage merge)
- `src/components/StageBadge.tsx` (new)
- `src/components/MorningIntent.tsx` (intent picker, test-series mode, high-yield, banner)
- `src/routes/schedule.tsx` (new)
- `src/routes/progress.tsx` (stage tabs + filter)
- `src/routes/syllabus.tsx` (stage badges on topics)
- `src/routes/revisions.tsx` (stage badges, respect bucket intent)
- `src/components/AppShell.tsx` (add `/schedule` to bottom nav)

### Out of scope this pass

- Supabase schema changes for `stages`, test series, or user schedule fields (mock/localStorage only).
- Actual PDF parsing for uploaded schedules.
- Editing `stages` on nodes in the admin editor.

Confirm and I'll build it.
