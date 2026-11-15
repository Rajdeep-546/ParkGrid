import React, {useEffect, useState} from 'react';
import {
  Building2,
  Car,
  CheckCircle2,
  Loader2,
  LogOut,
  ShieldCheck,
  Store,
  User,
  UserPlus,
} from 'lucide-react';
import {toast} from 'sonner';

function GoogleLogo({className = 'h-4 w-4 shrink-0'}: {className?: string}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
    >
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}
import type {UserProfile, UserRole, VehicleType} from '../../types/parking';
import {cn, sanitizeId} from '../../lib/utils';
import {Button} from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {Input} from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '../ui/tabs';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: UserProfile;
  users: UserProfile[];
  hasActiveSession: boolean;
  isFirebaseAuthed: boolean;
  isAdmin: boolean;
  onOpenAdmin: () => void;
  onOpenProfile: () => void;
  onGoogleSignIn: () => Promise<void>;
  onGoogleSignOut: () => Promise<void>;
  onRegisterUser: (user: UserProfile) => Promise<void>;
  onLoginExisting: (user: UserProfile) => void;
}

export function AuthModal({
  open,
  onOpenChange,
  currentUser,
  users,
  hasActiveSession,
  isFirebaseAuthed,
  isAdmin,
  onOpenAdmin,
  onOpenProfile,
  onGoogleSignIn,
  onGoogleSignOut,
  onRegisterUser,
  onLoginExisting,
}: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>(
    hasActiveSession ? 'login' : 'register'
  );
  const [regRole, setRegRole] = useState<'driver' | 'vendor'>('driver');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('Sedan');
  const [licensePlate, setLicensePlate] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [payoutId, setPayoutId] = useState('');
  const [idVerifiedRequest, setIdVerifiedRequest] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(hasActiveSession ? 'login' : 'register');
    }
  }, [open, hasActiveSession]);

  const handleGoogleClick = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    try {
      await onGoogleSignIn();
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      toast.error('Please fill in all required account fields.');
      return;
    }
    if (regRole === 'driver' && !licensePlate.trim()) {
      toast.error('Please enter your vehicle license plate number.');
      return;
    }
    if (regRole === 'vendor' && (!businessName.trim() || !payoutId.trim())) {
      toast.error('Please enter your business/property name and payout ID.');
      return;
    }

    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const newUser: UserProfile = {
        uid: sanitizeId(`usr_${regRole}_${Date.now()}`),
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role: regRole as UserRole,
        vehicleType: regRole === 'driver' ? vehicleType : undefined,
        licensePlate: regRole === 'driver' ? licensePlate.trim().toUpperCase() : undefined,
        businessName: regRole === 'vendor' ? businessName.trim() : undefined,
        payoutId: regRole === 'vendor' ? payoutId.trim() : undefined,
        idVerified: regRole === 'vendor' ? idVerifiedRequest : true,
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await onRegisterUser(newUser);
      toast.success(
        `Registered as ${regRole === 'driver' ? 'Driver' : 'Parking Vendor'} (${newUser.fullName}).`
      );
      setFullName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setLicensePlate('');
      setBusinessName('');
      setPayoutId('');
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLocalLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const matched = users.find(
      (u) => u.email.toLowerCase() === loginEmail.trim().toLowerCase()
    );
    if (!matched) {
      toast.error('No matching account found. Try registering or signing in with Google.');
      return;
    }
    onLoginExisting(matched);
    toast.success(`Signed in as ${matched.fullName} (${matched.role}).`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Account &amp; Role Access
          </DialogTitle>
          <DialogDescription>
            Sign in with Google for live Firebase sync, or register a Driver or Parking Vendor profile.
          </DialogDescription>
        </DialogHeader>

        {/* Active Firebase Session Banner / Profile Section */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5">
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isFirebaseAuthed ? 'Firebase Authenticated Profile' : 'Active Workspace Profile'}
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {currentUser.fullName} · <span className="capitalize">{currentUser.role}</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {currentUser.email || 'Not signed in — sign in with Google to sync'}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {hasActiveSession && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onOpenProfile();
                }}
              >
                <User className="h-3.5 w-3.5" />
                My Profile
              </Button>
            )}
            {isFirebaseAuthed && isAdmin && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onOpenAdmin();
                }}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin Center
              </Button>
            )}
            {hasActiveSession ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void onGoogleSignOut()}
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </Button>
            ) : (
              <button
                type="button"
                disabled={googleLoading}
                onClick={() => void handleGoogleClick()}
                className="group inline-flex h-9 items-center justify-center gap-2.5 rounded-lg border border-slate-300 dark:border-zinc-700/80 bg-white dark:bg-zinc-900 px-3.5 text-xs font-semibold text-slate-800 dark:text-zinc-100 shadow-sm hover:bg-slate-50 dark:hover:bg-zinc-800 hover:border-slate-400 dark:hover:border-zinc-600 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {googleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
                ) : (
                  <GoogleLogo className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-105" />
                )}
                <span>{googleLoading ? 'Connecting...' : 'Continue with Google'}</span>
              </button>
            )}
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'login' | 'register')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="register">
              <UserPlus className="h-3.5 w-3.5" />
              Register New Account
            </TabsTrigger>
            <TabsTrigger value="login">Sign In / Switch</TabsTrigger>
          </TabsList>

          <TabsContent value="register">
            <form onSubmit={(e) => void handleRegisterSubmit(e)} className="space-y-4">
              {/* Role Selection Cards */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRegRole('driver')}
                  className={cn(
                    'flex flex-col items-start rounded-xl border p-3.5 text-left transition-all cursor-pointer',
                    regRole === 'driver'
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 ring-1 ring-blue-500'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  )}
                >
                  <Car
                    className={cn(
                      'h-5 w-5 mb-2',
                      regRole === 'driver' ? 'text-blue-500' : 'text-slate-400'
                    )}
                  />
                  <span className="text-sm font-semibold">Register as Driver</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Search, reserve bays &amp; QR passes
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRegRole('vendor')}
                  className={cn(
                    'flex flex-col items-start rounded-xl border p-3.5 text-left transition-all cursor-pointer',
                    regRole === 'vendor'
                      ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 ring-1 ring-emerald-500'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  )}
                >
                  <Store
                    className={cn(
                      'h-5 w-5 mb-2',
                      regRole === 'vendor' ? 'text-emerald-500' : 'text-slate-400'
                    )}
                  />
                  <span className="text-sm font-semibold">Register as Vendor</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    List parking bays &amp; track payouts
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                    Full Name
                  </label>
                  <Input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Aarav Sharma"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                    Email Address
                  </label>
                  <Input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="aarav@example.in"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                    Phone Number
                  </label>
                  <Input
                    required
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                    Password
                  </label>
                  <Input
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                  />
                </div>
              </div>

              {/* Conditional Role Fields */}
              {regRole === 'driver' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3.5">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
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
                        <SelectItem value="SUV">SUV / Truck</SelectItem>
                        <SelectItem value="EV">Electric Vehicle (EV)</SelectItem>
                        <SelectItem value="Two-Wheeler">Bike / Two-Wheeler</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                      License Plate Number
                    </label>
                    <Input
                      required
                      value={licensePlate}
                      onChange={(e) => setLicensePlate(e.target.value)}
                      placeholder="KA 01 MJ 4829"
                      className="font-mono uppercase"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                        Business / Property Name
                      </label>
                      <Input
                        required
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Indiranagar Smart Parking LLP"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                        Bank / UPI Payout ID
                      </label>
                      <Input
                        required
                        value={payoutId}
                        onChange={(e) => setPayoutId(e.target.value)}
                        placeholder="vendor@okicici"
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      <span>Submit ID verification packet for faster approval</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIdVerifiedRequest((p) => !p)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium border cursor-pointer',
                        idVerifiedRequest
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'border-slate-300 dark:border-slate-700 text-slate-500'
                      )}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {idVerifiedRequest ? 'ID Attached' : 'Verify Later'}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={regRole === 'vendor' ? 'emerald' : 'default'}
                  disabled={submitting}
                >
                  {submitting
                    ? 'Creating Account...'
                    : `Create ${regRole === 'driver' ? 'Driver' : 'Vendor'} Account`}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="login" className="space-y-4">
            {!isFirebaseAuthed && (
              <>
                <button
                  type="button"
                  disabled={googleLoading}
                  onClick={() => void handleGoogleClick()}
                  className="group flex w-full h-10 items-center justify-center gap-3 rounded-xl border border-slate-300 dark:border-zinc-700/90 bg-white dark:bg-zinc-900 px-4 text-sm font-semibold text-slate-800 dark:text-zinc-100 shadow-sm hover:bg-slate-50 dark:hover:bg-zinc-800/90 hover:border-slate-400 dark:hover:border-zinc-600 active:scale-[0.995] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {googleLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
                  ) : (
                    <GoogleLogo className="h-[18px] w-[18px] shrink-0 transition-transform duration-150 group-hover:scale-105" />
                  )}
                  <span>
                    {googleLoading ? 'Signing in with Google...' : 'Continue with Google'}
                  </span>
                </button>

                <div className="relative flex items-center py-0.5">
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                  <span className="mx-3 shrink-0 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    or continue with email
                  </span>
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                </div>
              </>
            )}

            <form onSubmit={handleLocalLogin} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                  Account Email
                </label>
                <Input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Enter registered email..."
                />
              </div>
              <Button type="submit" className="w-full">
                Sign In with Email
              </Button>
            </form>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                Registered Directory Quick-Switch
              </p>
              <div className="space-y-1.5 max-h-44 overflow-y-auto slim-scrollbar">
                {users.filter((u) => isAdmin || (u.role !== 'admin' && !u.admin)).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                    No accounts registered yet. Sign in with Google above or register a Driver / Vendor account.
                  </div>
                ) : (
                  users
                    .filter((u) => isAdmin || (u.role !== 'admin' && !u.admin))
                    .map((u) => (
                    <button
                      key={u.uid}
                      type="button"
                      onClick={() => {
                        onLoginExisting(u);
                        toast.success(`Switched to ${u.fullName} (${u.role})`);
                        onOpenChange(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <div className="truncate">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {u.fullName}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 ml-2">
                            {u.email}
                          </span>
                        </div>
                      </div>
                      <span className="capitalize font-medium text-blue-600 dark:text-blue-400 shrink-0 ml-2">
                        {u.role}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
