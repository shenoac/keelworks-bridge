/**
 * Shared Developer Types & Utilities
 *
 * Provides shared types, idle days calculations, skill formatting,
 * and environment detection for the developer directory and resource allocation.
 */

export type Developer = {
  id: string;
  full_name: string | null;
  email: string | null;
  skills: string | string[] | null;
  status: string;
  project_name: string | null;
  joined_at?: string | null;
  created_at?: string | null;
  available_from?: string | null;
  available_since?: string | null;
  location?: string | null;
  availability_hours?: number | null;
};

export type ProjectAssignment = {
  id?: string;
  project_id?: string | null;
  developer_id: string;
  project_name?: string | null;
  role?: string | null;
  allocation_percent?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
  projects?: { name?: string | null } | null;
};

export interface EnrichedDeveloper extends Developer {
  joinedDate: Date | null;
  availableDate: Date | null;
  idleDays: number | null;
  isAvailableForAllocation: boolean;
  allocationPriority?: number;
}

/**
 * Checks if the current runtime environment is development or preview.
 * Demo/mock data and local admin overrides are restricted to these environments only.
 */
export function isDevOrPreviewEnvironment(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" ||
    process.env.NEXT_PUBLIC_ALLOW_DEMO_MODE === "true"
  );
}

/**
 * Parses a date string or Date object, normalizing date-only strings (YYYY-MM-DD)
 * to local calendar midnight so timezone offsets never shift the calendar day.
 */
export function parseCalendarDate(dateInput?: string | Date | null): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  const trimmed = dateInput.trim();
  if (!trimmed) return null;

  // Match YYYY-MM-DD (or ISO strings starting with YYYY-MM-DD when representing calendar dates)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
  }

  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Checks whether an assignment end date is strictly in the future (after today).
 * Compares calendar dates (year, month, day) so that an end date of today or earlier
 * is considered completed ("Available"), while tomorrow or later is considered future ("Unavailable").
 */
export function isFutureEndDate(
  endDateStr?: string | null,
  referenceDate: Date = new Date()
): boolean {
  if (!endDateStr) return false;
  const datePart = endDateStr.trim().slice(0, 10);
  const parts = datePart.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return false;

  const [year, month, day] = parts;
  const endDay = new Date(year, month - 1, day).getTime();
  const refDay = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  ).getTime();

  return endDay > refDay;
}

/**
 * Determines whether an individual project assignment is currently active.
 *
 * An assignment is active (rendering a developer unavailable) if:
 * 1. It has no end date (`end_date` is null/empty)
 * 2. It has an end date strictly in the future (after today)
 */
export function isAssignmentActive(
  assignment: { end_date?: string | null },
  referenceDate: Date = new Date()
): boolean {
  if (!assignment.end_date) return true;
  return isFutureEndDate(assignment.end_date, referenceDate);
}

/**
 * Derives a developer's availability status strictly from their project assignments.
 *
 * Availability Rules:
 * | Project assignment situation                      | Developer availability |
 * | ------------------------------------------------- | ---------------------- |
 * | No project assignments                            | Available              |
 * | All assignments have an end date of today/earlier | Available              |
 * | At least one assignment has no end date           | Unavailable            |
 * | At least one assignment has a future end date     | Unavailable            |
 */
export function deriveDeveloperAvailability(
  assignments?: Array<{ end_date?: string | null }> | null,
  referenceDate: Date = new Date()
): "available" | "unavailable" {
  if (!assignments || assignments.length === 0) {
    return "available";
  }

  for (const assignment of assignments) {
    if (isAssignmentActive(assignment, referenceDate)) {
      return "unavailable";
    }
  }

  return "available";
}

/**
 * Finds the latest completed project assignment end date (on or before today).
 * Used to determine the exact date a developer became available on the bench.
 */
