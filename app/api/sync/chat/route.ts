import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { redis } from "@/lib/redis";

function keyFor(userId: string) {
  return `chat:${userId}`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const data = await redis.get(keyFor(session.user.email));
    return NextResponse.json({ data: data ?? null });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load chat history" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const body = await request.json();
    await redis.set(keyFor(session.user.email), body);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to save chat history" },
      { status: 500 }
    );
  }
}