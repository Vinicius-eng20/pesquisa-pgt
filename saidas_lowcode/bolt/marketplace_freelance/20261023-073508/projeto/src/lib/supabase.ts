import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type ServiceStatus = 'pending' | 'approved' | 'rejected' | 'removed';
export type ContractStatus = 'pending' | 'accepted' | 'completed' | 'cancelled';
export type UserRole = 'user' | 'admin';

export interface Profile {
  id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_suspended: boolean;
  created_at: string;
}

export interface Service {
  id: string;
  provider_id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  status: ServiceStatus;
  created_at: string;
  provider?: Profile;
}

export interface Contract {
  id: string;
  service_id: string;
  client_id: string;
  provider_id: string;
  status: ContractStatus;
  details: string | null;
  created_at: string;
  service?: Service;
  client?: Profile;
  provider?: Profile;
}