export function deriveLatestEndedDate(
  assignments?: Array<{ end_date?: string | null }> | null,
  fallbackDate?: string | Date | null,
  referenceDate: Date = new Date()
): Date | null {
  if (!assignments || assignments.length === 0) {
    return parseCalendarDate(fallbackDate);
  }

  let latestTimestamp: number | null = null;
  for (const a of assignments) {
    if (a.end_date && !isFutureEndDate(a.end_date, referenceDate)) {
      const d = parseCalendarDate(a.end_date);
      if (d) {
        if (latestTimestamp === null || d.getTime() > latestTimestamp) {
          latestTimestamp = d.getTime();
        }
      }
    }
  }

  if (latestTimestamp !== null) {
    return new Date(latestTimestamp);
  }

  return parseCalendarDate(fallbackDate);
}

/**
 * Formats skills for display whether stored as an array or comma-separated string.
 */
export function formatSkills(skills: Developer["skills"]): string {
  if (Array.isArray(skills)) {
    return skills.filter(Boolean).join(", ") || "Not provided";
  }
  return skills?.trim() || "Not provided";
}

/**
 * Extracts and parses a developer's original joining date.
 */
export function getDeveloperJoinedDate(developer: Developer): Date | null {
  const dateStr = developer.joined_at || developer.created_at;
  return parseCalendarDate(dateStr);
}

/**
 * Determines the date a developer most recently became available.
 * Order of precedence:
 * 1. `available_from` or `available_since` (e.g. project assignment end date or return date)
 * 2. `joined_at` (original join date fallback if never on a prior project)
 * 3. `created_at` (database record creation date fallback)
 */
export function getDeveloperAvailableDate(developer: Developer): Date | null {
  const dateStr =
    developer.available_from ||
    developer.available_since ||
    developer.joined_at ||
    developer.created_at;
  return parseCalendarDate(dateStr);
}

/**
 * Determines whether a developer is unassigned and currently available on the bench.
 */
export function isAvailableForAllocation(developer: Developer): boolean {
  const status = developer.status?.toLowerCase().trim();
  const projectName = developer.project_name?.toLowerCase().trim();
  const hasNoProject = !projectName || projectName === "unassigned";

  return status === "available" && hasNoProject;
}

/**
 * Calculates the number of bench idle days for a developer.
 *
 * Edge cases handled:
 * - Assigned developers or unavailable developers return `null`.
 * - Returning from a project today returns `0` idle days.
 * - Future availability dates return `0` idle days (no negative values).
 * - Invalid or missing dates return `0`.
 */
export function calculateIdleDays(developer: Developer, now: number = Date.now()): number | null {
  if (!isAvailableForAllocation(developer)) {
    return null;
  }

  const availableDate = getDeveloperAvailableDate(developer);
  if (!availableDate) return 0;

  const nowDate = new Date(now);
  const startOfToday = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate()
  ).getTime();
  const startOfAvailableDay = new Date(
    availableDate.getFullYear(),
    availableDate.getMonth(),
    availableDate.getDate()
  ).getTime();

  const diffMs = startOfToday - startOfAvailableDay;
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

/**
 * Formats an ISO date string into a user-friendly format (e.g. "Oct 20, 2026").
 */
