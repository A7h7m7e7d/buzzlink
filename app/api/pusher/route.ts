import { NextResponse } from "next/server";
import { getPusherServer } from "@/lib/pusher";

export const runtime = "nodejs";

const ALLOWED_EVENTS = new Set([
  "vibrate",
  "reach-request",
  "reach-response",
  "presence-ping",
]);

export async function POST(req: Request) {
  const pusher = getPusherServer();
  if (!pusher) {
    return NextResponse.json(
      { error: "Pusher is not configured. Add the PUSHER_* env vars (see .env.example)." },
      { status: 500 }
    );
  }

  let body: { room?: string; event?: string; data?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { room, event, data } = body;

  if (!room || typeof room !== "string") {
    return NextResponse.json({ error: "Missing room code." }, { status: 400 });
  }
  if (!event || !ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ error: "Unknown event." }, { status: 400 });
  }

  const channel = `room-${room.toLowerCase().replace(/[^a-z0-9-]/g, "")}`;
  await pusher.trigger(channel, event, data ?? {});

  return NextResponse.json({ ok: true });
}
