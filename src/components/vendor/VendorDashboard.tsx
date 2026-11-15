import {useMemo, useState} from 'react';
import {
  CheckCircle2,
  Clock,
  Edit3,
  IndianRupee,
  PlusCircle,
  Star,
  XCircle,
} from 'lucide-react';
import {toast} from 'sonner';
import type {BookingRecord, ParkingSlot, UserProfile} from '../../types/parking';
import {cn, formatCurrency, getAvailableBayCount} from '../../lib/utils';
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
import {Switch} from '../ui/switch';
import {AddSlotModal} from './AddSlotModal';

interface VendorDashboardProps {
  activeTab: string;
  onChangeTab: (tab: string) => void;
  slots: ParkingSlot[];
  bookings: BookingRecord[];
  currentUser: UserProfile;
  onAddSlot: (slot: ParkingSlot) => Promise<void>;
  onToggleSlotOpen: (slotId: string, isOpen: boolean) => Promise<void>;
  onUpdateSlotPricing: (
    slotId: string,
    hourlyRate: number,
    dailyRate: number,
    monthlyRate: number
  ) => Promise<void>;
}

export function VendorDashboard({
  activeTab,
  onChangeTab,
  slots,
  bookings,
  currentUser,
  onAddSlot,
  onToggleSlotOpen,
  onUpdateSlotPricing,
}: VendorDashboardProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ParkingSlot | null>(null);
  const [editHourly, setEditHourly] = useState('');
  const [editDaily, setEditDaily] = useState('');
  const [editMonthly, setEditMonthly] = useState('');

  const vendorSlots = useMemo(
    () => slots.filter((s) => s.vendorId === currentUser.uid),
    [slots, currentUser.uid]
  );

  const vendorBookings = useMemo(
    () => bookings.filter((b) => b.vendorId === currentUser.uid),
    [bookings, currentUser.uid]
  );

  const activeBookingsToday = useMemo(
    () => vendorBookings.filter((b) => b.status === 'active').length,
    [vendorBookings]
  );

  const totalEarnings = useMemo(
    () =>
      vendorBookings
        .filter((b) => b.status !== 'cancelled')
        .reduce((acc, b) => acc + b.vendorPayout, 0),
    [vendorBookings]
  );

  const averageRating = useMemo(() => {
    const rated = vendorSlots.filter((s) => s.reviewCount > 0);
    if (rated.length === 0) return null;
    return rated.reduce((acc, s) => acc + s.rating, 0) / rated.length;
  }, [vendorSlots]);

  const openEditModal = (slot: ParkingSlot) => {
    setEditingSlot(slot);
    setEditHourly(String(slot.hourlyRate));
    setEditDaily(String(slot.dailyRate));
    setEditMonthly(String(slot.monthlyRate));
  };

  const handleSavePricing = async () => {
    if (!editingSlot) return;
    const h = Math.max(1, Number(editHourly) || editingSlot.hourlyRate);
    const d = Math.max(5, Number(editDaily) || editingSlot.dailyRate);
    const m = Math.max(50, Number(editMonthly) || editingSlot.monthlyRate);
    await onUpdateSlotPricing(editingSlot.id, h, d, m);
    toast.success(`Updated rates for ${editingSlot.title}`);
    setEditingSlot(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Vendor Partner Console
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {currentUser.businessName || currentUser.fullName} · Manage bays, live availability, and payout revenue.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/90 p-1">
            <button
              type="button"
              onClick={() => onChangeTab('overview')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap',
                activeTab !== 'payouts'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              )}
            >
              My Spaces
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('payouts')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap',
                activeTab === 'payouts'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              )}
            >
              Earnings
            </button>
          </div>

          <Button variant="emerald" onClick={() => setAddModalOpen(true)}>
            <PlusCircle className="h-4 w-4" />
            Add Parking Slot
          </Button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Listed Slots</div>
          <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {vendorSlots.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {vendorSlots.reduce((acc, s) => acc + s.totalSlots, 0)} total bays
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Active Bookings Today</div>
          <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
            {activeBookingsToday}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Live occupied bays
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Earnings (90% Split)</div>
          <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalEarnings)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Direct to {currentUser.payoutId || 'connected payout'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Average Rating</div>
          <div className="mt-1.5 flex items-center gap-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            {averageRating !== null ? averageRating.toFixed(1) : '—'}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Verified driver feedback
          </div>
        </Card>
      </div>

      {activeTab === 'payouts' ? (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">
              Vendor Booking &amp; Payout Ledger
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              {vendorBookings.length} transactions
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Facility</th>
                  <th className="px-4 py-3 font-medium">Driver</th>
                  <th className="px-4 py-3 font-medium">Bay</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Net Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                {vendorBookings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No reservations recorded for your properties yet.
                    </td>
                  </tr>
                ) : (
                  vendorBookings.map((b) => (
                    <tr
                      key={b.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3 font-medium">{b.slotTitle}</td>
                      <td className="px-4 py-3">{b.driverName}</td>
                      <td className="px-4 py-3 font-mono">{b.bayCode}</td>
                      <td className="px-4 py-3 font-mono tabular-nums">{b.durationHours}h</td>
                      <td className="px-4 py-3 capitalize">{b.status}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatCurrency(b.vendorPayout)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            My Listed Parking Facilities ({vendorSlots.length})
          </h2>

          {vendorSlots.length === 0 ? (
            <Card className="p-10 text-center">
              <p className="text-sm font-medium">No parking facilities listed yet.</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                List your garage, driveway, or EV lot to start accepting reservations.
              </p>
              <Button
                variant="emerald"
                className="mt-4"
                onClick={() => setAddModalOpen(true)}
              >
                <PlusCircle className="h-4 w-4" />
                Add Your First Parking Slot
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vendorSlots.map((slot) => {
                const freeBays = getAvailableBayCount(slot);
                const statusMeta =
                  slot.approvalStatus === 'approved'
                    ? {
                        label: 'Approved',
                        color: 'text-emerald-600 dark:text-emerald-400',
                        icon: CheckCircle2,
                      }
                    : slot.approvalStatus === 'pending'
                      ? {
                          label: 'Pending Admin Review',
                          color: 'text-amber-600 dark:text-amber-400',
                          icon: Clock,
                        }
                      : {
                          label: 'Rejected',
                          color: 'text-rose-600 dark:text-rose-400',
                          icon: XCircle,
                        };
                const StatusIcon = statusMeta.icon;

                return (
                  <Card key={slot.id} className="overflow-hidden flex flex-col sm:flex-row">
                    <div className="sm:w-44 h-40 sm:h-auto shrink-0">
                      <ParkingThumbnail
                        thumbnailId={slot.thumbnailId}
                        customImageUrl={slot.customImageUrl}
                        alt={slot.title}
                        className="h-full w-full"
                      />
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-xs font-medium',
                              statusMeta.color
                            )}
                          >
                            <StatusIcon className="h-3.5 w-3.5" />
                            {statusMeta.label}
                          </span>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {slot.isOpen ? 'Open' : 'Closed'}
                            </span>
                            <Switch
                              checked={slot.isOpen}
                              onCheckedChange={(checked) =>
                                void onToggleSlotOpen(slot.id, checked)
                              }
                            />
                          </div>
                        </div>

                        <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white mt-1.5">
                          {slot.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {slot.address}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/70 dark:border-slate-800/70 text-xs">
                        <div className="flex items-center gap-3 font-mono tabular-nums">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(slot.hourlyRate)}/hr
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {freeBays}/{slot.totalSlots} free
                          </span>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(slot)}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit Pricing
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      <AddSlotModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        currentUser={currentUser}
        onAddSlot={onAddSlot}
      />

      {/* Edit Pricing Dialog */}
      <Dialog
        open={Boolean(editingSlot)}
        onOpenChange={(open) => {
          if (!open) setEditingSlot(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Pricing Tiers</DialogTitle>
            <DialogDescription>{editingSlot?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                Hourly Rate (₹)
              </label>
              <Input
                type="number"
                step="5"
                value={editHourly}
                onChange={(e) => setEditHourly(e.target.value)}
                className="font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                Daily Pass (₹)
              </label>
              <Input
                type="number"
                step="10"
                value={editDaily}
                onChange={(e) => setEditDaily(e.target.value)}
                className="font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                Monthly Subscription (₹)
              </label>
              <Input
                type="number"
                step="100"
                value={editMonthly}
                onChange={(e) => setEditMonthly(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditingSlot(null)}>
                Cancel
              </Button>
              <Button onClick={() => void handleSavePricing()}>
                <IndianRupee className="h-3.5 w-3.5" />
                Save Rates
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
