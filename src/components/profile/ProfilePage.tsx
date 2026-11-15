import React, {useEffect, useMemo, useState} from 'react';
import {
  ArrowUpRight,
  Building2,
  Car,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Edit3,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Phone,
  QrCode,
  ShieldCheck,
  Store,
  UserCheck,
  X,
} from 'lucide-react';
import {motion} from 'motion/react';
import {QRCodeSVG} from 'qrcode.react';
import {toast} from 'sonner';
import type {
  AppPage,
  BookingRecord,
  ParkingSlot,
  UserProfile,
  UserRole,
  VehicleType,
} from '../../types/parking';
import {cn, formatCurrency} from '../../lib/utils';
import {Button} from '../ui/button';
import {Input} from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface ProfilePageProps {
  currentUser: UserProfile;
  hasActiveSession: boolean;
  isFirebaseAuthed: boolean;
  isAdmin: boolean;
  photoUrl: string | null;
  bookings: BookingRecord[];
  slots: ParkingSlot[];
  onUpdateProfile: (updated: UserProfile) => Promise<void>;
  onNavigatePage: (page: AppPage) => void;
  onOpenAuth: () => void;
  onSignOut: () => Promise<void>;
}

const VEHICLE_LABELS: Record<VehicleType, string> = {
  Sedan: 'Sedan / Hatchback',
  SUV: 'SUV / Crossover',
  EV: 'Electric Vehicle (EV)',
  'Two-Wheeler': 'Two-Wheeler / Scooter',
};

function formatDateLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'Recent';
  }
}

