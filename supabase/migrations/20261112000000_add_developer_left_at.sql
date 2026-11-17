-- Supabase Schema Migration: Track developers who have left KeelWorks
-- Date: 2026-11-12
-- Description:
-- 1. Adds optional `left_at` date to `public.developers`.
--    - NULL -> active member
--    - On or before today -> former member
--    - Future date -> still an active member until that date
-- 2. Recreates `developer_overview` to expose `left_at` and a derived
--    `membership_status` ('active' / 'former'). Membership is kept separate
--    from project-assignment availability (`status`), which is unchanged.
-- No existing rows are modified: every current developer stays active.

ALTER TABLE public.developers
ADD COLUMN IF NOT EXISTS left_at date;

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
  CASE
    WHEN aa.developer_id IS NOT NULL THEN 'unavailable'
    ELSE 'available'
  END AS status,
  d.location,
  d.availability_hours,
  d.created_at,
  d.joined_at,
  aa.project_name,
  CASE
    WHEN aa.developer_id IS NOT NULL THEN NULL
    ELSE COALESCE(
      lea.last_assignment_end_date::timestamptz,
      d.joined_at,
      d.created_at
    )
  END AS available_from,
  d.left_at,
  CASE
    WHEN d.left_at IS NOT NULL AND d.left_at <= CURRENT_DATE THEN 'former'
    ELSE 'active'
  END AS membership_status
FROM public.developers d
LEFT JOIN active_assignment aa ON aa.developer_id = d.id
LEFT JOIN latest_ended_assignment lea ON lea.developer_id = d.id;

GRANT SELECT ON public.developer_overview TO authenticated;
GRANT SELECT ON public.developer_overview TO anon;
