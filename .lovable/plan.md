## Scope

Enable Lovable Cloud and rewire the app around real auth + a database-backed syllabus. Add a hidden admin panel where a single admin (anilsanwariya03@gmail.com) uploads exam PDFs, AI parses them into a syllabus tree, admin edits/rearranges, then publishes. On signup, students pick an exam and the published syllabus is copied to their account. Also fix Google sign-in.

## 1. Enable Lovable Cloud + AI

- Turn on Cloud (Supabase + Auth + Storage) and ensure `LOVABLE_API_KEY` for Lovable AI Gateway.
- Configure Google social auth via `supabase--configure_social_auth`.

## 2. Database (single migration)

- `app_role` enum: `admin`, `student`. `user_roles(user_id, role)` + `has_role()` security-definer.
- `profiles(user_id, username, name, avatar_url, target_exam_id, academic_background, target_year, onboarded, joined_at)` + trigger to auto-create on signup.
- `exams(id, name, slug, description, is_published)` — admin-managed.
- `syllabus_nodes(id, exam_id, parent_id, title, type[subject|chapter|topic|subtopic], sort_order)` — admin-authored canonical tree per exam.
- `user_syllabus_nodes(id, user_id, source_node_id, parent_id, title, type, status, excluded, note, url, revision_count, next_revision_at, due_today)` — per-student copy created at signup from the exam's canonical tree.
- All tables: GRANTs + RLS. Students read published exams + own rows only; admins full CRUD on exams/syllabus_nodes via `has_role`.
- Storage bucket `syllabus-pdfs` (private), admin-only RLS.
- Seed admin: after account creation, insert `user_roles(admin)` row for the given email (via one-time SQL after auth signup, or auto-grant trigger keyed on that specific email).

## 3. Admin account provisioning

- Use `supabaseAdmin.auth.admin.createUser` in a one-shot server function (or migration + edge call) to create the admin auth user with the provided email/password, email pre-confirmed, and grant `admin` role. Password stored in Cloud secret `ADMIN_SEED_PASSWORD` for provisioning only.

## 4. Auth rewire

- Replace mock `src/lib/auth.tsx` with Supabase-backed context: `onAuthStateChange`, `getUser`, sign in/up/out.
- `AuthModal`: real email/password signup + login, and Google via `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })` — this fixes the "no Google account chooser" bug (mock currently just calls `signIn` locally).
- Onboarding step 2 loads published exams from DB; on completion, server fn copies that exam's `syllabus_nodes` into `user_syllabus_nodes` for the user.
- Move protected app routes (`/syllabus`, `/revisions`, `/progress`, `/profile`) under `src/routes/_authenticated/` using the integration-managed gate. Public `/` shows Landing when signed out, dashboard when signed in.

## 5. Hidden admin panel

Routes (not linked from any public UI):

- `/admin/login` — email+password form; on success verifies `has_role(admin)`; else signs out and shows error.
- `/admin` (gated by admin role check in `beforeLoad`) with tabs:
  - **Exams**: list, create, edit metadata, publish toggle, delete.
  - **Syllabus editor** (per exam):
    - Upload PDF → stored in `syllabus-pdfs` bucket → server fn calls Lovable AI (`openai/gpt-5.5`) with the PDF as a `file` content block and a strict JSON schema to return `{subjects:[{title, chapters:[{title, topics:[{title, subtopics:[title]}]}]}]}`.
    - Tree editor: rename, add, delete, drag-reorder nodes (dnd-kit) with `sort_order`.
    - "Publish syllabus" writes rows to `syllabus_nodes` (replace-or-diff) and flips `exams.is_published`.

Admin routes render outside `AppShell` (own minimal glassmorphic shell) so students never see admin nav.

## 6. Student signup integration

- In signup form, exam selection is loaded from published `exams`.
- After email verification / first login, `completeOnboarding` server fn:
  1. Upserts profile with username + exam + background + year.
  2. Clones the exam's canonical tree into `user_syllabus_nodes` in one transaction.
- Existing store (`src/lib/store.tsx`) reads/writes `user_syllabus_nodes` via server fns instead of localStorage. Mock syllabus becomes fallback only until data loads.

## 7. Google sign-in fix

Root cause: current `AuthModal.handleGoogle` just calls the local mock `signIn` — no OAuth. Replace with `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`. Enable Google provider in Cloud via `supabase--configure_social_auth`. Users will now get the Google account chooser.

## Technical notes

- Server fns live in `src/lib/*.functions.ts` (client-safe path); admin-only fns verify `has_role(admin)` via `context.supabase` before importing `supabaseAdmin`.
- PDF parsing: send the uploaded PDF as `{type:"file", file:{filename, file_data:"data:application/pdf;base64,..."}}` to `/v1/chat/completions` with `openai/gpt-5.5` + `response_format: json_schema`.
- Add `_authenticated` layout (integration-managed) and `_admin` pathless layout with role gate.
- Keep glassmorphic pastel design system across new admin screens.

## Out of scope (this pass)

- Apple/SSO providers, admin analytics, multi-admin management UI, PDF re-parse diffing, versioned syllabi.

## Deliverables

Cloud enabled, migration applied, admin seeded, `/admin/login` + `/admin` shipped with PDF→AI→edit→publish flow, student signup pulls exams from DB and clones syllabus, Google sign-in works with account chooser.
