import {useMemo, useState} from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Loader2,
  MapPin,
  QrCode,
  Search,
  Shield,
  Store,
  Zap,
} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import {toast} from 'sonner';
import type {
  AppPage,
  BookingRecord,
  ParkingSlot,
  SearchLocationFilter,
} from '../../types/parking';
import {cn, formatCurrency, getAvailableBayCount} from '../../lib/utils';
import {
  INDIA_CITY_CENTERS,
  INDIA_HUB_PRESETS,
} from '../../data/indiaParkingConfig';
import {
  useIndiaPlaceAutocomplete,
  type PlaceSuggestionItem,
} from '../maps/PlacesProvider';
import {
  DEFAULT_INDIA_GLOBE_REGIONS,
  type GlobeRegion,
} from '../ui/DeployRegionGlobe';
import {VariableText} from '../ui/VariableText';
import {WaveMesh} from '../ui/WaveMesh';
import {WordmarkFooter} from '../ui/WordmarkFooter';

const DARK_WAVE_COLORS: [string, string, string] = ['#06070a', '#c9d6ea', '#f0b37a'];
const LIGHT_WAVE_COLORS: [string, string, string] = ['#fafafa', '#64748b', '#2563eb'];

interface RuixenHeroProps {
  isDark: boolean;
  slots: ParkingSlot[];
  onNavigatePage: (page: AppPage) => void;
  onSearchNearbyFromHero: (params: {
    query?: string;
    location?: SearchLocationFilter | null;
  }) => void;
}

export function RuixenHero({
  isDark,
  slots,
  onNavigatePage,
  onSearchNearbyFromHero,
}: RuixenHeroProps) {
  const [heroQuery, setHeroQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);

  const {
    suggestions: placeSuggestions,
    loading: loadingPlaces,
    resolvePlaceCoordinates,
    resolveTextLocation,
  } = useIndiaPlaceAutocomplete(heroQuery);

  const approvedSlots = useMemo(
    () => slots.filter((s) => s.approvalStatus === 'approved'),
    [slots]
  );

  const matchedSlots = useMemo(() => {
    const q = heroQuery.trim().toLowerCase();
    if (!q) return [];
    return approvedSlots
      .filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.neighborhood.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q)
      )
      .slice(0, 3);
  }, [heroQuery, approvedSlots]);

  const handleSelectPlaceSuggestion = async (item: PlaceSuggestionItem) => {
    setResolving(true);
    try {
      const resolved = await resolvePlaceCoordinates(item);
      if (resolved) {
        onSearchNearbyFromHero({
          query: '',
          location: {
            label: resolved.label,
            lat: resolved.lat,
            lng: resolved.lng,
            source: 'place',
          },
        });
        return;
      }
      onSearchNearbyFromHero({query: item.mainText, location: null});
    } finally {
      setResolving(false);
      setFocused(false);
    }
  };

  const handleFindNearby = () => {
    if (!navigator.geolocation) {
      const fallback = INDIA_HUB_PRESETS[0];
      toast.info(`Browser GPS unavailable — showing nearest bays to ${fallback.label}`);
      onSearchNearbyFromHero({
        query: '',
        location: {
          label: fallback.label,
          lat: fallback.lat,
          lng: fallback.lng,
          source: 'city',
        },
      });
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        toast.success('Live location detected — opening nearest bays first.');
        onSearchNearbyFromHero({
          query: '',
          location: {
            label: 'Your Live Location',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            source: 'gps',
          },
        });
      },
      () => {
        setLocating(false);
        const fallback = INDIA_HUB_PRESETS[0];
        toast.info(`Location access blocked — centered on ${fallback.label}.`);
        onSearchNearbyFromHero({
          query: '',
          location: {
            label: fallback.label,
            lat: fallback.lat,
            lng: fallback.lng,
            source: 'city',
          },
        });
      },
      {enableHighAccuracy: true, timeout: 6000}
    );
  };

  const handleHeroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = heroQuery.trim();
    if (!trimmed) {
      onSearchNearbyFromHero({query: '', location: null});
      return;
    }

    setResolving(true);
    try {
      const resolved = await resolveTextLocation(trimmed);
      if (resolved) {
        onSearchNearbyFromHero({
          query: '',
          location: {
            label: resolved.label,
            lat: resolved.lat,
            lng: resolved.lng,
            source: 'place',
          },
        });
        return;
      }

      if (placeSuggestions.length > 0) {
        await handleSelectPlaceSuggestion(placeSuggestions[0]);
        return;
      }

      const matchedCity = INDIA_CITY_CENTERS.find((c) =>
        c.city.toLowerCase().includes(trimmed.toLowerCase())
      );
      if (matchedCity) {
        onSearchNearbyFromHero({
          query: '',
          location: {
            label: matchedCity.city,
            lat: matchedCity.lat,
            lng: matchedCity.lng,
            source: 'city',
          },
        });
        return;
      }

      onSearchNearbyFromHero({query: trimmed, location: null});
    } finally {
      setResolving(false);
    }
  };

  return (
    <WaveMesh
      id="top"
      colors={isDark ? DARK_WAVE_COLORS : LIGHT_WAVE_COLORS}
      crests
      className="border-b border-zinc-200 dark:border-zinc-800/80 pt-14 pb-16 sm:pt-20 sm:pb-24"
    >
      {/* Subtle center contrast veil so display typography reads sharply over animated dots */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_78%_70%_at_50%_42%,rgba(250,250,250,0.86),transparent_78%)] dark:bg-[radial-gradient(ellipse_78%_70%_at_50%_42%,rgba(6,7,10,0.78),transparent_78%)]"
      />

      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
        <motion.div
          initial={{opacity: 0, y: 12}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.45, ease: [0.16, 1, 0.3, 1]}}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-zinc-300/80 dark:border-zinc-700/80 bg-white/80 dark:bg-zinc-900/80 px-3 py-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 backdrop-blur-sm">
            Live Indian Parking Network · {approvedSlots.length}{' '}
            {approvedSlots.length === 1 ? 'Facility' : 'Facilities'} Online
          </span>
        </motion.div>

        <motion.h1
          initial={{opacity: 0, y: 18}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1]}}
          className="mt-5 font-display text-4xl sm:text-5xl lg:text-[56px] font-semibold tracking-tight leading-[1.08] text-zinc-900 dark:text-white text-balance"
        >
          <VariableText
            as="span"
            radius={185}
            maxBlur={2.8}
            minWeight={300}
            maxWeight={800}
          >
            Smart Parking Infrastructure That Works For You
          </VariableText>
        </motion.h1>

        <motion.p
          initial={{opacity: 0, y: 16}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.55, delay: 0.16, ease: [0.16, 1, 0.3, 1]}}
          className="mx-auto mt-4 max-w-2xl text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed"
        >
          <VariableText
            as="span"
            radius={140}
            maxBlur={1.8}
            minWeight={300}
            maxWeight={600}
          >
            Search nearby bays by GPS or Indian city hub, issue instant QR gate passes, list vendor parking spaces, and govern facilities from dedicated pages.
          </VariableText>
        </motion.p>

        {/* Interactive Hero Nearby & Location-Wise Search Bar */}
        <motion.form
          onSubmit={(e) => void handleHeroSubmit(e)}
          initial={{opacity: 0, y: 18}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.55, delay: 0.24, ease: [0.16, 1, 0.3, 1]}}
          className="relative mx-auto mt-8 max-w-2xl"
        >
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-xl border border-zinc-300/90 dark:border-zinc-700/90 bg-white/95 dark:bg-zinc-900/95 p-1.5 shadow-xl shadow-black/10 backdrop-blur-md">
            <div className="relative flex-1 flex items-center">
              {loadingPlaces || resolving ? (
                <Loader2 className="ml-3 h-4 w-4 text-blue-500 animate-spin shrink-0" />
              ) : (
                <Search className="ml-3 h-4 w-4 text-zinc-400 shrink-0" />
              )}
              <input
                type="text"
                value={heroQuery}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 180)}
                onChange={(e) => setHeroQuery(e.target.value)}
                placeholder="Search any area, street, metro or city in India..."
                className="w-full bg-transparent px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleFindNearby}
                disabled={locating}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                {locating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                ) : (
                  <Crosshair className="h-3.5 w-3.5 text-emerald-500" />
                )}
                {locating ? 'Locating...' : 'Find Nearby'}
              </button>

              <button
                type="submit"
                disabled={resolving}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                Search Slots
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Autocomplete Places & Live Facility Dropdown */}
          <AnimatePresence>
            {focused && (placeSuggestions.length > 0 || matchedSlots.length > 0 || loadingPlaces) && (
              <motion.div
                initial={{opacity: 0, y: 6}}
                animate={{opacity: 1, y: 0}}
                exit={{opacity: 0, y: 4}}
                transition={{duration: 0.16}}
                className="absolute left-0 right-0 mt-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0E0E12] p-2 text-left shadow-2xl z-30 max-h-80 overflow-y-auto"
              >
                {matchedSlots.length > 0 && (
                  <div className="mb-1.5 pb-1.5 border-b border-zinc-200/70 dark:border-zinc-800/70">
                    <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      ParkGrid Partner Facilities
                    </div>
                    {matchedSlots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onSearchNearbyFromHero({
                            query: slot.title,
                            location: {
                              label: slot.neighborhood,
                              lat: slot.lat,
                              lng: slot.lng,
                              source: 'place',
                            },
                          });
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/80 cursor-pointer"
                      >
                        <span className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
                          <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                          {slot.title} · {slot.neighborhood}
                        </span>
                        <span className="font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                          {formatCurrency(slot.hourlyRate)}/hr
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div>
                  <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Places &amp; Locations in India
                  </div>
                  <div className="space-y-0.5">
                    {placeSuggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          void handleSelectPlaceSuggestion(item);
                        }}
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 cursor-pointer"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {item.mainText}
                          </span>
                          <span className="text-zinc-400 truncate">
                            {item.secondaryText}
                          </span>
                        </span>
                        <ArrowRight className="h-3 w-3 text-zinc-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.form>

        {/* Quick Location Chips */}
        <motion.div
          initial={{opacity: 0, y: 12}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.5, delay: 0.32, ease: [0.16, 1, 0.3, 1]}}
          className="mt-4 flex flex-wrap items-center justify-center gap-1.5"
        >
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mr-1">
            Quick cities:
          </span>
          {INDIA_CITY_CENTERS.slice(0, 6).map((c) => (
            <button
              key={c.city}
              type="button"
              onClick={() =>
                onSearchNearbyFromHero({
                  query: '',
                  location: {
                    label: c.city,
                    lat: c.lat,
                    lng: c.lng,
                    source: 'city',
                  },
                })
              }
              className="rounded-md border border-zinc-200/80 dark:border-zinc-800 bg-white/75 dark:bg-zinc-900/75 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:border-blue-500/60 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer backdrop-blur-sm"
            >
              {c.city}
            </button>
          ))}
        </motion.div>

        {/* Direct Module CTAs */}
        <motion.div
          initial={{opacity: 0, y: 12}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.5, delay: 0.38, ease: [0.16, 1, 0.3, 1]}}
          className="mt-6 flex flex-wrap items-center justify-center gap-3"
        >
          <button
            type="button"
            onClick={() => onNavigatePage('marketplace')}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700/90 bg-white/90 dark:bg-zinc-900/90 px-4 py-2 text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer backdrop-blur-sm"
          >
            Explore Live Marketplace
          </button>
          <button
            type="button"
            onClick={() => onNavigatePage('vendor')}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-950 dark:bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-white dark:text-zinc-950 hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
          >
            List Your Space
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      </div>
    </WaveMesh>
  );
}

