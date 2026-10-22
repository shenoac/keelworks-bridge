"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Developer = {
  id: string;
  full_name: string | null;
  email: string | null;
  skills: string | string[] | null;
  status: string;
  project_name: string | null;
  comments?: string | null;
};

type CommentEntry = {
  id: string | number;
  developer_id: string | null;
  developer_name: string;
  author: string;
  comment: string;
  created_at: string;
};

function formatSkills(skills: Developer["skills"]) {
  return Array.isArray(skills) ? skills.join(", ") : skills || "Not provided";
}

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
  const [selectedDeveloper, setSelectedDeveloper] = useState<Developer | null>(null);
  const [allNotesDeveloperId, setAllNotesDeveloperId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
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
    skills: "",
    location: "",
    availability_hours: "0",
    status: "available",
  });

  useEffect(() => {

    async function checkAuthAndLoad() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login?redirect=/developers");
        return;
      }

      if (!user.email?.endsWith("@keelworks.org")) {
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const adminResponse = sessionData.session
        ? await fetch("/api/developers", {
            headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
          })
        : null;
      let isAdminUser = false;
      if (adminResponse?.ok) {
        const adminData = await adminResponse.json();
        isAdminUser = adminData.isAdmin === true;
        setIsAdmin(adminData.isAdmin === true);
        setCanDelete(adminData.isAdmin === true);
      }
      if (isAdminUser && sessionData.session) {
      const commentsResponse = await fetch("/api/developers?includeComments=true", {
              headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
            }).catch(() => null);
            const commentsData = commentsResponse ? await commentsResponse.json() : null;
            if (!commentsResponse?.ok || commentsData?.commentsError) {
              setCommentsLoadError(commentsData?.commentsError ?? "Unable to load comment history.");
            } else {
              setCommentHistory((commentsData?.comments ?? {}) as Record<string, CommentEntry[]>);
              setArchivedComments(commentsData?.archivedComments ?? []);
            }
      }

      const { data, error } = await supabase
        .from("developer_overview")
        .select("id, full_name, email,skills, status, project_name")
        .order("status")
        .order("full_name");

      if (error) {
        console.error("Failed to load developers:", error);
        setError(error.message);
      } else {
        setDevelopers((data ?? []).map((developer) => ({ ...developer, comments: "" })) as Developer[]);
      }

      setLoading(false);
    }

    checkAuthAndLoad();
  }, [router]);

  async function addDeveloper(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

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
      setNewDeveloper({ full_name: "", email: "", skills: "", location: "", availability_hours: "0", status: "available" });
      window.location.reload();
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
  }

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

  const filteredDevelopers = useMemo(() => {
    const searchTerms = search
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return developers.filter((developer) => {
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

      return matchesSearch && matchesSkills && matchesStatus && matchesProject;
    });
  }, [developers, projectFilter, search, skillSearch, statusFilter]);

  const hasActiveFilters = Boolean(search.trim() || skillSearch.trim()) || statusFilter !== "all" || projectFilter !== "all";

  function clearFilters() {
    setSearch("");
    setSkillSearch("");
    setStatusFilter("all");
    setProjectFilter("all");
  }

  if (loading) {
    return <main className="mx-auto max-w-7xl p-6 text-slate-950 dark:text-slate-100 sm:p-8">Loading developers...</main>;
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6 text-slate-950 dark:text-slate-100 sm:p-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Directory</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Developers</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Find the right specialist for your next project.</p>
      </div>

      {isAdmin && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="add-developer-title">
          <h2 id="add-developer-title" className="text-lg font-semibold text-slate-950 dark:text-white">Add developer</h2>
          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={addDeveloper}>
            <input required value={newDeveloper.full_name} onChange={(event) => setNewDeveloper({ ...newDeveloper, full_name: event.target.value })} placeholder="Full name" aria-label="Full name" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            <input required type="email" value={newDeveloper.email} onChange={(event) => setNewDeveloper({ ...newDeveloper, email: event.target.value })} placeholder="Email" aria-label="Email" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            <input value={newDeveloper.skills} onChange={(event) => setNewDeveloper({ ...newDeveloper, skills: event.target.value })} placeholder="Skills, comma separated" aria-label="Skills" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            <input value={newDeveloper.location} onChange={(event) => setNewDeveloper({ ...newDeveloper, location: event.target.value })} placeholder="Location" aria-label="Location" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            <input type="number" min="0" value={newDeveloper.availability_hours} onChange={(event) => setNewDeveloper({ ...newDeveloper, availability_hours: event.target.value })} placeholder="Availability hours" aria-label="Availability hours" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            <select value={newDeveloper.status} onChange={(event) => setNewDeveloper({ ...newDeveloper, status: event.target.value })} aria-label="Status" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white">
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </select>
            <div className="md:col-span-2 flex items-center gap-4">
              <button type="submit" disabled={saving} className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-slate-950">{saving ? "Adding..." : "Add developer"}</button>
              {formError && <p className="text-sm text-red-700 dark:text-red-300" role="alert">{formError}</p>}
            </div>
          </form>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-label="Developer filters">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_200px_auto] md:items-end">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Search
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, email, or skill"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-700"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Skills
            <input
              type="search"
              value={skillSearch}
              onChange={(event) => setSkillSearch(event.target.value)}
              placeholder="e.g. React, AI, mobile"
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

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-500 hover:text-slate-950 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-400 dark:hover:text-white"
            >
              Clear filters
            </button>
          )}
        </div>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
          Showing {filteredDevelopers.length} of {developers.length} developers
        </p>
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
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <tr>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Developer</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Skills</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Project</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
            </tr>
          </thead>

            <tbody>
            {filteredDevelopers.map((developer) => (
              <tr key={developer.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/60">
                <td className="px-5 py-4 font-medium text-slate-950 dark:text-white">{developer.full_name ?? "Unknown developer"}</td>
                <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{developer.email ?? "Not provided"}</td>
                <td className="max-w-xs px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{formatSkills(developer.skills)}</td>
                <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{developer.project_name ?? "Unassigned"}</td>
                <td className="px-5 py-4">
                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {developer.status ?? "Unknown"}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDeveloper(developer)}
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

            {filteredDevelopers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
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
                x
              </button>
            </div>
            <dl className="mt-6 grid gap-4 text-sm">
              <div><dt className="font-medium text-slate-500 dark:text-slate-400">Email</dt><dd className="mt-1 text-slate-950 dark:text-white">{selectedDeveloper.email ?? "Not provided"}</dd></div>
              <div><dt className="font-medium text-slate-500 dark:text-slate-400">Skills</dt><dd className="mt-1 text-slate-950 dark:text-white">{formatSkills(selectedDeveloper.skills)}</dd></div>
              <div><dt className="font-medium text-slate-500 dark:text-slate-400">Project</dt><dd className="mt-1 text-slate-950 dark:text-white">{selectedDeveloper.project_name ?? "Unassigned"}</dd></div>
              <div><dt className="font-medium text-slate-500 dark:text-slate-400">Status</dt><dd className="mt-1 text-slate-950 dark:text-white">{selectedDeveloper.status ?? "Unknown"}</dd></div>
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