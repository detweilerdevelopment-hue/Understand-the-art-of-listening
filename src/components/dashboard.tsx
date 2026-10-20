"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileBarChart2,
  FlaskConical,
  Headphones,
  Info,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
  Moon,
  Users,
  Wifi,
  X,
  LogOut,
  AlertTriangle,
} from "lucide-react";
import type { Analytics } from "@/lib/analytics";
import { duration } from "@/lib/utils";
import { Button } from "./ui/button";
import { ActivityChart, DistributionChart } from "./charts";
import {
  Badge,
  Empty,
  Kpi,
  CardHead,
  Heatmap,
  StationTable,
  Modal,
  Methodology,
} from "./dashboard-parts";
import { Simulator } from "./simulator";
type User = { name: string; role: string; demo: boolean; publicDemo?: boolean };
const nav = [
  { id: "overview", label: "Executive overview", icon: LayoutDashboard },
  { id: "stations", label: "Listening stations", icon: Headphones },
  { id: "live", label: "Live activity", icon: Radio },
  { id: "sessions", label: "Session explorer", icon: Search },
  { id: "engagement", label: "Engagement analytics", icon: BarChart3 },
  { id: "reports", label: "Reports", icon: FileBarChart2 },
];
const trust = [
  { id: "quality", label: "Data quality", icon: ShieldCheck },
  { id: "methodology", label: "Methodology", icon: BookOpen },
];
const titles: Record<string, [string, string]> = {
  overview: [
    "Executive overview",
    "A clearer picture of how your audience listens.",
  ],
  stations: [
    "Listening stations",
    "Manage the touchpoints that bring your gallery to life.",
  ],
  live: [
    "Live activity",
    "Follow station signals as they arrive. Updated every 5 seconds.",
  ],
  sessions: [
    "Session explorer",
    "Every listening interaction, with the evidence behind it.",
  ],
  engagement: [
    "Engagement analytics",
    "Go beyond the count. Understand what holds attention.",
  ],
  reports: ["Reports", "Turn listening data into a story you can share."],
  quality: [
    "Data quality & verification",
    "Confidence starts with transparent, traceable evidence.",
  ],
  methodology: [
    "Measurement methodology",
    "Know what we measure. Understand what it means.",
  ],
  simulator: [
    "Station simulator",
    "Explore the full measurement pipeline, without the hardware.",
  ],
  settings: [
    "Workspace settings",
    "Configure the rules behind your measurement.",
  ],
};
type SessionRow = {
  id: string;
  stationId: string;
  station: { name: string };
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  sourceType: string;
  confidence: string;
  status: string;
  flags: string[];
};
function downloadUrl(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  document.body.append(link);
  link.click();
  link.remove();
}
function stamp(v: Date | string | null | undefined) {
  return v
    ? new Date(v).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Denver",
      })
    : "—";
}
export function Dashboard({
  section,
  initial,
  user,
}: {
  section: string;
  initial: Analytics;
  user: User;
}) {
  const router = useRouter(),
    [data, setData] = useState(initial),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [source, setSource] = useState(initial.sourceType),
    [days, setDays] = useState(28),
    [start, setStart] = useState(initial.period.start.slice(0, 10)),
    [end, setEnd] = useState(initial.period.end.slice(0, 10)),
    [custom, setCustom] = useState(false),
    [mobile, setMobile] = useState(false),
    [theme, setTheme] = useState("light"),
    [userMenu, setUserMenu] = useState(false),
    [stationEditor, setStationEditor] = useState<
      Analytics["stations"][number] | "new" | null
    >(null),
    [sessionRows, setSessionRows] = useState<SessionRow[]>([]),
    [sessionTotal, setSessionTotal] = useState(0),
    [page, setPage] = useState(1),
    [stationFilter, setStationFilter] = useState(""),
    [statusFilter, setStatusFilter] = useState(""),
    [sort, setSort] = useState("desc"),
    [inspected, setInspected] = useState<{
      session: SessionRow;
      events: Analytics["events"];
    } | null>(null),
    [search, setSearch] = useState(""),
    [reportBusy, setReportBusy] = useState(false),
    [deviceSecret, setDeviceSecret] = useState("");
  const apiBase = user.publicDemo ? "/api/demo" : "/api";
  const view = (path: string) => (user.publicDemo ? "/demo" + path : path);
  const writable = ["ADMIN", "ANALYST"].includes(user.role);
  const query = useCallback(() => {
    const p = new URLSearchParams({ source });
    if (custom) {
      p.set("start", new Date(start + "T00:00:00Z").toISOString());
      p.set(
        "end",
        new Date(
          new Date(end + "T00:00:00Z").getTime() + 86400000,
        ).toISOString(),
      );
    } else {
      const now = user.publicDemo ? new Date(initial.period.end) : new Date();
      p.set("end", now.toISOString());
      p.set("start", new Date(+now - days * 86400000).toISOString());
    }
    return p;
  }, [source, days, start, end, custom, user.publicDemo, initial.period.end]);
  const requestSequence = useRef(0);
  const refresh = useCallback(
    async (silent = false) => {
      const sequence = ++requestSequence.current;
      if (!silent) setBusy(true);
      try {
        const r = await fetch(apiBase + "/analytics?" + query(), {
          cache: "no-store",
        });
        if (!r.ok) throw new Error((await r.json()).error);
        const result = await r.json();
        if (sequence === requestSequence.current) {
          setData(result);
          setError("");
        }
      } catch (e) {
        if (sequence === requestSequence.current)
          setError(String(e instanceof Error ? e.message : e));
      } finally {
        if (sequence === requestSequence.current) setBusy(false);
      }
    },
    [query, apiBase],
  );
  useEffect(() => {
    const id = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(id);
  }, [refresh]);
  useEffect(() => {
    if (section !== "live") return;
    const id = setInterval(() => void refresh(true), 5000);
    return () => clearInterval(id);
  }, [section, refresh]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = localStorage.getItem("gallerypulse-theme");
      if (saved) {
        setTheme(saved);
        document.documentElement.dataset.theme = saved;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const loadSessions = useCallback(async () => {
    const p = query();
    p.set("page", String(page));
    p.set("sort", sort);
    if (stationFilter) p.set("station", stationFilter);
    if (statusFilter) p.set("status", statusFilter);
    try {
      const r = await fetch(apiBase + "/sessions?" + p);
      if (!r.ok) throw new Error((await r.json()).error);
      const j = await r.json();
      setSessionRows(j.rows);
      setSessionTotal(j.total);
    } catch (e) {
      setError(String(e));
    }
  }, [query, page, stationFilter, statusFilter, sort, apiBase]);
  useEffect(() => {
    if (section !== "sessions") return;
    const id = setTimeout(() => void loadSessions(), 0);
    return () => clearTimeout(id);
  }, [section, loadSessions]);
  useEffect(() => {
    if (section !== "sessions") return;
    const id = setTimeout(
      () =>
        setStationFilter(
          new URLSearchParams(window.location.search).get("station") ?? "",
        ),
      0,
    );
    return () => clearTimeout(id);
  }, [section]);
  async function request(path: string, body: unknown, method = "POST") {
    const r = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error);
    return result;
  }
  async function generateReport() {
    setReportBusy(true);
    try {
      const p = query();
      const result = await request("/api/reports", {
        start: p.get("start"),
        end: p.get("end"),
        source,
      });
      await refresh(true);
      setNotice("Report generated. Your PDF is ready.");
      downloadUrl(`/api/reports?id=${result.id}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setReportBusy(false);
    }
  }
  const enabled = data.stations.filter((s) => s.enabled && !s.maintenance),
    online = enabled.filter((s) => ["idle", "active"].includes(s.status)),
    m = data.metrics;
  const exportCsv = () => {
    downloadUrl(apiBase + "/reports?format=csv&" + query());
  };
  const actions = (
    <>
      <Button variant="outline" onClick={exportCsv}>
        <Download size={15} />
        Export data
      </Button>
      {writable && (
        <Button onClick={generateReport} disabled={reportBusy}>
          {reportBusy ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <FileBarChart2 size={15} />
          )}
          Generate report
        </Button>
      )}
    </>
  );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <Link href={view("/overview")} className="brand">
          <span className="brand-mark">
            <Headphones size={21} />
          </span>
          GalleryPulse<span className="brand-dot">®</span>
        </Link>
        <div className="workspace-switch">
          <div className="workspace-icon">G</div>
          <div>
            <strong>The Gallery</strong>
            <span>Listening intelligence</span>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <Link
              key={n.id}
              href={view("/" + n.id)}
              onClick={() => setMobile(false)}
              className={`nav-link ${section === n.id ? "selected" : ""}`}
            >
              <n.icon size={17} />
              {n.label}
              {n.id === "live" && <span className="live-dot" />}
            </Link>
          ))}
        </nav>
        <div className="nav-caption">MEASUREMENT & TRUST</div>
        <nav>
          {trust.map((n) => (
            <Link
              key={n.id}
              href={view("/" + n.id)}
              className={`nav-link ${section === n.id ? "selected" : ""}`}
            >
              <n.icon size={17} />
              {n.label}
              {n.id === "quality" && data.metrics.incomplete > 0 && (
                <span className="nav-count">{data.metrics.incomplete}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="simulator-promo">
            <span className="promo-icon">
              <FlaskConical size={18} />
            </span>
            <strong>
              {user.publicDemo
                ? "Insights ready to share."
                : "Meet your listening station."}
            </strong>
            <p>
              {user.publicDemo
                ? "Explore a sample weekly report."
                : "Try the experience. See the data."}
            </p>
            <Link href={user.publicDemo ? view("/reports") : "/simulator"}>
              {user.publicDemo
                ? "Explore sample reports"
                : "Open station simulator"}
              <ArrowUpRight size={14} />
            </Link>
          </div>
          {!user.publicDemo && (
            <Link
              href="/settings"
              className={`nav-link ${section === "settings" ? "selected" : ""}`}
            >
              <Settings2 size={17} />
              Workspace settings
            </Link>
          )}
          <div className="sidebar-footer">
            <span className="tiny-dot" />
            All insights. No personal data.
            <ShieldCheck size={13} />
          </div>
        </div>
      </aside>
      {mobile && (
        <div className="sidebar-scrim" onClick={() => setMobile(false)} />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{titles[section][0]}</strong>
          </div>
          <div className="topbar-right">
            {user.publicDemo && (
              <Link href="/login" className="text-link">
                Admin sign in
                <ArrowUpRight size={13} />
              </Link>
            )}
            <span className="environment">
              <span className="tiny-dot" />
              {user.demo ? "Demo workspace" : "Gallery workspace"}
            </span>
            <div className="top-divider" />
            <button
              className="icon-btn"
              aria-label="Toggle color theme"
              onClick={() => {
                const t = theme === "light" ? "dark" : "light";
                setTheme(t);
                localStorage.setItem("gallerypulse-theme", t);
                document.documentElement.dataset.theme = t;
              }}
            >
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <div className="user-wrap">
              <button
                className="avatar"
                aria-label="User menu"
                onClick={() => setUserMenu(!userMenu)}
              >
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </button>
              {userMenu && (
                <div className="user-menu">
                  <strong>{user.name}</strong>
                  <span>{user.role.toLowerCase()}</span>
                  {user.publicDemo ? (
                    <Link href="/login" className="text-link">
                      Administrator sign in
                      <ArrowUpRight size={14} />
                    </Link>
                  ) : (
                    <button onClick={() => signOut({ callbackUrl: "/login" })}>
                      <LogOut size={15} />
                      Sign out
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="demo-banner">
          {user.publicDemo && <strong>READ-ONLY PUBLIC DEMO</strong>}
          <FlaskConical size={15} />
          <span>
            <strong>
              {source === "simulated"
                ? "You’re exploring demonstration data."
                : "You’re viewing measured data."}
            </strong>{" "}
            {source === "simulated"
              ? "All activity is synthetic. No real visitor measurements."
              : "Playback signals are observations, not proof of headphone use."}
          </span>
          <Link href={view("/methodology")}>
            How we measure
            <ArrowUpRight size={13} />
          </Link>
        </div>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">LISTEN. UNDERSTAND. IMPROVE.</div>
              <h1>{titles[section][0]}</h1>
              <p>{titles[section][1]}</p>
            </div>
            <div className="heading-actions">
              {section === "stations" && writable ? (
                <Button onClick={() => setStationEditor("new")}>
                  <Plus size={16} />
                  Register station
                </Button>
              ) : section === "simulator" ||
                section === "settings" ||
                section === "methodology" ? null : (
                actions
              )}
            </div>
          </div>
          {error && (
            <div role="alert" className="alert error">
              <AlertTriangle size={16} />
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {!["methodology", "simulator", "settings"].includes(section) && (
            <div className="filterbar">
              <div className="filter-left">
                <span className="filter-label">Reporting period</span>
                <div className="select-wrap">
                  <CalendarDays size={15} />
                  <select
                    aria-label="Reporting period"
                    value={custom ? "custom" : days}
                    onChange={(e) => {
                      setPage(1);
                      if (e.target.value === "custom") setCustom(true);
                      else {
                        setCustom(false);
                        setDays(Number(e.target.value));
                      }
                    }}
                  >
                    <option value="7">Last 7 days</option>
                    <option value="28">Last 28 days</option>
                    <option value="56">Last 8 weeks</option>
                    <option value="custom">Custom range</option>
                  </select>
                </div>
                {custom ? (
                  <>
                    <input
                      aria-label="Start date"
                      type="date"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                    />
                    <span>—</span>
                    <input
                      aria-label="End date"
                      type="date"
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                    />
                  </>
                ) : (
                  <span className="range-label">
                    {new Date(data.period.start).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    –{" "}
                    {new Date(data.period.end).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>
              <div className="filter-right">
                <select
                  aria-label="Data source"
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="simulated">Synthetic data</option>
                  {!user.publicDemo && (
                    <option value="measured">Measured data</option>
                  )}
                </select>
                <span className="timezone">{data.timezone}</span>
                <button
                  className="icon-btn"
                  aria-label="Refresh analytics"
                  disabled={busy}
                  onClick={() => void refresh()}
                >
                  <RefreshCw size={14} className={busy ? "spin" : ""} />
                </button>
              </div>
            </div>
          )}
          {section === "overview" && (
            <>
              <div className="section-kicker">
                <span className="tiny-dot" />
                THE BIG PICTURE
                <span className="kicker-note">
                  Your listening experience, at a glance
                </span>
              </div>
              <div className="kpi-grid">
                <Kpi
                  label="Listening sessions"
                  value={m.sessions.toLocaleString()}
                  icon={<Headphones size={17} />}
                  foot="Station interactions recorded"
                  change={data.change}
                />
                <Kpi
                  label="Average listening time"
                  value={duration(m.average)}
                  icon={<Clock3 size={17} />}
                  foot={`Median duration · ${duration(m.median)}`}
                  secondary="Of known-duration sessions"
                />
                <Kpi
                  label="Total listening hours"
                  value={m.hours.toFixed(1)}
                  unit="hrs"
                  icon={<AudioLines size={17} />}
                  foot="Measured playback, excluding pauses"
                />
                <Kpi
                  label="Engaged-session rate"
                  value={
                    m.engagedRate === null
                      ? "—"
                      : (m.engagedRate * 100).toFixed(1)
                  }
                  unit={m.engagedRate === null ? "" : "%"}
                  icon={<Users size={17} />}
                  foot={`Listened for at least ${m.engagedSeconds} seconds`}
                  secondary={`${m.validSessions.toLocaleString()} sessions with known duration`}
                />
              </div>
              <div className="overview-grid">
                <section className="card activity-card">
                  <CardHead
                    title="Listening activity"
                    subtitle="Small moments of attention. A bigger story over time."
                    right={
                      <span className="chart-legend">
                        <i />
                        Listening sessions
                      </span>
                    }
                  />
                  <div className="chart-stat">
                    {m.sessions.toLocaleString()}
                    <span>sessions this period</span>
                    {data.change !== null && (
                      <Badge tone="green">
                        {data.change >= 0 ? "+" : ""}
                        {(data.change * 100).toFixed(1)}% vs. previous period
                      </Badge>
                    )}
                  </div>
                  <ActivityChart data={data.daily} />
                  <div className="card-bottom">
                    <Info size={13} />
                    Sessions are interactions, not unique visitors.
                    <Link href={view("/engagement")}>
                      Explore engagement
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </section>
                <section className="card station-health">
                  <CardHead
                    title="Station health"
                    subtitle="Connected experiences start here."
                  />
                  <div className="health-number">
                    {online.length}
                    <span>/ {enabled.length}</span>
                    <Badge tone={online.length ? "green" : "amber"}>
                      {online.length
                        ? "Receiving heartbeats"
                        : "Awaiting heartbeats"}
                    </Badge>
                  </div>
                  <p className="small muted">
                    Stations within the heartbeat timeout
                  </p>
                  <div className="health-track">
                    {enabled.map((s) => (
                      <span
                        key={s.id}
                        className={
                          ["idle", "active"].includes(s.status) ? "online" : ""
                        }
                      />
                    ))}
                  </div>
                  <div className="health-list">
                    {data.stations.slice(0, 4).map((s, i) => (
                      <div key={s.id}>
                        <span className="station-mini">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <strong>{s.name}</strong>
                          <span>{s.location}</span>
                        </div>
                        <Badge
                          tone={
                            s.status === "offline"
                              ? "neutral"
                              : s.status === "maintenance"
                                ? "amber"
                                : "green"
                          }
                        >
                          {s.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <Link className="card-link" href={view("/stations")}>
                    Manage stations
                    <ArrowRight size={14} />
                  </Link>
                </section>
              </div>
              <div className="lower-grid">
                <section className="card">
                  <CardHead
                    title="When your audience tunes in"
                    subtitle={`Sessions by day and hour · ${data.timezone}`}
                    right={<span className="small muted">Local time</span>}
                  />
                  <Heatmap data={data.heatmap} />
                </section>
                <section className="card">
                  <CardHead
                    title="Listening duration"
                    subtitle="How long each moment lasts."
                  />
                  <DistributionChart data={data.distribution} />
                  <div className="card-bottom">
                    <span className="tiny-dot" />
                    Known durations only · {m.validSessions.toLocaleString()}{" "}
                    sessions
                  </div>
                </section>
              </div>
              <div className="bottom-grid">
                <section className="card">
                  <CardHead
                    title="Station performance"
                    subtitle="Different spaces. Different listening stories."
                    right={
                      <Link className="text-link" href={view("/stations")}>
                        View all
                        <ArrowUpRight size={13} />
                      </Link>
                    }
                  />
                  <StationTable stations={data.stations} />
                </section>
                <section className="card quality-summary">
                  <div className="quality-symbol">
                    <ShieldCheck size={24} />
                  </div>
                  <h3>
                    Trust the story.
                    <br />
                    Understand the evidence.
                  </h3>
                  <p>
                    {m.validSessions.toLocaleString()} sessions have a known
                    playback duration. {m.incomplete} need a closer look.
                  </p>
                  <div className="quality-summary-line">
                    <span>Known-duration sessions</span>
                    <strong>
                      {m.sessions
                        ? ((m.validSessions / m.sessions) * 100).toFixed(1) +
                          "%"
                        : "—"}
                    </strong>
                  </div>
                  <div className="progress">
                    <span
                      style={{
                        width: `${m.sessions ? (m.validSessions / m.sessions) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <Link href={view("/quality")}>
                    Review data quality
                    <ArrowRight size={14} />
                  </Link>
                </section>
              </div>
            </>
          )}
          {section === "stations" && (
            <>
              <div className="mini-stats">
                <span>
                  <Headphones size={17} />
                  <strong>{data.stations.length}</strong> registered stations
                </span>
                <span>
                  <Wifi size={17} />
                  <strong>{online.length}</strong> within heartbeat timeout
                </span>
                <span>
                  <Settings2 size={17} />
                  <strong>
                    {data.stations.filter((s) => s.maintenance).length}
                  </strong>{" "}
                  in maintenance
                </span>
              </div>
              <div className="station-grid">
                {data.stations.map((s, i) => (
                  <section className="card station-card" key={s.id}>
                    <div className="station-card-top">
                      <span className="station-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <Badge
                        tone={
                          s.status === "offline"
                            ? "neutral"
                            : s.status === "maintenance"
                              ? "amber"
                              : "green"
                        }
                      >
                        {s.status}
                      </Badge>
                    </div>
                    <Headphones
                      size={37}
                      strokeWidth={1.3}
                      className="station-art"
                    />
                    <h2>{s.name}</h2>
                    <p className="muted">{s.location}</p>
                    <div className="station-spec">
                      <span>Hardware</span>
                      <strong>{s.hardware}</strong>
                    </div>
                    <div className="station-spec">
                      <span>Last heartbeat</span>
                      <strong>
                        {stamp(
                          s.devices
                            .filter(
                              (d) => d.simulated === (source === "simulated"),
                            )
                            .sort(
                              (a, b) =>
                                +new Date(b.lastHeartbeat ?? 0) -
                                +new Date(a.lastHeartbeat ?? 0),
                            )[0]?.lastHeartbeat,
                        )}
                      </strong>
                    </div>
                    <div className="station-spec">
                      <span>Last event received</span>
                      <strong>{stamp(s.events[0]?.ingestedAt)}</strong>
                    </div>
                    <div className="station-metrics">
                      <div>
                        <strong>{s.metrics.sessions}</strong>
                        <span>sessions</span>
                      </div>
                      <div>
                        <strong>{duration(s.metrics.average)}</strong>
                        <span>avg. listening</span>
                      </div>
                    </div>
                    <div className="station-card-actions">
                      <Link
                        className="text-link"
                        href={view("/sessions") + "?station=" + s.id}
                      >
                        Explore sessions
                        <ArrowUpRight size={13} />
                      </Link>
                      {writable && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setStationEditor(s)}
                        >
                          Manage
                        </Button>
                      )}
                    </div>
                  </section>
                ))}
              </div>
              {!data.stations.length && (
                <Empty
                  title="Your first station starts here"
                  detail="Register a station to connect a gateway or try the simulator."
                />
              )}
              <div className="info-panel">
                <Info size={18} />
                <p>
                  <strong>Connectivity is observed, never assumed.</strong> A
                  station is online only when its device has sent a heartbeat
                  within {data.config?.heartbeatTimeoutSeconds ?? 180} seconds.
                  Historical sessions do not imply a live connection.
                </p>
              </div>
            </>
          )}
          {section === "live" && (
            <>
              <div className="live-heading">
                <Badge tone="green">Polling every 5 seconds</Badge>
                <span className="muted small">
                  Events are persisted before they appear here.
                </span>
                <Link
                  href={user.publicDemo ? view("/reports") : "/simulator"}
                  className="text-link"
                >
                  {user.publicDemo
                    ? "View sample reports"
                    : "Send a test event"}
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="kpi-grid three">
                <Kpi
                  label="Active projections"
                  value={String(
                    data.stations.filter((s) => s.status === "active").length,
                  )}
                  icon={<Activity size={17} />}
                  foot="Open playback with a current heartbeat"
                />
                <Kpi
                  label="Recent events"
                  value={data.events.length.toLocaleString()}
                  icon={<Radio size={17} />}
                  foot="Most recent 3,000 events within this period"
                />
                <Kpi
                  label="Processing flags"
                  value={String(data.flags.length)}
                  icon={<AlertTriangle size={17} />}
                  foot="Up to 200 event-level findings"
                />
              </div>
              <section className="card">
                <CardHead
                  title="Event stream"
                  subtitle="Latest device observations, newest first."
                />
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Station</th>
                        <th>Event time</th>
                        <th>Received</th>
                        <th>Source</th>
                        <th>Processing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.events.slice(0, 60).map((e) => (
                        <tr key={e.id}>
                          <td>
                            <span className="event-icon">
                              <Radio size={13} />
                            </span>
                            <strong>{e.type.replaceAll("_", " ")}</strong>
                            <code className="subtext">
                              {e.eventId.slice(0, 22)}
                            </code>
                          </td>
                          <td>
                            {
                              data.stations.find((s) => s.id === e.stationId)
                                ?.name
                            }
                          </td>
                          <td>{stamp(e.timestamp)}</td>
                          <td>{stamp(e.ingestedAt)}</td>
                          <td>
                            <Badge tone="amber">{e.sourceType}</Badge>
                          </td>
                          <td>
                            <Badge tone={e.flags.length ? "amber" : "green"}>
                              {e.flags.length ? "Flagged" : "Processed"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!data.events.length && (
                  <Empty
                    title="Waiting for a signal"
                    detail="Connect a gateway or open the simulator to send your first event."
                  />
                )}
              </section>
            </>
          )}
          {section === "sessions" && (
            <section className="card">
              <CardHead
                title="Listening sessions"
                subtitle={`${sessionTotal.toLocaleString()} interactions · 20 per page`}
                right={
                  <Button variant="outline" size="sm" onClick={exportCsv}>
                    <ArrowDownToLine size={14} />
                    Download CSV
                  </Button>
                }
              />
              <div className="table-filters">
                <select
                  aria-label="Filter station"
                  value={stationFilter}
                  onChange={(e) => {
                    setStationFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All stations</option>
                  {data.stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter session status"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="ended">Ended</option>
                  <option value="active">Active</option>
                  <option value="open">Open</option>
                </select>
                <select
                  aria-label="Sort sessions"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="desc">Newest first</option>
                  <option value="asc">Oldest first</option>
                </select>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Session / station</th>
                      <th>Started</th>
                      <th>Ended</th>
                      <th>Listening time</th>
                      <th>Confidence</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sessionRows.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.station.name}</strong>
                          <code className="subtext">{s.id.slice(0, 12)}</code>
                        </td>
                        <td>{stamp(s.startedAt)}</td>
                        <td>{stamp(s.endedAt)}</td>
                        <td className="tabular">
                          {duration(s.durationSeconds)}
                        </td>
                        <td>
                          <Badge
                            tone={
                              s.confidence === "incomplete"
                                ? "amber"
                                : s.confidence === "simulated"
                                  ? "purple"
                                  : "green"
                            }
                          >
                            {s.confidence}
                          </Badge>
                          {s.flags.length > 0 && (
                            <span className="subtext">
                              {s.flags.length} validation flag
                              {s.flags.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </td>
                        <td>{s.status}</td>
                        <td>
                          <button
                            className="icon-btn"
                            aria-label={`Inspect session ${s.id}`}
                            onClick={async () => {
                              try {
                                const r = await fetch(
                                  apiBase + "/sessions?id=" + s.id,
                                );
                                if (!r.ok)
                                  throw new Error("Unable to inspect session");
                                setInspected(await r.json());
                              } catch (e) {
                                setError(String(e));
                              }
                            }}
                          >
                            <ArrowUpRight size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!sessionRows.length && (
                <Empty
                  title="No sessions in this view"
                  detail="Try another date range, station, or data source."
                />
              )}
              <div className="pagination">
                <span>
                  {sessionTotal
                    ? `${(page - 1) * 20 + 1}–${Math.min(page * 20, sessionTotal)} of ${sessionTotal}`
                    : "0 results"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft size={14} />
                  Previous
                </Button>
                <span>Page {page}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page * 20 >= sessionTotal}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                  <ChevronRight size={14} />
                </Button>
              </div>
            </section>
          )}
          {section === "engagement" && (
            <>
              <div className="kpi-grid three">
                <Kpi
                  label="Engaged-session rate"
                  value={
                    m.engagedRate === null
                      ? "—"
                      : (m.engagedRate * 100).toFixed(1) + "%"
                  }
                  icon={<Users size={17} />}
                  foot={`At least ${m.engagedSeconds} seconds of playback`}
                />
                <Kpi
                  label="Median listening duration"
                  value={duration(m.median)}
                  icon={<Clock3 size={17} />}
                  foot="The middle of known session durations"
                />
                <Kpi
                  label="Known-duration sessions"
                  value={String(m.validSessions)}
                  icon={<CheckCheck size={17} />}
                  foot={`${m.incomplete} unknown durations excluded`}
                />
              </div>
              <section className="card">
                <CardHead
                  title="Playback over time"
                  subtitle="Daily listening minutes, with pauses excluded."
                />
                <ActivityChart data={data.daily} metric="minutes" />
              </section>
              <div className="lower-grid space-top">
                <section className="card">
                  <CardHead
                    title="Engagement by time of day"
                    subtitle="Session starts in the gallery’s reporting timezone."
                  />
                  <Heatmap data={data.heatmap} />
                </section>
                <section className="card">
                  <CardHead
                    title="Duration distribution"
                    subtitle="A closer look at sustained attention."
                  />
                  <DistributionChart data={data.distribution} />
                </section>
              </div>
              <section className="card space-top">
                <CardHead
                  title="Engagement by station"
                  subtitle="Compare interactions with known playback duration."
                />
                <StationTable stations={data.stations} />
              </section>
              <section className="card space-top">
                <CardHead
                  title="Audio-content performance"
                  subtitle="Attribution follows the track ID provided by the player."
                />
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Track identifier</th>
                        <th>Sessions</th>
                        <th>Avg. playback</th>
                        <th>Listening hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tracks.map((t) => (
                        <tr key={t.trackId}>
                          <td>
                            <strong>{t.trackId}</strong>
                          </td>
                          <td>{t.metrics.sessions}</td>
                          <td>{duration(t.metrics.average)}</td>
                          <td>{t.metrics.hours.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!data.tracks.length && (
                  <Empty
                    title="No attributed sessions"
                    detail="Include a trackId in event metadata to analyze audio content."
                  />
                )}
              </section>
              <div className="info-panel">
                <Info size={18} />
                <p>
                  Engagement is a configurable business rule, not a claim about
                  attention or enjoyment. Track-level comparisons use the
                  identifiers supplied by the gateway; validate your content
                  catalog before interpreting them.
                </p>
              </div>
            </>
          )}
          {section === "reports" && (
            <>
              <section className="report-hero">
                <div className="report-illustration">
                  <FileBarChart2 size={48} strokeWidth={1.2} />
                  <span>GALLERYPULSE</span>
                  <i />
                  <i />
                  <i />
                </div>
                <div>
                  <div className="eyebrow">FROM MEASUREMENT TO MEANING</div>
                  <h2>
                    Your next conversation,
                    <br />
                    backed by evidence.
                  </h2>
                  <p>
                    Executive summaries, station comparisons, and transparent
                    methodology.
                    <br />
                    One considered report. Ready to share.
                  </p>
                  {writable && (
                    <Button onClick={generateReport} disabled={reportBusy}>
                      <FileBarChart2 size={16} />
                      {reportBusy
                        ? "Preparing report…"
                        : "Generate period report"}
                      <ArrowRight size={15} />
                    </Button>
                  )}
                </div>
                <span className="report-hero-note">
                  <ShieldCheck size={15} />
                  Same calculations as your dashboard
                </span>
              </section>
              <section className="card">
                <CardHead
                  title="Report library"
                  subtitle="Saved snapshots. Reproducible findings."
                  right={
                    <Badge tone="green">Weekly automation configured</Badge>
                  }
                />
                {data.reports.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Report</th>
                          <th>Reporting period</th>
                          <th>Generated</th>
                          <th>Data source</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {data.reports.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <span className="report-file">
                                <FileBarChart2 size={20} />
                              </span>
                              <strong>Listening performance</strong>
                              <span className="subtext">
                                PDF · Executive report
                              </span>
                            </td>
                            <td>
                              {new Date(r.periodStart).toLocaleDateString()} –{" "}
                              {new Date(r.periodEnd).toLocaleDateString()}
                            </td>
                            <td>{stamp(r.generatedAt)}</td>
                            <td>
                              <Badge tone="amber">{r.sourceType}</Badge>
                            </td>
                            <td>
                              <a
                                className="btn btn-outline btn-sm"
                                href={apiBase + "/reports?id=" + r.id}
                              >
                                <Download size={14} />
                                Download
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="Your report library starts here"
                    detail="Generate a report for the selected period. It will remain available as a saved snapshot."
                  />
                )}
              </section>
              <div className="info-panel">
                <CalendarDays size={18} />
                <p>
                  <strong>Weekly by design.</strong> Vercel Cron prepares
                  reports on Mondays at 07:00 UTC for the previous Monday–Monday
                  UTC period. Deploy with a cron secret to enable automation.
                  Email delivery is not configured.
                </p>
              </div>
            </>
          )}
          {section === "quality" && (
            <>
              <div className="kpi-grid three">
                <Kpi
                  label="Known-duration sessions"
                  value={String(m.validSessions)}
                  icon={<ShieldCheck size={17} />}
                  foot={`${m.sessions} total session projections`}
                />
                <Kpi
                  label="Unknown durations"
                  value={String(m.incomplete)}
                  icon={<AlertTriangle size={17} />}
                  foot="Never filled with invented measurements"
                />
                <Kpi
                  label="Heartbeat minute coverage"
                  value={
                    data.coverage === null
                      ? "—"
                      : (data.coverage * 100).toFixed(2) + "%"
                  }
                  icon={<Wifi size={17} />}
                  foot={
                    data.coverageLimited
                      ? "Conservative sample · latest 3,000 events"
                      : "Observed minutes / enabled station minutes"
                  }
                />
              </div>
              <div className="info-panel">
                <ShieldCheck size={19} />
                <p>
                  <strong>Evidence you can follow.</strong> Session flags
                  describe missing or contradictory playback evidence. Event
                  flags describe delivery issues. Duplicate retries are counted
                  and never create another session.
                </p>
              </div>
              <section className="card">
                <CardHead
                  title="Verification findings"
                  subtitle="Ingestion anomalies and retries, linked to raw evidence."
                />
                <div className="table-filters">
                  <Search size={15} />
                  <input
                    aria-label="Search quality findings"
                    placeholder="Search a finding or event…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <Link className="text-link" href={view("/sessions")}>
                    Inspect session-level flags
                    <ArrowUpRight size={13} />
                  </Link>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Finding</th>
                        <th>Station</th>
                        <th>Event ID</th>
                        <th>Event time</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.flags
                        .filter((f) =>
                          (f.code + f.event.eventId + f.detail)
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                        )
                        .map((f) => (
                          <tr key={f.id}>
                            <td>
                              <Badge tone="amber">
                                {f.code.replaceAll("_", " ")}
                              </Badge>
                            </td>
                            <td>
                              {
                                data.stations.find(
                                  (s) => s.id === f.event.stationId,
                                )?.name
                              }
                            </td>
                            <td>
                              <code>{f.event.eventId.slice(0, 22)}</code>
                            </td>
                            <td>{stamp(f.event.timestamp)}</td>
                            <td className="finding-detail">{f.detail}</td>
                          </tr>
                        ))}
                      {data.events
                        .filter((e) => e.duplicateCount > 0)
                        .map((e) => (
                          <tr key={e.id}>
                            <td>
                              <Badge tone="purple">Duplicate retry</Badge>
                            </td>
                            <td>
                              {
                                data.stations.find((s) => s.id === e.stationId)
                                  ?.name
                              }
                            </td>
                            <td>
                              <code>{e.eventId.slice(0, 22)}</code>
                            </td>
                            <td>{stamp(e.timestamp)}</td>
                            <td>{e.duplicateCount} retries deduplicated</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {!data.flags.length &&
                  !data.events.some((e) => e.duplicateCount) && (
                    <Empty
                      title="No ingestion findings in this period"
                      detail="Review the session explorer for incomplete or conflicting session evidence."
                    />
                  )}
              </section>
              <div className="method-grid space-top">
                {[
                  [
                    "Confirmed",
                    "Consistent start and end evidence, with observed playback intervals.",
                  ],
                  [
                    "Simulated",
                    "Synthetic observations from the simulator or reproducible seed. Never actual visitors.",
                  ],
                  [
                    "Incomplete",
                    "Missing or conflicting evidence. Listening duration remains unknown.",
                  ],
                  [
                    "Inferred",
                    "Indirect evidence, such as presence. Never automatically counted as playback.",
                  ],
                ].map(([title, body]) => (
                  <section className="card method-card" key={title}>
                    <h3>{title} measurement</h3>
                    <p>{body}</p>
                  </section>
                ))}
              </div>
            </>
          )}
          {section === "methodology" && (
            <Methodology threshold={m.engagedSeconds} />
          )}
          {section === "simulator" && (
            <Simulator
              stations={data.stations}
              writable={writable}
              request={request}
              onUpdate={() => void refresh(true)}
              onError={setError}
            />
          )}
          {section === "settings" && (
            <>
              <section className="card settings-card">
                <CardHead
                  title="Measurement rules"
                  subtitle="Explicit definitions keep every report defensible."
                />
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    try {
                      await request("/api/config", {
                        engagedSeconds: Number(f.get("engagedSeconds")),
                        heartbeatTimeoutSeconds: Number(
                          f.get("heartbeatTimeoutSeconds"),
                        ),
                      });
                      setNotice("Measurement rules updated.");
                      await refresh(true);
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                >
                  <label>
                    Engagement threshold{" "}
                    <span>
                      Minimum observed playback seconds for an engaged session.
                    </span>
                    <input
                      name="engagedSeconds"
                      type="number"
                      min="10"
                      max="3600"
                      defaultValue={data.config?.engagedSeconds ?? 60}
                      required
                    />
                  </label>
                  <label>
                    Heartbeat timeout{" "}
                    <span>
                      Seconds after the last heartbeat before a station is
                      offline.
                    </span>
                    <input
                      name="heartbeatTimeoutSeconds"
                      type="number"
                      min="60"
                      max="3600"
                      defaultValue={data.config?.heartbeatTimeoutSeconds ?? 180}
                      required
                    />
                  </label>
                  <label>
                    Reporting timezone
                    <input value={data.timezone} disabled readOnly />
                  </label>
                  <Button disabled={user.role !== "ADMIN"}>
                    <Check size={15} />
                    Save measurement rules
                  </Button>
                </form>
              </section>
              <section className="card settings-card space-top">
                <CardHead
                  title="Simulation data"
                  subtitle="Reset synthetic measurements while preserving real device events."
                />
                <div className="settings-body">
                  <p>
                    Deletes this organization’s simulated sessions, events, and
                    reports. Measured records are preserved.
                  </p>
                  <Button
                    variant="outline"
                    disabled={!writable}
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "Delete all simulated measurements and simulated reports in this workspace?",
                        )
                      )
                        return;
                      try {
                        await request("/api/simulator", {}, "DELETE");
                        await refresh();
                        setNotice(
                          "Simulated measurements reset. Run the seed script to restore sample activity.",
                        );
                      } catch (e) {
                        setError(String(e));
                      }
                    }}
                  >
                    <RefreshCw size={15} />
                    Reset simulated data
                  </Button>
                </div>
              </section>
            </>
          )}
          <footer className="page-footer">
            <span>
              <span className="footer-mark">
                <AudioLines size={14} />
              </span>
              GalleryPulse<span className="footer-separator">/</span>Meaningful
              spaces. Measurable experiences.
            </span>
            <span>
              <ShieldCheck size={12} />
              Privacy by design
              <Link href={view("/methodology")}>
                Measurement methodology
                <ArrowUpRight size={11} />
              </Link>
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {stationEditor && (
        <Modal
          title={
            stationEditor === "new"
              ? "Register listening station"
              : `Manage ${stationEditor.name}`
          }
          onClose={() => {
            setStationEditor(null);
            setDeviceSecret("");
          }}
        >
          <form
            className="modal-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await request("/api/stations", {
                  ...(stationEditor === "new" ? {} : { id: stationEditor.id }),
                  name: f.get("name"),
                  location: f.get("location"),
                  hardware: f.get("hardware"),
                  enabled: f.get("enabled") === "on",
                  maintenance: f.get("maintenance") === "on",
                });
                setStationEditor(null);
                await refresh();
                setNotice("Station saved.");
                router.refresh();
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            <label>
              Station name
              <input
                name="name"
                required
                minLength={2}
                maxLength={80}
                defaultValue={stationEditor === "new" ? "" : stationEditor.name}
                placeholder="e.g. The Listening Room"
              />
            </label>
            <label>
              Gallery location
              <input
                name="location"
                required
                minLength={2}
                defaultValue={
                  stationEditor === "new" ? "" : stationEditor.location
                }
                placeholder="e.g. East wing · Floor 1"
              />
            </label>
            <label>
              Hardware / integration
              <input
                name="hardware"
                required
                defaultValue={
                  stationEditor === "new"
                    ? "Audio player gateway"
                    : stationEditor.hardware
                }
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={
                  stationEditor === "new" || stationEditor.enabled
                }
              />
              Station enabled
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                name="maintenance"
                defaultChecked={
                  stationEditor !== "new" && stationEditor.maintenance
                }
              />
              Maintenance mode
            </label>
            <Button type="submit">
              <Check size={15} />
              Save station
            </Button>
          </form>
          {stationEditor !== "new" && user.role === "ADMIN" && (
            <div className="device-management">
              <h3>Device credentials</h3>
              <p className="muted small">
                Provision a gateway token. It is displayed once; store it
                securely.
              </p>
              {stationEditor.devices
                .filter((d) => !d.simulated)
                .map((d) => (
                  <div className="device-row" key={d.id}>
                    <span>
                      {d.name}
                      <code className="subtext">{d.id}</code>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await request(
                            "/api/devices",
                            { deviceId: d.id },
                            "DELETE",
                          );
                          setNotice("Device credentials revoked.");
                        } catch (e) {
                          setError(String(e));
                        }
                      }}
                    >
                      Revoke
                    </Button>
                  </div>
                ))}
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const result = await request("/api/devices", {
                      stationId: stationEditor.id,
                      name: `${stationEditor.name} gateway`,
                    });
                    setDeviceSecret(JSON.stringify(result, null, 2));
                    await refresh(true);
                  } catch (e) {
                    setError(String(e));
                  }
                }}
              >
                <Plus size={14} />
                Provision gateway
              </Button>
              {deviceSecret && <pre className="secret-box">{deviceSecret}</pre>}
            </div>
          )}
        </Modal>
      )}
      {inspected && (
        <Modal title="Session evidence" onClose={() => setInspected(null)}>
          <code>{inspected.session.id}</code>
          <div className="evidence-summary">
            <strong>{duration(inspected.session.durationSeconds)}</strong>
            <Badge tone="purple">{inspected.session.confidence}</Badge>
            <span>{inspected.session.status}</span>
          </div>
          {inspected.session.flags.length > 0 && (
            <div className="alert warning">
              {inspected.session.flags.join(" · ").replaceAll("_", " ")}
            </div>
          )}
          <p className="muted small">
            Raw observations in event-time order. Paused intervals are excluded.
          </p>
          <div className="evidence-list">
            {inspected.events.map((e) => (
              <div key={e.id}>
                <span className="evidence-dot" />
                <strong>{e.type.replaceAll("_", " ")}</strong>
                <span>{stamp(e.timestamp)}</span>
                <code>{e.eventId}</code>
                <details>
                  <summary>Raw event</summary>
                  <pre>{JSON.stringify(e, null, 2)}</pre>
                </details>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
