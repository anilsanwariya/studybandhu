
-- Wipe existing syllabus so admins re-parse under the fixed schema.
DELETE FROM public.syllabus_nodes;

-- Drop the per-exam schema column; every exam now uses subject/chapter/topic/subtopic.
ALTER TABLE public.exams DROP COLUMN IF EXISTS level_schema;

-- Student-owned syllabus nodes (chapter/topic/subtopic only).
CREATE TABLE public.user_syllabus_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  parent_kind TEXT NOT NULL CHECK (parent_kind IN ('admin','user')),
  parent_id UUID NOT NULL,
  title TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK (node_type IN ('chapter','topic','subtopic')),
  depth INTEGER NOT NULL CHECK (depth BETWEEN 1 AND 3),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX user_syllabus_nodes_user_exam_idx ON public.user_syllabus_nodes(user_id, exam_id);
CREATE INDEX user_syllabus_nodes_parent_idx ON public.user_syllabus_nodes(parent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_syllabus_nodes TO authenticated;
GRANT ALL ON public.user_syllabus_nodes TO service_role;

ALTER TABLE public.user_syllabus_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own custom nodes"
  ON public.user_syllabus_nodes FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER user_syllabus_nodes_updated_at
  BEFORE UPDATE ON public.user_syllabus_nodes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Per-user hide list for admin nodes.
CREATE TABLE public.user_node_hidden (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES public.syllabus_nodes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, node_id)
);

GRANT SELECT, INSERT, DELETE ON public.user_node_hidden TO authenticated;
GRANT ALL ON public.user_node_hidden TO service_role;

ALTER TABLE public.user_node_hidden ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own hidden list"
  ON public.user_node_hidden FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
