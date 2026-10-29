-- Supabase Schema Migration: Derive developer availability from project assignments
-- Date: 2026-10-28
-- Description:
-- 1. Ensures `joined_at` exists on `public.developers` (backfilled from `created_at`).
-- 2. Updates `developer_overview` view to dynamically derive developer availability status and project name
--    from `project_assignments` rather than storing status separately:
--    - No project assignments -> 'available'
--    - All assignments have an end date of today or earlier -> 'available'
--    - At least one assignment has no end date -> 'unavailable'
--    - At least one assignment has a future end date -> 'unavailable'
-- 3. Dynamically resolves `available_from` date as the latest completed assignment end date (on or before today),
--    falling back to `joined_at` or `created_at` when the developer has no prior assignments.

ALTER TABLE public.developers
ADD COLUMN IF NOT EXISTS joined_at timestamptz;

UPDATE public.developers
SET joined_at = created_at
WHERE joined_at IS NULL;

ALTER TABLE public.developers
ALTER COLUMN joined_at SET DEFAULT now();

DROP VIEW IF EXISTS public.developer_overview;

CREATE OR REPLACE VIEW public.developer_overview AS
WITH active_assignment AS (
  SELECT DISTINCT ON (pa.developer_id)
    pa.developer_id,
    p.name AS project_name
  FROM public.project_assignments pa
  LEFT JOIN public.projects p ON p.id = pa.project_id
  WHERE pa.end_date IS NULL OR pa.end_date::date > CURRENT_DATE
  ORDER BY pa.developer_id, pa.created_at DESC
),
latest_ended_assignment AS (
  SELECT
    pa.developer_id,
    MAX(pa.end_date) AS last_assignment_end_date
  FROM public.project_assignments pa
  WHERE pa.end_date IS NOT NULL AND pa.end_date::date <= CURRENT_DATE
  GROUP BY pa.developer_id
)
SELECT
  d.id,
  d.full_name,
  d.email,
  d.skills,
  -- Dynamic availability status strictly derived from project assignments:
  -- - No project assignments: 'available'
  -- - All assignments ended today or earlier: 'available'
  -- - At least one assignment with no end date: 'unavailable'
  -- - At least one assignment has a future end date: 'unavailable'
  CASE
    WHEN aa.developer_id IS NOT NULL THEN 'unavailable'
    ELSE 'available'
  END AS status,
  d.location,
  d.availability_hours,
  d.created_at,
  d.joined_at,
  aa.project_name,
  -- Dynamic availability date:
  -- When available, use the most recent completed assignment end_date (today or earlier),
  -- or fallback to developer's joined_at / created_at.
  CASE
    WHEN aa.developer_id IS NOT NULL THEN NULL
    ELSE COALESCE(
      lea.last_assignment_end_date::timestamptz,
      d.joined_at,
      d.created_at
    )
  END AS available_from
FROM public.developers d
LEFT JOIN active_assignment aa ON aa.developer_id = d.id
LEFT JOIN latest_ended_assignment lea ON lea.developer_id = d.id;

-- Grant permissions on developer_overview
GRANT SELECT ON public.developer_overview TO authenticated;
GRANT SELECT ON public.developer_overview TO anon;
