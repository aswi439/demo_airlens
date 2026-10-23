import { useCallback, useMemo, useRef } from "react";
import { Activity, Flame, Layers, Wind } from "lucide-react";

import { PanelMessage } from "@/components/ui/panel-message";
import { Skeleton } from "@/components/ui/skeleton";
import type { Cursor } from "@/hooks/useCursor";
import type { Panel } from "@/hooks/useForecastData";
import { aqiColor } from "@/lib/aqi";
import { fixed, int, leadLabel } from "@/lib/format";
import type { ForecastResponse } from "@/lib/types";

// ── Geometry aligned identically with InversionStrip (W=1200, PAD_L=96, PAD_R=24) ──
const W = 1200;
const H = 480;
const PAD_L = 96;
const PAD_R = 24;
const CS_TOP = 24; // altitude = ALT_MAX
const CS_BOTTOM = 356; // altitude = 0 (ground)
const RIB_TOP = 380;
const RIB_BOTTOM = 442;
const ALT_MAX = 2800; // m — headroom above deep afternoon mixing (~2.4 km)
const PLOT_W = W - PAD_L - PAD_R;

const ALT_GRID = [500, 1000, 1500, 2000, 2500];
const HOUR_TICKS = [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72];

function xAt(i: number, n: number): number {
  return PAD_L + (n > 1 ? i / (n - 1) : 0) * PLOT_W;
}
function yAlt(alt: number): number {
  const f = Math.max(0, Math.min(1, alt / ALT_MAX));
  return CS_BOTTOM - f * (CS_BOTTOM - CS_TOP);
}
function yAqi(a: number): number {
  const f = Math.max(0, Math.min(1, a / 500));
  return RIB_BOTTOM - f * (RIB_BOTTOM - RIB_TOP);
}

/** Severity colour of a lid from the hour's ΔT; null below the threshold. */
function lidColor(dt: number): string | null {
  if (dt <= 0.2) return null;
  if (dt < 2) return "var(--aqi-3)";
  if (dt < 4) return "var(--aqi-4)";
  return "var(--aqi-5)";
}

interface AtmosphereProps {
  forecast: Panel<ForecastResponse>;
  cursor: Cursor;
}

