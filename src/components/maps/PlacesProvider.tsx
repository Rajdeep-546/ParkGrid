import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {
  APILoadingStatus,
  APIProvider,
  useApiLoadingStatus,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {INDIA_CITY_CENTERS, INDIA_HUB_PRESETS} from '../../data/indiaParkingConfig';
import {calculateDistanceKm, generateBays, sanitizeId} from '../../lib/utils';
import type {AmenityId, ParkingSlot, VehicleType} from '../../types/parking';

const ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];

export function getGoogleMapsApiKey(): string {
  const viteKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (viteKey && typeof viteKey === 'string' && viteKey.trim() !== '') {
    return viteKey.trim();
  }
  if (typeof __GOOGLE_MAPS_API_KEY__ === 'string' && __GOOGLE_MAPS_API_KEY__.trim() !== '') {
    return __GOOGLE_MAPS_API_KEY__.trim();
  }
  return '';
}

interface PlacesContextValue {
  placesLib: google.maps.PlacesLibrary | null;
  isLoading: boolean;
  hasApiKey: boolean;
  isFailed: boolean;
}

const PlacesContext = createContext<PlacesContextValue>({
  placesLib: null,
  isLoading: false,
  hasApiKey: false,
  isFailed: false,
});

function PlacesBridge({children}: {children: React.ReactNode}) {
  const placesLib = useMapsLibrary('places');
  const loadingStatus = useApiLoadingStatus();
  const isFailed =
    loadingStatus === APILoadingStatus.FAILED ||
    loadingStatus === APILoadingStatus.AUTH_FAILURE;
  const isLoading = !isFailed && !placesLib;

  return (
    <PlacesContext.Provider
      value={{
        placesLib,
        isLoading,
        hasApiKey: true,
        isFailed,
      }}
    >
      {children}
    </PlacesContext.Provider>
  );
}

export function MapsRootProvider({children}: {children: React.ReactNode}) {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return (
      <PlacesContext.Provider
        value={{
          placesLib: null,
          isLoading: false,
          hasApiKey: false,
          isFailed: false,
        }}
      >
        {children}
      </PlacesContext.Provider>
    );
  }
  return (
    <APIProvider
      apiKey={apiKey}
      libraries={['marker', 'places', 'routes']}
      language="en"
      region="IN"
    >
      <PlacesBridge>{children}</PlacesBridge>
    </APIProvider>
  );
}

export function useSharedPlacesLibrary(): google.maps.PlacesLibrary | null {
  return useContext(PlacesContext).placesLib;
}

export function useMapsPlacesStatus(): PlacesContextValue {
  return useContext(PlacesContext);
}

export interface PlaceSuggestionItem {
  id: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
  source: 'google' | 'hub';
  coords?: {lat: number; lng: number};
  rawSuggestion?: google.maps.places.AutocompleteSuggestion;
}

const SEARCH_RATE_WINDOW_MS = 30_000;
const MAX_SEARCH_REQUESTS_PER_WINDOW = 10;
const MIN_LIVE_SEARCH_GAP_MS = 650;
const SEARCH_RATE_EVENT = 'parkgrid-search-rate-limit';

const searchRequestTimestamps: number[] = [];
let lastLiveSearchAt = 0;

const autocompleteCache = new Map<string, PlaceSuggestionItem[]>();
const textSearchCache = new Map<string, ParkingSlot[]>();
const nearbySearchCache = new Map<string, ParkingSlot[]>();

function pruneSearchTimestamps(now: number) {
  while (
    searchRequestTimestamps.length > 0 &&
    now - searchRequestTimestamps[0] >= SEARCH_RATE_WINDOW_MS
  ) {
    searchRequestTimestamps.shift();
  }
}

