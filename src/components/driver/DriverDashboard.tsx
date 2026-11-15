import {useEffect, useMemo, useRef, useState} from 'react';
import {QRCodeSVG} from 'qrcode.react';
import {
  ArrowUpDown,
  Bike,
  Camera,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock,
  Columns2,
  Crosshair,
  LayoutGrid,
  Lightbulb,
  Loader2,
  Map as MapIcon,
  MapPin,
  Navigation,
  QrCode,
  Search,
  Shield,
  Sparkles,
  Star,
  Umbrella,
  X,
  Zap,
} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import {toast} from 'sonner';
import type {
  AmenityId,
  BookingRecord,
  ParkingBay,
  ParkingSlot,
  SearchLocationFilter,
  UserProfile,
  VehicleType,
} from '../../types/parking';
import {
  calculateDistanceKm,
  cn,
  formatCurrency,
  formatTimeRemaining,
  getAvailableBayCount,
} from '../../lib/utils';
import {
  AMENITY_META,
  DEFAULT_INDIA_CENTER,
  INDIA_CITY_CENTERS,
  INDIA_HUB_PRESETS,
} from '../../data/indiaParkingConfig';
import {
  fetchMoreParkingFromGooglePlaces,
  fetchNearbyParkingFromGooglePlaces,
  searchParkingByTextFromGooglePlaces,
  useIndiaPlaceAutocomplete,
  useMapsPlacesStatus,
  useSearchRateLimit,
  type PlaceSuggestionItem,
} from '../maps/PlacesProvider';
import {ParkingMapView} from '../maps/ParkingMapView';
import {Button} from '../ui/button';
import {Card} from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {Input} from '../ui/input';
import {ParkingThumbnail} from '../ui/ParkingThumbnail';
import {Slider} from '../ui/slider';
import {ParkingDirectionsModal} from './ParkingDirectionsModal';
import {SlotBookingModal} from './SlotBookingModal';

interface DriverDashboardProps {
  activeTab: string;
  onChangeTab: (tab: string) => void;
  slots: ParkingSlot[];
  bookings: BookingRecord[];
  currentUser: UserProfile;
  isDark: boolean;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  searchLocation: SearchLocationFilter | null;
  onSearchLocationChange: (loc: SearchLocationFilter | null) => void;
  onCreateBooking: (params: {
    slot: ParkingSlot;
    bay: ParkingBay;
    durationHours: number;
    startTime: string;
    vehiclePlate: string;
  }) => Promise<BookingRecord>;
  onCancelBooking: (bookingId: string) => Promise<void>;
}

const AMENITY_ICON_MAP: Record<AmenityId, typeof Camera> = {
  cctv: Camera,
  security: Shield,
  ev_charger: Zap,
  covered: Umbrella,
  well_lit: Lightbulb,
  valet: Sparkles,
};

