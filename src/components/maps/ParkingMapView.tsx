import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  APILoadingStatus,
  AdvancedMarker,
  Map as GoogleMap,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Clock,
  Crosshair,
  Loader2,
  MapPin,
  Minus,
  Navigation,
  Plus,
  Search,
  Star,
  X,
  Zap,
} from 'lucide-react';
import {AMENITY_META, DEFAULT_INDIA_CENTER} from '../../data/indiaParkingConfig';
import type {ParkingSlot, SearchLocationFilter} from '../../types/parking';
import {
  calculateDistanceKm,
  cn,
  formatCurrency,
  getAvailableBayCount,
} from '../../lib/utils';
import {Button} from '../ui/button';
import {ParkingThumbnail} from '../ui/ParkingThumbnail';
import {
  getGoogleMapsApiKey,
  useIndiaPlaceAutocomplete,
  type PlaceSuggestionItem,
} from './PlacesProvider';

interface ParkingMarkerItemProps {
  slot: ParkingSlot;
  isSelected: boolean;
  onSelect: (slot: ParkingSlot) => void;
}

function ParkingMarkerItem({slot, isSelected, onSelect}: ParkingMarkerItemProps) {
  const availableCount = getAvailableBayCount(slot);
  const hasAvailability = slot.isOpen && availableCount > 0;
  const hasEv = slot.amenities.includes('ev_charger');

  const handleClick = useCallback(() => {
    onSelect(slot);
  }, [onSelect, slot]);

  return (
    <AdvancedMarker
      position={{lat: slot.lat, lng: slot.lng}}
      title={slot.title}
      zIndex={isSelected ? 1000 : hasAvailability ? 100 : 10}
      onClick={handleClick}
    >
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-xl border transition-transform duration-150 cursor-pointer whitespace-nowrap',
          isSelected
            ? 'bg-sky-500 text-slate-950 border-sky-300 scale-110'
            : hasAvailability
              ? 'bg-[#0D1117]/95 text-zinc-100 border-emerald-500/60 hover:scale-105 hover:border-sky-400'
              : 'bg-[#111318]/90 text-zinc-400 border-rose-500/50'
        )}
      >
        <span
          className={cn(
            'inline-block h-2 w-2 rounded-full shrink-0',
            isSelected ? 'bg-slate-950' : hasAvailability ? 'bg-emerald-400' : 'bg-rose-400'
          )}
        />
        <span className="font-mono tabular-nums">{formatCurrency(slot.hourlyRate)}/h</span>
        {hasEv && (
          <Zap
            className={cn(
              'h-3 w-3 shrink-0',
              isSelected ? 'text-slate-950' : 'text-sky-400'
            )}
          />
        )}
      </button>
    </AdvancedMarker>
  );
}

interface MapPlaceSearchProps {
  onFocusLocation: (coords: {lat: number; lng: number}, label: string) => void;
}

