"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type PublicRequestRow = {
  id: string;
  project_name: string;
  owner: string | null;
  title: string;
  status: string;
  target_start_date: string | null; // YYYY-MM-DD
  created_at: string; // ISO
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
  const [rows, setRows] = useState<PublicRequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function load() {
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
    }

    load();
  }, []);

  const statusOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.status));
    return ["all", ...Array.from(set).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    const base = [...rows].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    if (statusFilter === "all") return base;
    return base.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Keelworks Bridge — Developer Request Queue</h1>
      <p style={{ opacity: 0.8, marginTop: 6 }}>
        Public view of all requests, oldest first.
      </p>

      <div style={{ marginTop: 18, display: "flex", gap: 12, alignItems: "center" }}>
        <label style={{ fontSize: 14, opacity: 0.85 }}>Filter status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc" }}
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading && <p style={{ marginTop: 16 }}>Loading…</p>}
      {error && <p style={{ marginTop: 16, color: "crimson" }}>Error: {error}</p>}

      {!loading && !error && (
        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e5e5" }}>
                <th style={{ padding: "10px 8px" }}>Created</th>
                <th style={{ padding: "10px 8px" }}>Project</th>
                <th style={{ padding: "10px 8px" }}>Request</th>
                <th style={{ padding: "10px 8px" }}>Status</th>
                <th style={{ padding: "10px 8px" }}>Owner</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                    {formatDate(r.created_at)}
                  </td>
                  <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                    {r.project_name}
                  </td>
                  <td style={{ padding: "10px 8px" }}>{r.title}</td>
                  <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                    <b>{r.status}</b>
                  </td>
                  <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                    {r.owner ?? "—"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "14px 8px", opacity: 0.8 }}>
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
