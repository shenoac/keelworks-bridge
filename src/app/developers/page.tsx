"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Developer = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string | null;
};

export default function DevelopersPage() {
  const router = useRouter();

  const [developers, setDevelopers] = useState<Developer[]>([]);
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
        .from("developers")
        .select("id, full_name, email, status")
        .order("status");

      if (error) {
        console.error("Failed to load developers:", error);
      } else {
        setDevelopers(data ?? []);
      }

      setLoading(false);
    }

    checkAuthAndLoad();
  }, [router]);

  if (loading) {
    return <main className="p-8">Loading developers...</main>;
  }

  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-semibold">Developers</h1>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>

          <tbody>
            {developers.map((developer) => (
              <tr key={developer.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">
                  {developer.full_name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {developer.email ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {developer.status ?? "—"}
                </td>
              </tr>
            ))}

            {developers.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  No developers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}