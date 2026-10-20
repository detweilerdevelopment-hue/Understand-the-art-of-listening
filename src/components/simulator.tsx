"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  FlaskConical,
  Headphones,
  Users,
  Wifi,
  WifiOff,
  Play,
  Pause,
  Square,
  ShieldCheck,
  Info,
  ExternalLink,
  Check,
} from "lucide-react";
import type { Analytics } from "@/lib/analytics";
import { Button } from "./ui/button";
import Link from "next/link";
import { Badge, Empty, CardHead } from "./dashboard-parts";
import { useHydrated } from "@/lib/use-hydrated";
export function Simulator({
  stations,
  writable,
  request,
  onUpdate,
  onError,
}: {
  stations: Analytics["stations"];
  writable: boolean;
  request: (p: string, b: unknown, m?: string) => Promise<unknown>;
  onUpdate: () => void;
  onError: (s: string) => void;
}) {
  const hydrated = useHydrated();
  const [station, setStation] = useState(stations[0]?.id ?? ""),
    [state, setState] = useState<"idle" | "playing" | "paused">("idle"),
    [connected, setConnected] = useState(true),
    [headphones, setHeadphones] = useState(false),
    [presence, setPresence] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [busy, setBusy] = useState(false),
    [buffered, setBuffered] = useState(0),
    [emitted, setEmitted] = useState<
      {
        eventId: string;
        stationId: string;
        type: string;
        timestamp: string;
        sessionKey?: string;
        status: string;
      }[]
    >([]);
  const sessionKey = useRef(""),
    queue = useRef<
      {
        eventId: string;
        stationId: string;
        type: string;
        timestamp: string;
        sessionKey?: string;
        schemaVersion: number;
      }[]
    >([]);
  const emit = useCallback(
    async (type: string, key?: string) => {
      const event = {
        eventId: crypto.randomUUID(),
        stationId: station,
        type,
        timestamp: new Date().toISOString(),
        schemaVersion: 1,
        ...(key ? { sessionKey: key } : {}),
      };
      if (!connected) {
        queue.current.push(event);
        setBuffered((n) => n + 1);
        setEmitted((e) =>
          [{ ...event, status: "Buffered offline" }, ...e].slice(0, 50),
        );
        return;
      }
      await request("/api/simulator", event);
      setEmitted((e) => [{ ...event, status: "Persisted" }, ...e].slice(0, 50));
      onUpdate();
    },
    [station, connected, request, onUpdate],
  );
  useEffect(() => {
    if (state !== "playing") return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [state]);
  const heartbeat = useRef(emit);
  useEffect(() => {
    heartbeat.current = emit;
  }, [emit]);
  useEffect(() => {
    if (!connected || !station || !writable) return;
    const id = setInterval(
      () =>
        void heartbeat
          .current("station_heartbeat")
          .catch((e) => onError(String(e))),
      30000,
    );
    return () => clearInterval(id);
  }, [connected, station, writable, onError]);
  async function action(next: "playing" | "paused" | "idle") {
    setBusy(true);
    try {
      if (next === "playing" && state === "idle") {
        sessionKey.current = crypto.randomUUID();
        setElapsed(0);
        await emit("station_heartbeat");
        await emit("playback_started", sessionKey.current);
      } else if (next === "playing")
        await emit("playback_resumed", sessionKey.current);
      else if (next === "paused")
        await emit("playback_paused", sessionKey.current);
      else await emit("playback_stopped", sessionKey.current);
      setState(next);
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="simulator-layout">
        <section className="station-simulator">
          <div className="simulator-top">
            <span>
              <FlaskConical size={14} />
              INTERACTIVE STATION
            </span>
            <Badge tone="purple">Synthetic only</Badge>
          </div>
          <select
            aria-label="Simulator station"
            value={station}
            disabled={!hydrated || state !== "idle" || buffered > 0}
            onChange={(e) => setStation(e.target.value)}
          >
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.location}
              </option>
            ))}
          </select>
          <div
            className={`headphone-orbit ${state === "playing" ? "playing" : ""}`}
          >
            <div className="orbit one" />
            <div className="orbit two" />
            <Headphones size={87} strokeWidth={1.1} />
            <span className="orbit-dot" />
          </div>
          <div className="simulator-state">
            {state === "idle"
              ? "A moment to listen."
              : state === "playing"
                ? "Listening in progress."
                : "Taking a pause."}
          </div>
          <p>
            {state === "idle"
              ? "Start a session. Follow every signal."
              : "Every observation follows the real ingestion pipeline."}
          </p>
          <div className="elapsed">
            {Math.floor(elapsed / 60)
              .toString()
              .padStart(2, "0")}
            <span>:</span>
            {(elapsed % 60).toString().padStart(2, "0")}
          </div>
          <span className="elapsed-caption">PLAYBACK TIME · THIS TAB</span>
          <div className="playback-controls">
            {state === "idle" ? (
              <Button
                onClick={() => action("playing")}
                disabled={!hydrated || !station || !writable || busy}
              >
                <Play size={17} fill="currentColor" />
                Start listening
              </Button>
            ) : (
              <>
                <Button
                  onClick={() =>
                    action(state === "playing" ? "paused" : "playing")
                  }
                  disabled={busy}
                >
                  {state === "playing" ? (
                    <Pause size={17} />
                  ) : (
                    <Play size={17} />
                  )}{" "}
                  {state === "playing" ? "Pause" : "Resume"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => action("idle")}
                  disabled={busy}
                >
                  <Square size={15} />
                  Stop session
                </Button>
              </>
            )}
          </div>
          <div className="sensor-controls">
            {[
              {
                label: "Headphones connected",
                value: headphones,
                icon: Headphones,
                set: setHeadphones,
                on: "headphones_connected",
                off: "headphones_disconnected",
              },
              {
                label: "Presence detected",
                value: presence,
                icon: Users,
                set: setPresence,
                on: "presence_detected",
                off: "presence_ended",
              },
            ].map((c) => (
              <div key={c.label}>
                <c.icon size={17} />
                <span>{c.label}</span>
                <button
                  aria-label={c.label}
                  role="switch"
                  aria-checked={c.value}
                  disabled={!hydrated || !writable || busy}
                  className={`switch ${c.value ? "on" : ""}`}
                  onClick={async () => {
                    try {
                      await emit(c.value ? c.off : c.on);
                      c.set(!c.value);
                    } catch (e) {
                      onError(String(e));
                    }
                  }}
                >
                  <i />
                </button>
              </div>
            ))}
            <div>
              {connected ? <Wifi size={17} /> : <WifiOff size={17} />}
              <span>Gateway connectivity</span>
              <button
                aria-label="Gateway connectivity"
                role="switch"
                aria-checked={connected}
                disabled={!hydrated || busy || !writable}
                className={`switch ${connected ? "on" : ""}`}
                onClick={async () => {
                  if (connected) {
                    setConnected(false);
                    return;
                  }
                  setBusy(true);
                  try {
                    while (queue.current.length) {
                      const e = queue.current[0];
                      await request("/api/simulator", e);
                      queue.current.shift();
                      setBuffered((n) => Math.max(0, n - 1));
                      setEmitted((all) =>
                        all.map((x) =>
                          x.eventId === e.eventId
                            ? { ...x, status: "Persisted after retry" }
                            : x,
                        ),
                      );
                    }
                    setConnected(true);
                    onUpdate();
                  } catch (e) {
                    onError(String(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <i />
              </button>
            </div>
          </div>
          {!connected && (
            <div className="buffer-note">
              <WifiOff size={14} />
              Offline simulation · {buffered} events buffered in this tab
            </div>
          )}
        </section>
        <section className="card emitted-events">
          <CardHead
            title="Behind the experience"
            subtitle="Real validation. Real persistence. Synthetic observations."
            right={
              <Badge tone={connected ? "green" : "amber"}>
                {connected ? "Connected" : "Buffering"}
              </Badge>
            }
          />
          {emitted.length ? (
            <div className="emitted-list">
              {emitted.map((e) => (
                <div key={e.eventId}>
                  <span className="emitted-icon">
                    <Check size={14} />
                  </span>
                  <div>
                    <strong>{e.type.replaceAll("_", " ")}</strong>
                    <code>{e.eventId.slice(0, 20)}…</code>
                    <span>{e.status}</span>
                  </div>
                  <time>
                    {new Date(e.timestamp).toLocaleTimeString("en-US", {
                      hour12: false,
                    })}
                  </time>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Your signals will appear here"
              detail="Press play or toggle a sensor to emit an event through the shared backend pipeline."
            />
          )}
          <div className="card-bottom">
            <ShieldCheck size={14} />
            No personal information is collected.
          </div>
        </section>
      </div>
      <div className="info-panel">
        <Info size={18} />
        <p>
          The elapsed clock is a local preview. Persisted listening duration is
          calculated on the server from playback timestamps after a stop event.
          Offline events remain in this tab until reconnection; closing it loses
          the buffer.
        </p>
      </div>
      <Link className="text-link" href="/sessions">
        Inspect persisted sessions
        <ExternalLink size={14} />
      </Link>
    </>
  );
}
