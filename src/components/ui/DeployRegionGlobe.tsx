'use client';

import * as React from 'react';
import {ArrowRight, Check, Globe, MapPin} from 'lucide-react';
import {cn} from '../../lib/utils';

export interface GlobeRegion {
  code: string;
  name: string;
  city: string;
  zone: string;
  lat: number;
  lng: number;
  facilityCount?: number;
}

export const DEFAULT_INDIA_GLOBE_REGIONS: GlobeRegion[] = [
  {
    code: 'BLR-01',
    name: 'Bengaluru',
    city: 'Bengaluru',
    zone: 'Indiranagar & Koramangala',
    lat: 12.9716,
    lng: 77.5946,
  },
  {
    code: 'BOM-01',
    name: 'Mumbai',
    city: 'Mumbai',
    zone: 'BKC & Lower Parel',
    lat: 19.076,
    lng: 72.8777,
  },
  {
    code: 'DEL-01',
    name: 'New Delhi',
    city: 'New Delhi',
    zone: 'Connaught Place & Saket',
    lat: 28.6139,
    lng: 77.209,
  },
  {
    code: 'HYD-01',
    name: 'Hyderabad',
    city: 'Hyderabad',
    zone: 'HITEC City & Banjara Hills',
    lat: 17.385,
    lng: 78.4867,
  },
  {
    code: 'PNQ-01',
    name: 'Pune',
    city: 'Pune',
    zone: 'Koregaon Park & Hinjewadi',
    lat: 18.5204,
    lng: 73.8567,
  },
  {
    code: 'MAA-01',
    name: 'Chennai',
    city: 'Chennai',
    zone: 'T. Nagar & Anna Salai',
    lat: 13.0827,
    lng: 80.2707,
  },
];

interface DeployRegionGlobeProps {
  regions?: GlobeRegion[];
  selectedCode?: string;
  isDark?: boolean;
  confirmLabel?: string;
  onSelectRegion?: (region: GlobeRegion) => void;
  onConfirm?: (region: GlobeRegion) => void;
  className?: string;
}

interface SpherePoint {
  x: number;
  y: number;
  z: number;
  isIndia: boolean;
}

function latLngToVec(latDeg: number, lngDeg: number): [number, number, number] {
  const phi = (latDeg * Math.PI) / 180;
  const lambda = (lngDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  return [
    cosPhi * Math.sin(lambda),
    Math.sin(phi),
    cosPhi * Math.cos(lambda),
  ];
}

function buildGlobePoints(): SpherePoint[] {
  const pts: SpherePoint[] = [];
  const total = 620;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < total; i++) {
    const y = 1 - (i / (total - 1)) * 2;
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;

    const lat = (Math.asin(y) * 180) / Math.PI;
    const lng = (Math.atan2(x, z) * 180) / Math.PI;

    // Rough bounding check for Indian subcontinent & neighboring hubs for denser dot contrast
    const inIndia = lat >= 7 && lat <= 35 && lng >= 68 && lng <= 97;
    pts.push({x, y, z, isIndia: inIndia});
  }

  // Add subtle high-resolution outline cluster for Indian peninsula
  const indiaWaypoints: [number, number][] = [
    [32.7, 74.8], [30.7, 76.8], [28.6, 77.2], [26.9, 75.8], [24.6, 73.7],
    [23.0, 72.6], [21.2, 72.8], [19.1, 72.9], [15.3, 73.9], [12.9, 77.6],
    [10.0, 76.3], [8.5, 77.0], [11.0, 78.7], [13.1, 80.3], [16.5, 80.6],
    [17.7, 83.3], [20.3, 85.8], [22.6, 88.4], [25.6, 85.1], [26.8, 80.9],
    [17.4, 78.5], [18.5, 73.9], [21.1, 79.1], [23.2, 77.4],
  ];
  for (const [lat, lng] of indiaWaypoints) {
    const [x, y, z] = latLngToVec(lat, lng);
    pts.push({x, y, z, isIndia: true});
  }

  return pts;
}

const GLOBE_POINTS = buildGlobePoints();

