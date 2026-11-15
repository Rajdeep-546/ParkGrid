import {useMemo, useState} from 'react';
import {
  Ban,
  CheckCircle2,
  Clock,
  Search,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import {toast} from 'sonner';
import type {
  ApprovalStatus,
  BookingRecord,
  ParkingSlot,
  UserProfile,
} from '../../types/parking';
import {cn, formatCurrency, getAvailableBayCount} from '../../lib/utils';
import {Button} from '../ui/button';
import {Card} from '../ui/card';
import {Input} from '../ui/input';
import {ParkingThumbnail} from '../ui/ParkingThumbnail';
import {Switch} from '../ui/switch';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '../ui/tabs';

interface AdminDashboardProps {
  activeTab: string;
  onChangeTab: (tab: string) => void;
  slots: ParkingSlot[];
  users: UserProfile[];
  bookings: BookingRecord[];
  onApproveSlot: (slotId: string, status: ApprovalStatus) => Promise<void>;
  onToggleSlotOpen: (slotId: string, isOpen: boolean) => Promise<void>;
  onDeleteSlot: (slotId: string) => Promise<void>;
  onToggleUserStatus: (uid: string, status: 'active' | 'suspended') => void;
  onVerifyUser: (uid: string) => void;
}

export function AdminDashboard({
  activeTab,
  onChangeTab,
  slots,
  users,
  bookings,
  onApproveSlot,
  onToggleSlotOpen,
  onDeleteSlot,
  onToggleUserStatus,
  onVerifyUser,
}: AdminDashboardProps) {
  const [slotSearch, setSlotSearch] = useState('');
  const [directoryTab, setDirectoryTab] = useState<'slots' | 'users' | 'transactions'>('slots');

  const pendingSlots = useMemo(
    () => slots.filter((s) => s.approvalStatus === 'pending'),
    [slots]
  );

  const totalRevenue = useMemo(
    () =>
      bookings
        .filter((b) => b.status !== 'cancelled')
        .reduce((acc, b) => acc + b.totalAmount, 0),
    [bookings]
  );

  const totalCommission = useMemo(
    () =>
      bookings
        .filter((b) => b.status !== 'cancelled')
        .reduce((acc, b) => acc + b.platformFee, 0),
    [bookings]
  );

  const driverCount = useMemo(
    () => users.filter((u) => u.role === 'driver').length,
    [users]
  );

  const vendorCount = useMemo(
    () => users.filter((u) => u.role === 'vendor').length,
    [users]
  );

  const activeSessions = useMemo(
    () => bookings.filter((b) => b.status === 'active').length,
    [bookings]
  );

  const filteredSlots = useMemo(() => {
    const q = slotSearch.trim().toLowerCase();
    if (!q) return slots;
    return slots.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.neighborhood.toLowerCase().includes(q) ||
        s.vendorName.toLowerCase().includes(q)
    );
  }, [slots, slotSearch]);

  const currentSection =
    activeTab === 'directory'
      ? 'slots'
      : activeTab === 'transactions'
        ? 'transactions'
        : directoryTab;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Super Admin Command Center
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Review vendor submissions, manage accounts, and monitor platform-wide parking revenue.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/90 p-1 shrink-0">
          <button
            type="button"
            onClick={() => onChangeTab('approvals')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap',
              activeTab === 'approvals'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            )}
          >
            Approvals ({pendingSlots.length})
          </button>
          <button
            type="button"
            onClick={() => {
              onChangeTab('directory');
              setDirectoryTab('slots');
            }}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap',
              activeTab === 'directory'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            )}
          >
            Master Directory
          </button>
          <button
            type="button"
            onClick={() => {
              onChangeTab('transactions');
              setDirectoryTab('transactions');
            }}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap',
              activeTab === 'transactions'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            )}
          >
            Transactions
          </button>
        </div>
      </div>

      {/* Platform KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Platform Gross Volume</div>
          <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalRevenue)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {formatCurrency(totalCommission)} platform fees (10%)
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Registered Drivers</div>
          <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {driverCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Verified mobility accounts
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Partner Vendors</div>
          <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
            {vendorCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {slots.length} total facilities
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Active Sessions</div>
          <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {activeSessions}
          </div>
          <div className="mt-1 text-xs text-amber-600 dark:text-amber-400 font-mono tabular-nums">
            {pendingSlots.length} awaiting approval
          </div>
        </Card>
      </div>

      {/* Pending Slot Approval Queue */}
      {activeTab === 'approvals' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Slot Approval Queue ({pendingSlots.length})
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Approved slots publish immediately to the Driver Marketplace
            </span>
          </div>

          {pendingSlots.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-500 mb-2" />
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                All vendor submissions have been reviewed.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                New slots added from the Vendor Console will appear here automatically.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingSlots.map((slot) => (
                <Card key={slot.id} className="overflow-hidden flex flex-col sm:flex-row">
                  <div className="sm:w-40 h-36 sm:h-auto shrink-0">
                    <ParkingThumbnail
                      thumbnailId={slot.thumbnailId}
                      customImageUrl={slot.customImageUrl}
                      alt={slot.title}
                      className="h-full w-full"
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                        <Clock className="h-3.5 w-3.5" />
                        Pending Review · {slot.category}
                      </div>
                      <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white mt-1">
                        {slot.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {slot.address}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        <span>Vendor: {slot.vendorName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{slot.totalSlots} bays</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatCurrency(slot.hourlyRate)}/hr</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200/70 dark:border-slate-800/70">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          void onApproveSlot(slot.id, 'rejected');
                          toast.info(`Rejected "${slot.title}"`);
                        }}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="emerald"
                        onClick={() => {
                          void onApproveSlot(slot.id, 'approved');
                          toast.success(`Approved "${slot.title}" — now live in Marketplace!`);
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approve &amp; Publish
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Master Directory Tabs */}
      <Tabs
        value={currentSection}
        onValueChange={(val) =>
          setDirectoryTab(val as 'slots' | 'users' | 'transactions')
        }
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="slots">All Parking Slots ({slots.length})</TabsTrigger>
            <TabsTrigger value="users">Users &amp; Vendors ({users.length})</TabsTrigger>
            <TabsTrigger value="transactions">
              All Transactions ({bookings.length})
            </TabsTrigger>
          </TabsList>

          {currentSection === 'slots' && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={slotSearch}
                onChange={(e) => setSlotSearch(e.target.value)}
                placeholder="Filter slots or vendors..."
                className="h-9 pl-8 text-xs"
              />
            </div>
          )}
        </div>

        <TabsContent value="slots">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Facility</th>
                    <th className="px-4 py-3 font-medium">Vendor</th>
                    <th className="px-4 py-3 font-medium">Bays</th>
                    <th className="px-4 py-3 font-medium">Hourly</th>
                    <th className="px-4 py-3 font-medium">Approval</th>
                    <th className="px-4 py-3 font-medium">Open</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                  {filteredSlots.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        No parking facilities in directory yet.
                      </td>
                    </tr>
                  ) : (
                    filteredSlots.map((slot) => (
                      <tr
                        key={slot.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {slot.title}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {slot.neighborhood} · {slot.category}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {slot.vendorName}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums">
                          {getAvailableBayCount(slot)}/{slot.totalSlots}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums font-medium">
                          {formatCurrency(slot.hourlyRate)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'font-medium capitalize',
                              slot.approvalStatus === 'approved'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : slot.approvalStatus === 'pending'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-rose-600 dark:text-rose-400'
                            )}
                          >
                            {slot.approvalStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Switch
                            checked={slot.isOpen}
                            onCheckedChange={(checked) =>
                              void onToggleSlotOpen(slot.id, checked)
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {slot.approvalStatus !== 'approved' && (
                              <Button
                                size="sm"
                                variant="emerald"
                                onClick={() => void onApproveSlot(slot.id, 'approved')}
                              >
                                Approve
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Delete ${slot.title}`}
                              onClick={() => {
                                void onDeleteSlot(slot.id);
                                toast.info(`Removed "${slot.title}"`);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name &amp; Email</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                    <th className="px-4 py-3 font-medium">ID Verified</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No registered users or vendors loaded yet. Sign in as Super Admin or register an account.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr
                        key={u.uid}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {u.fullName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {u.email}
                          </div>
                        </td>
                        <td className="px-4 py-3 capitalize font-medium">{u.role}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono">
                          {u.role === 'driver'
                            ? `${u.vehicleType || 'Sedan'} · ${u.licensePlate || 'N/A'}`
                            : u.businessName || u.phone || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {u.idVerified ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Verified
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              Unverified
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'capitalize font-medium',
                              u.status === 'active'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            )}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {!u.idVerified && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  onVerifyUser(u.uid);
                                  toast.success(`Verified ${u.fullName}`);
                                }}
                              >
                                Verify ID
                              </Button>
                            )}
                            {u.role !== 'admin' && (
                              <Button
                                size="sm"
                                variant={u.status === 'active' ? 'ghost' : 'emerald'}
                                onClick={() => {
                                  const next = u.status === 'active' ? 'suspended' : 'active';
                                  onToggleUserStatus(u.uid, next);
                                  toast.info(`${u.fullName} marked ${next}`);
                                }}
                              >
                                <Ban className="h-3.5 w-3.5" />
                                {u.status === 'active' ? 'Suspend' : 'Activate'}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Pass ID</th>
                    <th className="px-4 py-3 font-medium">Driver</th>
                    <th className="px-4 py-3 font-medium">Facility &amp; Bay</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Gross</th>
                    <th className="px-4 py-3 font-medium text-right">Fee (10%)</th>
                    <th className="px-4 py-3 font-medium text-right">Vendor (90%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                  {bookings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        No booking transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    bookings.map((b) => (
                      <tr
                        key={b.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                          {b.qrCodeToken}
                        </td>
                        <td className="px-4 py-3 font-medium">{b.driverName}</td>
                        <td className="px-4 py-3">
                          {b.slotTitle} · <span className="font-mono">{b.bayCode}</span>
                        </td>
                        <td className="px-4 py-3 capitalize">{b.status}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">
                          {formatCurrency(b.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-blue-600 dark:text-blue-400">
                          {formatCurrency(b.platformFee)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(b.vendorPayout)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
