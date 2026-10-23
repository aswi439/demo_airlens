import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  CloudRain,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { Atmosphere } from "@/components/Atmosphere";
import { CouplingLoop } from "@/components/CouplingLoop";
import { InversionStrip } from "@/components/InversionStrip";
import type { Cursor } from "@/hooks/useCursor";
import type { Panel } from "@/hooks/useForecastData";
import { useTranslation } from "@/i18n";
import type {
  CityAggregateResponse,
  ConsensusResponse,
  ForecastResponse,
  HourlyForecast,
  InversionStatus,
} from "@/lib/types";
import "@/styles/atmospheric-dynamics.css";

interface AtmosphericDynamicsPageProps {
  forecast: Panel<ForecastResponse>;
  hour: HourlyForecast | null;
  cursor: Cursor;
  inversion?: Panel<InversionStatus[]>;
  consensus?: ConsensusResponse | null;
  cityAggregate?: CityAggregateResponse | null;
  onBack: () => void;
}

export function AtmosphericDynamicsPage({
  forecast,
  hour,
  cursor,
  inversion,
  consensus: _consensus,
  cityAggregate,
  onBack,
}: AtmosphericDynamicsPageProps) {
  const { t } = useTranslation();

  return (
    <div className="ad-page">
      {/* Top Header & Navigation Bar */}
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "1.25rem 1.5rem 0.5rem" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "0.85rem",
          }}
        >
          <button
            type="button"
            className="ad-scrub-btn"
            style={{ fontSize: "13px", padding: "0.5rem 1rem", borderRadius: "8px" }}
            onClick={onBack}
          >
            <ArrowLeft size={16} />
            <span>{t("common.backToOverview")}</span>
          </button>

          <span className="ad-step-badge">
            <CloudRain size={13} />
            Atmospheric Soundings &amp; Airshed Dynamics · Delhi NCR
          </span>
        </div>

        {/* Interactive Scrub Timeline Bar */}
        <div className="ad-scrub-bar">
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f1f5f9", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
              <Clock size={15} style={{ color: "#38bdf8" }} />
              Scrubbed Forecast Horizon:
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "3px 10px",
                background: cursor.cursor === 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(56, 189, 248, 0.15)",
                color: cursor.cursor === 0 ? "#10b981" : "#38bdf8",
                border: `1px solid ${cursor.cursor === 0 ? "rgba(16, 185, 129, 0.3)" : "rgba(56, 189, 248, 0.3)"}`,
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              {cursor.cursor === 0 ? "Live Present (Hour 0)" : `+${cursor.cursor}h Forecast Lead`}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="ad-scrub-btn"
              onClick={() => cursor.setCursor(Math.max(0, cursor.cursor - 1))}
              disabled={cursor.cursor === 0}
              title="Step back 1 hour"
            >
              <ChevronLeft size={14} /> -1h
            </button>
            <button
              type="button"
              className="ad-scrub-btn"
              onClick={() => cursor.setCursor(Math.min(cursor.max, cursor.cursor + 1))}
              disabled={cursor.cursor >= cursor.max}
              title="Step forward 1 hour"
            >
              +1h <ChevronRight size={14} />
            </button>
            <button
              type="button"
              className={`ad-scrub-btn ${cursor.playing ? "ad-scrub-btn--active" : ""}`}
              onClick={cursor.toggle}
              title="Auto-sweep 72 hours"
            >
              {cursor.playing ? <Pause size={14} /> : <Play size={14} />}
              <span>{cursor.playing ? "Pause" : "Sweep 72h"}</span>
            </button>
            {cursor.cursor > 0 && (
              <button
                type="button"
                className="ad-scrub-btn"
                onClick={cursor.goNow}
                title="Reset cursor to now"
              >
                <RotateCcw size={13} /> Reset to Now
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Modules — Listed Neatly One by One in Sequential Cards */}
      <main className="ad-container">
        {/* Module 1: Atmospheric Boundary Layer & Dispersion Depth */}
        <section id="atmosphere-column" style={{ paddingBottom: "0.5rem" }}>
          <Atmosphere forecast={forecast} cursor={cursor} />
        </section>

        {/* Module 2: Inversion Watch & Thermal Stability */}
        <section id="inversion-watch" style={{ borderTop: "1px solid var(--hairline-2)", paddingTop: "1.5rem", paddingBottom: "1.25rem" }}>
          {inversion ? (
            <InversionStrip inversion={inversion} cursor={cursor.cursor} />
          ) : (
            <p className="section__lede" style={{ padding: "2rem 0" }}>
              Inversion series unavailable.
            </p>
          )}
        </section>

        {/* Module 3: Chemistry Pushing Back on the Weather (Two-Way Coupling Loop) */}
        <section id="coupling-loop" style={{ borderTop: "1px solid var(--hairline-2)", paddingTop: "1.5rem", paddingBottom: "2rem" }}>
          <CouplingLoop
            hour={hour}
            loading={forecast.status === "loading"}
            cityAggregate={cityAggregate}
            cursor={cursor.cursor}
          />
        </section>
      </main>
    </div>
  );
}

export default AtmosphericDynamicsPage;