const CITATION_CARDS: {
  title: string;
  summary: string;
  linkLabel: string;
  targetPage: AppPage;
}[] = [
  {
    title: 'Zero-Trust Bay Access & QR Verification',
    summary:
      'Every reservation issues a signed single-session QR token verified at entry kiosks, while Firestore security rules enforce strict owner and vendor boundaries.',
    linkLabel: 'View Gate Protocol & FAQ',
    targetPage: 'faq',
  },
  {
    title: 'Live Google Maps Advanced Markers',
    summary:
      'Drivers locate open bays and EV fast-chargers across Indian metro hubs with dynamic INR rate pins, GPS nearby sorting, and instant bay locking.',
    linkLabel: 'Open Driver Marketplace',
    targetPage: 'marketplace',
  },
  {
    title: 'Automated 90/10 Vendor Payout Splits',
    summary:
      'Commercial lot operators and residential space owners receive 90% net payouts on every completed hour with instant open/closed gate control.',
    linkLabel: 'Open Vendor Partner Console',
    targetPage: 'vendor',
  },
  {
    title: 'Real-Time India Places & Dark Route Guide',
    summary:
      'Pick any locality across India, view route ETA and distance calculated from your GPS position, and navigate turn-by-turn on a dark custom map.',
    linkLabel: 'Explore Route Maps',
    targetPage: 'marketplace',
  },
];

const FAQ_ITEMS = [
  {
    q: 'How does ParkGrid digital QR pass entry work?',
    a: 'Once you pick an individual bay and confirm duration, ParkGrid generates a unique QR pass token immediately. Scan it at the garage kiosk or show it to the gate attendant to unlock your reserved bay.',
  },
  {
    q: 'How does Nearby & Location-Wise search work?',
    a: 'Use Find Nearby in the hero or Driver Marketplace to sort facilities by live GPS Haversine distance, pick any Indian city center (Bengaluru, Mumbai, New Delhi, Gurugram, Hyderabad, Pune, Chennai), or search Google Maps Places directly.',
  },
  {
    q: 'How do parking vendors list and manage their spaces?',
    a: 'Open the Vendors page in the top navigation bar or register as a Parking Vendor. Use Add Parking Slot to configure bay prefixes, EV chargers, operating hours, and hourly/daily/monthly INR pricing.',
  },
  {
    q: 'Why do new vendor listings go to an approval queue?',
    a: 'To guarantee accurate addresses, safety amenities, and fair pricing, every new vendor facility starts in Pending Review until a Super Admin approves it in the Admin Command Center.',
  },
  {
    q: 'How are platform fees and vendor payouts calculated?',
    a: 'Drivers pay the facility hourly rate plus a transparent 10% gate-access fee. Vendors retain 90% of the parking subtotal across all completed and active reservations.',
  },
];

