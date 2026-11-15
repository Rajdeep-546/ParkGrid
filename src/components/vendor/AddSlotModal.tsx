import React, {useState} from 'react';
import {Upload} from 'lucide-react';
import {toast} from 'sonner';
import type {
  AmenityId,
  ParkingSlot,
  SpotCategory,
  UserProfile,
  VehicleType,
} from '../../types/parking';
import {
  AMENITY_META,
  DEFAULT_INDIA_CENTER,
  INDIA_HUB_PRESETS,
  PARKING_THUMBNAILS,
} from '../../data/indiaParkingConfig';
import {cn, generateBays, sanitizeId} from '../../lib/utils';
import {Button} from '../ui/button';
import {Checkbox} from '../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {Input} from '../ui/input';
import {ParkingThumbnail} from '../ui/ParkingThumbnail';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {Switch} from '../ui/switch';

interface AddSlotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: UserProfile;
  onAddSlot: (slot: ParkingSlot) => Promise<void>;
}

export function AddSlotModal({
  open,
  onOpenChange,
  currentUser,
  onAddSlot,
}: AddSlotModalProps) {
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [neighborhood, setNeighborhood] = useState(INDIA_HUB_PRESETS[0].label);
  const [category, setCategory] = useState<SpotCategory>('Covered Garage');
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>(['Sedan', 'SUV', 'EV']);
  const [totalSlots, setTotalSlots] = useState(6);
  const [slotPrefix, setSlotPrefix] = useState('A');
  const [hourlyRate, setHourlyRate] = useState('80');
  const [dailyRate, setDailyRate] = useState('450');
  const [monthlyRate, setMonthlyRate] = useState('4500');
  const [amenities, setAmenities] = useState<AmenityId[]>([
    'cctv',
    'covered',
    'ev_charger',
    'well_lit',
  ]);
  const [is24Hours, setIs24Hours] = useState(true);
  const [openTime, setOpenTime] = useState('06:00');
  const [closeTime, setCloseTime] = useState('23:00');
  const [thumbnailId, setThumbnailId] = useState(PARKING_THUMBNAILS[0].id);
  const [customImageUrl, setCustomImageUrl] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const toggleVehicle = (type: VehicleType) => {
    setVehicleTypes((prev) =>
      prev.includes(type) ? (prev.length > 1 ? prev.filter((t) => t !== type) : prev) : [...prev, type]
    );
  };

  const toggleAmenity = (id: AmenityId) => {
    setAmenities((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleUploadPreview = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Please pick an image under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !address.trim()) {
      toast.error('Please provide a spot title and street address.');
      return;
    }

    setSubmitting(true);
    try {
      const matchedHub = INDIA_HUB_PRESETS.find((h) => h.label === neighborhood);
      const baseCoords = matchedHub
        ? {lat: matchedHub.lat, lng: matchedHub.lng}
        : DEFAULT_INDIA_CENTER;
      const jitterLat = (Math.random() - 0.5) * 0.008;
      const jitterLng = (Math.random() - 0.5) * 0.008;
      const nowIso = new Date().toISOString();
      const prefix = (slotPrefix || 'A').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'A';
      const count = Math.max(1, Math.min(50, Number(totalSlots) || 5));
      const evSupported = vehicleTypes.includes('EV') || amenities.includes('ev_charger');

      const newSlot: ParkingSlot = {
        id: sanitizeId(`slot_${Date.now()}`),
        vendorId: currentUser.uid,
        vendorName:
          currentUser.businessName || currentUser.fullName || 'Partner Parking Facility',
        title: title.trim(),
        address: address.trim(),
        landmark: landmark.trim() || `${neighborhood} Hub`,
        neighborhood,
        category,
        lat: Number((baseCoords.lat + jitterLat).toFixed(5)),
        lng: Number((baseCoords.lng + jitterLng).toFixed(5)),
        distanceKm: Number((0.4 + Math.random() * 2.1).toFixed(1)),
        totalSlots: count,
        slotPrefix: prefix,
        bays: generateBays(count, prefix, evSupported, []),
        hourlyRate: Math.max(10, Number(hourlyRate) || 80),
        dailyRate: Math.max(50, Number(dailyRate) || 450),
        monthlyRate: Math.max(500, Number(monthlyRate) || 4500),
        rating: 0,
        reviewCount: 0,
        is24Hours,
        openTime: is24Hours ? '00:00' : openTime,
        closeTime: is24Hours ? '23:59' : closeTime,
        isOpen: true,
        approvalStatus: 'pending',
        thumbnailId,
        customImageUrl,
        vehicleTypes,
        amenities,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await onAddSlot(newSlot);
      toast.success(`"${newSlot.title}" submitted for Super Admin review.`);
      setTitle('');
      setAddress('');
      setLandmark('');
      setCustomImageUrl(undefined);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            List a New Parking Facility
          </DialogTitle>
          <DialogDescription>
            Configure bays, pricing tiers, vehicle compatibility, and security amenities. New listings enter the Admin approval queue immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          {/* Location & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                Location / Spot Title
              </label>
              <Input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., 100ft Road Covered EV Smart Deck"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                Full Street Address
              </label>
              <Input
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g., 42, 100 Feet Road, Indiranagar, Bengaluru 560038"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                Nearby Landmark
              </label>
              <Input
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="e.g., 200m from Indiranagar Metro Station"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                  City / Hub Area
                </label>
                <Select value={neighborhood} onValueChange={setNeighborhood}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIA_HUB_PRESETS.map((preset) => (
                      <SelectItem key={preset.label} value={preset.label}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                  Spot Category
                </label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as SpotCategory)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Covered Garage">Covered Garage</SelectItem>
                    <SelectItem value="Open Driveway">Open Driveway</SelectItem>
                    <SelectItem value="Commercial Lot">Commercial Lot</SelectItem>
                    <SelectItem value="Residential Society">Residential Society</SelectItem>
                    <SelectItem value="Mall/Complex">Mall/Complex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Capacity, Prefix & Vehicle Compatibility */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                    Total Bays
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={totalSlots}
                    onChange={(e) => setTotalSlots(Number(e.target.value))}
                    className="font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                    Slot Prefix
                  </label>
                  <Input
                    value={slotPrefix}
                    maxLength={3}
                    onChange={(e) => setSlotPrefix(e.target.value.toUpperCase())}
                    className="font-mono uppercase"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Generated bay codes: {slotPrefix || 'B'}1 – {slotPrefix || 'B'}
                {Math.max(1, Math.min(50, totalSlots || 1))}
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2 block">
                Vehicle Compatibility (Multi-select)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['Sedan', 'SUV', 'Two-Wheeler', 'EV'] as VehicleType[]).map((v) => {
                  const checked = vehicleTypes.includes(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggleVehicle(v)}
                      className={cn(
                        'rounded-lg border px-2.5 py-1.5 text-xs font-medium text-left transition-colors cursor-pointer',
                        checked
                          ? 'border-blue-500 bg-blue-600/15 text-blue-600 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      )}
                    >
                      {v === 'Sedan'
                        ? 'Hatchback / Sedan'
                        : v === 'SUV'
                          ? 'SUV / Truck'
                          : v === 'EV'
                            ? 'EV Charging'
                            : 'Two-Wheeler'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Pricing Model */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                Hourly Rate (₹)
              </label>
              <Input
                type="number"
                step="5"
                min="10"
                required
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
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
                min="50"
                required
                value={dailyRate}
                onChange={(e) => setDailyRate(e.target.value)}
                className="font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">
                Monthly Pass (₹)
              </label>
              <Input
                type="number"
                step="100"
                min="500"
                required
                value={monthlyRate}
                onChange={(e) => setMonthlyRate(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          {/* Amenities & Operating Hours */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2 block">
                Amenities
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {(Object.keys(AMENITY_META) as AmenityId[]).map((id) => (
                  <label
                    key={id}
                    className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    <Checkbox
                      checked={amenities.includes(id)}
                      onCheckedChange={() => toggleAmenity(id)}
                    />
                    <span>{AMENITY_META[id].label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Open 24/7 Access
                </span>
                <Switch checked={is24Hours} onCheckedChange={setIs24Hours} />
              </div>
              {!is24Hours && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[11px] text-slate-500 mb-1 block">Opens</label>
                    <Input
                      type="time"
                      value={openTime}
                      onChange={(e) => setOpenTime(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 mb-1 block">Closes</label>
                    <Input
                      type="time"
                      value={closeTime}
                      onChange={(e) => setCloseTime(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Photo / Thumbnail Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Facility Photo / Visual Style
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                Upload Photo Preview
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUploadPreview}
                />
              </label>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
              {PARKING_THUMBNAILS.map((preset) => {
                const selected = !customImageUrl && thumbnailId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setCustomImageUrl(undefined);
                      setThumbnailId(preset.id);
                    }}
                    className={cn(
                      'overflow-hidden rounded-lg border text-left transition-all cursor-pointer',
                      selected
                        ? 'border-blue-500 ring-2 ring-blue-500'
                        : 'border-slate-200 dark:border-slate-800 opacity-80 hover:opacity-100'
                    )}
                  >
                    <ParkingThumbnail
                      thumbnailId={preset.id}
                      alt={preset.label}
                      className="h-14 w-full"
                    />
                    <div className="px-1.5 py-1 text-[10px] font-medium truncate">
                      {preset.label}
                    </div>
                  </button>
                );
              })}
            </div>
            {customImageUrl && (
              <div className="mt-2 flex items-center gap-3 text-xs text-emerald-600 dark:text-emerald-400">
                <span>Custom photo preview attached.</span>
                <button
                  type="button"
                  onClick={() => setCustomImageUrl(undefined)}
                  className="underline cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="emerald" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Parking Slot'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
