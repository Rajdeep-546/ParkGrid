import {useCallback, useEffect, useMemo, useState} from 'react';
import {onAuthStateChanged, type User as FirebaseUser} from 'firebase/auth';
import {ArrowLeft} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import {Toaster, toast} from 'sonner';
import {
  DEFAULT_INDIA_CENTER,
  INDIA_CITY_CENTERS,
} from './data/indiaParkingConfig';
import {
  adminUpdateUserInFirestore,
  auth,
  createBookingInFirestore,
  createParkingSlotInFirestore,
  deleteParkingSlotInFirestore,
  fetchUserProfileFromFirestore,
  signInWithGoogle,
  signOutFirebase,
  subscribeAllBookingsAdmin,
  subscribeAllParkingSlotsAdmin,
  subscribeAllUsersAdmin,
  subscribeApprovedParkingSlots,
  subscribeCurrentUserProfile,
  subscribeDriverBookings,
  subscribeVendorBookings,
  subscribeVendorParkingSlots,
  testFirestoreConnection,
  updateBookingStatusInFirestore,
  updateParkingSlotInFirestore,
  upsertUserProfileInFirestore,
} from './lib/firebase';
import {generateBays, sanitizeId} from './lib/utils';
import type {
  AppNotification,
  AppPage,
  ApprovalStatus,
  BookingRecord,
  BookingStatus,
  ParkingBay,
  ParkingSlot,
  SearchLocationFilter,
  UserProfile,
  UserRole,
  VehicleType,
} from './types/parking';
import {AdminDashboard} from './components/admin/AdminDashboard';
import {AuthModal} from './components/auth/AuthModal';
import {DriverDashboard} from './components/driver/DriverDashboard';
import {CommandSearchModal} from './components/layout/CommandSearchModal';
import {NavbarFloating} from './components/layout/NavbarFloating';
import {ScrollToTopButton} from './components/layout/ScrollToTopButton';
import {
  ParkGridFooter,
  RuixenFaqPage,
  RuixenOverviewPage,
} from './components/layout/RuixenSections';
import {MapsRootProvider} from './components/maps/PlacesProvider';
import {ProfilePage} from './components/profile/ProfilePage';
import {VendorDashboard} from './components/vendor/VendorDashboard';

function toIsoString(val: unknown): string {
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as {toDate: () => Date}).toDate === 'function') {
    return (val as {toDate: () => Date}).toDate().toISOString();
  }
  if (typeof val === 'string' && val.trim() !== '') return val;
  return new Date().toISOString();
}

function mapRawSlot(d: Record<string, unknown>): ParkingSlot {
  const total = Math.max(1, Number(d.totalSlots || 6));
  const prefix = String(d.slotPrefix || 'A');
  const amenities = Array.isArray(d.amenities)
    ? (d.amenities as ParkingSlot['amenities'])
    : [];
  const vehicleTypes: VehicleType[] = Array.isArray(d.vehicleTypes)
    ? (d.vehicleTypes as VehicleType[])
    : ['Sedan'];
  const ev = amenities.includes('ev_charger') || vehicleTypes.includes('EV');
  return {
    id: String(d.id || ''),
    vendorId: String(d.vendorId || ''),
    vendorName: String(d.vendorName || 'Partner Parking Facility'),
    title: String(d.title || 'Parking Facility'),
    address: String(d.address || ''),
    landmark: String(d.landmark || ''),
    neighborhood: String(d.neighborhood || 'India'),
    category: (d.category as ParkingSlot['category']) || 'Covered Garage',
    lat: Number(d.lat ?? DEFAULT_INDIA_CENTER.lat),
    lng: Number(d.lng ?? DEFAULT_INDIA_CENTER.lng),
    distanceKm: Number(d.distanceKm ?? 1.0),
    totalSlots: total,
    slotPrefix: prefix,
    bays: generateBays(total, prefix, ev, []),
    hourlyRate: Number(d.hourlyRate || 80),
    dailyRate: Number(d.dailyRate || 450),
    monthlyRate: Number(d.monthlyRate || 4500),
    rating: Number(d.rating || 0),
    reviewCount: Number(d.reviewCount || 0),
    is24Hours: Boolean(d.is24Hours),
    openTime: String(d.openTime || '00:00'),
    closeTime: String(d.closeTime || '23:59'),
    isOpen: Boolean(d.isOpen),
    approvalStatus: (d.approvalStatus as ApprovalStatus) || 'pending',
    thumbnailId: String(d.thumbnailId || 'covered-vault'),
    vehicleTypes,
    amenities,
    createdAt: toIsoString(d.createdAt),
    updatedAt: toIsoString(d.updatedAt),
  };
}

