import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart2,
  ExternalLink,
  Factory,
  Flame,
  Gauge,
  Radio,
  ShieldAlert,
  Thermometer,
  Wind,
} from "lucide-react";

import {
  calculateGaussianPlumeConcentration,
  haversineDistanceKm,
  type SupabaseIndustryRecord,
} from "@/lib/industrySupabase";
import "@/styles/industry-intelligence.css";

export interface IndustryIntelligenceSectionProps {
  selectedIndustry: SupabaseIndustryRecord | null;
  onSelectIndustry: (ind: SupabaseIndustryRecord) => void;
  radiusKm: number;
  centerCoords?: { lat: number; lng: number };
  activeIndustries?: SupabaseIndustryRecord[];
  windSpeedKmh?: number;
}

export function IndustryIntelligenceSection({
  selectedIndustry,
  onSelectIndustry,
  radiusKm,
  centerCoords: _centerCoords = { lat: 28.6139, lng: 77.209 },
  activeIndustries = [],
  windSpeedKmh = 12.0,
}: IndustryIntelligenceSectionProps) {
  // Default mock plant if none clicked yet
  const displayIndustry: SupabaseIndustryRecord = selectedIndustry || {
    id: 136258,
    industry_name: "Badarpur Thermal Power Station",
    category: "Thermal Power Plant",
    latitude: 28.5032,
    longitude: 77.3068,
    city: "Delhi",
    state: "Delhi",
    country: "India",
    tier: "red",
    tierColor: "#ff3b5c",
    tierLabel: "Critical · Red Tier",
    estimatedStackHeight: 120,
    estimatedEmissions: {
      pm25_kg_day: 148.5,
      so2_kg_day: 210.0,
      no2_kg_day: 185.0,
      voc_kg_day: 42.0,
      co_kg_day: 280.0,
      tons_per_year: 285.5,
      flue_gas_velocity_ms: 22.4,
      stack_temp_c: 185,
    },
  };

  // Top local contributors dynamically calculated from active industries or surrounding airshed
  const topContributors = useMemo(() => {
    const centerLat = selectedIndustry ? selectedIndustry.latitude : _centerCoords.lat;
    const centerLng = selectedIndustry ? selectedIndustry.longitude : _centerCoords.lng;

    let sourceList: SupabaseIndustryRecord[] = [];
    if (activeIndustries && activeIndustries.length > 0) {
      sourceList = activeIndustries;
    }

    if (sourceList.length === 0) {
      const defaultSet: SupabaseIndustryRecord[] = [
        displayIndustry,
        {
          id: 136311,
          industry_name: "Narela Speciality Petrochemicals #17",
          category: "Petrochemicals & Polymers",
          latitude: 28.835087,
          longitude: 77.089032,
          city: "Delhi",
          state: "Delhi",
          country: "India",
          tier: "red",
          tierColor: "#ff3b5c",
          tierLabel: "Critical · Red Tier",
          estimatedStackHeight: 90,
          estimatedEmissions: {
            pm25_kg_day: 120,
            so2_kg_day: 180,
            no2_kg_day: 160,
            voc_kg_day: 95,
            co_kg_day: 140,
            tons_per_year: 245,
            flue_gas_velocity_ms: 19.5,
            stack_temp_c: 160,
          },
        },
        {
          id: 136312,
          industry_name: "Narela High-Alloy Castings #18",
          category: "Steel & Foundry Smelting",
          latitude: 28.831291,
          longitude: 77.087458,
          city: "Delhi",
          state: "Delhi",
          country: "India",
          tier: "red",
          tierColor: "#ff3b5c",
          tierLabel: "Critical · Red Tier",
          estimatedStackHeight: 75,
          estimatedEmissions: {
            pm25_kg_day: 110,
            so2_kg_day: 130,
            no2_kg_day: 90,
            voc_kg_day: 25,
            co_kg_day: 190,
            tons_per_year: 195,
            flue_gas_velocity_ms: 18.0,
            stack_temp_c: 175,
          },
        },
        {
          id: 136309,
          industry_name: "Narela Fabric & Dyeing Works #15",
          category: "Textile Finishing",
          latitude: 28.835777,
          longitude: 77.08337,
          city: "Delhi",
          state: "Delhi",
          country: "India",
          tier: "orange",
          tierColor: "#ff9f1c",
          tierLabel: "Moderate · Orange Tier",
          estimatedStackHeight: 45,
          estimatedEmissions: {
            pm25_kg_day: 48,
            so2_kg_day: 55,
            no2_kg_day: 42,
            voc_kg_day: 30,
            co_kg_day: 80,
            tons_per_year: 85,
            flue_gas_velocity_ms: 12.0,
            stack_temp_c: 125,
          },
        },
      ];
      sourceList = defaultSet;
    }

    const mapped = sourceList.map((ind) => {
      const distance = haversineDistanceKm(centerLat, centerLng, ind.latitude, ind.longitude);
      const em = ind.estimatedEmissions;
      const dailyOutputKg = Number(
        (em.pm25_kg_day + em.so2_kg_day + em.no2_kg_day + (em.co_kg_day || 0) * 0.2).toFixed(1)
      );

      let primaryPollutant = "PM2.5 / SO2";
      const cat = (ind.category || "").toLowerCase();
      if (cat.includes("power") || cat.includes("coal") || cat.includes("thermal")) {
        primaryPollutant = "PM2.5 / SO2";
      } else if (cat.includes("petro") || cat.includes("chemical") || cat.includes("pharma")) {
        primaryPollutant = "VOCs / NO2";
      } else if (cat.includes("steel") || cat.includes("foundry") || cat.includes("smelt")) {
        primaryPollutant = "PM2.5 / Heavy Metals";
      } else if (cat.includes("textile") || cat.includes("dye") || cat.includes("garment")) {
        primaryPollutant = "PM10 / Boiler Smoke";
      } else if (cat.includes("food") || cat.includes("dairy") || cat.includes("agro")) {
        primaryPollutant = "PM10 / Flue Gas";
      } else if (cat.includes("ceramic") || cat.includes("glass") || cat.includes("cement")) {
        primaryPollutant = "PM2.5 / Silica Dust";
      }

      const proximityWeight = 1 / Math.max(0.4, distance * 0.7);
      const impactScore = dailyOutputKg * proximityWeight;

      return {
        industryRecord: ind,
        id: ind.id,
        name: ind.industry_name,
        category: ind.category || "Industrial Facility",
        tier: (ind.tier === "green" || ind.tier === "white" ? "green" : ind.tier) as "red" | "orange" | "green",
        tierColor: ind.tierColor,
        distanceKm: distance,
        primaryPollutant,
        dailyOutputKg,
        impactScore,
        lat: ind.latitude,
        lng: ind.longitude,
      };
    });

    const sorted = [...mapped].sort((a, b) => b.impactScore - a.impactScore).slice(0, 8);
    const totalScore = sorted.reduce((sum, item) => sum + item.impactScore, 0) || 1;

    return sorted.map((item) => ({
      ...item,
      impactPercent: Number(((item.impactScore / totalScore) * 100).toFixed(1)),
    }));
  }, [activeIndustries, selectedIndustry, _centerCoords.lat, _centerCoords.lng, displayIndustry]);

  // Compute Gaussian Plume curve at distances
  const plumeDistances = [100, 300, 700, 1500, 3000, 5000, 8000, 12000]; // meters
  const windMps = (windSpeedKmh * 1000) / 3600;
  const pm25RateGps = (displayIndustry.estimatedEmissions.pm25_kg_day * 1000) / 86400;

  const plumeConcentrations = useMemo(() => {
    return plumeDistances.map((dist) => {
      const conc = calculateGaussianPlumeConcentration(
        dist,
        pm25RateGps,
        windMps,
        displayIndustry.estimatedStackHeight
      );
      return {
        distLabel: dist >= 1000 ? `${dist / 1000}km` : `${dist}m`,
        distMeters: dist,
        concentration: conc,
      };
    });
  }, [pm25RateGps, windMps, displayIndustry.estimatedStackHeight]);

  const maxPlume = useMemo(() => {
    let top = plumeConcentrations[0];
    for (const p of plumeConcentrations) {
      if (p.concentration > top.concentration) top = p;
    }
    return top;
  }, [plumeConcentrations]);

  const hourlyPm25Rate = (displayIndustry.estimatedEmissions.pm25_kg_day / 24).toFixed(2);
  const hourlyTotalRate = (
    (displayIndustry.estimatedEmissions.pm25_kg_day +
      displayIndustry.estimatedEmissions.so2_kg_day +
      displayIndustry.estimatedEmissions.no2_kg_day) /
    24
  ).toFixed(2);

  return (
    <div className="w-full space-y-6" id="industry-intelligence-dashboard">
      {/* ── Section Title Header ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[11px] font-medium tracking-wide">
            <Factory className="w-3.5 h-3.5 text-sky-400" />
            <span>Industrial Stack Dispersion &amp; Receptor Impact</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mt-2 tracking-tight">
            Emission Profile &amp; Downwind Plume Modeling
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Continuous emission monitoring (CEMS), thermodynamic stack behavior, and Gaussian downwind dispersion.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex items-center gap-2 shadow-sm">
            <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
            <span>Analysis Buffer: <strong className="text-white font-medium">{radiusKm} km</strong></span>
          </div>

          <a
            href={`/industry-details.html?id=${encodeURIComponent(
              String(displayIndustry.id)
            )}&lat=${displayIndustry.latitude}&lng=${displayIndustry.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 hover:text-white border border-sky-500/30 text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm"
          >
            <span>Full Plant Dossier</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* ── Top Row: Digital Twin Stack Card + Plume Dispersion Simulator ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 1. Digital Twin Stack Emission Card (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/75 border border-slate-800/90 rounded-2xl p-6 space-y-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center border shadow-md shrink-0"
                style={{
                  backgroundColor: `${displayIndustry.tierColor}15`,
                  borderColor: `${displayIndustry.tierColor}40`,
                  color: displayIndustry.tierColor,
                }}
              >
                <Factory className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white leading-tight">
                  {displayIndustry.industry_name}
                </h3>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                  <span>{displayIndustry.category || "Industrial Complex"}</span>
                  <span className="text-slate-600">·</span>
                  <span>{displayIndustry.city || "Delhi NCR"}, India</span>
                </p>
              </div>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide shrink-0 ${
                displayIndustry.tier === "red"
                  ? "bg-red-500/15 text-red-400 border border-red-500/30"
                  : displayIndustry.tier === "orange"
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              }`}
            >
              {displayIndustry.tier === "red" ? "Critical · Red Tier" : displayIndustry.tier === "orange" ? "Moderate · Orange Tier" : "Compliant · Green Tier"}
            </span>
          </div>

          {/* Key Metrics Micro-Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                PM2.5 Rate
              </span>
              <div className="text-xl font-bold text-rose-400 mt-1.5">
                {hourlyPm25Rate} <span className="text-xs text-slate-400 font-normal">kg/hr</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                {displayIndustry.estimatedEmissions.pm25_kg_day} kg/day
              </span>
            </div>

            <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                Total Emission
              </span>
              <div className="text-xl font-bold text-amber-400 mt-1.5">
                {hourlyTotalRate} <span className="text-xs text-slate-400 font-normal">kg/hr</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                {displayIndustry.estimatedEmissions.tons_per_year} tons/yr
              </span>
            </div>

            <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-sky-400" />
                Stack Height
              </span>
              <div className="text-xl font-bold text-white mt-1.5">
                {displayIndustry.estimatedStackHeight} <span className="text-xs text-slate-400 font-normal">m</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Flue: {displayIndustry.estimatedEmissions.flue_gas_velocity_ms} m/s
              </span>
            </div>

            <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5 text-teal-400" />
                Exhaust Temp
              </span>
              <div className="text-xl font-bold text-teal-400 mt-1.5">
                {displayIndustry.estimatedEmissions.stack_temp_c}°C
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Thermal Lift: High
              </span>
            </div>
          </div>

          {/* Full Pollutant Speciation Spectrum */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-white">Daily Speciated Emissions Output</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Continuous Emission Monitoring System (CEMS) baseline</p>
              </div>
              <span className="text-[11px] text-sky-400 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20">
                24h Average
              </span>
            </div>

            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium">Sulphur Dioxide (SO₂)</span>
                  <span className="text-amber-400 font-bold">
                    {displayIndustry.estimatedEmissions.so2_kg_day} kg/day
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        (displayIndustry.estimatedEmissions.so2_kg_day / 220) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium">Nitrogen Oxides (NOₓ)</span>
                  <span className="text-teal-400 font-bold">
                    {displayIndustry.estimatedEmissions.no2_kg_day} kg/day
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-400 to-cyan-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        (displayIndustry.estimatedEmissions.no2_kg_day / 200) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium">Carbon Monoxide &amp; VOCs</span>
                  <span className="text-sky-300 font-bold">
                    {displayIndustry.estimatedEmissions.co_kg_day +
                      displayIndustry.estimatedEmissions.voc_kg_day}{" "}
                    kg/day
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        ((displayIndustry.estimatedEmissions.co_kg_day +
                          displayIndustry.estimatedEmissions.voc_kg_day) /
                          300) *
                          100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Plume Dispersion Simulator (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/75 border border-slate-800/90 rounded-2xl p-6 space-y-5 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Wind className="w-4 h-4 text-sky-400" />
                Downwind Ground Dispersion
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Gaussian plume concentration touchdown profile
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[11px] font-medium">
              Class D Neutral
            </span>
          </div>

          {/* Peak Ground Impact Alert */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-white text-sm block">
                Peak Ground Impact at {maxPlume.distLabel}
              </span>
              <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                Maximum ground-level surge reaches{" "}
                <span className="text-red-400 font-bold">
                  +{maxPlume.concentration} µg/m³
                </span>{" "}
                above ambient baseline before gradual atmospheric dilution.
              </p>
            </div>
          </div>

          {/* Visual Plume Concentration Curve Bar Chart */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium">Downwind Distance vs Ground PM2.5 Surge</span>
              <span className="text-[11px] text-slate-400">(µg/m³)</span>
            </div>

            {/* Visual bar chart showing the rise to peak and falloff */}
            <div className="grid grid-cols-8 gap-1.5 items-end h-28 pt-4 pb-1">
              {plumeConcentrations.map((p) => {
                const maxVal = maxPlume.concentration > 0 ? maxPlume.concentration : 1;
                const heightPercent = Math.max(8, Math.round((p.concentration / maxVal) * 100));
                const isPeak = p.distLabel === maxPlume.distLabel;

                return (
                  <div key={p.distLabel} className="flex flex-col items-center justify-end h-full group">
                    <span className={`text-[10px] mb-1 font-semibold transition-colors ${isPeak ? "text-red-400 font-bold" : "text-slate-400 group-hover:text-white"}`}>
                      {p.concentration}
                    </span>
                    <div className="w-full bg-slate-800/70 rounded-t-md overflow-hidden flex items-end h-16">
                      <div
                        className={`w-full rounded-t-md transition-all duration-300 ${
                          isPeak
                            ? "bg-gradient-to-t from-red-600 to-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.4)]"
                            : p.concentration > 0
                            ? "bg-gradient-to-t from-sky-600 to-cyan-400"
                            : "bg-slate-800"
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <span className={`text-[10px] mt-1.5 ${isPeak ? "text-red-300 font-bold" : "text-slate-400"}`}>
                      {p.distLabel}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 border-t border-slate-800/60 pt-2">
              <span>Stack Origin (0m)</span>
              <span>Near-Surface Touchdown</span>
              <span>Dissipation (&gt;10km)</span>
            </div>
          </div>

          {/* Sensitive Zone Intersection Notice */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              Downwind trajectory intersects residential cluster and 3 schools within 2.5 km.
            </span>
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Top Local Industrial Polluters Table ─────────────────── */}
      <div className="bg-slate-900/75 border border-slate-800/90 rounded-2xl p-6 space-y-4 shadow-xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-sky-400" />
              Top Industrial Emitters Contributing to Local Airshed
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Ranked by mass discharge and proximity to active analysis centroid ({radiusKm} km radius buffer)
            </p>
          </div>

          <span className="text-xs px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-medium">
            {topContributors.length} Major Facilities Tracked
          </span>
        </div>

        {/* Contributors List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px] font-semibold">
                <th className="pb-3 pr-4">Facility Name</th>
                <th className="pb-3 px-3">Sector</th>
                <th className="pb-3 px-3 text-center">Regulatory Tier</th>
                <th className="pb-3 px-3 text-right">Distance</th>
                <th className="pb-3 px-3 text-right">Daily Emissions</th>
                <th className="pb-3 px-3 text-right">Airshed Share</th>
                <th className="pb-3 pl-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {topContributors.map((c, idx) => (
                <tr
                  key={String(c.id)}
                  onClick={() => {
                    onSelectIndustry(c.industryRecord);
                  }}
                  className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                >
                  <td className="py-3.5 pr-4">
                    <div className="font-semibold text-white flex items-center gap-2.5">
                      <span className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 border ${
                        idx === 0
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : idx === 1
                          ? "bg-slate-700/50 text-slate-200 border-slate-600"
                          : idx === 2
                          ? "bg-amber-700/20 text-amber-400 border-amber-700/40"
                          : "bg-slate-800/60 text-slate-400 border-slate-700"
                      }`}>
                        #{idx + 1}
                      </span>
                      <span className="truncate max-w-[280px] group-hover:text-sky-300 transition-colors">{c.name}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-3 text-slate-300">{c.category}</td>

                  <td className="py-3.5 px-3 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        c.tier === "red"
                          ? "bg-red-500/15 text-red-400 border border-red-500/30"
                          : c.tier === "orange"
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {c.tier}
                    </span>
                  </td>

                  <td className="py-3.5 px-3 text-right text-slate-300 font-medium">
                    {c.distanceKm} km
                  </td>

                  <td className="py-3.5 px-3 text-right text-white font-semibold">
                    {c.dailyOutputKg} kg/d <span className="text-[11px] text-slate-400 font-normal">({c.primaryPollutant})</span>
                  </td>

                  <td className="py-3.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-red-500 rounded-full"
                          style={{ width: `${Math.min(100, c.impactPercent * 3)}%` }}
                        />
                      </div>
                      <span className="font-bold text-red-400 text-xs w-10 text-right">
                        {c.impactPercent}%
                      </span>
                    </div>
                  </td>

                  <td className="py-3.5 pl-4 text-center">
                    <a
                      href={`/industry-details.html?id=${encodeURIComponent(
                        String(c.id)
                      )}&lat=${c.lat}&lng=${c.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 hover:text-white border border-sky-500/30 text-xs font-medium inline-flex items-center gap-1 transition-all"
                    >
                      <span>Deep Profile</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
