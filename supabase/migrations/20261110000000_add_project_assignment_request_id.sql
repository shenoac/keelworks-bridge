-- Allow assignments to optionally reference a request.
ALTER TABLE public.project_assignments
ADD COLUMN IF NOT EXISTS request_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_assignments_request_id_fkey'
      AND conrelid = 'public.project_assignments'::regclass
  ) THEN
    ALTER TABLE public.project_assignments
    ADD CONSTRAINT project_assignments_request_id_fkey
    FOREIGN KEY (request_id)
    REFERENCES public.requests(id)
    ON DELETE SET NULL;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.validate_assignment_request_project()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.request_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.requests r
    WHERE r.id = NEW.request_id
      AND r.project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'The request must belong to the assigned project'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS project_assignments_request_project_check
ON public.project_assignments;

CREATE TRIGGER project_assignments_request_project_check
BEFORE INSERT OR UPDATE OF request_id, project_id
ON public.project_assignments
FOR EACH ROW
EXECUTE FUNCTION public.validate_assignment_request_project();
