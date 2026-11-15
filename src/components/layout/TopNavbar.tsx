import {useState} from 'react';
import {
  Bell,
  Car,
  CheckCheck,
  LogIn,
  Moon,
  Search,
  Shield,
  Store,
  Sun,
  UserCheck,
} from 'lucide-react';
import {motion} from 'motion/react';
import type {
  AppNotification,
  AppPage,
  UserProfile,
  UserRole,
} from '../../types/parking';
import {cn} from '../../lib/utils';
import {Button} from '../ui/button';

interface TopNavbarProps {
  activePage: AppPage;
  activeRole: UserRole;
  onNavigatePage: (page: AppPage) => void;
  onSwitchRole: (role: UserRole) => void;
  currentUser: UserProfile;
  isFirebaseAuthed: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  notifications: AppNotification[];
  onMarkAllNotificationsRead: () => void;
  onOpenAuth: () => void;
  onOpenCommandSearch: () => void;
}

const NAV_ITEMS: {page: AppPage; label: string}[] = [
  {page: 'overview', label: 'Overview'},
  {page: 'marketplace', label: 'Marketplace'},
  {page: 'vendor', label: 'Vendors'},
  {page: 'admin', label: 'Admin'},
  {page: 'faq', label: 'FAQ'},
];

export function TopNavbar({
  activePage,
  activeRole,
  onNavigatePage,
  onSwitchRole,
  currentUser,
  isFirebaseAuthed,
  isDark,
  onToggleTheme,
  notifications,
  onMarkAllNotificationsRead,
  onOpenAuth,
  onOpenCommandSearch,
}: TopNavbarProps) {
  const [notifOpen, setNotifOpen] = useState(false);

  const roleNotifications = notifications.filter(
    (n) => n.targetRole === activeRole || n.targetRole === 'all'
  );
  const unreadCount = roleNotifications.filter((n) => !n.read).length;

  const isMarketplaceSection =
    activePage === 'marketplace' || activePage === 'bookings';

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/85 dark:bg-[#09090B]/85 glass-surface">
      <div className="mx-auto flex h-14 max-w-[1360px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        {/* Left: Brand Wordmark + Dedicated Page Nav Links */}
        <div className="flex items-center gap-8 min-w-0">
          <button
            type="button"
            onClick={() => onNavigatePage('overview')}
            className="flex items-center gap-2 text-left whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-display font-bold text-xs">
              P
            </span>
            <span className="font-display text-sm font-semibold tracking-tight text-zinc-900 dark:text-white">
              ParkGrid
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.page === 'marketplace'
                  ? isMarketplaceSection
                  : activePage === item.page;
              return (
                <button
                  key={item.page}
                  type="button"
                  onClick={() => onNavigatePage(item.page)}
                  className={cn(
                    'relative py-1.5 hover:text-zinc-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                    isActive && 'text-zinc-900 dark:text-white'
                  )}
                >
                  {item.label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-active-underline"
                      transition={{type: 'spring', stiffness: 420, damping: 32}}
                      className="absolute inset-x-0 -bottom-[15px] h-[2px] bg-blue-600 dark:bg-blue-400 rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Ctrl K Search + Quick Demo Role Switcher + Theme + Account */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenCommandSearch}
            className="hidden lg:inline-flex items-center justify-between gap-6 h-8 w-48 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/80 px-2.5 text-xs text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer"
          >
            <span className="inline-flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5" />
              Search
            </span>
            <kbd className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
              Ctrl K
            </kbd>
          </button>

          {/* Quick Demo Role Switcher Pill */}
          <div
            role="group"
            aria-label="Quick Demo Role Switcher"
            className="hidden sm:inline-flex items-center gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/90 p-0.5 shrink-0"
          >
            {(
              [
                {role: 'driver', label: 'Driver', icon: Car},
                {role: 'vendor', label: 'Vendor', icon: Store},
                {role: 'admin', label: 'Admin', icon: Shield},
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const selected = activeRole === item.role;
              return (
                <button
                  key={item.role}
                  type="button"
                  onClick={() => onSwitchRole(item.role)}
                  className={cn(
                    'relative inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                    selected
                      ? 'text-zinc-900 dark:text-white'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  )}
                >
                  {selected && (
                    <motion.span
                      layoutId="role-pill-bg"
                      transition={{type: 'spring', stiffness: 450, damping: 34}}
                      className="absolute inset-0 rounded-md bg-white dark:bg-zinc-800 shadow-sm"
                    />
                  )}
                  <Icon className="relative z-10 h-3 w-3" />
                  <span className="relative z-10">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Notifications */}
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              onClick={() => setNotifOpen((prev) => !prev)}
              className="relative"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0E0E12] p-3 shadow-2xl z-50">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-white">
                    Notifications ({roleNotifications.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onMarkAllNotificationsRead();
                      setNotifOpen(false);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark read
                  </button>
                </div>
                <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                  {roleNotifications.length === 0 ? (
                    <p className="py-4 text-center text-xs text-zinc-500">
                      No notifications for this role yet.
                    </p>
                  ) : (
                    roleNotifications.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          'rounded-lg p-2.5 text-xs border transition-colors',
                          n.read
                            ? 'border-transparent bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400'
                            : 'border-blue-500/25 bg-blue-50/70 dark:bg-blue-950/30 text-zinc-900 dark:text-zinc-100'
                        )}
                      >
                        <div className="font-semibold">{n.title}</div>
                        <div className="mt-0.5 text-zinc-600 dark:text-zinc-300">
                          {n.message}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={onToggleTheme}
          >
            {isDark ? <Sun className="h-4 w-4 text-zinc-300" /> : <Moon className="h-4 w-4" />}
          </Button>

          <Button
            type="button"
            variant={isFirebaseAuthed ? 'outline' : 'secondary'}
            size="sm"
            onClick={onOpenAuth}
            className="gap-1.5"
          >
            {isFirebaseAuthed ? (
              <>
                <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span className="max-w-[96px] truncate">{currentUser.fullName}</span>
              </>
            ) : (
              <>
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Mobile navigation + role bar */}
      <div className="flex sm:hidden items-center justify-between gap-2 border-t border-zinc-200 dark:border-zinc-800/80 px-4 py-1.5 overflow-x-auto">
        <div className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 p-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.page === 'marketplace'
                ? isMarketplaceSection
                : activePage === item.page;
            return (
              <button
                key={item.page}
                type="button"
                onClick={() => onNavigatePage(item.page)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap',
                  isActive
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400'
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onOpenCommandSearch}
          className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 shrink-0"
        >
          <Search className="h-3.5 w-3.5" />
          Search
        </button>
      </div>
    </header>
  );
}
