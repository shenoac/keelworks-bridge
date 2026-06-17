import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  const body = await req.json();

  console.log("Received form submission:", body);

  const { data: project, error: projectError } = await supabase
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

  const { error: insertError } = await supabase
    .from("requests")
    .insert({
      project_id: project.id,
      owner: body.owner,
      status: body.status || "matching",
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