import { Clock, BookOpen } from 'lucide-react';
import type { Course } from '@/lib/supabase';

const levelColors: Record<string, string> = {
  Iniciante: 'bg-green-100 text-green-700',
  Intermediario: 'bg-amber-100 text-amber-700',
  Avancado: 'bg-red-100 text-red-700',
};

export default function CourseCard({
  course,
  footer,
}: {
  course: Pick<Course, 'id' | 'title' | 'description' | 'instructor' | 'category' | 'level' | 'duration_hours' | 'image_url'> & { is_published?: boolean };
  footer?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 group flex flex-col">
      <div className="h-36 bg-gradient-to-br from-blue-500 to-blue-700 relative overflow-hidden flex-shrink-0">
        {course.image_url ? (
          <img src={course.image_url} alt={course.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-12 h-12 text-white/30 group-hover:scale-110 transition-transform" />
          </div>
        )}
        <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-md text-xs font-medium ${levelColors[course.level] || 'bg-slate-100 text-slate-600'}`}>
          {course.level}
        </span>
      </div>

      <div className="p-5 flex flex-col flex-1">
        <span className="text-xs font-medium text-blue-600 mb-1.5 uppercase tracking-wide">{course.category}</span>
        <h3 className="text-base font-bold text-slate-900 mb-2 line-clamp-2 leading-snug">{course.title}</h3>
        <p className="text-sm text-slate-500 mb-4 line-clamp-2 flex-1">{course.description}</p>

        <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
          <span>por {course.instructor}</span>
          {course.duration_hours > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {course.duration_hours}h
            </span>
          )}
        </div>

        {footer}
      </div>
    </div>
  );
}
