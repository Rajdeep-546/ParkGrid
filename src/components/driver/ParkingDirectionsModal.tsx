import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AdvancedMarker,
  Map as GoogleMap,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  ArrowRight,
  ArrowUp,
  Bike,
  Camera,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CornerUpLeft,
  CornerUpRight,
  Crosshair,
  ExternalLink,
  Flag,
  Footprints,
  Lightbulb,
  Loader2,
  MapPin,
  Maximize2,
  Minus,
  Navigation,
  Plus,
  RotateCw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Umbrella,
  Zap,
} from 'lucide-react';
import {toast} from 'sonner';
import {AMENITY_META, DEFAULT_INDIA_CENTER} from '../../data/indiaParkingConfig';
import {
  calculateDistanceKm,
  cn,
  formatCurrency,
  getAvailableBayCount,
} from '../../lib/utils';
import type {AmenityId, ParkingSlot, SearchLocationFilter} from '../../types/parking';
import {
  getGoogleMapsApiKey,
  useIndiaPlaceAutocomplete,
  type PlaceSuggestionItem,
} from '../maps/PlacesProvider';
import {Button} from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {ParkingThumbnail} from '../ui/ParkingThumbnail';

const MODAL_AMENITY_ICONS: Record<AmenityId, typeof Camera> = {
  cctv: Camera,
  security: Shield,
  ev_charger: Zap,
  covered: Umbrella,
  well_lit: Lightbulb,
  valet: Sparkles,
};

type TravelModeOption = 'DRIVING' | 'TWO_WHEELER' | 'WALKING';

interface RouteStepItem {
  id: string;
  instruction: string;
  distanceText: string;
  durationText: string;
  maneuver: string;
  coords?: {lat: number; lng: number};
}

interface ComputedRouteSummary {
  distanceText: string;
  durationText: string;
  steps: RouteStepItem[];
  isFallbackEstimate: boolean;
}

interface ParkingDirectionsModalProps {
  slot: ParkingSlot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userCoords: {lat: number; lng: number; label: string} | null;
  searchLocation: SearchLocationFilter | null;
  onUpdateUserCoords: (coords: {lat: number; lng: number; label: string}) => void;
  onBookSlot: (slot: ParkingSlot) => void;
}

