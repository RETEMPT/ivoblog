export const runtime = 'nodejs';
export async function GET() {
  return new Response("喵！我能通！", { status: 200 });
}
