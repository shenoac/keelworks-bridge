import { createClient } from "@supabase/supabase-js";
import { adminEmails } from "@/lib/adminEmails";

async function getAuthenticatedEmail(request: Request) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!accessToken || !supabaseUrl || !publicKey) return null;

  const authClient = createClient(supabaseUrl, publicKey);
  const { data: { user } } = await authClient.auth.getUser(accessToken);

  return user?.email?.toLowerCase() ?? null;
}

export async function GET(request: Request) {
  const email = await getAuthenticatedEmail(request);

  return Response.json({
    isAdmin: Boolean(email && adminEmails.includes(email)),
    canDelete: Boolean(email && adminEmails.includes(email)),
  });
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !publicKey || !serviceRoleKey) {
    return Response.json({ error: "Server configuration is incomplete" }, { status: 500 });
  }

  const email = await getAuthenticatedEmail(request);

  if (!email || !adminEmails.includes(email)) {
    return Response.json({ error: "Admin access is required" }, { status: 403 });
  }

  const body = await request.json();
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const developerEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const skills = Array.isArray(body.skills)
    ? body.skills.filter((skill: unknown): skill is string => typeof skill === "string" && Boolean(skill.trim())).map((skill: string) => skill.trim())
    : [];

  if (!fullName || !developerEmail || !developerEmail.includes("@")) {
    return Response.json({ error: "A valid name and email are required" }, { status: 400 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await adminClient
    .from("developers")
    .insert({
      full_name: fullName,
      email: developerEmail,
      skills,
      location: typeof body.location === "string" ? body.location.trim() || null : null,
      availability_hours: Number.isFinite(Number(body.availability_hours))
        ? Number(body.availability_hours)
        : 0,
      status: body.status === "unavailable" ? "unavailable" : "available",
    })
    .select("id")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ id: data.id }, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Server configuration is incomplete" }, { status: 500 });
  }

  const email = await getAuthenticatedEmail(request);
  if (!email || !adminEmails.includes(email)) {
    return Response.json({ error: "Admin access is required" }, { status: 403 });
  }

  const { id } = await request.json();
  if (typeof id !== "string" || !id) {
    return Response.json({ error: "A developer id is required" }, { status: 400 });
  }

  const { error } = await createClient(supabaseUrl, serviceRoleKey)
    .from("developers")
    .delete()
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ success: true });
}