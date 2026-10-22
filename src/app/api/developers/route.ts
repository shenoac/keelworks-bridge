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

  const response: Record<string, unknown> = {
    isAdmin: Boolean(email && adminEmails.includes(email)),
    canDelete: Boolean(email && adminEmails.includes(email)),
  };

  if (new URL(request.url).searchParams.get("includeComments") === "true") {
    if (!email || !adminEmails.includes(email)) {
      return Response.json(
        { ...response, commentsError: "Admin access is required" },
        { status: 403 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json(
        { ...response, commentsError: "Server configuration is incomplete" },
        { status: 500 }
      );
    }

    const { data, error } = await createClient(supabaseUrl, serviceRoleKey)
      .from("developer_comments")
      .select("id, developer_id, developer_name, author, comment, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      return Response.json({ ...response, commentsError: error.message }, { status: 500 });
    }
    const commentsByDeveloper: Record<string, typeof data> = {};
    const archivedComments = [];
    for (const entry of data) {
      if (entry.developer_id) {
        (commentsByDeveloper[entry.developer_id] ??= []).push(entry);
      } else {
        archivedComments.push(entry);
      }
    }
    response.comments = commentsByDeveloper;
    response.archivedComments = archivedComments;
  }

  return Response.json(response);
}

export async function PATCH(request: Request) {
  const email = await getAuthenticatedEmail(request);
  if (!email || !adminEmails.includes(email)) {
    return Response.json({ error: "Admin access is required" }, { status: 403 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Server configuration is incomplete" }, { status: 500 });
  }

  let body: { id?: unknown; comments?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "A valid JSON body is required" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  const comment = typeof body.comments === "string" ? body.comments.trim() : "";
  if (!id) return Response.json({ error: "A developer id is required" }, { status: 400 });
  if (!comment) return Response.json({ error: "Comments cannot be empty" }, { status: 400 });
  if (comment.length > 5000) return Response.json({ error: "Comments cannot exceed 5000 characters" }, { status: 400 });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: developer, error: developerError } = await adminClient
    .from("developers")
    .select("full_name")
    .eq("id", id)
    .maybeSingle();

  if (developerError) return Response.json({ error: developerError.message }, { status: 500 });
  if (!developer) return Response.json({ error: "Developer not found" }, { status: 404 });

  const { data, error } = await adminClient
    .from("developer_comments")
    .insert({
      developer_id: id,
      developer_name: developer.full_name ?? "Unknown developer",
      author: email,
      comment,
    })
    .select("id, developer_id, developer_name, author, comment, created_at")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json(data, { status: 201 });
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