export function getSearchRateLimitStatus() {
  const now = Date.now();
  pruneSearchTimestamps(now);
  const count = searchRequestTimestamps.length;
  const remaining = Math.max(0, MAX_SEARCH_REQUESTS_PER_WINDOW - count);
  let retryAfterMs = 0;

  if (count >= MAX_SEARCH_REQUESTS_PER_WINDOW) {
    retryAfterMs = Math.max(
      1000,
      SEARCH_RATE_WINDOW_MS - (now - searchRequestTimestamps[0])
    );
  } else if (lastLiveSearchAt > 0 && now - lastLiveSearchAt < MIN_LIVE_SEARCH_GAP_MS) {
    retryAfterMs = MIN_LIVE_SEARCH_GAP_MS - (now - lastLiveSearchAt);
  }

  return {
    limited: count >= MAX_SEARCH_REQUESTS_PER_WINDOW,
    retryAfterSec: retryAfterMs > 0 ? Math.max(1, Math.ceil(retryAfterMs / 1000)) : 0,
    remaining,
    maxRequests: MAX_SEARCH_REQUESTS_PER_WINDOW,
  };
}

function notifyRateLimitChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SEARCH_RATE_EVENT));
  }
}

export function consumeSearchRateLimit(): {
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
} {
  const now = Date.now();
  pruneSearchTimestamps(now);

  if (searchRequestTimestamps.length >= MAX_SEARCH_REQUESTS_PER_WINDOW) {
    const waitMs = Math.max(
      1000,
      SEARCH_RATE_WINDOW_MS - (now - searchRequestTimestamps[0])
    );
    notifyRateLimitChange();
    return {
      allowed: false,
      retryAfterSec: Math.ceil(waitMs / 1000),
      remaining: 0,
    };
  }

  if (lastLiveSearchAt > 0 && now - lastLiveSearchAt < MIN_LIVE_SEARCH_GAP_MS) {
    const gapWaitSec = Math.max(
      1,
      Math.ceil((MIN_LIVE_SEARCH_GAP_MS - (now - lastLiveSearchAt)) / 1000)
    );
    return {
      allowed: false,
      retryAfterSec: gapWaitSec,
      remaining: Math.max(0, MAX_SEARCH_REQUESTS_PER_WINDOW - searchRequestTimestamps.length),
    };
  }

  searchRequestTimestamps.push(now);
  lastLiveSearchAt = now;
  notifyRateLimitChange();
  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: Math.max(0, MAX_SEARCH_REQUESTS_PER_WINDOW - searchRequestTimestamps.length),
  };
}

export function useSearchRateLimit() {
  const [status, setStatus] = useState(() => getSearchRateLimitStatus());

  useEffect(() => {
    const sync = () => setStatus(getSearchRateLimitStatus());
    window.addEventListener(SEARCH_RATE_EVENT, sync);
    const interval = setInterval(sync, 1000);
    return () => {
      window.removeEventListener(SEARCH_RATE_EVENT, sync);
      clearInterval(interval);
    };
  }, []);

  return status;
}

function handleGoogleMapsQuotaError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('429') ||
    msg.includes('OVER_QUERY_LIMIT')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

async function fetchTextSearchPlaceSuggestions(
  placesLib: google.maps.PlacesLibrary,
  trimmed: string
): Promise<PlaceSuggestionItem[]> {
  try {
    const res = await placesLib.Place.searchByText({
      textQuery: `${trimmed}, India`,
      fields: ['id', 'displayName', 'formattedAddress', 'location'],
      region: 'IN',
      maxResultCount: 7,
      internalUsageAttributionIds: ATTRIBUTION_IDS,
    });
    return (res.places || [])
      .filter((p) => Boolean(p.location))
      .map((p, idx) => ({
        id: p.id || `gmp_txt_${idx}`,
        mainText: p.displayName || trimmed,
        secondaryText: p.formattedAddress || 'India',
        fullText: p.formattedAddress
          ? `${p.displayName || trimmed}, ${p.formattedAddress}`
          : p.displayName || trimmed,
        source: 'google' as const,
        coords: {
          lat: p.location!.lat(),
          lng: p.location!.lng(),
        },
      }));
  } catch (err) {
    console.warn('[ParkGrid Places] Text suggestion fallback failed:', err);
    handleGoogleMapsQuotaError(err);
    return [];
  }
}

