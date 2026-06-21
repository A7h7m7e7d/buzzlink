import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Weather feature not configured. Add OPENWEATHER_API_KEY to enable it." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json({ error: "lat and lon are required." }, { status: 400 });
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(
    lat
  )}&lon=${encodeURIComponent(lon)}&units=metric&appid=${apiKey}`;

  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) {
      return NextResponse.json({ error: "Weather service error." }, { status: 502 });
    }
    const json = await res.json();
    return NextResponse.json({
      city: json.name as string,
      temp: Math.round(json.main?.temp),
      feelsLike: Math.round(json.main?.feels_like),
      description: json.weather?.[0]?.description as string,
      icon: json.weather?.[0]?.icon as string,
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the weather service." }, { status: 502 });
  }
}
