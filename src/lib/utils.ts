import {clsx, type ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';
import type {ParkingBay, ParkingSlot} from '../types/parking';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function generateBays(
  totalSlots: number,
  prefix: string,
  evSupported: boolean,
  occupiedBayCodes: string[] = []
): ParkingBay[] {
  const cleanPrefix =
    (prefix || 'A').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'A';
  const occupiedSet = new Set(occupiedBayCodes);
  const bays: ParkingBay[] = [];
  for (let i = 1; i <= totalSlots; i++) {
    const code = `${cleanPrefix}${i}`;
    let status: ParkingBay['status'] = 'available';
    if (occupiedSet.has(code)) {
      status = 'occupied';
    } else if (evSupported && i % 3 === 0) {
      status = 'ev_ready';
    }
    bays.push({
      code,
      status,
      floor: i <= 6 ? 'L1' : 'L2',
    });
  }
  return bays;
}

export function getAvailableBayCount(slot: ParkingSlot): number {
  return slot.bays.filter((b) => b.status === 'available' || b.status === 'ev_ready').length;
}

export function formatTimeRemaining(endIso: string, nowMs: number): string {
  const diff = new Date(endIso).getTime() - nowMs;
  if (diff <= 0) return '00:00:00';
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}
