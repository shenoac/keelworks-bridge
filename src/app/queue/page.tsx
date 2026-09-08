"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type PublicRequestRow = {
  id: string;
  project_name: string;
  owner: string | null;
  title: string;
  status: string;
  target_start_date: string | null;
  created_at: string;
  developer_names: string | null;
};

function formatDate(iso: string) {
  const d = new Date(iso);

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

export default function QueuePage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [rows, setRows] = useState<PublicRequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login?redirect=/queue");
        return;
      }

      if (!user.email?.endsWith("@keelworks.org")) {
        await supabase.auth.signOut();
        router.push("/login");
        return;
      }

      setAuthChecked(true);
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("public_requests")
        .select("*");

      if (error) {
        setError(error.message);
        setRows([]);
      } else {
        setRows((data ?? []) as PublicRequestRow[]);
      }

      setLoading(false);
    };

    checkAuthAndLoad();
  }, [router]);

  const statusOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.status));
    return ["all", ...Array.from(set).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    const base = [...rows].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    if (statusFilter === "all") return base;

    return base.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  if (!authChecked) {
    return null;
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6 text-slate-950 dark:text-slate-100 sm:p-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Operations</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Developer Request Queue</h1>
      </div>
      <p className="-mt-4 text-sm text-slate-600 dark:text-slate-300">
        Internal view of all requests, oldest first.
      </p>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-label="Queue filters">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Filter status
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="mt-2 block w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-700"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s}
            </option>
          ))}
        </select>
        </label>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
          Showing {filtered.length} of {rows.length} requests
        </p>
      </section>

      {loading && <p className="text-sm text-slate-500 dark:text-slate-400">Loading requests...</p>}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200" role="alert">
          Unable to load the request queue: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              <tr>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Created</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Project</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Request</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Owner</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Developer</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/60">
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">
                    {formatDate(r.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-950 dark:text-white">
                    {r.project_name}
                  </td>
                  <td className="px-5 py-4 text-slate-700 dark:text-slate-200">{r.title}</td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{r.status}</span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">
                    {r.owner ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">
                    {r.developer_names ?? "—"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                    No requests match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
