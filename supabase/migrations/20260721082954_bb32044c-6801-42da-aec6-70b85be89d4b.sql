ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS selected_subject_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS selected_chapter_ids uuid[] NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON public.profiles (username)
  WHERE username IS NOT NULL;