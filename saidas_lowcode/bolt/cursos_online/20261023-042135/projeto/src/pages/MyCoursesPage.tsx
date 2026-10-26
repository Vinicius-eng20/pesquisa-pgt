import { useEffect, useState } from 'react';
import { BookOpen, Calendar, Clock } from 'lucide-react';
import { supabase, type EnrollmentWithCourse } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageLoader, EmptyState, ErrorState } from '@/components/ui';

export default function MyCoursesPage() {
  const { profile } = useAuth();
  const [enrollments, setEnrollments] = useState<EnrollmentWithCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    load();
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('enrollments')
      .select('*, course:courses(*)')
      .eq('student_id', profile!.id)
      .eq('status', 'active')
      .order('enrolled_at', { ascending: false });

    if (error) {
      setError('Não foi possível carregar suas matrículas.');
    } else {
      setEnrollments(data as EnrollmentWithCourse[]);
    }
    setLoading(false);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Meus cursos</h1>
        <p className="text-slate-500 text-sm">Cursos em que você está matriculado.</p>
      </div>

      {error && <div className="mb-6"><ErrorState message={error} /></div>}

      {enrollments.length === 0 && !error ? (
        <EmptyState
          icon={BookOpen}
          title="Você ainda não tem matrículas"
          description="Explore o catálogo e matricule-se em um curso para vê-lo aqui."
        />
      ) : (
        <div className="space-y-4">
          {enrollments.map((enr) => (
            <div
              key={enr.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row gap-4 hover:shadow-md transition-shadow"
            >
              <div className="w-full sm:w-28 h-28 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex-shrink-0 flex items-center justify-center overflow-hidden">
                {enr.course.image_url ? (
                  <img src={enr.course.image_url} alt={enr.course.title} className="w-full h-full object-cover" />
                ) : (
                  <BookOpen className="w-8 h-8 text-white/50" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-base font-bold text-slate-900 truncate">{enr.course.title}</h3>
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-md whitespace-nowrap">
                    Ativo
                  </span>
                </div>
                <p className="text-sm text-slate-500 mb-3 line-clamp-2">{enr.course.description}</p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    {enr.course.category}
                  </span>
                  {enr.course.duration_hours > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {enr.course.duration_hours}h
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Matriculado em {new Date(enr.enrolled_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
