import { NextResponse } from "next/server";
import { buildFounderViewWithSuggested } from "@/lib/queries/founderView";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const clean = decodeURIComponent(username).trim();
  const built = await buildFounderViewWithSuggested(clean);
  if (!built) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(built);
}
