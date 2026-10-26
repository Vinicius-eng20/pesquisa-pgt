import type { ReactNode } from "react";
import { Clock, User } from "lucide-react";
import type { Course } from "@/lib/courses";

export function CourseCard({ course, action }: { course: Course; action?: ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-6 shadow-card">
      <h3 className="text-xl font-semibold">{course.title}</h3>
      <p className="mt-2 flex-1 text-muted-foreground">{course.description}</p>
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
        {course.instructor && (
          <span className="flex items-center gap-1"><User className="h-4 w-4" />{course.instructor}</span>
        )}
        <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{course.workload_hours}h</span>
      </div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
