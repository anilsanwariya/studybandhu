## Goal

Lock the syllabus to a single fixed schema — **Subject → Chapter → Topic → Subtopic** — for every exam. Topics become the unit of daily study and revision. Subtopics get checkboxes inside a topic revision card and persist their own status. Students get per-user customization at the Chapter/Topic/Subtopic layers.

## Fixed schema

Drop the variable `level_schema` concept. Everywhere in the app:
- depth 0 = Subject
- depth 1 = Chapter
- depth 2 = Topic (this is what goes into the bucket and revision engine)
- depth 3 = Subtopic (checklist inside a topic; not independently bucketed)

Existing exam trees are wiped and re-parsed by admin against the new schema.

## Database changes (single migration)

1. `exams.level_schema` — drop column (or ignore; simplest: drop).
2. `syllabus_nodes` — **wipe all rows**. Admin re-uploads PDFs. `depth` and `node_type` stay but are constrained to the 4 fixed values.
3. New table `user_syllabus_nodes` — student-owned overrides:
   - `user_id`, `exam_id`, `parent_id` (references either `syllabus_nodes.id` for admin parent or another `user_syllabus_nodes.id`), `parent_kind` ('admin' | 'user'), `title`, `node_type` ('chapter' | 'topic' | 'subtopic'), `depth`, `sort_order`.
   - RLS: full CRUD scoped to `auth.uid() = user_id`.
4. New table `user_node_hidden` — student's hide list for admin nodes:
   - `user_id`, `node_id` (FK `syllabus_nodes.id`), unique(`user_id`,`node_id`).
   - RLS: CRUD scoped to `auth.uid() = user_id`.
5. `profiles.selected_chapter_ids` continues to work (it stores UUIDs; admin + user chapter IDs coexist as long as they're unique UUIDs).

Subtopic status (checked/unchecked, mastery) stays in the existing `localStorage` progress store keyed by node id — no schema change needed. This keeps the client-side persistence model already in place.

## Syllabus tab

- Rendering merges admin nodes (from `syllabus_nodes`) with the student's `user_syllabus_nodes` and applies `user_node_hidden` as a visibility mask.
- Each row shows action affordances based on ownership:
  - **Admin node**: Hide / Unhide only (no delete, no edit).
  - **User node**: Edit title, Delete, plus an "Add child" action.
- "Add" buttons appear on Subject rows ("Add chapter"), Chapter rows ("Add topic"), and Topic rows ("Add subtopic"). Subject-level add is disabled — students can't add subjects.
- Filters (Subject/Chapter) keep working over the merged tree.

## Morning Intent / bucket

- Bucket only accepts **topic** nodes (depth 2), admin or user-owned.
- Existing bucket UI already filters by leaf; change it to filter by `node_type === 'topic'` so admin topics that happen to have no subtopics still qualify, and admin nodes deeper than topic (there won't be any after wipe) are excluded.

## Revision engine — subtopic checklist

- Topic card in `/revisions` shows a checklist of that topic's subtopics (admin + user, minus hidden).
- Each subtopic row: checkbox, title, tap-to-mark-mastery (small status dot updates like elsewhere).
- Submit (Hard/Medium/Easy or Preset/Custom):
  - If all subtopics checked → submit immediately.
  - If any unchecked → confirm dialog: "Submit without completing X subtopics?" with Cancel / Submit anyway.
  - Topics with zero subtopics submit immediately (no checklist rendered).
- Checked state persists per subtopic in the same `localStorage` progress store; on next revision of the same topic, previously-checked subtopics show as checked but stay editable.

## Progress page

- Subject Completion always groups by depth 0 (Subject) — remove the schema lookup, use the constant.
- Topic Mastery tree renders the fixed 4 levels.

## Onboarding

- Step 3 curation: pick Subjects (L1), then Chapters (L2). Wording becomes literal ("Subjects", "Chapters") again — no schema-driven labels.
- `selected_subject_ids` / `selected_chapter_ids` semantics restored to their original meaning.

## Admin panel

- Remove level-schema editor from exam create/edit.
- AI PDF parser prompt fixed to emit exactly `subject / chapter / topic / subtopic` with matching depths; reject other labels.

## Files touched

- Migration: drop `exams.level_schema`, truncate `syllabus_nodes`, create `user_syllabus_nodes` + `user_node_hidden` with GRANTs and RLS.
- `src/integrations/supabase/types.ts` — regenerated after migration.
- `src/lib/syllabus-ai.functions.ts` — hard-coded 4-level prompt/output schema.
- `src/routes/admin.index.tsx` — remove schema editor.
- `src/routes/syllabus.tsx` — merged tree, hide/unhide, add/edit/delete UI, per-user CRUD server fns.
- New `src/lib/user-syllabus.functions.ts` — `addUserNode`, `updateUserNode`, `deleteUserNode`, `hideAdminNode`, `unhideAdminNode`, `listUserOverrides`.
- `src/lib/store.tsx` — merge admin + user nodes into the in-memory tree; extend persisted state with `subtopicChecks: Record<subtopicId, boolean>`; bucket accepts topic-depth nodes; revision `rateTopic` clears the checklist after submit.
- `src/routes/revisions.tsx` — subtopic checklist, unchecked-submit confirmation dialog.
- `src/components/MorningIntent.tsx` — bucket target is topic nodes; label copy back to Subject/Chapter.
- `src/components/OnboardingModal.tsx` — literal "Subjects"/"Chapters" labels; remove schema-derived labels.
- `src/routes/progress.tsx` — fixed depth-0 subject grouping.

## Out of scope

- Sharing custom subtopics between students.
- Bulk import of custom subtopics.
- Moving/reordering custom nodes across parents.
