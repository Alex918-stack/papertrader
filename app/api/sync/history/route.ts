import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { redis } from "@/lib/redis";

function keyFor(userId: string, id: string) {
  return `history:${userId}:${id}`;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const data = await redis.get(keyFor(session.user.email, id));
    return NextResponse.json({ data: data ?? null });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load history" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    await redis.set(keyFor(session.user.email, id), body);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to save history" },
      { status: 500 }
    );
  }
}