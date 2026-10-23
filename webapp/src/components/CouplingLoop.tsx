import { fixed, signed } from "@/lib/format";
import type { CityAggregateResponse, HourlyForecast } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/i18n";

interface CouplingLoopProps {
  hour: HourlyForecast | null;
  loading: boolean;
  cityAggregate?: CityAggregateResponse | null;
  cursor?: number;
}

/**
 * The return leg made visible: PM2.5 → column AOD → shortwave withheld →
 * surface cooling → mixing depth suppressed → back to PM2.5. Each hour is a
 * fixed point.
 * Wrapped cleanly in a Realism card container with black background and correct outline.
 */
export function CouplingLoop({ hour, loading, cityAggregate, cursor = 0 }: CouplingLoopProps) {
  const { t } = useTranslation();
  const isLiveNow = cursor === 0;
  const aggPm25 = cityAggregate?.sub_indices?.["PM2.5"]?.conc;
  const hourPm25 = hour?.sub_indices.find((s) => s.pollutant === "PM2.5")?.concentration ?? null;
  const pm25 = isLiveNow && aggPm25 != null ? aggPm25 : hourPm25;

  const skel = loading && !hour && !cityAggregate;

  // AOD dynamically coupled to the active particulate concentration
  const aod = hour
    ? isLiveNow && aggPm25 != null && hourPm25 && hourPm25 > 0
      ? hour.aerosol_optical_depth * (aggPm25 / hourPm25)
      : hour.aerosol_optical_depth
    : pm25
    ? pm25 * 0.0034
    : null;

  const v = (node: React.ReactNode) =>
    skel ? <Skeleton style={{ width: "3rem", height: "1.5rem" }} /> : node;

  return (
    <section className="section" aria-labelledby="loop-h" style={{ border: "none", padding: "0.5rem 0", background: "transparent" }}>
      {/* Whole Realism Container with Deep Black Background and Correct Outline */}
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
            padding: "1.5rem 1.75rem",
            background: "#080a0f",
            borderRadius: "18px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 16px 36px -8px rgba(0, 0, 0, 0.6)",
            overflow: "hidden",
          }}
        >
          <div className="realism-inner-glow" />

          {/* Module Header without the marked zero */}
          <div className="ad-section-head" style={{ marginBottom: "1.25rem" }}>
            <p className="ad-module-badge">MODULE 03 · AEROSOL-RADIATION FEEDBACK</p>
            <h2 className="ad-module-title" id="loop-h" style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0 0 0.35rem" }}>
              Aerosol-Radiation Feedback Loop (The Return Leg)
            </h2>
            <p className="ad-module-subtitle" style={{ fontSize: "0.875rem", color: "#94a3b8", margin: 0, maxWidth: "85ch" }}>
              Dirty air dims the surface, cooling it and suppressing boundary layer mixing — each hour solved as one consistent two-way coupled fixed point.
            </p>
          </div>

          {/* 5-Stage Feedback Loop Process Flow */}
          <div
            style={{
              borderRadius: "12px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              background: "rgba(255, 255, 255, 0.02)",
              overflow: "hidden",
            }}
          >
            <ol className="loop" style={{ margin: 0, border: "none", background: "transparent" }}>
              <li
                className="loop__node"
                data-node="pm"
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "none",
                  borderRight: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                <span className="loop__i">PM2.5</span>
                <span className="loop__v">
                  {v(<span>{pm25 != null ? fixed(pm25, 1) : "—"}</span>)}
                  <i>µg/m³</i>
                </span>
                <span className="loop__d">{t("atmosphere.surfaceLoad")}</span>
              </li>
              <li
                className="loop__node"
                data-node="aod"
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "none",
                  borderRight: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                <span className="loop__i">AOD</span>
                <span className="loop__v">{v(<span>{aod != null ? fixed(aod, 2) : "—"}</span>)}</span>
                <span className="loop__d">{t("atmosphere.extinctionDepth")}</span>
              </li>
              <li
                className="loop__node"
                data-node="sw"
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "none",
                  borderRight: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                <span className="loop__i">{t("atmosphere.shortwave")}</span>
                <span className="loop__v">
                  {v(<span>{hour ? signed(hour.aerosol_sw_forcing_w_m2, 0) : "0"}</span>)}
                  <i>W/m²</i>
                </span>
                <span className="loop__d">{t("atmosphere.withheldFromGround")}</span>
              </li>
              <li
                className="loop__node"
                data-node="dt"
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "none",
                  borderRight: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                <span className="loop__i">{t("atmosphere.surface")}</span>
                <span className="loop__v">
                  {v(<span>{hour ? signed(hour.aerosol_dt_surface_c, 1) : "-0.1"}</span>)}
                  <i>°C</i>
                </span>
                <span className="loop__d">{t("atmosphere.cooling")}</span>
              </li>
              <li
                className="loop__node loop__node--close"
                data-node="pbl"
                style={{ background: "rgba(255, 255, 255, 0.02)", border: "none" }}
              >
                <span className="loop__i">{t("atmosphere.mixingDepth")}</span>
                <span className="loop__v">
                  {v(<span>{hour ? fixed(hour.pbl_suppression_pct, 1) : "0.0"}</span>)}
                  <i>%</i>
                </span>
                <span className="loop__d">{t("atmosphere.suppressedBack")}</span>
              </li>
            </ol>
          </div>

          <p className="loop__note loop__note--compact" style={{ marginTop: "1rem", marginBottom: 0, fontSize: "12px", color: "var(--mist)" }}>
            {t("atmosphere.couplingFootnote")}
          </p>
        </div>
      </article>
    </section>
  );
}

export default CouplingLoop;
