"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  type Developer as SharedDeveloper,
  type EnrichedDeveloper,
  SAMPLE_DEVELOPERS,
  isDevOrPreviewEnvironment,
  formatSkills,
  formatDisplayDate,
  getDeveloperJoinedDate,
  getDeveloperAvailableDate,
  calculateIdleDays,
  isAvailableForAllocation,
  deriveDeveloperAvailability,
  isAssignmentActive,
  deriveLatestEndedDate,
} from "@/lib/developers";

type Developer = SharedDeveloper & { comments?: string | null };
type EnrichedDeveloperWithComments = EnrichedDeveloper & Pick<Developer, "comments">;

type CommentEntry = {
  id: string | number;
  developer_id: string | null;
  developer_name: string;
  author: string;
  comment: string;
  created_at: string;
};

function formatCommentTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function DevelopersPage() {
  const router = useRouter();

  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [search, setSearch] = useState("");
  const [skillSearch, setSkillSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [allNotesDeveloperId, setAllNotesDeveloperId] = useState<string | null>(null);
  const [allocationOnly, setAllocationOnly] = useState(false);
  const [sortBy, setSortBy] = useState("priority");
  const [selectedDeveloper, setSelectedDeveloper] = useState<EnrichedDeveloperWithComments | null>(null);
  const [editingGithubUrl, setEditingGithubUrl] = useState("");
  const [savingGithubUrl, setSavingGithubUrl] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [commentsLoadError, setCommentsLoadError] = useState<string | null>(null);
  const [commentHistory, setCommentHistory] = useState<Record<string, CommentEntry[]>>({});
  const [archivedComments, setArchivedComments] = useState<CommentEntry[]>([]);
  const [commentStatus, setCommentStatus] = useState<{ developerId: string; message: string; isError: boolean } | null>(null);
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);
  const [newDeveloper, setNewDeveloper] = useState({
    full_name: "",
    email: "",
    github_url: "",
    skills: "",
    location: "",
    availability_hours: "0",
    joined_at: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    async function loadData() {
      const isDevOrPreview = isDevOrPreviewEnvironment();

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        // Strictly preserve authentication requirements in production
        if (!isDevOrPreview) {
          if (!user) {
            router.push("/login?redirect=/developers");
            return;
          }

          if (!user.email?.endsWith("@keelworks.org")) {
            await supabase.auth.signOut();
            router.push("/login");
            return;
          }
        }

        // Authenticated user admin privileges verification (both production and dev)
        if (user && user.email?.endsWith("@keelworks.org")) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            const adminResponse = await fetch("/api/developers", {
              headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
            }).catch(() => null);
            if (adminResponse?.ok) {
              const adminData = await adminResponse.json();
              setIsAdmin(adminData.isAdmin === true);
              setCanDelete(adminData.canDelete === true);
              if (adminData.isAdmin === true) {
                const commentsResponse = await fetch("/api/developers?includeComments=true", {
                  headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
                }).catch(() => null);
                const commentsData = commentsResponse ? await commentsResponse.json() : null;
                if (!commentsResponse?.ok || commentsData?.commentsError) {
                  setCommentsLoadError(commentsData?.commentsError ?? "Unable to load comment history.");
                } else {
                  setCommentHistory((commentsData?.comments ?? {}) as Record<string, CommentEntry[]>);
                  setArchivedComments(commentsData?.archivedComments ?? []);
                }
              }
            }
          }
        }

        // Query data if authenticated or in dev/preview
        if (user || isDevOrPreview) {
          // Helper to enrich developer records with assignment-derived availability
          const enrichWithAssignments = async (
            baseDevelopers: Developer[],
          ): Promise<Developer[]> => {
            const devMap = new Map<
              string,
              {
                id: string;
                location?: string | null;
                availability_hours?: number | null;
                created_at?: string | null;
                joined_at?: string | null;
                github_url?: string | null;
              }
            >();

            const devTableQuery = await supabase
            .from("developers")
            .select("id, github_url, location, availability_hours, created_at");

          (devTableQuery.data || []).forEach((d) => devMap.set(d.id, d));

            const assignQuery = await supabase
              .from("project_assignments")
              .select("developer_id, project_id, end_date, created_at, projects(name)");

            // If project_assignments cannot be queried directly, rely on developer_overview fields
            if (assignQuery.error || !assignQuery.data) {
              return baseDevelopers.map((ov) => {
                const tableDev = devMap.get(ov.id);
                return {
                  ...ov,
                  github_url: tableDev?.github_url ?? null,
                  location: ov.location ?? tableDev?.location ?? null,
                  availability_hours: ov.availability_hours ?? tableDev?.availability_hours ?? 0,
                  created_at: ov.created_at ?? tableDev?.created_at ?? null,
                  joined_at: ov.joined_at ?? tableDev?.created_at ?? null,
                  available_from: ov.available_from ?? ov.joined_at ?? tableDev?.created_at ?? null,
                };
              });
            }

            type RawAssignmentRow = {
              developer_id: string;
              end_date?: string | null;
              projects?: { name?: string | null } | Array<{ name?: string | null }> | null;
            };

            const devAssignmentsMap = new Map<
              string,
              Array<{ end_date?: string | null; project_name?: string | null }>
            >();
            (assignQuery.data as RawAssignmentRow[]).forEach((a) => {
              if (!devAssignmentsMap.has(a.developer_id)) {
                devAssignmentsMap.set(a.developer_id, []);
              }
              const projectName = Array.isArray(a.projects)
                ? (a.projects[0]?.name ?? null)
                : (a.projects?.name ?? null);
              devAssignmentsMap.get(a.developer_id)!.push({
                end_date: a.end_date,
                project_name: projectName,
              });
            });

            return baseDevelopers.map((ov) => {
              const tableDev = devMap.get(ov.id);
              const assignments = devAssignmentsMap.get(ov.id) || [];
              const derivedStatus = deriveDeveloperAvailability(assignments);
              const activeAssignment = assignments.find((a) => isAssignmentActive(a));
              const activeProjectName =
                derivedStatus === "unavailable"
                  ? (activeAssignment?.project_name ?? ov.project_name ?? null)
                  : null;
              const fallbackJoinDate = ov.joined_at ?? ov.created_at ?? tableDev?.created_at ?? null;
              const latestEndDate = deriveLatestEndedDate(assignments, fallbackJoinDate);

              return {
                ...ov,
                github_url: tableDev?.github_url ?? null,
                status: derivedStatus,
                project_name: activeProjectName,
                location: ov.location ?? tableDev?.location ?? null,
                availability_hours: ov.availability_hours ?? tableDev?.availability_hours ?? 0,
                created_at: ov.created_at ?? tableDev?.created_at ?? null,
                joined_at: fallbackJoinDate,
                available_from:
                  derivedStatus === "available"
                    ? (latestEndDate ? latestEndDate.toISOString() : (ov.available_from ?? fallbackJoinDate))
                    : null,
              };
            });
          };

          // Attempt query on updated developer_overview view (when migration is applied)
          const fullQuery = await supabase
            .from("developer_overview")
            .select("id, full_name, email, skills, status, project_name, joined_at, created_at, location, availability_hours, available_from")
            .order("status")
            .order("full_name");

          if (!fullQuery.error && fullQuery.data && fullQuery.data.length > 0) {
            const enriched = await enrichWithAssignments(fullQuery.data as Developer[]);
            setDevelopers(enriched);
            setLoading(false);
            return;
          }

          // Fallback to existing database schema:
          // Queries basic developer_overview and enriches with developers table and project_assignments
          const basicQuery = await supabase
            .from("developer_overview")
            .select("id, full_name, email, skills, status, project_name")
            .order("full_name");

          if (!basicQuery.error && basicQuery.data) {
            const mergedDevelopers = await enrichWithAssignments(
              basicQuery.data as Developer[],
            );
            setDevelopers(mergedDevelopers);
            setLoading(false);
            return;
          }

          if (!isDevOrPreview && basicQuery.error) {
            setError(basicQuery.error.message);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Supabase query error:", err);
        if (!isDevOrPreview) {
          setError(err instanceof Error ? err.message : "Failed to load developers");
          setLoading(false);
          return;
        }
      }

      // In production, never fall back to demo mode or mock admin permissions
      if (!isDevOrPreview) {
        setDevelopers([]);
        setLoading(false);
        return;
      }

      // In development or preview environments ONLY, use interactive sample data when no database data loaded.
      setIsDemoMode(true);
      setIsAdmin(true);
      setCanDelete(true);
      setDevelopers(SAMPLE_DEVELOPERS);
      setLoading(false);
    }

    loadData();
  }, [router]);

  function openDeveloperProfile(developer: EnrichedDeveloperWithComments) {
  setEditingGithubUrl(developer.github_url ?? "");
  setSelectedDeveloper(developer);
}

  async function saveGithubUrl() {
    if (!selectedDeveloper || !isAdmin || savingGithubUrl) return;

    setSavingGithubUrl(true);

    try {
      if (isDemoMode) {
        const githubUrl = editingGithubUrl.trim() || null;
        setDevelopers((current) =>
          current.map((dev) =>
            dev.id === selectedDeveloper.id
              ? { ...dev, github_url: githubUrl }
              : dev
          )
        );
        setSelectedDeveloper((current) =>
          current ? { ...current, github_url: githubUrl } : current
        );
        return;
        }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        alert("Your session has expired.");
        return;
      }

      const response = await fetch("/api/developers", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedDeveloper.id,
          github_url: editingGithubUrl.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error ?? "Unable to save GitHub URL.");
        return;
      }

      setDevelopers((current) =>
        current.map((dev) =>
          dev.id === result.id
            ? { ...dev, github_url: result.github_url }
            : dev
        )
      );

      setSelectedDeveloper((current) => {
        if (!current || current.id !== result.id) {
          return current;
        }

        return { ...current, github_url: result.github_url };
      });

    } catch {
      alert("Network error saving GitHub URL.");
    } finally {
      setSavingGithubUrl(false);
    }
  }

  async function addDeveloper(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    const created: Developer = {
      id: `dev-${Date.now()}`,
      full_name: newDeveloper.full_name,
      email: newDeveloper.email,
      github_url: newDeveloper.github_url.trim() || null,
      skills: newDeveloper.skills.split(",").map((s) => s.trim()).filter(Boolean),
      location: newDeveloper.location || null,
      availability_hours: Number(newDeveloper.availability_hours) || 0,
      status: "available", // Derived from assignments: new developers have no assignments -> Available
      project_name: null,
      joined_at: newDeveloper.joined_at,
      available_from: newDeveloper.joined_at,
    };

    if (isDemoMode) {
      setDevelopers((prev) => [created, ...prev]);
      setNewDeveloper({
        full_name: "",
        email: "",
        github_url: "",
        skills: "",
        location: "",
        availability_hours: "0",
        joined_at: new Date().toISOString().split("T")[0],
      });
      setSaving(false);
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = sessionData.session
        ? await fetch("/api/developers", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...newDeveloper,
              skills: newDeveloper.skills.split(","),
            }),
          })
        : null;
      const result = response ? await response.json() : { error: "Your session has expired" };

      if (!response?.ok) {
        setFormError(result.error ?? "Unable to add developer");
      } else {
        setDevelopers((prev) => [{ ...created, id: result.id }, ...prev]);
        setNewDeveloper({
          full_name: "",
          email: "",
          github_url: "",
          skills: "",
          location: "",
          availability_hours: "0",
          joined_at: new Date().toISOString().split("T")[0],
        });
      }
    } catch {
      setFormError("Failed to save developer to server");
    }

    setSaving(false);
  }

  async function saveComments(developer: Developer) {
    const comments = developer.comments?.trim() ?? "";
    if (!comments) {
      setCommentStatus({ developerId: developer.id, message: "Comments cannot be empty.", isError: true });
      return;
    }

    setSavingCommentId(developer.id);
    setCommentStatus(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = sessionData.session
        ? await fetch("/api/developers", {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ id: developer.id, comments }),
          })
        : null;
      const result: CommentEntry | { error?: string } = response
        ? await response.json()
        : { error: "Your session has expired" };

      if (!response?.ok) {
        setCommentStatus({
          developerId: developer.id,
          message: "error" in result ? result.error ?? "Unable to save comments." : "Unable to save comments.",
          isError: true,
        });
      } else {
        const savedComment = result as CommentEntry;
        setCommentHistory((current) => ({
          ...current,
          [developer.id]: [...(current[developer.id] ?? []), savedComment],
        }));
        setDevelopers((current) => current.map((item) => item.id === developer.id ? { ...item, comments: "" } : item));
        setSelectedDeveloper((current) =>
          current?.id === developer.id ? { ...current, comments: "" } : current
        );
        setCommentStatus({ developerId: developer.id, message: "Saved.", isError: false });
      }
    } catch (saveError) {
      console.error("Failed to save developer comment:", saveError);
      setCommentStatus({ developerId: developer.id, message: "Network error saving comments.", isError: true });
    }
    setSavingCommentId(null);
  }

  async function deleteDeveloper(developer: Developer) {
    if (!window.confirm(`Delete ${developer.full_name ?? "this developer"}?`)) return;

    if (isDemoMode) {
      setDevelopers((current) => current.filter((item) => item.id !== developer.id));
      if (selectedDeveloper?.id === developer.id) setSelectedDeveloper(null);
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setError("Your session has expired");
        return;
      }

      const response = await fetch("/api/developers", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: developer.id }),
      });
      if (!response.ok) {
        const result = await response.json();
        setError(result.error ?? "Unable to delete developer");
        return;
      }

      setArchivedComments((current) => [
        ...current,
        ...(commentHistory[developer.id] ?? []).map((entry) => ({
          ...entry,
          developer_id: null,
          developer_name: developer.full_name ?? "Unknown developer",
        })),
      ]);
      setDevelopers((current) => current.filter((item) => item.id !== developer.id));
      if (selectedDeveloper?.id === developer.id) setSelectedDeveloper(null);
    } catch {
      setError("Network error deleting developer");
    }
  }

  // Calculate Idle Days & Allocation Priority Ranking across all available resources
  const enrichedDevelopers = useMemo<EnrichedDeveloper[]>(() => {
    // 1. Enrich with basic computed fields
    const enriched = developers.map((dev) => {
      const joinedDate = getDeveloperJoinedDate(dev);
      const availableDate = getDeveloperAvailableDate(dev);
      const isAvailable = isAvailableForAllocation(dev);
      const idleDays = calculateIdleDays(dev);

      return {
        ...dev,
        joinedDate,
        availableDate,
        idleDays,
        isAvailableForAllocation: isAvailable,
      };
    });

    // 2. Identify available developers and rank them by idle days descending (FIFO allocation queue)
    const availablePool = enriched
      .filter((d) => d.isAvailableForAllocation)
      .sort((a, b) => (b.idleDays ?? 0) - (a.idleDays ?? 0));

    const priorityMap = new Map<string, number>();
    availablePool.forEach((dev, index) => {
      priorityMap.set(dev.id, index + 1);
    });

    return enriched.map((dev) => ({
      ...dev,
      allocationPriority: priorityMap.get(dev.id),
    }));
  }, [developers]);

  // Recommended allocation queue (top candidates ready to allocate first based on idle days)
  const allocationRecommendations = useMemo(() => {
    return enrichedDevelopers
      .filter((d) => d.isAvailableForAllocation && d.allocationPriority !== undefined)
      .sort((a, b) => (a.allocationPriority ?? 0) - (b.allocationPriority ?? 0))
      .slice(0, 3);
  }, [enrichedDevelopers]);

  const statusOptions = useMemo(
    () => [
      "all",
      ...Array.from(
        new Set(developers.map((developer) => developer.status).filter(Boolean))
      ).sort(),
    ],
    [developers]
  );

  const projectOptions = useMemo(
    () => [
      "all",
      ...Array.from(
        new Set(
          developers
            .map((developer) => developer.project_name)
            .filter((project): project is string => Boolean(project))
        )
      ).sort(),
    ],
    [developers]
  );

  const filteredAndSortedDevelopers = useMemo(() => {
    const searchTerms = search
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    const filtered = enrichedDevelopers.filter((developer) => {
      const searchableText = [
        developer.full_name,
        developer.email,
        developer.skills,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const searchableSkills = Array.isArray(developer.skills)
        ? developer.skills.join(" ").toLowerCase()
        : developer.skills?.toLowerCase() ?? "";
      const skillTerms = skillSearch
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

      const matchesSearch = searchTerms.every((term) => searchableText.includes(term));
      const matchesSkills = skillTerms.every((term) => searchableSkills.includes(term));
      const matchesStatus = statusFilter === "all" || developer.status === statusFilter;
      const matchesProject = projectFilter === "all" || developer.project_name === projectFilter;
      const matchesAllocation = !allocationOnly || developer.isAvailableForAllocation;

      return matchesSearch && matchesSkills && matchesStatus && matchesProject && matchesAllocation;
    });

    // Apply Sorting
    return [...filtered].sort((a, b) => {
      if (sortBy === "priority") {
        if (a.allocationPriority && b.allocationPriority) {
          return a.allocationPriority - b.allocationPriority;
        }
        if (a.allocationPriority) return -1;
        if (b.allocationPriority) return 1;
        return (a.full_name ?? "").localeCompare(b.full_name ?? "");
      }
      if (sortBy === "idleDaysDesc") {
        return (b.idleDays ?? -1) - (a.idleDays ?? -1);
      }
      if (sortBy === "idleDaysAsc") {
        return (a.idleDays ?? 999999) - (b.idleDays ?? 999999);
      }
      if (sortBy === "availableNewest") {
        const timeA = a.availableDate ? a.availableDate.getTime() : -Infinity;
        const timeB = b.availableDate ? b.availableDate.getTime() : -Infinity;
        return timeB - timeA;
      }
      if (sortBy === "availableOldest") {
        const timeA = a.availableDate ? a.availableDate.getTime() : Infinity;
        const timeB = b.availableDate ? b.availableDate.getTime() : Infinity;
        return timeA - timeB;
      }
      if (sortBy === "joinedOldest") {
        const timeA = a.joinedDate ? a.joinedDate.getTime() : Infinity;
        const timeB = b.joinedDate ? b.joinedDate.getTime() : Infinity;
        return timeA - timeB;
      }
      if (sortBy === "joinedNewest") {
        const timeA = a.joinedDate ? a.joinedDate.getTime() : -Infinity;
        const timeB = b.joinedDate ? b.joinedDate.getTime() : -Infinity;
        return timeB - timeA;
      }
      if (sortBy === "name") {
        return (a.full_name ?? "").localeCompare(b.full_name ?? "");
      }
      if (sortBy === "status") {
        return (a.status ?? "").localeCompare(b.status ?? "");
      }
      return 0;
    });
  }, [enrichedDevelopers, search, skillSearch, statusFilter, projectFilter, allocationOnly, sortBy]);

  const hasActiveFilters =
    Boolean(search.trim() || skillSearch.trim()) ||
    statusFilter !== "all" ||
    projectFilter !== "all" ||
    allocationOnly ||
    sortBy !== "priority";

  function clearFilters() {
    setSearch("");
    setSkillSearch("");
    setStatusFilter("all");
    setProjectFilter("all");
    setAllocationOnly(false);
    setSortBy("priority");
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl p-6 text-slate-950 dark:text-slate-100 sm:p-8">
        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent"></div>
          <span>Loading developer directory & resource statistics...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6 text-slate-950 dark:text-slate-100 sm:p-8">
      {/* Development Preview Mode Banner */}
      {isDemoMode && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-900 shadow-sm dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">ℹ</span>
            <span>
              <strong>Development Preview Mode:</strong> Showing sample developers. Demo mode is restricted to preview/development environments; production strictly requires authentication.
            </span>
          </div>
          <span className="hidden text-xs text-sky-700 dark:text-sky-400 sm:inline">
            Connect Supabase in <code className="rounded bg-sky-100 px-1 py-0.5 dark:bg-sky-900">.env.local</code> for live data
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Directory & Resource Allocation</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Developer Directory</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Track resource availability, idle days on bench, and allocate available developers to projects by priority.
          </p>
        </div>
      </div>

      {/* Recommended Resource Allocation Queue Widget */}
      {allocationRecommendations.length > 0 && (
        <section className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50/80 via-white to-teal-50/50 p-5 shadow-sm dark:border-emerald-900/60 dark:bg-gradient-to-r dark:from-emerald-950/30 dark:via-slate-900 dark:to-teal-950/20">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-3 dark:border-emerald-900/40">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow-sm">
                ★
              </span>
              <h2 className="text-base font-semibold text-emerald-950 dark:text-emerald-200">
                Recommended for Project Allocation (Longest Idle on Bench)
              </h2>
            </div>
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Sorted by Idle Days (FIFO Resource Queue)
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allocationRecommendations.map((dev) => (
              <div
                key={dev.id}
                className="flex flex-col justify-between rounded-lg border border-emerald-200/80 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-emerald-900/50 dark:bg-slate-800/90"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                      Priority #{dev.allocationPriority}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/80 dark:text-amber-300">
                      ⏱ {dev.idleDays} {dev.idleDays === 1 ? "idle day" : "idle days"}
                    </span>
                  </div>

                  <h3 className="mt-2 text-base font-semibold text-slate-950 dark:text-white">
                    {dev.full_name ?? "Unknown Developer"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Available since: {formatDisplayDate(dev.available_from || dev.joined_at || dev.created_at)}
                  </p>

                  <div className="mt-3">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Skills:</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-700 dark:text-slate-300">
                      {formatSkills(dev.skills)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Ready to assign
                  </span>
                  <button
                    type="button"
                    onClick={() => openDeveloperProfile(dev)}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-950 hover:underline dark:text-slate-300 dark:hover:text-white"
                  >
                    View profile →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Admin Add Developer Form */}
      {isAdmin && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="add-developer-title">
          <h2 id="add-developer-title" className="text-lg font-semibold text-slate-950 dark:text-white">Add developer</h2>
          <form className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3" onSubmit={addDeveloper}>
            <input required value={newDeveloper.full_name} onChange={(event) => setNewDeveloper({ ...newDeveloper, full_name: event.target.value })} placeholder="Full name" aria-label="Full name" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            <input required type="email" value={newDeveloper.email} onChange={(event) => setNewDeveloper({ ...newDeveloper, email: event.target.value })} placeholder="Email" aria-label="Email" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            <input
              type="url"
              value={newDeveloper.github_url}
              onChange={(event) =>
                setNewDeveloper({ ...newDeveloper, github_url: event.target.value })
              }
              placeholder="GitHub profile URL (optional)"
              aria-label="GitHub profile URL"
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
            <input value={newDeveloper.skills} onChange={(event) => setNewDeveloper({ ...newDeveloper, skills: event.target.value })} placeholder="Skills, comma separated" aria-label="Skills" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            <input value={newDeveloper.location} onChange={(event) => setNewDeveloper({ ...newDeveloper, location: event.target.value })} placeholder="Location" aria-label="Location" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            <input type="number" min="0" value={newDeveloper.availability_hours} onChange={(event) => setNewDeveloper({ ...newDeveloper, availability_hours: event.target.value })} placeholder="Availability hours" aria-label="Availability hours" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Joining Date</label>
              <input type="date" value={newDeveloper.joined_at} onChange={(event) => setNewDeveloper({ ...newDeveloper, joined_at: event.target.value })} aria-label="Joining Date" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            </div>
            <div className="flex flex-col justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              <span className="font-semibold text-slate-800 dark:text-slate-100">Status: Available</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Derived from assignments (0 project assignments)</span>
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex items-center gap-4">
              <button type="submit" disabled={saving} className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-slate-950">{saving ? "Adding..." : "Add developer"}</button>
              {formError && <p className="text-sm text-red-700 dark:text-red-300" role="alert">{formError}</p>}
            </div>
          </form>
        </section>
      )}

      {/* Filters and Sorting Toolbar */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-label="Developer filters and sorting">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 md:items-end">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Search
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or email"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-700"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Skills
            <input
              type="search"
              value={skillSearch}
              onChange={(event) => setSkillSearch(event.target.value)}
              placeholder="e.g. React, Python"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-700"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-700"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "All statuses" : status}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Project
            <select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-700"
            >
              {projectOptions.map((project) => (
                <option key={project} value={project}>
                  {project === "all" ? "All projects" : project}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Sort by
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-700"
            >
              <option value="priority">Allocation Priority (Idle Days ↓)</option>
              <option value="idleDaysDesc">Idle Days (High to Low)</option>
              <option value="idleDaysAsc">Idle Days (Low to High)</option>
              <option value="availableNewest">Most Recently Available</option>
              <option value="availableOldest">Longest Available</option>
              <option value="joinedNewest">Joined Date (Newest First)</option>
              <option value="joinedOldest">Joined Date (Oldest First)</option>
              <option value="name">Developer Name (A-Z)</option>
              <option value="status">Status</option>
            </select>
          </label>
        </div>

        {/* Quick filter & status count */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-3 dark:border-slate-800">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={allocationOnly}
              onChange={(e) => setAllocationOnly(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Show Only Available for Allocation (Unassigned)</span>
          </label>

          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
              Showing {filteredAndSortedDevelopers.length} of {developers.length} developers
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-500 hover:text-slate-950 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-400 dark:hover:text-white"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200" role="alert">
          Unable to load developers: {error}
        </div>
      )}

      {isAdmin && commentsLoadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200" role="alert">
          Unable to load comment history: {commentsLoadError}
        </div>
      )}

      {!error && developers.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No developers found.
        </div>
      )}

      {!error && developers.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              <tr>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Developer</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Skills</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Project</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Became Available</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Idle Days</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Allocation Priority</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredAndSortedDevelopers.map((developer) => (
                <tr key={developer.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/60">
                  <td className="px-5 py-4">
                    <div className="font-medium text-slate-950 dark:text-white">{developer.full_name ?? "Unknown developer"}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{developer.email ?? "No email"}</div>
                  </td>
                  <td className="max-w-xs px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{formatSkills(developer.skills)}</td>
                  <td className="px-5 py-4 text-sm">
                    {developer.project_name ? (
                      <span className="font-medium text-slate-900 dark:text-slate-100">{developer.project_name}</span>
                    ) : (
                      <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm whitespace-nowrap">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {developer.isAvailableForAllocation
                        ? formatDisplayDate(developer.available_from || developer.joined_at || developer.created_at)
                        : "Currently unavailable"}
                    </div>
                    {(developer.joined_at || developer.created_at) && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Joined {formatDisplayDate(developer.joined_at || developer.created_at)}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    {developer.idleDays !== null ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                        ⏱ {developer.idleDays} {developer.idleDays === 1 ? "idle day" : "idle days"}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {developer.project_name ? "Assigned" : "Unavailable"}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    {developer.allocationPriority ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        Priority #{developer.allocationPriority}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {developer.status ?? "Inactive"}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openDeveloperProfile(developer)}
                        className="rounded-lg border border-slate-300 px-3 py-2 font-medium text-slate-700 transition hover:border-slate-500 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-400 dark:hover:text-white dark:focus:ring-slate-500 dark:focus:ring-offset-slate-900"
                      >
                        View profile
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => deleteDeveloper(developer)}
                          className="rounded-lg border border-red-300 px-3 py-2 font-medium text-red-700 transition hover:border-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2 dark:border-red-800 dark:text-red-300 dark:hover:border-red-600 dark:hover:bg-red-950/40 dark:focus:ring-red-700 dark:focus:ring-offset-slate-900"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredAndSortedDevelopers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                    No developers match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin && archivedComments.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="archived-comments-title">
          <h2 id="archived-comments-title" className="text-lg font-semibold text-slate-950 dark:text-white">Notes for removed developer records</h2>
          <ol className="mt-4 space-y-4">
            {archivedComments.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <p className="font-medium text-slate-900 dark:text-white">{entry.developer_name}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {entry.author} · {formatCommentTimestamp(entry.created_at)}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">{entry.comment}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Developer Profile Modal */}
      {selectedDeveloper && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={() => setSelectedDeveloper(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="developer-profile-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 text-slate-950 shadow-xl dark:bg-slate-900 dark:text-white"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Developer profile</p>
                <h2 id="developer-profile-title" className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                  {selectedDeveloper.full_name ?? "Unknown developer"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDeveloper(null)}
                aria-label="Close developer profile"
                className="rounded-lg px-2 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Allocation Priority</p>
                <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                  {selectedDeveloper.allocationPriority ? `Priority #${selectedDeveloper.allocationPriority}` : "Not in bench queue"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Idle Days</p>
                <p className="mt-1 text-sm font-bold text-amber-700 dark:text-amber-400">
                  {selectedDeveloper.idleDays !== null ? `${selectedDeveloper.idleDays} idle days` : "Currently Assigned / Unavailable"}
                </p>
              </div>
            </div>

            <dl className="mt-5 grid gap-3.5 text-sm">
              <div><dt className="font-medium text-slate-500 dark:text-slate-400">Email</dt><dd className="mt-0.5 text-slate-950 dark:text-white">{selectedDeveloper.email ?? "Not provided"}</dd></div>
              {selectedDeveloper.github_url && (
                <div>
                  <dt className="font-medium text-slate-500 dark:text-slate-400">
                    GitHub
                  </dt>
                  <dd className="mt-0.5">
                    <a
                      href={selectedDeveloper.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 underline hover:text-blue-900 dark:text-blue-300"
                    >
                      View GitHub profile ↗
                    </a>
                  </dd>
                </div>
              )}
              {isAdmin && (
                <div>
                  <dt className="font-medium text-slate-500 dark:text-slate-400">
                    Edit GitHub URL
                  </dt>
                  <dd className="mt-1">
                    <input
                      type="url"
                      value={editingGithubUrl}
                      onChange={(event) => setEditingGithubUrl(event.target.value)}
                      placeholder="https://github.com/username"
                      aria-label="Edit GitHub URL"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={saveGithubUrl}
                      disabled={
                        savingGithubUrl ||
                        editingGithubUrl.trim() === (selectedDeveloper.github_url ?? "")
                      }
                      className="mt-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-950"
                    >
                      {savingGithubUrl ? "Saving..." : "Save GitHub URL"}
                    </button>
                  </dd>
                </div>
              )}
              <div><dt className="font-medium text-slate-500 dark:text-slate-400">Became Available</dt><dd className="mt-0.5 text-slate-950 dark:text-white">{selectedDeveloper.isAvailableForAllocation ? formatDisplayDate(selectedDeveloper.available_from || selectedDeveloper.joined_at || selectedDeveloper.created_at) : "Currently unavailable"}</dd></div>
              <div><dt className="font-medium text-slate-500 dark:text-slate-400">Original Joining Date</dt><dd className="mt-0.5 text-slate-950 dark:text-white">{formatDisplayDate(selectedDeveloper.joined_at || selectedDeveloper.created_at)}</dd></div>
              <div><dt className="font-medium text-slate-500 dark:text-slate-400">Skills</dt><dd className="mt-0.5 text-slate-950 dark:text-white">{formatSkills(selectedDeveloper.skills)}</dd></div>
              <div><dt className="font-medium text-slate-500 dark:text-slate-400">Project</dt><dd className="mt-0.5 text-slate-950 dark:text-white">{selectedDeveloper.project_name ?? "Unassigned"}</dd></div>
              <div><dt className="font-medium text-slate-500 dark:text-slate-400">Status</dt><dd className="mt-0.5 text-slate-950 dark:text-white">{selectedDeveloper.status ?? "Unknown"}</dd></div>
              {selectedDeveloper.location && <div><dt className="font-medium text-slate-500 dark:text-slate-400">Location</dt><dd className="mt-0.5 text-slate-950 dark:text-white">{selectedDeveloper.location}</dd></div>}
              {selectedDeveloper.availability_hours !== undefined && selectedDeveloper.availability_hours !== null && <div><dt className="font-medium text-slate-500 dark:text-slate-400">Weekly Availability</dt><dd className="mt-0.5 text-slate-950 dark:text-white">{selectedDeveloper.availability_hours} hours/week</dd></div>}
            </dl>
            {isAdmin && (
              <section className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700" aria-labelledby="private-notes-title">
                <h3 id="private-notes-title" className="text-lg font-semibold text-slate-950 dark:text-white">Private administrator notes</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Visible only to administrators. Saved notes cannot be edited or deleted.</p>
                <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Add a note
                  <textarea
                    value={selectedDeveloper.comments ?? ""}
                    onChange={(event) => setSelectedDeveloper({ ...selectedDeveloper, comments: event.target.value })}
                    maxLength={5000}
                    rows={3}
                    placeholder="Record a follow-up, decision, or engagement update..."
                    className="mt-2 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:ring-slate-700"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => saveComments(selectedDeveloper)}
                  disabled={savingCommentId === selectedDeveloper.id || !selectedDeveloper.comments?.trim()}
                  className="mt-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-950"
                >
                  {savingCommentId === selectedDeveloper.id ? "Saving..." : "Save note"}
                </button>
                {commentStatus?.developerId === selectedDeveloper.id && (
                  <p className={`mt-2 text-sm ${commentStatus.isError ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-300"}`} role={commentStatus.isError ? "alert" : "status"}>
                    {commentStatus.message}
                  </p>
                )}
                {(() => {
                  const notes = commentHistory[selectedDeveloper.id] ?? [];
                  const recentNotes = notes.slice(-2).reverse();
                  return (
                    <>
                      <div className="mt-5 flex items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Recent notes ({notes.length})
                        </h4>
                        {notes.length >= 2 && (
                          <button
                            type="button"
                            onClick={() => setAllNotesDeveloperId(selectedDeveloper.id)}
                            className="text-sm font-medium text-blue-700 underline hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
                          >
                            View all notes
                          </button>
                        )}
                      </div>
                      <ol className="mt-3 max-h-72 space-y-4 overflow-y-auto">
                        {notes.length > 0 ? (
                          recentNotes.map((entry) => (
                            <li key={entry.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {entry.author} · <time dateTime={entry.created_at}>{formatCommentTimestamp(entry.created_at)}</time>
                              </p>
                              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-slate-200">{entry.comment}</p>
                            </li>
                          ))
                        ) : (
                          <li className="text-sm text-slate-500 dark:text-slate-400">No private notes recorded yet.</li>
                        )}
                      </ol>
                    </>
                  );
                })()}
              </section>
            )}
          </section>
        </div>
      )}
      {isAdmin && allNotesDeveloperId && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/60 p-4"
          role="presentation"
          onMouseDown={() => setAllNotesDeveloperId(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="all-developer-notes-title"
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 text-slate-950 shadow-2xl dark:bg-slate-900 dark:text-white"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Private history</p>
                <h2 id="all-developer-notes-title" className="mt-1 text-2xl font-semibold">
                  All notes for {selectedDeveloper?.id === allNotesDeveloperId
                    ? selectedDeveloper.full_name ?? "this developer"
                    : commentHistory[allNotesDeveloperId]?.[0]?.developer_name ?? "this developer"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAllNotesDeveloperId(null)}
                aria-label="Close all notes"
                className="rounded-lg px-2 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                x
              </button>
            </div>
            <ol className="mt-6 space-y-4">
              {(commentHistory[allNotesDeveloperId] ?? []).length > 0 ? (
                commentHistory[allNotesDeveloperId].map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {entry.author} · <time dateTime={entry.created_at}>{formatCommentTimestamp(entry.created_at)}</time>
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-slate-200">{entry.comment}</p>
                  </li>
                ))
              ) : (
                <li className="text-sm text-slate-500 dark:text-slate-400">No private notes recorded yet.</li>
              )}
            </ol>
          </section>
        </div>
      )}
    </main>
  );
}