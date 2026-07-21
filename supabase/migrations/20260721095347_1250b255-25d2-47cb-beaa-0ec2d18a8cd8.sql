
-- Per-exam level schema (ordered array of level labels)
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS level_schema jsonb NOT NULL
  DEFAULT '["subject","chapter","topic","subtopic"]'::jsonb;

-- Depth on each syllabus node (0 = root child of exam)
ALTER TABLE public.syllabus_nodes
  ADD COLUMN IF NOT EXISTS depth int NOT NULL DEFAULT 0;

-- Backfill depth from parent chain
WITH RECURSIVE t AS (
  SELECT id, 0 AS d
  FROM public.syllabus_nodes
  WHERE parent_id IS NULL
  UNION ALL
  SELECT n.id, t.d + 1
  FROM public.syllabus_nodes n
  JOIN t ON n.parent_id = t.id
)
UPDATE public.syllabus_nodes n
SET depth = t.d
FROM t
WHERE n.id = t.id;