interface RuixenOverviewPageProps {
  isDark: boolean;
  slots: ParkingSlot[];
  bookings: BookingRecord[];
  onNavigatePage: (page: AppPage) => void;
  onSearchNearbyFromHero: (params: {
    query?: string;
    location?: SearchLocationFilter | null;
  }) => void;
}

export function RuixenOverviewPage({
  isDark,
  slots,
  bookings,
  onNavigatePage,
  onSearchNearbyFromHero,
}: RuixenOverviewPageProps) {
  const [baySearch, setBaySearch] = useState('');
  const [selectedQuickId, setSelectedQuickId] = useState<string>('');
  const [citationIndex, setCitationIndex] = useState(0);
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number>(4);
  const [pickedRegion, setPickedRegion] = useState<GlobeRegion>(
    DEFAULT_INDIA_GLOBE_REGIONS[0]
  );

  const approvedSlots = useMemo(
    () => slots.filter((s) => s.approvalStatus === 'approved'),
    [slots]
  );

  const quickListSlots = useMemo(() => {
    const q = baySearch.trim().toLowerCase();
    return approvedSlots
      .filter(
        (s) =>
          !q ||
          s.title.toLowerCase().includes(q) ||
          s.neighborhood.toLowerCase().includes(q)
      )
      .slice(0, 4);
  }, [approvedSlots, baySearch]);

  const effectiveQuickId = selectedQuickId || quickListSlots[0]?.id || '';

  const totalBays = useMemo(
    () => approvedSlots.reduce((sum, s) => sum + s.totalSlots, 0),
    [approvedSlots]
  );

  const freeBays = useMemo(
    () => approvedSlots.reduce((sum, s) => sum + getAvailableBayCount(s), 0),
    [approvedSlots]
  );

  const activeSessions = useMemo(
    () => bookings.filter((b) => b.status === 'active').length,
    [bookings]
  );

  const totalRevenue = useMemo(
    () =>
      bookings
        .filter((b) => b.status !== 'cancelled')
        .reduce((sum, b) => sum + b.totalAmount, 0),
    [bookings]
  );

  const chartSeries = useMemo(() => {
    const windows = [
      {label: '08:00', minH: 0, maxH: 10},
      {label: '10:00', minH: 10, maxH: 12},
      {label: '12:00', minH: 12, maxH: 14},
      {label: '14:00', minH: 14, maxH: 16},
      {label: '16:00', minH: 16, maxH: 18},
      {label: '18:00', minH: 18, maxH: 20},
      {label: '20:00', minH: 20, maxH: 24},
    ];
    const slotMap = new Map(slots.map((s) => [s.id, s]));
    return windows.map((w) => {
      let standard = 0;
      let ev = 0;
      for (const b of bookings) {
        if (b.status === 'cancelled') continue;
        const hr = new Date(b.startTime).getHours();
        if (hr >= w.minH && hr < w.maxH) {
          const matchedSlot = slotMap.get(b.slotId);
          if (matchedSlot?.amenities.includes('ev_charger')) {
            ev += 1;
          } else {
            standard += 1;
          }
        }
      }
      return {label: w.label, standard, ev};
    });
  }, [bookings, slots]);

  const chartPaths = useMemo(() => {
    const maxVal = Math.max(
      1,
      ...chartSeries.map((pt) => Math.max(pt.standard, pt.ev))
    );
    const width = 700;
    const height = 165;
    const padTop = 18;
    const toPoints = (getter: (pt: (typeof chartSeries)[number]) => number) =>
      chartSeries.map((pt, i) => {
        const x = (i / (chartSeries.length - 1)) * width;
        const val = getter(pt);
        const y = height - (val / maxVal) * (height - padTop);
        return {x, y};
      });
    const buildLine = (pts: {x: number; y: number}[]) =>
      pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const stdPts = toPoints((pt) => pt.standard);
    const evPts = toPoints((pt) => pt.ev);
    const stdLine = buildLine(stdPts);
    const evLine = buildLine(evPts);
    const stdArea = `${stdLine} L ${width} 180 L 0 180 Z`;
    return {stdLine, stdArea, evLine};
  }, [chartSeries]);

  const latestBooking = bookings[0] || null;
  const citation = CITATION_CARDS[citationIndex];

  const corridorHubs = useMemo(() => {
    return DEFAULT_INDIA_GLOBE_REGIONS.map((reg) => {
      const cityLower = reg.city.toLowerCase();
      const matching = approvedSlots.filter((s) =>
        `${s.neighborhood} ${s.address} ${s.landmark} ${s.title}`
          .toLowerCase()
          .includes(cityLower)
      );
      const freeBaysCount = matching.reduce(
        (sum, s) => sum + getAvailableBayCount(s),
        0
      );
      const minRate =
        matching.length > 0
          ? Math.min(...matching.map((s) => s.hourlyRate))
          : null;
      return {
        ...reg,
        facilityCount: matching.length,
        freeBays: freeBaysCount,
        minRate,
      };
    });
  }, [approvedSlots]);

  const activeHub = useMemo(
    () =>
      corridorHubs.find((h) => h.code === pickedRegion.code) ||
      corridorHubs[0],
    [corridorHubs, pickedRegion]
  );

  const indiaOutlinePoints = useMemo(() => {
    const project = (lat: number, lng: number) => {
      const x = 22 + ((lng - 68.0) / (97.0 - 68.0)) * 256;
      const y = 228 - ((lat - 7.8) / (35.8 - 7.8)) * 206;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };
    const pts: [number, number][] = [
      [34.5, 74.8],
      [35.2, 77.5],
      [32.8, 79.0],
      [30.5, 79.5],
      [28.8, 81.0],
      [27.2, 85.0],
      [27.5, 88.6],
      [28.2, 95.5],
      [26.5, 96.2],
      [24.0, 93.8],
      [25.2, 90.0],
      [22.5, 89.0],
      [21.6, 87.8],
      [19.8, 85.8],
      [17.7, 83.3],
      [15.8, 80.8],
      [13.1, 80.3],
      [9.2, 79.3],
      [8.1, 77.5],
      [9.9, 76.2],
      [15.4, 73.8],
      [19.1, 72.8],
      [21.2, 72.7],
      [20.8, 70.4],
      [22.8, 69.0],
      [23.8, 68.5],
      [25.0, 70.5],
      [28.0, 72.8],
      [31.5, 74.6],
    ];
    return pts.map(([lat, lng]) => project(lat, lng)).join(' ');
  }, []);

  const projectIndiaCoord = (lat: number, lng: number) => ({
    x: 22 + ((lng - 68.0) / (97.0 - 68.0)) * 256,
    y: 228 - ((lat - 7.8) / (35.8 - 7.8)) * 206,
  });

  const moduleCards: {
    page: AppPage;
    code: string;
    title: string;
    subtitle: string;
    metric: string;
    icon: typeof Car;
    accentClass: string;
    cta: string;
  }[] = [
    {
      page: 'marketplace',
      code: '01 · DRIVER',
      title: 'Driver Marketplace & Map',
      subtitle:
        'Search nearby bays via GPS, filter Indian city hubs, inspect live EV chargers, and lock individual bays.',
      metric: `${approvedSlots.length} Live Facilities · ${freeBays} Bays Free`,
      icon: Car,
      accentClass: 'text-blue-600 dark:text-blue-400',
      cta: 'Open Marketplace',
    },
    {
      page: 'bookings',
      code: '02 · PASSES',
      title: 'QR Gate Passes & Bookings',
      subtitle:
        'Access active single-session QR gate tokens, live countdown timers, and complete INR receipt history.',
      metric: `${activeSessions} Active QR ${activeSessions === 1 ? 'Session' : 'Sessions'}`,
      icon: QrCode,
      accentClass: 'text-emerald-600 dark:text-emerald-400',
      cta: 'View My Passes',
    },
    {
      page: 'vendor',
      code: '03 · VENDOR',
      title: 'Vendor Partner Console',
      subtitle:
        'Publish garages, residential society bays, or EV hubs with Google Maps pins, custom prefixes, and 90% UPI payouts.',
      metric: `${totalBays} Managed Bays · 90% Net Split`,
      icon: Store,
      accentClass: 'text-amber-600 dark:text-amber-400',
      cta: 'Open Vendor Console',
    },
    {
      page: 'faq',
      code: '04 · PROTOCOL',
      title: 'Gate Protocol & Payout FAQ',
      subtitle:
        'Review digital QR entry rules, 90/10 UPI vendor payout settlement cycles, and security standards across Indian facilities.',
      metric: 'Verified Gate Standards',
      icon: Shield,
      accentClass: 'text-violet-600 dark:text-violet-400',
      cta: 'Read Protocol & FAQ',
    },
  ];

  return (
    <div className="space-y-0">
      <RuixenHero
        isDark={isDark}
        slots={slots}
        onNavigatePage={onNavigatePage}
        onSearchNearbyFromHero={onSearchNearbyFromHero}
      />

      {/* 1. City Strip */}
      <section className="border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-7 flex flex-col md:flex-row items-center justify-between gap-5">
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-xs text-center md:text-left">
            {approvedSlots.length} verified Indian {approvedSlots.length === 1 ? 'facility' : 'facilities'} syncing live bay occupancy in Firestore.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 text-sm font-display font-semibold tracking-tight">
            {INDIA_CITY_CENTERS.slice(0, 5).map((cityObj) => (
              <button
                key={cityObj.city}
                type="button"
                onClick={() =>
                  onSearchNearbyFromHero({
                    query: '',
                    location: {
                      label: cityObj.city,
                      lat: cityObj.lat,
                      lng: cityObj.lng,
                      source: 'city',
                    },
                  })
                }
                className="text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
              >
                {cityObj.city}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Platform Overview: Interactive Dedicated Module Directory */}
      <section className="border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-16">
          <motion.div
            initial={{opacity: 0, y: 18}}
            whileInView={{opacity: 1, y: 0}}
            viewport={{once: true, amount: 0.2}}
            transition={{duration: 0.45, ease: [0.16, 1, 0.3, 1]}}
            className="flex flex-col md:flex-row md:items-end justify-between gap-4"
          >
            <div>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-[34px] font-semibold tracking-tight leading-[1.18] text-zinc-900 dark:text-white max-w-3xl text-balance">
                Find verified bays, issue{' '}
                <span className="text-blue-600 dark:text-blue-400">
                  instant QR gate passes
                </span>
                , and manage lots in real time.{' '}
                <span className="text-zinc-500 dark:text-zinc-400 font-normal">
                  Built for daily commuters, EV fleets, and facility operators across India.
                </span>
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigatePage('faq')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline shrink-0 cursor-pointer"
            >
              Read Gate Protocol &amp; FAQ
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </motion.div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {moduleCards.map((mod, idx) => {
              const Icon = mod.icon;
              return (
                <motion.button
                  key={mod.page}
                  type="button"
                  onClick={() => onNavigatePage(mod.page)}
                  initial={{opacity: 0, y: 18}}
                  whileInView={{opacity: 1, y: 0}}
                  viewport={{once: true, amount: 0.2}}
                  transition={{
                    duration: 0.4,
                    delay: idx * 0.06,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  whileHover={{y: -4}}
                  className="group text-left rounded-xl border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#0B0B0F] overflow-hidden flex flex-col justify-between hover:border-blue-500/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/90 px-4 py-2.5 ruixen-dot-bg">
                    <span className="font-mono text-[11px] font-semibold tracking-tight text-zinc-500 dark:text-zinc-400 tabular-nums">
                      {mod.code}
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400 group-hover:text-blue-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <div className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', mod.accentClass)}>
                        <Icon className="h-3.5 w-3.5" />
                        {mod.cta}
                      </div>
                      <h3 className="mt-2 font-display text-base font-semibold text-zinc-900 dark:text-white">
                        {mod.title}
                      </h3>
                      <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        {mod.subtitle}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-zinc-200/70 dark:border-zinc-800/70 text-[11px] font-mono tabular-nums text-zinc-600 dark:text-zinc-300">
                      {mod.metric}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Creative Non-Spherical Indian Metro Corridor Selector */}
          <motion.div
            initial={{opacity: 0, y: 18}}
            whileInView={{opacity: 1, y: 0}}
            viewport={{once: true, amount: 0.15}}
            transition={{duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1]}}
            className="mt-10 flex flex-col gap-3"
          >
            <div className="w-full overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#0B0B0F] text-zinc-900 dark:text-zinc-100">
              {/* Top Architectural Telemetry Strip */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800/90 px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <Crosshair className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="font-display text-sm font-semibold text-zinc-900 dark:text-white">
                    Indian Metro Parking Network
                  </span>
                  <span className="hidden sm:inline text-xs text-zinc-400 dark:text-zinc-600">
                    ·
                  </span>
                  <span className="hidden sm:inline text-xs text-zinc-500 dark:text-zinc-400">
                    6 Priority Corridors · Flat Coordinate Matrix
                  </span>
                </div>
                <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                  {activeHub.lat.toFixed(4)}° N · {activeHub.lng.toFixed(4)}° E ·{' '}
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    {activeHub.code}
                  </span>
                </div>
              </div>

              {/* Split Layout: Flat India Corridor Schematic + Hub Matrix */}
              <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-zinc-800/90">
                {/* Left: Flat Architectural Blueprint Schematic (Zero Spheres) */}
                <div className="lg:col-span-5 relative flex flex-col justify-between p-5 sm:p-6 ruixen-grid-bg min-h-[320px]">
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                    <span>CORRIDOR ATLAS · IN-GRID</span>
                    <span>{activeHub.code} LOCKED</span>
                  </div>

                  <div className="relative my-3 flex items-center justify-center">
                    <svg
                      viewBox="0 0 300 250"
                      className="w-full max-w-[300px] h-auto select-none"
                      role="img"
                      aria-label={`India parking corridor grid focused on ${activeHub.name}`}
                    >
                      {/* Orthogonal Blueprint Frame Ticks */}
                      <rect
                        x="12"
                        y="12"
                        width="276"
                        height="226"
                        fill="none"
                        stroke="currentColor"
                        className="text-zinc-200 dark:text-zinc-800"
                        strokeWidth="1"
                        strokeDasharray="3 4"
                      />

                      {/* India Faceted Outline Polygon */}
                      <polygon
                        points={indiaOutlinePoints}
                        fill={
                          isDark
                            ? 'rgba(59, 130, 246, 0.06)'
                            : 'rgba(37, 99, 235, 0.045)'
                        }
                        stroke={
                          isDark
                            ? 'rgba(148, 163, 184, 0.35)'
                            : 'rgba(100, 116, 139, 0.35)'
                        }
                        strokeWidth="1.25"
                        strokeLinejoin="round"
                      />

                      {/* Inter-City Corridor Connectors */}
                      <polyline
                        points={corridorHubs
                          .map((h) => {
                            const p = projectIndiaCoord(h.lat, h.lng);
                            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                          })
                          .join(' ')}
                        fill="none"
                        stroke={
                          isDark
                            ? 'rgba(59, 130, 246, 0.28)'
                            : 'rgba(37, 99, 235, 0.25)'
                        }
                        strokeWidth="1"
                        strokeDasharray="2 3"
                      />

                      {/* Active Hub Orthogonal Crosshair Lines */}
                      {(() => {
                        const target = projectIndiaCoord(
                          activeHub.lat,
                          activeHub.lng
                        );
                        return (
                          <motion.g
                            animate={{x: target.x, y: target.y}}
                            transition={{
                              type: 'spring',
                              stiffness: 260,
                              damping: 26,
                            }}
                          >
                            <line
                              x1={-target.x + 12}
                              y1={0}
                              x2={288 - target.x}
                              y2={0}
                              stroke={
                                isDark
                                  ? 'rgba(96, 165, 250, 0.32)'
                                  : 'rgba(37, 99, 235, 0.28)'
                              }
                              strokeWidth="1"
                              strokeDasharray="3 3"
                            />
                            <line
                              x1={0}
                              y1={-target.y + 12}
                              x2={0}
                              y2={238 - target.y}
                              stroke={
                                isDark
                                  ? 'rgba(96, 165, 250, 0.32)'
                                  : 'rgba(37, 99, 235, 0.28)'
                              }
                              strokeWidth="1"
                              strokeDasharray="3 3"
                            />
                            {/* Square Architectural Reticle (No Circles/Spheres) */}
                            <rect
                              x={-9}
                              y={-9}
                              width={18}
                              height={18}
                              rx={3}
                              fill="none"
                              stroke="#3b82f6"
                              strokeWidth="1.5"
                            />
                          </motion.g>
                        );
                      })()}

                      {/* Hub Diamond / Square Waypoints */}
                      {corridorHubs.map((hub) => {
                        const pt = projectIndiaCoord(hub.lat, hub.lng);
                        const isSelected = hub.code === activeHub.code;
                        const labelLeft =
                          hub.code === 'BOM-01' || hub.code === 'BLR-01';
                        const labelYOffset =
                          hub.code === 'PNQ-01'
                            ? 11
                            : hub.code === 'HYD-01'
                              ? -6
                              : 3;
                        return (
                          <g
                            key={hub.code}
                            onClick={() => setPickedRegion(hub)}
                            className="cursor-pointer"
                          >
                            <rect
                              x={pt.x - (isSelected ? 4.5 : 3.2)}
                              y={pt.y - (isSelected ? 4.5 : 3.2)}
                              width={isSelected ? 9 : 6.4}
                              height={isSelected ? 9 : 6.4}
                              rx={1.5}
                              transform={`rotate(45 ${pt.x} ${pt.y})`}
                              fill={
                                isSelected
                                  ? '#3b82f6'
                                  : isDark
                                    ? '#18181b'
                                    : '#ffffff'
                              }
                              stroke={
                                isSelected
                                  ? '#ffffff'
                                  : hub.facilityCount > 0
                                    ? '#10b981'
                                    : isDark
                                      ? '#52525b'
                                      : '#94a3b8'
                              }
                              strokeWidth={isSelected ? 1.5 : 1.25}
                            />
                            <text
                              x={pt.x + (labelLeft ? -9 : 9)}
                              y={pt.y + labelYOffset}
                              textAnchor={labelLeft ? 'end' : 'start'}
                              fontSize="8.5"
                              fontFamily="var(--font-mono)"
                              fontWeight={isSelected ? '700' : '500'}
                              fill={
                                isSelected
                                  ? isDark
                                    ? '#93c5fd'
                                    : '#1d4ed8'
                                  : isDark
                                    ? '#a1a1aa'
                                    : '#52525b'
                              }
                            >
                              {hub.code.slice(0, 3)}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* Active Hub Readout Footer */}
                  <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800/80 flex items-end justify-between gap-3">
                    <div>
                      <div className="font-display text-base font-semibold text-zinc-900 dark:text-white">
                        {activeHub.name} Corridor
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {activeHub.zone}
                      </div>
                    </div>
                    <div className="text-right font-mono text-[11px] tabular-nums">
                      <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {activeHub.facilityCount > 0
                          ? `${activeHub.facilityCount} live · ${activeHub.freeBays} bays`
                          : 'Ready to launch'}
                      </div>
                      <div className="text-zinc-500 dark:text-zinc-400">
                        {activeHub.minRate !== null
                          ? `From ${formatCurrency(activeHub.minRate)}/hr`
                          : 'All India search'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Hairline-Divided 6-City Metro Hub Selector Matrix */}
                <div className="lg:col-span-7 flex flex-col justify-between">
                  <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 border-b border-zinc-200 dark:border-zinc-800/90">
                    {corridorHubs.map((hub, idx) => {
                      const isSelected = hub.code === activeHub.code;
                      const isRightCol = idx % 2 === 1;
                      const isNotBottomRow = idx < corridorHubs.length - 2;
                      return (
                        <button
                          key={hub.code}
                          type="button"
                          onClick={() => setPickedRegion(hub)}
                          onDoubleClick={() =>
                            onSearchNearbyFromHero({
                              query: '',
                              location: {
                                label: hub.city,
                                lat: hub.lat,
                                lng: hub.lng,
                                source: 'city',
                              },
                            })
                          }
                          className={cn(
                            'relative group text-left p-5 transition-colors duration-150 cursor-pointer flex flex-col justify-between gap-3',
                            isRightCol &&
                              'sm:border-l sm:border-zinc-200 dark:sm:border-zinc-800/90',
                            isNotBottomRow &&
                              'sm:border-b sm:border-zinc-200 dark:sm:border-zinc-800/90',
                            isSelected
                              ? 'bg-blue-500/[0.06] dark:bg-blue-500/[0.08]'
                              : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                          )}
                        >
                          {isSelected && (
                            <motion.span
                              layoutId="corridor-hub-bar"
                              transition={{
                                type: 'spring',
                                stiffness: 320,
                                damping: 30,
                              }}
                              className="absolute inset-x-0 top-0 h-[2px] bg-blue-500"
                            />
                          )}

                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                'font-mono text-[11px] font-semibold tracking-tight tabular-nums',
                                isSelected
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-zinc-500 dark:text-zinc-400'
                              )}
                            >
                              {hub.code}
                            </span>
                            {isSelected ? (
                              <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                            ) : (
                              <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400 group-hover:text-blue-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
                            )}
                          </div>

                          <div>
                            <div className="font-display text-base font-semibold text-zinc-900 dark:text-white">
                              {hub.name}
                            </div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                              {hub.zone}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-zinc-200/70 dark:border-zinc-800/80 font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                            <span>
                              {hub.lat.toFixed(2)}°N · {hub.lng.toFixed(2)}°E
                            </span>
                            <span
                              className={cn(
                                'font-medium',
                                hub.facilityCount > 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-zinc-400 dark:text-zinc-500'
                              )}
                            >
                              {hub.facilityCount > 0
                                ? `${hub.facilityCount} live · ${hub.freeBays} free`
                                : 'Explore corridor'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Bottom Confirmation Action Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-zinc-50/60 dark:bg-zinc-950/50">
                    <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                      Selected {activeHub.name} ({activeHub.code}) · {activeHub.zone}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        onSearchNearbyFromHero({
                          query: '',
                          location: {
                            label: activeHub.city,
                            lat: activeHub.lat,
                            lng: activeHub.lng,
                            source: 'city',
                          },
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 dark:bg-white px-4 py-2 text-xs font-semibold text-white dark:text-zinc-950 hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Explore {activeHub.city} Bays
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 3. Bento Section Framed in Hatched Side Rails */}
      <section className="border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-16">
          <motion.h2
            initial={{opacity: 0, y: 16}}
            whileInView={{opacity: 1, y: 0}}
            viewport={{once: true, amount: 0.2}}
            transition={{duration: 0.45, ease: [0.16, 1, 0.3, 1]}}
            className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white max-w-2xl text-balance"
          >
            Built for urban mobility.{' '}
            <span className="text-zinc-500 dark:text-zinc-400 font-normal">
              Search live bays, deploy EV chargers, and manage properties — all synced in real time.
            </span>
          </motion.h2>

          {/* Framed Bento Grid with diagonal hatched side gutters */}
          <motion.div
            initial={{opacity: 0, y: 20}}
            whileInView={{opacity: 1, y: 0}}
            viewport={{once: true, amount: 0.12}}
            transition={{duration: 0.5, ease: [0.16, 1, 0.3, 1]}}
            className="mt-10 grid grid-cols-1 lg:grid-cols-12 border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#0B0B0F]"
          >
            {/* Left Hatch Gutter */}
            <div className="hidden lg:block lg:col-span-1 border-r border-zinc-200 dark:border-zinc-800/90 ruixen-hatch" />

            {/* Main Bento Body */}
            <div className="lg:col-span-10 divide-y divide-zinc-200 dark:divide-zinc-800/90">
              {/* Row 1: Two Bento Cells */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800/90">
                {/* Cell 1: Live Neighborhood Telemetry */}
                <div className="p-6 sm:p-8 flex flex-col justify-between gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                      Monitor bays across Indian hubs.{' '}
                      <span className="font-normal text-zinc-500 dark:text-zinc-400">
                        Click any live facility chip to open the interactive Marketplace map centered on it.
                      </span>
                    </h3>
                  </div>

                  <div className="relative h-48 rounded-lg border border-zinc-200 dark:border-zinc-800/80 ruixen-dot-bg p-4 overflow-hidden">
                    {approvedSlots.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center text-center text-xs text-zinc-500 dark:text-zinc-400 px-4 gap-3">
                        <span>
                          No approved Indian facilities published yet. Add a slot as Vendor and approve it in Admin to view live telemetry.
                        </span>
                        <button
                          type="button"
                          onClick={() => onNavigatePage('vendor')}
                          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 cursor-pointer"
                        >
                          Add First Facility
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      approvedSlots.slice(0, 3).map((slot, idx) => {
                        const positions = [
                          'top-6 left-6',
                          'top-16 right-8',
                          'bottom-6 left-1/3',
                        ];
                        return (
                          <motion.button
                            key={slot.id}
                            type="button"
                            whileHover={{scale: 1.04}}
                            whileTap={{scale: 0.98}}
                            onClick={() =>
                              onSearchNearbyFromHero({
                                query: slot.title,
                                location: {
                                  label: slot.neighborhood,
                                  lat: slot.lat,
                                  lng: slot.lng,
                                  source: 'place',
                                },
                              })
                            }
                            className={cn(
                              'absolute inline-flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700/80 bg-white/95 dark:bg-zinc-900/95 px-2.5 py-1 text-[11px] font-mono shadow-sm hover:border-blue-500 transition-colors cursor-pointer',
                              positions[idx]
                            )}
                          >
                            <span className="font-semibold text-zinc-900 dark:text-white">
                              {slot.neighborhood.split(',')[0].trim()}
                            </span>
                            <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {getAvailableBayCount(slot)} free
                            </span>
                          </motion.button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Cell 2: Interactive Bay / Facility Selector */}
                <div className="p-6 sm:p-8 flex flex-col justify-between gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                      Pick the ideal bay for any vehicle.{' '}
                      <span className="font-normal text-zinc-500 dark:text-zinc-400">
                        Filter EV fast-chargers, covered garages, and two-wheeler zones in one click.
                      </span>
                    </h3>
                  </div>

                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 overflow-hidden">
                    <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 px-3 py-2">
                      <Search className="h-3.5 w-3.5 text-zinc-400" />
                      <input
                        type="text"
                        value={baySearch}
                        onChange={(e) => setBaySearch(e.target.value)}
                        placeholder="Search Indian facilities..."
                        className="w-full bg-transparent text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
                      />
                    </div>
                    <div className="p-1.5 space-y-1">
                      {quickListSlots.length === 0 ? (
                        <div className="px-3 py-5 text-center text-xs text-zinc-500 dark:text-zinc-400">
                          No live approved facilities found yet.
                        </div>
                      ) : (
                        quickListSlots.map((slot) => {
                          const isPicked = effectiveQuickId === slot.id;
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => {
                                setSelectedQuickId(slot.id);
                                onSearchNearbyFromHero({
                                  query: slot.title,
                                  location: {
                                    label: slot.neighborhood,
                                    lat: slot.lat,
                                    lng: slot.lng,
                                    source: 'place',
                                  },
                                });
                              }}
                              className={cn(
                                'flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors cursor-pointer',
                                isPicked
                                  ? 'bg-blue-600 text-white'
                                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800/70'
                              )}
                            >
                              <span className="flex items-center gap-2 truncate">
                                <span className="font-mono text-[10px] opacity-75">
                                  {slot.slotPrefix}1
                                </span>
                                <span className="font-medium truncate">{slot.title}</span>
                              </span>
                              <span className="flex items-center gap-2 shrink-0 ml-2 font-mono tabular-nums">
                                <span>{formatCurrency(slot.hourlyRate)}/h</span>
                                {isPicked && <Check className="h-3.5 w-3.5" />}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Full-width Statement */}
              <div className="px-6 py-14 sm:px-12 text-center bg-zinc-50/40 dark:bg-[#0D0D12]">
                <blockquote className="mx-auto max-w-2xl font-display text-xl sm:text-3xl font-medium tracking-tight text-zinc-900 dark:text-white leading-snug text-balance">
                  &ldquo;Built for Indian commercial garages, residential societies, and metro EV hubs with transparent INR pricing and instant QR gate access.&rdquo;
                </blockquote>
                <div className="mt-5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  ParkGrid India
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Live Firestore Inventory · Google Maps India Region
                </div>
              </div>

              {/* Row 3: Two Bento Cells (QR Pass Flow + Citations Pager) */}
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800/90">
                {/* Left: Live Pass Status Bubbles */}
                <div className="p-6 sm:p-8 flex flex-col justify-between gap-6">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                      Instant QR gate passes.{' '}
                      <span className="font-normal text-zinc-500 dark:text-zinc-400">
                        Pick your bay, adjust duration hours, and scan directly at entry without paper tickets.
                      </span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => onNavigatePage('bookings')}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline shrink-0 cursor-pointer"
                    >
                      My Passes
                    </button>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="inline-block rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/90 px-3 py-2 text-zinc-700 dark:text-zinc-300">
                      {latestBooking
                        ? `Reserved Bay ${latestBooking.bayCode} at ${latestBooking.slotTitle}?`
                        : 'Select any available bay in the Driver Marketplace'}
                    </div>
                    <div className="flex justify-end">
                      <div className="rounded-lg bg-blue-600 px-3.5 py-2 text-white max-w-xs">
                        {latestBooking
                          ? `Confirmed for ${latestBooking.durationHours}h (${formatCurrency(latestBooking.totalAmount)}). Pass ${latestBooking.qrCodeToken} is live.`
                          : 'Instant QR pass and bay lock generate automatically upon booking confirmation.'}
                      </div>
                    </div>
                    <div className="inline-block rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/90 px-3 py-2 text-zinc-700 dark:text-zinc-300">
                      <span className="inline-flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-emerald-500" />
                        {latestBooking
                          ? `Vehicle ${latestBooking.vehiclePlate} · Status: ${latestBooking.status}`
                          : 'UPI-ready payouts · EV Fast Charger bay support'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Verifiable Workflow Citation Carousel */}
                <div className="p-6 sm:p-8 flex flex-col justify-between gap-5">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                      Verified platform governance.{' '}
                      <span className="font-normal text-zinc-500 dark:text-zinc-400">
                        Every vendor listing and driver reservation follows strict Firebase rules and admin review.
                      </span>
                    </h3>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.p
                      key={citationIndex}
                      initial={{opacity: 0, y: 6}}
                      animate={{opacity: 1, y: 0}}
                      exit={{opacity: 0, y: -6}}
                      transition={{duration: 0.2}}
                      className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400"
                    >
                      {citation.summary}{' '}
                      <button
                        type="button"
                        onClick={() => onNavigatePage(citation.targetPage)}
                        className="text-blue-600 dark:text-blue-400 underline underline-offset-4 cursor-pointer"
                      >
                        {citation.linkLabel}
                      </button>
                    </motion.p>
                  </AnimatePresence>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label="Previous highlight"
                          onClick={() =>
                            setCitationIndex(
                              (prev) => (prev - 1 + CITATION_CARDS.length) % CITATION_CARDS.length
                            )
                          }
                          className="rounded-md border border-zinc-200 dark:border-zinc-800 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Next highlight"
                          onClick={() =>
                            setCitationIndex((prev) => (prev + 1) % CITATION_CARDS.length)
                          }
                          className="rounded-md border border-zinc-200 dark:border-zinc-800 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="font-mono tabular-nums">
                        {citationIndex + 1} / {CITATION_CARDS.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigatePage(citation.targetPage)}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 p-3 text-left hover:border-blue-500/60 transition-colors cursor-pointer"
                    >
                      <div className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center justify-between">
                        <span>{citation.title}</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Hatch Gutter */}
            <div className="hidden lg:block lg:col-span-1 border-l border-zinc-200 dark:border-zinc-800/90 ruixen-hatch" />
          </motion.div>
        </div>
      </section>

      {/* 4. Real-Time Platform Metrics + Smooth Area Chart */}
      <section className="border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-16">
          <motion.h2
            initial={{opacity: 0, y: 16}}
            whileInView={{opacity: 1, y: 0}}
            viewport={{once: true, amount: 0.2}}
            transition={{duration: 0.45, ease: [0.16, 1, 0.3, 1]}}
            className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white max-w-2xl text-balance"
          >
            Powering operators with real-time insights.{' '}
            <span className="text-zinc-500 dark:text-zinc-400 font-normal">
              Live bay utilization, EV charging demand, and payout velocity at a glance.
            </span>
          </motion.h2>

          <motion.div
            initial={{opacity: 0, y: 20}}
            whileInView={{opacity: 1, y: 0}}
            viewport={{once: true, amount: 0.12}}
            transition={{duration: 0.5, ease: [0.16, 1, 0.3, 1]}}
            className="mt-10 grid grid-cols-1 lg:grid-cols-12 border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#0B0B0F]"
          >
            <div className="hidden lg:block lg:col-span-1 border-r border-zinc-200 dark:border-zinc-800/90 ruixen-hatch" />

            <div className="lg:col-span-10">
              {/* 4-column metric strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 dark:divide-zinc-800/90 border-b border-zinc-200 dark:border-zinc-800/90">
                <div className="p-6">
                  <div className="font-display text-2xl sm:text-3xl font-semibold font-mono tabular-nums text-zinc-900 dark:text-white">
                    {totalBays}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Managed Bays
                  </div>
                </div>
                <div className="p-6">
                  <div className="font-display text-2xl sm:text-3xl font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {freeBays}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Available Right Now
                  </div>
                </div>
                <div className="p-6">
                  <div className="font-display text-2xl sm:text-3xl font-semibold font-mono tabular-nums text-zinc-900 dark:text-white">
                    {activeSessions}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Active QR Sessions
                  </div>
                </div>
                <div className="p-6">
                  <div className="font-display text-2xl sm:text-3xl font-semibold font-mono tabular-nums text-blue-600 dark:text-blue-400">
                    {formatCurrency(totalRevenue)}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Processed Volume
                  </div>
                </div>
              </div>

              {/* Curved Blue Area Telemetry Chart */}
              <div className="relative p-6 pt-8">
                <div className="relative h-52 w-full">
                  <svg
                    viewBox="0 0 700 180"
                    className="h-full w-full overflow-visible"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="ruixenAreaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563EB" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path d={chartPaths.stdArea} fill="url(#ruixenAreaFill)" />
                    <motion.path
                      d={chartPaths.stdLine}
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="2.5"
                      initial={{pathLength: 0}}
                      whileInView={{pathLength: 1}}
                      viewport={{once: true}}
                      transition={{duration: 0.9, ease: 'easeOut'}}
                    />
                    <motion.path
                      d={chartPaths.evLine}
                      fill="none"
                      stroke="#10B981"
                      strokeOpacity="0.65"
                      strokeWidth="1.75"
                      initial={{pathLength: 0}}
                      whileInView={{pathLength: 1}}
                      viewport={{once: true}}
                      transition={{duration: 1.0, delay: 0.1, ease: 'easeOut'}}
                    />
                  </svg>

                  {/* Interactive Time Selector Dots */}
                  <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                    {chartSeries.map((pt, idx) => (
                      <button
                        key={pt.label}
                        type="button"
                        onMouseEnter={() => setHoveredPointIdx(idx)}
                        onClick={() => setHoveredPointIdx(idx)}
                        className={cn(
                          'px-2 py-0.5 rounded transition-colors cursor-pointer',
                          hoveredPointIdx === idx
                            ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 font-semibold'
                            : 'hover:text-zinc-900 dark:hover:text-zinc-200'
                        )}
                      >
                        {pt.label}
                      </button>
                    ))}
                  </div>

                  {/* Floating Tooltip */}
                  <div className="absolute right-8 sm:right-12 top-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 p-3 text-xs shadow-xl font-mono tabular-nums">
                    <div className="font-semibold text-zinc-900 dark:text-white mb-1">
                      {chartSeries[hoveredPointIdx].label} Demand
                    </div>
                    <div className="flex items-center justify-between gap-4 text-zinc-500 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm bg-blue-500" />
                        Standard Bays
                      </span>
                      <span className="text-zinc-900 dark:text-white font-semibold">
                        {chartSeries[hoveredPointIdx].standard}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-zinc-500 dark:text-zinc-400 mt-1">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm bg-emerald-500" />
                        EV Chargers
                      </span>
                      <span className="text-zinc-900 dark:text-white font-semibold">
                        {chartSeries[hoveredPointIdx].ev}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden lg:block lg:col-span-1 border-l border-zinc-200 dark:border-zinc-800/90 ruixen-hatch" />
          </motion.div>
        </div>
      </section>

      {/* 5. Bottom Cobalt-Glow CTA Card */}
      <section className="border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-16">
          <motion.div
            initial={{opacity: 0, y: 18}}
            whileInView={{opacity: 1, y: 0}}
            viewport={{once: true, amount: 0.2}}
            transition={{duration: 0.45, ease: [0.16, 1, 0.3, 1]}}
            className="relative overflow-hidden border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#0B0B0F] p-8 sm:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 bottom-0 h-56 w-80 bg-[radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.22),transparent_70%)] dark:bg-[radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.38),transparent_70%)]"
            />
            <div className="relative z-10">
              <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                List Your First Parking Facility Today
              </h2>
            </div>
            <div className="relative z-10 max-w-sm space-y-4">
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                Join commercial garage operators and property owners across India monetizing empty bays with real-time QR access and automated UPI payouts.
              </p>
              <button
                type="button"
                onClick={() => onNavigatePage('vendor')}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-950 dark:bg-white px-4 py-2.5 text-xs font-semibold text-white dark:text-zinc-950 hover:opacity-90 transition-opacity cursor-pointer"
              >
                Open Vendor Console
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

interface RuixenFaqPageProps {
  onNavigatePage: (page: AppPage) => void;
}

export function RuixenFaqPage({onNavigatePage}: RuixenFaqPageProps) {
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-[1040px] px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            Gate Protocol, Payouts &amp; FAQ
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">
            How ParkGrid verifies Indian parking facilities, processes INR bookings, and manages QR entry across Driver, Vendor, and Super Admin workflows.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigatePage('marketplace')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors cursor-pointer"
          >
            Browse Live Slots
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 3-Step Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            step: '01 · Driver Search & Lock',
            title: 'GPS & City-Wise Discovery',
            body: 'Search nearby coordinates or pick any Indian city hub, inspect real-time available bays, and reserve in INR with a single tap.',
          },
          {
            step: '02 · QR Gate Verification',
            title: 'Single-Session Pass Token',
            body: 'Every booking issues a cryptographic QR token synced to Firestore. Scan at garage kiosks or show the attendant at entry.',
          },
          {
            step: '03 · 90/10 Settlement',
            title: 'Vendor Payouts & Admin Audit',
            body: 'Vendors retain 90% of booking subtotals via UPI/bank settlement while Super Admins verify coordinates and facility safety.',
          },
        ].map((card, i) => (
          <motion.div
            key={card.step}
            initial={{opacity: 0, y: 14}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.35, delay: i * 0.06}}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0B0B0F] p-5 space-y-2"
          >
            <div className="font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400">
              {card.step}
            </div>
            <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-white">
              {card.title}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {card.body}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Animated Accordion */}
      <div className="border border-zinc-200 dark:border-zinc-800/90 divide-y divide-zinc-200 dark:divide-zinc-800/90 bg-white dark:bg-[#0B0B0F] rounded-xl overflow-hidden">
        {FAQ_ITEMS.map((item, idx) => {
          const isOpen = openFaqIdx === idx;
          return (
            <div key={item.q}>
              <button
                type="button"
                onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                className="flex w-full items-center justify-between px-5 py-4 text-left text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer"
              >
                <span>{item.q}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-zinc-500 transition-transform duration-200 shrink-0 ml-4',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{height: 0, opacity: 0}}
                    animate={{height: 'auto', opacity: 1}}
                    exit={{height: 0, opacity: 0}}
                    transition={{duration: 0.22, ease: [0.16, 1, 0.3, 1]}}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {item.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ParkGridFooterProps {
  onNavigatePage: (page: AppPage) => void;
  onSelectCityFromFooter: (city: string) => void;
}

export function ParkGridFooter({
  onNavigatePage,
  onSelectCityFromFooter,
}: ParkGridFooterProps) {
  return (
    <footer className="mt-auto border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-[#09090B]">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 pb-10 border-b border-zinc-200 dark:border-zinc-800/80">
          <div className="col-span-2 space-y-3">
            <button
              type="button"
              onClick={() => onNavigatePage('overview')}
              className="flex items-center gap-2 cursor-pointer"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-display font-bold text-xs">
                P
              </span>
              <span className="font-display text-sm font-semibold text-zinc-900 dark:text-white">
                ParkGrid
              </span>
            </button>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs leading-relaxed">
              Smart parking marketplace and bay telemetry platform for drivers, property vendors, and Indian metro operators.
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <div className="font-semibold text-zinc-900 dark:text-white">Pages</div>
            <div className="flex flex-col gap-1.5 text-zinc-500 dark:text-zinc-400">
              <button
                type="button"
                onClick={() => onNavigatePage('overview')}
                className="text-left hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => onNavigatePage('marketplace')}
                className="text-left hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                Driver Marketplace
              </button>
              <button
                type="button"
                onClick={() => onNavigatePage('bookings')}
                className="text-left hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                My Bookings &amp; QR
              </button>
              <button
                type="button"
                onClick={() => onNavigatePage('vendor')}
                className="text-left hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                Vendor Console
              </button>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="font-semibold text-zinc-900 dark:text-white">Cities</div>
            <div className="flex flex-col gap-1.5 text-zinc-500 dark:text-zinc-400">
              {['Bengaluru', 'Mumbai', 'New Delhi', 'Hyderabad'].map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => onSelectCityFromFooter(city)}
                  className="text-left hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                >
                  {city}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="font-semibold text-zinc-900 dark:text-white">Protocol</div>
            <div className="flex flex-col gap-1.5 text-zinc-500 dark:text-zinc-400">
              <button
                type="button"
                onClick={() => onNavigatePage('faq')}
                className="text-left hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                QR Gate Protocol
              </button>
              <button
                type="button"
                onClick={() => onNavigatePage('faq')}
                className="text-left hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                90/10 UPI Payouts
              </button>
              <button
                type="button"
                onClick={() => onNavigatePage('faq')}
                className="text-left hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                FAQ &amp; Help
              </button>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="font-semibold text-zinc-900 dark:text-white">Infrastructure</div>
            <div className="flex flex-col gap-1.5 text-zinc-500 dark:text-zinc-400">
              <span>Google Maps India</span>
              <span>Firebase Firestore</span>
              <span>Live Bay Telemetry</span>
            </div>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-500">
          <span>© 2026 ParkGrid Mobility Systems. All rights reserved.</span>
          <span>Live bay inventory · India (INR)</span>
        </div>
      </div>

      <WordmarkFooter brandName="ParkGrid" />
    </footer>
  );
}