export function DeployRegionGlobe({
  regions = DEFAULT_INDIA_GLOBE_REGIONS,
  selectedCode,
  isDark = true,
  confirmLabel = 'Confirm Region',
  onSelectRegion,
  onConfirm,
  className,
}: DeployRegionGlobeProps) {
  const [internalCode, setInternalCode] = React.useState<string>(
    selectedCode || regions[0]?.code || 'BLR-01'
  );
  const activeCode = selectedCode ?? internalCode;
  const activeRegion =
    regions.find((r) => r.code === activeCode) || regions[0];

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const animStateRef = React.useRef({
    lat: activeRegion?.lat ?? 12.9716,
    lng: activeRegion?.lng ?? 77.5946,
    targetLat: activeRegion?.lat ?? 12.9716,
    targetLng: activeRegion?.lng ?? 77.5946,
    pulsePhase: 0,
  });

  React.useEffect(() => {
    if (!activeRegion) return;
    animStateRef.current.targetLat = activeRegion.lat;
    animStateRef.current.targetLng = activeRegion.lng;
  }, [activeRegion]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;

    const render = () => {
      const size = canvas.clientWidth || 260;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(size * dpr)) {
        canvas.width = Math.round(size * dpr);
        canvas.height = Math.round(size * dpr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const st = animStateRef.current;
      if (reducedMotion) {
        st.lat = st.targetLat;
        st.lng = st.targetLng;
      } else {
        st.lat += (st.targetLat - st.lat) * 0.09;
        const dLng = ((st.targetLng - st.lng + 540) % 360) - 180;
        st.lng += dLng * 0.09;
        st.pulsePhase = (st.pulsePhase + 0.035) % (Math.PI * 2);
      }

      const cx = size / 2;
      const cy = size / 2;
      const R = size * 0.41;

      const rotY = (-st.lng * Math.PI) / 180;
      const rotX = (st.lat * Math.PI) / 180;
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      const project = (vx: number, vy: number, vz: number) => {
        const x1 = vx * cosY + vz * sinY;
        const z1 = -vx * sinY + vz * cosY;
        const y2 = vy * cosX - z1 * sinX;
        const z2 = vy * sinX + z1 * cosX;
        return {
          sx: cx + x1 * R,
          sy: cy - y2 * R,
          z: z2,
        };
      };

      // Subtle atmospheric rim halo
      const haloGrad = ctx.createRadialGradient(cx, cy, R * 0.45, cx, cy, R * 1.15);
      if (isDark) {
        haloGrad.addColorStop(0, 'rgba(59, 130, 246, 0.08)');
        haloGrad.addColorStop(0.75, 'rgba(24, 24, 27, 0.25)');
        haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        haloGrad.addColorStop(0, 'rgba(37, 99, 235, 0.07)');
        haloGrad.addColorStop(0.75, 'rgba(244, 244, 245, 0.35)');
        haloGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      }
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.15, 0, Math.PI * 2);
      ctx.fill();

      // Sphere outer outline circle
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = isDark
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(24, 24, 27, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Lattice sphere dots
      for (const pt of GLOBE_POINTS) {
        const p = project(pt.x, pt.y, pt.z);
        if (p.z < -0.35) continue;
        const depth = Math.max(0, (p.z + 0.35) / 1.35);
        const dotRadius = pt.isIndia ? 1.45 + depth * 0.9 : 0.85 + depth * 0.65;
        const alpha = pt.isIndia
          ? 0.35 + depth * 0.6
          : 0.08 + depth * 0.34;

        ctx.beginPath();
        ctx.arc(p.sx, p.sy, dotRadius, 0, Math.PI * 2);
        if (pt.isIndia) {
          ctx.fillStyle = isDark
            ? `rgba(147, 197, 253, ${alpha.toFixed(2)})`
            : `rgba(37, 99, 235, ${alpha.toFixed(2)})`;
        } else {
          ctx.fillStyle = isDark
            ? `rgba(161, 161, 170, ${alpha.toFixed(2)})`
            : `rgba(82, 82, 91, ${alpha.toFixed(2)})`;
        }
        ctx.fill();
      }

      // Draw region markers
      for (const reg of regions) {
        const [rx, ry, rz] = latLngToVec(reg.lat, reg.lng);
        const rp = project(rx, ry, rz);
        if (rp.z <= 0.05) continue;
        const isTarget = reg.code === activeRegion?.code;

        if (isTarget) {
          const pulse = (Math.sin(st.pulsePhase) + 1) * 0.5;
          // Outer beacon ring
          ctx.beginPath();
          ctx.arc(rp.sx, rp.sy, 7 + pulse * 8, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(59, 130, 246, ${(0.55 - pulse * 0.4).toFixed(2)})`;
          ctx.lineWidth = 1.25;
          ctx.stroke();

          // Crosshair lines
          ctx.strokeStyle = isDark
            ? 'rgba(147, 197, 253, 0.5)'
            : 'rgba(37, 99, 235, 0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(rp.sx - 10, rp.sy);
          ctx.lineTo(rp.sx - 4, rp.sy);
          ctx.moveTo(rp.sx + 4, rp.sy);
          ctx.lineTo(rp.sx + 10, rp.sy);
          ctx.moveTo(rp.sx, rp.sy - 10);
          ctx.lineTo(rp.sx, rp.sy - 4);
          ctx.moveTo(rp.sx, rp.sy + 4);
          ctx.lineTo(rp.sx, rp.sy + 10);
          ctx.stroke();

          // Core pin
          ctx.beginPath();
          ctx.arc(rp.sx, rp.sy, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#3b82f6';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(rp.sx, rp.sy, 2.3, 0, Math.PI * 2);
          ctx.fillStyle = isDark
            ? 'rgba(16, 185, 129, 0.75)'
            : 'rgba(5, 150, 105, 0.75)';
          ctx.fill();
        }
      }

      if (!reducedMotion) {
        rafId = requestAnimationFrame(render);
      }
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [activeRegion, isDark, regions]);

  const handlePick = (reg: GlobeRegion) => {
    setInternalCode(reg.code);
    onSelectRegion?.(reg);
  };

  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#0B0B0F] text-zinc-900 dark:text-zinc-100',
        className
      )}
    >
      {/* Top Card Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800/90 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="font-display text-sm font-semibold text-zinc-900 dark:text-white">
            Parking Region Selector
          </span>
        </div>
        {activeRegion && (
          <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
            {activeRegion.lat.toFixed(4)}° N · {activeRegion.lng.toFixed(4)}° E ·{' '}
            <span className="text-blue-600 dark:text-blue-400 font-semibold">
              {activeRegion.code}
            </span>
          </div>
        )}
      </div>

      {/* Main Split: Interactive Globe + Region Card Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-zinc-800/90">
        {/* Left: Live Animated 3D Orthographic Globe */}
        <div className="lg:col-span-5 relative flex flex-col items-center justify-center p-6 ruixen-dot-bg min-h-[280px]">
          <canvas
            ref={canvasRef}
            aria-label={`Interactive globe focused on ${activeRegion?.name || 'India'}`}
            className="h-[230px] w-[230px] sm:h-[250px] sm:w-[250px]"
          />
          {activeRegion && (
            <div className="mt-2 text-center">
              <div className="text-xs font-semibold text-zinc-900 dark:text-white">
                {activeRegion.name} Hub
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {activeRegion.zone}
              </div>
            </div>
          )}
        </div>

        {/* Right: Selectable Region Cards */}
        <div className="lg:col-span-7 p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {regions.map((region) => {
              const isSelected = region.code === activeRegion?.code;
              return (
                <button
                  key={region.code}
                  type="button"
                  onClick={() => handlePick(region)}
                  className={cn(
                    'group text-left rounded-lg border p-3.5 transition-all duration-150 cursor-pointer flex flex-col justify-between gap-2',
                    isSelected
                      ? 'border-blue-500 bg-blue-500/[0.06] dark:bg-blue-500/[0.09] shadow-sm'
                      : 'border-zinc-200 dark:border-zinc-800/90 bg-zinc-50/50 dark:bg-zinc-950/50 hover:border-zinc-300 dark:hover:border-zinc-700'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold tracking-tight text-zinc-500 dark:text-zinc-400 tabular-nums">
                      {region.code}
                    </span>
                    {isSelected ? (
                      <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    ) : (
                      <MapPin className="h-3.5 w-3.5 text-zinc-400 group-hover:text-blue-500 transition-colors shrink-0" />
                    )}
                  </div>

                  <div>
                    <div className="font-display text-sm font-semibold text-zinc-900 dark:text-white">
                      {region.name}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      {region.zone}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-200/70 dark:border-zinc-800/80 font-mono text-[10px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                    <span>
                      {region.lat.toFixed(2)}°N, {region.lng.toFixed(2)}°E
                    </span>
                    {typeof region.facilityCount === 'number' && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {region.facilityCount} live
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bottom Confirmation Footer Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800/90">
            <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              {activeRegion
                ? `Selected ${activeRegion.name} (${activeRegion.code})`
                : 'Pick a region — the globe flies to it — then confirm.'}
            </p>
            {activeRegion && onConfirm && (
              <button
                type="button"
                onClick={() => onConfirm(activeRegion)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 dark:bg-white px-4 py-2 text-xs font-semibold text-white dark:text-zinc-950 hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
              >
                {confirmLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