export function useIndiaPlaceAutocomplete(queryText: string) {
  const placesLib = useSharedPlacesLibrary();
  const [googleSuggestions, setGoogleSuggestions] = useState<PlaceSuggestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [retryAfterSec, setRetryAfterSec] = useState(0);
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    if (!rateLimited || retryAfterSec <= 0) return;
    const t = setInterval(() => {
      const next = getSearchRateLimitStatus();
      setRateLimited(next.limited);
      setRetryAfterSec(next.retryAfterSec);
    }, 1000);
    return () => clearInterval(t);
  }, [rateLimited, retryAfterSec]);

  useEffect(() => {
    const trimmed = queryText.trim();
    if (!placesLib || trimmed.length < 2) {
      setGoogleSuggestions([]);
      setLoading(false);
      return;
    }

    const cacheKey = trimmed.toLowerCase();
    const cached = autocompleteCache.get(cacheKey);
    if (cached) {
      setGoogleSuggestions(cached);
      setLoading(false);
      setRateLimited(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      const gate = consumeSearchRateLimit();
      if (!gate.allowed) {
        if (!cancelled) {
          setRateLimited(true);
          setRetryAfterSec(gate.retryAfterSec);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setRateLimited(false);
        setRetryAfterSec(0);
      }

      try {
        const {AutocompleteSessionToken, AutocompleteSuggestion} = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmed,
          includedRegionCodes: ['in'],
          language: 'en',
          sessionToken: sessionTokenRef.current,
          internalUsageAttributionIds: ATTRIBUTION_IDS,
        });
        if (cancelled) return;
        let mapped: PlaceSuggestionItem[] = res.suggestions
          .filter((s) => Boolean(s.placePrediction))
          .slice(0, 7)
          .map((s, idx) => {
            const pred = s.placePrediction!;
            return {
              id: pred.placeId || `gmp_pred_${idx}`,
              mainText: pred.mainText?.text || pred.text.text,
              secondaryText: pred.secondaryText?.text || 'India',
              fullText: pred.text.text,
              source: 'google',
              rawSuggestion: s,
            };
          });

        if (mapped.length === 0 && trimmed.length >= 3) {
          mapped = await fetchTextSearchPlaceSuggestions(placesLib, trimmed);
        }
        if (!cancelled) {
          if (mapped.length > 0) {
            if (autocompleteCache.size >= 60) {
              const firstKey = autocompleteCache.keys().next().value;
              if (firstKey) autocompleteCache.delete(firstKey);
            }
            autocompleteCache.set(cacheKey, mapped);
          }
          setGoogleSuggestions(mapped);
        }
      } catch (err) {
        console.warn('[ParkGrid Places] Autocomplete warning:', err);
        handleGoogleMapsQuotaError(err);
        if (!cancelled && trimmed.length >= 2) {
          const fallback = await fetchTextSearchPlaceSuggestions(placesLib, trimmed);
          if (!cancelled) setGoogleSuggestions(fallback);
        } else if (!cancelled) {
          setGoogleSuggestions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [placesLib, queryText]);

  const resolvePlaceCoordinates = useCallback(
    async (
      item: PlaceSuggestionItem
    ): Promise<{lat: number; lng: number; label: string} | null> => {
      if (item.coords) {
        return {
          lat: item.coords.lat,
          lng: item.coords.lng,
          label: item.mainText || item.fullText,
        };
      }
      if (item.rawSuggestion?.placePrediction) {
        try {
          const place = item.rawSuggestion.placePrediction.toPlace();
          await place.fetchFields({
            fields: ['location', 'displayName', 'formattedAddress'],
          });
          sessionTokenRef.current = null;
          if (place.location) {
            return {
              lat: place.location.lat(),
              lng: place.location.lng(),
              label: place.displayName || place.formattedAddress || item.mainText,
            };
          }
        } catch (err) {
          console.warn('[ParkGrid Places] fetchFields warning:', err);
          handleGoogleMapsQuotaError(err);
        }
      }

      if (placesLib) {
        const textFallback = await fetchTextSearchPlaceSuggestions(
          placesLib,
          item.fullText || item.mainText
        );
        if (textFallback[0]?.coords) {
          return {
            lat: textFallback[0].coords.lat,
            lng: textFallback[0].coords.lng,
            label: textFallback[0].mainText || item.mainText,
          };
        }
      }
      return null;
    },
    [placesLib]
  );

  const resolveTextLocation = useCallback(
    async (text: string): Promise<{lat: number; lng: number; label: string} | null> => {
      const trimmed = text.trim();
      if (!trimmed) return null;
      const lower = trimmed.toLowerCase();

      const cityMatch = INDIA_CITY_CENTERS.find((c) => c.city.toLowerCase() === lower);
      if (cityMatch) {
        return {lat: cityMatch.lat, lng: cityMatch.lng, label: cityMatch.city};
      }

      const hubMatch = INDIA_HUB_PRESETS.find((h) => h.label.toLowerCase().includes(lower));
      if (hubMatch && googleSuggestions.length === 0) {
        return {
          lat: hubMatch.lat,
          lng: hubMatch.lng,
          label: hubMatch.label.split(',')[0].trim(),
        };
      }

      if (googleSuggestions.length > 0) {
        const resolved = await resolvePlaceCoordinates(googleSuggestions[0]);
        if (resolved) return resolved;
      }

      if (placesLib) {
        const textMatches = await fetchTextSearchPlaceSuggestions(placesLib, trimmed);
        if (textMatches[0]?.coords) {
          return {
            lat: textMatches[0].coords.lat,
            lng: textMatches[0].coords.lng,
            label: textMatches[0].mainText,
          };
        }
      }
      return null;
    },
    [googleSuggestions, placesLib, resolvePlaceCoordinates]
  );

  // Merge Google Places autocomplete results with matching Indian city/hub shortcuts
  const q = queryText.trim().toLowerCase();
  const presetMatches: PlaceSuggestionItem[] = [
    ...INDIA_CITY_CENTERS.map((c) => ({
      id: `city_${c.city}`,
      mainText: c.city,
      secondaryText: 'Metro City, India',
      fullText: `${c.city}, India`,
      source: 'hub' as const,
      coords: {lat: c.lat, lng: c.lng},
    })),
    ...INDIA_HUB_PRESETS.map((h) => ({
      id: `hub_${h.label}`,
      mainText: h.label.split(',')[0].trim(),
      secondaryText: `${h.city}, India`,
      fullText: h.label,
      source: 'hub' as const,
      coords: {lat: h.lat, lng: h.lng},
    })),
  ].filter(
    (item) =>
      !q ||
      item.fullText.toLowerCase().includes(q) ||
      item.mainText.toLowerCase().includes(q)
  );

  const googleNames = new Set(googleSuggestions.map((g) => g.mainText.toLowerCase()));
  const filteredPresets = presetMatches.filter(
    (p) => !googleNames.has(p.mainText.toLowerCase())
  );

  const suggestions =
    googleSuggestions.length > 0
      ? [...googleSuggestions, ...filteredPresets.slice(0, 3)]
      : filteredPresets.slice(0, 8);

  return {
    suggestions,
    loading,
    rateLimited,
    retryAfterSec,
    hasGooglePlaces: Boolean(placesLib),
    resolvePlaceCoordinates,
    resolveTextLocation,
  };
}

function stableHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function mapGooglePlaceToParkingSlot(
  place: google.maps.places.Place,
  origin: {lat: number; lng: number},
  fallbackCityLabel: string
): ParkingSlot | null {
  if (!place.location) return null;
  const lat = place.location.lat();
  const lng = place.location.lng();
  const rawId = place.id || `${lat.toFixed(4)}_${lng.toFixed(4)}`;
  const safeId = sanitizeId(`gmp_${rawId}`);
  const h = stableHash(rawId);

  const title = place.displayName || 'Verified City Parking Facility';
  const address = place.formattedAddress || `${fallbackCityLabel}, India`;
  const totalSlots = 6 + (h % 10);
  const prefixChar = String.fromCharCode(65 + (h % 6));
  const hourlyRate = 40 + (h % 9) * 10;
  const dailyRate = hourlyRate * 6;
  const monthlyRate = dailyRate * 18;

  const amenities: AmenityId[] = ['cctv', 'well_lit'];
  if (h % 2 === 0) amenities.push('covered');
  if (h % 3 === 0) amenities.push('security');
  if (h % 4 === 0 || title.toLowerCase().includes('ev')) amenities.push('ev_charger');

  const vehicleTypes: VehicleType[] = ['Sedan', 'SUV', 'Two-Wheeler'];
  if (amenities.includes('ev_charger')) vehicleTypes.push('EV');

  const addressParts = address
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const neighborhood =
    addressParts.length >= 2
      ? addressParts.slice(-3, -1).join(', ') || fallbackCityLabel
      : fallbackCityLabel;

  const nowIso = new Date().toISOString();
  const thumbnailOptions = [
    'covered-vault',
    'ev-superhub',
    'glass-atrium',
    'transit-plaza',
    'waterfront-valet',
  ];

  const occupiedCodes: string[] = [];
  if (h % 3 === 0) occupiedCodes.push(`${prefixChar}1`);
  if (h % 5 === 0 && totalSlots > 3) occupiedCodes.push(`${prefixChar}3`);

  const rawPhotos = Array.isArray(place.photos) ? place.photos.slice(0, 8) : [];
  const photoGallery: string[] = [];
  const photoAttributions: {displayName?: string; uri?: string}[] = [];

  for (const photo of rawPhotos) {
    try {
      const uri = photo.getURI({maxWidth: 800, maxHeight: 500});
      if (uri) {
        photoGallery.push(uri);
        const author = photo.authorAttributions?.[0];
        photoAttributions.push({
          displayName: author?.displayName || undefined,
          uri: author?.uri || undefined,
        });
      }
    } catch {
      // Skip individual photo errors cleanly
    }
  }

  return {
    id: safeId,
    vendorId: 'google_maps_directory',
    vendorName: 'Google Maps Public Parking',
    title,
    address,
    landmark: fallbackCityLabel,
    neighborhood,
    category: amenities.includes('covered') ? 'Covered Garage' : 'Commercial Lot',
    lat,
    lng,
    distanceKm: calculateDistanceKm(origin.lat, origin.lng, lat, lng),
    totalSlots,
    slotPrefix: prefixChar,
    bays: generateBays(totalSlots, prefixChar, amenities.includes('ev_charger'), occupiedCodes),
    hourlyRate,
    dailyRate,
    monthlyRate,
    rating: Number((place.rating ?? 4.1 + (h % 8) * 0.1).toFixed(1)),
    reviewCount: place.userRatingCount ?? 12 + (h % 85),
    is24Hours: true,
    openTime: '00:00',
    closeTime: '23:59',
    isOpen: true,
    approvalStatus: 'approved',
    thumbnailId: thumbnailOptions[h % thumbnailOptions.length],
    customImageUrl: photoGallery[0],
    photoGallery: photoGallery.length > 0 ? photoGallery : undefined,
    photoAttributions: photoAttributions.length > 0 ? photoAttributions : undefined,
    vehicleTypes,
    amenities,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

const RICH_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'userRatingCount',
  'photos',
];
const RATING_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'userRatingCount',
];
const CORE_FIELDS = ['id', 'displayName', 'formattedAddress', 'location'];

async function runSearchNearbyWithFallback(
  placesLib: google.maps.PlacesLibrary,
  origin: {lat: number; lng: number}
): Promise<google.maps.places.Place[]> {
  try {
    const res = await placesLib.Place.searchNearby({
      fields: RICH_FIELDS,
      locationRestriction: {
        center: {lat: origin.lat, lng: origin.lng},
        radius: 15000,
      },
      includedTypes: ['parking'],
      maxResultCount: 20,
      rankPreference: placesLib.SearchNearbyRankPreference.DISTANCE,
      region: 'IN',
      internalUsageAttributionIds: ATTRIBUTION_IDS,
    });
    return res.places || [];
  } catch (err) {
    console.warn('[ParkGrid Places] searchNearby rich fields warning:', err);
    handleGoogleMapsQuotaError(err);
    try {
      const resRated = await placesLib.Place.searchNearby({
        fields: RATING_FIELDS,
        locationRestriction: {
          center: {lat: origin.lat, lng: origin.lng},
          radius: 15000,
        },
        includedTypes: ['parking'],
        maxResultCount: 20,
        rankPreference: placesLib.SearchNearbyRankPreference.DISTANCE,
        region: 'IN',
        internalUsageAttributionIds: ATTRIBUTION_IDS,
      });
      return resRated.places || [];
    } catch {
      try {
        const resCore = await placesLib.Place.searchNearby({
          fields: CORE_FIELDS,
          locationRestriction: {
            center: {lat: origin.lat, lng: origin.lng},
            radius: 15000,
          },
          includedTypes: ['parking'],
          maxResultCount: 20,
          rankPreference: placesLib.SearchNearbyRankPreference.DISTANCE,
          region: 'IN',
          internalUsageAttributionIds: ATTRIBUTION_IDS,
        });
        return resCore.places || [];
      } catch (coreErr) {
        console.warn('[ParkGrid Places] searchNearby core fallback warning:', coreErr);
        handleGoogleMapsQuotaError(coreErr);
        return [];
      }
    }
  }
}

async function runSearchByTextWithFallback(
  placesLib: google.maps.PlacesLibrary,
  textQuery: string,
  origin?: {lat: number; lng: number},
  maxResultCount = 16
): Promise<google.maps.places.Place[]> {
  const baseRequest = {
    textQuery,
    region: 'IN',
    maxResultCount,
    internalUsageAttributionIds: ATTRIBUTION_IDS,
    ...(origin
      ? {
          locationBias: {
            center: {lat: origin.lat, lng: origin.lng},
            radius: 18000,
          },
        }
      : {}),
  };

  try {
    const res = await placesLib.Place.searchByText({
      ...baseRequest,
      fields: RICH_FIELDS,
    });
    return res.places || [];
  } catch (err) {
    console.warn('[ParkGrid Places] searchByText rich fields warning:', err);
    handleGoogleMapsQuotaError(err);
    try {
      const resRated = await placesLib.Place.searchByText({
        ...baseRequest,
        fields: RATING_FIELDS,
      });
      return resRated.places || [];
    } catch {
      try {
        const resCore = await placesLib.Place.searchByText({
          ...baseRequest,
          fields: CORE_FIELDS,
        });
        return resCore.places || [];
      } catch (coreErr) {
        console.warn('[ParkGrid Places] searchByText core fallback warning:', coreErr);
        handleGoogleMapsQuotaError(coreErr);
        return [];
      }
    }
  }
}

async function enrichMissingPlacePhotos(
  places: google.maps.places.Place[],
  origin: {lat: number; lng: number},
  fallbackCityLabel: string,
  onPhotosEnriched?: (slots: ParkingSlot[]) => void
) {
  if (!onPhotosEnriched) return;
  const targets = places
    .filter((p) => p.id && (!Array.isArray(p.photos) || p.photos.length === 0))
    .slice(0, 12);
  if (targets.length === 0) return;

  const settled = await Promise.allSettled(
    targets.map((place) =>
      place.fetchFields({
        fields: ['photos', 'rating', 'userRatingCount'],
      })
    )
  );

  const anyFulfilled = settled.some((r) => r.status === 'fulfilled');
  if (!anyFulfilled) return;

  const enriched = places
    .map((p) => mapGooglePlaceToParkingSlot(p, origin, fallbackCityLabel))
    .filter((s): s is ParkingSlot => Boolean(s));
  if (enriched.some((s) => Boolean(s.photoGallery?.length))) {
    onPhotosEnriched(enriched);
  }
}

export async function fetchNearbyParkingFromGooglePlaces(
  placesLib: google.maps.PlacesLibrary,
  origin: {lat: number; lng: number; label: string},
  onPhotosEnriched?: (slots: ParkingSlot[]) => void
): Promise<ParkingSlot[]> {
  const cacheKey = `${origin.lat.toFixed(3)}_${origin.lng.toFixed(3)}_${origin.label.toLowerCase()}`;
  const cached = nearbySearchCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let places = await runSearchNearbyWithFallback(placesLib, origin);

  if (places.length === 0) {
    places = await runSearchByTextWithFallback(
      placesLib,
      `parking near ${origin.label}, India`,
      origin,
      16
    );
  }

  if (places.length === 0) {
    places = await runSearchByTextWithFallback(
      placesLib,
      `car parking ${origin.label} India`,
      undefined,
      12
    );
  }

  void enrichMissingPlacePhotos(places, origin, origin.label, (enrichedSlots) => {
    nearbySearchCache.set(cacheKey, enrichedSlots);
    onPhotosEnriched?.(enrichedSlots);
  });

  const mapped = places
    .map((p) => mapGooglePlaceToParkingSlot(p, origin, origin.label))
    .filter((s): s is ParkingSlot => Boolean(s));

  if (mapped.length > 0) {
    nearbySearchCache.set(cacheKey, mapped);
  }
  return mapped;
}

export async function fetchMoreParkingFromGooglePlaces(
  placesLib: google.maps.PlacesLibrary,
  origin: {lat: number; lng: number; label: string},
  batchIndex: number,
  onPhotosEnriched?: (slots: ParkingSlot[]) => void,
  onRateLimited?: (retryAfterSec: number) => void
): Promise<ParkingSlot[]> {
  const cleanLabel = origin.label
    .replace(/^Nearby:\s*/i, '')
    .replace(/\s*\(Hub Default\)$/i, '')
    .trim() || 'India';
  const queries = [
    `pay and park garage ${cleanLabel} India`,
    `multi level car parking EV hub ${cleanLabel} India`,
  ];
  const query = queries[batchIndex % queries.length];
  const cacheKey = `more_${batchIndex}_${origin.lat.toFixed(3)}_${origin.lng.toFixed(3)}_${cleanLabel.toLowerCase()}`;
  const cached = nearbySearchCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const gate = consumeSearchRateLimit();
  if (!gate.allowed) {
    onRateLimited?.(gate.retryAfterSec);
    return [];
  }

  const places = await runSearchByTextWithFallback(placesLib, query, origin, 20);
  void enrichMissingPlacePhotos(places, origin, cleanLabel, (enrichedSlots) => {
    nearbySearchCache.set(cacheKey, enrichedSlots);
    onPhotosEnriched?.(enrichedSlots);
  });

  const mapped = places
    .map((p) => mapGooglePlaceToParkingSlot(p, origin, cleanLabel))
    .filter((s): s is ParkingSlot => Boolean(s));

  if (mapped.length > 0) {
    nearbySearchCache.set(cacheKey, mapped);
  }
  return mapped;
}

export async function searchParkingByTextFromGooglePlaces(
  placesLib: google.maps.PlacesLibrary,
  queryText: string,
  origin: {lat: number; lng: number},
  onPhotosEnriched?: (slots: ParkingSlot[]) => void,
  onRateLimited?: (retryAfterSec: number) => void
): Promise<ParkingSlot[]> {
  const norm = queryText.trim().toLowerCase();
  const cacheKey = `${norm}_${origin.lat.toFixed(2)}_${origin.lng.toFixed(2)}`;
  const cached = textSearchCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const gate = consumeSearchRateLimit();
  if (!gate.allowed) {
    onRateLimited?.(gate.retryAfterSec);
    return [];
  }

  const places = await runSearchByTextWithFallback(
    placesLib,
    `${queryText} parking India`,
    undefined,
    14
  );

  void enrichMissingPlacePhotos(places, origin, queryText, (enrichedSlots) => {
    textSearchCache.set(cacheKey, enrichedSlots);
    onPhotosEnriched?.(enrichedSlots);
  });

  const mapped = places
    .map((p) => mapGooglePlaceToParkingSlot(p, origin, queryText))
    .filter((s): s is ParkingSlot => Boolean(s));

  if (mapped.length > 0) {
    if (textSearchCache.size >= 40) {
      const firstKey = textSearchCache.keys().next().value;
      if (firstKey) textSearchCache.delete(firstKey);
    }
    textSearchCache.set(cacheKey, mapped);
  }

  return mapped;
}
