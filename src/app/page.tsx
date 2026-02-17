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
    <main style={{ padding: 40, maxWidth: 800, margin: "0 auto" }}>
      <h1>Keelworks Bridge</h1>

      <button
        onClick={addProject}
        disabled={loading}
        style={{ padding: "10px 14px", border: "1px solid #ccc", borderRadius: 8 }}
      >
        {loading ? "Adding..." : "Add sample project"}
      </button>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      <pre style={{ marginTop: 16 }}>
        {JSON.stringify(projects, null, 2)}
      </pre>
    </main>
  );
}
