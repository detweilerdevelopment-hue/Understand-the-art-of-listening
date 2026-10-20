"use client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
export function ActivityChart({
  data,
  metric = "sessions",
}: {
  data: { date: string; sessions: number; minutes: number }[];
  metric?: "sessions" | "minutes";
}) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 16, right: 12, left: -28, bottom: 0 }}
        >
          <defs>
            <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2d8066" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#2d8066" stopOpacity={0.015} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="date"
            tickFormatter={(v) =>
              new Date(v + "T12:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            }
            tick={{ fontSize: 10, fill: "#8b9290" }}
            axisLine={false}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#8b9290" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 12,
            }}
            labelFormatter={(v) => String(v)}
            formatter={(v) => [
              Number(v).toFixed(metric === "minutes" ? 1 : 0),
              metric === "minutes" ? "Playback minutes" : "Sessions",
            ]}
          />
          <Area
            type="monotone"
            dataKey={metric}
            stroke="#328165"
            strokeWidth={2.5}
            fill="url(#activityFill)"
            activeDot={{ r: 5, strokeWidth: 3, stroke: "white" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function DistributionChart({
  data,
}: {
  data: { name: string; sessions: number }[];
}) {
  return (
    <div className="chart small-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -28, right: 5, top: 15 }}>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "#8b9290" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#8b9290" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
            }}
            cursor={{ fill: "var(--surface)" }}
          />
          <Bar
            dataKey="sessions"
            fill="#418b72"
            radius={[5, 5, 0, 0]}
            maxBarSize={42}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
