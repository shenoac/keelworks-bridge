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
};

function formatSkills(skills: Developer["skills"]) {
  return Array.isArray(skills) ? skills.join(", ") : skills || "Not provided";
}

export default function DevelopersPage() {
  const router = useRouter();

  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [search, setSearch] = useState("");
  const [skillSearch, setSkillSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [selectedDeveloper, setSelectedDeveloper] = useState<Developer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

      const { data, error } = await supabase
        .from("developer_overview")
        .select("id, full_name, email,skills, status, project_name")
        .order("status")
        .order("full_name");

      if (error) {
        console.error("Failed to load developers:", error);
        setError(error.message);
      } else {
        setDevelopers(data ?? []);
      }

      setLoading(false);
    }

    checkAuthAndLoad();
  }, [router]);

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

      {!error && developers.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No developers found.
        </div>
      )}

      {!error && developers.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[850px] text-left">
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
                  <button
                    type="button"
                    onClick={() => setSelectedDeveloper(developer)}
                    className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 dark:focus:ring-slate-500 dark:focus:ring-offset-slate-900"
                  >
                    View profile
                  </button>
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

      {selectedDeveloper && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={() => setSelectedDeveloper(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="developer-profile-title"
            className="w-full max-w-lg rounded-xl bg-white p-6 text-slate-950 shadow-xl dark:bg-slate-900 dark:text-white"
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
          </section>
        </div>
      )}
    </main>
  );
}