export function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return "Not specified";
  const d = parseCalendarDate(dateStr);
  if (!d) return dateStr;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function formatLocalDateOnly(offsetDays: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Sample project assignments modeling all 4 availability scenarios:
 * 1. Alex Rivera (dev-1): Assignment ended in the past (48 days ago) -> Available
 * 2. Priya Sharma (dev-2): Assignment ended in the past (18 days ago) -> Available
 * 3. Marcus Vance (dev-3): No project assignments -> Available
 * 4. Elena Rostova (dev-4): Assignment with no end date -> Unavailable
 * 5. Jordan Lee (dev-5): Assignment with future end date (+30 days) -> Unavailable
 * 6. Sofia Mendez (dev-6): Assignment ended today -> Available (0 idle days)
 */
export const SAMPLE_PROJECT_ASSIGNMENTS: ProjectAssignment[] = [
  {
    id: "assign-1",
    developer_id: "dev-1",
    project_name: "Keelworks Bridge",
    end_date: formatLocalDateOnly(-48),
  },
  {
    id: "assign-2",
    developer_id: "dev-2",
    project_name: "AI Knowledge Assistant",
    end_date: formatLocalDateOnly(-18),
  },
  // dev-3 has no assignments (No project assignments -> Available)
  {
    id: "assign-4",
    developer_id: "dev-4",
    project_name: "Keelworks Portal",
    end_date: null, // No end date -> Unavailable
  },
  {
    id: "assign-5",
    developer_id: "dev-5",
    project_name: "Cloud Infrastructure",
    end_date: formatLocalDateOnly(30), // Future end date -> Unavailable
  },
  {
    id: "assign-6",
    developer_id: "dev-6",
    project_name: "Mobile Onboarding",
    end_date: formatLocalDateOnly(0), // Ended today -> Available (0 idle days)
  },
];

/**
 * Sample developer fixtures used for local development and preview environments.
 * Status and project allocation are derived directly from project assignments.
 */
export const SAMPLE_DEVELOPERS: Developer[] = [
  {
    id: "dev-1",
    full_name: "Alex Rivera",
    email: "alex.rivera@keelworks.org",
    skills: ["React", "TypeScript", "Next.js", "Node.js"],
    status: deriveDeveloperAvailability(
      SAMPLE_PROJECT_ASSIGNMENTS.filter((a) => a.developer_id === "dev-1")
    ),
    project_name: null,
    joined_at: formatLocalDateOnly(-120),
    available_from: formatLocalDateOnly(-48),
    location: "Seattle, WA",
    availability_hours: 40,
  },
  {
    id: "dev-2",
    full_name: "Priya Sharma",
    email: "priya.sharma@keelworks.org",
    skills: ["Python", "FastAPI", "PostgreSQL", "AI/ML"],
    status: deriveDeveloperAvailability(
      SAMPLE_PROJECT_ASSIGNMENTS.filter((a) => a.developer_id === "dev-2")
    ),
    project_name: null,
    joined_at: formatLocalDateOnly(-90),
    available_from: formatLocalDateOnly(-18),
    location: "Austin, TX",
    availability_hours: 35,
  },
  {
    id: "dev-3",
    full_name: "Marcus Vance",
    email: "marcus.vance@keelworks.org",
    skills: ["UI/UX", "TailwindCSS", "Figma", "Frontend"],
    status: deriveDeveloperAvailability(
      SAMPLE_PROJECT_ASSIGNMENTS.filter((a) => a.developer_id === "dev-3")
    ), // No assignments -> "available"
    project_name: null,
    joined_at: formatLocalDateOnly(-14),
    available_from: formatLocalDateOnly(-14),
    location: "Remote",
    availability_hours: 20,
  },
  {
    id: "dev-4",
    full_name: "Elena Rostova",
    email: "elena.rostova@keelworks.org",
    skills: ["React", "GraphQL", "Docker"],
    status: deriveDeveloperAvailability(
      SAMPLE_PROJECT_ASSIGNMENTS.filter((a) => a.developer_id === "dev-4")
    ), // No end date -> "unavailable"
    project_name: "Keelworks Portal",
    joined_at: formatLocalDateOnly(-65),
    available_from: null,
    location: "Boston, MA",
    availability_hours: 40,
  },
  {
    id: "dev-5",
    full_name: "Jordan Lee",
    email: "jordan.lee@keelworks.org",
    skills: ["DevOps", "Kubernetes", "AWS", "CI/CD"],
    status: deriveDeveloperAvailability(
      SAMPLE_PROJECT_ASSIGNMENTS.filter((a) => a.developer_id === "dev-5")
    ), // Future end date (+30 days) -> "unavailable"
    project_name: "Cloud Infrastructure",
    joined_at: formatLocalDateOnly(-90),
    available_from: null,
    location: "Chicago, IL",
    availability_hours: 0,
  },
  {
    id: "dev-6",
    full_name: "Sofia Mendez",
    email: "Sofia.mendez@keelworks.org".toLowerCase(),
    skills: ["Node.js", "Express", "MongoDB", "REST APIs"],
    status: deriveDeveloperAvailability(
      SAMPLE_PROJECT_ASSIGNMENTS.filter((a) => a.developer_id === "dev-6")
    ), // Ended today -> "available" (0 idle days)
    project_name: null,
    joined_at: formatLocalDateOnly(-150),
    available_from: formatLocalDateOnly(0),
    location: "San Francisco, CA",
    availability_hours: 30,
  },
];
