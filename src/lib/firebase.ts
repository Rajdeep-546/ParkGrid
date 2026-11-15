import {initializeApp} from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type {BookingRecord, ParkingSlot, UserProfile, UserRole} from '../types/parking';
import {sanitizeId} from './utils';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export async function upsertUserProfileInFirestore(
  profile: UserProfile
): Promise<void> {
  const uid = sanitizeId(profile.uid);
  const path = `users/${uid}`;
  const docRef = doc(db, 'users', uid);

  try {
    const existing = await getDoc(docRef);
    const sanitizedRole: UserRole =
      profile.role === 'vendor' ? 'vendor' : 'driver';

    const payload: Record<string, unknown> = {
      uid,
      fullName: profile.fullName.slice(0, 120),
      email: profile.email.slice(0, 180),
      phone: (profile.phone || '').slice(0, 32),
      role: sanitizedRole,
      status: 'active',
      updatedAt: serverTimestamp(),
    };

    if (profile.vehicleType) payload.vehicleType = profile.vehicleType;
    if (profile.licensePlate) payload.licensePlate = profile.licensePlate.slice(0, 24);
    if (profile.businessName) payload.businessName = profile.businessName.slice(0, 140);
    if (profile.payoutId) payload.payoutId = profile.payoutId.slice(0, 120);

    if (!existing.exists()) {
      payload.idVerified = Boolean(profile.idVerified);
      payload.createdAt = serverTimestamp();
      await setDoc(docRef, payload);
    } else {
      await updateDoc(docRef, {
        fullName: payload.fullName,
        phone: payload.phone,
        role: payload.role,
        ...(payload.vehicleType ? {vehicleType: payload.vehicleType} : {}),
        ...(payload.licensePlate ? {licensePlate: payload.licensePlate} : {}),
        ...(payload.businessName ? {businessName: payload.businessName} : {}),
        ...(payload.payoutId ? {payoutId: payload.payoutId} : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

function mapUserDocToProfile(safeUid: string, data: Record<string, unknown>): UserProfile {
  const rawCreated = data.createdAt as {toDate?: () => Date} | undefined;
  const rawUpdated = data.updatedAt as {toDate?: () => Date} | undefined;
  return {
    uid: String(data.uid || safeUid),
    fullName: String(data.fullName || ''),
    email: String(data.email || ''),
    phone: String(data.phone || ''),
    role: (data.role as UserRole) || 'driver',
    vehicleType: data.vehicleType as UserProfile['vehicleType'],
    licensePlate: data.licensePlate ? String(data.licensePlate) : undefined,
    businessName: data.businessName ? String(data.businessName) : undefined,
    payoutId: data.payoutId ? String(data.payoutId) : undefined,
    idVerified: Boolean(data.idVerified),
    admin: data.admin === true,
    status: (data.status as 'active' | 'suspended') || 'active',
    createdAt: rawCreated?.toDate?.()?.toISOString?.() || new Date().toISOString(),
    updatedAt: rawUpdated?.toDate?.()?.toISOString?.() || new Date().toISOString(),
  };
}

export async function fetchUserProfileFromFirestore(
  uid: string
): Promise<UserProfile | null> {
  const safeUid = sanitizeId(uid);
  const path = `users/${safeUid}`;
  try {
    const snap = await getDoc(doc(db, 'users', safeUid));
    if (!snap.exists()) return null;
    return mapUserDocToProfile(safeUid, snap.data() as Record<string, unknown>);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeCurrentUserProfile(
  uid: string,
  onProfile: (profile: UserProfile | null) => void
): Unsubscribe {
  const safeUid = sanitizeId(uid);
  const path = `users/${safeUid}`;
  return onSnapshot(
    doc(db, 'users', safeUid),
    (snap) => {
      if (!snap.exists()) {
        onProfile(null);
        return;
      }
      onProfile(mapUserDocToProfile(safeUid, snap.data() as Record<string, unknown>));
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function createParkingSlotInFirestore(
  slot: ParkingSlot,
  isAdminUser: boolean
): Promise<void> {
  const safeId = sanitizeId(slot.id);
  const path = `parking_slots/${safeId}`;
  try {
    await setDoc(doc(db, 'parking_slots', safeId), {
      id: safeId,
      vendorId: sanitizeId(slot.vendorId),
      vendorName: slot.vendorName.slice(0, 120),
      title: slot.title.slice(0, 140),
      address: slot.address.slice(0, 240),
      landmark: slot.landmark.slice(0, 140),
      neighborhood: slot.neighborhood.slice(0, 80),
      category: slot.category,
      lat: Number(slot.lat),
      lng: Number(slot.lng),
      totalSlots: Math.max(1, Math.min(500, Math.round(slot.totalSlots))),
      slotPrefix: slot.slotPrefix.slice(0, 12),
      hourlyRate: Number(slot.hourlyRate),
      dailyRate: Number(slot.dailyRate),
      monthlyRate: Number(slot.monthlyRate),
      rating: Number(slot.rating || 4.8),
      reviewCount: Math.round(slot.reviewCount || 0),
      is24Hours: Boolean(slot.is24Hours),
      openTime: slot.openTime.slice(0, 10),
      closeTime: slot.closeTime.slice(0, 10),
      isOpen: Boolean(slot.isOpen),
      approvalStatus: isAdminUser ? slot.approvalStatus : 'pending',
      thumbnailId: slot.thumbnailId.slice(0, 64),
      vehicleTypes: slot.vehicleTypes.slice(0, 6),
      amenities: slot.amenities.slice(0, 12),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateParkingSlotInFirestore(
  slotId: string,
  updates: Partial<ParkingSlot>
): Promise<void> {
  const safeId = sanitizeId(slotId);
  const path = `parking_slots/${safeId}`;
  try {
    const allowed: Record<string, unknown> = {updatedAt: serverTimestamp()};
    if (updates.title !== undefined) allowed.title = updates.title.slice(0, 140);
    if (updates.hourlyRate !== undefined) allowed.hourlyRate = Number(updates.hourlyRate);
    if (updates.dailyRate !== undefined) allowed.dailyRate = Number(updates.dailyRate);
    if (updates.monthlyRate !== undefined) allowed.monthlyRate = Number(updates.monthlyRate);
    if (updates.isOpen !== undefined) allowed.isOpen = Boolean(updates.isOpen);
    if (updates.approvalStatus !== undefined) allowed.approvalStatus = updates.approvalStatus;
    await updateDoc(doc(db, 'parking_slots', safeId), allowed);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteParkingSlotInFirestore(slotId: string): Promise<void> {
  const safeId = sanitizeId(slotId);
  const path = `parking_slots/${safeId}`;
  try {
    await deleteDoc(doc(db, 'parking_slots', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createBookingInFirestore(booking: BookingRecord): Promise<void> {
  const safeId = sanitizeId(booking.id);
  const path = `bookings/${safeId}`;
  try {
    await setDoc(doc(db, 'bookings', safeId), {
      id: safeId,
      driverId: sanitizeId(booking.driverId),
      driverName: booking.driverName.slice(0, 120),
      vendorId: sanitizeId(booking.vendorId),
      slotId: sanitizeId(booking.slotId),
      slotTitle: booking.slotTitle.slice(0, 140),
      bayCode: booking.bayCode.slice(0, 16),
      vehiclePlate: booking.vehiclePlate.slice(0, 24),
      startTime: booking.startTime.slice(0, 64),
      durationHours: Math.max(1, Math.round(booking.durationHours)),
      totalAmount: Number(booking.totalAmount),
      platformFee: Number(booking.platformFee),
      vendorPayout: Number(booking.vendorPayout),
      status: 'active',
      qrCodeToken: booking.qrCodeToken.slice(0, 128),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateBookingStatusInFirestore(
  bookingId: string,
  status: BookingRecord['status']
): Promise<void> {
  const safeId = sanitizeId(bookingId);
  const path = `bookings/${safeId}`;
  try {
    await updateDoc(doc(db, 'bookings', safeId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeApprovedParkingSlots(
  onData: (docs: Record<string, unknown>[]) => void
): Unsubscribe {
  const path = 'parking_slots';
  const q = query(collection(db, path), where('approvalStatus', '==', 'approved'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({...d.data(), id: d.id})));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeVendorParkingSlots(
  vendorId: string,
  onData: (docs: Record<string, unknown>[]) => void
): Unsubscribe {
  const path = 'parking_slots';
  const q = query(collection(db, path), where('vendorId', '==', sanitizeId(vendorId)));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({...d.data(), id: d.id})));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeAllParkingSlotsAdmin(
  onData: (docs: Record<string, unknown>[]) => void
): Unsubscribe {
  const path = 'parking_slots';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      onData(snap.docs.map((d) => ({...d.data(), id: d.id})));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeDriverBookings(
  driverId: string,
  onData: (docs: Record<string, unknown>[]) => void
): Unsubscribe {
  const path = 'bookings';
  const q = query(collection(db, path), where('driverId', '==', sanitizeId(driverId)));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({...d.data(), id: d.id})));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeVendorBookings(
  vendorId: string,
  onData: (docs: Record<string, unknown>[]) => void
): Unsubscribe {
  const path = 'bookings';
  const q = query(collection(db, path), where('vendorId', '==', sanitizeId(vendorId)));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({...d.data(), id: d.id})));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeAllBookingsAdmin(
  onData: (docs: Record<string, unknown>[]) => void
): Unsubscribe {
  const path = 'bookings';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      onData(snap.docs.map((d) => ({...d.data(), id: d.id})));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeAllUsersAdmin(
  onData: (docs: Record<string, unknown>[]) => void
): Unsubscribe {
  const path = 'users';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      onData(snap.docs.map((d) => ({...d.data(), uid: d.id})));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function adminUpdateUserInFirestore(
  uid: string,
  updates: Partial<Pick<UserProfile, 'status' | 'idVerified'>>
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const path = `users/${safeUid}`;
  try {
    const allowed: Record<string, unknown> = {updatedAt: serverTimestamp()};
    if (updates.status !== undefined) allowed.status = updates.status;
    if (updates.idVerified !== undefined) allowed.idVerified = Boolean(updates.idVerified);
    await updateDoc(doc(db, 'users', safeUid), allowed);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function fetchVendorSlotsOnce(vendorId: string): Promise<Record<string, unknown>[]> {
  const path = 'parking_slots';
  try {
    const q = query(collection(db, path), where('vendorId', '==', sanitizeId(vendorId)));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({...d.data(), id: d.id}));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
