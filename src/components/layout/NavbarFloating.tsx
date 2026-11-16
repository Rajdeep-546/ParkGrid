import {useEffect, useRef, useState} from 'react';
import {
  Bell,
  CheckCheck,
  Moon,
  Search,
  Sun,
} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import type {
  AppNotification,
  AppPage,
  UserProfile,
  UserRole,
} from '../../types/parking';
import {cn} from '../../lib/utils';
import AccountMenu from '@/src/registry/ruixenui/account-menu';
import {Button} from '../ui/button';

interface NavbarFloatingProps {
  activePage: AppPage;
  activeRole: UserRole;
  onNavigatePage: (page: AppPage) => void;
  currentUser: UserProfile;
  hasActiveSession: boolean;
  isFirebaseAuthed: boolean;
  isAdmin: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  notifications: AppNotification[];
  onMarkAllNotificationsRead: () => void;
  onOpenAuth: () => void;
  onGoogleSignOut: () => Promise<void>;
  onOpenCommandSearch: () => void;
}

const PUBLIC_NAV_ITEMS: {page: AppPage; label: string}[] = [
  {page: 'overview', label: 'Overview'},
  {page: 'marketplace', label: 'Marketplace'},
  {page: 'bookings', label: 'My Passes'},
  {page: 'vendor', label: 'Vendors'},
  {page: 'faq', label: 'FAQ'},
];

export function NavbarFloating({
  activePage,
  activeRole,
  onNavigatePage,
  currentUser,
  hasActiveSession,
  isFirebaseAuthed,
  isAdmin,
  isDark,
  onToggleTheme,
  notifications,
  onMarkAllNotificationsRead,
  onOpenAuth,
  onGoogleSignOut,
  onOpenCommandSearch,
}: NavbarFloatingProps) {
  const [notifOpen, setNotifOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const roleNotifications = notifications.filter(
    (n) => n.targetRole === activeRole || n.targetRole === 'all'
  );
  const unreadCount = roleNotifications.filter((n) => !n.read).length;

  return (
    <div className="sticky top-3 z-40 px-3 sm:px-6 pointer-events-none">
      <header className="pointer-events-auto mx-auto max-w-[1260px] rounded-2xl border border-zinc-200/90 dark:border-zinc-800/90 bg-white/85 dark:bg-[#0D1117]/85 glass-surface shadow-lg shadow-zinc-950/5 dark:shadow-black/40 transition-colors">
        <div className="flex h-14 items-center justify-between gap-4 px-3.5 sm:px-5">
          {/* Zone 1: Brand */}
          <button
            type="button"
            onClick={() => onNavigatePage('overview')}
            className="flex items-center gap-2 text-left whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-display font-bold text-xs shadow-sm">
              P
            </span>
            <span className="font-display text-sm font-semibold tracking-tight text-zinc-900 dark:text-white">
              ParkGrid
            </span>
          </button>

          {/* Zone 2: Floating Center Nav Links (Public pages only — Admin hidden) */}
          <nav className="hidden md:flex items-center gap-1 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-100/70 dark:bg-[#090B10]/80 p-1">
            {PUBLIC_NAV_ITEMS.map((item) => {
              const isActive = activePage === item.page;
              return (
                <button
                  key={item.page}
                  type="button"
                  onClick={() => onNavigatePage(item.page)}
                  className={cn(
                    'relative px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                    isActive
                      ? 'text-zinc-900 dark:text-white'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="floating-nav-pill"
                      transition={{type: 'spring', stiffness: 440, damping: 32}}
                      className="absolute inset-0 rounded-lg bg-white dark:bg-zinc-800 shadow-sm"
                    />
                  )}
                  <span className="relative z-10">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Search, Alerts, Theme & Profile Section */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenCommandSearch}
              aria-label="Quick search"
              className="hidden lg:inline-flex items-center justify-between gap-4 h-8 w-40 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-[#090B10] px-2.5 text-xs text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" />
                Search
              </span>
              <kbd className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={onOpenCommandSearch}
              aria-label="Search"
              className="inline-flex lg:hidden h-8 w-8 items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <Search className="h-4 w-4" />
            </button>

            {/* Notifications Popover */}
            <div ref={notifRef} className="relative">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                onClick={() => {
                  setNotifOpen((p) => !p);
                }}
                className="relative h-8 w-8 rounded-lg"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-sky-600 px-1 text-[9px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </Button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{opacity: 0, y: 6, scale: 0.98}}
                    animate={{opacity: 1, y: 0, scale: 1}}
                    exit={{opacity: 0, y: 6, scale: 0.98}}
                    transition={{duration: 0.15}}
                    className="absolute right-0 mt-2 w-80 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D1117] p-3 shadow-2xl z-50"
                  >
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
                        className="inline-flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark read
                      </button>
                    </div>
                    <div className="mt-2 max-h-60 space-y-2 overflow-y-auto slim-scrollbar">
                      {roleNotifications.length === 0 ? (
                        <p className="py-4 text-center text-xs text-zinc-500">
                          No notifications yet.
                        </p>
                      ) : (
                        roleNotifications.map((n) => (
                          <div
                            key={n.id}
                            className={cn(
                              'rounded-lg p-2.5 text-xs border transition-colors',
                              n.read
                                ? 'border-transparent bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400'
                                : 'border-sky-500/25 bg-sky-50/70 dark:bg-sky-950/30 text-zinc-900 dark:text-zinc-100'
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={onToggleTheme}
              className="h-8 w-8 rounded-lg"
            >
              {isDark ? (
                <Sun className="h-4 w-4 text-zinc-300" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            {/* Ruixen AccountMenu with Nested Submenus & Icon-Only Phone Trigger */}
            <AccountMenu
              currentUser={currentUser}
              activePage={activePage}
              activeRole={activeRole}
              hasActiveSession={hasActiveSession}
              isFirebaseAuthed={isFirebaseAuthed}
              isAdmin={isAdmin}
              isDark={isDark}
              onNavigatePage={onNavigatePage}
              onToggleTheme={onToggleTheme}
              onOpenAuth={onOpenAuth}
              onSignOut={onGoogleSignOut}
            />
          </div>
        </div>

        {/* Compact Mobile Floating Nav Row (FAQ excluded on phone view) */}
        <div className="flex md:hidden items-center justify-between gap-1 border-t border-zinc-200/80 dark:border-zinc-800/80 px-2.5 py-1.5 overflow-x-auto no-scrollbar">
          {PUBLIC_NAV_ITEMS.filter((item) => item.page !== 'faq').map((item) => {
            const isActive = activePage === item.page;
            return (
              <button
                key={item.page}
                type="button"
                onClick={() => onNavigatePage(item.page)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors',
                  isActive
                    ? 'bg-zinc-900 text-white dark:bg-zinc-800 dark:text-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </header>
    </div>
  );
}

export default NavbarFloating;
