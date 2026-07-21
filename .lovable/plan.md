## Goal
Support arbitrarily-shaped syllabus hierarchies per exam (RAS: Paper → Unit → Subject → Chapter → Topic → Subtopic; Patwar: Paper → Unit → Subject → Chapter → Topic → Subtopic; future exams: anything else) without hard-coding levels.

## Core idea: keep the existing generic tree, formalize `node_type` as free-form labels per exam

The `syllabus_nodes` table is already a self-referential tree (`parent_id`, `sort_order`, `node_type text`). That structure already supports any depth and any labels — we just need to stop treating `node_type` as a fixed enum of `subject/chapter/topic/subtopic` and start treating it as an exam-defined label.

Two small additions make this robust:

1. **Per-exam level schema** — each exam declares the ordered list of level labels it uses. RAS = `["paper","unit","subject","chapter","topic","subtopic"]`, Patwar = `["paper","unit","subject","chapter","topic","subtopic"]`, a future exam could be `["section","topic"]`. Stored as `exams.level_schema jsonb` (array of strings).
2. **Depth on each node** — `syllabus_nodes.depth int` (0 = root child of exam). Combined with `exam.level_schema[depth]`, we always know what a node "is" without hard-coding names. `node_type` stays as the human label (denormalized from schema for convenience and to allow the odd off-schema node).

Nothing else about the tree changes — parent/child, sort_order, RLS, and the admin AI parser stay as-is.

## What changes

### Database (one migration)
- `exams`: add `level_schema jsonb not null default '["subject","chapter","topic","subtopic"]'::jsonb`.
- `syllabus_nodes`: add `depth int not null default 0`. Backfill from existing rows by walking `parent_id`.
- Keep `node_type` as free text; no enum.
- No policy changes needed.

### Admin panel (`/admin`)
- When creating/editing an exam, admin edits the level schema as an ordered chip list ("Paper, Unit, Subject, Chapter, Topic, Subtopic" for RAS; different for Patwar).
- AI PDF parser (`src/lib/syllabus-ai.functions.ts`): pass the exam's `level_schema` into the system prompt so Gemini emits nodes tagged with the right labels and depth for that exam. Output shape becomes `{ nodes: [{ title, type, depth, children? }] }` where `type` must be one of the schema labels.
- Tree editor renders labels dynamically from `level_schema[depth]` instead of assuming subject/chapter/topic/subtopic.

### Student onboarding curation (Step 3)
- Today's step 3 assumes two fixed levels (subjects + chapters). Change it to curate at the **top two levels of the exam's schema** — whatever those happen to be. For RAS the student picks Papers, then Units under each Paper; for Patwar, Paper (only one) then Units; for a flat exam, whatever the top two levels are. `profiles.selected_subject_ids` / `selected_chapter_ids` become generic `selected_l1_ids` / `selected_l2_ids` (rename with a migration, or keep column names and treat them as generic — see Technical details).

### Syllabus tree UI (`src/routes/syllabus.tsx`) and store
- `SyllabusNode.type` becomes `string` (not a union).
- Node "kind" label shown in the row and drawer reads from `exam.level_schema[node.depth]` rather than a hard-coded set.
- Font-weight/visual hierarchy currently keyed off `type === "subject"` / `"chapter"` becomes keyed off `depth` (depth 0 = boldest, etc.).
- Status dots, reset, drawer, exclude — all unchanged; they already work per-node.

### Revision engine, analytics, progress
- No schema changes needed. "Mastery %", "Subject completion" etc. currently group by the `subject` level. Replace that assumption with "group by depth 0 of this exam's schema" so it works for any exam shape.

## Technical details

- **Depth backfill SQL** (single migration): recursive CTE over `syllabus_nodes` computing depth from root, then `UPDATE ... FROM cte`.
- **Column rename** for `profiles.selected_subject_ids` → `selected_l1_ids` and `selected_chapter_ids` → `selected_l2_ids` is optional. Recommended to avoid the columns lying about their meaning, but requires updating `src/lib/auth.tsx`, `OnboardingModal.tsx`, and `store.tsx`. Cheaper option: leave column names, add a code-level comment. Plan assumes rename.
- **AI prompt**: inject `Level schema for this exam (in order): ${schema.join(" > ")}` into the system prompt and require `type` ∈ schema and `depth` = index of `type` in schema.
- **Validation** on admin save: reject any node whose `type` isn't in the exam's schema, or whose depth doesn't match `schema.indexOf(type)`.
- **Existing RAS data**: after backfill, verify depths look right in `/admin`; the admin can re-run the AI parse against the RAS PDF with the new 6-level schema if the current tree is only 4 levels deep.

## Out of scope for this plan
- Cross-exam node reuse (sharing "Indian Polity" between RAS and UPSC). Can be added later via a `syllabus_templates` table.
- Free-form user-added nodes under an exam's tree.

## Files touched
- Migration: `exams.level_schema`, `syllabus_nodes.depth`, optional `profiles` column rename.
- `src/lib/syllabus-ai.functions.ts` — prompt + output schema.
- `src/routes/admin.index.tsx` — level-schema editor, dynamic labels.
- `src/components/OnboardingModal.tsx` — generic L1/L2 curation.
- `src/lib/store.tsx`, `src/lib/mock-syllabus.ts` (types), `src/routes/syllabus.tsx` — dynamic depth-based rendering.
- `src/routes/progress.tsx` — group by depth 0 instead of hard-coded "subject".
- `src/lib/auth.tsx` — if renaming profile columns.
