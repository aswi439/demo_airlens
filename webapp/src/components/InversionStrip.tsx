import { useMemo } from "react";
import {
  Activity,
  Clock,
  ShieldAlert,
  Thermometer,
} from "lucide-react";
import type { Panel } from "@/hooks/useForecastData";
import { signed } from "@/lib/format";
import type { InversionStatus } from "@/lib/types";
import { PanelMessage } from "@/components/ui/panel-message";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/i18n";

interface InversionStripProps {
  inversion: Panel<InversionStatus[]>;
  cursor: number;
}

// ── Broad, tall, elaborated geometry for high readability and detail ────────
const W = 1200;
const H = 450;
const PAD_L = 96; // Generous room for elaborated Y-axis labels and axis title
const PAD_R = 24;
const PAD_T = 32;
const PAD_B = 44;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const HOUR_TICKS = [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72];

export function InversionStrip({ inversion, cursor }: InversionStripProps) {
  const { t } = useTranslation();
  const series = inversion.data ?? [];
  const idx = Math.max(0, Math.min(series.length - 1, cursor));
  const cur = series[idx] ?? null;
  const lidHours = series.filter((s) => s.inversion_present).length;

  // Elaborated Y domain: ensures clean even integer steps with 0.0 °C always centered
  const { yMin, yMax, yTicks } = useMemo(() => {
    if (series.length === 0) {
      return { yMin: -6, yMax: 4, yTicks: [-6, -4, -2, 0, 2, 4] };
    }
    const vals = series.map((s) => s.delta_t_celsius);
    const minVal = Math.min(0, ...vals);
    const maxVal = Math.max(1, ...vals);

    // Floor and ceil to even numbers with at least 1-2 degrees headroom
    const lo = Math.floor((minVal - 1.2) / 2) * 2;
    const hi = Math.ceil((maxVal + 1.2) / 2) * 2;

    const list: number[] = [];
    for (let v = lo; v <= hi; v += 2) {
      list.push(v);
    }
    return { yMin: lo, yMax: hi, yTicks: list };
  }, [series]);

  const xAt = (i: number) =>
    PAD_L + (series.length > 1 ? (i / (series.length - 1)) * PLOT_W : PLOT_W / 2);

  const yAt = (dt: number) =>
    PAD_T + (1 - (dt - yMin) / (yMax - yMin)) * PLOT_H;

  const staticLayer = useMemo(() => {
    if (series.length === 0) return null;

    const pts = series.map((s, i) => ({ x: xAt(i), y: yAt(s.delta_t_celsius), s }));
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const zeroY = yAt(0);

    const first = pts[0];
    const last = pts[pts.length - 1];
    const areaZeroPath = `M ${first.x.toFixed(1)},${zeroY.toFixed(1)} ${line} L ${last.x.toFixed(1)},${zeroY.toFixed(1)} Z`;

    const zeroRatio = Math.max(0, Math.min(1, (zeroY - PAD_T) / PLOT_H));

    return (
      <>
        <defs>
          {/* Shaded zone gradient for upper thermal inversion */}
          <linearGradient id="inv-zone-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
          </linearGradient>

          {/* Shaded zone gradient for lower normal lapse */}
          <linearGradient id="vent-zone-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.14" />
          </linearGradient>

          {/* Two-tone fill between trace and 0 °C line */}
          <linearGradient id="trace-fill-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
            <stop offset={`${(zeroRatio * 100).toFixed(1)}%`} stopColor="#f59e0b" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.22" />
          </linearGradient>

          {/* Subtle glow filter for the main curve */}
          <filter id="inv-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#38bdf8" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* ── Background Shaded Atmospheric Stability Zones ── */}
        {/* Upper Zone: Inversion / Trapping */}
        <rect
          x={PAD_L}
          y={PAD_T}
          width={PLOT_W}
          height={Math.max(0, zeroY - PAD_T)}
          fill="url(#inv-zone-grad)"
        />
        <text
          x={W - PAD_R - 12}
          y={PAD_T + 18}
          textAnchor="end"
          fill="#f87171"
          fontSize="11"
          fontWeight="700"
          letterSpacing="0.08em"
        >
          ▲ THERMAL INVERSION LAYER · WARM AIR ALOFT (EMISSIONS TRAPPED)
        </text>

        {/* Lower Zone: Normal Lapse / Ventilated */}
        <rect
          x={PAD_L}
          y={zeroY}
          width={PLOT_W}
          height={Math.max(0, H - PAD_B - zeroY)}
          fill="url(#vent-zone-grad)"
        />
        <text
          x={W - PAD_R - 12}
          y={H - PAD_B - 12}
          textAnchor="end"
          fill="#38bdf8"
          fontSize="11"
          fontWeight="700"
          letterSpacing="0.08em"
        >
          ▼ NORMAL LAPSE LAYER · COOL AIR ALOFT (BUOYANT DISPERSION)
        </text>

        {/* ── Elaborated Horizontal Y-Axis Gridlines & Labels ── */}
        {yTicks.map((dtv) => {
          const y = yAt(dtv);
          const isZero = dtv === 0;
          return (
            <g key={dtv} className="inv-grid">
              <line
                x1={PAD_L}
                y1={y}
                x2={W - PAD_R}
                y2={y}
                stroke={isZero ? "#f43f5e" : "rgba(255, 255, 255, 0.08)"}
                strokeWidth={isZero ? 2 : 1}
                strokeDasharray={isZero ? "8 5" : "3 3"}
              />
              <text
                x={PAD_L - 14}
                y={y + 4}
                textAnchor="end"
                fill={isZero ? "#ffffff" : dtv > 0 ? "#f87171" : "#38bdf8"}
                fontSize={isZero ? 13 : 11}
                fontWeight={isZero ? 700 : 500}
                fontFamily="var(--mono)"
              >
                {dtv > 0 ? `+${dtv}.0 °C` : `${dtv}.0 °C`}
              </text>
            </g>
          );
        })}

        {/* 0.0 °C Neutral Threshold Tag */}
        <g transform={`translate(${PAD_L + 12}, ${zeroY - 13})`}>
          <rect
            width={245}
            height={24}
            rx={5}
            fill="rgba(244, 63, 94, 0.2)"
            stroke="rgba(244, 63, 94, 0.6)"
            strokeWidth={1}
          />
          <text x={12} y={16} fill="#fecdd3" fontSize={11} fontWeight={600} letterSpacing="0.04em">
            0.0 °C · Inversion Threshold (Thermal Lid)
          </text>
        </g>

        {/* Vertical Y-Axis Title */}
        <g transform={`translate(26, ${PAD_T + PLOT_H / 2}) rotate(-90)`}>
          <text
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="11"
            fontWeight="600"
            letterSpacing="0.06em"
            fontFamily="var(--sans)"
          >
            TEMPERATURE DIFFERENTIAL ΔT (°C)
          </text>
        </g>

        {/* ── Elaborated X-Axis Ticks & Hours ── */}
        {HOUR_TICKS.map((hh) => {
          const i = Math.min(series.length - 1, hh);
          const isMajor = hh % 12 === 0;
          return (
            <g key={hh}>
              <line
                x1={xAt(i)}
                y1={H - PAD_B}
                x2={xAt(i)}
                y2={H - PAD_B + (isMajor ? 7 : 4)}
                stroke="rgba(255, 255, 255, 0.25)"
                strokeWidth={isMajor ? 1.5 : 1}
              />
              <text
                key={hh}
                x={xAt(i)}
                y={H - 12}
                textAnchor={hh === 0 ? "start" : hh >= 72 ? "end" : "middle"}
                fill={isMajor ? "#f1f5f9" : "var(--mist-dim)"}
                fontSize={isMajor ? 12 : 11}
                fontWeight={isMajor ? 600 : 400}
                fontFamily="var(--mono)"
              >
                {hh === 0 ? "Now" : `+${hh}h`}
              </text>
            </g>
          );
        })}

        {/* Area fill between curve and zero line */}
        <path d={areaZeroPath} fill="url(#trace-fill-grad)" />

        {/* ΔT trace curve */}
        <path
          d={line}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={3.2}
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#inv-glow)"
        />

        {/* Severity data markers */}
        {pts.map((p, i) => {
          const isLid = p.s.inversion_present;
          const fill =
            p.s.severity === "Strong"
              ? "#ef4444"
              : p.s.severity === "Moderate"
                ? "#f97316"
                : p.s.severity === "Weak"
                  ? "#eab308"
                  : "#0284c7";
          const stroke = isLid ? "#ffffff" : "#38bdf8";
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={isLid ? 5 : 3.5}
              fill={fill}
              stroke={stroke}
              strokeWidth={isLid ? 1.8 : 1.2}
            />
          );
        })}
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, yMin, yMax, yTicks]);

  const curX = series.length ? xAt(idx) : PAD_L;
  const curY = cur ? yAt(cur.delta_t_celsius) : PAD_T;

  const yLabel = (dt: number): string => {
    if (dt <= 0.2) return t("atmosphere.noLidVentilated");
    if (dt < 2) return t("atmosphere.weakLid");
    if (dt < 4) return t("atmosphere.moderateLid");
    return t("atmosphere.strongLid");
  };

  const isLidActive = cur?.inversion_present ?? false;

  return (
    <section className="section section--inv" aria-labelledby="inv-h" style={{ border: "none", padding: "0.5rem 0" }}>
      {/* Header with Title and Active Inversion Status Badge */}
      <div className="ad-section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <p className="ad-module-badge">MODULE 02 · THERMAL INVERSION WATCH</p>
          <h2 className="ad-module-title" id="inv-h">
            Vertical Temperature Differential (ΔT: 925–1000 hPa)
          </h2>
          <p className="ad-module-subtitle">
            Temperature differential between 925 and 1000 hPa; when positive, warm air aloft creates a thermal ceiling trapping pollutants against the ground.
          </p>
        </div>

        <div style={{ marginTop: "0.25rem" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              padding: "0.35rem 0.85rem",
              borderRadius: "9999px",
              fontSize: "12px",
              fontFamily: "var(--mono)",
              background: isLidActive ? "rgba(239, 68, 68, 0.15)" : "rgba(56, 189, 248, 0.12)",
              color: isLidActive ? "var(--aqi-5)" : "#38bdf8",
              border: `1px solid ${isLidActive ? "rgba(239, 68, 68, 0.35)" : "rgba(56, 189, 248, 0.28)"}`,
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: isLidActive ? "var(--aqi-5)" : "#38bdf8",
              }}
            />
            {isLidActive ? t("atmosphere.inversionActive") : t("atmosphere.inversionNormal")}
          </span>
        </div>
      </div>

      {inversion.status === "error" ? (
        <PanelMessage tone="warn" style={{ marginTop: "2rem" }}>
          <b>Meteorology feed unavailable.</b> The inversion series could not be retrieved from the
          upstream met provider.
        </PanelMessage>
      ) : inversion.status === "loading" ? (
        <Skeleton style={{ width: "100%", aspectRatio: `${W} / ${H}`, marginTop: "1.5rem", borderRadius: 18 }} />
      ) : series.length === 0 ? (
        <PanelMessage tone="warn" style={{ marginTop: "2rem" }}>
          <b>No inversion data.</b> The met provider returned an empty ΔT series.
        </PanelMessage>
      ) : (
        <>
          {/* Realism Shiny Border Container matching Module 03 (CouplingLoop) */}
          <article className="realism-box" style={{ width: "100%", margin: "0.8rem 0" }}>
            <div className="realism-topglow" />
            <div
              className="realism-blob"
              style={{
                background: "radial-gradient(circle 120px at 0% 100%, #38bdf8, rgba(56, 189, 248, 0.4), transparent)",
                boxShadow: "-4px 9px 40px rgba(56, 189, 248, 0.4)",
              }}
            />
            <div
              className="realism-inner"
              style={{
                padding: "1.25rem 1.25rem 0.85rem",
                background: "radial-gradient(circle 800px at 80% -50%, #1e242c, #0b0d10)",
                borderRadius: "18px",
                overflow: "hidden",
              }}
            >
              <div className="realism-inner-glow" />
              <div className="inv__chart" style={{ border: "none", background: "transparent", margin: 0, padding: 0 }}>
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  preserveAspectRatio="xMidYMid meet"
                  style={{ display: "block", width: "100%", height: "auto" }}
                >
                  {staticLayer}
                  {/* Cursor: vertical line at the scrubbed hour + marker on the trace */}
                  <line
                    x1={curX}
                    y1={PAD_T}
                    x2={curX}
                    y2={H - PAD_B}
                    stroke="#ffffff"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    strokeOpacity={0.9}
                  />
                  <circle cx={curX} cy={curY} r={8} fill="rgba(56, 189, 248, 0.35)" />
                  <circle cx={curX} cy={curY} r={5.5} fill="#38bdf8" stroke="#ffffff" strokeWidth={2.5} />
                </svg>
              </div>

              {/* Elaborated Axis Note & Active Reading Bar */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.5rem 1rem",
                  marginTop: "0.85rem",
                  padding: "0.5rem 0.85rem",
                  background: "rgba(15, 23, 42, 0.5)",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  fontSize: "12px",
                  color: "#cbd5e1",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#38bdf8" }} />
                  <span>Timeline: 72-Hour Continuous Boundary Layer Stability Horizon</span>
                </span>
                <span style={{ fontWeight: 600 }}>
                  {cur ? (
                    <span style={{ color: cur.delta_t_celsius > 0 ? "#f87171" : "#38bdf8" }}>
                      Selected (+{idx}h): {signed(cur.delta_t_celsius, 1)} °C · {yLabel(cur.delta_t_celsius)} ({cur.severity === "None" ? "Normal Lapse" : `${cur.severity} Inversion`})
                    </span>
                  ) : ""}
                </span>
              </div>

              {/* 4 Inversion Metric Readout Cards embedded directly inside the chart section */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "0.75rem",
                  marginTop: "0.85rem",
                  paddingTop: "0.85rem",
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.07)",
                    borderRadius: "12px",
                    padding: "0.85rem 1rem",
                  }}
                >
                  <div className="ad-stat-label">
                    <Thermometer
                      size={14}
                      style={{ color: cur?.delta_t_celsius && cur.delta_t_celsius > 0 ? "#f43f5e" : "#38bdf8" }}
                    />
                    <span>Vertical ΔT (925–1000 hPa)</span>
                  </div>
                  <div
                    className="ad-stat-value"
                    style={{ color: cur?.delta_t_celsius && cur.delta_t_celsius > 0 ? "#f43f5e" : "#38bdf8" }}
                  >
                    {cur ? `${signed(cur.delta_t_celsius, 1)} °C` : "—"}
                  </div>
                  <div className="ad-stat-sub">
                    {cur ? yLabel(cur.delta_t_celsius) : "—"}
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.07)",
                    borderRadius: "12px",
                    padding: "0.85rem 1rem",
                  }}
                >
                  <div className="ad-stat-label">
                    <ShieldAlert size={14} style={{ color: cur?.severity === "None" ? "#10b981" : "#f97316" }} />
                    <span>Atmospheric Severity</span>
                  </div>
                  <div className="ad-stat-value">
                    {cur ? (cur.severity === "None" ? "None (Normal)" : `${cur.severity} Lid`) : "—"}
                  </div>
                  <div className="ad-stat-sub">
                    {cur?.severity === "None" ? "Normal convection unhindered" : "Vertical thermal barrier active"}
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.07)",
                    borderRadius: "12px",
                    padding: "0.85rem 1rem",
                  }}
                >
                  <div className="ad-stat-label">
                    <Activity size={14} style={{ color: "#38bdf8" }} />
                    <span>Environmental Lapse Rate</span>
                  </div>
                  <div className="ad-stat-value">
                    {cur ? `${signed(cur.lapse_rate_k_per_km, 1)} K/km` : "—"}
                  </div>
                  <div className="ad-stat-sub">
                    Rate of temperature change per km altitude
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.07)",
                    borderRadius: "12px",
                    padding: "0.85rem 1rem",
                  }}
                >
                  <div className="ad-stat-label">
                    <Clock size={14} style={{ color: lidHours > 0 ? "#f43f5e" : "#10b981" }} />
                    <span>Trapped Inversion Duration</span>
                  </div>
                  <div className="ad-stat-value">
                    {series.length ? `${lidHours} of ${series.length} hrs` : "—"}
                  </div>
                  <div className="ad-stat-sub">
                    {series.length ? `${((lidHours / series.length) * 100).toFixed(0)}% of 72h window under lid` : "—"}
                  </div>
                </div>
              </div>
            </div>
          </article>
        </>
      )}
    </section>
  );
}

export default InversionStrip;