function mapRawBooking(d: Record<string, unknown>, slotLookup: Map<string, ParkingSlot>): BookingRecord {
  const slotId = String(d.slotId || '');
  const matchedSlot = slotLookup.get(slotId);
  const startTime = toIsoString(d.startTime || d.createdAt);
  const durationHours = Math.max(1, Number(d.durationHours || 1));
  const endTime = new Date(
    new Date(startTime).getTime() + durationHours * 3600 * 1000
  ).toISOString();
  const totalAmount = Number(d.totalAmount || 0);
  const platformFee = Number(d.platformFee ?? Number((totalAmount * (0.1 / 1.1)).toFixed(2)));
  const vendorPayout = Number(d.vendorPayout ?? Number((totalAmount - platformFee).toFixed(2)));

  return {
    id: String(d.id || ''),
    driverId: String(d.driverId || ''),
    driverName: String(d.driverName || 'Driver'),
    vendorId: String(d.vendorId || ''),
    slotId,
    slotTitle: String(d.slotTitle || matchedSlot?.title || 'Parking Facility'),
    slotAddress: String(matchedSlot?.address || ''),
    bayCode: String(d.bayCode || 'A1'),
    vehiclePlate: String(d.vehiclePlate || ''),
    startTime,
    endTime,
    durationHours,
    hourlyRate: matchedSlot?.hourlyRate || Number((totalAmount / 1.1 / durationHours).toFixed(2)),
    totalAmount,
    platformFee,
    vendorPayout,
    status: (d.status as BookingStatus) || 'active',
    qrCodeToken: String(d.qrCodeToken || ''),
    createdAt: toIsoString(d.createdAt),
    updatedAt: toIsoString(d.updatedAt),
  };
}

function mapRawUser(d: Record<string, unknown>): UserProfile {
  return {
    uid: String(d.uid || ''),
    fullName: String(d.fullName || 'ParkGrid User'),
    email: String(d.email || ''),
    phone: String(d.phone || ''),
    role: (d.role as UserRole) || 'driver',
    vehicleType: d.vehicleType as UserProfile['vehicleType'],
    licensePlate: d.licensePlate ? String(d.licensePlate) : undefined,
    businessName: d.businessName ? String(d.businessName) : undefined,
    payoutId: d.payoutId ? String(d.payoutId) : undefined,
    idVerified: Boolean(d.idVerified),
    admin: d.admin === true,
    status: (d.status as 'active' | 'suspended') || 'active',
    createdAt: toIsoString(d.createdAt),
    updatedAt: toIsoString(d.updatedAt),
  };
}

const VALID_PAGES: AppPage[] = [
  'overview',
  'marketplace',
  'bookings',
  'vendor',
  'admin',
  'profile',
  'faq',
];

