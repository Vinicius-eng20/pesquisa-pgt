import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Search, GraduationCap, BookOpen } from 'lucide-react';
import { supabase, type Course } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import CourseCard from '@/components/CourseCard';
import { PageLoader, EmptyState, ErrorState } from '@/components/ui';

export default function CatalogPage() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [justEnrolled, setJustEnrolled] = useState<string | null>(null);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const { data: courseData, error: courseErr } = await supabase
      .from('courses')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (courseErr) {
      setError('Não foi possível carregar os cursos.');
      setLoading(false);
      return;
    }
    setCourses(courseData as Course[]);

    if (profile) {
      const { data: enrData } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', profile.id)
        .eq('status', 'active');
      if (enrData) {
        setEnrolledIds(new Set(enrData.map((e) => e.course_id)));
      }
    }
    setLoading(false);
  };

  const handleEnroll = async (courseId: string) => {
    setEnrolling(courseId);
    const { error } = await supabase
      .from('enrollments')
      .insert({ student_id: profile!.id, course_id: courseId });

    if (error) {
      if (error.code === '23505') {
        setError(null);
      } else {
        setError('Não foi possível se matricular. Tente novamente.');
      }
    } else {
      setEnrolledIds((prev) => new Set(prev).add(courseId));
      setJustEnrolled(courseId);
      setTimeout(() => setJustEnrolled(null), 2500);
    }
    setEnrolling(null);
  };

  const filtered = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase()) ||
      c.instructor.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Cursos disponíveis</h1>
        <p className="text-slate-500 text-sm">Encontre um curso e matricule-se para começar.</p>
      </div>

      {error && <div className="mb-6"><ErrorState message={error} /></div>}

      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título, categoria ou instrutor..."
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={search ? 'Nenhum curso encontrado' : 'Nenhum curso disponível'}
          description={search ? 'Tente buscar por outro termo.' : 'Volte mais tarde, novos cursos estão chegando.'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((course) => {
            const isEnrolled = enrolledIds.has(course.id);
            const isJustEnrolled = justEnrolled === course.id;
            return (
              <CourseCard
                key={course.id}
                course={course}
                footer={
                  isEnrolled || isJustEnrolled ? (
                    <div className="flex items-center gap-2 text-green-600 font-medium text-sm bg-green-50 rounded-xl py-2.5 px-4">
                      <CheckCircle2 className="w-4 h-4" />
                      {isJustEnrolled ? 'Matrícula confirmada!' : 'Você está matriculado'}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEnroll(course.id)}
                      disabled={enrolling === course.id}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {enrolling === course.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Matriculando...
                        </>
                      ) : (
                        <>
                          <GraduationCap className="w-4 h-4" />
                          Matricular-se
                        </>
                      )}
                    </button>
                  )
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