export function Atmosphere({ forecast, cursor }: AtmosphereProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const hours = forecast.data?.forecast_hours ?? [];
  const n = hours.length;
  const slotW = n > 0 ? PLOT_W / n : PLOT_W;

  // ── Static layer: memoized so scrubbing never rebuilds it ──────────────────
  const staticLayer = useMemo(() => {
    if (n === 0) return null;

    const pts = hours.map((hr, i) => ({
      x: xAt(i, n),
      yc: yAlt(hr.pbl_height_m), // coupled (post-feedback) mixing top
      ym: yAlt(hr.pbl_height_met_m || hr.pbl_height_m), // unperturbed met top
      aqi: hr.aqi,
      dt: hr.inversion_delta_t,
      pm: hr.sub_indices.find((s) => s.pollutant === "PM2.5")?.concentration ?? 0,
    }));
    const first = pts[0];
    const last = pts[n - 1];

    const coupledTop = pts.map((p) => `L ${p.x.toFixed(1)},${p.yc.toFixed(1)}`).join(" ");
    const metTop = pts.map((p) => `L ${p.x.toFixed(1)},${p.ym.toFixed(1)}`).join(" ");

    // Slab = the coupled mixed layer (ground → coupled top).
    const slabPath = `M ${first.x.toFixed(1)},${CS_BOTTOM} ${coupledTop} L ${last.x.toFixed(1)},${CS_BOTTOM} Z`;
    // Residual = the layer you would have had without aerosol (ground → met top).
    const residPath = `M ${first.x.toFixed(1)},${CS_BOTTOM} ${metTop} L ${last.x.toFixed(1)},${CS_BOTTOM} Z`;
    // Suppression sliver = met top (upper) down to coupled top (lower).
    const coupledRev = pts
      .slice()
      .reverse()
      .map((p) => `L ${p.x.toFixed(1)},${p.yc.toFixed(1)}`)
      .join(" ");
    const suppPath = `M ${first.x.toFixed(1)},${first.ym.toFixed(1)} ${metTop} ${coupledRev} Z`;

    const metLine = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.ym.toFixed(1)}`).join(" ");

    return (
      <>
        {/* ── Elaborated Y-Axis Altitude Grid & Markings ── */}
        <g className="c-grid">
          {ALT_GRID.map((alt) => {
            const y = yAlt(alt);
            return (
              <g key={alt}>
                <line
                  x1={PAD_L}
                  y1={y}
                  x2={W - PAD_R}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeDasharray="3 3"
                />
                <text
                  x={PAD_L - 14}
                  y={y + 4}
                  textAnchor="end"
                  fill="var(--mist-faint)"
                  fontSize={11}
                  fontFamily="var(--mono)"
                >
                  {alt.toLocaleString()} m
                </text>
              </g>
            );
          })}

          {/* Ground level baseline */}
          <line
            x1={PAD_L}
            y1={CS_BOTTOM}
            x2={W - PAD_R}
            y2={CS_BOTTOM}
            stroke="rgba(255, 255, 255, 0.28)"
            strokeWidth={1.2}
          />
          <text
            x={PAD_L - 14}
            y={CS_BOTTOM + 4}
            textAnchor="end"
            fill="var(--mist-dim)"
            fontSize={11}
            fontWeight={600}
            fontFamily="var(--mono)"
          >
            0 m
          </text>
        </g>

        {/* Vertical Axis Title */}
        <g transform={`translate(26, ${(CS_TOP + CS_BOTTOM) / 2}) rotate(-90)`}>
          <text
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="11"
            fontWeight="600"
            letterSpacing="0.06em"
            fontFamily="var(--sans)"
          >
            MIXING DEPTH (m AGL)
          </text>
        </g>

        {/* Residual (unperturbed met-model) layer */}
        <g className="c-resid">
          <path d={residPath} fill="url(#g-resid)" />
        </g>

        {/* Haze columns density ∝ PM2.5 */}
        <g className="c-haze">
          {pts.map((p, i) => {
            const a = Math.max(0, Math.min(0.5, p.pm / 320));
            if (a < 0.02) return null;
            const warm = Math.min(1, p.pm / 340);
            const r = Math.round(150 + warm * 70);
            const g = Math.round(150 - warm * 30);
            const b = Math.round(150 - warm * 90);
            return (
              <rect
                key={i}
                x={p.x - slotW / 2}
                y={p.yc}
                width={slotW + 0.6}
                height={CS_BOTTOM - p.yc}
                fill={`rgba(${r},${g},${b},${a.toFixed(3)})`}
              />
            );
          })}
        </g>

        {/* Suppression sliver — depth removed by aerosol shading */}
        <g className="c-supp">
          <path d={suppPath} fill="url(#p-supp)" stroke="var(--aqi-3)" strokeOpacity="0.45" strokeWidth="0.85" />
        </g>

        {/* Coupled mixed-layer body */}
        <g className="c-slab">
          <path d={slabPath} fill="url(#g-slab)" />
        </g>

        {/* Met-model unperturbed depth line (dashed) */}
        <g className="c-met">
          <path d={metLine} fill="none" stroke="var(--mist-dim)" strokeWidth="1.2" strokeDasharray="5 4" />
        </g>

        {/* Inversion caps where ΔT > 0 */}
        <g className="c-inv">
          {pts.map((p, i) => {
            const c = lidColor(p.dt);
            if (!c) return null;
            return (
              <line
                key={i}
                x1={p.x - slotW / 2}
                y1={p.yc}
                x2={p.x + slotW / 2}
                y2={p.yc}
                stroke={c}
                strokeWidth="2.8"
                strokeLinecap="butt"
              />
            );
          })}
        </g>

        {/* ── Surface AQI Ribbon ── */}
        <g className="c-ribbon">
          {pts.map((p, i) => {
            const y = yAqi(p.aqi);
            const bw = Math.max(1, slotW - 1);
            return (
              <rect
                key={i}
                x={p.x - bw / 2}
                y={y}
                width={bw}
                height={RIB_BOTTOM - y}
                fill={aqiColor(p.aqi)}
                opacity={0.92}
              />
            );
          })}
          <line x1={PAD_L} y1={RIB_BOTTOM} x2={W - PAD_R} y2={RIB_BOTTOM} stroke="rgba(255, 255, 255, 0.25)" />
        </g>

        {/* AQI ribbon labels */}
        <g className="c-ribbon-labels">
          <text
            x={PAD_L - 14}
            y={RIB_TOP + 4}
            textAnchor="end"
            fill="var(--mist-dim)"
            fontSize={10}
            fontFamily="var(--mono)"
          >
            500
          </text>
          <text
            x={PAD_L - 14}
            y={RIB_BOTTOM + 4}
            textAnchor="end"
            fill="var(--mist-dim)"
            fontSize={10}
            fontFamily="var(--mono)"
          >
            0 AQI
          </text>
        </g>

        {/* Vertical Title for AQI Ribbon */}
        <g transform={`translate(26, ${(RIB_TOP + RIB_BOTTOM) / 2}) rotate(-90)`}>
          <text
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="9"
            fontWeight="600"
            letterSpacing="0.06em"
            fontFamily="var(--sans)"
          >
            SURFACE AQI
          </text>
        </g>

        {/* ── X-Axis Hour Labels ── */}
        <g className="c-axis">
          {HOUR_TICKS.map((hh) => {
            const idx = Math.min(n - 1, hh);
            const x = xAt(idx, n);
            const isMajor = hh % 12 === 0;
            return (
              <text
                key={hh}
                x={x}
                y={H - 12}
                textAnchor={hh === 0 ? "start" : hh >= 72 ? "end" : "middle"}
                fill={isMajor ? "#f1f5f9" : "var(--mist-dim)"}
                fontSize={isMajor ? 12 : 11}
                fontWeight={isMajor ? 600 : 400}
                fontFamily="var(--mono)"
              >
                {hh === 0 ? "Now" : `+${hh}h`}
              </text>
            );
          })}
        </g>
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecast.data, n, slotW]);

  // ── Cursor layer: re-renders every scrub tick ──────────────────────────────
  const curX = xAt(cursor.cursor, n);
  const curPt = hours[cursor.cursor] ?? null;
  const curYc = curPt ? yAlt(curPt.pbl_height_m) : CS_TOP;
  const aqiValNow = curPt ? curPt.aqi : 0;
  const leftPct = (curX / W) * 100;
  const topPct = (curYc / H) * 100;

  const ariaText = curPt
    ? `hour ${leadLabel(cursor.cursor)}, AQI ${int(curPt.aqi)}, ${curPt.category}`
    : `hour ${cursor.cursor}`;

  // ── Pointer scrubbing ──────────────────────────────────────────────────────
  const scrubTo = useCallback(
    (clientX: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) return;
      const vbX = ((clientX - rect.left) / rect.width) * W;
      const t = (vbX - PAD_L) / PLOT_W;
      cursor.setFromRatio(t);
    },
    [cursor],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      scrubTo(e.clientX);
    },
    [scrubTo],
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) scrubTo(e.clientX);
    },
    [scrubTo],
  );

  const loading = forecast.status === "loading" && n === 0;
  const errored = forecast.status === "error" && n === 0;

  return (
    <section className="section" aria-labelledby="atmos-h" style={{ border: "none", padding: "0.5rem 0", background: "transparent" }}>
      {/* Realism Shiny Border Container with Deep Black Background and Correct Outline */}
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
            padding: "1.5rem 1.75rem 1.25rem",
            background: "#080a0f",
            borderRadius: "18px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 16px 36px -8px rgba(0, 0, 0, 0.6)",
            overflow: "hidden",
          }}
        >
          <div className="realism-inner-glow" />

          {/* Module 01 Header */}
          <div className="ad-section-head" style={{ marginBottom: "0.85rem" }}>
            <div>
              <p className="ad-module-badge">MODULE 01 · BOUNDARY LAYER DYNAMICS</p>
              <h2 className="ad-module-title" id="atmos-h" style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0 0 0.35rem" }}>
                Planetary Boundary Layer (PBL) &amp; Trapping Capacity
              </h2>
              <p className="ad-module-subtitle" style={{ fontSize: "0.875rem", color: "#94a3b8", margin: 0, maxWidth: "85ch" }}>
                Ground-level emissions dilute through this vertical layer; shallower boundary heights compress emissions into smaller air volumes, accelerating surface concentration spikes.
              </p>
            </div>
          </div>

          {/* Legend Pills */}
          <div className="ad-legend" style={{ margin: "0.4rem 0 1rem", paddingBottom: "0.6rem" }}>
            <span className="ad-legend-item">
              <span className="ad-legend-dot" style={{ background: "#6E8598" }} />
              <span>Mixed Layer (PBL Depth)</span>
            </span>
            <span className="ad-legend-item">
              <span className="ad-legend-dot" style={{ background: "#E8B21A" }} />
              <span>Suppressed by Aerosol Shading</span>
            </span>
            <span className="ad-legend-item">
              <span className="ad-legend-dot" style={{ border: "1.5px dashed #94a3b8", background: "transparent" }} />
              <span>Unperturbed Met Baseline</span>
            </span>
            <span className="ad-legend-item">
              <span className="ad-legend-dot" style={{ background: "#f43f5e" }} />
              <span>Thermal Inversion Ceiling (ΔT &gt; 0)</span>
            </span>
            <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#64748b", fontFamily: "var(--sans)", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
              Tip: Drag cursor or use ← → arrow keys
            </span>
          </div>

          {errored ? (
            <PanelMessage tone="warn">
              <b>Forecast unavailable.</b> The coupled column could not be solved and no sample could be
              loaded.
            </PanelMessage>
          ) : loading ? (
            <Skeleton style={{ width: "100%", aspectRatio: `${W} / ${H}`, borderRadius: 18 }} />
          ) : (
            <>
              <div className="atmos__stage" id="stage" style={{ position: "relative" }}>
              <svg
                ref={svgRef}
                className="chart"
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="xMidYMid meet"
                role="slider"
                tabIndex={0}
                aria-labelledby="atmos-h"
                aria-valuemin={0}
                aria-valuemax={Math.max(0, n - 1)}
                aria-valuenow={cursor.cursor}
                aria-valuetext={ariaText}
                onKeyDown={cursor.onKeyDown}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                style={{ touchAction: "pan-y", width: "100%", height: "auto", display: "block" }}
              >
                <defs>
                  <linearGradient id="g-slab" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#6E8598" stopOpacity="0.55" />
                    <stop offset="55%" stopColor="#6E8598" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#6E8598" stopOpacity="0.05" />
                  </linearGradient>
                  <linearGradient id="g-resid" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#4A5C6D" stopOpacity="0.20" />
                    <stop offset="100%" stopColor="#4A5C6D" stopOpacity="0" />
                  </linearGradient>
                  <pattern id="p-supp" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="0" y2="7" stroke="#E8B21A" strokeWidth="1.5" strokeOpacity="0.55" />
                  </pattern>
                </defs>

                {staticLayer}

                {/* cursor */}
                <g className="c-cursor">
                  <line x1={curX} y1={CS_TOP} x2={curX} y2={RIB_BOTTOM} stroke="#ffffff" strokeWidth={1.8} strokeDasharray="5 3" />
                  <circle cx={curX} cy={curYc} r={5} fill="#38bdf8" stroke="#ffffff" strokeWidth={2} />
                  <circle cx={curX} cy={yAqi(aqiValNow)} r={4} fill="#ffffff" stroke={aqiColor(aqiValNow)} strokeWidth={2} />
                </g>
              </svg>

              <div
                className="atmos__tip"
                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                aria-hidden="true"
              >
                <b>{curPt ? int(curPt.aqi) : "—"}</b> <span>{leadLabel(cursor.cursor)}</span>
              </div>
            </div>

            {/* Active Reading Bar */}
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
                <span>Planetary Boundary Layer Height vs. Surface Dilution Capacity</span>
              </span>
              <span style={{ fontWeight: 600 }}>
                {curPt ? (
                  <span>
                    Selected (+{cursor.cursor}h): Mixing Depth {int(curPt.pbl_height_m)} m · AQI {int(curPt.aqi)} ({curPt.category})
                  </span>
                ) : ""}
              </span>
            </div>

            {/* 4 Metric Readouts embedded directly inside the chart container */}
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
              {/* Card 1: Boundary Layer Mixing Top */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.07)",
                  borderRadius: "12px",
                  padding: "0.85rem 1rem",
                }}
              >
                <div className="ad-stat-label">
                  <Layers size={14} style={{ color: "#38bdf8" }} />
                  <span>Boundary Layer Depth (PBL)</span>
                </div>
                <div className="ad-stat-value" style={{ color: "#38bdf8" }}>
                  {curPt ? `${int(curPt.pbl_height_m)} m` : "—"}
                </div>
                <div className="ad-stat-sub">
                  {curPt ? (curPt.pbl_height_m < 500 ? "Shallow · Strong Trapping" : curPt.pbl_height_m < 1200 ? "Moderate Mixing" : "Deep Convective Dilution") : "—"}
                </div>
              </div>

              {/* Card 2: Aerosol Shading Compression */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.07)",
                  borderRadius: "12px",
                  padding: "0.85rem 1rem",
                }}
              >
                <div className="ad-stat-label">
                  <Wind size={14} style={{ color: "#f59e0b" }} />
                  <span>Aerosol Shading Suppression</span>
                </div>
                <div className="ad-stat-value" style={{ color: "#f59e0b" }}>
                  {curPt ? `-${int((curPt.pbl_height_met_m || curPt.pbl_height_m) - curPt.pbl_height_m)} m` : "—"}
                </div>
                <div className="ad-stat-sub">
                  {curPt ? `${fixed(curPt.pbl_suppression_pct, 1)}% depth lost to sunlight dimming` : "—"}
                </div>
              </div>

              {/* Card 3: Met-Model Baseline */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.07)",
                  borderRadius: "12px",
                  padding: "0.85rem 1rem",
                }}
              >
                <div className="ad-stat-label">
                  <Activity size={14} style={{ color: "#94a3b8" }} />
                  <span>Unperturbed Met Baseline</span>
                </div>
                <div className="ad-stat-value">
                  {curPt ? `${int(curPt.pbl_height_met_m || curPt.pbl_height_m)} m` : "—"}
                </div>
                <div className="ad-stat-sub">
                  Theoretical depth without smog feedback
                </div>
              </div>

              {/* Card 4: Surface AQI & Concentration */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.07)",
                  borderRadius: "12px",
                  padding: "0.85rem 1rem",
                }}
              >
                <div className="ad-stat-label">
                  <Flame size={14} style={{ color: curPt ? aqiColor(curPt.aqi) : "#38bdf8" }} />
                  <span>Surface Air Quality (AQI)</span>
                </div>
                <div className="ad-stat-value" style={{ color: curPt ? aqiColor(curPt.aqi) : "#38bdf8" }}>
                  {curPt ? int(curPt.aqi) : "—"}
                </div>
                <div className="ad-stat-sub">
                  {curPt ? `${curPt.category} · PM2.5 ${int(curPt.sub_indices.find((s) => s.pollutant === "PM2.5")?.concentration ?? 0)} µg/m³` : "—"}
                </div>
              </div>
            </div>
          </>
        )}
        </div>
      </article>
    </section>
  );
}

export default Atmosphere;
