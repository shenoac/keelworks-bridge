"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Project = {
  id: string;
  name: string;
  status: string;
  rag_status: string;
  created_at: string;
};

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setError(null);
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else setProjects((data ?? []) as Project[]);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function addProject() {
    setLoading(true);
    setError(null);

    const { error } = await supabase.from("projects").insert({
      name: "Newsletter",
      status: "delivery",
      rag_status: "green",
      tech_stack: ["nextjs", "supabase"],
    });

    setLoading(false);

    if (error) setError(error.message);
    else await load();
  }

  return (
    <main className="mx-auto max-w-3xl p-6 text-slate-950 dark:text-slate-100 sm:p-10">
      <h1 className="text-3xl font-semibold text-slate-950 dark:text-white">Keelworks Bridge</h1>

      <button
        onClick={addProject}
        disabled={loading}
        className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      >
        {loading ? "Adding..." : "Add sample project"}
      </button>

      {error && <p className="mt-4 text-red-700 dark:text-red-300">Error: {error}</p>}

      <pre className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        {JSON.stringify(projects, null, 2)}
      </pre>
    </main>
  );
}
