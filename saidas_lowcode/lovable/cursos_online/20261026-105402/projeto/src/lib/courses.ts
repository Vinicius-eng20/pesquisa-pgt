import { supabase } from "@/integrations/supabase/client";

export type Course = {
  id: string;
  title: string;
  description: string;
  instructor: string;
  workload_hours: number;
};

export async function fetchCourses(): Promise<Course[]> {
  const { data, error } = await supabase.from("courses").select("*").order("created_at");
  if (error) throw error;
  return data;
}

export async function fetchMyEnrollmentIds(): Promise<string[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data, error } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("user_id", u.user.id);
  if (error) throw error;
  return data.map((r) => r.course_id);
}
