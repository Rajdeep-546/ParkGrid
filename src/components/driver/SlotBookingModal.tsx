import React, {useEffect, useMemo, useState} from 'react';
import {QRCodeSVG} from 'qrcode.react';
import {
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {motion} from 'motion/react';
import {toast} from 'sonner';
import type {BookingRecord, ParkingBay, ParkingSlot, UserProfile} from '../../types/parking';
import {cn, formatCurrency, getAvailableBayCount} from '../../lib/utils';
import {Button} from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {Input} from '../ui/input';
import {Slider} from '../ui/slider';

interface SlotBookingModalProps {
  slot: ParkingSlot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: UserProfile;
  onConfirmBooking: (params: {
    slot: ParkingSlot;
    bay: ParkingBay;
    durationHours: number;
    startTime: string;
    vehiclePlate: string;
  }) => Promise<BookingRecord>;
}

export function SlotBookingModal({
  slot,
  open,
  onOpenChange,
  currentUser,
  onConfirmBooking,
}: SlotBookingModalProps) {
  const [selectedBayCode, setSelectedBayCode] = useState<string>('');
  const [durationHours, setDurationHours] = useState<number>(2);
  const [startOption, setStartOption] = useState<'now' | '30m' | '1h'>('now');
  const [vehiclePlate, setVehiclePlate] = useState<string>(
    currentUser.licensePlate || 'KA01MJ4829'
  );
  const [confirmedBooking, setConfirmedBooking] = useState<BookingRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (slot && open) {
      const firstOpen = slot.bays.find(
        (b) => b.status === 'available' || b.status === 'ev_ready'
      );
      setSelectedBayCode(firstOpen?.code || '');
      setConfirmedBooking(null);
      setDurationHours(2);
      setVehiclePlate(currentUser.licensePlate || 'KA01MJ4829');
    }
  }, [slot, open, currentUser.licensePlate]);

  const selectedBay = useMemo(
    () => slot?.bays.find((b) => b.code === selectedBayCode) || null,
    [slot, selectedBayCode]
  );

  if (!slot) return null;

  const subtotal = Number((slot.hourlyRate * durationHours).toFixed(2));
  const platformFee = Number((subtotal * 0.1).toFixed(2));
  const totalAmount = Number((subtotal + platformFee).toFixed(2));
  const availableCount = getAvailableBayCount(slot);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBay || (selectedBay.status !== 'available' && selectedBay.status !== 'ev_ready')) {
      toast.error('Please pick an available or EV-ready parking bay.');
      return;
    }
    if (!vehiclePlate.trim()) {
      toast.error('Please enter your vehicle license plate.');
      return;
    }

    setSubmitting(true);
    try {
      const offsetMinutes = startOption === 'now' ? 0 : startOption === '30m' ? 30 : 60;
      const startTimeIso = new Date(Date.now() + offsetMinutes * 60000).toISOString();
      const created = await onConfirmBooking({
        slot,
        bay: selectedBay,
        durationHours,
        startTime: startTimeIso,
        vehiclePlate: vehiclePlate.trim().toUpperCase(),
      });
      setConfirmedBooking(created);
      toast.success(`Bay ${created.bayCode} reserved at ${slot.title}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {confirmedBooking ? (
          <motion.div
            initial={{opacity: 0, scale: 0.96}}
            animate={{opacity: 1, scale: 1}}
            transition={{duration: 0.2}}
            className="space-y-5"
          >
            <DialogHeader>
              <div className="flex items-center gap-2 text-emerald-500 text-sm font-semibold mb-1">
                <CheckCircle2 className="h-4 w-4" />
                Reservation Confirmed
              </div>
              <DialogTitle className="font-display text-2xl">
                Digital QR Parking Pass
              </DialogTitle>
              <DialogDescription>
                Scan at the entry gate kiosk or present to the facility attendant.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-5 items-center">
              <div className="flex flex-col items-center justify-center rounded-xl bg-white p-4 shadow-sm">
                <QRCodeSVG
                  value={confirmedBooking.qrCodeToken}
                  size={164}
                  level="M"
                  includeMargin={false}
                />
                <span className="mt-2.5 font-mono text-[11px] font-medium text-slate-600">
                  {confirmedBooking.qrCodeToken}
                </span>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Facility</div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {confirmedBooking.slotTitle}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {confirmedBooking.slotAddress}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Assigned Bay</div>
                    <div className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {confirmedBooking.bayCode}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">License Plate</div>
                    <div className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                      {confirmedBooking.vehiclePlate}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Duration</div>
                    <div className="font-mono font-semibold tabular-nums">
                      {confirmedBooking.durationHours}h
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Total Paid</div>
                    <div className="font-mono font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                      {formatCurrency(confirmedBooking.totalAmount)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done — View in My Bookings
              </Button>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={(e) => void handleConfirm(e)} className="space-y-5">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">{slot.title}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-blue-500" />
                  {slot.address}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {availableCount} of {slot.totalSlots} bays free
                </span>
              </DialogDescription>
            </DialogHeader>

            {/* Interactive Visual Bay Grid */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  1. Select an Individual Bay
                </span>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Available
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    EV-Ready
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Occupied
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                {slot.bays.map((bay) => {
                  const isSelectable = bay.status === 'available' || bay.status === 'ev_ready';
                  const isPicked = selectedBayCode === bay.code;
                  return (
                    <button
                      key={bay.code}
                      type="button"
                      disabled={!isSelectable}
                      onClick={() => setSelectedBayCode(bay.code)}
                      className={cn(
                        'relative flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all duration-150',
                        isPicked
                          ? 'border-blue-500 bg-blue-600/15 dark:bg-blue-600/25 ring-2 ring-blue-500 text-slate-900 dark:text-white cursor-pointer'
                          : bay.status === 'ev_ready'
                            ? 'border-blue-500/40 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:border-blue-500 cursor-pointer'
                            : bay.status === 'available'
                              ? 'border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:border-emerald-500 cursor-pointer'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/50 text-slate-400 dark:text-slate-600 opacity-65 cursor-not-allowed'
                      )}
                    >
                      <span className="font-mono text-sm font-bold">{bay.code}</span>
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium">
                        {bay.status === 'ev_ready' && <Zap className="h-2.5 w-2.5" />}
                        {bay.status === 'ev_ready'
                          ? 'EV-Ready'
                          : bay.status === 'available'
                            ? 'Available'
                            : 'Occupied'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Timing, Duration & Vehicle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 p-4">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                    Arrival Window
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        {id: 'now', label: 'Now'},
                        {id: '30m', label: '+30 min'},
                        {id: '1h', label: '+1 hour'},
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setStartOption(opt.id)}
                        className={cn(
                          'rounded-lg border py-1.5 text-xs font-medium transition-colors cursor-pointer',
                          startOption === opt.id
                            ? 'border-blue-500 bg-blue-600 text-white'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                    Vehicle License Plate
                  </label>
                  <Input
                    required
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    placeholder="KA01MJ4829"
                    className="font-mono uppercase"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600 dark:text-slate-300 inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-blue-500" />
                    Duration
                  </span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                    {durationHours} {durationHours === 1 ? 'hour' : 'hours'}
                  </span>
                </div>
                <Slider
                  value={[durationHours]}
                  min={1}
                  max={24}
                  step={1}
                  onValueChange={(vals) => setDurationHours(vals[0] || 1)}
                />
                <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>
                      {formatCurrency(slot.hourlyRate)} × {durationHours}h
                    </span>
                    <span className="font-mono tabular-nums">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Service &amp; Gate Access Fee (10%)</span>
                    <span className="font-mono tabular-nums">{formatCurrency(platformFee)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-slate-900 dark:text-white pt-1">
                    <span>Total Due</span>
                    <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                Instant QR gate pass · Free cancellation before entry
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!selectedBay || submitting}>
                  {submitting
                    ? 'Reserving...'
                    : `Confirm Bay ${selectedBayCode || ''} · ${formatCurrency(totalAmount)}`}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
