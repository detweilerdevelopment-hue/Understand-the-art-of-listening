"use client";
import { useRef, useEffect } from "react";
import type { Analytics } from "@/lib/analytics";
import { duration } from "@/lib/utils";
import {
  ArrowUpRight,
  AudioLines,
  Check,
  X,
  ShieldCheck,
  Info,
} from "lucide-react";
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty">
      <AudioLines size={30} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
export function Kpi({
  label,
  value,
  unit,
  icon,
  foot,
  secondary,
  change,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  foot: string;
  secondary?: string;
  change?: number | null;
}) {
  return (
    <section className="card kpi">
      <div className="kpi-label">
        {label}
        <span>{icon}</span>
      </div>
      <div className="kpi-value">
        {value}
        <span>{unit}</span>
      </div>
      <div className="kpi-foot">
        {change !== undefined && change !== null ? (
          <>
            <span className="change">
              <ArrowUpRight size={12} />
              {(change * 100).toFixed(1)}%
            </span>
            <span>vs. previous period</span>
          </>
        ) : (
          <>
            <span className="small-check">
              <Check size={10} />
            </span>
            {foot}
          </>
        )}
      </div>
      {secondary && <span className="kpi-secondary">{secondary}</span>}
    </section>
  );
}
export function CardHead({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="card-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
export function Heatmap({ data }: { data: number[][] }) {
  const max = Math.max(1, ...data.flat());
  return (
    <div className="heatmap">
      <div className="heatmap-times">
        <span />
        {[8, 10, 12, 14, 16, 18].map((h) => (
          <span key={h}>
            {h > 12 ? h - 12 : h}
            {h >= 12 ? "p" : "a"}
          </span>
        ))}
      </div>
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => (
        <div className="heatmap-row" key={day}>
          <span>{day}</span>
          {Array.from({ length: 12 }, (_, j) => {
            const v = data[i]?.[j + 8] ?? 0;
            return (
              <div
                key={j}
                title={`${day}, ${j + 8}:00 · ${v} sessions`}
                className={
                  "heat-cell intensity-" +
                  (v ? Math.max(1, Math.ceil((v / max) * 4)) : 0)
                }
              />
            );
          })}
        </div>
      ))}
      <div className="heatmap-key">
        <span>Fewer sessions</span>
        {[0, 1, 2, 3, 4].map((i) => (
          <i key={i} className={"heat-cell intensity-" + i} />
        ))}
        <span>More sessions</span>
      </div>
    </div>
  );
}
export function StationTable({
  stations,
}: {
  stations: Analytics["stations"];
}) {
  return (
    <div className="table-scroll">
      <table className="station-table">
        <thead>
          <tr>
            <th>Listening station</th>
            <th>Sessions</th>
            <th>Avg. duration</th>
            <th>Engaged</th>
          </tr>
        </thead>
        <tbody>
          {stations.map((s, i) => (
            <tr key={s.id}>
              <td>
                <span className="station-mini">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <strong>{s.name}</strong>
                <span className="subtext station-location">{s.location}</span>
              </td>
              <td className="tabular">{s.metrics.sessions.toLocaleString()}</td>
              <td className="tabular">{duration(s.metrics.average)}</td>
              <td>
                <div className="engaged-cell">
                  <span>
                    {s.metrics.engagedRate === null
                      ? "—"
                      : Math.round(s.metrics.engagedRate * 100) + "%"}
                  </span>
                  <div className="mini-progress">
                    <i
                      style={{
                        width: `${(s.metrics.engagedRate ?? 0) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          'button,a,input,select,textarea,summary,[tabindex="0"]',
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Methodology({ threshold }: { threshold: number }) {
  const blocks = [
    [
      "01",
      "What makes a session?",
      "A device-scoped session key groups playback observations at one station. The same key on a different device is a separate session. Presence or motion alone does not create a listening session.",
    ],
    [
      "02",
      "Duration follows playback.",
      "Listening time is the sum of intervals from playback start or resume to pause or stop. Paused time is excluded. A session end also closes an active playback interval.",
    ],
    [
      "03",
      "Engagement is an explicit rule.",
      `An engaged session has at least ${threshold} seconds of observed playback. The rate uses only known-duration sessions as its denominator. The administrator can change this threshold.`,
    ],
    [
      "04",
      "Unknown stays unknown.",
      "Missing starts, missing ends, contradictory transitions, and wall-clock durations over four hours produce unknown duration. No timeout is substituted as listening time.",
    ],
    [
      "05",
      "Retries don’t inflate your numbers.",
      "Each device and event ID is unique. Identical retries increment a duplicate counter. Late events rebuild the session in timestamp order. Conflicting reuse of an event ID is rejected.",
    ],
    [
      "06",
      "Connectivity needs evidence.",
      "Heartbeats determine connectivity. A device is offline after the configured timeout. Coverage counts observed heartbeat minutes over enabled station minutes, across the full reporting period.",
    ],
    [
      "07",
      "Observation is not attention.",
      "Playback confirms that software emitted a playback signal. It does not prove headphones were worn, sound was audible, or a visitor paid attention. Presence is separate indirect evidence.",
    ],
    [
      "08",
      "Every metric has boundaries.",
      "Totals count sessions starting in the reporting period. Hours sum known durations; average and median exclude unknowns. Comparisons require at least 20 sessions in the prior period. Sessions are not unique visitors.",
    ],
  ];
  return (
    <>
      <section className="method-intro">
        <ShieldCheck size={35} strokeWidth={1.4} />
        <div>
          <h2>Clear definitions. Credible conversations.</h2>
          <p>
            Measurement should make your understanding better, not your claims
            bigger. These are the rules behind every number in GalleryPulse.
          </p>
        </div>
        <Badge tone="green">Methodology v1.0</Badge>
      </section>
      <div className="method-grid">
        {blocks.map(([n, title, body]) => (
          <section className="card method-card" key={n}>
            <span className="method-number">{n}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </section>
        ))}
      </div>
      <div className="info-panel">
        <Info size={19} />
        <p>
          <strong>A note on data classification.</strong> Measured, inferred,
          and simulated events remain separated. The demonstration dataset is
          reproducible and synthetic. No accuracy claim is made until physical
          installation and calibration have been independently validated.
        </p>
      </div>
    </>
  );
}
