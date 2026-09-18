import { createClient } from "@supabase/supabase-js";
import { adminEmails } from "@/lib/adminEmails";

async function getAdminClient(request: Request, requireDeleteAccess = false) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!accessToken || !url || !publicKey || !serviceRoleKey) return null;

  const authClient = createClient(url, publicKey);
  const { data: { user } } = await authClient.auth.getUser(accessToken);
  const email = user?.email?.toLowerCase();
  if (!email || !adminEmails.includes(email)) return null;
  if (requireDeleteAccess && !adminEmails.includes(email)) return null;

  return createClient(url, serviceRoleKey);
}

export async function POST(request: Request) {
  const adminClient = await getAdminClient(request);
  if (!adminClient) return Response.json({ error: "Admin access is required" }, { status: 403 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return Response.json({ error: "A project name is required" }, { status: 400 });

  const { data, error } = await adminClient
    .from("projects")
    .insert({
      name,
      summary: typeof body.summary === "string" ? body.summary.trim() || null : null,
      status: typeof body.status === "string" && body.status.trim() ? body.status.trim() : "discovery",
      rag_status: body.rag_status === "amber" || body.rag_status === "red" ? body.rag_status : "green",
      tech_stack: Array.isArray(body.tech_stack) ? body.tech_stack.filter((item: unknown): item is string => typeof item === "string" && Boolean(item.trim())).map((item: string) => item.trim()) : null,
    })
    .select("id")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ id: data.id }, { status: 201 });
}

export async function DELETE(request: Request) {
  const adminClient = await getAdminClient(request, true);
  if (!adminClient) return Response.json({ error: "Admin access is required" }, { status: 403 });

  const { id } = await request.json();
  if (typeof id !== "string" || !id) return Response.json({ error: "A project id is required" }, { status: 400 });

  const { error } = await adminClient.from("projects").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ success: true });
}