export function DriverDashboard({
  activeTab,
  onChangeTab,
  slots,
  bookings,
  currentUser,
  isDark,
  searchQuery,
  onSearchQueryChange,
  searchLocation,
  onSearchLocationChange,
  onCreateBooking,
  onCancelBooking,
}: DriverDashboardProps) {
  const [vehicleFilter, setVehicleFilter] = useState<'all' | VehicleType>('all');
  const [evOnly, setEvOnly] = useState(false);
  const [coveredOnly, setCoveredOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(500);
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'nearest' | 'price' | 'rating'>('nearest');
  const [locatingGps, setLocatingGps] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'grid' | 'map'>('split');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [guideModalSlot, setGuideModalSlot] = useState<ParkingSlot | null>(null);
  const [bookingModalSlot, setBookingModalSlot] = useState<ParkingSlot | null>(null);
  const [qrViewerBooking, setQrViewerBooking] = useState<BookingRecord | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [searchFocused, setSearchFocused] = useState(false);
  const [discoveredSlots, setDiscoveredSlots] = useState<ParkingSlot[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [extraBatchIndex, setExtraBatchIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchCooldownNotice, setSearchCooldownNotice] = useState<number>(0);
  const [userCoords, setUserCoords] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);
  const cityStripRef = useRef<HTMLDivElement>(null);
  const marketplaceTopRef = useRef<HTMLDivElement>(null);

  const scrollCities = (direction: 'left' | 'right') => {
    const el = cityStripRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === 'left' ? -240 : 240,
      behavior: 'smooth',
    });
  };

  const {
    placesLib,
    isLoading: placesSdkLoading,
  } = useMapsPlacesStatus();
  const rateLimitStatus = useSearchRateLimit();
  const {
    suggestions: placeSuggestions,
    loading: loadingAutocomplete,
    rateLimited: autocompleteRateLimited,
    retryAfterSec: autocompleteRetrySec,
    resolvePlaceCoordinates,
    resolveTextLocation,
  } = useIndiaPlaceAutocomplete(searchQuery);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Passively capture user's live GPS location once on mount if granted, to power custom map view & directions
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: 'Your Live Location',
        });
      },
      () => {
        // Silent fallback if user hasn't granted permission yet
      },
      {enableHighAccuracy: true, timeout: 5000}
    );
  }, []);

  useEffect(() => {
    if (!searchLocation) {
      setSelectedCity('All');
      return;
    }
    if (searchLocation.source === 'city') {
      const matched = INDIA_CITY_CENTERS.find((c) => c.city === searchLocation.label);
      if (matched) {
        setSelectedCity(matched.city);
        setSortBy('nearest');
      }
    } else if (searchLocation.source === 'gps' || searchLocation.source === 'place') {
      setSelectedCity('All');
      setSortBy('nearest');
    }
  }, [searchLocation]);

  // Automatically fetch live Google Maps parking facilities around the active location
  useEffect(() => {
    if (!placesLib) return;
    let cancelled = false;
    const origin = searchLocation
      ? {lat: searchLocation.lat, lng: searchLocation.lng, label: searchLocation.label}
      : {lat: DEFAULT_INDIA_CENTER.lat, lng: DEFAULT_INDIA_CENTER.lng, label: 'Bengaluru'};

    setLoadingNearby(true);
    setExtraBatchIndex(0);
    void fetchNearbyParkingFromGooglePlaces(placesLib, origin, (enriched) => {
      if (!cancelled) {
        setDiscoveredSlots(enriched);
      }
    }).then((results) => {
      if (cancelled) return;
      setDiscoveredSlots(results);
      setLoadingNearby(false);
    });

    return () => {
      cancelled = true;
    };
  }, [placesLib, searchLocation]);

  // If the user types a free-text query that doesn't match local slots, run Google Places Text Search (rate-limited)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!placesLib || trimmed.length < 3) {
      setSearchCooldownNotice(0);
      return;
    }
    let cancelled = false;
    const origin = searchLocation
      ? {lat: searchLocation.lat, lng: searchLocation.lng}
      : DEFAULT_INDIA_CENTER;

    const mergeResults = (results: ParkingSlot[]) => {
      if (cancelled || results.length === 0) return;
      setSearchCooldownNotice(0);
      setDiscoveredSlots((prev) => {
        const byId = new Map<string, ParkingSlot>();
        for (const item of results) byId.set(item.id, item);
        for (const item of prev) {
          if (!byId.has(item.id)) byId.set(item.id, item);
        }
        return Array.from(byId.values());
      });
    };

    const timer = setTimeout(() => {
      void searchParkingByTextFromGooglePlaces(
        placesLib,
        trimmed,
        origin,
        mergeResults,
        (retrySec) => {
          if (!cancelled) setSearchCooldownNotice(retrySec);
        }
      ).then(mergeResults);
    }, 650);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [placesLib, searchQuery, searchLocation]);

  // Reset Marketplace page to 1 whenever search/filter/sort/view changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    selectedCity,
    searchLocation,
    vehicleFilter,
    evOnly,
    coveredOnly,
    maxPrice,
    sortBy,
    viewMode,
  ]);

  const handleSelectPlaceSuggestion = async (item: PlaceSuggestionItem) => {
    const resolved = await resolvePlaceCoordinates(item);
    setSearchFocused(false);
    if (resolved) {
      onSearchQueryChange('');
      onSearchLocationChange({
        label: resolved.label,
        lat: resolved.lat,
        lng: resolved.lng,
        source: 'place',
      });
      setSelectedCity('All');
      setSortBy('nearest');
    } else {
      onSearchQueryChange(item.mainText);
    }
  };

  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    if (placeSuggestions.length > 0) {
      await handleSelectPlaceSuggestion(placeSuggestions[0]);
      return;
    }

    const resolved = await resolveTextLocation(trimmed);
    setSearchFocused(false);
    if (resolved) {
      onSearchQueryChange('');
      onSearchLocationChange({
        label: resolved.label,
        lat: resolved.lat,
        lng: resolved.lng,
        source: 'place',
      });
      setSelectedCity('All');
      setSortBy('nearest');
    }
  };

  const handleFindNearbyGps = () => {
    onSearchQueryChange('');
    if (!navigator.geolocation) {
      const fallback = INDIA_HUB_PRESETS[0];
      onSearchLocationChange({
        label: `Nearby: ${fallback.label}`,
        lat: fallback.lat,
        lng: fallback.lng,
        source: 'city',
      });
      setSortBy('nearest');
      toast.info(`Browser GPS unavailable — sorting by nearest to ${fallback.label}`);
      return;
    }

    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingGps(false);
        const live = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: 'Your Live Location',
        };
        setUserCoords(live);
        onSearchLocationChange({
          ...live,
          source: 'gps',
        });
        setSelectedCity('All');
        setSortBy('nearest');
        toast.success('Found your live coordinates — showing nearest parking bays first.');
      },
      () => {
        setLocatingGps(false);
        const fallback = INDIA_HUB_PRESETS[0];
        onSearchLocationChange({
          label: `${fallback.label} (Hub Default)`,
          lat: fallback.lat,
          lng: fallback.lng,
          source: 'city',
        });
        setSortBy('nearest');
        toast.info(`Location access blocked — centered on ${fallback.label} instead.`);
      },
      {enableHighAccuracy: true, timeout: 6000}
    );
  };

  const handleSelectCity = (city: string) => {
    onSearchQueryChange('');
    setSelectedCity(city);
    if (city === 'All') {
      if (searchLocation?.source === 'city') {
        onSearchLocationChange(null);
      }
      return;
    }
    const cityCenter = INDIA_CITY_CENTERS.find((c) => c.city === city);
    if (cityCenter) {
      onSearchLocationChange({
        label: cityCenter.city,
        lat: cityCenter.lat,
        lng: cityCenter.lng,
        source: 'city',
      });
      setSortBy('nearest');
    }
  };

  const approvedFirestoreSlots = useMemo(
    () => slots.filter((s) => s.approvalStatus === 'approved'),
    [slots]
  );

  // Merge Firestore partner facilities with live Google Maps discovered parking lots + live booking bay occupancy
  const combinedMarketplaceSlots = useMemo(() => {
    const activeBaysBySlot = new Map<string, Set<string>>();
    for (const b of bookings) {
      if (b.status !== 'active') continue;
      const set = activeBaysBySlot.get(b.slotId) || new Set<string>();
      set.add(b.bayCode);
      activeBaysBySlot.set(b.slotId, set);
    }

    const byId = new Map<string, ParkingSlot>();
    for (const s of approvedFirestoreSlots) {
      byId.set(s.id, s);
    }
    for (const g of discoveredSlots) {
      if (!byId.has(g.id)) {
        const bookedCodes = activeBaysBySlot.get(g.id);
        if (bookedCodes && bookedCodes.size > 0) {
          byId.set(g.id, {
            ...g,
            bays: g.bays.map((bay) =>
              bookedCodes.has(bay.code) ? {...bay, status: 'occupied'} : bay
            ),
          });
        } else {
          byId.set(g.id, g);
        }
      }
    }
    return Array.from(byId.values());
  }, [approvedFirestoreSlots, discoveredSlots, bookings]);

  const slotsWithLiveDistance = useMemo(() => {
    const origin = searchLocation || userCoords;
    return combinedMarketplaceSlots.map((slot) => ({
      ...slot,
      distanceKm: origin
        ? calculateDistanceKm(origin.lat, origin.lng, slot.lat, slot.lng)
        : slot.distanceKm,
    }));
  }, [combinedMarketplaceSlots, searchLocation, userCoords]);

  const filteredSlots = useMemo(() => {
    const CITY_ALIASES: Record<string, string[]> = {
      'new delhi': ['new delhi', 'delhi', 'connaught'],
      bengaluru: ['bengaluru', 'bangalore'],
      mumbai: ['mumbai', 'bombay'],
      gurugram: ['gurugram', 'gurgaon'],
      kolkata: ['kolkata', 'calcutta'],
    };

    const matched = slotsWithLiveDistance.filter((slot) => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchesQuery =
          slot.title.toLowerCase().includes(q) ||
          slot.address.toLowerCase().includes(q) ||
          slot.neighborhood.toLowerCase().includes(q) ||
          slot.landmark.toLowerCase().includes(q);
        // Keep nearby Google-discovered lots if user searched a place name
        const isDiscoveredForQuery =
          slot.id.startsWith('gmp_') && slot.landmark.toLowerCase().includes(q);
        if (!matchesQuery && !isDiscoveredForQuery) return false;
      }
      if (selectedCity !== 'All') {
        const cityLow = selectedCity.toLowerCase();
        const terms = CITY_ALIASES[cityLow] || [cityLow];
        const haystack = `${slot.neighborhood} ${slot.address} ${slot.landmark}`.toLowerCase();
        const inCity = terms.some((t) => haystack.includes(t));
        if (!inCity && (!searchLocation || slot.distanceKm > 50)) {
          return false;
        }
      }
      if (vehicleFilter !== 'all' && !slot.vehicleTypes.includes(vehicleFilter)) {
        return false;
      }
      if (evOnly && !slot.amenities.includes('ev_charger')) {
        return false;
      }
      if (
        coveredOnly &&
        !slot.amenities.includes('covered') &&
        slot.category !== 'Covered Garage'
      ) {
        return false;
      }
      if (slot.hourlyRate > maxPrice) {
        return false;
      }
      return true;
    });

    return [...matched].sort((a, b) => {
      if (sortBy === 'price') return a.hourlyRate - b.hourlyRate;
      if (sortBy === 'rating') return b.rating - a.rating;
      return a.distanceKm - b.distanceKm;
    });
  }, [
    slotsWithLiveDistance,
    searchQuery,
    selectedCity,
    searchLocation,
    vehicleFilter,
    evOnly,
    coveredOnly,
    maxPrice,
    sortBy,
  ]);

  const pageSize = viewMode === 'grid' ? 9 : 6;
  const totalPages = Math.max(1, Math.ceil(filteredSlots.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedSlots = useMemo(
    () => filteredSlots.slice(startIndex, startIndex + pageSize),
    [filteredSlots, startIndex, pageSize]
  );

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(totalPages, page));
    setCurrentPage(clamped);
    marketplaceTopRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'});
  };

  const handleLoadMoreNearby = async () => {
    if (!placesLib || loadingMore || extraBatchIndex >= 2) return;
    const origin = searchLocation
      ? {lat: searchLocation.lat, lng: searchLocation.lng, label: searchLocation.label}
      : {lat: DEFAULT_INDIA_CENTER.lat, lng: DEFAULT_INDIA_CENTER.lng, label: 'Bengaluru'};

    setLoadingMore(true);
    try {
      const existingIds = new Set(discoveredSlots.map((s) => s.id));
      let hitRateLimit = false;
      const more = await fetchMoreParkingFromGooglePlaces(
        placesLib,
        origin,
        extraBatchIndex,
        (enriched) => {
          setDiscoveredSlots((prev) => {
            const byId = new Map<string, ParkingSlot>(prev.map((s) => [s.id, s]));
            for (const item of enriched) byId.set(item.id, item);
            return Array.from(byId.values());
          });
        },
        (retrySec) => {
          hitRateLimit = true;
          setSearchCooldownNotice(retrySec);
          toast.warning(`Search rate limit active — try loading more in ${retrySec}s.`);
        }
      );

      if (hitRateLimit) return;

      const newlyAdded = more.filter((m) => !existingIds.has(m.id));
      setExtraBatchIndex((prev) => prev + 1);
      if (newlyAdded.length > 0) {
        const nextTotal = filteredSlots.length + newlyAdded.length;
        const nextPages = Math.max(1, Math.ceil(nextTotal / pageSize));
        setDiscoveredSlots((prev) => {
          const byId = new Map<string, ParkingSlot>(prev.map((s) => [s.id, s]));
          for (const item of newlyAdded) byId.set(item.id, item);
          return Array.from(byId.values());
        });
        if (nextPages > safePage) {
          setCurrentPage(safePage + 1);
          marketplaceTopRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'});
        }
        toast.success(`Loaded ${newlyAdded.length} more parking hubs nearby.`);
      } else {
        toast.info('All nearby Google Maps parking facilities for this zone are loaded.');
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const activeCooldownSec = Math.max(
    rateLimitStatus.limited ? rateLimitStatus.retryAfterSec : 0,
    autocompleteRateLimited ? autocompleteRetrySec : 0,
    searchCooldownNotice
  );

  const myBookings = useMemo(
    () => bookings.filter((b) => b.driverId === currentUser.uid),
    [bookings, currentUser.uid]
  );

  const activeBookings = useMemo(
    () => myBookings.filter((b) => b.status === 'active'),
    [myBookings]
  );

  const pastBookings = useMemo(
    () => myBookings.filter((b) => b.status !== 'active'),
    [myBookings]
  );

  return (
    <div className="space-y-6">
      {/* Top Hero Strip + Tab Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
            Find &amp; Reserve Verified Urban Parking
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Real-time bay availability across {combinedMarketplaceSlots.length} vetted garages, public lots, and EV hubs in India.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/90 p-1">
            <button
              type="button"
              onClick={() => onChangeTab('marketplace')}
              className={cn(
                'px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer',
                activeTab !== 'bookings'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              Marketplace ({filteredSlots.length})
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('bookings')}
              className={cn(
                'px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer',
                activeTab === 'bookings'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              My Bookings ({activeBookings.length} active)
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'bookings' ? (
        <div className="space-y-6">
          {/* Active Passes */}
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white mb-3">
              Active Parking Passes
            </h2>
            {activeBookings.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No active parking sessions right now.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => onChangeTab('marketplace')}
                >
                  Browse Nearby Spots
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeBookings.map((booking) => (
                  <Card key={booking.id} className="p-5 flex flex-col justify-between gap-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          <span>Active Session</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">Bay {booking.bayCode}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{booking.vehiclePlate}</span>
                        </div>
                        <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white mt-1">
                          {booking.slotTitle}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {booking.slotAddress}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Time Remaining
                        </div>
                        <div className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {formatTimeRemaining(booking.endTime, nowMs)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/70 dark:border-slate-800/70">
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {booking.durationHours}h · {formatCurrency(booking.totalAmount)} paid
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void onCancelBooking(booking.id)}
                        >
                          End Session
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setQrViewerBooking(booking)}
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          View QR Pass
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Booking History */}
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white mb-3">
              Booking History
            </h2>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Facility</th>
                      <th className="px-4 py-3 font-medium">Bay</th>
                      <th className="px-4 py-3 font-medium">Plate</th>
                      <th className="px-4 py-3 font-medium">Duration</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                    {pastBookings.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          No completed or cancelled bookings yet.
                        </td>
                      </tr>
                    ) : (
                      pastBookings.map((b) => (
                        <tr
                          key={b.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                            {b.slotTitle}
                          </td>
                          <td className="px-4 py-3 font-mono">{b.bayCode}</td>
                          <td className="px-4 py-3 font-mono">{b.vehiclePlate}</td>
                          <td className="px-4 py-3 font-mono tabular-nums">
                            {b.durationHours}h
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'font-medium capitalize',
                                b.status === 'completed'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              )}
                            >
                              {b.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">
                            {formatCurrency(b.totalAmount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <div ref={marketplaceTopRef} className="space-y-5 scroll-mt-24">
          {/* Location-Wise + Nearby Search Toolbar */}
          <Card className="p-4 sm:p-5 space-y-3.5 border-slate-200/90 dark:border-zinc-800/90 bg-white/95 dark:bg-[#0D1117]/95 shadow-sm">
            {/* Row 1: India Places Search, GPS Nearby & Sort */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              <div className="md:col-span-6 relative">
                {loadingAutocomplete ? (
                  <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-500 animate-spin" />
                ) : (
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                )}
                <Input
                  value={searchQuery}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  onKeyDown={(e) => void handleSearchKeyDown(e)}
                  placeholder="Search street, metro, mall or city in India..."
                  className="pl-9 pr-24 h-9 text-xs sm:text-sm dark:bg-[#090B10] dark:border-zinc-800"
                />
                <span
                  title="Live Google Places search rate quota per 30s"
                  className={cn(
                    'pointer-events-none absolute top-1/2 -translate-y-1/2 font-mono text-[10px] tabular-nums px-1.5 py-0.5 rounded border',
                    searchQuery ? 'right-8' : 'right-2.5',
                    activeCooldownSec > 0
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                      : 'border-slate-200 dark:border-zinc-800 bg-slate-100/80 dark:bg-zinc-900/80 text-slate-500 dark:text-zinc-400'
                  )}
                >
                  {activeCooldownSec > 0
                    ? `${activeCooldownSec}s`
                    : `${rateLimitStatus.remaining}/${rateLimitStatus.maxRequests}`}
                </span>
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => onSearchQueryChange('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}

                {searchFocused && (placeSuggestions.length > 0 || activeCooldownSec > 0) && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0D1117] p-1.5 shadow-2xl z-30 max-h-64 overflow-y-auto slim-scrollbar">
                    {activeCooldownSec > 0 && (
                      <div className="mx-1 mb-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-600 dark:text-amber-300">
                        Search rate limit active — live Google lookups reset in {activeCooldownSec}s. Filtering local hubs.
                      </div>
                    )}
                    {placeSuggestions.length > 0 && (
                      <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        Places &amp; Cities in India
                      </div>
                    )}
                    {placeSuggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          void handleSelectPlaceSuggestion(item);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/80 cursor-pointer"
                      >
                        <MapPin className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{item.mainText}</div>
                          <div className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">
                            {item.secondaryText}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="md:col-span-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={searchLocation?.source === 'gps' ? 'emerald' : 'secondary'}
                  onClick={handleFindNearbyGps}
                  disabled={locatingGps}
                  className="gap-1.5 h-9 px-3 text-xs whitespace-nowrap"
                >
                  {locatingGps ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Crosshair className="h-3.5 w-3.5" />
                  )}
                  {locatingGps ? 'Locating...' : 'Find Nearby'}
                </Button>

                {searchLocation && (
                  <button
                    type="button"
                    onClick={() => {
                      onSearchLocationChange(null);
                      setSelectedCity('All');
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 text-xs font-medium text-sky-600 dark:text-sky-400 hover:bg-sky-500/15 transition-colors cursor-pointer max-w-[175px]"
                  >
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{searchLocation.label}</span>
                    <X className="h-3 w-3 shrink-0" />
                  </button>
                )}
              </div>

              <div className="md:col-span-3 flex items-center justify-between md:justify-end gap-2.5">
                <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                  {filteredSlots.length} {filteredSlots.length === 1 ? 'hub' : 'hubs'}
                </span>
                <div className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-[#090B10] px-2.5 text-xs">
                  <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                  <select
                    aria-label="Sort parking slots"
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(e.target.value as 'nearest' | 'price' | 'rating')
                    }
                    className="bg-transparent text-xs font-medium text-slate-700 dark:text-zinc-200 focus:outline-none cursor-pointer"
                  >
                    <option value="nearest" className="dark:bg-[#0D1117]">
                      Nearest First
                    </option>
                    <option value="price" className="dark:bg-[#0D1117]">
                      Lowest Rate
                    </option>
                    <option value="rating" className="dark:bg-[#0D1117]">
                      Highest Rated
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {activeCooldownSec > 0 && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                <span>
                  Search rate limit reached (max 10 live searches / 30s). Instant local filtering stays active; live search resumes in{' '}
                  <span className="font-mono font-semibold tabular-nums">{activeCooldownSec}s</span>.
                </span>
              </div>
            )}

            {/* Row 2: Sleek Scrollbar-Free Indian City Strip */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mr-0.5 shrink-0">
                City:
              </span>
              <button
                type="button"
                aria-label="Scroll cities left"
                onClick={() => scrollCities('left')}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#090B10] text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-zinc-700 transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div
                ref={cityStripRef}
                className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth"
              >
                {['All', ...INDIA_CITY_CENTERS.map((c) => c.city)].map((city) => {
                  const active = selectedCity === city;
                  return (
                    <button
                      key={city}
                      type="button"
                      onClick={() => handleSelectCity(city)}
                      className={cn(
                        'h-7 rounded-md border px-2.5 text-xs font-medium transition-all cursor-pointer whitespace-nowrap shrink-0',
                        active
                          ? 'border-sky-500 bg-sky-600 text-white shadow-sm'
                          : 'border-slate-200/80 dark:border-zinc-800 bg-transparent text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-slate-900 dark:hover:text-white'
                      )}
                    >
                      {city === 'All' ? 'All India' : city}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                aria-label="Scroll cities right"
                onClick={() => scrollCities('right')}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#090B10] text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-zinc-700 transition-colors cursor-pointer"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Row 3: Vehicle, Amenities, Max Price & View Mode (Full 12-col symmetry) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-center pt-3 border-t border-slate-200/70 dark:border-zinc-800/80">
              <div className="lg:col-span-7 flex flex-wrap items-center gap-1.5">
                {(
                  [
                    {id: 'all', label: 'All Vehicles', icon: Car},
                    {id: 'EV', label: 'EV', icon: Zap},
                    {id: 'SUV', label: 'SUV', icon: Car},
                    {id: 'Two-Wheeler', label: '2-Wheeler', icon: Bike},
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  const active = vehicleFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setVehicleFilter(item.id)}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap',
                        active
                          ? 'border-sky-500 bg-sky-600 text-white'
                          : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </button>
                  );
                })}

                <span
                  aria-hidden="true"
                  className="hidden sm:inline-block h-5 w-px bg-slate-200 dark:bg-zinc-800 mx-0.5"
                />

                <button
                  type="button"
                  onClick={() => setEvOnly((p) => !p)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap',
                    evOnly
                      ? 'border-emerald-500 bg-emerald-600 text-white'
                      : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80'
                  )}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Fast EV
                </button>

                <button
                  type="button"
                  onClick={() => setCoveredOnly((p) => !p)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap',
                    coveredOnly
                      ? 'border-sky-500 bg-sky-600 text-white'
                      : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80'
                  )}
                >
                  <Umbrella className="h-3.5 w-3.5" />
                  Covered
                </button>
              </div>

              <div className="lg:col-span-5 flex items-center justify-between lg:justify-end gap-4">
                <div className="flex-1 max-w-[230px] space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-zinc-400">Max rate</span>
                    <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(maxPrice)}/hr
                    </span>
                  </div>
                  <Slider
                    value={[maxPrice]}
                    min={20}
                    max={500}
                    step={10}
                    onValueChange={(vals) => setMaxPrice(vals[0] || 500)}
                  />
                </div>

                <div className="inline-flex h-8 items-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-[#090B10] p-0.5 shrink-0">
                  <button
                    type="button"
                    aria-label="Split map and grid view"
                    title="Split view"
                    onClick={() => setViewMode('split')}
                    className={cn(
                      'p-1.5 rounded-md cursor-pointer transition-colors',
                      viewMode === 'split'
                        ? 'bg-slate-900 text-white dark:bg-zinc-800'
                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    )}
                  >
                    <Columns2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Grid view"
                    title="Grid view"
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      'p-1.5 rounded-md cursor-pointer transition-colors',
                      viewMode === 'grid'
                        ? 'bg-slate-900 text-white dark:bg-zinc-800'
                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Map view"
                    title="Map view"
                    onClick={() => setViewMode('map')}
                    className={cn(
                      'p-1.5 rounded-md cursor-pointer transition-colors',
                      viewMode === 'map'
                        ? 'bg-slate-900 text-white dark:bg-zinc-800'
                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    )}
                  >
                    <MapIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Main Marketplace Grid + Google Map */}
          {(loadingNearby || placesSdkLoading) && filteredSlots.length === 0 ? (
            <Card className="p-10 text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500 mx-auto" />
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Finding parking facilities near {searchLocation?.label || 'your location'}...
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Querying live Google Maps parking directory and Firestore inventory.
              </p>
            </Card>
          ) : filteredSlots.length === 0 ? (
            <Card className="p-10 text-center">
              {combinedMarketplaceSlots.length === 0 ? (
                <>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    No parking facilities found near {searchLocation?.label || 'this location'} yet.
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Try searching another Indian locality, clicking Find Nearby, or switching to Vendor Console to publish a new parking space.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    No parking facilities match your current filters.
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Try increasing your max hourly rate or clearing the EV / Covered toggles.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      onSearchQueryChange('');
                      onSearchLocationChange(null);
                      setSelectedCity('All');
                      setVehicleFilter('all');
                      setEvOnly(false);
                      setCoveredOnly(false);
                      setMaxPrice(500);
                    }}
                  >
                    Reset Filters
                  </Button>
                </>
              )}
            </Card>
          ) : (
            <div
              className={cn(
                'grid gap-6 items-start',
                viewMode === 'split'
                  ? 'grid-cols-1 lg:grid-cols-12'
                  : 'grid-cols-1'
              )}
            >
              {viewMode !== 'map' && (
                <div
                  className={cn(
                    'space-y-4',
                    viewMode === 'split' ? 'lg:col-span-7' : ''
                  )}
                >
                  <div
                    className={cn(
                      'grid gap-4',
                      viewMode === 'split'
                        ? 'grid-cols-1 sm:grid-cols-2'
                        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                    )}
                  >
                    <AnimatePresence mode="popLayout">
                      {paginatedSlots.map((slot, index) => {
                        const availableCount = getAvailableBayCount(slot);
                        const isAvailable = slot.isOpen && availableCount > 0;
                        const isSelected = selectedSlotId === slot.id;

                        return (
                          <motion.div
                            key={slot.id}
                            layout
                            initial={{opacity: 0, y: 14}}
                            animate={{opacity: 1, y: 0}}
                            exit={{opacity: 0, scale: 0.96}}
                            transition={{
                              duration: 0.25,
                              delay: Math.min(index * 0.04, 0.25),
                              ease: [0.16, 1, 0.3, 1],
                            }}
                            whileHover={{y: -4}}
                          >
                            <Card
                              onClick={() => {
                                setSelectedSlotId(slot.id);
                                setGuideModalSlot(slot);
                              }}
                              className={cn(
                                'group overflow-hidden flex flex-col h-full cursor-pointer hover:border-sky-500/60 transition-colors',
                                isSelected && 'ring-2 ring-sky-500 border-sky-500'
                              )}
                            >
                              <div className="relative h-40">
                                <ParkingThumbnail
                                  thumbnailId={slot.thumbnailId}
                                  customImageUrl={slot.customImageUrl}
                                  gallery={slot.photoGallery}
                                  attribution={slot.photoAttributions?.[0]}
                                  attributions={slot.photoAttributions}
                                  lat={slot.lat}
                                  lng={slot.lng}
                                  alt={slot.title}
                                  className="h-full w-full"
                                />
                                <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 text-white">
                                  <span className="text-xs font-medium text-slate-100 drop-shadow truncate">
                                    {slot.neighborhood}
                                  </span>
                                  <span className="font-mono text-base font-bold tabular-nums drop-shadow shrink-0">
                                    {formatCurrency(slot.hourlyRate)}
                                    <span className="text-xs font-normal text-slate-200">/hr</span>
                                  </span>
                                </div>
                              </div>

                              <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                                <div>
                                  {/* Clean unboxed metadata with typographic separators */}
                                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                    <span>{slot.category}</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-mono tabular-nums">
                                      {slot.distanceKm} km
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span className="inline-flex items-center gap-0.5 text-slate-700 dark:text-slate-200 font-medium">
                                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                      {slot.rating.toFixed(1)}
                                    </span>
                                  </div>

                                  <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white mt-1 line-clamp-1">
                                    {slot.title}
                                  </h3>

                                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    {slot.address}
                                  </p>
                                </div>

                                {/* Amenity icons row */}
                                <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                                  {slot.amenities.slice(0, 4).map((amenityId) => {
                                    const Icon = AMENITY_ICON_MAP[amenityId];
                                    return (
                                      <span
                                        key={amenityId}
                                        className="inline-flex items-center gap-1"
                                        title={AMENITY_META[amenityId].label}
                                      >
                                        <Icon className="h-3 w-3 text-blue-500" />
                                        {AMENITY_META[amenityId].shortLabel}
                                      </span>
                                    );
                                  })}
                                </div>

                                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200/70 dark:border-slate-800/70">
                                  <div className="flex items-center gap-1.5 text-xs font-medium">
                                    <span
                                      className={cn(
                                        'h-2 w-2 rounded-full shrink-0',
                                        isAvailable ? 'bg-emerald-500' : 'bg-rose-500'
                                      )}
                                    />
                                    <span
                                      className={cn(
                                        'font-mono tabular-nums',
                                        isAvailable
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : 'text-rose-600 dark:text-rose-400'
                                      )}
                                    >
                                      {slot.isOpen
                                        ? `${availableCount} of ${slot.totalSlots} free`
                                        : 'Closed'}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-600 dark:text-sky-400">
                                      <Navigation className="h-3 w-3" />
                                      Info &amp; Map
                                    </span>
                                    <Button
                                      size="sm"
                                      disabled={!isAvailable}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedSlotId(slot.id);
                                        setBookingModalSlot(slot);
                                      }}
                                    >
                                      Book Slot
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </Card>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {/* Marketplace Pagination & Next Page Controls */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-slate-200/90 dark:border-zinc-800/90 bg-white/95 dark:bg-[#0D1117]/95 px-4 py-3">
                    <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                      Showing {startIndex + 1}–{Math.min(startIndex + pageSize, filteredSlots.length)} of{' '}
                      {filteredSlots.length} hubs · Page {safePage} of {totalPages}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={safePage <= 1}
                        onClick={() => goToPage(safePage - 1)}
                        className="h-8 px-2.5 text-xs gap-1"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Prev
                      </Button>

                      {Array.from({length: totalPages}, (_, idx) => idx + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => goToPage(pageNum)}
                          aria-label={`Go to page ${pageNum}`}
                          aria-current={pageNum === safePage ? 'page' : undefined}
                          className={cn(
                            'inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg border px-2 font-mono text-xs tabular-nums transition-colors cursor-pointer',
                            pageNum === safePage
                              ? 'border-sky-500 bg-sky-600 text-white font-semibold shadow-sm'
                              : 'border-slate-200 dark:border-zinc-800 bg-transparent text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80'
                          )}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <Button
                        type="button"
                        size="sm"
                        variant={safePage < totalPages ? 'default' : 'outline'}
                        disabled={safePage >= totalPages}
                        onClick={() => goToPage(safePage + 1)}
                        className="h-8 px-2.5 text-xs gap-1"
                      >
                        Next
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>

                      {placesLib && extraBatchIndex < 2 && safePage === totalPages && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={loadingMore || activeCooldownSec > 0}
                          onClick={() => void handleLoadMoreNearby()}
                          className="h-8 px-3 text-xs gap-1.5 ml-1"
                        >
                          {loadingMore ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            <>Load More Nearby</>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {viewMode !== 'grid' && (
                <div
                  className={cn(
                    viewMode === 'split'
                      ? 'lg:col-span-5 lg:sticky lg:top-20 h-[520px] lg:h-[640px]'
                      : 'h-[560px]'
                  )}
                >
                  <ParkingMapView
                    slots={filteredSlots}
                    selectedSlotId={selectedSlotId}
                    searchLocation={searchLocation}
                    userCoords={userCoords}
                    onRequestUserGps={handleFindNearbyGps}
                    onLocationPicked={(loc) => {
                      onSearchLocationChange(loc);
                      setSelectedCity('All');
                      setSortBy('nearest');
                    }}
                    onSelectSlot={(s) => setSelectedSlotId(s.id)}
                    onOpenGuide={(s) => {
                      setSelectedSlotId(s.id);
                      setGuideModalSlot(s);
                    }}
                    onBookSlot={(s) => setBookingModalSlot(s)}
                    isDark={isDark}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Parking Directions & Dark Map Guide Modal */}
      <ParkingDirectionsModal
        slot={guideModalSlot}
        open={Boolean(guideModalSlot)}
        onOpenChange={(open) => {
          if (!open) setGuideModalSlot(null);
        }}
        userCoords={userCoords}
        searchLocation={searchLocation}
        onUpdateUserCoords={(coords) => setUserCoords(coords)}
        onBookSlot={(s) => setBookingModalSlot(s)}
      />

      {/* Interactive Bay Picker Modal */}
      <SlotBookingModal
        slot={bookingModalSlot}
        open={Boolean(bookingModalSlot)}
        onOpenChange={(open) => {
          if (!open) setBookingModalSlot(null);
        }}
        currentUser={currentUser}
        onConfirmBooking={onCreateBooking}
      />

      {/* QR Pass Quick Viewer Modal */}
      <Dialog
        open={Boolean(qrViewerBooking)}
        onOpenChange={(open) => {
          if (!open) setQrViewerBooking(null);
        }}
      >
        <DialogContent className="max-w-sm text-center">
          {qrViewerBooking && (
            <>
              <DialogHeader className="text-center items-center">
                <DialogTitle className="font-display text-xl">
                  Gate Access QR Pass
                </DialogTitle>
                <DialogDescription>
                  {qrViewerBooking.slotTitle} · Bay {qrViewerBooking.bayCode}
                </DialogDescription>
              </DialogHeader>
              <div className="mx-auto my-2 flex flex-col items-center justify-center rounded-2xl bg-white p-5 shadow-inner border border-slate-200">
                <QRCodeSVG value={qrViewerBooking.qrCodeToken} size={180} />
                <span className="mt-3 font-mono text-xs text-slate-600">
                  {qrViewerBooking.qrCodeToken}
                </span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-2">
                <Clock className="h-3.5 w-3.5" />
                Remaining: {formatTimeRemaining(qrViewerBooking.endTime, nowMs)}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