function parseHashPage(): AppPage {
  if (typeof window === 'undefined') return 'overview';
  const raw = window.location.hash.replace(/^#\/?/, '') as AppPage;
  return VALID_PAGES.includes(raw) ? raw : 'overview';
}

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(true);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState<boolean>(false);

  const [activePage, setActivePage] = useState<AppPage>(() => parseHashPage());
  const [activeRole, setActiveRole] = useState<UserRole>('driver');
  const [activeTab, setActiveTab] = useState<string>('marketplace');
  const [marketplaceQuery, setMarketplaceQuery] = useState<string>('');
  const [searchLocation, setSearchLocation] = useState<SearchLocationFilter | null>(null);

  // Local session additions (when testing unauthenticated) merged cleanly with Firestore collections
  const [localUsers, setLocalUsers] = useState<UserProfile[]>([]);
  const [localSlots, setLocalSlots] = useState<ParkingSlot[]>([]);
  const [localBookings, setLocalBookings] = useState<BookingRecord[]>([]);

  // Live Firestore collection snapshots
  const [remoteApprovedSlots, setRemoteApprovedSlots] = useState<ParkingSlot[]>([]);
  const [remoteVendorSlots, setRemoteVendorSlots] = useState<ParkingSlot[]>([]);
  const [remoteAdminSlots, setRemoteAdminSlots] = useState<ParkingSlot[]>([]);
  const [remoteDriverBookings, setRemoteDriverBookings] = useState<Record<string, unknown>[]>([]);
  const [remoteVendorBookings, setRemoteVendorBookings] = useState<Record<string, unknown>[]>([]);
  const [remoteAdminBookings, setRemoteAdminBookings] = useState<Record<string, unknown>[]>([]);
  const [remoteAdminUsers, setRemoteAdminUsers] = useState<UserProfile[]>([]);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [customSessionUser, setCustomSessionUser] = useState<UserProfile | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [commandOpen, setCommandOpen] = useState<boolean>(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    const handler = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  // Auth listener & live profile hydration (never grants admin via website)
  useEffect(() => {
    void testFirestoreConnection();

    let unsubProfile: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = undefined;
      }
      setFirebaseUser(user);
      if (user) {
        try {
          const existing = await fetchUserProfileFromFirestore(user.uid);
          if (!existing) {
            const nowIso = new Date().toISOString();
            const newProfile: UserProfile = {
              uid: sanitizeId(user.uid),
              fullName: user.displayName || user.email?.split('@')[0] || 'ParkGrid User',
              email: user.email || '',
              phone: user.phoneNumber || '',
              role: 'driver',
              vehicleType: 'EV',
              licensePlate: 'KA01MJ4829',
              idVerified: Boolean(user.emailVerified),
              status: 'active',
              createdAt: nowIso,
              updatedAt: nowIso,
            };
            await upsertUserProfileInFirestore(newProfile);
          }

          // Live listener on users/{uid} so `admin: true` set in Firebase Console reflects immediately
          unsubProfile = subscribeCurrentUserProfile(user.uid, (profile) => {
            if (!profile) return;
            setCustomSessionUser(profile);
            setActiveRole(profile.admin === true ? 'admin' : profile.role === 'vendor' ? 'vendor' : 'driver');
            setLocalUsers((prev) => [
              profile,
              ...prev.filter((u) => u.uid !== profile.uid),
            ]);
          });
        } catch (err) {
          console.error('Auth profile sync warning:', err);
        }
      } else {
        setCustomSessionUser(null);
        setRemoteVendorSlots([]);
        setRemoteAdminSlots([]);
        setRemoteDriverBookings([]);
        setRemoteVendorBookings([]);
        setRemoteAdminBookings([]);
        setRemoteAdminUsers([]);
      }
    });

    return () => {
      if (unsubProfile) unsubProfile();
      unsubAuth();
    };
  }, []);

  const isFirebaseAdmin = Boolean(firebaseUser && customSessionUser?.admin === true);
  const hasActiveSession = Boolean(firebaseUser || customSessionUser);

  // Public approved parking slots subscription (works both signed-in and anonymous)
  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeApprovedParkingSlots((remoteDocs) => {
        setRemoteApprovedSlots(remoteDocs.map(mapRawSlot));
      });
    } catch (err) {
      console.error('Firestore approved slots subscription error:', err);
    }
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Authenticated role-scoped Firestore subscriptions
  useEffect(() => {
    if (!firebaseUser) return;
    const unsubs: (() => void)[] = [];

    try {
      unsubs.push(
        subscribeVendorParkingSlots(firebaseUser.uid, (docs) => {
          setRemoteVendorSlots(docs.map(mapRawSlot));
        })
      );
      unsubs.push(
        subscribeDriverBookings(firebaseUser.uid, (docs) => {
          setRemoteDriverBookings(docs);
        })
      );
      unsubs.push(
        subscribeVendorBookings(firebaseUser.uid, (docs) => {
          setRemoteVendorBookings(docs);
        })
      );

      if (isFirebaseAdmin) {
        unsubs.push(
          subscribeAllParkingSlotsAdmin((docs) => {
            setRemoteAdminSlots(docs.map(mapRawSlot));
          })
        );
        unsubs.push(
          subscribeAllBookingsAdmin((docs) => {
            setRemoteAdminBookings(docs);
          })
        );
        unsubs.push(
          subscribeAllUsersAdmin((docs) => {
            setRemoteAdminUsers(docs.map(mapRawUser));
          })
        );
      } else {
        setRemoteAdminSlots([]);
        setRemoteAdminBookings([]);
        setRemoteAdminUsers([]);
      }
    } catch (err) {
      console.error('Firestore role subscription error:', err);
    }

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [firebaseUser, isFirebaseAdmin]);

  // Unified merged users (Firestore Admin snapshot + session/local registrations)
  const users = useMemo<UserProfile[]>(() => {
    const byId = new Map<string, UserProfile>();
    for (const u of remoteAdminUsers) {
      if (u.uid) byId.set(u.uid, u);
    }
    for (const u of localUsers) {
      if (u.uid && !byId.has(u.uid)) byId.set(u.uid, u);
    }
    return Array.from(byId.values());
  }, [remoteAdminUsers, localUsers]);

  // Base slots before dynamic bay-occupancy overlay
  const rawMergedSlots = useMemo<ParkingSlot[]>(() => {
    const byId = new Map<string, ParkingSlot>();
    for (const s of remoteApprovedSlots) byId.set(s.id, s);
    for (const s of remoteVendorSlots) byId.set(s.id, s);
    for (const s of remoteAdminSlots) byId.set(s.id, s);
    for (const s of localSlots) byId.set(s.id, s);
    return Array.from(byId.values());
  }, [remoteApprovedSlots, remoteVendorSlots, remoteAdminSlots, localSlots]);

  // Unified bookings merged from Firestore & local state
  const bookings = useMemo<BookingRecord[]>(() => {
    const slotMap = new Map(rawMergedSlots.map((s) => [s.id, s]));
    const byId = new Map<string, BookingRecord>();
    for (const d of remoteDriverBookings) {
      const b = mapRawBooking(d, slotMap);
      if (b.id) byId.set(b.id, b);
    }
    for (const d of remoteVendorBookings) {
      const b = mapRawBooking(d, slotMap);
      if (b.id) byId.set(b.id, b);
    }
    for (const d of remoteAdminBookings) {
      const b = mapRawBooking(d, slotMap);
      if (b.id) byId.set(b.id, b);
    }
    for (const b of localBookings) {
      if (b.id) byId.set(b.id, b);
    }
    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [
    rawMergedSlots,
    remoteDriverBookings,
    remoteVendorBookings,
    remoteAdminBookings,
    localBookings,
  ]);

  // Slots with live bay statuses derived from active bookings
  const slots = useMemo<ParkingSlot[]>(() => {
    const activeBaysBySlot = new Map<string, string[]>();
    for (const b of bookings) {
      if (b.status !== 'active') continue;
      const list = activeBaysBySlot.get(b.slotId) || [];
      list.push(b.bayCode);
      activeBaysBySlot.set(b.slotId, list);
    }

    return rawMergedSlots.map((slot) => {
      const occupiedCodes = activeBaysBySlot.get(slot.id) || [];
      const evSupported =
        slot.amenities.includes('ev_charger') || slot.vehicleTypes.includes('EV');
      return {
        ...slot,
        bays: generateBays(slot.totalSlots, slot.slotPrefix, evSupported, occupiedCodes),
      };
    });
  }, [rawMergedSlots, bookings]);

  const currentUser = useMemo<UserProfile>(() => {
    if (customSessionUser) {
      return {...customSessionUser, role: activeRole};
    }
    const matching = users.find((u) => u.role === activeRole);
    if (matching) return matching;

    const nowIso = new Date().toISOString();
    return {
      uid: firebaseUser?.uid || 'guest_session',
      fullName: firebaseUser?.displayName || 'Guest User',
      email: firebaseUser?.email || '',
      phone: '',
      role: activeRole,
      idVerified: Boolean(firebaseUser?.emailVerified),
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }, [customSessionUser, activeRole, users, firebaseUser]);

  const pushNotification = useCallback(
    (title: string, message: string, targetRole: AppNotification['targetRole']) => {
      setNotifications((prev) => [
        {
          id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title,
          message,
          timestamp: new Date().toISOString(),
          read: false,
          targetRole,
        },
        ...prev,
      ]);
    },
    []
  );

  const navigateToPage = useCallback(
    (page: AppPage) => {
      if (page === 'admin' && !isFirebaseAdmin) {
        setActivePage('overview');
        setActiveRole('driver');
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', '#/overview');
        }
        return;
      }

      setActivePage(page);
      if (page === 'marketplace') {
        setActiveRole('driver');
        setActiveTab('marketplace');
      } else if (page === 'bookings') {
        setActiveRole('driver');
        setActiveTab('bookings');
      } else if (page === 'vendor') {
        setActiveRole('vendor');
        setActiveTab('overview');
      } else if (page === 'admin') {
        setActiveRole('admin');
        setActiveTab('approvals');
      }
      if (typeof window !== 'undefined') {
        const targetHash = `#/${page}`;
        if (window.location.hash !== targetHash) {
          window.history.pushState(null, '', targetHash);
        }
        window.scrollTo({top: 0, behavior: 'smooth'});
      }
    },
    [isFirebaseAdmin]
  );

  // Redirect away from admin page automatically if user does not have Firebase admin: true
  useEffect(() => {
    if (activePage === 'admin' && !isFirebaseAdmin) {
      setActivePage('overview');
      setActiveRole('driver');
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '#/overview');
      }
    }
  }, [activePage, isFirebaseAdmin]);

  useEffect(() => {
    const handleHashChange = () => {
      const next = parseHashPage();
      if (next === 'admin' && !isFirebaseAdmin) {
        setActivePage('overview');
        setActiveRole('driver');
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', '#/overview');
        }
        return;
      }
      setActivePage(next);
      if (next === 'marketplace') {
        setActiveRole('driver');
        setActiveTab('marketplace');
      } else if (next === 'bookings') {
        setActiveRole('driver');
        setActiveTab('bookings');
      } else if (next === 'vendor') {
        setActiveRole('vendor');
        setActiveTab('overview');
      } else if (next === 'admin') {
        setActiveRole('admin');
        setActiveTab('approvals');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isFirebaseAdmin]);

  const handleSwitchRole = (role: UserRole) => {
    if (role === 'admin' && !isFirebaseAdmin) {
      navigateToPage('overview');
      return;
    }
    if (role === 'driver') navigateToPage('marketplace');
    else if (role === 'vendor') navigateToPage('vendor');
    else navigateToPage('admin');
  };

  const handleSearchNearbyFromHero = (params: {
    query?: string;
    location?: SearchLocationFilter | null;
  }) => {
    if (params.query !== undefined) {
      setMarketplaceQuery(params.query);
    }
    if (params.location !== undefined) {
      setSearchLocation(params.location);
    }
    navigateToPage('marketplace');
  };

  const handleSelectCityFromFooter = (city: string) => {
    const matched = INDIA_CITY_CENTERS.find((c) => c.city === city);
    if (matched) {
      setMarketplaceQuery('');
      setSearchLocation({
        label: matched.city,
        lat: matched.lat,
        lng: matched.lng,
        source: 'city',
      });
    }
    navigateToPage('marketplace');
  };

  const handleGoogleSignIn = async () => {
    try {
      const user = await signInWithGoogle();
      toast.success(`Signed in with Google as ${user.displayName || user.email}`);
      setAuthModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google Sign-In failed';
      toast.error(message);
    }
  };

  const handleGoogleSignOut = async () => {
    if (firebaseUser) {
      await signOutFirebase();
    }
    setCustomSessionUser(null);
    toast.info('Signed out of ParkGrid session');
  };

  const handleRegisterUser = async (newUser: UserProfile) => {
    const hydratedUser: UserProfile = firebaseUser
      ? {
          ...newUser,
          uid: sanitizeId(firebaseUser.uid),
          email: firebaseUser.email || newUser.email,
        }
      : newUser;

    setLocalUsers((prev) => [
      hydratedUser,
      ...prev.filter((u) => u.uid !== hydratedUser.uid),
    ]);
    setCustomSessionUser(hydratedUser);
    setActiveRole(hydratedUser.role);
    setActiveTab(hydratedUser.role === 'vendor' ? 'overview' : 'marketplace');

    if (firebaseUser) {
      try {
        await upsertUserProfileInFirestore(hydratedUser);
      } catch (err) {
        console.error('Firestore profile save error:', err);
      }
    }

    navigateToPage('profile');
  };

  const handleUpdateProfile = async (updatedUser: UserProfile) => {
    const hydratedUser: UserProfile = firebaseUser
      ? {
          ...updatedUser,
          uid: sanitizeId(firebaseUser.uid),
          email: firebaseUser.email || updatedUser.email,
        }
      : updatedUser;

    setLocalUsers((prev) => [
      hydratedUser,
      ...prev.filter((u) => u.uid !== hydratedUser.uid),
    ]);
    setCustomSessionUser(hydratedUser);
    setActiveRole(
      hydratedUser.admin === true
        ? 'admin'
        : hydratedUser.role === 'vendor'
          ? 'vendor'
          : 'driver'
    );

    if (firebaseUser) {
      await upsertUserProfileInFirestore(hydratedUser);
    }
  };

  const handleLoginExisting = (user: UserProfile) => {
    setCustomSessionUser(user);
    handleSwitchRole(user.role);
  };

  const handleCreateBooking = async (params: {
    slot: ParkingSlot;
    bay: ParkingBay;
    durationHours: number;
    startTime: string;
    vehiclePlate: string;
  }): Promise<BookingRecord> => {
    const {slot, bay, durationHours, startTime, vehiclePlate} = params;
    const subtotal = Number((slot.hourlyRate * durationHours).toFixed(2));
    const platformFee = Number((subtotal * 0.1).toFixed(2));
    const totalAmount = Number((subtotal + platformFee).toFixed(2));
    const vendorPayout = Number((subtotal * 0.9).toFixed(2));
    const nowIso = new Date().toISOString();
    const endTime = new Date(
      new Date(startTime).getTime() + durationHours * 3600 * 1000
    ).toISOString();
    const bookingId = sanitizeId(`bk_${Date.now()}`);

    const newBooking: BookingRecord = {
      id: bookingId,
      driverId: firebaseUser?.uid || currentUser.uid,
      driverName: currentUser.fullName,
      vendorId: slot.vendorId,
      slotId: slot.id,
      slotTitle: slot.title,
      slotAddress: slot.address,
      bayCode: bay.code,
      vehiclePlate,
      startTime,
      endTime,
      durationHours,
      hourlyRate: slot.hourlyRate,
      totalAmount,
      platformFee,
      vendorPayout,
      status: 'active',
      qrCodeToken: `PG-PASS-${bay.code}-${vehiclePlate}-${bookingId.slice(-4)}`,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setLocalBookings((prev) => [newBooking, ...prev]);

    pushNotification(
      'New Bay Reservation',
      `${currentUser.fullName} reserved Bay ${bay.code} at ${slot.title} (${durationHours}h).`,
      'vendor'
    );
    pushNotification(
      'Parking Pass Active',
      `Bay ${bay.code} at ${slot.title} is ready. Present your QR pass at entry.`,
      'driver'
    );

    if (firebaseUser && !slot.id.startsWith('gmp_')) {
      try {
        await createBookingInFirestore(newBooking);
      } catch (err) {
        console.error('Firestore booking sync warning:', err);
      }
    }

    return newBooking;
  };

  const handleCancelBooking = async (bookingId: string) => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return;

    const nowIso = new Date().toISOString();
    setLocalBookings((prev) => {
      const exists = prev.some((b) => b.id === bookingId);
      if (exists) {
        return prev.map((b) =>
          b.id === bookingId ? {...b, status: 'cancelled', updatedAt: nowIso} : b
        );
      }
      return [{...target, status: 'cancelled', updatedAt: nowIso}, ...prev];
    });
    toast.info(`Ended session for Bay ${target.bayCode}`);

    if (firebaseUser && !target.slotId.startsWith('gmp_')) {
      try {
        await updateBookingStatusInFirestore(bookingId, 'cancelled');
      } catch (err) {
        console.error('Firestore booking cancel warning:', err);
      }
    }
  };

  const handleAddSlot = async (newSlot: ParkingSlot) => {
    const syncedSlot: ParkingSlot = {
      ...newSlot,
      vendorId: firebaseUser?.uid || newSlot.vendorId,
    };
    setLocalSlots((prev) => [syncedSlot, ...prev]);

    pushNotification(
      'New Slot Awaiting Approval',
      `"${syncedSlot.title}" listed by ${syncedSlot.vendorName} requires review.`,
      'admin'
    );

    if (firebaseUser) {
      try {
        await createParkingSlotInFirestore(syncedSlot, isFirebaseAdmin);
      } catch (err) {
        console.error('Firestore add slot warning:', err);
      }
    }
  };

  const handleToggleSlotOpen = async (slotId: string, isOpen: boolean) => {
    const existing = slots.find((s) => s.id === slotId);
    setLocalSlots((prev) => {
      const hasLocal = prev.some((s) => s.id === slotId);
      if (hasLocal) {
        return prev.map((s) =>
          s.id === slotId ? {...s, isOpen, updatedAt: new Date().toISOString()} : s
        );
      }
      return existing
        ? [{...existing, isOpen, updatedAt: new Date().toISOString()}, ...prev]
        : prev;
    });
    toast.info(isOpen ? 'Facility marked Open for bookings' : 'Facility paused (Closed)');
    if (firebaseUser) {
      try {
        await updateParkingSlotInFirestore(slotId, {isOpen});
      } catch (err) {
        console.error('Firestore toggle open warning:', err);
      }
    }
  };

  const handleUpdateSlotPricing = async (
    slotId: string,
    hourlyRate: number,
    dailyRate: number,
    monthlyRate: number
  ) => {
    const existing = slots.find((s) => s.id === slotId);
    setLocalSlots((prev) => {
      const hasLocal = prev.some((s) => s.id === slotId);
      if (hasLocal) {
        return prev.map((s) =>
          s.id === slotId
            ? {
                ...s,
                hourlyRate,
                dailyRate,
                monthlyRate,
                updatedAt: new Date().toISOString(),
              }
            : s
        );
      }
      return existing
        ? [
            {
              ...existing,
              hourlyRate,
              dailyRate,
              monthlyRate,
              updatedAt: new Date().toISOString(),
            },
            ...prev,
          ]
        : prev;
    });
    if (firebaseUser) {
      try {
        await updateParkingSlotInFirestore(slotId, {
          hourlyRate,
          dailyRate,
          monthlyRate,
        });
      } catch (err) {
        console.error('Firestore pricing update warning:', err);
      }
    }
  };

  const handleApproveSlot = async (slotId: string, approvalStatus: ApprovalStatus) => {
    const target = slots.find((s) => s.id === slotId);
    setLocalSlots((prev) => {
      const hasLocal = prev.some((s) => s.id === slotId);
      if (hasLocal) {
        return prev.map((s) =>
          s.id === slotId
            ? {...s, approvalStatus, updatedAt: new Date().toISOString()}
            : s
        );
      }
      return target
        ? [{...target, approvalStatus, updatedAt: new Date().toISOString()}, ...prev]
        : prev;
    });

    if (target) {
      pushNotification(
        approvalStatus === 'approved' ? 'Listing Approved' : 'Listing Rejected',
        `"${target.title}" has been ${approvalStatus} by Super Admin.`,
        'vendor'
      );
      if (approvalStatus === 'approved') {
        pushNotification(
          'New Parking Location Live',
          `${target.title} (${target.neighborhood}) is now available for booking.`,
          'driver'
        );
      }
    }

    if (firebaseUser && isFirebaseAdmin) {
      try {
        await updateParkingSlotInFirestore(slotId, {approvalStatus});
      } catch (err) {
        console.error('Firestore approval warning:', err);
      }
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    setLocalSlots((prev) => prev.filter((s) => s.id !== slotId));
    setRemoteApprovedSlots((prev) => prev.filter((s) => s.id !== slotId));
    setRemoteVendorSlots((prev) => prev.filter((s) => s.id !== slotId));
    setRemoteAdminSlots((prev) => prev.filter((s) => s.id !== slotId));
    if (firebaseUser) {
      try {
        await deleteParkingSlotInFirestore(slotId);
      } catch (err) {
        console.error('Firestore delete warning:', err);
      }
    }
  };

  const handleToggleUserStatus = (uid: string, status: 'active' | 'suspended') => {
    setLocalUsers((prev) => prev.map((u) => (u.uid === uid ? {...u, status} : u)));
    setRemoteAdminUsers((prev) => prev.map((u) => (u.uid === uid ? {...u, status} : u)));
    if (firebaseUser && isFirebaseAdmin) {
      void adminUpdateUserInFirestore(uid, {status}).catch((err) => {
        console.error('Firestore user status update warning:', err);
      });
    }
  };

  const handleVerifyUser = (uid: string) => {
    setLocalUsers((prev) => prev.map((u) => (u.uid === uid ? {...u, idVerified: true} : u)));
    setRemoteAdminUsers((prev) =>
      prev.map((u) => (u.uid === uid ? {...u, idVerified: true} : u))
    );
    if (firebaseUser && isFirebaseAdmin) {
      void adminUpdateUserInFirestore(uid, {idVerified: true}).catch((err) => {
        console.error('Firestore user verify warning:', err);
      });
    }
  };

  return (
    <MapsRootProvider>
      <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-[#09090B] text-zinc-900 dark:text-zinc-100 relative overflow-x-hidden">
      {/* Google Maps Demo Key Quota Banner */}
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <NavbarFloating
        activePage={activePage}
        activeRole={activeRole}
        onNavigatePage={navigateToPage}
        currentUser={currentUser}
        hasActiveSession={hasActiveSession}
        isFirebaseAuthed={Boolean(firebaseUser)}
        isAdmin={isFirebaseAdmin}
        isDark={isDark}
        onToggleTheme={() => setIsDark((p) => !p)}
        notifications={notifications}
        onMarkAllNotificationsRead={() =>
          setNotifications((prev) => prev.map((n) => ({...n, read: true})))
        }
        onOpenAuth={() => setAuthModalOpen(true)}
        onGoogleSignOut={handleGoogleSignOut}
        onOpenCommandSearch={() => setCommandOpen(true)}
      />

      {/* Dedicated Multi-Page Router */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {activePage === 'overview' ? (
            <motion.div
              key="page-overview"
              initial={{opacity: 0, y: 8}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -8}}
              transition={{duration: 0.22, ease: [0.16, 1, 0.3, 1]}}
            >
              <RuixenOverviewPage
                isDark={isDark}
                slots={slots}
                bookings={bookings}
                onNavigatePage={navigateToPage}
                onSearchNearbyFromHero={handleSearchNearbyFromHero}
              />
            </motion.div>
          ) : activePage === 'faq' ? (
            <motion.div
              key="page-faq"
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -8}}
              transition={{duration: 0.22, ease: [0.16, 1, 0.3, 1]}}
            >
              <div className="mx-auto max-w-[1040px] px-4 sm:px-6 lg:px-8 pt-6">
                <button
                  type="button"
                  onClick={() => navigateToPage('overview')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Overview
                </button>
              </div>
              <RuixenFaqPage onNavigatePage={navigateToPage} />
            </motion.div>
          ) : (
            <motion.section
              key={`page-${activePage}`}
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -8}}
              transition={{duration: 0.22, ease: [0.16, 1, 0.3, 1]}}
              className="py-6 sm:py-10"
            >
              <div className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8 space-y-5">
                {/* Sub-page Breadcrumb Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => navigateToPage('overview')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Overview
                  </button>

                  <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                    {activePage === 'marketplace' && 'ParkGrid / Driver Marketplace'}
                    {activePage === 'bookings' && 'ParkGrid / My Bookings & QR Passes'}
                    {activePage === 'vendor' && 'ParkGrid / Vendor Partner Console'}
                    {activePage === 'admin' && 'ParkGrid / Super Admin Center'}
                    {activePage === 'profile' && 'ParkGrid / Member Profile'}
                  </div>
                </div>

                {/* Framed Workspace Viewport with Hatched Rails */}
                <div className="grid grid-cols-1 xl:grid-cols-24 border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#0B0B0F] shadow-2xl shadow-blue-950/10">
                  <div className="hidden xl:block xl:col-span-1 border-r border-zinc-200 dark:border-zinc-800/90 ruixen-hatch" />

                  <div className="xl:col-span-22 p-4 sm:p-6 lg:p-8">
                    {(activePage === 'marketplace' || activePage === 'bookings') && (
                      <DriverDashboard
                        activeTab={activePage === 'bookings' ? 'bookings' : activeTab}
                        onChangeTab={(tab) => {
                          setActiveTab(tab);
                          if (tab === 'bookings') navigateToPage('bookings');
                          else navigateToPage('marketplace');
                        }}
                        slots={slots}
                        bookings={bookings}
                        currentUser={currentUser}
                        isDark={isDark}
                        searchQuery={marketplaceQuery}
                        onSearchQueryChange={setMarketplaceQuery}
                        searchLocation={searchLocation}
                        onSearchLocationChange={setSearchLocation}
                        onCreateBooking={handleCreateBooking}
                        onCancelBooking={handleCancelBooking}
                      />
                    )}

                    {activePage === 'vendor' && (
                      <VendorDashboard
                        activeTab={activeTab}
                        onChangeTab={setActiveTab}
                        slots={slots}
                        bookings={bookings}
                        currentUser={currentUser}
                        onAddSlot={handleAddSlot}
                        onToggleSlotOpen={handleToggleSlotOpen}
                        onUpdateSlotPricing={handleUpdateSlotPricing}
                      />
                    )}

                    {activePage === 'admin' && isFirebaseAdmin && (
                      <AdminDashboard
                        activeTab={activeTab}
                        onChangeTab={setActiveTab}
                        slots={slots}
                        users={users}
                        bookings={bookings}
                        onApproveSlot={handleApproveSlot}
                        onToggleSlotOpen={handleToggleSlotOpen}
                        onDeleteSlot={handleDeleteSlot}
                        onToggleUserStatus={handleToggleUserStatus}
                        onVerifyUser={handleVerifyUser}
                      />
                    )}

                    {activePage === 'profile' && (
                      <ProfilePage
                        currentUser={currentUser}
                        hasActiveSession={hasActiveSession}
                        isFirebaseAuthed={Boolean(firebaseUser)}
                        isAdmin={isFirebaseAdmin}
                        photoUrl={firebaseUser?.photoURL || null}
                        bookings={bookings}
                        slots={slots}
                        onUpdateProfile={handleUpdateProfile}
                        onNavigatePage={navigateToPage}
                        onOpenAuth={() => setAuthModalOpen(true)}
                        onSignOut={handleGoogleSignOut}
                      />
                    )}
                  </div>

                  <div className="hidden xl:block xl:col-span-1 border-l border-zinc-200 dark:border-zinc-800/90 ruixen-hatch" />
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <ParkGridFooter
        onNavigatePage={navigateToPage}
        onSelectCityFromFooter={handleSelectCityFromFooter}
      />

      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        currentUser={currentUser}
        users={users}
        hasActiveSession={hasActiveSession}
        isFirebaseAuthed={Boolean(firebaseUser)}
        isAdmin={isFirebaseAdmin}
        onOpenAdmin={() => navigateToPage('admin')}
        onOpenProfile={() => navigateToPage('profile')}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
        onRegisterUser={handleRegisterUser}
        onLoginExisting={handleLoginExisting}
      />

      <CommandSearchModal
        open={commandOpen}
        onOpenChange={setCommandOpen}
        slots={slots}
        isDark={isDark}
        isAdmin={isFirebaseAdmin}
        onToggleTheme={() => setIsDark((p) => !p)}
        onSelectPlace={(loc) => {
          setMarketplaceQuery('');
          setSearchLocation(loc);
          navigateToPage('marketplace');
        }}
        onSelectSlot={(slot) => {
          setMarketplaceQuery(slot.title);
          setSearchLocation({
            label: slot.neighborhood,
            lat: slot.lat,
            lng: slot.lng,
            source: 'place',
          });
          navigateToPage('marketplace');
        }}
        onSwitchRole={(role) => {
          handleSwitchRole(role);
        }}
      />

      <ScrollToTopButton />
      <Toaster position="bottom-right" richColors theme={isDark ? 'dark' : 'light'} />
      </div>
    </MapsRootProvider>
  );
}
