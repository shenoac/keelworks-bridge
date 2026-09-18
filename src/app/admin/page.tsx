"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    async function checkAdminAccess() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        router.replace("/login?redirect=/admin");
        return;
      }

      const response = await fetch("/api/developers", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = response.ok ? await response.json() : null;

      if (!result?.isAdmin) {
        router.replace("/queue");
        return;
      }

      setCheckingAccess(false);
    }

    checkAdminAccess();
  }, [router]);

  if (checkingAccess) {
    return <main className="mx-auto max-w-7xl p-6 text-slate-950 dark:text-slate-100 sm:p-8">Checking admin access...</main>;
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-6 text-slate-950 dark:text-slate-100 sm:p-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Restricted workspace</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">Admin dashboard</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Manage the project and developer directories.</p>
      </header>

      <section className="grid gap-5 md:grid-cols-2" aria-label="Admin tools">
        <Link href="/" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Projects</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Add, review, and remove projects.</p>
          <span className="mt-5 inline-block text-sm font-medium text-slate-950 dark:text-white">Open project management</span>
        </Link>
        <Link href="/developers" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Developers</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Add, review, filter, and remove developers.</p>
          <span className="mt-5 inline-block text-sm font-medium text-slate-950 dark:text-white">Open developer management</span>
        </Link>
      </section>
    </main>
  );
}