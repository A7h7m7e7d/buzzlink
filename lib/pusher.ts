import Pusher from "pusher";

let cached: Pusher | null = null;

/**
 * Server-side Pusher client. Returns null if env vars are not configured,
 * so the API routes can respond with a clear setup message instead of crashing.
 */
export function getPusherServer(): Pusher | null {
  if (cached) return cached;

  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env;

  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) {
    return null;
  }

  cached = new Pusher({
    appId: PUSHER_APP_ID,
    key: PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: PUSHER_CLUSTER,
    useTLS: true,
  });

  return cached;
}
