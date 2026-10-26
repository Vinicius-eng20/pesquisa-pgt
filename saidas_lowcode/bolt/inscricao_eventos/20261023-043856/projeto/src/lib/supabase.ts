import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Profile = {
  id: string;
  name: string;
  role: 'participant' | 'organizer';
  created_at: string;
};

export type EventItem = {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  capacity: number;
  image_url: string | null;
  status: 'open' | 'cancelled';
  organizer_id: string;
  created_at: string;
};

export type Registration = {
  id: string;
  event_id: string;
  user_id: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: string;
};

export type RegistrationWithEvent = Registration & {
  events: Pick<EventItem, 'id' | 'title' | 'date' | 'location' | 'status'>;
};

export type RegistrationWithProfile = Registration & {
  profiles: Pick<Profile, 'id' | 'name'>;
};
