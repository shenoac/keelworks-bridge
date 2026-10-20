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
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
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
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
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

  const diffMs = now - availableDate.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

/**
 * Formats an ISO date string into a user-friendly format (e.g. "Oct 20, 2026").
 */
export function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return "Not specified";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/**
 * Sample developer fixtures used for local development and preview environments.
 */
export const SAMPLE_DEVELOPERS: Developer[] = [
  {
    id: "dev-1",
    full_name: "Alex Rivera",
    email: "alex.rivera@keelworks.org",
    skills: ["React", "TypeScript", "Next.js", "Node.js"],
    status: "available",
    project_name: null,
    joined_at: new Date(Date.now() - 120 * 86400000).toISOString(),
    available_from: new Date(Date.now() - 48 * 86400000).toISOString(), // Returned from prior project 48 days ago
    location: "Seattle, WA",
    availability_hours: 40,
  },
  {
    id: "dev-2",
    full_name: "Priya Sharma",
    email: "priya.sharma@keelworks.org",
    skills: ["Python", "FastAPI", "PostgreSQL", "AI/ML"],
    status: "available",
    project_name: null,
    joined_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    available_from: new Date(Date.now() - 18 * 86400000).toISOString(), // Returned from project 18 days ago
    location: "Austin, TX",
    availability_hours: 35,
  },
  {
    id: "dev-3",
    full_name: "Marcus Vance",
    email: "marcus.vance@keelworks.org",
    skills: ["UI/UX", "TailwindCSS", "Figma", "Frontend"],
    status: "available",
    project_name: null,
    joined_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    available_from: new Date(Date.now() - 14 * 86400000).toISOString(), // New joiner waiting for first project
    location: "Remote",
    availability_hours: 20,
  },
  {
    id: "dev-4",
    full_name: "Elena Rostova",
    email: "elena.rostova@keelworks.org",
    skills: ["React", "GraphQL", "Docker"],
    status: "available",
    project_name: "Keelworks Portal",
    joined_at: new Date(Date.now() - 65 * 86400000).toISOString(),
    available_from: null, // Currently assigned
    location: "Boston, MA",
    availability_hours: 40,
  },
  {
    id: "dev-5",
    full_name: "Jordan Lee",
    email: "jordan.lee@keelworks.org",
    skills: ["DevOps", "Kubernetes", "AWS", "CI/CD"],
    status: "unavailable",
    project_name: null,
    joined_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    available_from: null, // Unavailable
    location: "Chicago, IL",
    availability_hours: 0,
  },
  {
    id: "dev-6",
    full_name: "Sofia Mendez",
    email: "sofia.mendez@keelworks.org",
    skills: ["Node.js", "Express", "MongoDB", "REST APIs"],
    status: "available",
    project_name: null,
    joined_at: new Date(Date.now() - 150 * 86400000).toISOString(),
    available_from: new Date().toISOString(), // Returned today -> starts at 0 idle days!
    location: "San Francisco, CA",
    availability_hours: 30,
  },
];
