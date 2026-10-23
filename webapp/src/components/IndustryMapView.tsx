import { useState } from "react";
import { InteractiveIndustryMap } from "./InteractiveIndustryMap";
import { IndustryIntelligenceSection } from "./IndustryIntelligenceSection";
import type { SupabaseIndustryRecord } from "@/lib/industrySupabase";

export interface IndustryMapViewProps {
  onBack?: () => void;
  windSpeedKmh?: number;
  windDirectionDeg?: number;
}

export function IndustryMapView({
  onBack,
  windSpeedKmh = 12.0,
  windDirectionDeg = 300,
}: IndustryMapViewProps) {
  const [selectedIndustry, setSelectedIndustry] = useState<SupabaseIndustryRecord | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(15);
  const [activeIndustries, setActiveIndustries] = useState<SupabaseIndustryRecord[]>([]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-10 animate-fadeIn" id="industry-intelligence-main-view">
      {/* ── Interactive Leaflet Industry Map View ── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/25 text-sky-400 text-[11px] font-medium tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              <span>CPCB Registry &amp; Airshed Intelligence</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300">Delhi NCR</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-2 tracking-tight">
              Industrial Facilities &amp; Airshed Dispersion
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
              Explore monitored industrial sites across Delhi NCR. Toggle satellite view, inspect live continuous emissions (CEMS), and evaluate downwind plume impact on local residential zones.
            </p>
          </div>
          {onBack && (
            <button
              onClick={onBack}
              className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-medium flex items-center gap-2 transition-all shadow-sm shrink-0"
            >
              <span>←</span>
              <span>Back to Overview</span>
            </button>
          )}
        </div>

        <InteractiveIndustryMap
          selectedIndustry={selectedIndustry}
          onSelectIndustry={setSelectedIndustry}
          radiusKm={radiusKm}
          onRadiusChange={setRadiusKm}
          onIndustriesInRadiusChange={setActiveIndustries}
          windSpeedKmh={windSpeedKmh}
          windDirectionDeg={windDirectionDeg}
        />
      </section>

      {/* ── Industry Intelligence & Digital Twin Stack Section ── */}
      <section>
        <IndustryIntelligenceSection
          selectedIndustry={selectedIndustry}
          onSelectIndustry={setSelectedIndustry}
          radiusKm={radiusKm}
          activeIndustries={activeIndustries}
          windSpeedKmh={windSpeedKmh}
        />
      </section>
    </div>
  );
}
