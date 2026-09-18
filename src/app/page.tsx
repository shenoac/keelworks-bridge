"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Project = {
  id: string;
  name: string;
  summary: string | null;
  status: string;
  rag_status: string;
  tech_stack: string[] | null;
  created_at: string;
};

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [form, setForm] = useState({ name: "", summary: "", status: "discovery", rag_status: "green", tech_stack: "" });

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function load() {
    setError(null);
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else setProjects((data ?? []) as Project[]);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      await load();
      const token = await getAccessToken();
      if (token) {
        const response = await fetch("/api/developers", { headers: { Authorization: `Bearer ${token}` } });
        if (response.ok) {
          const adminData = await response.json();
          setIsAdmin(adminData.isAdmin === true);
          setCanDelete(adminData.canDelete === true);
        }
      }
    })();
  }, []);

  async function addProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const token = await getAccessToken();
    const response = token ? await fetch("/api/projects", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, tech_stack: form.tech_stack.split(",") }),
    }) : null;
    const result = response ? await response.json() : { error: "Your session has expired" };
    if (!response?.ok) setError(result.error ?? "Unable to add project");
    else {
      setForm({ name: "", summary: "", status: "discovery", rag_status: "green", tech_stack: "" });
      await load();
    }
    setLoading(false);
  }

  async function deleteProject(project: Project) {
    if (!window.confirm(`Delete ${project.name}?`)) return;
    const token = await getAccessToken();
    const response = token ? await fetch("/api/projects", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: project.id }),
    }) : null;
    if (!response?.ok) {
      const result = response ? await response.json() : { error: "Your session has expired" };
      setError(result.error ?? "Unable to delete project");
    } else {
      setProjects((current) => current.filter((item) => item.id !== project.id));
      if (selectedProject?.id === project.id) setSelectedProject(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6 text-slate-950 dark:text-slate-100 sm:p-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Workspace</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Projects</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Browse active work and manage the project directory.</p>
      </div>

      {isAdmin && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="add-project-title">
        <h2 id="add-project-title" className="text-lg font-semibold text-slate-950 dark:text-white">Add project</h2>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={addProject}>
          <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Project name" aria-label="Project name" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          <input value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="Summary" aria-label="Summary" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          <input value={form.tech_stack} onChange={(event) => setForm({ ...form, tech_stack: event.target.value })} placeholder="Tech stack, comma separated" aria-label="Tech stack" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} aria-label="Project status" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"><option>discovery</option><option>delivery</option><option>complete</option></select>
          <select value={form.rag_status} onChange={(event) => setForm({ ...form, rag_status: event.target.value })} aria-label="RAG status" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"><option value="green">Green</option><option value="amber">Amber</option><option value="red">Red</option></select>
          <button type="submit" disabled={loading} className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-slate-950">{loading ? "Adding..." : "Add project"}</button>
        </form>
      </section>}

      {error && <p className="text-sm text-red-700 dark:text-red-300" role="alert">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"><tr>
          <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Project</th><th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th><th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">RAG</th><th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
        </tr></thead><tbody>{projects.map((project) => <tr key={project.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
          <td className="px-5 py-4 font-medium text-slate-950 dark:text-white">{project.name}</td><td className="px-5 py-4 text-slate-600 dark:text-slate-300">{project.status}</td><td className="px-5 py-4 text-slate-600 dark:text-slate-300">{project.rag_status}</td>
          <td className="space-x-2 px-5 py-4 text-right"><button type="button" onClick={() => setSelectedProject(project)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-600">View</button>{canDelete && <button type="button" onClick={() => deleteProject(project)} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:text-red-300">Delete</button>}</td>
        </tr>)}{!loading && projects.length === 0 && <tr><td colSpan={4} className="px-5 py-12 text-center text-sm text-slate-500">No projects found.</td></tr>}</tbody></table>
      </div>
      {selectedProject && <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={() => setSelectedProject(null)}><section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-xl bg-white p-6 text-slate-950 shadow-xl dark:bg-slate-900 dark:text-white" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><p className="text-sm uppercase tracking-wide text-slate-500">Project details</p><h2 className="mt-1 text-2xl font-semibold">{selectedProject.name}</h2></div><button type="button" onClick={() => setSelectedProject(null)} aria-label="Close project details" className="text-2xl text-slate-400">x</button></div><dl className="mt-6 grid gap-4 text-sm"><div><dt className="font-medium text-slate-500">Summary</dt><dd className="mt-1">{selectedProject.summary ?? "Not provided"}</dd></div><div><dt className="font-medium text-slate-500">Tech stack</dt><dd className="mt-1">{selectedProject.tech_stack?.join(", ") || "Not provided"}</dd></div><div><dt className="font-medium text-slate-500">Status</dt><dd className="mt-1">{selectedProject.status}</dd></div></dl></section></div>}
    </main>
  );
}
