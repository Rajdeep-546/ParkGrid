import {useEffect, useRef, useState} from 'react';
import {
  Bell,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Layers,
  LogIn,
  LogOut,
  Moon,
  Palette,
  QrCode,
  Shield,
  ShieldCheck,
  Sparkles,
  Store,
  Sun,
  User,
  UserCheck,
  Users,
} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import type {AppPage, UserProfile, UserRole} from '../../types/parking';
import {cn} from '../../lib/utils';

export interface AccountMenuProps {
  currentUser?: UserProfile;
  activePage?: AppPage;
  activeRole?: UserRole;
  hasActiveSession?: boolean;
  isFirebaseAuthed?: boolean;
  isAdmin?: boolean;
  isDark?: boolean;
  onNavigatePage?: (page: AppPage) => void;
  onToggleTheme?: () => void;
  onOpenAuth?: () => void;
  onSignOut?: () => Promise<void> | void;
}

type SubmenuId = 'workspace' | 'appearance' | 'preferences' | null;

export function AccountMenu({
  currentUser = {
    uid: 'usr_demo',
    fullName: 'ParkGrid Member',
    email: 'member@parkgrid.in',
    phone: '',
    role: 'driver',
    idVerified: true,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  activePage = 'overview',
  hasActiveSession = true,
  isFirebaseAuthed = false,
  isAdmin = false,
  isDark = true,
  onNavigatePage,
  onToggleTheme,
  onOpenAuth,
  onSignOut,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<SubmenuId>(null);
  const [passAlerts, setPassAlerts] = useState(true);
  const [expiryReminders, setExpiryReminders] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveSubmenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setActiveSubmenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const nameParts = (currentUser.fullName || 'PG')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const firstName = nameParts[0] || 'Account';
  const initials = nameParts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || 'U';

  const handleSelectPage = (page: AppPage) => {
    setOpen(false);
    setActiveSubmenu(null);
    onNavigatePage?.(page);
  };

  const roleBadgeLabel = isAdmin
    ? 'Admin'
    : currentUser.role === 'vendor'
      ? 'Vendor'
      : 'Driver';

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger Button:
          - Phone view (< md): Shows ONLY the sky-600 colored initial icon badge
          - Desktop view (md+): Shows the sky-600 initial icon badge + First Name + role tag & chevron */}
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => {
            const next = !prev;
            if (!next) setActiveSubmenu(null);
            return next;
          });
        }}
        className={cn(
          'group inline-flex items-center justify-center rounded-xl transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0',
          'h-8 w-8 p-0 border-0 bg-transparent md:h-9 md:w-auto md:px-2 md:py-1 md:gap-2.5 md:border',
          open || activePage === 'profile'
            ? 'md:border-sky-500/70 md:bg-sky-500/10 text-zinc-900 dark:text-white md:shadow-sm'
            : 'md:border-zinc-200/90 md:dark:border-zinc-800 md:bg-zinc-100/80 md:dark:bg-[#090B10] text-zinc-800 dark:text-zinc-200 md:hover:border-zinc-300 md:dark:hover:border-zinc-700 md:hover:bg-zinc-200/50 md:dark:hover:bg-zinc-900'
        )}
      >
        {/* Preserved Sky-600 Initial Icon Badge (Always visible, sole element on phone view) */}
        <span className="relative flex h-7 w-7 md:h-6 md:w-6 items-center justify-center rounded-lg bg-sky-600 text-[11px] md:text-[10px] font-bold text-white shrink-0 shadow-sm ring-2 ring-sky-500/20 group-hover:ring-sky-500/40 transition-all">
          {hasActiveSession ? initials : <User className="h-3.5 w-3.5" />}
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-white dark:ring-[#0D1117]',
              hasActiveSession ? 'bg-emerald-500' : 'bg-amber-400'
            )}
          />
        </span>

        {/* Desktop-only First Name + Role indicator + Chevron */}
        <div className="hidden md:flex items-center gap-1.5 min-w-0">
          <span className="max-w-[92px] truncate text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {hasActiveSession ? firstName : 'Account'}
          </span>
          <span className="rounded-md bg-zinc-200/80 dark:bg-zinc-800/90 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            {hasActiveSession ? roleBadgeLabel : 'Guest'}
          </span>
        </div>

        <ChevronDown
          className={cn(
            'hidden md:block h-3.5 w-3.5 text-zinc-400 shrink-0 transition-transform duration-200',
            open && 'rotate-180 text-sky-500'
          )}
        />
      </button>

      {/* Ruixen Professional AccountMenu Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{opacity: 0, y: 8, scale: 0.96}}
            animate={{opacity: 1, y: 0, scale: 1}}
            exit={{opacity: 0, y: 6, scale: 0.96}}
            transition={{duration: 0.16, ease: [0.16, 1, 0.3, 1]}}
            className="absolute right-0 mt-2.5 w-72 rounded-2xl border border-zinc-200/90 dark:border-zinc-800/95 bg-white/98 dark:bg-[#0D1117]/98 backdrop-blur-2xl p-2 shadow-2xl shadow-zinc-950/20 dark:shadow-black/70 z-50"
          >
            {/* 1. Profile Header Card */}
            <div className="rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-900/60 p-2.5">
              <div className="flex items-center gap-3">
                <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-xs font-bold text-white shrink-0 shadow-sm">
                  {hasActiveSession ? initials : <User className="h-4 w-4" />}
                  <span
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-zinc-900',
                      hasActiveSession ? 'bg-emerald-500' : 'bg-amber-400'
                    )}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                      {hasActiveSession ? currentUser.fullName : 'Guest Session'}
                    </span>
                    {hasActiveSession && (
                      <UserCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                    {hasActiveSession
                      ? currentUser.email ||
                        (isFirebaseAuthed ? 'Google Verified' : 'Active Workspace')
                      : 'Sign in to sync passes & lots'}
                  </div>
                </div>
                <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400 shrink-0">
                  {hasActiveSession ? roleBadgeLabel : 'Guest'}
                </span>
              </div>
            </div>

            <div className="my-1.5 border-t border-zinc-200/80 dark:border-zinc-800/80" />

            {/* 2. Primary Account Actions with Icon-Text Spacing & Hover Slide */}
            <div className="space-y-0.5 text-xs">
              <button
                type="button"
                onMouseEnter={() => setActiveSubmenu(null)}
                onClick={() => handleSelectPage('profile')}
                className={cn(
                  'group flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all duration-150 cursor-pointer',
                  activePage === 'profile'
                    ? 'bg-sky-500/12 text-sky-600 dark:text-sky-400 font-medium'
                    : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:translate-x-0.5'
                )}
              >
                <span className="inline-flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-500/10 text-sky-500">
                    <User className="h-3.5 w-3.5" />
                  </span>
                  <span>My Profile &amp; Digital Pass</span>
                </span>
                {activePage === 'profile' ? (
                  <Check className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                ) : (
                  <kbd className="font-mono text-[10px] text-zinc-400">⌘P</kbd>
                )}
              </button>

              <button
                type="button"
                onMouseEnter={() => setActiveSubmenu(null)}
                onClick={() => handleSelectPage('bookings')}
                className={cn(
                  'group flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all duration-150 cursor-pointer',
                  activePage === 'bookings'
                    ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 font-medium'
                    : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:translate-x-0.5'
                )}
              >
                <span className="inline-flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
                    <QrCode className="h-3.5 w-3.5" />
                  </span>
                  <span>My Bookings &amp; QR Passes</span>
                </span>
                {activePage === 'bookings' ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <kbd className="font-mono text-[10px] text-zinc-400">⌘B</kbd>
                )}
              </button>

              {/* 3. Nested Submenu 1: Workspaces & Dashboards */}
              <div
                className="relative"
                onMouseEnter={() => setActiveSubmenu('workspace')}
              >
                <button
                  type="button"
                  onClick={() =>
                    setActiveSubmenu((prev) =>
                      prev === 'workspace' ? null : 'workspace'
                    )
                  }
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all duration-150 cursor-pointer',
                    activeSubmenu === 'workspace'
                      ? 'bg-zinc-100 dark:bg-zinc-800/90 text-zinc-900 dark:text-white'
                      : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:translate-x-0.5'
                  )}
                >
                  <span className="inline-flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-500">
                      <Layers className="h-3.5 w-3.5" />
                    </span>
                    <span>Switch Workspace</span>
                  </span>
                  <ChevronRight
                    className={cn(
                      'h-3.5 w-3.5 text-zinc-400 transition-transform duration-150',
                      activeSubmenu === 'workspace' &&
                        'rotate-90 md:rotate-0 text-zinc-900 dark:text-white'
                    )}
                  />
                </button>

                <AnimatePresence>
                  {activeSubmenu === 'workspace' && (
                    <motion.div
                      initial={{opacity: 0, x: 6, scale: 0.97}}
                      animate={{opacity: 1, x: 0, scale: 1}}
                      exit={{opacity: 0, x: 6, scale: 0.97}}
                      transition={{duration: 0.14}}
                      className="mt-1 md:mt-0 md:absolute md:right-full md:top-0 md:pr-2 z-50"
                    >
                      <div className="w-full md:w-60 rounded-2xl border border-zinc-200/90 dark:border-zinc-800/95 bg-zinc-50/95 dark:bg-[#11161F] md:bg-white/98 md:dark:bg-[#0D1117]/98 backdrop-blur-2xl p-1.5 md:shadow-2xl space-y-0.5">
                        <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                          Platform Modules
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectPage('marketplace')}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer"
                        >
                          <span className="inline-flex items-center gap-2.5">
                            <Car className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                            <span>Driver Marketplace</span>
                          </span>
                          {activePage === 'marketplace' && (
                            <Check className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectPage('vendor')}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer"
                        >
                          <span className="inline-flex items-center gap-2.5">
                            <Store className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            <span>Vendor Partner Console</span>
                          </span>
                          {activePage === 'vendor' && (
                            <Check className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectPage('overview')}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer"
                        >
                          <span className="inline-flex items-center gap-2.5">
                            <Sparkles className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                            <span>Platform Overview</span>
                          </span>
                          {activePage === 'overview' && (
                            <Check className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                          )}
                        </button>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleSelectPage('admin')}
                            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition-colors cursor-pointer"
                          >
                            <span className="inline-flex items-center gap-2.5">
                              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                              <span>Super Admin Panel</span>
                            </span>
                            {activePage === 'admin' && (
                              <Check className="h-3.5 w-3.5 shrink-0" />
                            )}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 4. Nested Submenu 2: Appearance & Theme */}
              <div
                className="relative"
                onMouseEnter={() => setActiveSubmenu('appearance')}
              >
                <button
                  type="button"
                  onClick={() =>
                    setActiveSubmenu((prev) =>
                      prev === 'appearance' ? null : 'appearance'
                    )
                  }
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all duration-150 cursor-pointer',
                    activeSubmenu === 'appearance'
                      ? 'bg-zinc-100 dark:bg-zinc-800/90 text-zinc-900 dark:text-white'
                      : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:translate-x-0.5'
                  )}
                >
                  <span className="inline-flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/10 text-violet-500">
                      <Palette className="h-3.5 w-3.5" />
                    </span>
                    <span>Appearance</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <span>{isDark ? 'Dark' : 'Light'}</span>
                    <ChevronRight
                      className={cn(
                        'h-3.5 w-3.5 transition-transform duration-150',
                        activeSubmenu === 'appearance' && 'rotate-90 md:rotate-0'
                      )}
                    />
                  </span>
                </button>

                <AnimatePresence>
                  {activeSubmenu === 'appearance' && (
                    <motion.div
                      initial={{opacity: 0, x: 6, scale: 0.97}}
                      animate={{opacity: 1, x: 0, scale: 1}}
                      exit={{opacity: 0, x: 6, scale: 0.97}}
                      transition={{duration: 0.14}}
                      className="mt-1 md:mt-0 md:absolute md:right-full md:top-0 md:pr-2 z-50"
                    >
                      <div className="w-full md:w-52 rounded-2xl border border-zinc-200/90 dark:border-zinc-800/95 bg-zinc-50/95 dark:bg-[#11161F] md:bg-white/98 md:dark:bg-[#0D1117]/98 backdrop-blur-2xl p-1.5 md:shadow-2xl space-y-0.5">
                        <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                          Interface Theme
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isDark) onToggleTheme?.();
                          }}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer"
                        >
                          <span className="inline-flex items-center gap-2.5">
                            <Moon className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                            <span>Dark Mode</span>
                          </span>
                          {isDark && (
                            <Check className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (isDark) onToggleTheme?.();
                          }}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer"
                        >
                          <span className="inline-flex items-center gap-2.5">
                            <Sun className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            <span>Light Mode</span>
                          </span>
                          {!isDark && (
                            <Check className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 5. Nested Submenu 3: Notification Preferences (Checkbox Items) */}
              <div
                className="relative"
                onMouseEnter={() => setActiveSubmenu('preferences')}
              >
                <button
                  type="button"
                  onClick={() =>
                    setActiveSubmenu((prev) =>
                      prev === 'preferences' ? null : 'preferences'
                    )
                  }
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all duration-150 cursor-pointer',
                    activeSubmenu === 'preferences'
                      ? 'bg-zinc-100 dark:bg-zinc-800/90 text-zinc-900 dark:text-white'
                      : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:translate-x-0.5'
                  )}
                >
                  <span className="inline-flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-500">
                      <Bell className="h-3.5 w-3.5" />
                    </span>
                    <span>Alert Preferences</span>
                  </span>
                  <ChevronRight
                    className={cn(
                      'h-3.5 w-3.5 text-zinc-400 transition-transform duration-150',
                      activeSubmenu === 'preferences' && 'rotate-90 md:rotate-0'
                    )}
                  />
                </button>

                <AnimatePresence>
                  {activeSubmenu === 'preferences' && (
                    <motion.div
                      initial={{opacity: 0, x: 6, scale: 0.97}}
                      animate={{opacity: 1, x: 0, scale: 1}}
                      exit={{opacity: 0, x: 6, scale: 0.97}}
                      transition={{duration: 0.14}}
                      className="mt-1 md:mt-0 md:absolute md:right-full md:top-0 md:pr-2 z-50"
                    >
                      <div className="w-full md:w-56 rounded-2xl border border-zinc-200/90 dark:border-zinc-800/95 bg-zinc-50/95 dark:bg-[#11161F] md:bg-white/98 md:dark:bg-[#0D1117]/98 backdrop-blur-2xl p-1.5 md:shadow-2xl space-y-0.5">
                        <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                          Session Alerts
                        </div>
                        <button
                          type="button"
                          onClick={() => setPassAlerts((p) => !p)}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer"
                        >
                          <span>QR Gate Entry Alerts</span>
                          {passAlerts && (
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpiryReminders((p) => !p)}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer"
                        >
                          <span>Bay Expiry Reminders</span>
                          {expiryReminders && (
                            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 6. Payouts / Protocol & Account Switch */}
              <button
                type="button"
                onMouseEnter={() => setActiveSubmenu(null)}
                onClick={() => handleSelectPage('faq')}
                className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:translate-x-0.5 transition-all duration-150 cursor-pointer"
              >
                <span className="inline-flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-500/10 text-teal-500">
                    <CreditCard className="h-3.5 w-3.5" />
                  </span>
                  <span>Payouts &amp; Gate Protocol</span>
                </span>
                <Shield className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onMouseEnter={() => setActiveSubmenu(null)}
                  onClick={() => handleSelectPage('admin')}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left font-medium transition-all duration-150 cursor-pointer',
                    activePage === 'admin'
                      ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                      : 'text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 hover:translate-x-0.5'
                  )}
                >
                  <span className="inline-flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-500/15 text-sky-500">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </span>
                    <span>Admin Center</span>
                  </span>
                  <span className="text-[10px] font-mono uppercase">Admin</span>
                </button>
              )}

              <button
                type="button"
                onMouseEnter={() => setActiveSubmenu(null)}
                onClick={() => {
                  setOpen(false);
                  setActiveSubmenu(null);
                  onOpenAuth?.();
                }}
                className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:translate-x-0.5 transition-all duration-150 cursor-pointer"
              >
                <span className="inline-flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-500/10 text-zinc-500 dark:text-zinc-400">
                    <Users className="h-3.5 w-3.5" />
                  </span>
                  <span>
                    {hasActiveSession ? 'Switch / Add Account' : 'Sign In / Register'}
                  </span>
                </span>
              </button>
            </div>

            <div className="my-1.5 border-t border-zinc-200/80 dark:border-zinc-800/80" />

            {/* 7. Footer Sign In / Sign Out */}
            {hasActiveSession ? (
              <button
                type="button"
                onMouseEnter={() => setActiveSubmenu(null)}
                onClick={() => {
                  setOpen(false);
                  setActiveSubmenu(null);
                  void onSignOut?.();
                }}
                className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-500/10 text-rose-500">
                    <LogOut className="h-3.5 w-3.5" />
                  </span>
                  <span>Sign Out</span>
                </span>
                <kbd className="font-mono text-[10px] text-rose-400/80">⇧⌘Q</kbd>
              </button>
            ) : (
              <button
                type="button"
                onMouseEnter={() => setActiveSubmenu(null)}
                onClick={() => {
                  setOpen(false);
                  setActiveSubmenu(null);
                  onOpenAuth?.();
                }}
                className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-medium text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-500/10 text-sky-500">
                    <LogIn className="h-3.5 w-3.5" />
                  </span>
                  <span>Sign In to ParkGrid</span>
                </span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AccountMenu;