function formatDistanceMeters(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDurationMs(ms: number): string {
  const totalMin = Math.max(1, Math.round(ms / 60000));
  if (totalMin < 60) return `${totalMin} min`;
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function getManeuverIcon(maneuver: string) {
  const m = maneuver.toUpperCase();
  if (m.includes('LEFT')) return CornerUpLeft;
  if (m.includes('RIGHT')) return CornerUpRight;
  if (m.includes('ROUNDABOUT') || m.includes('UTURN')) return RotateCw;
  if (m.includes('ARRIVE') || m.includes('DESTINATION')) return Flag;
  return ArrowUp;
}

interface DarkRouteMapCanvasProps {
  origin: {lat: number; lng: number; label: string};
  destination: {lat: number; lng: number; title: string; hourlyRate: number; hasEv: boolean};
  travelMode: TravelModeOption;
  focusedStepCoords: {lat: number; lng: number} | null;
  onRouteComputed: (summary: ComputedRouteSummary) => void;
  onRouteLoadingChange: (loading: boolean) => void;
}

function DarkRouteMapCanvas({
  origin,
  destination,
  travelMode,
  focusedStepCoords,
  onRouteComputed,
  onRouteLoadingChange,
}: DarkRouteMapCanvasProps) {
  const map = useMap('parkgrid-directions-map');
  const routesLib = useMapsLibrary('routes');
  const mapsLib = useMapsLibrary('maps');
  const coreLib = useMapsLibrary('core');

  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const routeViewportRef = useRef<google.maps.LatLngBounds | null>(null);

  const clearPolylines = useCallback(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
  }, []);

  const fitOriginAndDestination = useCallback(() => {
    if (!map || !coreLib) return;
    const bounds = new coreLib.LatLngBounds();
    bounds.extend({lat: origin.lat, lng: origin.lng});
    bounds.extend({lat: destination.lat, lng: destination.lng});
    map.fitBounds(bounds, {top: 56, right: 48, bottom: 56, left: 48});
  }, [map, coreLib, origin.lat, origin.lng, destination.lat, destination.lng]);

  const handleRecenterRoute = useCallback(() => {
    if (!map) return;
    if (routeViewportRef.current) {
      map.fitBounds(routeViewportRef.current, {top: 56, right: 48, bottom: 56, left: 48});
    } else {
      fitOriginAndDestination();
    }
  }, [map, fitOriginAndDestination]);

  useEffect(() => {
    if (!map || !focusedStepCoords) return;
    map.panTo(focusedStepCoords);
    map.setZoom(16);
  }, [map, focusedStepCoords]);

  useEffect(() => {
    if (!map || !routesLib || !mapsLib) return;
    let cancelled = false;

    clearPolylines();
    routeViewportRef.current = null;
    onRouteLoadingChange(true);

    const baseRequest: google.maps.routes.ComputeRoutesRequest = {
      origin: {lat: origin.lat, lng: origin.lng},
      destination: {lat: destination.lat, lng: destination.lng},
      travelMode,
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs'],
      region: 'IN',
      language: 'en',
      internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
    };

    const runCompute = async () => {
      try {
        let result;
        try {
          result = await routesLib.Route.computeRoutes({
            ...baseRequest,
            ...(travelMode === 'DRIVING'
              ? {routingPreference: 'TRAFFIC_AWARE'}
              : {}),
          });
        } catch {
          result = await routesLib.Route.computeRoutes(baseRequest);
        }

        if (cancelled) return;
        const primaryRoute = result?.routes?.[0];
        if (!primaryRoute) {
          throw new Error('No route returned');
        }

        const glowPolylines = primaryRoute.createPolylines({
          polylineOptions: {
            strokeColor: '#0EA5E9',
            strokeWeight: 9,
            strokeOpacity: 0.25,
          },
        });
        const mainPolylines = primaryRoute.createPolylines({
          polylineOptions: {
            strokeColor: '#38BDF8',
            strokeWeight: 5,
            strokeOpacity: 0.95,
          },
        });

        [...glowPolylines, ...mainPolylines].forEach((pl) => pl.setMap(map));
        polylinesRef.current = [...glowPolylines, ...mainPolylines];

        if (primaryRoute.viewport) {
          routeViewportRef.current = primaryRoute.viewport;
          map.fitBounds(primaryRoute.viewport, {top: 56, right: 48, bottom: 56, left: 48});
        } else {
          fitOriginAndDestination();
        }

        const leg = primaryRoute.legs?.[0];
        const rawSteps = leg?.steps || [];
        const steps: RouteStepItem[] = rawSteps.map((step, idx) => ({
          id: `step_${idx}`,
          instruction:
            step.instructions ||
            (idx === rawSteps.length - 1
              ? `Arrive at ${destination.title}`
              : 'Continue along the highlighted road'),
          distanceText:
            step.localizedValues?.distance ||
            formatDistanceMeters(step.distanceMeters || 0),
          durationText:
            step.localizedValues?.staticDuration ||
            (step.staticDurationMillis ? formatDurationMs(step.staticDurationMillis) : ''),
          maneuver: step.maneuver || 'STRAIGHT',
          coords: step.startLocation
            ? {lat: step.startLocation.lat, lng: step.startLocation.lng}
            : undefined,
        }));

        const distMeters =
          primaryRoute.distanceMeters ??
          leg?.distanceMeters ??
          Math.round(
            calculateDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng) * 1000
          );
        const durMs =
          primaryRoute.durationMillis ??
          leg?.durationMillis ??
          Math.max(3, Math.round((distMeters / 1000) * 2.5)) * 60000;

        onRouteComputed({
          distanceText:
            primaryRoute.localizedValues?.distance || formatDistanceMeters(distMeters),
          durationText:
            primaryRoute.localizedValues?.duration || formatDurationMs(durMs),
          steps:
            steps.length > 0
              ? steps
              : [
                  {
                    id: 'step_direct',
                    instruction: `Drive towards ${destination.title}`,
                    distanceText: formatDistanceMeters(distMeters),
                    durationText: formatDurationMs(durMs),
                    maneuver: 'STRAIGHT',
                    coords: {lat: origin.lat, lng: origin.lng},
                  },
                ],
          isFallbackEstimate: false,
        });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('429') ||
          msg.includes('OVER_QUERY_LIMIT')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }

        // Draw clean dashed direct guide line when Routes API isn't reachable
        const fallbackLine = new mapsLib.Polyline({
          path: [
            {lat: origin.lat, lng: origin.lng},
            {lat: destination.lat, lng: destination.lng},
          ],
          geodesic: true,
          strokeColor: '#38BDF8',
          strokeOpacity: 0,
          icons: [
            {
              icon: {
                path: 'M 0,-1 0,1',
                strokeOpacity: 0.9,
                strokeWeight: 3,
                scale: 3,
              },
              offset: '0',
              repeat: '14px',
            },
          ],
          map,
        });
        polylinesRef.current = [fallbackLine];
        fitOriginAndDestination();

        const km = calculateDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);
        const speedKmMin = travelMode === 'WALKING' ? 0.08 : travelMode === 'TWO_WHEELER' ? 0.48 : 0.42;
        const estMin = Math.max(2, Math.round(km / speedKmMin));

        onRouteComputed({
          distanceText: `${km.toFixed(1)} km`,
          durationText: `~${estMin} min`,
          steps: [
            {
              id: 'guide_start',
              instruction: `Start from ${origin.label}`,
              distanceText: '0 m',
              durationText: '',
              maneuver: 'STRAIGHT',
              coords: {lat: origin.lat, lng: origin.lng},
            },
            {
              id: 'guide_head',
              instruction: `Head towards ${destination.title} (${km.toFixed(1)} km direct distance)`,
              distanceText: `${km.toFixed(1)} km`,
              durationText: `~${estMin} min`,
              maneuver: 'STRAIGHT',
              coords: {lat: destination.lat, lng: destination.lng},
            },
            {
              id: 'guide_arrive',
              instruction: `Arrive at parking entry kiosk for ${destination.title}`,
              distanceText: 'Destination',
              durationText: '',
              maneuver: 'ARRIVE',
              coords: {lat: destination.lat, lng: destination.lng},
            },
          ],
          isFallbackEstimate: true,
        });
      } finally {
        if (!cancelled) onRouteLoadingChange(false);
      }
    };

    void runCompute();

    return () => {
      cancelled = true;
      clearPolylines();
    };
  }, [
    map,
    routesLib,
    mapsLib,
    origin.lat,
    origin.lng,
    origin.label,
    destination.lat,
    destination.lng,
    destination.title,
    travelMode,
    clearPolylines,
    fitOriginAndDestination,
    onRouteComputed,
    onRouteLoadingChange,
  ]);

  return (
    <div className="relative h-full w-full bg-[#090B10]">
      <GoogleMap
        id="parkgrid-directions-map"
        mapId="DEMO_MAP_ID"
        defaultCenter={{
          lat: (origin.lat + destination.lat) / 2,
          lng: (origin.lng + destination.lng) / 2,
        }}
        defaultZoom={13}
        gestureHandling="greedy"
        disableDefaultUI={true}
        colorScheme="DARK"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{width: '100%', height: '100%'}}
      >
        {/* User Location Origin Marker */}
        <AdvancedMarker
          position={{lat: origin.lat, lng: origin.lng}}
          title={origin.label}
          zIndex={900}
        >
          <div className="flex flex-col items-center">
            <span className="mb-1 rounded-md border border-emerald-400/50 bg-[#090B10]/95 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 shadow-lg whitespace-nowrap">
              {origin.label}
            </span>
            <div className="relative flex items-center justify-center">
              <span className="absolute h-7 w-7 rounded-full bg-emerald-400/35 animate-ping" />
              <span className="relative h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-[#090B10] shadow-md" />
            </div>
          </div>
        </AdvancedMarker>

        {/* Destination Parking Marker */}
        <AdvancedMarker
          position={{lat: destination.lat, lng: destination.lng}}
          title={destination.title}
          zIndex={1000}
        >
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 rounded-lg border border-sky-400/80 bg-[#0F172A]/95 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xl whitespace-nowrap">
              <MapPin className="h-3.5 w-3.5 text-sky-400 shrink-0" />
              <span className="font-mono tabular-nums">
                {formatCurrency(destination.hourlyRate)}/h
              </span>
              {destination.hasEv && <Zap className="h-3 w-3 text-emerald-400 shrink-0" />}
            </div>
            <div className="h-2 w-0.5 bg-sky-400" />
          </div>
        </AdvancedMarker>
      </GoogleMap>

      {/* Minimal Dark Map Controls */}
      <div className="absolute right-3 bottom-3 z-10 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={handleRecenterRoute}
          title="Recenter route view"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/80 bg-[#0D1117]/90 text-zinc-200 hover:bg-zinc-800 shadow-lg cursor-pointer backdrop-blur-md"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => map && map.setZoom((map.getZoom() || 13) + 1)}
          title="Zoom in"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/80 bg-[#0D1117]/90 text-zinc-200 hover:bg-zinc-800 shadow-lg cursor-pointer backdrop-blur-md"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => map && map.setZoom((map.getZoom() || 13) - 1)}
          title="Zoom out"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/80 bg-[#0D1117]/90 text-zinc-200 hover:bg-zinc-800 shadow-lg cursor-pointer backdrop-blur-md"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ParkingDirectionsModal({
  slot,
  open,
  onOpenChange,
  userCoords,
  searchLocation,
  onUpdateUserCoords,
  onBookSlot,
}: ParkingDirectionsModalProps) {
  const [travelMode, setTravelMode] = useState<TravelModeOption>('DRIVING');
  const [locating, setLocating] = useState(false);
  const [editingOrigin, setEditingOrigin] = useState(false);
  const [originInput, setOriginInput] = useState('');
  const [customOrigin, setCustomOrigin] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);
  const [routeSummary, setRouteSummary] = useState<ComputedRouteSummary | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [panelTab, setPanelTab] = useState<'overview' | 'directions'>('overview');
  const [focusedStepId, setFocusedStepId] = useState<string | null>(null);
  const [focusedStepCoords, setFocusedStepCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  const {
    suggestions: originSuggestions,
    loading: loadingOriginSearch,
    resolvePlaceCoordinates,
  } = useIndiaPlaceAutocomplete(originInput);

  // Reset transient UI state whenever a different parking card is opened
  useEffect(() => {
    if (open && slot) {
      setPanelTab('overview');
      setCustomOrigin(null);
      setEditingOrigin(false);
      setOriginInput('');
      setFocusedStepId(null);
      setFocusedStepCoords(null);
      setActivePhotoIdx(0);
    }
  }, [open, slot?.id]);

  // Automatically resolve live GPS if user hasn't already provided coordinates
  useEffect(() => {
    if (!open || userCoords || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onUpdateUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: 'Your Live Location',
        });
      },
      () => {
        // Silent fallback to searchLocation / default center
      },
      {enableHighAccuracy: true, timeout: 5000}
    );
  }, [open, userCoords, onUpdateUserCoords]);

  const effectiveOrigin = useMemo(() => {
    if (customOrigin) return customOrigin;
    if (userCoords) return userCoords;
    if (searchLocation) {
      return {
        lat: searchLocation.lat,
        lng: searchLocation.lng,
        label: searchLocation.label,
      };
    }
    return {
      lat: DEFAULT_INDIA_CENTER.lat,
      lng: DEFAULT_INDIA_CENTER.lng,
      label: 'Bengaluru Center',
    };
  }, [customOrigin, userCoords, searchLocation]);

  const handleRequestGpsOrigin = () => {
    if (!navigator.geolocation) {
      toast.info('Browser GPS unavailable — type any starting area in India.');
      setEditingOrigin(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const live = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: 'Your Live Location',
        };
        setCustomOrigin(null);
        setEditingOrigin(false);
        onUpdateUserCoords(live);
        toast.success('Recalculated directions from your live GPS location.');
      },
      () => {
        setLocating(false);
        toast.info('Location permission blocked — pick a starting area manually.');
        setEditingOrigin(true);
      },
      {enableHighAccuracy: true, timeout: 6000}
    );
  };

  const handlePickOriginSuggestion = async (item: PlaceSuggestionItem) => {
    const resolved = await resolvePlaceCoordinates(item);
    if (resolved) {
      setCustomOrigin(resolved);
      setEditingOrigin(false);
      setOriginInput('');
    }
  };

  if (!slot) return null;

  const apiKey = getGoogleMapsApiKey();
  const availableBays = getAvailableBayCount(slot);
  const directDistanceKm = calculateDistanceKm(
    effectiveOrigin.lat,
    effectiveOrigin.lng,
    slot.lat,
    slot.lng
  );
  const googleMapsDirUrl = `https://www.google.com/maps/dir/?api=1&origin=${effectiveOrigin.lat},${effectiveOrigin.lng}&destination=${slot.lat},${slot.lng}&travelmode=${travelMode === 'WALKING' ? 'walking' : 'driving'}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden bg-[#090B10] border-zinc-800 text-zinc-100">
        {/* Dark Header */}
        <div className="border-b border-zinc-800/90 bg-[#0D1117] px-5 py-4 pr-12">
          <DialogHeader className="mb-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    {availableBays} of {slot.totalSlots} bays free
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{slot.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {slot.rating.toFixed(1)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono font-semibold text-white">
                    {formatCurrency(slot.hourlyRate)}/hr
                  </span>
                </div>
                <DialogTitle className="font-display text-lg sm:text-xl text-white mt-1 truncate">
                  {slot.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-400 truncate mt-0.5">
                  {slot.address}
                </DialogDescription>
              </div>

              {/* Travel Mode Switcher */}
              <div className="inline-flex items-center gap-1 rounded-xl border border-zinc-800 bg-[#090B10] p-1 shrink-0 self-start md:self-auto">
                {(
                  [
                    {id: 'DRIVING', label: 'Car', icon: Car},
                    {id: 'TWO_WHEELER', label: '2-Wheeler', icon: Bike},
                    {id: 'WALKING', label: 'Walk', icon: Footprints},
                  ] as const
                ).map((mode) => {
                  const Icon = mode.icon;
                  const active = travelMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setTravelMode(mode.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap',
                        active
                          ? 'bg-sky-600 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {mode.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Split Body: Simple Dark Map + Turn-by-Turn Guide */}
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Map Column */}
          <div className="lg:col-span-7 h-[340px] sm:h-[420px] lg:h-[520px] relative border-b lg:border-b-0 lg:border-r border-zinc-800/90 bg-[#090B10]">
            {apiKey ? (
              <DarkRouteMapCanvas
                origin={effectiveOrigin}
                destination={{
                  lat: slot.lat,
                  lng: slot.lng,
                  title: slot.title,
                  hourlyRate: slot.hourlyRate,
                  hasEv: slot.amenities.includes('ev_charger'),
                }}
                travelMode={travelMode}
                focusedStepCoords={focusedStepCoords}
                onRouteComputed={setRouteSummary}
                onRouteLoadingChange={setRouteLoading}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-zinc-400 space-y-2">
                <Navigation className="h-6 w-6 text-sky-400" />
                <p className="text-sm font-medium text-white">
                  Direct Distance: {directDistanceKm.toFixed(1)} km
                </p>
                <p>
                  Configure Google Maps API key to load interactive dark route tiles.
                </p>
              </div>
            )}

            {/* Floating Live Route Badge */}
            <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-2 rounded-lg border border-zinc-700/80 bg-[#0D1117]/90 px-3 py-1.5 text-xs text-zinc-200 shadow-lg backdrop-blur-md">
              {routeLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
                  <span>Calculating route from your location...</span>
                </>
              ) : (
                <>
                  <Navigation className="h-3.5 w-3.5 text-sky-400" />
                  <span className="font-mono font-semibold text-white">
                    {routeSummary?.durationText || `~${Math.max(2, Math.round(directDistanceKm * 2.5))} min`}
                  </span>
                  <span className="text-zinc-500">·</span>
                  <span className="font-mono text-zinc-300">
                    {routeSummary?.distanceText || `${directDistanceKm.toFixed(1)} km`}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right Panel: Brief Facility Info, Origin Control, Turn-by-Turn Guide & Booking CTA */}
          <div className="lg:col-span-5 flex flex-col h-full lg:h-[520px] bg-[#0B0E14]">
            {/* Starting Location Bar */}
            <div className="p-3.5 sm:px-4 border-b border-zinc-800/80 space-y-2.5 bg-[#0D1117]/70">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">
                    Calculated From User Location
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 mt-0.5 truncate">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                    <span className="truncate">{effectiveOrigin.label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleRequestGpsOrigin}
                    disabled={locating}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    {locating ? (
                      <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
                    ) : (
                      <Crosshair className="h-3 w-3 text-emerald-400" />
                    )}
                    My GPS
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingOrigin((p) => !p)}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    {editingOrigin ? 'Cancel' : 'Change'}
                  </button>
                </div>
              </div>

              {editingOrigin && (
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-[#090B10] px-2.5 py-1.5">
                    {loadingOriginSearch ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400 shrink-0" />
                    ) : (
                      <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                    )}
                    <input
                      type="text"
                      autoFocus
                      value={originInput}
                      onChange={(e) => setOriginInput(e.target.value)}
                      placeholder="Enter starting place in India..."
                      className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                    />
                  </div>
                  {originSuggestions.length > 0 && (
                    <div className="mt-1.5 rounded-lg border border-zinc-800 bg-[#090B10] max-h-40 overflow-y-auto slim-scrollbar divide-y divide-zinc-800/60">
                      {originSuggestions.slice(0, 5).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => void handlePickOriginSuggestion(item)}
                          className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800/80 cursor-pointer"
                        >
                          <MapPin className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium truncate">{item.mainText}</div>
                            <div className="text-[10px] text-zinc-500 truncate">
                              {item.secondaryText}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Panel View Switcher: Brief Info vs Full Directions */}
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-zinc-800 bg-[#090B10] p-1">
                <button
                  type="button"
                  onClick={() => setPanelTab('overview')}
                  className={cn(
                    'rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer',
                    panelTab === 'overview'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  Brief Info
                </button>
                <button
                  type="button"
                  onClick={() => setPanelTab('directions')}
                  className={cn(
                    'rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5',
                    panelTab === 'directions'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  Directions
                  {routeSummary && (
                    <span className="font-mono text-[10px] opacity-80">
                      ({routeSummary.steps.length})
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto slim-scrollbar p-4 space-y-4">
              {panelTab === 'overview' ? (
                (() => {
                  const gallery =
                    slot.photoGallery && slot.photoGallery.length > 0
                      ? slot.photoGallery
                      : slot.customImageUrl
                        ? [slot.customImageUrl]
                        : [];
                  const safePhotoIdx =
                    gallery.length > 0 ? activePhotoIdx % gallery.length : 0;
                  const currentPhotoUrl = gallery[safePhotoIdx];
                  const currentAttribution =
                    slot.photoAttributions?.[safePhotoIdx];
                  const evReadyCount = slot.bays.filter(
                    (b) => b.status === 'ev_ready'
                  ).length;
                  const occupiedCount = slot.bays.filter(
                    (b) => b.status === 'occupied'
                  ).length;

                  return (
                    <>
                      {/* Facility Visual Showcase (Google Place Photos or Architectural Fallback) */}
                      <div className="relative h-44 rounded-xl overflow-hidden border border-zinc-800 bg-[#0D1117]">
                        <ParkingThumbnail
                          thumbnailId={slot.thumbnailId}
                          customImageUrl={currentPhotoUrl}
                          lat={slot.lat}
                          lng={slot.lng}
                          alt={slot.title}
                          className="h-full w-full"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#090B10] via-[#090B10]/25 to-transparent" />

                        {gallery.length > 1 && (
                          <>
                            <button
                              type="button"
                              aria-label="Previous facility photo"
                              onClick={() =>
                                setActivePhotoIdx((i) =>
                                  (i - 1 + gallery.length) % gallery.length
                                )
                              }
                              className="absolute left-2.5 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm cursor-pointer"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label="Next facility photo"
                              onClick={() =>
                                setActivePhotoIdx((i) => (i + 1) % gallery.length)
                              }
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm cursor-pointer"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </>
                        )}

                        {/* Top Bar: Schedule & Photo Counter */}
                        <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between gap-2 text-[11px]">
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-0.5 text-zinc-100 backdrop-blur-sm">
                            <Clock className="h-3 w-3 text-emerald-400" />
                            {slot.is24Hours
                              ? 'Open 24 Hours'
                              : `${slot.openTime} – ${slot.closeTime}`}
                          </span>
                          {gallery.length > 0 && (
                            <span className="font-mono text-[10px] rounded-md bg-black/60 px-2 py-0.5 text-zinc-200 backdrop-blur-sm tabular-nums">
                              {safePhotoIdx + 1} / {gallery.length}
                            </span>
                          )}
                        </div>

                        {/* Bottom Info Overlay */}
                        <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium text-sky-300 truncate">
                              {slot.neighborhood}
                            </div>
                            {currentAttribution?.displayName && (
                              <div className="text-[10px] text-zinc-300 truncate">
                                Photo by{' '}
                                {currentAttribution.uri ? (
                                  <a
                                    href={currentAttribution.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline hover:text-white"
                                  >
                                    {currentAttribution.displayName}
                                  </a>
                                ) : (
                                  currentAttribution.displayName
                                )}
                              </div>
                            )}
                          </div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 shrink-0">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {slot.id.startsWith('gmp_')
                              ? 'Google Verified'
                              : 'Partner Verified'}
                          </span>
                        </div>
                      </div>

                      {/* 4-Metric Quick Telemetry Strip */}
                      <div className="grid grid-cols-4 divide-x divide-zinc-800 rounded-xl border border-zinc-800/90 bg-[#0D1117] py-2.5 text-center">
                        <div className="px-1.5">
                          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                            Drive ETA
                          </div>
                          <div className="font-mono text-xs font-semibold tabular-nums text-sky-400 mt-0.5">
                            {routeLoading
                              ? '...'
                              : routeSummary?.durationText ||
                                `~${Math.max(2, Math.round(directDistanceKm * 2.5))} min`}
                          </div>
                        </div>
                        <div className="px-1.5">
                          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                            Distance
                          </div>
                          <div className="font-mono text-xs font-semibold tabular-nums text-white mt-0.5">
                            {routeSummary?.distanceText ||
                              `${directDistanceKm.toFixed(1)} km`}
                          </div>
                        </div>
                        <div className="px-1.5">
                          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                            Free Bays
                          </div>
                          <div className="font-mono text-xs font-semibold tabular-nums text-emerald-400 mt-0.5">
                            {availableBays}/{slot.totalSlots}
                          </div>
                        </div>
                        <div className="px-1.5">
                          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                            Reviews
                          </div>
                          <div className="font-mono text-xs font-semibold tabular-nums text-amber-300 mt-0.5">
                            {slot.rating.toFixed(1)} ({slot.reviewCount})
                          </div>
                        </div>
                      </div>

                      {/* Facility Details & Bay Range Card */}
                      <div className="rounded-xl border border-zinc-800/90 bg-[#0D1117]/70 p-3.5 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-800/80">
                          <span className="text-zinc-400">
                            Operator:{' '}
                            <span className="text-zinc-100 font-medium">
                              {slot.vendorName}
                            </span>
                          </span>
                          <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                            Bays {slot.slotPrefix}1–{slot.slotPrefix}
                            {slot.totalSlots}
                          </span>
                        </div>
                        <div className="flex items-start gap-2 text-zinc-300">
                          <MapPin className="h-3.5 w-3.5 text-sky-400 shrink-0 mt-0.5" />
                          <div className="min-w-0 leading-relaxed">
                            <div className="text-zinc-200">{slot.address}</div>
                            {slot.landmark && (
                              <div className="text-[11px] text-zinc-400 mt-0.5">
                                Landmark: {slot.landmark}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono tabular-nums">
                          <span className="text-emerald-400">
                            {availableBays - evReadyCount} Standard Free
                          </span>
                          <span className="text-zinc-600">·</span>
                          <span className="text-sky-400">
                            {evReadyCount} EV-Ready
                          </span>
                          <span className="text-zinc-600">·</span>
                          <span className="text-zinc-400">
                            {occupiedCount} Occupied
                          </span>
                        </div>
                      </div>

                      {/* Pricing Tiers (Tabular INR) */}
                      <div className="grid grid-cols-3 divide-x divide-zinc-800 rounded-xl border border-zinc-800/90 bg-[#0D1117] py-2.5 text-center">
                        <div className="px-2">
                          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                            Hourly
                          </div>
                          <div className="font-mono text-sm font-semibold tabular-nums text-white mt-0.5">
                            {formatCurrency(slot.hourlyRate)}
                          </div>
                        </div>
                        <div className="px-2">
                          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                            Daily Cap
                          </div>
                          <div className="font-mono text-sm font-semibold tabular-nums text-zinc-200 mt-0.5">
                            {formatCurrency(slot.dailyRate)}
                          </div>
                        </div>
                        <div className="px-2">
                          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                            Monthly
                          </div>
                          <div className="font-mono text-sm font-semibold tabular-nums text-zinc-200 mt-0.5">
                            {formatCurrency(slot.monthlyRate)}
                          </div>
                        </div>
                      </div>

                      {/* Vehicle Support & Amenities */}
                      <div className="space-y-2.5 pt-1">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">
                            Supported Vehicles
                          </div>
                          <div className="mt-1 text-xs text-zinc-200 font-medium">
                            {slot.vehicleTypes.join(' · ')}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">
                            Facility Amenities
                          </div>
                          <div className="mt-1.5 grid grid-cols-2 gap-2">
                            {slot.amenities.map((amenityId) => {
                              const Icon = MODAL_AMENITY_ICONS[amenityId];
                              return (
                                <div
                                  key={amenityId}
                                  className="flex items-center gap-2 text-xs text-zinc-300"
                                >
                                  <Icon className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                                  <span className="truncate">
                                    {AMENITY_META[amenityId].label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Quick Route Summary Bridge */}
                      <button
                        type="button"
                        onClick={() => setPanelTab('directions')}
                        className="w-full flex items-center justify-between rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2.5 text-left hover:bg-sky-500/15 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-sky-300">
                            Turn-by-Turn Map Guide
                          </div>
                          <div className="text-[11px] text-zinc-300 font-mono tabular-nums mt-0.5">
                            {routeLoading
                              ? 'Calculating route...'
                              : `${routeSummary?.durationText || `~${Math.max(2, Math.round(directDistanceKm * 2.5))} min`} · ${routeSummary?.distanceText || `${directDistanceKm.toFixed(1)} km`}`}
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-400 shrink-0">
                          View Steps
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    </>
                  );
                })()
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    <span>Map Guide &amp; Directions</span>
                    {routeSummary && (
                      <span className="font-mono text-[10px] text-zinc-500 normal-case">
                        {routeSummary.steps.length} steps
                      </span>
                    )}
                  </div>

                  {routeLoading ? (
                    <div className="py-10 text-center text-xs text-zinc-400 space-y-2">
                      <Loader2 className="h-5 w-5 animate-spin text-sky-400 mx-auto" />
                      <p>Building turn-by-turn navigation guide...</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {(routeSummary?.steps || []).map((step, idx) => {
                        const StepIcon = getManeuverIcon(step.maneuver);
                        const active = focusedStepId === step.id;
                        return (
                          <button
                            key={step.id}
                            type="button"
                            onClick={() => {
                              setFocusedStepId(step.id);
                              if (step.coords) setFocusedStepCoords(step.coords);
                            }}
                            className={cn(
                              'w-full flex items-start gap-3 rounded-xl border p-2.5 text-left transition-colors cursor-pointer',
                              active
                                ? 'border-sky-500/70 bg-sky-500/10'
                                : 'border-zinc-800/80 bg-[#0D1117]/60 hover:border-zinc-700 hover:bg-zinc-900/70'
                            )}
                          >
                            <span
                              className={cn(
                                'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs',
                                active
                                  ? 'border-sky-400 bg-sky-500/20 text-sky-300'
                                  : 'border-zinc-700/80 bg-zinc-900 text-zinc-300'
                              )}
                            >
                              <StepIcon className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-zinc-100 leading-snug">
                                <span className="font-mono text-[10px] text-zinc-500 mr-1.5">
                                  {idx + 1}.
                                </span>
                                {step.instruction}
                              </div>
                              {(step.distanceText || step.durationText) && (
                                <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                                  {step.distanceText && <span>{step.distanceText}</span>}
                                  {step.distanceText && step.durationText && <span>·</span>}
                                  {step.durationText && <span>{step.durationText}</span>}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="border-t border-zinc-800/90 bg-[#0D1117] p-4 flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                variant="emerald"
                className="flex-1"
                disabled={!slot.isOpen || availableBays === 0}
                onClick={() => {
                  onOpenChange(false);
                  onBookSlot(slot);
                }}
              >
                <CheckCircle2 className="h-4 w-4" />
                Reserve Bay ({formatCurrency(slot.hourlyRate)}/h)
              </Button>
              <a
                href={googleMapsDirUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                Maps App
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
