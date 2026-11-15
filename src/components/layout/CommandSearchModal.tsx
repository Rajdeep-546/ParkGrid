import {useEffect, useMemo, useState} from 'react';
import {Car, Loader2, MapPin, Moon, Search, Shield, Store, Sun} from 'lucide-react';
import type {ParkingSlot, SearchLocationFilter, UserRole} from '../../types/parking';
import {formatCurrency, getAvailableBayCount} from '../../lib/utils';
import {
  useIndiaPlaceAutocomplete,
  type PlaceSuggestionItem,
} from '../maps/PlacesProvider';
import {Dialog, DialogContent, DialogHeader, DialogTitle} from '../ui/dialog';
import {Input} from '../ui/input';

interface CommandSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slots: ParkingSlot[];
  isDark: boolean;
  isAdmin: boolean;
  onToggleTheme: () => void;
  onSelectSlot: (slot: ParkingSlot) => void;
  onSelectPlace?: (loc: SearchLocationFilter) => void;
  onSwitchRole: (role: UserRole) => void;
}

export function CommandSearchModal({
  open,
  onOpenChange,
  slots,
  isDark,
  isAdmin,
  onToggleTheme,
  onSelectSlot,
  onSelectPlace,
  onSwitchRole,
}: CommandSearchModalProps) {
  const [query, setQuery] = useState('');
  const {
    suggestions: placeSuggestions,
    loading: loadingPlaces,
    rateLimited,
    retryAfterSec,
    resolvePlaceCoordinates,
  } = useIndiaPlaceAutocomplete(query);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  const matchedSlots = useMemo(() => {
    const q = query.trim().toLowerCase();
    const approved = slots.filter((s) => s.approvalStatus === 'approved');
    if (!q) return approved.slice(0, 5);
    return approved
      .filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.neighborhood.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [slots, query]);

  const handlePickPlace = async (item: PlaceSuggestionItem) => {
    const resolved = await resolvePlaceCoordinates(item);
    if (resolved && onSelectPlace) {
      onSelectPlace({
        label: resolved.label,
        lat: resolved.lat,
        lng: resolved.lng,
        source: 'place',
      });
      setQuery('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Command Search</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2.5 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
          {loadingPlaces ? (
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
          ) : (
            <Search className="h-4 w-4 text-zinc-400 shrink-0" />
          )}
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any Indian place, city, parking facility, or role..."
            className="border-0 bg-transparent px-0 h-8 focus-visible:ring-0"
          />
        </div>

        <div className="p-3 space-y-4 max-h-[60vh] overflow-y-auto">
          {rateLimited && retryAfterSec > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
              Search rate limit reached — live Google lookups resume in {retryAfterSec}s. Showing matching local hubs.
            </div>
          )}
          {placeSuggestions.length > 0 && (
            <div>
              <div className="px-2 pb-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Places &amp; Cities in India
              </div>
              <div className="space-y-1">
                {placeSuggestions.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void handlePickPlace(item)}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <div className="truncate">
                        <div className="font-medium text-zinc-900 dark:text-white truncate">
                          {item.mainText}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                          {item.secondaryText}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedSlots.length > 0 && (
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3">
              <div className="px-2 pb-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                ParkGrid Partner Facilities
              </div>
              <div className="space-y-1">
                {matchedSlots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => {
                      onSelectSlot(slot);
                      onOpenChange(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MapPin className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <div className="truncate">
                        <div className="font-medium text-zinc-900 dark:text-white truncate">
                          {slot.title}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                          {slot.neighborhood} · {getAvailableBayCount(slot)}/{slot.totalSlots} free
                        </div>
                      </div>
                    </div>
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 shrink-0 ml-2">
                      {formatCurrency(slot.hourlyRate)}/h
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3">
            <div className="px-2 pb-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              Workspace Actions
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onSwitchRole('driver');
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/70 cursor-pointer"
              >
                <Car className="h-3.5 w-3.5 text-blue-500" />
                Switch to Driver
              </button>
              <button
                type="button"
                onClick={() => {
                  onSwitchRole('vendor');
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/70 cursor-pointer"
              >
                <Store className="h-3.5 w-3.5 text-emerald-500" />
                Switch to Vendor
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    onSwitchRole('admin');
                    onOpenChange(false);
                  }}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/70 cursor-pointer"
                >
                  <Shield className="h-3.5 w-3.5 text-amber-500" />
                  Admin Center
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onToggleTheme();
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/70 cursor-pointer"
              >
                {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                Toggle {isDark ? 'Light' : 'Dark'} Mode
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
