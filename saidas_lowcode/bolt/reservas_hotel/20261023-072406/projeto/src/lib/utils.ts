import type { Room, Reservation } from '@/lib/supabase';

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function calcTotal(pricePerNight: number, checkIn: string, checkOut: string): number {
  return pricePerNight * nightsBetween(checkIn, checkOut);
}

export function statusBadgeClass(status: Reservation['status']): string {
  switch (status) {
    case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
    case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
    case 'cancelled': return 'bg-slate-100 text-slate-500 border-slate-200';
  }
}

export function statusLabel(status: Reservation['status']): string {
  switch (status) {
    case 'pending': return 'Pendente';
    case 'confirmed': return 'Confirmada';
    case 'rejected': return 'Recusada';
    case 'cancelled': return 'Cancelada';
  }
}

export function roomImage(room: Room): string {
  return room.image_url || 'https://images.pexels.com/photos/6434592/pexels-photo-6434592.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';
}
