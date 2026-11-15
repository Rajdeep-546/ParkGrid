import type {AmenityId, VehicleType} from '../types/parking';

export const AMENITY_META: Record<
  AmenityId,
  {label: string; shortLabel: string}
> = {
  cctv: {label: 'CCTV Surveillance', shortLabel: 'CCTV'},
  security: {label: '24/7 Security Guard', shortLabel: '24/7 Guard'},
  ev_charger: {label: 'EV Fast Charger', shortLabel: 'EV Fast'},
  covered: {label: 'Covered Roof', shortLabel: 'Covered'},
  well_lit: {label: 'Well-Lit Zone', shortLabel: 'Well-Lit'},
  valet: {label: 'Valet Available', shortLabel: 'Valet'},
};

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  Sedan: 'Hatchback / Sedan',
  SUV: 'SUV / MUV',
  EV: 'Electric Vehicle (EV)',
  'Two-Wheeler': 'Two-Wheeler',
};

export interface IndianLocationPreset {
  label: string;
  city: string;
  lat: number;
  lng: number;
}

export const INDIA_HUB_PRESETS: IndianLocationPreset[] = [
  {label: 'Indiranagar, Bengaluru', city: 'Bengaluru', lat: 12.9784, lng: 77.6408},
  {label: 'Koramangala, Bengaluru', city: 'Bengaluru', lat: 12.9352, lng: 77.6245},
  {label: 'MG Road, Bengaluru', city: 'Bengaluru', lat: 12.9756, lng: 77.6066},
  {label: 'Whitefield ITPL, Bengaluru', city: 'Bengaluru', lat: 12.9698, lng: 77.75},
  {label: 'Bandra Kurla Complex, Mumbai', city: 'Mumbai', lat: 19.0653, lng: 72.8682},
  {label: 'Andheri West, Mumbai', city: 'Mumbai', lat: 19.1363, lng: 72.8277},
  {label: 'Lower Parel, Mumbai', city: 'Mumbai', lat: 18.9977, lng: 72.8376},
  {label: 'Connaught Place, New Delhi', city: 'New Delhi', lat: 28.6315, lng: 77.2167},
  {label: 'Saket District Centre, New Delhi', city: 'New Delhi', lat: 28.5245, lng: 77.2066},
  {label: 'Cyber Hub, Gurugram', city: 'Gurugram', lat: 28.495, lng: 77.0895},
  {label: 'Sector 18 Market, Noida', city: 'Noida', lat: 28.5708, lng: 77.3261},
  {label: 'HITEC City, Hyderabad', city: 'Hyderabad', lat: 17.4435, lng: 78.3772},
  {label: 'Banjara Hills, Hyderabad', city: 'Hyderabad', lat: 17.4156, lng: 78.4347},
  {label: 'Koregaon Park, Pune', city: 'Pune', lat: 18.5362, lng: 73.894},
  {label: 'Hinjewadi Phase 1, Pune', city: 'Pune', lat: 18.5913, lng: 73.7389},
  {label: 'T. Nagar, Chennai', city: 'Chennai', lat: 13.0418, lng: 80.2341},
  {label: 'Park Street, Kolkata', city: 'Kolkata', lat: 22.5535, lng: 88.3532},
  {label: 'Salt Lake Sector V, Kolkata', city: 'Kolkata', lat: 22.5735, lng: 88.4331},
  {label: 'SG Highway, Ahmedabad', city: 'Ahmedabad', lat: 23.0304, lng: 72.5178},
  {label: 'MI Road, Jaipur', city: 'Jaipur', lat: 26.9154, lng: 75.809},
  {label: 'MG Road, Kochi', city: 'Kochi', lat: 9.9674, lng: 76.286},
  {label: 'Sector 17 Plaza, Chandigarh', city: 'Chandigarh', lat: 30.7398, lng: 76.7827},
];

export const DEFAULT_INDIA_CENTER = {lat: 12.9716, lng: 77.5946};

export const INDIA_CITY_CENTERS: {city: string; lat: number; lng: number}[] = [
  {city: 'Bengaluru', lat: 12.9716, lng: 77.5946},
  {city: 'Mumbai', lat: 19.076, lng: 72.8777},
  {city: 'New Delhi', lat: 28.6139, lng: 77.209},
  {city: 'Gurugram', lat: 28.4595, lng: 77.0266},
  {city: 'Noida', lat: 28.5355, lng: 77.391},
  {city: 'Hyderabad', lat: 17.385, lng: 78.4867},
  {city: 'Pune', lat: 18.5204, lng: 73.8567},
  {city: 'Chennai', lat: 13.0827, lng: 80.2707},
  {city: 'Kolkata', lat: 22.5726, lng: 88.3639},
  {city: 'Ahmedabad', lat: 23.0225, lng: 72.5714},
  {city: 'Jaipur', lat: 26.9124, lng: 75.7873},
  {city: 'Kochi', lat: 9.9312, lng: 76.2673},
  {city: 'Chandigarh', lat: 30.7333, lng: 76.7794},
];

export interface ParkingThumbnailPreset {
  id: string;
  label: string;
  subtitle: string;
  accentFrom: string;
  accentTo: string;
}

export const PARKING_THUMBNAILS: ParkingThumbnailPreset[] = [
  {
    id: 'covered-vault',
    label: 'Covered Smart Deck',
    subtitle: 'Multi-level concrete & LED guidance',
    accentFrom: '#0F172A',
    accentTo: '#1E3A8A',
  },
  {
    id: 'ev-superhub',
    label: 'EV Bharat Charger Hub',
    subtitle: 'High-voltage canopy bays',
    accentFrom: '#064E3B',
    accentTo: '#0F172A',
  },
  {
    id: 'glass-atrium',
    label: 'Tech Park Atrium Lot',
    subtitle: 'IT corridor multi-level deck',
    accentFrom: '#1E293B',
    accentTo: '#3B82F6',
  },
  {
    id: 'solar-residential',
    label: 'Gated Society Canopy',
    subtitle: 'Residential solar parking bays',
    accentFrom: '#1E293B',
    accentTo: '#059669',
  },
  {
    id: 'transit-plaza',
    label: 'Metro Station Plaza',
    subtitle: 'Commuter park-and-ride zone',
    accentFrom: '#172554',
    accentTo: '#0F172A',
  },
  {
    id: 'waterfront-valet',
    label: 'Commercial Mall Valet',
    subtitle: 'Dedicated valet & fast-exit deck',
    accentFrom: '#0F172A',
    accentTo: '#0284C7',
  },
];
