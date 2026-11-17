import { createClient } from "@supabase/supabase-js";
import { adminEmails } from "@/lib/adminEmails";

async function getAdminClient(request: Request) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!accessToken || !supabaseUrl || !publicKey || !serviceRoleKey) return null;

  const authClient = createClient(supabaseUrl, publicKey);
  const {
    data: { user },
  } = await authClient.auth.getUser(accessToken);
  const email = user?.email?.toLowerCase();
  if (!email || !adminEmails.includes(email)) return null;

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function GET(request: Request) {
  const adminClient = await getAdminClient(request);
  if (!adminClient) {
    return Response.json({ error: "Admin access is required" }, { status: 403 });
  }

  const [developers, projects, requests] = await Promise.all([
    adminClient.from("developers").select("id, full_name").order("full_name"),
    adminClient.from("projects").select("id, name").order("name"),
    adminClient
      .from("requests")
      .select("id, project_id, title, status")
      .order("created_at", { ascending: false }),
  ]);

  const error = developers.error ?? projects.error ?? requests.error;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({
    developers: developers.data,
    projects: projects.data,
    requests: requests.data,
  });
}

export async function POST(request: Request) {
  const adminClient = await getAdminClient(request);
  if (!adminClient) {
    return Response.json({ error: "Admin access is required" }, { status: 403 });
  }

  let body: {
    developer_id?: unknown;
    project_id?: unknown;
    request_id?: unknown;
    start_date?: unknown;
    end_date?: unknown;
    role?: unknown;
  };
  try {
    const parsedBody: unknown = await request.json();
    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      return Response.json({ error: "A valid JSON object is required" }, { status: 400 });
    }
    body = parsedBody as typeof body;
  } catch {
    return Response.json({ error: "A valid JSON body is required" }, { status: 400 });
  }

  if (
    (body.request_id !== undefined && body.request_id !== null && typeof body.request_id !== "string") ||
    (body.start_date !== undefined && body.start_date !== null && typeof body.start_date !== "string") ||
    (body.end_date !== undefined && body.end_date !== null && typeof body.end_date !== "string") ||
    (body.role !== undefined && body.role !== null && typeof body.role !== "string")
  ) {
    return Response.json({ error: "Assignment details have invalid values" }, { status: 400 });
  }

  const developerId = typeof body.developer_id === "string" ? body.developer_id.trim() : "";
  const projectId = typeof body.project_id === "string" ? body.project_id.trim() : "";
  const requestId =
    typeof body.request_id === "string" && body.request_id.trim()
      ? body.request_id.trim()
      : null;
  const startDate =
    typeof body.start_date === "string" ? body.start_date.trim() : "";
  const endDate =
    typeof body.end_date === "string" && body.end_date.trim()
      ? body.end_date.trim()
      : null;
  const role = typeof body.role === "string" ? body.role.trim() || null : null;
  const isDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

  if (!developerId || !projectId) {
    return Response.json(
      { error: "A developer and project are required" },
      { status: 400 }
    );
  }
  if (startDate && !isDate(startDate)) {
    return Response.json({ error: "Start date must be a valid date" }, { status: 400 });
  }
  if (endDate && !isDate(endDate)) {
    return Response.json({ error: "End date must be a valid date" }, { status: 400 });
  }
  if (startDate && endDate && endDate < startDate) {
    return Response.json(
      { error: "End date cannot be earlier than start date" },
      { status: 400 }
    );
  }

  const [developerResult, projectResult] = await Promise.all([
    adminClient.from("developers").select("id").eq("id", developerId).maybeSingle(),
    adminClient.from("projects").select("id").eq("id", projectId).maybeSingle(),
  ]);
  if (developerResult.error) {
    return Response.json({ error: developerResult.error.message }, { status: 500 });
  }
  if (!developerResult.data) {
    return Response.json({ error: "Developer not found" }, { status: 404 });
  }
  if (projectResult.error) {
    return Response.json({ error: projectResult.error.message }, { status: 500 });
  }
  if (!projectResult.data) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  if (requestId) {
    const { data: linkedRequest, error } = await adminClient
      .from("requests")
      .select("id, project_id")
      .eq("id", requestId)
      .maybeSingle();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!linkedRequest) {
      return Response.json({ error: "Request not found" }, { status: 404 });
    }
    if (linkedRequest.project_id !== projectId) {
      return Response.json(
        { error: "The selected request does not belong to this project" },
        { status: 400 }
      );
    }
  }

  const { data, error } = await adminClient
    .from("project_assignments")
    .insert({
      developer_id: developerId,
      project_id: projectId,
      request_id: requestId,
      ...(startDate ? { start_date: startDate } : {}),
      end_date: endDate,
      role,
    })
    .select("id")
    .single();

  if (error?.code === "23505" && error.message.includes("unique_project_dev")) {
    return Response.json(
      { error: "This developer is already assigned to this project. Review the existing assignment or choose a different project." },
      { status: 409 }
    );
  }
  if (error?.code === "23505" && error.message.includes("uniq_active_assignment_per_dev")) {
    return Response.json(
      { error: "This developer already has an active project assignment. End the existing assignment before assigning them to another project." },
      { status: 409 }
    );
  }
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ id: data.id }, { status: 201 });
}
