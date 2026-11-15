export type AppPage =
  | 'overview'
  | 'marketplace'
  | 'bookings'
  | 'vendor'
  | 'admin'
  | 'profile'
  | 'faq';

export interface SearchLocationFilter {
  label: string;
  lat: number;
  lng: number;
  source: 'gps' | 'city' | 'place';
}

export type UserRole = 'driver' | 'vendor' | 'admin';

export type VehicleType = 'Sedan' | 'SUV' | 'EV' | 'Two-Wheeler';

export type SpotCategory =
  | 'Covered Garage'
  | 'Open Driveway'
  | 'Commercial Lot'
  | 'Residential Society'
  | 'Mall/Complex';

export type ApprovalStatus = 'approved' | 'pending' | 'rejected';

export type BookingStatus = 'active' | 'completed' | 'cancelled';

export type AmenityId =
  | 'cctv'
  | 'security'
  | 'ev_charger'
  | 'covered'
  | 'well_lit'
  | 'valet';

export type BayStatus = 'available' | 'occupied' | 'ev_ready' | 'maintenance';

export interface ParkingBay {
  code: string;
  status: BayStatus;
  floor?: string;
}

export interface ParkingSlot {
  id: string;
  vendorId: string;
  vendorName: string;
  title: string;
  address: string;
  landmark: string;
  neighborhood: string;
  category: SpotCategory;
  lat: number;
  lng: number;
  distanceKm: number;
  totalSlots: number;
  slotPrefix: string;
  bays: ParkingBay[];
  hourlyRate: number;
  dailyRate: number;
  monthlyRate: number;
  rating: number;
  reviewCount: number;
  is24Hours: boolean;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
  approvalStatus: ApprovalStatus;
  thumbnailId: string;
  customImageUrl?: string;
  photoGallery?: string[];
  photoAttributions?: {displayName?: string; uri?: string}[];
  vehicleTypes: VehicleType[];
  amenities: AmenityId[];
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  vehicleType?: VehicleType;
  licensePlate?: string;
  businessName?: string;
  payoutId?: string;
  idVerified: boolean;
  admin?: boolean;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface BookingRecord {
  id: string;
  driverId: string;
  driverName: string;
  vendorId: string;
  slotId: string;
  slotTitle: string;
  slotAddress: string;
  bayCode: string;
  vehiclePlate: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  hourlyRate: number;
  totalAmount: number;
  platformFee: number;
  vendorPayout: number;
  status: BookingStatus;
  qrCodeToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  targetRole: UserRole | 'all';
}
