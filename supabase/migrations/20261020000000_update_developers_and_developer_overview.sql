-- Supabase Schema Migration: Update developers table and developer_overview view
-- Date: 2026-10-20
-- Description:
-- 1. Adds `joined_at` and `available_from` columns to `developers` table with default and backfill.
-- 2. Recreates the `developer_overview` view to include:
--    - id, full_name, email, skills, status
--    - location, availability_hours, created_at, joined_at
--    - project_name (resolved from active project_assignments where end_date IS NULL)
--    - available_from (resolved from the most recent project assignment end_date if returning from project,
--      or developer's available_from, joined_at, or created_at)
-- 3. Grants appropriate select permissions to authenticated and anon roles.

-- Step 1: Add joined_at and available_from columns to developers table
ALTER TABLE public.developers
ADD COLUMN IF NOT EXISTS joined_at timestamptz DEFAULT now();

ALTER TABLE public.developers
ADD COLUMN IF NOT EXISTS available_from timestamptz DEFAULT now();

-- Backfill existing developers who do not have joined_at or available_from populated
UPDATE public.developers
SET joined_at = created_at
WHERE joined_at IS NULL;

UPDATE public.developers
SET available_from = COALESCE(joined_at, created_at, now())
WHERE available_from IS NULL;

-- Step 2: Recreate developer_overview view to include all developer fields and dynamic availability date
DROP VIEW IF EXISTS public.developer_overview;

CREATE OR REPLACE VIEW public.developer_overview AS
WITH latest_ended_assignment AS (
  SELECT
    developer_id,
    MAX(end_date) AS last_assignment_end_date
  FROM public.project_assignments
  WHERE end_date IS NOT NULL
  GROUP BY developer_id
),
active_assignment AS (
  SELECT DISTINCT ON (pa.developer_id)
    pa.developer_id,
    p.name AS project_name
  FROM public.project_assignments pa
  JOIN public.projects p ON p.id = pa.project_id
  WHERE pa.end_date IS NULL
  ORDER BY pa.developer_id, pa.created_at DESC
)
SELECT
  d.id,
  d.full_name,
  d.email,
  d.skills,
  d.status,
  d.location,
  d.availability_hours,
  d.created_at,
  d.joined_at,
  aa.project_name,
  -- Dynamic availability date:
  -- If developer was on a project assignment that ended, use the most recent end_date.
  -- Otherwise, fallback to developer's explicit available_from, joined_at, or created_at.
  COALESCE(
    lea.last_assignment_end_date,
    d.available_from,
    d.joined_at,
    d.created_at
  ) AS available_from
FROM public.developers d
LEFT JOIN active_assignment aa ON aa.developer_id = d.id
LEFT JOIN latest_ended_assignment lea ON lea.developer_id = d.id;

-- Step 3: Grant permissions on developer_overview
GRANT SELECT ON public.developer_overview TO authenticated;
GRANT SELECT ON public.developer_overview TO anon;