export function ProfilePage({
  currentUser,
  hasActiveSession,
  isFirebaseAuthed,
  isAdmin,
  photoUrl,
  bookings,
  slots,
  onUpdateProfile,
  onNavigatePage,
  onOpenAuth,
  onSignOut,
}: ProfilePageProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  // Edit state initialized from saved user profile (never blank over existing data)
  const [fullName, setFullName] = useState(currentUser.fullName || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [role, setRole] = useState<'driver' | 'vendor'>(
    currentUser.role === 'vendor' ? 'vendor' : 'driver'
  );
  const [vehicleType, setVehicleType] = useState<VehicleType>(
    currentUser.vehicleType || 'Sedan'
  );
  const [licensePlate, setLicensePlate] = useState(currentUser.licensePlate || '');
  const [businessName, setBusinessName] = useState(currentUser.businessName || '');
  const [payoutId, setPayoutId] = useState(currentUser.payoutId || '');

  useEffect(() => {
    setAvatarFailed(false);
  }, [photoUrl]);

  useEffect(() => {
    if (!editing) {
      setFullName(currentUser.fullName || '');
      setPhone(currentUser.phone || '');
      setRole(currentUser.role === 'vendor' ? 'vendor' : 'driver');
      setVehicleType(currentUser.vehicleType || 'Sedan');
      setLicensePlate(currentUser.licensePlate || '');
      setBusinessName(currentUser.businessName || '');
      setPayoutId(currentUser.payoutId || '');
    }
  }, [currentUser, editing]);

  const driverBookings = useMemo(
    () => bookings.filter((b) => b.driverId === currentUser.uid),
    [bookings, currentUser.uid]
  );

  const activeDriverBookings = useMemo(
    () => driverBookings.filter((b) => b.status === 'active'),
    [driverBookings]
  );

  const vendorSlots = useMemo(
    () => slots.filter((s) => s.vendorId === currentUser.uid),
    [slots, currentUser.uid]
  );

  const vendorBookings = useMemo(
    () => bookings.filter((b) => b.vendorId === currentUser.uid),
    [bookings, currentUser.uid]
  );

  const totalSpent = useMemo(
    () =>
      driverBookings
        .filter((b) => b.status !== 'cancelled')
        .reduce((sum, b) => sum + b.totalAmount, 0),
    [driverBookings]
  );

  const totalVendorEarnings = useMemo(
    () =>
      vendorBookings
        .filter((b) => b.status !== 'cancelled')
        .reduce((sum, b) => sum + b.vendorPayout, 0),
    [vendorBookings]
  );

  const initials = (currentUser.fullName || 'PG')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  const memberQrPayload = `PARKGRID-MEMBER:${currentUser.uid}:${(
    currentUser.licensePlate || 'UNSET'
  ).toUpperCase()}`;

  const handleCopyUid = async () => {
    try {
      await navigator.clipboard.writeText(currentUser.uid);
      setCopiedId(true);
      toast.success('Member ID copied to clipboard');
      setTimeout(() => setCopiedId(false), 1800);
    } catch {
      toast.info(`Member ID: ${currentUser.uid}`);
    }
  };

  const handleStartEdit = () => {
    setFullName(currentUser.fullName || '');
    setPhone(currentUser.phone || '');
    setRole(currentUser.role === 'vendor' ? 'vendor' : 'driver');
    setVehicleType(currentUser.vehicleType || 'Sedan');
    setLicensePlate(currentUser.licensePlate || '');
    setBusinessName(currentUser.businessName || '');
    setPayoutId(currentUser.payoutId || '');
    setEditing(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = fullName.trim();
    if (trimmedName.length < 2) {
      toast.error('Full name must be at least 2 characters.');
      return;
    }

    setSaving(true);
    try {
      const updated: UserProfile = {
        ...currentUser,
        fullName: trimmedName,
        phone: phone.trim(),
        role: (isAdmin ? currentUser.role : role) as UserRole,
        vehicleType,
        licensePlate: licensePlate.trim().toUpperCase() || undefined,
        businessName: businessName.trim() || undefined,
        payoutId: payoutId.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };
      await onUpdateProfile(updated);
      setEditing(false);
      toast.success('Profile details saved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save profile';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickRoleSwitch = async (nextRole: 'driver' | 'vendor') => {
    if (saving || currentUser.role === nextRole) return;
    setSaving(true);
    try {
      await onUpdateProfile({
        ...currentUser,
        role: nextRole,
        updatedAt: new Date().toISOString(),
      });
      toast.success(
        `Switched default workspace mode to ${nextRole === 'vendor' ? 'Vendor Partner' : 'Driver'}.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not update role';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!hasActiveSession) {
    return (
      <div className="py-8 sm:py-12">
        <div className="mx-auto max-w-2xl rounded-xl border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#0B0B0F] overflow-hidden">
          <div className="border-b border-zinc-200 dark:border-zinc-800/90 px-6 py-3 ruixen-dot-bg flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold tracking-tight text-zinc-500 dark:text-zinc-400">
              ACCOUNT · PROFILE ACCESS
            </span>
            <span className="font-mono text-[11px] text-zinc-400">GUEST SESSION</span>
          </div>
          <div className="p-6 sm:p-8 space-y-5">
            <div className="space-y-2">
              <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                Sign in to view your ParkGrid Member Profile
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Access your saved vehicle license plate, digital QR member pass, UPI vendor settlement details, and booking receipts across sessions.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button type="button" onClick={onOpenAuth} className="gap-2">
                <LogIn className="h-4 w-4" />
                Sign In or Register Account
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onNavigatePage('marketplace')}
                className="gap-1.5"
              >
                Explore Marketplace
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayRoleLabel = isAdmin
    ? 'Super Admin'
    : currentUser.role === 'vendor'
      ? 'Vendor Partner'
      : 'Driver';

  return (
    <div className="space-y-6">
      {/* 1. Identity Header Card */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#0B0B0F] overflow-hidden">
        <div className="border-b border-zinc-200 dark:border-zinc-800/90 px-5 py-2.5 ruixen-dot-bg flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-semibold tracking-tight text-zinc-500 dark:text-zinc-400">
            00 · MEMBER PROFILE &amp; DIGITAL PASS
          </span>
          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
            {isFirebaseAuthed ? 'Firebase Cloud Synced' : 'Local Workspace Account'}
          </span>
        </div>

        <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4 min-w-0">
            {photoUrl && !avatarFailed ? (
              <img
                src={photoUrl}
                alt={currentUser.fullName}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="h-16 w-16 rounded-xl object-cover border border-zinc-200 dark:border-zinc-800 shrink-0"
              />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-display text-xl font-bold shrink-0">
                {initials || 'PG'}
              </div>
            )}

            <div className="min-w-0 space-y-1">
              <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white truncate">
                {currentUser.fullName}
              </h1>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {displayRoleLabel}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {currentUser.idVerified ? 'Verified Account' : 'Verification Pending'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="capitalize">Status: {currentUser.status}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  Joined {formatDateLabel(currentUser.createdAt)}
                </span>
              </div>
              {currentUser.email && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 truncate pt-0.5">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{currentUser.email}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isAdmin && (
              <Button
                type="button"
                size="sm"
                onClick={() => onNavigatePage('admin')}
                className="gap-1.5"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin Center
              </Button>
            )}
            <Button
              type="button"
              variant={editing ? 'ghost' : 'outline'}
              size="sm"
              onClick={() => (editing ? setEditing(false) : handleStartEdit())}
              className="gap-1.5"
            >
              {editing ? (
                <>
                  <X className="h-3.5 w-3.5" />
                  Cancel Edit
                </>
              ) : (
                <>
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit Profile
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onSignOut()}
              className="gap-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Two-Column Architectural Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Digital ParkGrid Member Pass & Quick Role Controls */}
        <motion.div
          initial={{opacity: 0, y: 12}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.35, ease: [0.16, 1, 0.3, 1]}}
          className="lg:col-span-5 space-y-4"
        >
          {/* Creative Smart Access Card */}
          <div className="relative rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 overflow-hidden shadow-xl">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(37,99,235,0.22),transparent_55%),radial-gradient(circle_at_15%_90%,rgba(16,185,129,0.12),transparent_50%)]"
            />
            <div className="relative z-10 p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-zinc-950 font-display font-bold text-xs">
                    P
                  </span>
                  <span className="font-mono text-[11px] font-semibold tracking-wider text-zinc-300">
                    PARKGRID ACCESS PASS
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyUid()}
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  title="Copy full Member ID"
                >
                  <span>#{currentUser.uid.slice(0, 10)}</span>
                  {copiedId ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>

              {/* Dynamic License Plate or Vendor Property Focal Display */}
              {currentUser.role === 'vendor' ? (
                <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 space-y-1.5">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                    Registered Partner Property
                  </div>
                  <div className="font-display text-lg font-semibold text-white truncate">
                    {currentUser.businessName || `${currentUser.fullName}'s Parking`}
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
                    <span className="font-mono truncate">
                      UPI: {currentUser.payoutId || 'Add UPI ID in Edit'}
                    </span>
                    <span className="text-emerald-400 font-mono shrink-0 ml-2">
                      90% Payout
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                    Primary Vehicle Plate
                  </div>
                  {/* Authentic Indian HSRP Style Plate Preview */}
                  <div className="inline-flex w-full items-stretch rounded-lg border border-zinc-700 bg-zinc-100 text-zinc-950 overflow-hidden shadow-inner">
                    <div className="w-8 bg-blue-700 text-white flex flex-col items-center justify-center py-2 shrink-0">
                      <span className="text-[8px] font-bold tracking-widest">IND</span>
                    </div>
                    <div className="flex-1 px-4 py-2.5 flex items-center justify-between gap-2">
                      <span className="font-mono text-lg sm:text-xl font-bold tracking-widest uppercase">
                        {currentUser.licensePlate || 'NOT SET'}
                      </span>
                      <span className="text-[11px] font-medium text-zinc-600 shrink-0">
                        {currentUser.vehicleType || 'Sedan'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom QR & Holder Row */}
              <div className="flex items-end justify-between gap-4 pt-2 border-t border-white/10">
                <div className="min-w-0 space-y-1">
                  <div className="text-[11px] text-zinc-400">Pass Holder</div>
                  <div className="font-display text-base font-semibold text-white truncate">
                    {currentUser.fullName}
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {currentUser.idVerified
                      ? 'Verified Gate Credential'
                      : 'Standard Member Pass'}
                  </div>
                </div>

                <div className="rounded-lg bg-white p-2 shrink-0 shadow-sm">
                  <QRCodeSVG
                    value={memberQrPayload}
                    size={68}
                    level="M"
                    bgColor="#FFFFFF"
                    fgColor="#09090B"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Account Metrics Strip (Real Computed Data) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#0B0B0F] p-4">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Active QR Passes
              </div>
              <div className="mt-1 font-display text-2xl font-semibold text-zinc-900 dark:text-white tabular-nums">
                {activeDriverBookings.length}
              </div>
              <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                {driverBookings.length} total bookings
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#0B0B0F] p-4">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {currentUser.role === 'vendor' ? 'Vendor Earnings' : 'Total Parking Spend'}
              </div>
              <div className="mt-1 font-display text-2xl font-semibold text-zinc-900 dark:text-white tabular-nums">
                {currentUser.role === 'vendor'
                  ? formatCurrency(totalVendorEarnings)
                  : formatCurrency(totalSpent)}
              </div>
              <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                {vendorSlots.length}{' '}
                {vendorSlots.length === 1 ? 'managed facility' : 'managed facilities'}
              </div>
            </div>
          </div>

          {/* Workspace Mode & Quick Navigation */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#0B0B0F] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-900 dark:text-white">
                Default Workspace Role
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Instant Switch
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleQuickRoleSwitch('driver')}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer',
                  currentUser.role !== 'vendor'
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                )}
              >
                <Car className="h-3.5 w-3.5" />
                Driver
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleQuickRoleSwitch('vendor')}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer',
                  currentUser.role === 'vendor'
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                )}
              >
                <Store className="h-3.5 w-3.5" />
                Vendor
              </button>
            </div>

            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onNavigatePage('marketplace')}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-2 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:border-blue-500/60 transition-colors cursor-pointer truncate"
              >
                Find Parking
              </button>
              <button
                type="button"
                onClick={() => onNavigatePage('bookings')}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-2 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:border-blue-500/60 transition-colors cursor-pointer truncate"
              >
                My Passes
              </button>
              <button
                type="button"
                onClick={() => onNavigatePage('vendor')}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-2 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:border-emerald-500/60 transition-colors cursor-pointer truncate"
              >
                Vendor Console
              </button>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Saved Credentials (View Mode / Pre-filled Edit Mode) & Activity */}
        <motion.div
          initial={{opacity: 0, y: 12}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: 0.35, delay: 0.05, ease: [0.16, 1, 0.3, 1]}}
          className="lg:col-span-7 space-y-5"
        >
          {/* Saved Account Details Card */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#0B0B0F] overflow-hidden">
            <div className="border-b border-zinc-200 dark:border-zinc-800/90 px-5 py-3 ruixen-dot-bg flex items-center justify-between">
              <span className="font-mono text-[11px] font-semibold tracking-tight text-zinc-500 dark:text-zinc-400">
                01 · SAVED ACCOUNT DETAILS
              </span>
              {!editing && (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  <Edit3 className="h-3 w-3" />
                  Update Details
                </button>
              )}
            </div>

            {editing ? (
              <form onSubmit={(e) => void handleSaveProfile(e)} className="p-5 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                      Full Name
                    </label>
                    <Input
                      required
                      minLength={2}
                      maxLength={120}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                      Phone Number
                    </label>
                    <Input
                      type="tel"
                      maxLength={32}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                {!isAdmin && (
                  <div>
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                      Primary Workspace Role
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setRole('driver')}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg border p-3 text-left text-xs font-medium transition-colors cursor-pointer',
                          role === 'driver'
                            ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                        )}
                      >
                        <Car className="h-4 w-4 shrink-0" />
                        Driver Account
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('vendor')}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg border p-3 text-left text-xs font-medium transition-colors cursor-pointer',
                          role === 'vendor'
                            ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                        )}
                      >
                        <Store className="h-4 w-4 shrink-0" />
                        Vendor Partner
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/40 p-4">
                  <div>
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                      Vehicle Type
                    </label>
                    <Select
                      value={vehicleType}
                      onValueChange={(v) => setVehicleType(v as VehicleType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sedan">Sedan / Hatchback</SelectItem>
                        <SelectItem value="SUV">SUV / Crossover</SelectItem>
                        <SelectItem value="EV">Electric Vehicle (EV)</SelectItem>
                        <SelectItem value="Two-Wheeler">Two-Wheeler / Scooter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                      Vehicle License Plate
                    </label>
                    <Input
                      maxLength={24}
                      value={licensePlate}
                      onChange={(e) => setLicensePlate(e.target.value)}
                      placeholder="KA 01 MJ 4829"
                      className="font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                      Business / Property Name
                    </label>
                    <Input
                      maxLength={140}
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Optional for vendor lots"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                      Bank / UPI Payout ID
                    </label>
                    <Input
                      maxLength={120}
                      value={payoutId}
                      onChange={(e) => setPayoutId(e.target.value)}
                      placeholder="name@okicici"
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={saving} className="gap-1.5">
                    {saving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="p-5 sm:p-6 divide-y divide-zinc-200 dark:divide-zinc-800/80">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
                  <div className="space-y-1">
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5" />
                      Full Name
                    </div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-white">
                      {currentUser.fullName}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      Email Address
                    </div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                      {currentUser.email || 'Not linked'}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      Mobile Number
                    </div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-white tabular-nums">
                      {currentUser.phone ? (
                        currentUser.phone
                      ) : (
                        <button
                          type="button"
                          onClick={handleStartEdit}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Add mobile number
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Account Verification
                    </div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-white">
                      {currentUser.idVerified ? 'Verified Identity' : 'Standard Member'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                  <div className="space-y-1">
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <Car className="h-3.5 w-3.5" />
                      Default Vehicle
                    </div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-white">
                      {currentUser.vehicleType
                        ? VEHICLE_LABELS[currentUser.vehicleType]
                        : 'Not specified'}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      License Plate Number
                    </div>
                    <div className="text-sm font-mono font-semibold text-zinc-900 dark:text-white uppercase">
                      {currentUser.licensePlate || 'Not set'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                  <div className="space-y-1">
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      Business / Property Name
                    </div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-white">
                      {currentUser.businessName || 'Not configured'}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5" />
                      UPI / Payout Destination
                    </div>
                    <div className="text-sm font-mono font-medium text-zinc-900 dark:text-white">
                      {currentUser.payoutId || 'Not configured'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recent Activity & Linked Facilities Card */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#0B0B0F] overflow-hidden">
            <div className="border-b border-zinc-200 dark:border-zinc-800/90 px-5 py-3 ruixen-dot-bg flex items-center justify-between">
              <span className="font-mono text-[11px] font-semibold tracking-tight text-zinc-500 dark:text-zinc-400">
                02 · RECENT PASSES &amp; LISTED LOTS
              </span>
              <button
                type="button"
                onClick={() =>
                  onNavigatePage(currentUser.role === 'vendor' ? 'vendor' : 'bookings')
                }
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                View All
                <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {driverBookings.length === 0 && vendorSlots.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 p-5 text-center space-y-2.5">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    No parking passes or vendor facilities linked to this profile yet.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onNavigatePage('marketplace')}
                      className="gap-1.5"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Browse Nearby Bays
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onNavigatePage('vendor')}
                      className="gap-1.5"
                    >
                      <Store className="h-3.5 w-3.5" />
                      List a Parking Lot
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {driverBookings.slice(0, 3).map((b) => (
                    <div
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800/80 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <QrCode className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                            {b.slotTitle}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                          Bay {b.bayCode} · {b.durationHours}h · {b.vehiclePlate || 'No plate'} ·{' '}
                          <span className="capitalize">{b.status}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-white tabular-nums">
                          {formatCurrency(b.totalAmount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onNavigatePage('bookings')}
                          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Open Pass
                        </button>
                      </div>
                    </div>
                  ))}

                  {vendorSlots.slice(0, 2).map((slot) => (
                    <div
                      key={slot.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800/80 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Store className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                            {slot.title}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                          {slot.neighborhood} · {slot.totalSlots} bays ·{' '}
                          <span className="capitalize">{slot.approvalStatus}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-white tabular-nums">
                          {formatCurrency(slot.hourlyRate)}/hr
                        </span>
                        <button
                          type="button"
                          onClick={() => onNavigatePage('vendor')}
                          className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          Manage
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
