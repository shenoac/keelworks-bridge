import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { success: false, error: "Supabase server configuration is missing" },
      { status: 500 }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const body = await req.json();

  console.log("Received form submission:", body);

  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("id")
    .eq("name", body.project_name)
    .single();

  if (projectError || !project) {
    return Response.json(
      { success: false, error: "Project not found" },
      { status: 400 }
    );
  }

  const { error: insertError } = await supabaseAdmin
    .from("requests")
    .insert({
      project_id: project.id,
      owner: body.owner,
      status: body.status || "new",
      title: body.skills,
    });

  if (insertError) {
    console.error("Insert failed:", insertError);

    return Response.json(
      { success: false, error: insertError.message },
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
  });
}