import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: 'business' | 'client';
  created_at: string;
};

export type Service = {
  id: string;
  business_id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  active: boolean;
  created_at: string;
};

export type AvailableSlot = {
  id: string;
  business_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  created_at: string;
  service?: Service;
};

export type Booking = {
  id: string;
  client_id: string;
  business_id: string;
  service_id: string;
  slot_id: string;
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled';
  notes: string;
  created_at: string;
  service?: Service;
  slot?: AvailableSlot;
  client?: Profile;
};

export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled';

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Aguardando confirmação',
  confirmed: 'Confirmado',
  declined: 'Recusado',
  cancelled: 'Cancelado',
};

export const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  declined: 'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};
