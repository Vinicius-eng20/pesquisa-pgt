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
  name: string;
  role: 'student' | 'admin';
  created_at: string;
};

export type Course = {
  id: string;
  title: string;
  description: string;
  instructor: string;
  category: string;
  level: 'Iniciante' | 'Intermediario' | 'Avancado';
  duration_hours: number;
  image_url: string | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Enrollment = {
  id: string;
  student_id: string;
  course_id: string;
  status: 'active' | 'cancelled';
  enrolled_at: string;
};

export type EnrollmentWithCourse = Enrollment & {
  course: Pick<Course, 'id' | 'title' | 'description' | 'instructor' | 'category' | 'level' | 'duration_hours' | 'image_url'>;
};

export type EnrollmentWithDetails = Enrollment & {
  course: Pick<Course, 'id' | 'title' | 'description' | 'instructor' | 'category' | 'level' | 'duration_hours'>;
  profile: Pick<Profile, 'id' | 'name' | 'email'>;
};