function MapPlaceSearch({onFocusLocation}: MapPlaceSearchProps) {
  const [queryText, setQueryText] = useState('');
  const [focused, setFocused] = useState(false);
  const {
    suggestions,
    loading,
    rateLimited,
    retryAfterSec,
    resolvePlaceCoordinates,
    resolveTextLocation,
  } = useIndiaPlaceAutocomplete(queryText);

  const handleSelectSuggestion = async (item: PlaceSuggestionItem) => {
    const resolved = await resolvePlaceCoordinates(item);
    if (resolved) {
      onFocusLocation({lat: resolved.lat, lng: resolved.lng}, resolved.label);
    }
    setQueryText('');
    setFocused(false);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (suggestions.length > 0) {
      await handleSelectSuggestion(suggestions[0]);
      return;
    }
    const resolved = await resolveTextLocation(queryText);
    if (resolved) {
      onFocusLocation({lat: resolved.lat, lng: resolved.lng}, resolved.label);
      setQueryText('');
      setFocused(false);
    }
  };

  return (
    <div className="relative w-full max-w-xs">
      <div className="flex items-center gap-2 rounded-lg border border-zinc-700/80 bg-[#0D1117]/95 px-3 py-1.5 shadow-xl backdrop-blur-md">
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 text-sky-400 animate-spin shrink-0" />
        ) : (
          <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
        )}
        <input
          type="text"
          value={queryText}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 180)}
          onChange={(e) => setQueryText(e.target.value)}
          onKeyDown={(e) => void handleKeyDown(e)}
          placeholder="Search any place in India..."
          className="w-full bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
        />
      </div>
      {focused && (suggestions.length > 0 || (rateLimited && retryAfterSec > 0)) && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-zinc-800 bg-[#0D1117] shadow-2xl max-h-60 overflow-y-auto slim-scrollbar">
          {rateLimited && retryAfterSec > 0 && (
            <li className="px-3 py-1.5 text-[10px] text-amber-300 bg-amber-500/10 border-b border-amber-500/20">
              Rate limit active — live search resumes in {retryAfterSec}s
            </li>
          )}
          {suggestions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  void handleSelectSuggestion(item);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800/80 cursor-pointer"
              >
                <MapPin className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium truncate">{item.mainText}</div>
                  <div className="text-[10px] text-zinc-500 truncate">
                    {item.secondaryText}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface InnerMapContentProps {
  slots: ParkingSlot[];
  selectedSlotId: string | null;
  searchLocation: SearchLocationFilter | null;
  userCoords: {lat: number; lng: number; label: string} | null;
  onRequestUserGps?: () => void;
  onLocationPicked?: (loc: SearchLocationFilter) => void;
  onSelectSlot: (slot: ParkingSlot) => void;
  onOpenGuide: (slot: ParkingSlot) => void;
  onBookSlot: (slot: ParkingSlot) => void;
  onMapError: () => void;
}

function InnerMapContent({
  slots,
  selectedSlotId,
  searchLocation,
  userCoords,
  onRequestUserGps,
  onLocationPicked,
  onSelectSlot,
  onOpenGuide,
  onBookSlot,
  onMapError,
}: InnerMapContentProps) {
  const map = useMap('parkgrid-main-map');
  const coreLib = useMapsLibrary('core');
  const loadingStatus = useApiLoadingStatus();
  const [previewSlot, setPreviewSlot] = useState<ParkingSlot | null>(null);

  useEffect(() => {
    if (
      loadingStatus === APILoadingStatus.FAILED ||
      loadingStatus === APILoadingStatus.AUTH_FAILURE
    ) {
      onMapError();
    }
  }, [loadingStatus, onMapError]);

  const activeOrigin = useMemo(() => {
    if (searchLocation) return {lat: searchLocation.lat, lng: searchLocation.lng, label: searchLocation.label};
    if (userCoords) return userCoords;
    return null;
  }, [searchLocation, userCoords]);

  const selectedSlot = useMemo(
    () => slots.find((s) => s.id === selectedSlotId) || null,
    [slots, selectedSlotId]
  );

  // Sync preview card when selection changes
  useEffect(() => {
    setPreviewSlot(selectedSlot);
  }, [selectedSlot]);

  // Calculate custom viewport around user location + nearby parking slots
  const fitUserCustomView = useCallback(() => {
    if (!map || !coreLib) return;

    const origin = activeOrigin;
    if (origin && slots.length > 0) {
      const bounds = new coreLib.LatLngBounds();
      bounds.extend({lat: origin.lat, lng: origin.lng});
      const nearest = [...slots]
        .sort(
          (a, b) =>
            calculateDistanceKm(origin.lat, origin.lng, a.lat, a.lng) -
            calculateDistanceKm(origin.lat, origin.lng, b.lat, b.lng)
        )
        .slice(0, 6);
      nearest.forEach((s) => bounds.extend({lat: s.lat, lng: s.lng}));
      map.fitBounds(bounds, {top: 56, right: 44, bottom: 80, left: 44});
      return;
    }

    if (origin) {
      map.panTo({lat: origin.lat, lng: origin.lng});
      map.setZoom(13);
      return;
    }

    if (slots.length > 0) {
      const bounds = new coreLib.LatLngBounds();
      slots.slice(0, 8).forEach((s) => bounds.extend({lat: s.lat, lng: s.lng}));
      map.fitBounds(bounds, {top: 56, right: 44, bottom: 80, left: 44});
    }
  }, [map, coreLib, activeOrigin, slots]);

  useEffect(() => {
    if (!selectedSlot) {
      fitUserCustomView();
    }
  }, [fitUserCustomView, selectedSlot]);

  useEffect(() => {
    if (map && selectedSlot) {
      map.panTo({lat: selectedSlot.lat, lng: selectedSlot.lng});
      map.setZoom(14);
    }
  }, [map, selectedSlot]);

  const handleMarkerSelect = useCallback(
    (slot: ParkingSlot) => {
      setPreviewSlot(slot);
      onSelectSlot(slot);
    },
    [onSelectSlot]
  );

  const handleFocusLocation = useCallback(
    (coords: {lat: number; lng: number}, label: string) => {
      if (map) {
        map.panTo(coords);
        map.setZoom(13);
      }
      if (onLocationPicked) {
        onLocationPicked({label, lat: coords.lat, lng: coords.lng, source: 'place'});
      }
    },
    [map, onLocationPicked]
  );

  const defaultCenter = useMemo(() => {
    if (activeOrigin) return {lat: activeOrigin.lat, lng: activeOrigin.lng};
    if (slots.length > 0) return {lat: slots[0].lat, lng: slots[0].lng};
    return DEFAULT_INDIA_CENTER;
  }, [activeOrigin, slots]);

  return (
    <div className="relative h-full w-full bg-[#090B10]">
      {/* Top Dark Search + Location Controls */}
      <div className="absolute left-3 top-3 z-10 right-3 flex items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex-1 max-w-xs">
          <MapPlaceSearch onFocusLocation={handleFocusLocation} />
        </div>
        <div className="pointer-events-auto flex items-center gap-1.5">
          {onRequestUserGps && (
            <button
              type="button"
              onClick={onRequestUserGps}
              title="Center on my live GPS location"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/80 bg-[#0D1117]/95 px-2.5 py-1.5 text-xs font-medium text-emerald-300 shadow-xl hover:bg-zinc-800 cursor-pointer whitespace-nowrap backdrop-blur-md"
            >
              <Crosshair className="h-3.5 w-3.5 text-emerald-400" />
              My View
            </button>
          )}
          {map && (
            <button
              type="button"
              onClick={fitUserCustomView}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/80 bg-[#0D1117]/95 px-2.5 py-1.5 text-xs font-medium text-zinc-200 shadow-xl hover:bg-zinc-800 cursor-pointer whitespace-nowrap backdrop-blur-md"
            >
              <Navigation className="h-3.5 w-3.5 text-sky-400" />
              Recenter
            </button>
          )}
        </div>
      </div>

      {/* Simple Dark Google Map */}
      <GoogleMap
        id="parkgrid-main-map"
        mapId="DEMO_MAP_ID"
        defaultCenter={defaultCenter}
        defaultZoom={slots.length > 0 ? 13 : 5}
        gestureHandling="greedy"
        disableDefaultUI={true}
        colorScheme="DARK"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{width: '100%', height: '100%'}}
      >
        {activeOrigin && (
          <AdvancedMarker
            position={{lat: activeOrigin.lat, lng: activeOrigin.lng}}
            title={activeOrigin.label}
            zIndex={1500}
          >
            <div className="flex flex-col items-center">
              <span className="mb-1 rounded-md border border-emerald-400/50 bg-[#090B10]/95 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 shadow-lg whitespace-nowrap">
                {activeOrigin.label}
              </span>
              <div className="relative flex items-center justify-center">
                <span className="absolute h-7 w-7 rounded-full bg-emerald-400/35 animate-ping" />
                <span className="relative h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-[#090B10] shadow-md" />
              </div>
            </div>
          </AdvancedMarker>
        )}

        {slots.map((slot) => (
          <ParkingMarkerItem
            key={slot.id}
            slot={slot}
            isSelected={slot.id === selectedSlotId}
            onSelect={handleMarkerSelect}
          />
        ))}
      </GoogleMap>

      {/* Dark Zoom Controls */}
      {map && (
        <div
          className={cn(
            'absolute right-3 z-10 flex flex-col gap-1.5 transition-all',
            previewSlot ? 'bottom-44' : 'bottom-3'
          )}
        >
          <button
            type="button"
            onClick={() => map.setZoom((map.getZoom() || 13) + 1)}
            aria-label="Zoom in"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/80 bg-[#0D1117]/95 text-zinc-200 hover:bg-zinc-800 shadow-xl cursor-pointer backdrop-blur-md"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => map.setZoom((map.getZoom() || 13) - 1)}
            aria-label="Zoom out"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700/80 bg-[#0D1117]/95 text-zinc-200 hover:bg-zinc-800 shadow-xl cursor-pointer backdrop-blur-md"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Sleek Dark Selected Facility Brief Floating Card */}
      {previewSlot && (
        <div className="absolute left-3 right-3 bottom-3 z-10 rounded-xl border border-zinc-700/90 bg-[#0D1117]/95 p-3 text-zinc-100 shadow-2xl backdrop-blur-md">
          <div className="flex items-start gap-3">
            <div className="hidden sm:block h-16 w-20 shrink-0 overflow-hidden rounded-lg border border-zinc-800">
              <ParkingThumbnail
                thumbnailId={previewSlot.thumbnailId}
                customImageUrl={previewSlot.customImageUrl}
                gallery={previewSlot.photoGallery}
                attributions={previewSlot.photoAttributions}
                lat={previewSlot.lat}
                lng={previewSlot.lng}
                alt={previewSlot.title}
                className="h-full w-full"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                    <span className="font-semibold text-emerald-400 font-mono tabular-nums">
                      {getAvailableBayCount(previewSlot)}/{previewSlot.totalSlots} free
                    </span>
                    <span>·</span>
                    <span>{previewSlot.category}</span>
                    <span>·</span>
                    <span className="font-mono tabular-nums">{previewSlot.distanceKm} km</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-0.5 text-amber-300">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {previewSlot.rating.toFixed(1)}
                    </span>
                  </div>
                  <div className="font-display text-sm font-semibold text-white truncate mt-0.5">
                    {previewSlot.title}
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate">
                    {previewSlot.address}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewSlot(null)}
                  aria-label="Dismiss map selection"
                  className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 cursor-pointer shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-zinc-400">
                <span className="inline-flex items-center gap-1 text-zinc-300">
                  <Clock className="h-3 w-3 text-sky-400" />
                  {previewSlot.is24Hours
                    ? 'Open 24/7'
                    : `${previewSlot.openTime}–${previewSlot.closeTime}`}
                </span>
                {previewSlot.amenities.slice(0, 3).map((amenityId) => (
                  <span key={amenityId} className="inline-flex items-center gap-1">
                    <span aria-hidden="true">·</span>
                    {AMENITY_META[amenityId].shortLabel}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenGuide(previewSlot)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              <Navigation className="h-3.5 w-3.5" />
              Brief Info &amp; Route Guide
            </button>
            <button
              type="button"
              onClick={() => onBookSlot(previewSlot)}
              className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 transition-colors cursor-pointer"
            >
              Book · {formatCurrency(previewSlot.hourlyRate)}/h
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ParkingMapViewProps {
  slots: ParkingSlot[];
  selectedSlotId: string | null;
  searchLocation?: SearchLocationFilter | null;
  userCoords?: {lat: number; lng: number; label: string} | null;
  onRequestUserGps?: () => void;
  onLocationPicked?: (loc: SearchLocationFilter) => void;
  onSelectSlot: (slot: ParkingSlot) => void;
  onOpenGuide: (slot: ParkingSlot) => void;
  onBookSlot: (slot: ParkingSlot) => void;
  isDark: boolean;
}

export function ParkingMapView({
  slots,
  selectedSlotId,
  searchLocation = null,
  userCoords = null,
  onRequestUserGps,
  onLocationPicked,
  onSelectSlot,
  onOpenGuide,
  onBookSlot,
}: ParkingMapViewProps) {
  const apiKey = getGoogleMapsApiKey();
  const [mapFailed, setMapFailed] = useState(false);

  if (!apiKey || mapFailed) {
    return (
      <div className="relative h-full min-h-[440px] w-full overflow-hidden rounded-xl border border-zinc-800 bg-[#090B10] p-5 flex flex-col justify-between text-zinc-100">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">
              Dark Spatial Zone Map
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {apiKey
                ? 'Live map tiles unavailable right now — showing interactive dark bay coordinates.'
                : 'Showing spatial zone map for Indian metro parking hubs.'}
            </p>
          </div>
          {mapFailed && (
            <Button size="sm" variant="outline" onClick={() => setMapFailed(false)}>
              Retry Map
            </Button>
          )}
        </div>

        <div className="relative my-4 flex-1 min-h-[300px] rounded-lg border border-zinc-800 bg-[#0D1117] overflow-hidden p-4">
          {slots.map((slot, index) => {
            const available = getAvailableBayCount(slot);
            const active = slot.id === selectedSlotId;
            const topPct = Math.min(82, Math.max(12, 16 + ((index * 19) % 66)));
            const leftPct = Math.min(82, Math.max(10, 14 + ((index * 23) % 70)));
            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => {
                  onSelectSlot(slot);
                  onOpenGuide(slot);
                }}
                style={{top: `${topPct}%`, left: `${leftPct}%`}}
                className={cn(
                  'absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-md transition-transform hover:scale-105 cursor-pointer whitespace-nowrap',
                  active
                    ? 'bg-sky-500 text-slate-950 border-sky-300 z-20 scale-105'
                    : available > 0 && slot.isOpen
                      ? 'bg-[#090B10] text-white border-emerald-500/70 z-10'
                      : 'bg-zinc-900 text-zinc-400 border-rose-500/60'
                )}
              >
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="max-w-[110px] truncate">{slot.neighborhood}</span>
                <span className="font-mono tabular-nums text-emerald-400">
                  {formatCurrency(slot.hourlyRate)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Click any facility pin to open directions and map guide</span>
          <span className="font-mono tabular-nums">{slots.length} locations</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[460px] w-full overflow-hidden rounded-xl border border-zinc-800 bg-[#090B10] shadow-xl">
      <InnerMapContent
        slots={slots}
        selectedSlotId={selectedSlotId}
        searchLocation={searchLocation}
        userCoords={userCoords}
        onRequestUserGps={onRequestUserGps}
        onLocationPicked={onLocationPicked}
        onSelectSlot={onSelectSlot}
        onOpenGuide={onOpenGuide}
        onBookSlot={onBookSlot}
        onMapError={() => setMapFailed(true)}
      />
    </div>
  );
}
