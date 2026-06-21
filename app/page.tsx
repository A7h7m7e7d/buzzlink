"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import PusherClient from "pusher-js";

type ReachRequest = { fromName: string; fromId: string };
type WeatherData = {
  city: string;
  temp: number;
  feelsLike: number;
  description: string;
  icon: string;
};

const PATTERNS: Record<string, number[]> = {
  Buzz: [400],
  Double: [200, 120, 200],
  SOS: [120, 80, 120, 80, 120, 220, 320, 80, 320, 80, 320, 220, 120, 80, 120, 80, 120],
  Gentle: [80, 60, 80],
};

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function randomRoom() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

export default function Home() {
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [connected, setConnected] = useState(false);
  const [pattern, setPattern] = useState<keyof typeof PATTERNS | string>("Double");
  const [shaking, setShaking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<ReachRequest | null>(null);
  const [answerTime, setAnswerTime] = useState("");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherMsg, setWeatherMsg] = useState<string | null>(null);

  const clientId = useRef<string>(randomId());
  const pusherRef = useRef<PusherClient | null>(null);
  const channelRef = useRef<ReturnType<PusherClient["subscribe"]> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }, []);

  // Audible + visual fallback so a buzz is noticeable even where the
  // Vibration API isn't supported (e.g. iOS Safari).
  const playBeep = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 180;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.46);
    } catch {
      /* ignore */
    }
  }, []);

  const triggerLocalBuzz = useCallback(
    (patternName: string, fromName: string) => {
      const p = PATTERNS[patternName] ?? PATTERNS.Buzz;
      if ("vibrate" in navigator) {
        navigator.vibrate(p);
      }
      setShaking(true);
      setTimeout(() => setShaking(false), 700);
      playBeep();
      showToast(`📳 ${fromName} buzzed your phone (${patternName})`);
    },
    [playBeep, showToast]
  );

  // ── Realtime send helper ──
  const send = useCallback(
    async (event: string, data: Record<string, unknown>) => {
      try {
        const res = await fetch("/api/pusher", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room, event, data: { ...data, fromId: clientId.current } }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          showToast(`⚠️ ${j.error ?? "Could not send. Is Pusher configured?"}`);
        }
      } catch {
        showToast("⚠️ Network error sending the buzz.");
      }
    },
    [room, showToast]
  );

  // ── Connect to a room ──
  const connect = useCallback(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) {
      showToast("⚠️ Pusher keys missing. Add NEXT_PUBLIC_PUSHER_* env vars.");
      return;
    }
    if (!name.trim() || !room.trim()) {
      showToast("Enter your name and a room code first.");
      return;
    }

    const cleanRoom = room.toLowerCase().replace(/[^a-z0-9-]/g, "");
    const pusher = new PusherClient(key, { cluster });
    const channel = pusher.subscribe(`room-${cleanRoom}`);

    channel.bind("vibrate", (d: { patternName: string; fromName: string; fromId: string }) => {
      if (d.fromId === clientId.current) return;
      triggerLocalBuzz(d.patternName, d.fromName);
    });

    channel.bind("reach-request", (d: { fromName: string; fromId: string }) => {
      if (d.fromId === clientId.current) return;
      if ("vibrate" in navigator) navigator.vibrate([300, 150, 300]);
      playBeep();
      setIncoming({ fromName: d.fromName, fromId: d.fromId });
    });

    channel.bind(
      "reach-response",
      (d: { fromName: string; toId: string; time: string; fromId: string }) => {
        if (d.fromId === clientId.current) return;
        if (d.toId && d.toId !== clientId.current) return;
        showToast(`🕒 ${d.fromName} says they'll reach by ${d.time}`);
      }
    );

    channel.bind("presence-ping", (d: { fromName: string; fromId: string }) => {
      if (d.fromId === clientId.current) return;
      showToast(`👋 ${d.fromName} joined the room`);
    });

    pusherRef.current = pusher;
    channelRef.current = channel;
    setConnected(true);

    channel.bind("pusher:subscription_succeeded", () => {
      showToast(`Connected to room ${cleanRoom.toUpperCase()}`);
      send("presence-ping", { fromName: name.trim() });
    });
  }, [name, room, showToast, triggerLocalBuzz, playBeep, send]);

  const disconnect = useCallback(() => {
    channelRef.current?.unbind_all();
    pusherRef.current?.disconnect();
    pusherRef.current = null;
    channelRef.current = null;
    setConnected(false);
    showToast("Disconnected.");
  }, [showToast]);

  useEffect(() => {
    return () => {
      pusherRef.current?.disconnect();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // ── Actions ──
  const sendBuzz = () => {
    if (!connected) return;
    if ("vibrate" in navigator) navigator.vibrate(30); // tactile confirm on sender
    send("vibrate", { patternName: pattern, fromName: name.trim() });
    showToast(`Sent a ${pattern} buzz →`);
  };

  const sendReachRequest = () => {
    if (!connected) return;
    send("reach-request", { fromName: name.trim() });
    showToast("Asked your friend when they'll reach…");
  };

  const submitAnswer = () => {
    if (!answerTime || !incoming) return;
    send("reach-response", {
      fromName: name.trim(),
      toId: incoming.fromId,
      time: answerTime,
    });
    setIncoming(null);
    setAnswerTime("");
    showToast("Answer sent ✅");
  };

  // ── Weather (free API key feature) ──
  const loadWeather = useCallback(() => {
    setWeatherMsg("Locating you…");
    if (!("geolocation" in navigator)) {
      setWeatherMsg("Geolocation not available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`/api/weather?lat=${latitude}&lon=${longitude}`);
          const j = await res.json();
          if (!res.ok) {
            setWeatherMsg(j.error ?? "Weather unavailable.");
            return;
          }
          setWeather(j);
          setWeatherMsg(null);
        } catch {
          setWeatherMsg("Could not load weather.");
        }
      },
      () => setWeatherMsg("Location permission denied."),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, []);

  return (
    <main className={`wrap ${shaking ? "shake" : ""}`}>
      <header className="brand">
        <div className="logo">📳</div>
        <div>
          <h1>BuzzLink</h1>
          <p>Tap to vibrate your friend&apos;s phone</p>
        </div>
      </header>

      {/* ── Connect card ── */}
      <section className="card">
        <h2>1 · Join the same room</h2>
        <p className="sub">
          You and your friend both type the <b>same room code</b>, then tap Connect.
        </p>

        <label className="field">Your name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Yusuf"
          disabled={connected}
          maxLength={20}
        />

        <div style={{ height: 12 }} />

        <label className="field">Room code</label>
        <div className="row">
          <input
            value={room}
            onChange={(e) => setRoom(e.target.value.toUpperCase())}
            placeholder="e.g. SUMMR"
            disabled={connected}
            maxLength={12}
          />
          <button
            className="btn-ghost"
            style={{ flex: "0 0 auto", padding: "0 14px" }}
            onClick={() => setRoom(randomRoom())}
            disabled={connected}
          >
            🎲
          </button>
        </div>

        <div style={{ height: 14 }} />

        {!connected ? (
          <button className="btn-primary" style={{ width: "100%" }} onClick={connect}>
            Connect
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="status">
              <span className="dot on" /> Connected as {name} · {room}
            </span>
            <button className="btn-ghost" style={{ padding: "8px 14px" }} onClick={disconnect}>
              Leave
            </button>
          </div>
        )}
      </section>

      {/* ── Buzz card ── */}
      <section className="card">
        <h2>2 · Buzz them</h2>
        <p className="sub">Pick a pattern and slam the button.</p>

        <label className="field">Vibration pattern</label>
        <select value={pattern} onChange={(e) => setPattern(e.target.value)}>
          {Object.keys(PATTERNS).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <div style={{ height: 18 }} />

        <div className="buzz-stage">
          <button
            className="buzz"
            onClick={sendBuzz}
            disabled={!connected}
            aria-label="Send a buzz"
          >
            BUZZ!
            <small>{connected ? "tap to send" : "connect first"}</small>
          </button>
          <button
            className="btn-ghost"
            style={{ width: "100%" }}
            onClick={() => triggerLocalBuzz(pattern, "You")}
          >
            Test buzz on my phone
          </button>
        </div>
      </section>

      {/* ── When will you reach card ── */}
      <section className="card">
        <h2>3 · &ldquo;When will you reach?&rdquo;</h2>
        <p className="sub">
          Send the question to your friend. Their phone pops a prompt they <b>must</b> answer
          with the time they&apos;ll reach you.
        </p>
        <button className="btn-cyan" style={{ width: "100%" }} onClick={sendReachRequest} disabled={!connected}>
          Ask &ldquo;When will you reach?&rdquo; →
        </button>
      </section>

      {/* ── Weather (free API) card ── */}
      <section className="card">
        <h2>
          Bonus · Weather at your spot <span className="pill">free API</span>
        </h2>
        <p className="sub">
          Powered by OpenWeatherMap — handy context for &ldquo;when will you reach.&rdquo;
        </p>
        {weather ? (
          <div className="weather">
            <img
              alt={weather.description}
              width={56}
              height={56}
              src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
            />
            <div>
              <div className="temp">{weather.temp}°C</div>
              <div className="meta">
                {weather.description} · {weather.city} · feels {weather.feelsLike}°
              </div>
            </div>
          </div>
        ) : (
          <button className="btn-ghost" style={{ width: "100%" }} onClick={loadWeather}>
            {weatherMsg ?? "Show weather where I am"}
          </button>
        )}
      </section>

      <p className="footnote">
        Heads up: real haptic vibration works on <b>Android Chrome</b>. iOS Safari blocks the
        Vibration API, so there you&apos;ll get a buzz sound + screen shake instead.
      </p>

      {/* ── Forced-answer modal ── */}
      {incoming && (
        <div className="overlay">
          <div className="modal">
            <div className="emoji">🕒</div>
            <span className="obliged">You are obliged to answer</span>
            <h3>{incoming.fromName} asks: when will you reach?</h3>
            <p>What time do you need to reach where {incoming.fromName} is?</p>
            <label className="field">Arrival time</label>
            <input type="time" value={answerTime} onChange={(e) => setAnswerTime(e.target.value)} />
            <div style={{ height: 14 }} />
            <button className="btn-primary" style={{ width: "100%" }} onClick={submitAnswer} disabled={!answerTime}>
              Send my answer
            </button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
