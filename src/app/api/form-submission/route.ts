export async function POST(req: Request) {
  const body = await req.json();

  console.log("Received form submission:", body);

  return Response.json({
    success: true
  });
}