import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Room = {
  id: string;
  name: string;
  description: string;
  price_per_night: number;
  capacity: number;
  image_url: string | null;
  amenities: string[];
  is_active: boolean;
  created_at: string;
};

export type Reservation = {
  id: string;
  room_id: string;
  guest_id: string;
  check_in: string;
  check_out: string;
  guests_count: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  total_price: number;
  notes: string;
  created_at: string;
  room?: Room;
  guest_name?: string;
};

export type Profile = {
  id: string;
  full_name: string;
  role: 'guest' | 'manager';
  created_at: string;
};
